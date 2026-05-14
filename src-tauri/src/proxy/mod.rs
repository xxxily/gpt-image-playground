pub mod commands;
pub mod error;
pub mod gemini;
pub mod local_image;
pub mod openai;
pub mod openai_streaming;
pub mod prompt_polish;
pub mod remote_image;
pub mod s3;
pub mod security;
pub mod sse_parser;
pub mod vision_text;
pub mod types;

use std::time::Duration;

use crate::proxy::error::ProxyError;
use crate::proxy::types::DesktopProxyConfig;

pub struct ProxyState {
    pub client: reqwest::Client,
}

impl ProxyState {
    pub fn new() -> Result<Self, reqwest::Error> {
        let client = Self::build_client(None)?;
        Ok(Self { client })
    }

    pub fn build_client(proxy_url: Option<&str>) -> Result<reqwest::Client, reqwest::Error> {
        let mut builder = reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(20))
            .timeout(Duration::from_secs(180))
            .redirect(reqwest::redirect::Policy::none());

        if let Some(url) = proxy_url {
            builder = builder.proxy(reqwest::Proxy::all(url)?);
        }

        builder.build()
    }

    pub fn client_for_config(
        &self,
        proxy_config: &DesktopProxyConfig,
    ) -> Result<reqwest::Client, ProxyError> {
        match proxy_config.normalized_url()? {
            Some(url) => Self::build_client(Some(&url))
                .map_err(|_| ProxyError::network("无法创建代理客户端，请检查代理地址与协议。")),
            None => Ok(self.client.clone()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::ProxyState;

    #[test]
    fn build_client_surfaces_invalid_proxy_url() {
        assert!(ProxyState::build_client(Some("http://")).is_err());
    }

    #[test]
    fn build_client_accepts_valid_socks_proxy_url() {
        assert!(ProxyState::build_client(Some("socks5://127.0.0.1:1080")).is_ok());
    }
}
