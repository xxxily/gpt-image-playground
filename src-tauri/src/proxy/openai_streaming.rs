use base64::{engine::general_purpose, Engine as _};
use reqwest::multipart;
use serde_json::{json, Map, Value};
use tauri::ipc::Channel;

use crate::proxy::commands::StreamingImageEventPayload;
use crate::proxy::error::ProxyError;
use crate::proxy::security::validate_public_http_base_url;
use crate::proxy::sse_parser::parse_sse_events;
use crate::proxy::types::{
    ProxyImageFile, ProxyImageMode, ProxyImagesRequest, ProxyProvider,
};

pub async fn proxy_images_streaming(
    client: &reqwest::Client,
    request: &ProxyImagesRequest,
    channel: Channel<StreamingImageEventPayload>,
) -> Result<(), ProxyError> {
    let api_key = request
        .api_key
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .ok_or_else(|| ProxyError::bad_request(missing_api_key_message(&request.provider)))?;
    let base_url = validate_public_http_base_url(request.api_base_url.as_deref()).await?;

    match request.mode {
        ProxyImageMode::Generate => {
            stream_generate(client, request, api_key, &base_url, channel).await
        }
        ProxyImageMode::Edit => {
            if request.provider == ProxyProvider::Seedream {
                stream_edit_as_generation_json(client, request, api_key, &base_url, channel).await
            } else {
                stream_edit(client, request, api_key, &base_url, channel).await
            }
        }
    }
}

async fn stream_generate(
    client: &reqwest::Client,
    request: &ProxyImagesRequest,
    api_key: &str,
    base_url: &str,
    channel: Channel<StreamingImageEventPayload>,
) -> Result<(), ProxyError> {
    let url = format!("{base_url}/images/generations");
    let body = build_generate_body(request)?;

    let response = client
        .post(url)
        .bearer_auth(api_key)
        .header("Accept", "text/event-stream")
        .json(&body)
        .send()
        .await
        .map_err(|e| ProxyError::network(e.to_string()))?;

    if !response.status().is_success() {
        let status = response.status().as_u16();
        let text = response
            .text()
            .await
            .unwrap_or_else(|_| "Streaming request failed.".to_string());
        return Err(ProxyError::provider(
            extract_error_message(&text),
            Some(status),
        ));
    }

    parse_and_forward_sse(response, channel).await
}

async fn stream_edit(
    client: &reqwest::Client,
    request: &ProxyImagesRequest,
    api_key: &str,
    base_url: &str,
    channel: Channel<StreamingImageEventPayload>,
) -> Result<(), ProxyError> {
    let url = format!("{base_url}/images/edits");
    let mut form = multipart::Form::new()
        .text("model", request.model.clone())
        .text("prompt", request.prompt.clone())
        .text("n", normalized_image_count(request.n, 10).to_string());

    if let Some(size) = optional_text(request.size.as_deref()) {
        if size != "auto" {
            form = form.text("size", size.to_string());
        }
    }
    if let Some(quality) = optional_text(request.quality.as_deref()) {
        if quality != "auto" {
            form = form.text("quality", quality.to_string());
        }
    }

    form = append_provider_options_to_multipart(form, &request.provider_options);

    for image in &request.edit_images {
        let mime = optional_text(Some(&image.mime_type)).unwrap_or("application/octet-stream");
        let part = multipart::Part::bytes(image.bytes.clone())
            .file_name(image.name.clone())
            .mime_str(mime)
            .map_err(|e| ProxyError::bad_request(format!("Invalid image MIME type: {e}")))?;
        form = form.part("image", part);
    }

    if let Some(mask) = &request.edit_mask_file {
        let mime = optional_text(Some(&mask.mime_type)).unwrap_or("application/octet-stream");
        let part = multipart::Part::bytes(mask.bytes.clone())
            .file_name(mask.name.clone())
            .mime_str(mime)
            .map_err(|e| ProxyError::bad_request(format!("Invalid mask MIME type: {e}")))?;
        form = form.part("mask", part);
    }

    let response = client
        .post(url)
        .bearer_auth(api_key)
        .header("Accept", "text/event-stream")
        .multipart(form)
        .send()
        .await
        .map_err(|e| ProxyError::network(e.to_string()))?;

    if !response.status().is_success() {
        let status = response.status().as_u16();
        let text = response
            .text()
            .await
            .unwrap_or_else(|_| "Streaming request failed.".to_string());
        return Err(ProxyError::provider(
            extract_error_message(&text),
            Some(status),
        ));
    }

    parse_and_forward_sse(response, channel).await
}

