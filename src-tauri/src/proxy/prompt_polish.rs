use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::proxy::error::ProxyError;
use crate::proxy::security::validate_public_http_base_url;
use crate::proxy::types::DesktopProxyConfig;

const DEFAULT_OPENAI_BASE_URL: &str = "https://api.openai.com/v1";
const DEFAULT_ANTHROPIC_BASE_URL: &str = "https://api.anthropic.com/v1";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptPolishRequest {
    pub prompt: String,
    pub api_key: Option<String>,
    pub api_base_url: Option<String>,
    pub model_id: Option<String>,
    pub protocol: Option<String>,
    pub system_prompt: Option<String>,
    pub thinking_enabled: Option<bool>,
    pub thinking_effort: Option<String>,
    pub thinking_effort_format: Option<String>,
    #[serde(default)]
    pub proxy_config: DesktopProxyConfig,
    #[serde(default)]
    pub debug_mode: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptPolishResponse {
    pub polished_prompt: String,
}

pub async fn prompt_polish(
    client: &reqwest::Client,
    request: PromptPolishRequest,
) -> Result<PromptPolishResponse, ProxyError> {
    let prompt = request.prompt.trim();
    if prompt.is_empty() {
        return Err(ProxyError::bad_request("提示词不能为空。"));
    }

    let api_key = request
        .api_key
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .ok_or_else(|| ProxyError::bad_request("提示词润色需要配置 API Key。"))?;

    let uses_anthropic_messages = is_anthropic_protocol(request.protocol.as_deref());
    let default_base_url = if uses_anthropic_messages {
        DEFAULT_ANTHROPIC_BASE_URL
    } else {
        DEFAULT_OPENAI_BASE_URL
    };
    let base_url = validate_public_http_base_url(
        request
            .api_base_url
            .as_deref()
            .map(str::trim)
            .filter(|v| !v.is_empty())
            .or(Some(default_base_url)),
    )
    .await?;

    let model = request
        .model_id
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .ok_or_else(|| ProxyError::bad_request("提示词润色需要先在供应商端点管理中选择可用模型。"))?;

    let system_prompt = request
        .system_prompt
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .unwrap_or(DEFAULT_SYSTEM_PROMPT);

    if uses_anthropic_messages {
        let url = build_anthropic_messages_url(&base_url)?;
        let body = build_anthropic_body(
            prompt,
            &model,
            system_prompt,
            0.7,
            1200,
            request.thinking_enabled.unwrap_or(false),
            request.thinking_effort.as_deref(),
        );

        let response = client
            .post(&url)
            .header("Content-Type", "application/json")
            .header("x-api-key", api_key)
            .header("anthropic-version", "2023-06-01")
            .json(&body)
            .send()
            .await
            .map_err(|error| ProxyError::network(error.to_string()))?;

        return parse_anthropic_response(response).await;
    }

    let url = build_chat_completions_url(&base_url)?;
    let body = build_chat_body(
        prompt,
        &model,
        system_prompt,
        request.thinking_enabled.unwrap_or(false),
        request.thinking_effort.as_deref(),
        request.thinking_effort_format.as_deref(),
    );

    let response = client
        .post(&url)
        .bearer_auth(api_key)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|error| ProxyError::network(error.to_string()))?;

    parse_chat_response(response).await
}

fn is_anthropic_protocol(protocol: Option<&str>) -> bool {
    matches!(
        protocol.map(str::trim),
        Some("anthropic-messages" | "anthropic-compatible-messages")
    )
}

fn build_chat_completions_url(base_url: &str) -> Result<String, ProxyError> {
    let parsed = url::Url::parse(base_url)
        .or_else(|_| url::Url::parse(&format!("https://{base_url}")))
        .map_err(|_| ProxyError::bad_request("Base URL 格式无效。"))?;

    let pathname = parsed.path().trim_end_matches('/').to_string();

    let new_path = if pathname.ends_with("/chat/completions") {
        parsed.path().to_string()
    } else if pathname.ends_with("/images/generate") || pathname.ends_with("/images/edits") {
        pathname
            .replacen("/images/generate", "", 1)
            .replacen("/images/edits", "", 1)
            + "/chat/completions"
    } else if pathname.ends_with("/v1") {
        format!("{pathname}/chat/completions")
    } else {
        format!("{pathname}/v1/chat/completions")
    };

    let mut url = parsed.clone();
    url.set_path(&new_path);
    Ok(url.to_string())
}

fn build_anthropic_messages_url(base_url: &str) -> Result<String, ProxyError> {
    let parsed = url::Url::parse(base_url)
        .or_else(|_| url::Url::parse(&format!("https://{base_url}")))
        .map_err(|_| ProxyError::bad_request("Base URL 格式无效。"))?;

    let pathname = parsed.path().trim_end_matches('/').to_string();
    let new_path = if pathname.ends_with("/messages") {
        parsed.path().to_string()
    } else if pathname.ends_with("/v1") {
        format!("{pathname}/messages")
    } else {
        format!("{pathname}/v1/messages")
    };

    let mut url = parsed.clone();
    url.set_path(&new_path);
    Ok(url.to_string())
}

