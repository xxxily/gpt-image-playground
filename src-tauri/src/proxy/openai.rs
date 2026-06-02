use std::time::{SystemTime, UNIX_EPOCH};

use base64::{engine::general_purpose, Engine as _};
use reqwest::multipart;
use serde::Deserialize;
use serde_json::{json, Map, Value};

use crate::proxy::error::ProxyError;
use crate::proxy::security::validate_public_http_base_url;
use crate::proxy::types::{
    CompletedImage, ProviderUsage, ProxyImageFile, ProxyImageMode, ProxyImagesRequest,
    ProxyImagesResponse, ProxyProvider,
};
use crate::proxy::CONFIGURATION_REQUIRED_MESSAGE;

#[derive(Debug, Deserialize)]
struct OpenAIImagesResponse {
    data: Option<Vec<OpenAIImageData>>,
    usage: Option<ProviderUsage>,
}

#[derive(Debug, Deserialize)]
struct OpenAIImageData {
    b64_json: Option<String>,
    url: Option<String>,
}

pub async fn proxy_images(
    client: &reqwest::Client,
    request: ProxyImagesRequest,
) -> Result<ProxyImagesResponse, ProxyError> {
    validate_request(&request)?;
    let api_key = request
        .api_key
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| ProxyError::bad_request(missing_api_key_message(&request.provider)))?;
    let base_url = validate_public_http_base_url(request.api_base_url.as_deref()).await?;

    let response = match request.mode {
        ProxyImageMode::Generate => generate_image(client, &request, api_key, &base_url).await?,
        ProxyImageMode::Edit => edit_image(client, &request, api_key, &base_url).await?,
    };

    normalize_response(response, output_format_for_response(&request))
}

const OPENAI_REFERENCE_MAX_BYTES: usize = 50 * 1024 * 1024;
const SEEDREAM_REFERENCE_MAX_BYTES: usize = 30 * 1024 * 1024;
const DEFAULT_REFERENCE_MAX_BYTES: usize = 30 * 1024 * 1024;

fn validate_request(request: &ProxyImagesRequest) -> Result<(), ProxyError> {
    if request.prompt.trim().is_empty() {
        return Err(ProxyError::bad_request(
            "Missing required parameter: prompt",
        ));
    }
    if request.model.trim().is_empty() {
        return Err(ProxyError::bad_request("Missing required parameter: model"));
    }
    if request.mode == ProxyImageMode::Edit && request.edit_images.is_empty() {
        return Err(ProxyError::bad_request(
            "No image file provided for editing.",
        ));
    }

    if request.mode == ProxyImageMode::Edit {
        validate_reference_images(request)?;
    }
    if let Some(mask) = &request.edit_mask_file {
        if mask.bytes.len() > OPENAI_REFERENCE_MAX_BYTES {
            return Err(ProxyError::bad_request(format!(
                "Mask file '{}' too large ({}MB > 50MB limit).",
                mask.name,
                mask.bytes.len() / (1024 * 1024)
            )));
        }
    }

    Ok(())
}

fn validate_reference_images(request: &ProxyImagesRequest) -> Result<(), ProxyError> {
    let max_images = reference_image_limit(request);
    if request.edit_images.len() > max_images {
        if request.provider == ProxyProvider::Seedream
            && request.model == "doubao-seedream-5.0-lite"
        {
            return Err(ProxyError::bad_request(format!(
                "当前模型最多上传 {max_images} 张参考图（参考图 + 输出图数量不能超过 15，当前输出图数量为 {}）。",
                request.n.clamp(1, 15)
            )));
        }
        return Err(ProxyError::bad_request(format!(
            "当前模型最多上传 {max_images} 张参考图。"
        )));
    }

    let max_bytes = reference_image_max_bytes(&request.provider);
    for image in &request.edit_images {
        if image.bytes.len() > max_bytes {
            return Err(ProxyError::bad_request(format!(
                "参考图 {} 超过当前模型单图 {}MB 限制。",
                image.name,
                max_bytes / (1024 * 1024)
            )));
        }

        let mime_type = normalized_reference_mime_type(image);
        if !is_allowed_reference_mime_type(&request.provider, &mime_type) {
            return Err(ProxyError::bad_request(format!(
                "参考图 {} 的格式不受当前模型支持，请使用 {}。",
                image.name,
                allowed_reference_type_label(&request.provider)
            )));
        }
    }

    Ok(())
}

