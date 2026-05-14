use std::path::Path;

use tauri::ipc::Channel;
use tauri::Manager;
use tauri::State;
use tokio::fs;

use crate::proxy::error::ProxyError;
use crate::proxy::local_image::{
    image_base_dir, resolve_image_path, resolve_storage_base_dir, validate_filename,
};
use crate::proxy::prompt_polish::{PromptPolishRequest, PromptPolishResponse};
use crate::proxy::remote_image::fetch_remote_image_with_proxy_check;
use crate::proxy::s3::{S3GetResponse, S3HeadResponse};
use crate::proxy::types::{
    DesktopProxyConfig, ProxyImageMode, ProxyImagesRequest, ProxyImagesResponse, ProxyProvider,
    ProxyVisionTextRequest, ProxyVisionTextResponse,
};
use crate::proxy::ProxyState;

fn log_image_debug(request: &ProxyImagesRequest, command: &str) {
    if request.debug_mode {
        log::info!(
            target: "desktop_proxy",
            "{command}: provider={:?} mode={:?} streaming={} proxyMode={}",
            request.provider,
            request.mode,
            request.enable_streaming,
            request.proxy_config.mode()
        );
    }
}

fn log_prompt_debug(request: &PromptPolishRequest) {
    if request.debug_mode {
        log::info!(
            target: "desktop_proxy",
            "proxy_prompt_polish: model={} proxyMode={}",
            request.model_id.as_deref().unwrap_or("default"),
            request.proxy_config.mode()
        );
    }
}

