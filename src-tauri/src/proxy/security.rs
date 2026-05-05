use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use tokio::net::lookup_host;
use url::Url;

use crate::proxy::error::ProxyError;

const BLOCKED_HOSTNAMES: &[&str] = &[
    "localhost",
    "localhost.localdomain",
    "metadata.google.internal",
];

pub async fn validate_url_domain(url: &Url) -> Result<(), ProxyError> {
    let hostname = normalize_hostname(url.host_str().ok_or_else(|| {
        ProxyError::security("URL 缺少主机名。")
    })?);

    if BLOCKED_HOSTNAMES.contains(&hostname.as_str()) || hostname.ends_with(".localhost") {
        return Err(ProxyError::security(
            "URL 不允许指向 localhost 或本机服务。",
        ));
    }

    if let Ok(ip) = hostname.parse::<IpAddr>() {
        if is_unsafe_ip(ip) {
            return Err(ProxyError::security(
                "URL 不允许指向私网、链路本地、回环或保留 IP 地址。",
            ));
        }
        return Ok(());
    }

    let port = url.port_or_known_default().unwrap_or(443);
    let addresses = lookup_host((hostname.as_str(), port))
        .await
        .map_err(|_| ProxyError::security("URL 域名解析失败。"))?
        .collect::<Vec<_>>();

    if addresses.is_empty() {
        return Err(ProxyError::security("URL 域名解析结果为空。"));
    }

    if addresses.iter().any(|addr| is_unsafe_ip(addr.ip())) {
        return Err(ProxyError::security(
            "URL 域名不允许解析到私网、链路本地、回环或保留 IP 地址。",
        ));
    }

    Ok(())
}

pub async fn validate_public_http_base_url(value: Option<&str>) -> Result<String, ProxyError> {
    let parsed = parse_and_validate_public_http_base_url(value)?;
    validate_resolved_host(&parsed).await?;
    Ok(parsed.as_str().trim_end_matches('/').to_string())
}

fn parse_and_validate_public_http_base_url(value: Option<&str>) -> Result<Url, ProxyError> {
    let raw = value.unwrap_or("https://api.openai.com/v1").trim();
    if raw.is_empty() {
        return parse_and_validate_public_http_base_url(None);
    }

    let parsed = Url::parse(raw)
        .or_else(|_| Url::parse(&format!("https://{raw}")))
        .map_err(|_| ProxyError::security("Base URL 格式无效。"))?;

    match parsed.scheme() {
        "http" | "https" => {}
        _ => return Err(ProxyError::security("Base URL 只支持 http 或 https 协议。")),
    }

    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err(ProxyError::security("Base URL 不允许包含用户名或密码。"));
    }

    let hostname = parsed
        .host_str()
        .map(normalize_hostname)
        .ok_or_else(|| ProxyError::security("Base URL 缺少主机名。"))?;

    if BLOCKED_HOSTNAMES.contains(&hostname.as_str()) || hostname.ends_with(".localhost") {
        return Err(ProxyError::security(
            "Base URL 不允许指向 localhost 或本机服务。",
        ));
    }

    if let Ok(ip) = hostname.parse::<IpAddr>() {
        if is_unsafe_ip(ip) {
            return Err(ProxyError::security(
                "Base URL 不允许指向私网、链路本地、回环或保留 IP 地址。",
            ));
        }
    }

    Ok(parsed)
}

async fn validate_resolved_host(parsed: &Url) -> Result<(), ProxyError> {
    let raw_hostname = parsed
        .host_str()
        .ok_or_else(|| ProxyError::security("Base URL 缺少主机名。"))?;
    let hostname = normalize_hostname(raw_hostname);

    if hostname.parse::<IpAddr>().is_ok() {
        return Ok(());
    }

    let port = parsed.port_or_known_default().unwrap_or(443);
    let addresses = lookup_host((hostname.as_str(), port))
        .await
        .map_err(|_| ProxyError::security("Base URL 域名解析失败。"))?
        .collect::<Vec<_>>();

    if addresses.is_empty() {
        return Err(ProxyError::security("Base URL 域名解析结果为空。"));
    }

    if addresses.iter().any(|address| is_unsafe_ip(address.ip())) {
        return Err(ProxyError::security(
            "Base URL 域名不允许解析到私网、链路本地、回环或保留 IP 地址。",
        ));
    }

    Ok(())
}

