use std::time::Instant;

use base64::{engine::general_purpose, Engine as _};
use futures_util::StreamExt;
use serde_json::{json, Value};
use tauri::ipc::Channel;

use crate::proxy::commands::StreamingVisionTextEventPayload;
use crate::proxy::error::ProxyError;
use crate::proxy::security::validate_public_http_base_url;
use crate::proxy::types::{ProxyImageFile, ProxyVisionTextRequest, ProxyVisionTextResponse};

const MAX_IMAGE_BYTES: usize = 50 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES: usize = 120 * 1024 * 1024;

pub async fn proxy_image_to_text(
    client: &reqwest::Client,
    request: ProxyVisionTextRequest,
) -> Result<ProxyVisionTextResponse, ProxyError> {
    validate_request(&request)?;
    let started = Instant::now();
    let api_key = request
        .api_key
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| ProxyError::bad_request("图生文需要配置 API Key。"))?;
    let base_url = validate_public_http_base_url(request.api_base_url.as_deref()).await?;

    let (text, structured, usage) = if request.api_compatibility == "chat-completions" {
        execute_chat_completions(client, &request, api_key, &base_url).await?
    } else {
        execute_responses(client, &request, api_key, &base_url).await?
    };

    Ok(ProxyVisionTextResponse {
        text,
        structured,
        usage,
        provider: request.provider_kind,
        provider_instance_id: request.provider_instance_id,
        model: request.model,
        duration_ms: started.elapsed().as_millis(),
    })
}

pub async fn proxy_image_to_text_streaming(
    client: &reqwest::Client,
    request: ProxyVisionTextRequest,
    channel: Channel<StreamingVisionTextEventPayload>,
) -> Result<(), ProxyError> {
    validate_request(&request)?;
    let api_key = request
        .api_key
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| ProxyError::bad_request("图生文需要配置 API Key。"))?;
    let base_url = validate_public_http_base_url(request.api_base_url.as_deref()).await?;

    send_channel_event(
        &channel,
        "meta",
        json!({
            "provider": request.provider_kind,
            "providerInstanceId": request.provider_instance_id,
            "model": request.model,
            "taskType": request.task_type,
            "apiCompatibility": request.api_compatibility
        }),
    )?;

    if request.api_compatibility == "chat-completions" {
        stream_chat_completions(client, &request, api_key, &base_url, channel).await
    } else {
        stream_responses(client, &request, api_key, &base_url, channel).await
    }
}

fn validate_request(request: &ProxyVisionTextRequest) -> Result<(), ProxyError> {
    if request.model.trim().is_empty() {
        return Err(ProxyError::bad_request("Missing required parameter: model"));
    }
    if request.images.is_empty() {
        return Err(ProxyError::bad_request("图生文至少需要一张图片。"));
    }

    let mut total_bytes = 0usize;
    for image in &request.images {
        total_bytes += image.bytes.len();
        if image.bytes.len() > MAX_IMAGE_BYTES {
            return Err(ProxyError::bad_request(format!(
                "图片 '{}' 超过 50MB 限制，请压缩后重试。",
                image.name
            )));
        }
    }
    if total_bytes > MAX_TOTAL_IMAGE_BYTES {
        return Err(ProxyError::bad_request(
            "图片总大小超过 120MB 限制，请减少图片或压缩后重试。",
        ));
    }

    Ok(())
}

async fn execute_responses(
    client: &reqwest::Client,
    request: &ProxyVisionTextRequest,
    api_key: &str,
    base_url: &str,
) -> Result<(String, Option<Value>, Option<Value>), ProxyError> {
    let url = build_endpoint_url(base_url, "responses")?;
    let body = build_responses_body(request, false)?;
    let response = client
        .post(url)
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .await
        .map_err(|error| ProxyError::network(error.to_string()))?;
    let value = read_json_response(response, "图生文请求失败。").await?;
    let text = extract_responses_text(&value)
        .ok_or_else(|| ProxyError::provider("图生文失败：模型未返回有效文本。", None))?;
    let structured = parse_structured(&text, request);
    let usage = value.get("usage").cloned();
    Ok((text, structured, usage))
}

