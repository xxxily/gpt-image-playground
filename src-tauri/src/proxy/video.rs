use serde::{Deserialize, Serialize};

use crate::proxy::error::ProxyError;
use crate::proxy::ProxyState;
use crate::proxy::security::validate_public_http_base_url;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyVideoEndpointPayload {
    pub id: String,
    pub provider: String,
    pub protocol: String,
    pub api_base_url: Option<String>,
    #[serde(default)]
    pub api_key: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyVideoCreateRequest {
    pub endpoint: ProxyVideoEndpointPayload,
    pub catalog_entry_id: String,
    pub task_mode: String,
    pub prompt: String,
    #[serde(default)]
    pub negative_prompt: Option<String>,
    #[serde(default)]
    pub parameters: serde_json::Value,
    #[serde(default)]
    pub source_images: serde_json::Value,
    #[serde(default)]
    pub callback_url: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyVideoPollRequest {
    pub endpoint: ProxyVideoEndpointPayload,
    #[serde(default)]
    pub catalog_entry_id: Option<String>,
    pub provider_job_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyVideoDownloadRequest {
    pub endpoint: ProxyVideoEndpointPayload,
    #[serde(default)]
    pub provider_job_id: Option<String>,
    #[serde(default)]
    pub result_remote_url: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyVideoCancelRequest {
    pub endpoint: ProxyVideoEndpointPayload,
    pub provider_job_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyVideoSubmitResponse {
    pub provider_job_id: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_request_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub progress: Option<f32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyVideoPollResponse {
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub progress: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result_remote_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result_remote_url_expires_at: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thumbnail_remote_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyVideoDownloadResponse {
    pub bytes: Vec<u8>,
    pub mime_type: String,
    pub size: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyVideoCancelResponse {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

fn validate_endpoint(endpoint: &ProxyVideoEndpointPayload) -> Result<(), ProxyError> {
    let base = endpoint.api_base_url.as_deref();
    let base_str = base.filter(|value| !value.trim().is_empty());
    if let Some(url) = base_str {
        // Reuse the async security check from the existing proxy module.
        // Falls through with an error if the URL points to a local/private target.
        let runtime = tokio::runtime::Handle::try_current();
        match runtime {
            Ok(handle) => {
                handle.block_on(async { validate_public_http_base_url(Some(url)).await })?;
            }
            Err(_) => {
                let rt = tokio::runtime::Runtime::new().map_err(|err| {
                    ProxyError::network(format!("Failed to spawn validator runtime: {err}"))
                })?;
                rt.block_on(async { validate_public_http_base_url(Some(url)).await })?;
            }
        }
    }
    Ok(())
}

pub fn proxy_video_create(
    _state: &ProxyState,
    request: ProxyVideoCreateRequest,
) -> Result<ProxyVideoSubmitResponse, ProxyError> {
    validate_endpoint(&request.endpoint)?;
    Err(ProxyError::bad_request(format!(
        "Video provider protocol \"{}\" is not yet implemented in the desktop proxy. Phase D will add it.",
        request.endpoint.protocol
    )))
}

pub fn proxy_video_poll(
    _state: &ProxyState,
    request: ProxyVideoPollRequest,
) -> Result<ProxyVideoPollResponse, ProxyError> {
    validate_endpoint(&request.endpoint)?;
    Err(ProxyError::bad_request(format!(
        "Video provider protocol \"{}\" is not yet implemented in the desktop proxy. Phase D will add it.",
        request.endpoint.protocol
    )))
}

pub fn proxy_video_download(
    _state: &ProxyState,
    request: ProxyVideoDownloadRequest,
) -> Result<ProxyVideoDownloadResponse, ProxyError> {
    validate_endpoint(&request.endpoint)?;
    Err(ProxyError::bad_request(format!(
        "Video provider protocol \"{}\" is not yet implemented in the desktop proxy. Phase D will add it.",
        request.endpoint.protocol
    )))
}

pub fn proxy_video_cancel(
    _state: &ProxyState,
    request: ProxyVideoCancelRequest,
) -> Result<ProxyVideoCancelResponse, ProxyError> {
    validate_endpoint(&request.endpoint)?;
    Ok(ProxyVideoCancelResponse {
        ok: false,
        reason: Some(format!(
            "Video provider protocol \"{}\" does not yet support cancel in the desktop proxy. Phase D will add it.",
            request.endpoint.protocol
        )),
    })
}
