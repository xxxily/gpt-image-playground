use std::path::Path;

use tauri::ipc::Channel;
use tauri::State;
use tokio::fs;

use crate::proxy::error::ProxyError;
use crate::proxy::local_image::{image_base_dir, resolve_image_path, validate_filename};
use crate::proxy::prompt_polish::{PromptPolishRequest, PromptPolishResponse};
use crate::proxy::remote_image::fetch_remote_image_with_proxy_check;
use crate::proxy::types::{
    ProxyImageMode, ProxyImagesRequest, ProxyImagesResponse, ProxyProvider,
};
use crate::proxy::ProxyState;

#[tauri::command]
pub async fn proxy_images(
    request: ProxyImagesRequest,
    state: State<'_, ProxyState>,
) -> Result<ProxyImagesResponse, ProxyError> {
    match request.provider {
        ProxyProvider::Google => match request.mode {
            ProxyImageMode::Generate => {
                crate::proxy::gemini::generate(&state.client, &request).await
            }
            ProxyImageMode::Edit => crate::proxy::gemini::edit(&state.client, &request).await,
        },
        ProxyProvider::Openai | ProxyProvider::Sensenova | ProxyProvider::Seedream => {
            crate::proxy::openai::proxy_images(&state.client, request).await
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
    if !matches!(
        request.provider,
        ProxyProvider::Openai | ProxyProvider::Sensenova | ProxyProvider::Seedream
    ) {
        return Err(ProxyError::bad_request(
            "流式预览仅支持 OpenAI 及 OpenAI-compatible 供应商。",
        ));
    }

    crate::proxy::openai_streaming::proxy_images_streaming(
        &state.client,
        &request,
        channel,
    )
    .await
}

#[tauri::command]
pub async fn proxy_prompt_polish(
    request: PromptPolishRequest,
    state: State<'_, ProxyState>,
) -> Result<PromptPolishResponse, ProxyError> {
    crate::proxy::prompt_polish::prompt_polish(&state.client, request).await
}

#[tauri::command]
pub async fn proxy_remote_image(
    url: String,
) -> Result<Vec<u8>, ProxyError> {
    let image_data = fetch_remote_image_with_proxy_check(&url).await?;
    Ok(image_data.bytes)
}

#[tauri::command]
pub async fn proxy_remote_image_with_type(
    url: String,
) -> Result<RemoteImageResponse, ProxyError> {

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteImageResponse {
    pub bytes: Vec<u8>,
    pub content_type: String,
}

#[tauri::command]
pub async fn serve_local_image(
    filename: String,
    app: tauri::AppHandle,
) -> Result<Vec<u8>, ProxyError> {
    validate_filename(&filename)?;
    let image_path = resolve_image_path(&app, &filename)?;

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

        let image_path = resolve_image_path(&app, &filename)?;
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
    app: tauri::AppHandle,
) -> Result<(), ProxyError> {
    validate_filename(&filename)?;

    if bytes.len() > 100 * 1024 * 1024 {
        return Err(ProxyError::bad_request("Image file too large (max 100MB)."));
    }

    let base_dir = image_base_dir(&app)?;
    if !base_dir.exists() {
        fs::create_dir_all(&base_dir)
            .await
            .map_err(|e| ProxyError::network(format!("Failed to create image directory: {e}")))?;
    }

    let file_path = base_dir.join(&filename);
    fs::write(file_path, bytes)
        .await
        .map_err(|e| ProxyError::network(format!("Failed to save image: {e}")))
}