async fn execute_chat_completions(
    client: &reqwest::Client,
    request: &ProxyVisionTextRequest,
    api_key: &str,
    base_url: &str,
) -> Result<(String, Option<Value>, Option<Value>), ProxyError> {
    let url = build_endpoint_url(base_url, "chat/completions")?;
    let body = build_chat_body(request, false)?;
    let response = client
        .post(url)
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .await
        .map_err(|error| ProxyError::network(error.to_string()))?;
    let value = read_json_response(response, "图生文请求失败。").await?;
    let text = extract_chat_text(&value)
        .ok_or_else(|| ProxyError::provider("图生文失败：模型未返回有效文本。", None))?;
    let structured = parse_structured(&text, request);
    let usage = value.get("usage").cloned();
    Ok((text, structured, usage))
}

async fn stream_responses(
    client: &reqwest::Client,
    request: &ProxyVisionTextRequest,
    api_key: &str,
    base_url: &str,
    channel: Channel<StreamingVisionTextEventPayload>,
) -> Result<(), ProxyError> {
    let url = build_endpoint_url(base_url, "responses")?;
    let body = build_responses_body(request, true)?;
    let response = client
        .post(url)
        .bearer_auth(api_key)
        .header(reqwest::header::ACCEPT, "text/event-stream")
        .json(&body)
        .send()
        .await
        .map_err(|error| ProxyError::network(error.to_string()))?;

    read_vision_text_stream(response, channel, request).await
}

async fn stream_chat_completions(
    client: &reqwest::Client,
    request: &ProxyVisionTextRequest,
    api_key: &str,
    base_url: &str,
    channel: Channel<StreamingVisionTextEventPayload>,
) -> Result<(), ProxyError> {
    let url = build_endpoint_url(base_url, "chat/completions")?;
    let body = build_chat_body(request, true)?;
    let response = client
        .post(url)
        .bearer_auth(api_key)
        .header(reqwest::header::ACCEPT, "text/event-stream")
        .json(&body)
        .send()
        .await
        .map_err(|error| ProxyError::network(error.to_string()))?;

    read_vision_text_stream(response, channel, request).await
}

fn build_responses_body(request: &ProxyVisionTextRequest, stream: bool) -> Result<Value, ProxyError> {
    let mut body = json!({
        "model": request.model,
        "instructions": build_system_instructions(request),
        "input": [{
            "role": "user",
            "content": build_responses_content(request)?
        }],
        "max_output_tokens": normalized_max_output_tokens(request.max_output_tokens)
    });

    if request.response_format == "json_schema" {
        body["text"] = json!({
            "format": {
                "type": "json_schema",
                "name": format!("vision_text_{}", request.task_type),
                "strict": true,
                "schema": response_schema()
            }
        });
    }
    if stream {
        body["stream"] = json!(true);
    }

    Ok(body)
}

fn build_chat_body(request: &ProxyVisionTextRequest, stream: bool) -> Result<Value, ProxyError> {
    let mut body = json!({
        "model": request.model,
        "messages": [
            {
                "role": "system",
                "content": build_system_instructions(request)
            },
            {
                "role": "user",
                "content": build_chat_content(request)?
            }
        ],
        "max_tokens": normalized_max_output_tokens(request.max_output_tokens)
    });

    if request.response_format == "json_schema" {
        body["response_format"] = json!({ "type": "json_object" });
    }
    if stream {
        body["stream"] = json!(true);
    }

    Ok(body)
}

