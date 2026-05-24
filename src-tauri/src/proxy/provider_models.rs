use std::time::{SystemTime, UNIX_EPOCH};

use serde_json::Value;

use crate::proxy::error::ProxyError;
use crate::proxy::security::normalize_model_discovery_base_url;
use crate::proxy::types::{
    DiscoveredProviderModel, ProxyProviderModelsRequest, ProxyProviderModelsResponse,
};

pub async fn proxy_provider_models(
    client: &reqwest::Client,
    request: ProxyProviderModelsRequest,
) -> Result<ProxyProviderModelsResponse, ProxyError> {
    if !supports_provider_model_discovery(&request.endpoint.provider, &request.endpoint.protocol) {
        return Err(ProxyError::bad_request(
            "该供应商暂不支持自动读取模型列表。",
        ));
    }

    let api_key = request
        .endpoint
        .api_key
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| ProxyError::bad_request("刷新模型列表需要配置 API Key。"))?;
    let uses_anthropic_models =
        is_anthropic_endpoint(&request.endpoint.provider, &request.endpoint.protocol);
    let default_base_url = if uses_anthropic_models {
        "https://api.anthropic.com/v1"
    } else {
        "https://api.openai.com/v1"
    };
    let api_base_url = request
        .endpoint
        .api_base_url
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(default_base_url);
    let base_url = normalize_model_discovery_base_url(Some(api_base_url))?;
    let mut request_builder = client.get(format!("{base_url}/models")).header("accept", "application/json");
    if uses_anthropic_models {
        request_builder = request_builder
            .header("x-api-key", api_key)
            .header("anthropic-version", "2023-06-01");
    } else {
        request_builder = request_builder.bearer_auth(api_key);
    }
    let response = request_builder
        .send()
        .await
        .map_err(|error| ProxyError::network(error.to_string()))?;

    let status = response.status();
    let value: Value = response
        .json()
        .await
        .map_err(|error| ProxyError::provider(format!("模型列表响应解析失败：{error}"), None))?;
    if !status.is_success() {
        return Err(ProxyError::provider(
            format_provider_error(&value, status.as_u16()),
            Some(status.as_u16()),
        ));
    }

    Ok(ProxyProviderModelsResponse {
        models: parse_models(value),
        refreshed_at: now_millis(),
    })
}

fn supports_provider_model_discovery(provider: &str, protocol: &str) -> bool {
    if is_openai_endpoint(provider, protocol) || is_anthropic_endpoint(provider, protocol) {
        return true;
    }
    matches!(
        protocol,
        "tencent-tokenhub-video"
    )
}

fn is_openai_endpoint(provider: &str, protocol: &str) -> bool {
    matches!(provider, "openai" | "openai-compatible")
        || matches!(
            protocol,
            "openai-responses"
                | "openai-chat-completions"
                | "openai-images"
                | "ark-openai-compatible"
                | "openai-videos"
        )
}

fn is_anthropic_endpoint(provider: &str, protocol: &str) -> bool {
    matches!(provider, "anthropic" | "anthropic-compatible")
        || is_anthropic_protocol(protocol)
}

fn is_anthropic_protocol(protocol: &str) -> bool {
    matches!(
        protocol,
        "anthropic-messages" | "anthropic-compatible-messages"
    )
}

fn now_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default()
}

fn parse_models(value: Value) -> Vec<DiscoveredProviderModel> {
    let mut seen = std::collections::HashSet::new();
    let mut models = Vec::new();
    let Some(items) = value.get("data").and_then(Value::as_array) else {
        return models;
    };

    for item in items {
        let Some(id) = item.get("id").and_then(Value::as_str).map(str::trim) else {
            continue;
        };
        if id.is_empty() || !seen.insert(id.to_string()) {
            continue;
        }
        let display_label = item
            .get("display_name")
            .or_else(|| item.get("name"))
            .or_else(|| item.get("label"))
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned);
        let upstream_vendor = item
            .get("owned_by")
            .or_else(|| item.get("provider"))
            .or_else(|| item.get("vendor"))
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned);
        let remote_metadata = pick_remote_metadata(item);

        models.push(DiscoveredProviderModel {
            id: id.to_string(),
            label: None,
            display_label,
            upstream_vendor,
            remote_metadata,
        });
    }

    models
}

fn pick_remote_metadata(item: &Value) -> Option<Value> {
    let mut fields = serde_json::Map::new();
    for key in [
        "object",
        "owned_by",
        "provider",
        "family",
        "modalities",
        "capabilities",
        "created",
    ] {
        if let Some(value) = item.get(key) {
            fields.insert(key.to_string(), value.clone());
        }
    }
    if fields.is_empty() {
        None
    } else {
        Some(Value::Object(fields))
    }
}

fn format_provider_error(value: &Value, status: u16) -> String {
    let message = value
        .get("error")
        .and_then(|error| match error {
            Value::String(message) => Some(message.as_str()),
            Value::Object(record) => record.get("message").and_then(Value::as_str),
            _ => None,
        })
        .unwrap_or("模型列表读取失败。");
    format!("{message} (HTTP {status})")
}

#[cfg(test)]
mod tests {
    use super::{is_anthropic_endpoint, parse_models, supports_provider_model_discovery};
    use serde_json::json;

    #[test]
    fn parses_openai_compatible_models_without_merging_vendors() {
        let models = parse_models(json!({
            "data": [
                { "id": "openai/gpt-image-2", "owned_by": "openai" },
                { "id": "openai/gpt-image-2", "owned_by": "duplicate" },
                { "id": "vendor/custom-vl", "provider": "vendor" }
            ]
        }));

        assert_eq!(models.len(), 2);
        assert_eq!(models[0].id, "openai/gpt-image-2");
        assert_eq!(models[0].upstream_vendor.as_deref(), Some("openai"));
        assert_eq!(models[1].upstream_vendor.as_deref(), Some("vendor"));
    }

    #[test]
    fn allows_model_discovery_for_supported_provider_protocols() {
        assert!(supports_provider_model_discovery("openai", "openai-videos"));
        assert!(supports_provider_model_discovery("tencent-tokenhub", "tencent-tokenhub-video"));
        assert!(supports_provider_model_discovery("anthropic", "anthropic-messages"));
        assert!(supports_provider_model_discovery("openai-compatible", "runway-api-v1"));
        assert!(is_anthropic_endpoint("anthropic-compatible", "runway-api-v1"));
        assert!(!supports_provider_model_discovery("runway", "runway-api-v1"));
    }
}
