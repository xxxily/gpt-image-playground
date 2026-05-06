use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};

use crate::proxy::error::ProxyError;
use crate::proxy::security::validate_public_http_base_url;
use crate::proxy::types::{CompletedImage, ProviderUsage, ProxyImagesRequest, ProxyImagesResponse};

const GEMINI_DEFAULT_BASE_URL: &str = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_NANO_BANANA_2_MODEL: &str = "gemini-3.1-flash-image-preview";

#[derive(Debug, Deserialize)]
struct GeminiResponse {
    candidates: Option<Vec<GeminiCandidate>>,
    usage_metadata: Option<GeminiUsageMetadata>,
}

#[derive(Debug, Deserialize)]
struct GeminiCandidate {
    content: Option<GeminiContent>,
    #[serde(rename = "finishReason")]
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GeminiContent {
    parts: Option<Vec<GeminiPart>>,
}

#[derive(Debug, Deserialize, Clone)]
struct GeminiPart {
    #[serde(rename = "inlineData")]
    inline_data: Option<GeminiInlineData>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct GeminiInlineData {
    #[serde(rename = "mimeType")]
    mime_type: Option<String>,
    data: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GeminiUsageMetadata {
    #[serde(rename = "promptTokenCount")]
    prompt_token_count: Option<u64>,
    #[serde(rename = "candidatesTokenCount")]
    candidates_token_count: Option<u64>,
    #[serde(rename = "totalTokenCount")]
    total_token_count: Option<u64>,
}

#[derive(Debug, Serialize)]
struct GeminiPartInput {
    #[serde(skip_serializing_if = "Option::is_none")]
    text: Option<String>,
    #[serde(rename = "inlineData", skip_serializing_if = "Option::is_none")]
    inline_data: Option<GeminiInlineData>,
}

pub async fn generate(
    client: &reqwest::Client,
    request: &ProxyImagesRequest,
) -> Result<ProxyImagesResponse, ProxyError> {
    validate_gemini_request(request)?;
    let api_key = request
        .api_key
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| ProxyError::bad_request("Gemini Nano Banana 2 需要配置 Gemini API Key。"))?;
    let base_url = validate_public_http_base_url(
        request
            .api_base_url
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .or(Some(GEMINI_DEFAULT_BASE_URL)),
    )
    .await?;

    let model = if request.model.trim().is_empty() || request.model == "gpt-image-2" {
        GEMINI_NANO_BANANA_2_MODEL
    } else {
        request.model.as_str()
    };

    let url = format!(
        "{}/models/{}:generateContent",
        base_url.trim_end_matches('/'),
        model
    );

    let parts = vec![GeminiPartInput {
        text: Some(request.prompt.clone()),
        inline_data: None,
    }];

    let body = build_gemini_body(&parts, request)?;

    let response = client
        .post(&url)
        .header("x-goog-api-key", api_key)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|error| ProxyError::network(error.to_string()))?;

    parse_gemini_response(response).await
}

pub async fn edit(
    client: &reqwest::Client,
    request: &ProxyImagesRequest,
) -> Result<ProxyImagesResponse, ProxyError> {
    validate_gemini_request(request)?;
    let api_key = request
        .api_key
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| ProxyError::bad_request("Gemini Nano Banana 2 需要配置 Gemini API Key。"))?;
    let base_url = validate_public_http_base_url(
        request
            .api_base_url
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .or(Some(GEMINI_DEFAULT_BASE_URL)),
    )
    .await?;

    let model = if request.model.trim().is_empty() || request.model == "gpt-image-2" {
        GEMINI_NANO_BANANA_2_MODEL
    } else {
        request.model.as_str()
    };

    let url = format!(
        "{}/models/{}:generateContent",
        base_url.trim_end_matches('/'),
        model
    );

    let mut parts: Vec<GeminiPartInput> = Vec::new();
    parts.push(GeminiPartInput {
        text: Some(request.prompt.clone()),
        inline_data: None,
    });

    for image in &request.edit_images {
        let encoded = general_purpose::STANDARD.encode(&image.bytes);
        parts.push(GeminiPartInput {
            text: None,
            inline_data: Some(GeminiInlineData {
                mime_type: Some(image.mime_type.clone()),
                data: Some(encoded),
            }),
        });
    }

    let body = build_gemini_body(&parts, request)?;

    let response = client
        .post(&url)
        .header("x-goog-api-key", api_key)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|error| ProxyError::network(error.to_string()))?;

    parse_gemini_response(response).await
}

fn validate_gemini_request(request: &ProxyImagesRequest) -> Result<(), ProxyError> {
    if request.prompt.trim().is_empty() {
        return Err(ProxyError::bad_request(
            "Missing required parameter: prompt",
        ));
    }
    Ok(())
}