fn build_responses_content(request: &ProxyVisionTextRequest) -> Result<Vec<Value>, ProxyError> {
    let mut content = vec![json!({
        "type": "input_text",
        "text": build_user_instruction(request)
    })];
    for image in &request.images {
        content.push(json!({
            "type": "input_image",
            "image_url": data_url(image)?,
            "detail": normalize_detail(&request.detail)
        }));
    }
    Ok(content)
}

fn build_chat_content(request: &ProxyVisionTextRequest) -> Result<Vec<Value>, ProxyError> {
    let mut content = vec![json!({
        "type": "text",
        "text": build_user_instruction(request)
    })];
    for image in &request.images {
        content.push(json!({
            "type": "image_url",
            "image_url": {
                "url": data_url(image)?,
                "detail": normalize_chat_detail(&request.detail)
            }
        }));
    }
    Ok(content)
}

fn data_url(image: &ProxyImageFile) -> Result<String, ProxyError> {
    let mime_type = if image.mime_type.trim().is_empty() {
        "application/octet-stream"
    } else {
        image.mime_type.trim()
    };
    Ok(format!(
        "data:{mime_type};base64,{}",
        general_purpose::STANDARD.encode(&image.bytes)
    ))
}

fn build_system_instructions(request: &ProxyVisionTextRequest) -> String {
    let base = if request.system_prompt.trim().is_empty() {
        "你是一个图像理解助手。只能描述图片中可见或可合理推断的信息，不要编造身份、品牌、地点或不可见细节。"
    } else {
        request.system_prompt.trim()
    };
    if request.structured_output_enabled || request.response_format == "json_schema" {
        format!("{base}\n\n请严格输出 JSON，不要使用代码块，不要附加额外解释。")
    } else {
        base.to_string()
    }
}

fn build_user_instruction(request: &ProxyVisionTextRequest) -> String {
    let base = if request.prompt.trim().is_empty() {
        default_instruction(&request.task_type)
    } else {
        request.prompt.trim().to_string()
    };
    if request.images.len() <= 1 {
        base
    } else {
        format!("{base}\n\n当前共有 {} 张图片，请按添加顺序逐张编号分析。", request.images.len())
    }
}

fn default_instruction(task_type: &str) -> String {
    match task_type {
        "image_description" => "请客观描述图片内容，强调主要主体、动作、环境和可见细节。",
        "design_spec" => "请提取可复用的界面或视觉设计规范，包括布局、组件、色彩、字体、间距和状态。",
        "ocr_and_layout" => "请优先识别图片中的文字，并说明版式结构、信息层级和关键视觉元素。",
        "freeform_qa" => "请根据图片回答用户的问题。",
        _ => "请分析图片并反推出一套可复用的文生图提示词。优先给出主提示词、负向提示词和关键视觉要素。",
    }
    .to_string()
}

fn normalize_detail(value: &str) -> &str {
    match value {
        "low" | "high" | "original" => value,
        _ => "auto",
    }
}

fn normalize_chat_detail(value: &str) -> &str {
    match value {
        "low" | "high" => value,
        _ => "auto",
    }
}

fn normalized_max_output_tokens(value: u32) -> u32 {
    value.clamp(1, 32768)
}

fn build_endpoint_url(base_url: &str, endpoint: &str) -> Result<String, ProxyError> {
    let parsed = url::Url::parse(base_url)
        .or_else(|_| url::Url::parse(&format!("https://{base_url}")))
        .map_err(|_| ProxyError::bad_request("Base URL 格式无效。"))?;
    let pathname = parsed.path().trim_end_matches('/');
    let endpoint_suffix = format!("/{endpoint}");
    let new_path = if pathname.ends_with(&endpoint_suffix) {
        parsed.path().to_string()
    } else if pathname.ends_with("/v1") {
        format!("{pathname}/{endpoint}")
    } else {
        format!("{pathname}/v1/{endpoint}")
    };
    let mut url = parsed.clone();
    url.set_path(&new_path);
    Ok(url.to_string())
}