async fn stream_edit_as_generation_json(
    client: &reqwest::Client,
    request: &ProxyImagesRequest,
    api_key: &str,
    base_url: &str,
    channel: Channel<StreamingImageEventPayload>,
) -> Result<(), ProxyError> {
    let url = format!("{base_url}/images/generations");
    let body = build_generation_edit_body(request)?;

    let response = client
        .post(url)
        .bearer_auth(api_key)
        .header("Accept", "text/event-stream")
        .json(&body)
        .send()
        .await
        .map_err(|e| ProxyError::network(e.to_string()))?;

    if !response.status().is_success() {
        let status = response.status().as_u16();
        let text = response
            .text()
            .await
            .unwrap_or_else(|_| "Streaming request failed.".to_string());
        return Err(ProxyError::provider(
            extract_error_message(&text),
            Some(status),
        ));
    }

    parse_and_forward_sse(response, channel).await
}

async fn parse_and_forward_sse(
    response: reqwest::Response,
    channel: Channel<StreamingImageEventPayload>,
) -> Result<(), ProxyError> {
    let text = response
        .text()
        .await
        .map_err(|e| ProxyError::network(format!("Failed to read streaming response: {e}")))?;

    let events = parse_sse_events(&text);

    for event in events {
        let event_type_str = match event.event_type {
            crate::proxy::sse_parser::SseEventType::ImageGenerationPartialImage => {
                "image_generation.partial_image"
            }
            crate::proxy::sse_parser::SseEventType::ImageGenerationCompleted => {
                "image_generation.completed"
            }
            crate::proxy::sse_parser::SseEventType::ImageEditPartialImage => {
                "image_edit.partial_image"
            }
            crate::proxy::sse_parser::SseEventType::ImageEditCompleted => {
                "image_edit.completed"
            }
            crate::proxy::sse_parser::SseEventType::Error => "error",
            crate::proxy::sse_parser::SseEventType::Done => "done",
        };

        let _ = channel.send(StreamingImageEventPayload {
            event_type: event_type_str.to_string(),
            data: event.data,
        });
    }

    Ok(())
}

fn build_generate_body(request: &ProxyImagesRequest) -> Result<Value, ProxyError> {
    let provider_options = match request.provider_options.as_object() {
        Some(opts) => opts,
        None => {
            return Err(ProxyError::bad_request(
                "providerOptions must be a JSON object.",
            ))
        }
    };
    let mut fields = Map::new();

    insert_json_field(&mut fields, "model", json!(request.model));
    insert_json_field(&mut fields, "prompt", json!(request.prompt));
    insert_json_field(
        &mut fields,
        "n",
        json!(normalized_image_count(
            request.n,
            provider_max_images(&request.provider)
        )),
    );

    if let Some(size) = optional_text(request.size.as_deref()) {
        insert_json_field(&mut fields, "size", json!(size));
    }
    if let Some(quality) = optional_text(request.quality.as_deref()) {
        insert_json_field(&mut fields, "quality", json!(quality));
    }
    if let Some(output_format) = optional_text(request.output_format.as_deref()) {
        insert_json_field(
            &mut fields,
            "output_format",
            json!(validate_output_format(output_format)),
        );
    }
    if let Some(compression) = request.output_compression {
        if matches!(request.output_format.as_deref(), Some("jpeg" | "webp")) {
            insert_json_field(
                &mut fields,
                "output_compression",
                json!(compression.min(100)),
            );
        }
    }
    if let Some(background) = optional_text(request.background.as_deref()) {
        insert_json_field(&mut fields, "background", json!(background));
    }
    if let Some(moderation) = optional_text(request.moderation.as_deref()) {
        insert_json_field(&mut fields, "moderation", json!(moderation));
    }
    merge_json_fields(&mut fields, provider_options);

    fields.insert("stream".to_string(), json!(true));
    fields.insert("partial_images".to_string(), json!(request.n.min(3).max(1)));

    Ok(Value::Object(fields))
}

