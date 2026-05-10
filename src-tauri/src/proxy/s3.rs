use std::collections::HashMap;

use reqwest::header::{CONTENT_LENGTH, CONTENT_TYPE};

use crate::proxy::error::ProxyError;
use crate::proxy::types::DesktopProxyConfig;
use crate::proxy::ProxyState;

const MAX_S3_UPLOAD_BYTES: usize = 100 * 1024 * 1024;

fn validate_presigned_url(url: &str) -> Result<(), ProxyError> {
    let parsed =
        url::Url::parse(url).map_err(|_| ProxyError::bad_request("S3 签名 URL 格式无效。"))?;
    match parsed.scheme() {
        "http" | "https" => Ok(()),
        _ => Err(ProxyError::bad_request("S3 签名 URL 仅支持 HTTP/HTTPS。")),
    }
}

fn metadata_from_headers(headers: &reqwest::header::HeaderMap) -> HashMap<String, String> {
    let mut metadata = HashMap::new();
    for (name, value) in headers {
        let key = name.as_str().to_ascii_lowercase();
        if !key.starts_with("x-amz-meta-") {
            continue;
        }
        if let Ok(text) = value.to_str() {
            metadata.insert(
                key.trim_start_matches("x-amz-meta-").to_string(),
                text.to_string(),
            );
        }
    }
    metadata
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct S3HeadResponse {
    pub content_length: Option<u64>,
    pub metadata: HashMap<String, String>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct S3GetResponse {
    pub bytes: Vec<u8>,
    pub content_type: String,
}

pub async fn head(
    state: &ProxyState,
    url: String,
    proxy_config: DesktopProxyConfig,
) -> Result<S3HeadResponse, ProxyError> {
    validate_presigned_url(&url)?;
    let client = state.client_for_config(&proxy_config)?;
    let response = client
        .head(url)
        .send()
        .await
        .map_err(|e| ProxyError::network(format!("S3 HEAD 请求失败：{e}")))?;

    if !response.status().is_success() {
        return Err(ProxyError::provider(
            format!("S3 HEAD 请求失败：HTTP {}", response.status().as_u16()),
            Some(response.status().as_u16()),
        ));
    }

    let content_length = response
        .headers()
        .get(CONTENT_LENGTH)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<u64>().ok());

    Ok(S3HeadResponse {
        content_length,
        metadata: metadata_from_headers(response.headers()),
    })
}

pub async fn get(
    state: &ProxyState,
    url: String,
    proxy_config: DesktopProxyConfig,
) -> Result<S3GetResponse, ProxyError> {
    validate_presigned_url(&url)?;
    let client = state.client_for_config(&proxy_config)?;
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| ProxyError::network(format!("S3 GET 请求失败：{e}")))?;

    if !response.status().is_success() {
        return Err(ProxyError::provider(
            format!("S3 GET 请求失败：HTTP {}", response.status().as_u16()),
            Some(response.status().as_u16()),
        ));
    }

    let content_type = response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();
    let bytes = response
        .bytes()
        .await
        .map_err(|e| ProxyError::network(format!("读取 S3 响应失败：{e}")))?
        .to_vec();

    Ok(S3GetResponse {
        bytes,
        content_type,
    })
}

pub async fn put(
    state: &ProxyState,
    url: String,
    bytes: Vec<u8>,
    content_type: String,
    sha256: Option<String>,
    proxy_config: DesktopProxyConfig,
) -> Result<(), ProxyError> {
    validate_presigned_url(&url)?;
    if bytes.len() > MAX_S3_UPLOAD_BYTES {
        return Err(ProxyError::bad_request("S3 上传文件过大，最大支持 100MB。"));
    }

    let client = state.client_for_config(&proxy_config)?;
    let mut request = client.put(url).header(
        CONTENT_TYPE,
        if content_type.trim().is_empty() {
            "application/octet-stream"
        } else {
            content_type.trim()
        },
    );
    if let Some(hash) = sha256.filter(|value| !value.trim().is_empty()) {
        request = request.header("x-amz-meta-sha256", hash);
    }

    let response = request
        .body(bytes)
        .send()
        .await
        .map_err(|e| ProxyError::network(format!("S3 PUT 请求失败：{e}")))?;

    if !response.status().is_success() {
        return Err(ProxyError::provider(
            format!("S3 PUT 请求失败：HTTP {}", response.status().as_u16()),
            Some(response.status().as_u16()),
        ));
    }

    Ok(())
}

pub async fn delete(
    state: &ProxyState,
    url: String,
    proxy_config: DesktopProxyConfig,
) -> Result<(), ProxyError> {
    validate_presigned_url(&url)?;
    let client = state.client_for_config(&proxy_config)?;
    let response = client
        .delete(url)
        .send()
        .await
        .map_err(|e| ProxyError::network(format!("S3 DELETE 请求失败：{e}")))?;

    if !response.status().is_success() && response.status().as_u16() != 404 {
        return Err(ProxyError::provider(
            format!("S3 DELETE 请求失败：HTTP {}", response.status().as_u16()),
            Some(response.status().as_u16()),
        ));
    }

    Ok(())
}