async fn read_json_response(response: reqwest::Response, fallback: &str) -> Result<Value, ProxyError> {
    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|error| ProxyError::network(error.to_string()))?;
    if !status.is_success() {
        return Err(ProxyError::provider(extract_error_message(&text, fallback), Some(status.as_u16())));
    }
    serde_json::from_str(&text).map_err(|error| ProxyError::parse(format!("图生文响应解析失败: {error}")))
}

async fn read_vision_text_stream(
    response: reqwest::Response,
    channel: Channel<StreamingVisionTextEventPayload>,
    request: &ProxyVisionTextRequest,
) -> Result<(), ProxyError> {
    let status = response.status();
    if !status.is_success() {
        let text = response
            .text()
            .await
            .unwrap_or_else(|_| "图生文流式请求失败。".to_string());
        return Err(ProxyError::provider(extract_error_message(&text, "图生文流式请求失败。"), Some(status.as_u16())));
    }

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();
    let mut text = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|error| ProxyError::network(format!("读取流式响应失败: {error}")))?;
        let chunk_text = std::str::from_utf8(&chunk)
            .map_err(|error| ProxyError::parse(format!("流式响应不是有效 UTF-8: {error}")))?;
        buffer.push_str(chunk_text);

        while let Some(separator_index) = buffer.find("\n\n") {
            let block = buffer[..separator_index].to_string();
            buffer = buffer[separator_index + 2..].to_string();
            handle_stream_block(&block, &channel, request, &mut text)?;
        }
    }

    if !buffer.trim().is_empty() {
        handle_stream_block(&buffer, &channel, request, &mut text)?;
    }

    let structured = parse_structured(&text, request);
    send_channel_event(&channel, "final", json!({ "text": text, "structured": structured }))?;
    send_channel_event(&channel, "done", json!({}))?;
    Ok(())
}

fn handle_stream_block(
    block: &str,
    channel: &Channel<StreamingVisionTextEventPayload>,
    request: &ProxyVisionTextRequest,
    text: &mut String,
) -> Result<(), ProxyError> {
    let Some(data) = parse_sse_data(block) else {
        return Ok(());
    };
    if data == json!("[DONE]") {
        return Ok(());
    }

    if let Some(error_message) = find_error_message(&data) {
        send_channel_event(channel, "error", json!({ "error": error_message }))?;
        return Ok(());
    }

    if request.api_compatibility == "chat-completions" {
        if let Some(delta) = data
            .get("choices")
            .and_then(Value::as_array)
            .and_then(|choices| choices.first())
            .and_then(|choice| choice.get("delta"))
            .and_then(|delta| delta.get("content"))
            .and_then(Value::as_str)
        {
            if !delta.is_empty() {
                text.push_str(delta);
                send_channel_event(channel, "text_delta", json!({ "delta": delta }))?;
            }
        }
        return Ok(());
    }

    if data.get("type").and_then(Value::as_str) == Some("response.output_text.delta") {
        if let Some(delta) = data.get("delta").and_then(Value::as_str) {
            text.push_str(delta);
            send_channel_event(channel, "text_delta", json!({ "delta": delta }))?;
        }
    } else if data.get("type").and_then(Value::as_str) == Some("response.completed") {
        if let Some(response) = data.get("response") {
            if let Some(final_text) = extract_responses_text(response) {
                *text = final_text;
            }
            if let Some(usage) = response.get("usage") {
                send_channel_event(channel, "usage", usage.clone())?;
            }
        }
    }

    Ok(())
}

fn parse_sse_data(block: &str) -> Option<Value> {
    let mut data_lines = Vec::new();
    for line in block.lines() {
        let line = line.trim();
        if let Some(rest) = line.strip_prefix("data:") {
            data_lines.push(rest.trim_start());
        }
    }
    if data_lines.is_empty() {
        return None;
    }
    let data = data_lines.join("\n");
    if data == "[DONE]" {
        return Some(json!("[DONE]"));
    }
    serde_json::from_str(&data).ok()
}

