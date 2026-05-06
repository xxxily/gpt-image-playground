use serde::{Deserialize, Serialize};
use serde_json::Value;

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