fn normalize_hostname(hostname: &str) -> String {
    hostname
        .trim()
        .trim_start_matches('[')
        .trim_end_matches(']')
        .to_lowercase()
}

fn is_unsafe_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ipv4) => is_unsafe_ipv4(ipv4),
        IpAddr::V6(ipv6) => is_unsafe_ipv6(ipv6),
    }
}

fn is_unsafe_ipv4(ip: Ipv4Addr) -> bool {
    let value = u32::from(ip);
    is_ipv4_in_range(value, Ipv4Addr::new(0, 0, 0, 0), 8)
        || is_ipv4_in_range(value, Ipv4Addr::new(10, 0, 0, 0), 8)
        || is_ipv4_in_range(value, Ipv4Addr::new(100, 64, 0, 0), 10)
        || is_ipv4_in_range(value, Ipv4Addr::new(127, 0, 0, 0), 8)
        || is_ipv4_in_range(value, Ipv4Addr::new(169, 254, 0, 0), 16)
        || is_ipv4_in_range(value, Ipv4Addr::new(172, 16, 0, 0), 12)
        || is_ipv4_in_range(value, Ipv4Addr::new(192, 168, 0, 0), 16)
        || is_ipv4_in_range(value, Ipv4Addr::new(224, 0, 0, 0), 4)
        || is_ipv4_in_range(value, Ipv4Addr::new(240, 0, 0, 0), 4)
}

fn is_ipv4_in_range(ip: u32, base: Ipv4Addr, prefix_length: u32) -> bool {
    let mask = if prefix_length == 0 {
        0
    } else {
        u32::MAX << (32 - prefix_length)
    };
    (ip & mask) == (u32::from(base) & mask)
}

fn is_unsafe_ipv6(ip: Ipv6Addr) -> bool {
    ip.is_unspecified()
        || ip.is_loopback()
        || ip.segments()[0] & 0xffc0 == 0xfe80
        || ip.segments()[0] & 0xfe00 == 0xfc00
        || ip.to_ipv4_mapped().is_some_and(is_unsafe_ipv4)
}

#[cfg(test)]
mod tests {
    use super::parse_and_validate_public_http_base_url;

    #[test]
    fn allows_public_https_base_url() {
        let result = parse_and_validate_public_http_base_url(Some("https://api.openai.com/v1/"));
        assert_eq!(
            result.unwrap().as_str().trim_end_matches('/'),
            "https://api.openai.com/v1"
        );
    }

    #[test]
    fn normalizes_host_without_protocol() {
        let result = parse_and_validate_public_http_base_url(Some("api.openai.com/v1"));
        assert_eq!(
            result.unwrap().as_str().trim_end_matches('/'),
            "https://api.openai.com/v1"
        );
    }

    #[test]
    fn rejects_localhost() {
        let result = parse_and_validate_public_http_base_url(Some("http://localhost:11434/v1"));
        assert!(result.is_err());
    }

    #[test]
    fn rejects_private_ipv4() {
        let result = parse_and_validate_public_http_base_url(Some("http://192.168.1.10/v1"));
        assert!(result.is_err());
    }

    #[test]
    fn rejects_metadata_ipv4() {
        let result = parse_and_validate_public_http_base_url(Some("http://169.254.169.254/latest"));
        assert!(result.is_err());
    }

    #[test]
    fn rejects_loopback_ipv6() {
        let result = parse_and_validate_public_http_base_url(Some("http://[::1]/v1"));
        assert!(result.is_err());
    }
}
