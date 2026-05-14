use serde::{Deserialize, Serialize};
use serde_json::Value;
use url::Url;

use crate::proxy::error::ProxyError;

/// Proxy configuration shared by image proxy and prompt polish requests.
#[derive(Debug, Deserialize, Clone, Default, PartialEq, Eq)]
#[serde(tag = "mode", rename_all = "camelCase")]
pub enum DesktopProxyConfig {
    /// No proxy — use direct connections.
    #[default]
    Disabled,
    /// Use the OS/system proxy (currently falls back to disabled in rustls mode).
    System,
    /// Use a manual proxy URL.
    Manual { url: String },
}

impl DesktopProxyConfig {
    pub fn mode(&self) -> &'static str {
        match self {
            Self::Disabled => "disabled",
            Self::System => "system",
            Self::Manual { .. } => "manual",
        }
    }

    pub fn url(&self) -> Option<&str> {
        match self {
            Self::Manual { url } => Some(url),
            _ => None,
        }
    }

    pub fn normalized_url(&self) -> Result<Option<String>, ProxyError> {
        match self.url() {
            Some(url) => normalize_proxy_url(url).map(Some),
            None => Ok(None),
        }
    }
}

pub fn normalize_proxy_url(url: &str) -> Result<String, ProxyError> {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return Err(ProxyError::bad_request("代理 URL 不能为空。"));
    }

    let candidate = if trimmed.contains("://") {
        trimmed.to_string()
    } else {
        format!("http://{trimmed}")
    };

    let parsed = Url::parse(&candidate)
        .map_err(|_| ProxyError::bad_request("代理 URL 格式无效。"))?;

    match parsed.scheme() {
        "http" | "https" | "socks5" | "socks5h" => {}
        scheme => {
            return Err(ProxyError::bad_request(format!(
                "不支持的代理协议: {scheme}（仅支持 http, https, socks5, socks5h）"
            )))
        }
    }

    if parsed.host_str().unwrap_or_default().is_empty() {
        return Err(ProxyError::bad_request("代理 URL 格式无效。"));
    }

    Ok(parsed.to_string())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyImagesRequest {
    pub mode: ProxyImageMode,
    pub model: String,
    pub prompt: String,
    pub n: u32,
    pub size: Option<String>,
    pub quality: Option<String>,
    pub output_format: Option<String>,
    pub output_compression: Option<u8>,
    pub background: Option<String>,
    pub moderation: Option<String>,
    pub provider: ProxyProvider,
    pub api_key: Option<String>,
    pub api_base_url: Option<String>,
    pub provider_options: Value,
    pub edit_images: Vec<ProxyImageFile>,
    pub edit_mask_file: Option<ProxyImageFile>,
    #[serde(default)]
    pub enable_streaming: bool,
    #[serde(default)]
    pub partial_images: Option<u8>,
    #[serde(default)]
    pub proxy_config: DesktopProxyConfig,
    #[serde(default)]
    pub debug_mode: bool,
}

#[derive(Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ProxyImageMode {
    Generate,
    Edit,
}

#[derive(Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ProxyProvider {
    Openai,
    Google,
    Sensenova,
    Seedream,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyImageFile {
    pub name: String,
    pub mime_type: String,
    pub bytes: Vec<u8>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyVisionTextRequest {
    pub provider_kind: String,
    pub provider_instance_id: String,
    pub model: String,
    pub prompt: String,
    pub system_prompt: String,
    pub task_type: String,
    pub detail: String,
    pub response_format: String,
    pub streaming_enabled: bool,
    pub structured_output_enabled: bool,
    pub max_output_tokens: u32,
    pub api_compatibility: String,
    pub api_key: Option<String>,
    pub api_base_url: Option<String>,
    pub images: Vec<ProxyImageFile>,
    #[serde(default)]
    pub proxy_config: DesktopProxyConfig,
    #[serde(default)]
    pub debug_mode: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyVisionTextResponse {
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub structured: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage: Option<Value>,
    pub provider: String,
    pub provider_instance_id: String,
    pub model: String,
    pub duration_ms: u128,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProxyImagesResponse {
    pub images: Vec<CompletedImage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage: Option<ProviderUsage>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CompletedImage {
    pub filename: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub b64_json: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    pub output_format: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProviderUsage {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub input_tokens_details: Option<InputTokensDetails>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_tokens: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InputTokensDetails {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text_tokens: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_tokens: Option<u64>,
}

#[cfg(test)]
mod tests {
    use super::{normalize_proxy_url, DesktopProxyConfig};

    #[test]
    fn desktop_proxy_config_deserializes_frontend_disabled_shape() {
        let config: DesktopProxyConfig = serde_json::from_str(r#"{"mode":"disabled"}"#).unwrap();
        assert_eq!(config, DesktopProxyConfig::Disabled);
    }

    #[test]
    fn desktop_proxy_config_deserializes_frontend_system_shape() {
        let config: DesktopProxyConfig = serde_json::from_str(r#"{"mode":"system"}"#).unwrap();
        assert_eq!(config, DesktopProxyConfig::System);
    }

    #[test]
    fn desktop_proxy_config_deserializes_frontend_manual_shape() {
        let config: DesktopProxyConfig = serde_json::from_str(
            r#"{"mode":"manual","url":"socks5://127.0.0.1:1080"}"#,
        )
        .unwrap();
        assert_eq!(
            config,
            DesktopProxyConfig::Manual {
                url: "socks5://127.0.0.1:1080".to_string(),
            }
        );
    }

    #[test]
    fn normalizes_naked_host_port_to_http_proxy_url() {
        assert_eq!(
            normalize_proxy_url("127.0.0.1:7890").unwrap(),
            "http://127.0.0.1:7890/"
        );
    }

    #[test]
    fn validates_supported_proxy_protocols() {
        assert!(normalize_proxy_url("http://127.0.0.1:7890").is_ok());
        assert!(normalize_proxy_url("https://proxy.example.com:8080").is_ok());
        assert!(normalize_proxy_url("socks5://127.0.0.1:1080").is_ok());
        assert!(normalize_proxy_url("socks5h://127.0.0.1:1080").is_ok());
    }

    #[test]
    fn rejects_unsupported_proxy_protocols_without_leaking_credentials() {
        let message = normalize_proxy_url("ftp://user:secret@proxy.example.com:21")
            .unwrap_err()
            .to_string();

        assert!(message.contains("ftp"));
        assert!(!message.contains("user"));
        assert!(!message.contains("secret"));
    }

    #[test]
    fn rejects_malformed_proxy_urls_without_echoing_raw_input() {
        let message = normalize_proxy_url("https://user:secret@")
            .unwrap_err()
            .to_string();

        assert!(!message.contains("user"));
        assert!(!message.contains("secret"));
    }
}