fn build_chat_body(
    prompt: &str,
    model: &str,
    system_prompt: &str,
    thinking_enabled: bool,
    thinking_effort: Option<&str>,
    thinking_effort_format: Option<&str>,
) -> Value {
    let messages = vec![
        json!({
            "role": "system",
            "content": system_prompt
        }),
        json!({
            "role": "user",
            "content": format!("用户原始输入（可能是提示词、长文、文案或关键词）：\n{}\n\n请只输出润色后的最终提示词。", prompt)
        }),
    ];

    let mut body = json!({
        "model": model,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 1200
    });

    if thinking_enabled {
        let effort = thinking_effort
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or("high");
        let format = thinking_effort_format
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or("openai");

        if let Some(object) = body.as_object_mut() {
            object.insert("thinking".to_string(), json!({ "type": "enabled" }));
            if format == "openai" || format == "both" {
                object.insert("reasoning_effort".to_string(), json!(effort));
            }
            if format == "anthropic" || format == "both" {
                object.insert("output_config".to_string(), json!({ "effort": effort }));
            }
        }
    }

    body
}

fn build_anthropic_body(
    prompt: &str,
    model: &str,
    system_prompt: &str,
    temperature: f64,
    max_tokens: i64,
    thinking_enabled: bool,
    thinking_effort: Option<&str>,
) -> Value {
    let user_content = format!(
        "用户原始输入（可能是提示词、长文、文案或关键词）：\n{}\n\n请只输出润色后的最终提示词。",
        prompt
    );
    let mut body = json!({
        "model": model,
        "system": system_prompt,
        "messages": [
            {
                "role": "user",
                "content": user_content
            }
        ],
        "temperature": temperature,
        "max_tokens": max_tokens
    });

    if thinking_enabled {
        let max_tokens_with_thinking = max_tokens.max(2048);
        if let Some(object) = body.as_object_mut() {
            object.insert("max_tokens".to_string(), json!(max_tokens_with_thinking));
            object.insert(
                "thinking".to_string(),
                json!({
                    "type": "enabled",
                    "budget_tokens": resolve_anthropic_thinking_budget(
                        thinking_effort,
                        max_tokens_with_thinking
                    )
                }),
            );
        }
    }

    body
}

fn resolve_anthropic_thinking_budget(effort: Option<&str>, max_tokens: i64) -> i64 {
    let normalized = effort
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("high")
        .to_ascii_lowercase();
    let requested = normalized.parse::<i64>().unwrap_or_else(|_| match normalized.as_str() {
        "minimal" | "low" => 1024,
        "medium" => 2048,
        "max" | "xhigh" => 8192,
        _ => 4096,
    });
    requested.max(1024).min((max_tokens - 1024).max(1024))
}

async fn parse_chat_response(
    response: reqwest::Response,
) -> Result<PromptPolishResponse, ProxyError> {
    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|error| ProxyError::network(error.to_string()))?;

    if !status.is_success() {
        return Err(ProxyError::provider(
            extract_error_message(&text),
            Some(status.as_u16()),
        ));
    }

    let value: Value = serde_json::from_str(&text)
        .map_err(|error| ProxyError::parse(format!("润色响应解析失败: {error}")))?;

    let polished_prompt = extract_prompt_text(&value)
        .ok_or_else(|| ProxyError::provider("提示词润色失败：模型未返回有效内容。", None))?;

    Ok(PromptPolishResponse {
        polished_prompt: normalize_polished_prompt(&polished_prompt),
    })
}

async fn parse_anthropic_response(
    response: reqwest::Response,
) -> Result<PromptPolishResponse, ProxyError> {
    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|error| ProxyError::network(error.to_string()))?;

    if !status.is_success() {
        return Err(ProxyError::provider(
            extract_error_message(&text),
            Some(status.as_u16()),
        ));
    }

    let value: Value = serde_json::from_str(&text)
        .map_err(|error| ProxyError::parse(format!("润色响应解析失败: {error}")))?;

    let polished_prompt = extract_anthropic_text(&value)
        .ok_or_else(|| ProxyError::provider("提示词润色失败：模型未返回有效内容。", None))?;

    Ok(PromptPolishResponse {
        polished_prompt: normalize_polished_prompt(&polished_prompt),
    })
}

