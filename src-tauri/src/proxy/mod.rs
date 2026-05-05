pub mod commands;
pub mod error;
pub mod gemini;
pub mod local_image;
pub mod openai;
pub mod openai_streaming;
pub mod prompt_polish;
pub mod remote_image;
pub mod security;
pub mod sse_parser;
pub mod types;

use std::sync::Arc;
use std::time::Duration;

use tauri::AppHandle;

pub struct ProxyState {
    pub client: reqwest::Client,
    pub app_handle: Arc<tauri::AppHandle>,
}

impl ProxyState {
    pub fn new(app_handle: AppHandle) -> Result<Self, reqwest::Error> {
        let client = reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(20))
            .timeout(Duration::from_secs(180))
            .redirect(reqwest::redirect::Policy::none())
            .build()?;

        Ok(Self {
            client,
            app_handle: Arc::new(app_handle),
        })
    }
}