fn send_channel_event(
    channel: &Channel<StreamingVisionTextEventPayload>,
    event_type: &str,
    data: Value,
) -> Result<(), ProxyError> {
    channel
        .send(StreamingVisionTextEventPayload {
            event_type: event_type.to_string(),
            data,
        })
        .map_err(|error| ProxyError::network(format!("发送图生文流式事件失败: {error}")))
}

fn extract_responses_text(value: &Value) -> Option<String> {
    if let Some(text) = value.get("output_text").and_then(Value::as_str) {
        if !text.trim().is_empty() {
            return Some(text.trim().to_string());
        }
    }
    let mut parts = Vec::new();
    for item in value.get("output").and_then(Value::as_array).into_iter().flatten() {
        for part in item.get("content").and_then(Value::as_array).into_iter().flatten() {
            if let Some(text) = part.get("text").and_then(Value::as_str) {
                if !text.is_empty() {
                    parts.push(text);
                }
            }
        }
    }
    if parts.is_empty() {
        None
    } else {
        Some(parts.join("").trim().to_string())
    }
}

fn extract_chat_text(value: &Value) -> Option<String> {
    value
        .get("choices")
        .and_then(Value::as_array)
        .and_then(|choices| choices.first())
        .and_then(|choice| choice.get("message"))
        .and_then(|message| message.get("content"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .map(str::to_string)
}

fn parse_structured(text: &str, request: &ProxyVisionTextRequest) -> Option<Value> {
    if !request.structured_output_enabled && request.response_format != "json_schema" {
        return None;
    }
    let trimmed = strip_code_fences(text);
    serde_json::from_str(&trimmed).ok()
}

fn strip_code_fences(value: &str) -> String {
    let trimmed = value.trim();
    if !trimmed.starts_with("```") {
        return trimmed.to_string();
    }
    trimmed
        .trim_start_matches("```json")
        .trim_start_matches("```JSON")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim()
        .to_string()
}

fn extract_error_message(text: &str, fallback: &str) -> String {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return fallback.to_string();
    }
    if let Ok(value) = serde_json::from_str::<Value>(trimmed) {
        if let Some(message) = find_error_message(&value) {
            return message;
        }
    }
    trimmed.chars().take(1200).collect()
}

fn find_error_message(value: &Value) -> Option<String> {
    if let Some(message) = value.as_str().filter(|message| !message.trim().is_empty()) {
        return Some(message.trim().to_string());
    }
    let object = value.as_object()?;
    if let Some(error) = object.get("error") {
        if let Some(message) = find_error_message(error) {
            return Some(message);
        }
    }
    if let Some(message) = object.get("message").and_then(Value::as_str) {
        if !message.trim().is_empty() {
            return Some(message.trim().to_string());
        }
    }
    None
}

fn response_schema() -> Value {
    json!({
        "type": "object",
        "additionalProperties": false,
        "properties": {
            "summary": { "type": "string" },
            "prompt": { "type": "string" },
            "negativePrompt": { "type": "string" },
            "styleTags": { "type": "array", "items": { "type": "string" } },
            "subject": { "type": "string" },
            "composition": { "type": "string" },
            "lighting": { "type": "string" },
            "colorPalette": { "type": "string" },
            "materials": { "type": "string" },
            "textInImage": { "type": "string" },
            "aspectRatioRecommendation": { "type": "string" },
            "generationNotes": { "type": "string" },
            "warnings": { "type": "array", "items": { "type": "string" } }
        },
        "required": [
            "summary",
            "prompt",
            "negativePrompt",
            "styleTags",
            "subject",
            "composition",
            "lighting",
            "colorPalette",
            "materials",
            "textInImage",
            "aspectRatioRecommendation",
            "generationNotes",
            "warnings"
        ]
    })
}