#[tauri::command]
pub async fn proxy_images(
    request: ProxyImagesRequest,
    state: State<'_, ProxyState>,
) -> Result<ProxyImagesResponse, ProxyError> {
    log_image_debug(&request, "proxy_images");
    let client = state.client_for_config(&request.proxy_config)?;

    match request.provider {
        ProxyProvider::Google => match request.mode {
            ProxyImageMode::Generate => crate::proxy::gemini::generate(&client, &request).await,
            ProxyImageMode::Edit => crate::proxy::gemini::edit(&client, &request).await,
        },
        ProxyProvider::Openai | ProxyProvider::Sensenova | ProxyProvider::Seedream => {
            crate::proxy::openai::proxy_images(&client, request).await
        }
    }
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamingImageEventPayload {
    pub event_type: String,
    pub data: serde_json::Value,
}

#[tauri::command]
pub async fn proxy_images_streaming(
    request: ProxyImagesRequest,
    channel: Channel<StreamingImageEventPayload>,
    state: State<'_, ProxyState>,
) -> Result<(), ProxyError> {
    log_image_debug(&request, "proxy_images_streaming");

    if !matches!(request.provider, ProxyProvider::Openai) {
        return Err(ProxyError::bad_request(
            "流式预览当前仅支持 OpenAI，请关闭流式预览后重试。",
        ));
    }

    let client = state.client_for_config(&request.proxy_config)?;

    crate::proxy::openai_streaming::proxy_images_streaming(&client, &request, channel).await
}

#[tauri::command]
pub async fn proxy_prompt_polish(
    request: PromptPolishRequest,
    state: State<'_, ProxyState>,
) -> Result<PromptPolishResponse, ProxyError> {
    log_prompt_debug(&request);
    let client = state.client_for_config(&request.proxy_config)?;

    crate::proxy::prompt_polish::prompt_polish(&client, request).await
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamingVisionTextEventPayload {
    pub event_type: String,
    pub data: serde_json::Value,
}

fn log_vision_text_debug(request: &ProxyVisionTextRequest, command: &str) {
    if request.debug_mode {
        log::info!(
            target: "desktop_proxy",
            "{command}: providerKind={} model={} stream={} proxyMode={}",
            request.provider_kind,
            request.model,
            request.streaming_enabled,
            request.proxy_config.mode()
        );
    }
}

#[tauri::command]
pub async fn proxy_image_to_text(
    request: ProxyVisionTextRequest,
    state: State<'_, ProxyState>,
) -> Result<ProxyVisionTextResponse, ProxyError> {
    log_vision_text_debug(&request, "proxy_image_to_text");
    let client = state.client_for_config(&request.proxy_config)?;
    crate::proxy::vision_text::proxy_image_to_text(&client, request).await
}

#[tauri::command]
pub async fn proxy_image_to_text_streaming(
    request: ProxyVisionTextRequest,
    channel: Channel<StreamingVisionTextEventPayload>,
    state: State<'_, ProxyState>,
) -> Result<(), ProxyError> {
    log_vision_text_debug(&request, "proxy_image_to_text_streaming");
    let client = state.client_for_config(&request.proxy_config)?;
    crate::proxy::vision_text::proxy_image_to_text_streaming(&client, request, channel).await
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteImageResponse {
    pub bytes: Vec<u8>,
    pub content_type: String,
}

#[tauri::command]
pub fn get_default_image_storage_dir(app: tauri::AppHandle) -> Result<String, ProxyError> {
    Ok(image_base_dir(&app)?.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn proxy_remote_image(
    url: String,
    proxy_config: Option<DesktopProxyConfig>,
) -> Result<Vec<u8>, ProxyError> {
    let proxy_url = proxy_config.unwrap_or_default().normalized_url()?;
    let image_data = fetch_remote_image_with_proxy_check(&url, proxy_url.as_deref()).await?;
    Ok(image_data.bytes)
}

#[tauri::command]
pub async fn proxy_remote_image_with_type(
    url: String,
    proxy_config: Option<DesktopProxyConfig>,
) -> Result<RemoteImageResponse, ProxyError> {
    let proxy_url = proxy_config.unwrap_or_default().normalized_url()?;
    let image_data = fetch_remote_image_with_proxy_check(&url, proxy_url.as_deref()).await?;
    Ok(RemoteImageResponse {
        bytes: image_data.bytes,
        content_type: image_data.content_type,
    })
}

#[tauri::command]
pub async fn proxy_s3_head(
    url: String,
    proxy_config: Option<DesktopProxyConfig>,
    state: State<'_, ProxyState>,
) -> Result<S3HeadResponse, ProxyError> {
    crate::proxy::s3::head(&state, url, proxy_config.unwrap_or_default()).await
}

#[tauri::command]
pub async fn proxy_s3_get(
    url: String,
    proxy_config: Option<DesktopProxyConfig>,
    state: State<'_, ProxyState>,
) -> Result<S3GetResponse, ProxyError> {
    crate::proxy::s3::get(&state, url, proxy_config.unwrap_or_default()).await
}

#[tauri::command]
pub async fn proxy_s3_put(
    url: String,
    bytes: Vec<u8>,
    content_type: String,
    sha256: Option<String>,
    proxy_config: Option<DesktopProxyConfig>,
    state: State<'_, ProxyState>,
) -> Result<(), ProxyError> {
    crate::proxy::s3::put(
        &state,
        url,
        bytes,
        content_type,
        sha256,
        proxy_config.unwrap_or_default(),
    )
    .await
}

#[tauri::command]
pub async fn proxy_s3_delete(
    url: String,
    proxy_config: Option<DesktopProxyConfig>,
    state: State<'_, ProxyState>,
) -> Result<(), ProxyError> {
    crate::proxy::s3::delete(&state, url, proxy_config.unwrap_or_default()).await
}

#[tauri::command]
pub async fn serve_local_image(
    filename: String,
    custom_storage_path: Option<String>,
    app: tauri::AppHandle,
) -> Result<Vec<u8>, ProxyError> {
    validate_filename(&filename)?;
    let image_path = resolve_image_path(&app, &filename, custom_storage_path.as_deref())?;

    let file_path = Path::new(&image_path);
    if !file_path.exists() {
        return Err(ProxyError::bad_request("Image not found."));
    }

    fs::read(file_path)
        .await
        .map_err(|e| ProxyError::network(format!("Failed to read image: {e}")))
}

#[tauri::command]
pub async fn delete_local_images(
    filenames: Vec<String>,
    custom_storage_path: Option<String>,
    app: tauri::AppHandle,
) -> Result<Vec<ImageDeletionResult>, ProxyError> {
    let mut results = Vec::new();

    for filename in filenames {
        if filename.is_empty() {
            results.push(ImageDeletionResult {
                filename,
                success: false,
                error: Some("Empty filename.".to_string()),
            });
            continue;
        }

        match validate_filename(&filename) {
            Ok(()) => {}
            Err(e) => {
                results.push(ImageDeletionResult {
                    filename: filename.clone(),
                    success: false,
                    error: Some(e.to_string()),
                });
                continue;
            }
        }

        let image_path = resolve_image_path(&app, &filename, custom_storage_path.as_deref())?;
        let file_path = Path::new(&image_path);

        if !file_path.exists() {
            results.push(ImageDeletionResult {
                filename: filename.clone(),
                success: false,
                error: Some("File not found.".to_string()),
            });
            continue;
        }

        match fs::remove_file(file_path).await {
            Ok(()) => {
                results.push(ImageDeletionResult {
                    filename: filename.clone(),
                    success: true,
                    error: None,
                });
            }
            Err(e) => {
                results.push(ImageDeletionResult {
                    filename: filename.clone(),
                    success: false,
                    error: Some(format!("Failed to delete file: {e}")),
                });
            }
        }
    }

    Ok(results)
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageDeletionResult {
    pub filename: String,
    pub success: bool,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn save_local_image(
    filename: String,
    bytes: Vec<u8>,
    custom_storage_path: Option<String>,
    app: tauri::AppHandle,
) -> Result<SaveToDownloadsResult, ProxyError> {
    validate_filename(&filename)?;

    const MAX_SAVE_BYTES: usize = 50 * 1024 * 1024;
    if bytes.len() > MAX_SAVE_BYTES {
        return Err(ProxyError::bad_request("Image file too large (max 50MB)."));
    }

    let base_dir = resolve_storage_base_dir(&app, custom_storage_path.as_deref())?;
    if !base_dir.exists() {
        fs::create_dir_all(&base_dir)
            .await
            .map_err(|e| ProxyError::network(format!("Failed to create image directory: {e}")))?;
    }

    let final_filename = collision_safe_filename(&base_dir, &filename);
    let file_path = base_dir.join(&final_filename);
    fs::write(&file_path, bytes)
        .await
        .map_err(|e| ProxyError::network(format!("Failed to save image: {e}")))?;

    Ok(SaveToDownloadsResult {
        path: file_path.to_string_lossy().to_string(),
        filename: final_filename,
    })
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveToDownloadsResult {
    pub path: String,
    pub filename: String,
}

fn collision_safe_filename(base_dir: &Path, filename: &str) -> String {
    let target = base_dir.join(filename);
    if !target.exists() {
        return filename.to_string();
    }

    let stem = Path::new(filename)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();
    let extension = Path::new(filename)
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();

    let mut counter = 1u32;
    loop {
        let candidate = format!("{stem}-{counter}{extension}");
        if !base_dir.join(&candidate).exists() {
            return candidate;
        }
        counter = counter.saturating_add(1);
    }
}

#[tauri::command]
pub async fn save_image_to_downloads(
    filename: String,
    bytes: Vec<u8>,
    app: tauri::AppHandle,
) -> Result<SaveToDownloadsResult, ProxyError> {
    validate_filename(&filename)?;

    const MAX_SAVE_BYTES: usize = 50 * 1024 * 1024;
    if bytes.len() > MAX_SAVE_BYTES {
        return Err(ProxyError::bad_request("图片文件过大（最大 50MB）。"));
    }

    let download_dir = app
        .path()
        .download_dir()
        .map_err(|e| ProxyError::network(format!("无法获取下载目录: {e}")))?;

    if !download_dir.exists() {
        fs::create_dir_all(&download_dir).await.map_err(|e| {
            ProxyError::network(format!("Failed to create download directory: {e}"))
        })?;
    }

    let final_filename = collision_safe_filename(&download_dir, &filename);
    let file_path = download_dir.join(&final_filename);

    fs::write(&file_path, bytes)
        .await
        .map_err(|e| ProxyError::network(format!("Failed to save to downloads: {e}")))?;

    let path = file_path.to_string_lossy().to_string();

    Ok(SaveToDownloadsResult {
        path,
        filename: final_filename,
    })
}

#[cfg(test)]
mod tests {
    use super::collision_safe_filename;
    use crate::proxy::types::normalize_proxy_url;
    use tempfile::TempDir;

    #[test]
    fn test_validate_proxy_url_http() {
        assert!(normalize_proxy_url("http://127.0.0.1:7890").is_ok());
    }

    #[test]
    fn test_validate_proxy_url_https() {
        assert!(normalize_proxy_url("https://proxy.example.com:8080").is_ok());
    }

    #[test]
    fn test_validate_proxy_url_socks5() {
        assert!(normalize_proxy_url("socks5://127.0.0.1:1080").is_ok());
    }

    #[test]
    fn test_validate_proxy_url_socks5h() {
        assert!(normalize_proxy_url("socks5h://127.0.0.1:1080").is_ok());
    }

    #[test]
    fn test_validate_proxy_url_invalid_scheme() {
        assert!(normalize_proxy_url("ftp://proxy.example.com").is_err());
        assert!(normalize_proxy_url("file:///etc/passwd").is_err());
    }

    #[test]
    fn test_validate_proxy_url_naked_host_port() {
        assert!(normalize_proxy_url("127.0.0.1:7890").is_ok());
    }

    #[test]
    fn test_collision_safe_filename_no_collision() {
        let temp_dir = TempDir::new().unwrap();
        let result = collision_safe_filename(temp_dir.path(), "image.png");
        assert_eq!(result, "image.png");
    }

    #[test]
    fn test_collision_safe_filename_with_collision() {
        let temp_dir = TempDir::new().unwrap();
        let original_path = temp_dir.path().join("image.png");
        std::fs::write(&original_path, b"test").unwrap();

        let result = collision_safe_filename(temp_dir.path(), "image.png");
        assert_eq!(result, "image-1.png");
    }

    #[test]
    fn test_collision_safe_filename_multiple_collisions() {
        let temp_dir = TempDir::new().unwrap();
        std::fs::write(temp_dir.path().join("image.png"), b"a").unwrap();
        std::fs::write(temp_dir.path().join("image-1.png"), b"b").unwrap();
        std::fs::write(temp_dir.path().join("image-2.png"), b"c").unwrap();

        let result = collision_safe_filename(temp_dir.path(), "image.png");
        assert_eq!(result, "image-3.png");
    }

    #[test]
    fn test_collision_safe_filename_no_extension() {
        let temp_dir = TempDir::new().unwrap();
        std::fs::write(temp_dir.path().join("myfile"), b"test").unwrap();

        let result = collision_safe_filename(temp_dir.path(), "myfile");
        assert_eq!(result, "myfile-1");
    }
}
