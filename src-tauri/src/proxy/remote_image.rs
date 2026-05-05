use reqwest::redirect::Policy;
use url::Url;

use crate::proxy::error::ProxyError;

const MAX_IMAGE_BYTES: usize = 30 * 1024 * 1024;
const MAX_REDIRECTS: u8 = 3;

pub struct RemoteImageData {
    pub bytes: Vec<u8>,
    pub content_type: String,
}

pub async fn fetch_remote_image_with_proxy_check(
    url_str: &str,
) -> Result<RemoteImageData, ProxyError> {
    let url = validate_image_url(url_str)?;
    crate::proxy::security::validate_url_domain(&url).await?;

    let temp_client = reqwest::Client::builder()
        .redirect(Policy::limited(MAX_REDIRECTS as usize))
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| ProxyError::network(format!("无法创建请求客户端: {e}")))?;

    let response = temp_client
        .get(url.as_str())
        .header(reqwest::header::ACCEPT, "image/*,*/*;q=0.8")
        .send()
        .await
        .map_err(|e| ProxyError::network(format!("远程图片请求失败: {e}")))?;

    let status = response.status();
    if !status.is_success() {
        return Err(ProxyError::security(format!(
            "远程图片请求失败: HTTP {}",
            status.as_u16()
        )));
    }

    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .split(';')
        .next()
        .unwrap_or("")
        .trim()
        .to_lowercase();

    if !content_type.is_empty()
        && !content_type.starts_with("image/")
        && content_type != "application/octet-stream"
    {
        return Err(ProxyError::security("远程 URL 返回的不是图片内容。"));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| ProxyError::network(format!("读取远程图片失败: {e}")))?;

    if bytes.len() > MAX_IMAGE_BYTES {
        return Err(ProxyError::security("远程图片超过大小限制。"));
    }

    Ok(RemoteImageData {
        bytes: bytes.to_vec(),
        content_type: if content_type.is_empty() {
            "application/octet-stream".to_string()
        } else {
            content_type
        },
    })
}

fn validate_image_url(raw: &str) -> Result<Url, ProxyError> {
    if raw.len() > 8192 {
        return Err(ProxyError::security("缺少或无效的图片 URL。"));
    }

    let url = Url::parse(raw)
        .or_else(|_| Url::parse(&format!("https://{raw}")))
        .map_err(|_| ProxyError::security("图片 URL 格式无效。"))?;

    match url.scheme() {
        "http" | "https" => {}
        _ => return Err(ProxyError::security("只支持代理 HTTP/HTTPS 图片 URL。")),
    }

    if !url.username().is_empty() || url.password().is_some() {
        return Err(ProxyError::security("图片 URL 不允许包含认证信息。"));
    }

    if let Some(port) = url.port() {
        if port != 80 && port != 443 {
            return Err(ProxyError::security("图片 URL 端口不受支持。"));
        }
    }

    let hostname = url.host_str().unwrap_or("").to_lowercase();
    if hostname == "localhost" || hostname.ends_with(".localhost") {
        return Err(ProxyError::security("不允许代理本机地址。"));
    }

    Ok(url)
}

#[cfg(test)]
mod tests {
    use super::validate_image_url;

    #[test]
    fn rejects_localhost() {
        assert!(validate_image_url("http://localhost:3000/image.png").is_err());
    }

    #[test]
    fn rejects_private_ip() {
        assert!(validate_image_url("http://192.168.1.1/test.png").is_err());
    }

    #[test]
    fn rejects_non_http_scheme() {
        assert!(validate_image_url("file:///etc/passwd").is_err());
    }

    #[test]
    fn rejects_url_with_auth() {
        assert!(validate_image_url("https://user:pass@example.com/img.png").is_err());
    }

    #[test]
    fn rejects_too_long_url() {
        let long_url = format!("https://example.com/{}", "a".repeat(9000));
        assert!(validate_image_url(&long_url).is_err());
    }

    #[test]
    fn allows_valid_https_url() {
        let result = validate_image_url("https://cdn.example.com/images/test.png");
        assert!(result.is_ok());
    }

    #[test]
    fn normalizes_url_without_scheme() {
        let result = validate_image_url("cdn.example.com/image.png");
        assert!(result.is_ok());
        assert_eq!(result.unwrap().scheme(), "https");
    }
}