fn build_gemini_body(
    parts: &[GeminiPartInput],
    request: &ProxyImagesRequest,
) -> Result<Value, ProxyError> {
    let mut body = Map::new();

    let contents = vec![json!({
        "parts": parts.iter().map(|p| {
            let mut part = Map::new();
            if let Some(text) = &p.text {
                part.insert("text".to_string(), Value::String(text.clone()));
            }
            if let Some(inline_data) = &p.inline_data {
                let mut inline = Map::new();
                if let Some(mime) = &inline_data.mime_type {
                    inline.insert("mimeType".to_string(), Value::String(mime.clone()));
                }
                if let Some(data) = &inline_data.data {
                    inline.insert("data".to_string(), Value::String(data.clone()));
                }
                part.insert("inlineData".to_string(), Value::Object(inline));
            }
            Value::Object(part)
        }).collect::<Vec<_>>()
    })];
    body.insert("contents".to_string(), Value::Array(contents));

    let mut generation_config = Map::new();
    generation_config.insert(
        "responseModalities".to_string(),
        Value::Array(vec![Value::String("IMAGE".to_string())]),
    );

    if let Some(size) = &request.size {
        let size = size.trim();
        if !size.is_empty() && size != "auto" {
            if let Some(aspect_ratio) = size_to_aspect_ratio(size) {
                let mut image_config = Map::new();
                image_config.insert(
                    "aspectRatio".to_string(),
                    Value::String(aspect_ratio.to_string()),
                );
                generation_config.insert("imageConfig".to_string(), Value::Object(image_config));
            }
        }
    }

    body.insert(
        "generationConfig".to_string(),
        Value::Object(generation_config),
    );

    Ok(Value::Object(body))
}

fn size_to_aspect_ratio(size: &str) -> Option<&str> {
    match size {
        "1024x1024" | "2048x2048" => Some("1:1"),
        "1536x1024" | "3072x2048" => Some("3:2"),
        "1024x1536" | "2048x3072" => Some("2:3"),
        _ => None,
    }
}

async fn parse_gemini_response(
    response: reqwest::Response,
) -> Result<ProxyImagesResponse, ProxyError> {
    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|error| ProxyError::network(error.to_string()))?;

    if !status.is_success() {
        return Err(ProxyError::provider(
            extract_gemini_error_message(&text),
            Some(status.as_u16()),
        ));
    }

    let gemini_response = serde_json::from_str::<GeminiResponse>(&text).map_err(|error| {
        ProxyError::parse(format!("Gemini response JSON parse failed: {error}"))
    })?;

    extract_gemini_images(&gemini_response)
}

fn extract_gemini_images(response: &GeminiResponse) -> Result<ProxyImagesResponse, ProxyError> {
    let parts: Vec<&GeminiPart> = response
        .candidates
        .as_ref()
        .map(|candidates| {
            candidates
                .iter()
                .filter_map(|c| c.content.as_ref())
                .filter_map(|content| content.parts.as_ref())
                .flatten()
                .collect()
        })
        .unwrap_or_default();

    let images: Vec<CompletedImage> = parts
        .iter()
        .enumerate()
        .filter_map(|(index, part)| {
            let inline_data = part.inline_data.as_ref()?;
            let data = inline_data.data.as_ref()?;
            if data.is_empty() {
                return None;
            }

            let (b64_json, output_format) = split_data_url(data, &inline_data.mime_type);
            let output_format = mime_to_output_format(&output_format);

            Some(CompletedImage {
                filename: format!("{}-{}.{}", current_timestamp_millis(), index, output_format),
                b64_json: Some(b64_json),
                path: None,
                output_format,
            })
        })
        .collect();

    if images.is_empty() {
        let finish_reason = response
            .candidates
            .as_ref()
            .and_then(|c| c.first())
            .and_then(|c| c.finish_reason.as_deref())
            .unwrap_or("unknown");
        return Err(ProxyError::provider(
            format!("Gemini 未返回图片数据，结束原因：{finish_reason}"),
            None,
        ));
    }

    let usage = response.usage_metadata.as_ref().map(to_provider_usage);

    Ok(ProxyImagesResponse { images, usage })
}

fn split_data_url(data: &str, mime_type: &Option<String>) -> (String, String) {
    if let Some(stripped) = data.strip_prefix("data:") {
        if let Some(pos) = stripped.find(";base64,") {
            let mime = &stripped[..pos];
            let base64_data = &stripped[pos + 8..];
            return (base64_data.to_string(), mime.to_string());
        }
    }
    (
        data.to_string(),
        mime_type.clone().unwrap_or_else(|| "image/png".to_string()),
    )
}

fn mime_to_output_format(mime: &str) -> String {
    match mime {
        "image/jpeg" | "image/jpg" => "jpeg".to_string(),
        "image/webp" => "webp".to_string(),
        _ => "png".to_string(),
    }
}