fn reference_image_limit(request: &ProxyImagesRequest) -> usize {
    match request.provider {
        ProxyProvider::Seedream => {
            if request.model == "doubao-seedream-5.0-lite" {
                let remaining = 15_u32.saturating_sub(request.n.clamp(1, 15));
                return remaining.min(14) as usize;
            }
            14
        }
        ProxyProvider::Openai if request.model == "gpt-image-2" => 16,
        ProxyProvider::Openai | ProxyProvider::Sensenova | ProxyProvider::Google => 10,
    }
}

fn reference_image_max_bytes(provider: &ProxyProvider) -> usize {
    match provider {
        ProxyProvider::Openai => OPENAI_REFERENCE_MAX_BYTES,
        ProxyProvider::Seedream => SEEDREAM_REFERENCE_MAX_BYTES,
        ProxyProvider::Sensenova | ProxyProvider::Google => DEFAULT_REFERENCE_MAX_BYTES,
    }
}

fn normalized_reference_mime_type(file: &ProxyImageFile) -> String {
    let mime_type = file.mime_type.trim().to_ascii_lowercase();
    if mime_type == "image/jpg" {
        return "image/jpeg".to_string();
    }
    if !mime_type.is_empty() && mime_type != "application/octet-stream" {
        return mime_type;
    }

    match file
        .name
        .rsplit('.')
        .next()
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "png" => "image/png".to_string(),
        "jpg" | "jpeg" => "image/jpeg".to_string(),
        "webp" => "image/webp".to_string(),
        "bmp" => "image/bmp".to_string(),
        "tif" | "tiff" => "image/tiff".to_string(),
        "gif" => "image/gif".to_string(),
        "heic" => "image/heic".to_string(),
        "heif" => "image/heif".to_string(),
        _ => "application/octet-stream".to_string(),
    }
}

fn is_allowed_reference_mime_type(provider: &ProxyProvider, mime_type: &str) -> bool {
    match provider {
        ProxyProvider::Seedream => matches!(
            mime_type,
            "image/jpeg"
                | "image/png"
                | "image/webp"
                | "image/bmp"
                | "image/tiff"
                | "image/gif"
                | "image/heic"
                | "image/heif"
        ),
        ProxyProvider::Openai | ProxyProvider::Sensenova | ProxyProvider::Google => {
            matches!(mime_type, "image/png" | "image/jpeg" | "image/webp")
        }
    }
}

fn allowed_reference_type_label(provider: &ProxyProvider) -> &'static str {
    match provider {
        ProxyProvider::Seedream => "JPEG/PNG/WebP/BMP/TIFF/GIF/HEIC/HEIF",
        ProxyProvider::Openai | ProxyProvider::Sensenova | ProxyProvider::Google => "PNG/JPEG/WebP",
    }
}

async fn generate_image(
    client: &reqwest::Client,
    request: &ProxyImagesRequest,
    api_key: &str,
    base_url: &str,
) -> Result<OpenAIImagesResponse, ProxyError> {
    let url = format!("{base_url}/images/generations");
    let body = build_generate_body(request)?;

    let response = client
        .post(url)
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .await
        .map_err(|error| ProxyError::network(error.to_string()))?;

    read_provider_response(response).await
}