fn extract_prompt_text(value: &Value) -> Option<String> {
    let object = value.as_object()?;
    let choices = object.get("choices")?.as_array()?;
    if choices.is_empty() {
        return None;
    }

    let first_choice = choices.first()?.as_object()?;

    if let Some(message) = first_choice.get("message").and_then(|m| m.as_object()) {
        if let Some(content) = message.get("content").and_then(|c| c.as_str()) {
            if !content.trim().is_empty() {
                return Some(content.to_string());
            }
        }
    }

    if let Some(text) = first_choice.get("text").and_then(|t| t.as_str()) {
        if !text.trim().is_empty() {
            return Some(text.to_string());
        }
    }

    None
}

fn extract_anthropic_text(value: &Value) -> Option<String> {
    let content = value.get("content")?.as_array()?;
    let text = content
        .iter()
        .filter_map(|item| {
            if item.get("type").and_then(Value::as_str) == Some("text") {
                item.get("text").and_then(Value::as_str)
            } else {
                None
            }
        })
        .collect::<String>();
    if text.trim().is_empty() {
        None
    } else {
        Some(text)
    }
}

fn normalize_polished_prompt(value: &str) -> String {
    let trimmed = value.trim();
    let without_opening_fence = trimmed
        .strip_prefix("```")
        .map(|text| {
            text.trim_start_matches(|c: char| c.is_alphanumeric())
                .trim_start()
        })
        .unwrap_or(trimmed);
    without_opening_fence
        .strip_suffix("```")
        .unwrap_or(without_opening_fence)
        .trim()
        .to_string()
}

fn extract_error_message(text: &str) -> String {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return "润色请求失败。".to_string();
    }

    if let Ok(value) = serde_json::from_str::<Value>(trimmed) {
        if let Some(message) = find_error_message(&value) {
            return message;
        }
    }

    trimmed.chars().take(1200).collect()
}

fn find_error_message(value: &Value) -> Option<String> {
    if let Some(message) = value.as_str().filter(|m| !m.trim().is_empty()) {
        return Some(message.trim().to_string());
    }

    let object = value.as_object()?;

    if let Some(error) = object.get("error") {
        return find_error_message(error);
    }

    for key in ["message", "error_description", "detail", "reason", "title"] {
        if let Some(message) = object.get(key).and_then(find_error_message) {
            return Some(message);
        }
    }

    None
}

const DEFAULT_SYSTEM_PROMPT: &str = "你是一名资深 AI 图像提示词导演与视觉润色专家。你的任务是把用户的任意原始输入，改写成更清晰、更专业、更适合图像生成模型执行的高质量生图提示词。只输出润色后的最终生图提示词，不要解释、标题、项目符号、Markdown、引号或前后缀。";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_chat_completions_url_with_trailing_slash() {
        let url = build_chat_completions_url("https://api.openai.com/v1/").unwrap();
        assert_eq!(url, "https://api.openai.com/v1/chat/completions");
    }

    #[test]
    fn test_build_chat_completions_url_already_completions() {
        let url =
            build_chat_completions_url("https://api.example.com/v1/chat/completions").unwrap();
        assert_eq!(url, "https://api.example.com/v1/chat/completions");
    }

    #[test]
    fn test_build_chat_completions_url_v1() {
        let url = build_chat_completions_url("https://api.example.com/v1").unwrap();
        assert_eq!(url, "https://api.example.com/v1/chat/completions");
    }

    #[test]
    fn test_build_chat_completions_url_no_protocol() {
        let url = build_chat_completions_url("api.example.com/v1").unwrap();
        assert_eq!(url, "https://api.example.com/v1/chat/completions");
    }

    #[test]
    fn test_extract_prompt_text_from_choices() {
        let value: Value = serde_json::json!({
            "choices": [{
                "message": {
                    "content": "A beautiful sunset over the ocean"
                }
            }]
        });
        assert_eq!(
            extract_prompt_text(&value),
            Some("A beautiful sunset over the ocean".to_string())
        );
    }

    #[test]
    fn test_extract_prompt_text_empty_choices() {
        let value: Value = serde_json::json!({
            "choices": []
        });
        assert_eq!(extract_prompt_text(&value), None);
    }

    #[test]
    fn test_normalize_polished_prompt_strips_code_blocks() {
        let input = "```markdown\nA beautiful prompt\n```";
        let normalized = normalize_polished_prompt(input);
        assert_eq!(normalized, "A beautiful prompt");
    }

    #[test]
    fn test_build_chat_body_with_thinking_params() {
        let body = build_chat_body(
            "prompt",
            "model",
            "system",
            true,
            Some("high"),
            Some("both"),
        );
        assert_eq!(body["thinking"]["type"], "enabled");
        assert_eq!(body["reasoning_effort"], "high");
        assert_eq!(body["output_config"]["effort"], "high");
    }

    #[test]
    fn test_normalize_polished_prompt_trims_whitespace() {
        let input = "  A clean prompt  ";
        let normalized = normalize_polished_prompt(input);
        assert_eq!(normalized, "A clean prompt");
    }
}