fn build_generation_edit_body(request: &ProxyImagesRequest) -> Result<Value, ProxyError> {
    let provider_options = match request.provider_options.as_object() {
        Some(opts) => opts,
        None => {
            return Err(ProxyError::bad_request(
                "providerOptions must be a JSON object.",
            ))
        }
    };
    let mut fields = Map::new();

    insert_json_field(&mut fields, "model", json!(request.model));
    insert_json_field(&mut fields, "prompt", json!(request.prompt));
    insert_json_field(
        &mut fields,
        "n",
        json!(normalized_image_count(
            request.n,
            provider_max_images(&request.provider)
        )),
    );
    insert_json_field(
        &mut fields,
        "image",
        json!(json_image_input(&request.edit_images)),
    );

    if let Some(size) = optional_text(request.size.as_deref()) {
        insert_json_field(&mut fields, "size", json!(size));
    }
    if let Some(quality) = optional_text(request.quality.as_deref()) {
        if quality != "auto" {
            insert_json_field(&mut fields, "quality", json!(quality));
        }
    }
    merge_json_fields(&mut fields, provider_options);

    fields.remove("mask");
    fields.insert("stream".to_string(), json!(true));
    fields.insert("partial_images".to_string(), json!(request.n.min(3).max(1)));

    Ok(Value::Object(fields))
}

fn json_image_input(files: &[ProxyImageFile]) -> Value {
    let images = files
        .iter()
        .map(file_to_data_uri)
        .map(Value::String)
        .collect::<Vec<_>>();

    if images.len() == 1 {
        images.into_iter().next().unwrap_or(Value::Null)
    } else {
        Value::Array(images)
    }
}

fn file_to_data_uri(file: &ProxyImageFile) -> String {
    let mime = optional_text(Some(&file.mime_type)).unwrap_or("application/octet-stream");
    let encoded = general_purpose::STANDARD.encode(&file.bytes);
    format!("data:{mime};base64,{encoded}")
}

fn append_provider_options_to_multipart(
    mut form: multipart::Form,
    provider_options: &Value,
) -> multipart::Form {
    if let Some(opts) = provider_options.as_object() {
        for (key, value) in opts {
            if key == "image" || key == "mask" {
                continue;
            }
            form = form.text(key.clone(), multipart_value_to_string(value));
        }
    }
    form
}

fn insert_json_field(fields: &mut Map<String, Value>, key: &str, value: Value) {
    fields.insert(key.to_string(), value);
}

fn merge_json_fields(fields: &mut Map<String, Value>, overrides: &Map<String, Value>) {
    for (key, value) in overrides {
        if value != &Value::Null {
            fields.insert(key.clone(), value.clone());
        }
    }
}

fn optional_text(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|v| !v.is_empty())
}

fn normalized_image_count(n: u32, max_images: u32) -> u32 {
    n.clamp(1, max_images.max(1))
}

fn provider_max_images(provider: &ProxyProvider) -> u32 {
    match provider {
        ProxyProvider::Seedream => 15,
        ProxyProvider::Openai | ProxyProvider::Sensenova | ProxyProvider::Google => 10,
    }
}

fn missing_api_key_message(provider: &ProxyProvider) -> &'static str {
    match provider {
        ProxyProvider::Openai => "服务器中转模式需要配置 API Key。请在系统设置中配置 API Key。",
        ProxyProvider::Sensenova => "SenseNova U1 Fast 需要配置 SenseNova API Key。",
        ProxyProvider::Seedream => "Seedream 需要配置火山方舟 API Key。",
        ProxyProvider::Google => "Gemini Nano Banana 2 需要配置 Gemini API Key。",
    }
}

fn validate_output_format(value: &str) -> &str {
    match value {
        "jpeg" | "webp" | "png" => value,
        "jpg" => "jpeg",
        _ => "png",
    }
}

fn multipart_value_to_string(value: &Value) -> String {
    match value {
        Value::String(text) => text.clone(),
        Value::Number(number) => number.to_string(),
        Value::Bool(flag) => flag.to_string(),
        Value::Null | Value::Array(_) | Value::Object(_) => value.to_string(),
    }
}

fn extract_error_message(text: &str) -> String {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return "Provider request failed.".to_string();
    }

    if let Ok(value) = serde_json::from_str::<Value>(trimmed) {
        if let Some(message) = find_error_message(&value) {
            return message;
        }
    }

    trimmed.chars().take(1200).collect()
}

fn find_error_message(value: &Value) -> Option<String> {
    if let Some(message) = value
        .as_str()
        .map(str::trim)
        .filter(|m| !m.is_empty())
    {
        return Some(message.to_string());
    }
    let object = value.as_object()?;
    for key in ["error", "message", "error_description", "detail", "reason", "title"] {
        if let Some(message) = object.get(key).and_then(find_error_message) {
            return Some(message);
        }
    }
    None
}