fn to_provider_usage(metadata: &GeminiUsageMetadata) -> ProviderUsage {
    let prompt_tokens = metadata.prompt_token_count.unwrap_or(0);
    let total_tokens = metadata.total_token_count.unwrap_or(0);
    let candidates_tokens = metadata
        .candidates_token_count
        .unwrap_or_else(|| total_tokens.saturating_sub(prompt_tokens));

    ProviderUsage {
        input_tokens_details: Some(crate::proxy::types::InputTokensDetails {
            text_tokens: Some(prompt_tokens),
            image_tokens: Some(0),
        }),
        output_tokens: Some(candidates_tokens),
    }
}

fn extract_gemini_error_message(text: &str) -> String {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return "Gemini 请求失败。".to_string();
    }

    if let Ok(value) = serde_json::from_str::<Value>(trimmed) {
        if let Some(message) = find_gemini_error_message(&value) {
            return message;
        }
    }

    trimmed.chars().take(1200).collect()
}

fn find_gemini_error_message(value: &Value) -> Option<String> {
    if let Some(message) = value
        .as_str()
        .map(str::trim)
        .filter(|message| !message.is_empty())
    {
        return Some(message.to_string());
    }

    let object = value.as_object()?;

    if let Some(error) = object.get("error") {
        return find_gemini_error_message(error);
    }

    for key in ["message", "error_description", "detail", "reason", "title"] {
        if let Some(message) = object.get(key).and_then(find_gemini_error_message) {
            return Some(message);
        }
    }

    None
}

fn current_timestamp_millis() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mime_to_output_format() {
        assert_eq!(mime_to_output_format("image/jpeg"), "jpeg");
        assert_eq!(mime_to_output_format("image/webp"), "webp");
        assert_eq!(mime_to_output_format("image/png"), "png");
        assert_eq!(mime_to_output_format("image/unknown"), "png");
    }

    #[test]
    fn test_size_to_aspect_ratio() {
        assert_eq!(size_to_aspect_ratio("1024x1024"), Some("1:1"));
        assert_eq!(size_to_aspect_ratio("1536x1024"), Some("3:2"));
        assert_eq!(size_to_aspect_ratio("1024x1536"), Some("2:3"));
        assert_eq!(size_to_aspect_ratio("2048x2048"), Some("1:1"));
        assert_eq!(size_to_aspect_ratio("custom"), None);
    }

    #[test]
    fn test_split_data_url_with_prefix() {
        let (data, mime) = split_data_url(
            "data:image/jpeg;base64,abc123",
            &Some("image/png".to_string()),
        );
        assert_eq!(data, "abc123");
        assert_eq!(mime, "image/jpeg");
    }

    #[test]
    fn test_split_data_url_without_prefix() {
        let (data, mime) = split_data_url("abc123", &Some("image/png".to_string()));
        assert_eq!(data, "abc123");
        assert_eq!(mime, "image/png");
    }

    #[test]
    fn test_find_gemini_error_message_from_error_object() {
        let value: Value = serde_json::json!({
            "error": {
                "message": "API key not valid"
            }
        });
        assert_eq!(
            find_gemini_error_message(&value),
            Some("API key not valid".to_string())
        );
    }

    #[test]
    fn test_find_gemini_error_message_from_top_level_message() {
        let value: Value = serde_json::json!({
            "message": "Something went wrong"
        });
        assert_eq!(
            find_gemini_error_message(&value),
            Some("Something went wrong".to_string())
        );
    }

    #[test]
    fn test_build_gemini_body_sets_image_response_modality() {
        let request = ProxyImagesRequest {
            mode: crate::proxy::types::ProxyImageMode::Generate,
            model: "gemini-3.1-flash-image-preview".to_string(),
            prompt: "A test image".to_string(),
            n: 1,
            size: Some("1024x1024".to_string()),
            quality: None,
            output_format: None,
            output_compression: None,
            background: None,
            moderation: None,
            provider: crate::proxy::types::ProxyProvider::Google,
            api_key: Some("gemini-key".to_string()),
            api_base_url: None,
            provider_options: serde_json::json!({}),
            edit_images: Vec::new(),
            edit_mask_file: None,
            enable_streaming: false,
            partial_images: None,
            proxy_config: crate::proxy::types::DesktopProxyConfig::Disabled,
            debug_mode: false,
        };
        let parts = vec![GeminiPartInput {
            text: Some("A test image".to_string()),
            inline_data: None,
        }];

        let body = build_gemini_body(&parts, &request).unwrap();
        assert_eq!(body["generationConfig"]["responseModalities"][0], "IMAGE");
        assert_eq!(
            body["generationConfig"]["imageConfig"]["aspectRatio"],
            "1:1"
        );
    }
}