async fn edit_image(
    client: &reqwest::Client,
    request: &ProxyImagesRequest,
    api_key: &str,
    base_url: &str,
) -> Result<OpenAIImagesResponse, ProxyError> {
    if request.provider == ProxyProvider::Seedream {
        return edit_image_as_generation_json(client, request, api_key, base_url).await;
    }

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
        let mime_type = optional_text(Some(&image.mime_type)).unwrap_or("application/octet-stream");
        let part = multipart::Part::bytes(image.bytes.clone())
            .file_name(image.name.clone())
            .mime_str(mime_type)
            .map_err(|error| {
                ProxyError::bad_request(format!("Invalid image MIME type: {error}"))
            })?;
        form = form.part("image", part);
    }

    if let Some(mask) = &request.edit_mask_file {
        let mime_type = optional_text(Some(&mask.mime_type)).unwrap_or("application/octet-stream");
        let part = multipart::Part::bytes(mask.bytes.clone())
            .file_name(mask.name.clone())
            .mime_str(mime_type)
            .map_err(|error| ProxyError::bad_request(format!("Invalid mask MIME type: {error}")))?;
        form = form.part("mask", part);
    }

    let response = client
        .post(url)
        .bearer_auth(api_key)
        .multipart(form)
        .send()
        .await
        .map_err(|error| ProxyError::network(error.to_string()))?;

    read_provider_response(response).await
}

async fn edit_image_as_generation_json(
    client: &reqwest::Client,
    request: &ProxyImagesRequest,
    api_key: &str,
    base_url: &str,
) -> Result<OpenAIImagesResponse, ProxyError> {
    let url = format!("{base_url}/images/generations");
    let body = build_generation_edit_body(request)?;

    let response = client
        .post(url)
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .await
        .map_err(|error| ProxyError::network(error.to_string()))?;

    read_provider_response(response).await
}

fn build_generate_body(request: &ProxyImagesRequest) -> Result<Value, ProxyError> {
    let provider_options = match request.provider_options.as_object() {
        Some(options) => options,
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
    if request.provider == ProxyProvider::Openai {
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
    }
    merge_json_fields(&mut fields, provider_options);

    Ok(Value::Object(fields))
}

fn append_provider_options_to_multipart(
    mut form: multipart::Form,
    provider_options: &Value,
) -> multipart::Form {
    if let Some(options) = provider_options.as_object() {
        for (key, value) in options {
            if key == "image" || key == "mask" {
                continue;
            }
            form = form.text(key.clone(), multipart_value_to_string(value));
        }
    }
    form
}

fn build_generation_edit_body(request: &ProxyImagesRequest) -> Result<Value, ProxyError> {
    let provider_options = match request.provider_options.as_object() {
        Some(options) => options,
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
    let mime_type = optional_text(Some(&file.mime_type)).unwrap_or("application/octet-stream");
    let encoded = general_purpose::STANDARD.encode(&file.bytes);
    format!("data:{mime_type};base64,{encoded}")
}

async fn read_provider_response(
    response: reqwest::Response,
) -> Result<OpenAIImagesResponse, ProxyError> {
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

    serde_json::from_str::<OpenAIImagesResponse>(&text)
        .map_err(|error| ProxyError::parse(format!("Provider response JSON parse failed: {error}")))
}

fn normalize_response(
    response: OpenAIImagesResponse,
    output_format: String,
) -> Result<ProxyImagesResponse, ProxyError> {
    let data = response
        .data
        .filter(|items| !items.is_empty())
        .ok_or_else(|| ProxyError::provider("API 响应中没有有效的图片数据。", None))?;
    let timestamp = current_timestamp_millis();
    let images = data
        .into_iter()
        .enumerate()
        .filter_map(|(index, image)| {
            let filename = format!("{timestamp}-{index}.{output_format}");
            if let Some(b64_json) = image.b64_json {
                return Some(CompletedImage {
                    filename,
                    b64_json: Some(b64_json),
                    path: None,
                    output_format: output_format.clone(),
                });
            }
            image.url.map(|path| CompletedImage {
                filename,
                b64_json: None,
                path: Some(path),
                output_format: output_format.clone(),
            })
        })
        .collect::<Vec<_>>();

    if images.is_empty() {
        return Err(ProxyError::provider("API 响应中没有有效的图片数据。", None));
    }

    Ok(ProxyImagesResponse {
        images,
        usage: response.usage,
    })
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
    value.map(str::trim).filter(|value| !value.is_empty())
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

fn missing_api_key_message(_provider: &ProxyProvider) -> &'static str {
    CONFIGURATION_REQUIRED_MESSAGE
}

fn validate_output_format(value: &str) -> &str {
    match value {
        "jpeg" | "webp" | "png" => value,
        "jpg" => "jpeg",
        _ => "png",
    }
}

fn output_format_for_response(request: &ProxyImagesRequest) -> String {
    let provider_output_format = request
        .provider_options
        .get("output_format")
        .and_then(Value::as_str)
        .map(validate_output_format);

    if request.provider == ProxyProvider::Seedream {
        return provider_output_format.unwrap_or("jpeg").to_string();
    }

    if request.mode == ProxyImageMode::Edit {
        return provider_output_format.unwrap_or("png").to_string();
    }

    provider_output_format
        .or(request.output_format.as_deref().map(validate_output_format))
        .unwrap_or("png")
        .to_string()
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
        .filter(|message| !message.is_empty())
    {
        return Some(message.to_string());
    }
    let object = value.as_object()?;
    for key in [
        "error",
        "message",
        "error_description",
        "detail",
        "reason",
        "title",
    ] {
        if let Some(message) = object.get(key).and_then(find_error_message) {
            return Some(message);
        }
    }
    None
}

fn current_timestamp_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{build_generate_body, output_format_for_response};
    use crate::proxy::types::{ProxyImageMode, ProxyImagesRequest, ProxyProvider};

    fn generate_request() -> ProxyImagesRequest {
        ProxyImagesRequest {
            mode: ProxyImageMode::Generate,
            model: "gpt-image-2".to_string(),
            prompt: "A test image".to_string(),
            n: 2,
            size: Some("1024x1024".to_string()),
            quality: Some("auto".to_string()),
            output_format: Some("webp".to_string()),
            output_compression: Some(80),
            background: Some("auto".to_string()),
            moderation: Some("auto".to_string()),
            provider: ProxyProvider::Openai,
            api_key: Some("sk-test".to_string()),
            api_base_url: None,
            provider_options: json!({ "custom": true, "output_format": "jpeg" }),
            edit_images: Vec::new(),
            edit_mask_file: None,
            enable_streaming: false,
            partial_images: None,
            proxy_config: Default::default(),
            debug_mode: false,
        }
    }

    #[test]
    fn build_generate_body_allows_provider_options_to_override_base_fields() {
        let request = generate_request();
        let body = build_generate_body(&request).unwrap();
        assert_eq!(body["model"], "gpt-image-2");
        assert_eq!(body["prompt"], "A test image");
        assert_eq!(body["n"], 2);
        assert_eq!(body["output_format"], "jpeg");
        assert_eq!(body["output_compression"], 80);
        assert_eq!(body["custom"], true);
    }

    #[test]
    fn response_format_prefers_provider_options() {
        let request = generate_request();
        assert_eq!(output_format_for_response(&request), "jpeg");
    }

    #[test]
    fn edit_response_format_defaults_to_png() {
        let mut request = generate_request();
        request.mode = ProxyImageMode::Edit;
        request.provider_options = json!({});
        assert_eq!(output_format_for_response(&request), "png");
    }

    #[test]
    fn seedream_generate_body_omits_openai_only_fields() {
        let mut request = generate_request();
        request.provider = ProxyProvider::Seedream;
        request.model = "doubao-seedream-5-0-260128".to_string();
        request.size = Some("2K".to_string());
        request.provider_options = json!({ "response_format": "url", "watermark": false });

        let body = build_generate_body(&request).unwrap();

        assert_eq!(body["model"], "doubao-seedream-5-0-260128");
        assert_eq!(body["size"], "2K");
        assert_eq!(body["response_format"], "url");
        assert_eq!(body["watermark"], false);
        assert!(body.get("quality").is_none());
        assert!(body.get("background").is_none());
        assert!(body.get("moderation").is_none());
        assert!(body.get("output_compression").is_none());
    }

    #[test]
    fn seedream_response_format_defaults_to_jpeg() {
        let mut request = generate_request();
        request.provider = ProxyProvider::Seedream;
        request.output_format = Some("png".to_string());
        request.provider_options = json!({});

        assert_eq!(output_format_for_response(&request), "jpeg");
    }
}
