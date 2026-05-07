use std::path::PathBuf;
use tauri::Manager;

use crate::proxy::error::ProxyError;

const IMAGE_BASE_DIR_NAME: &str = "generated-images";

pub fn image_base_dir(app: &tauri::AppHandle) -> Result<PathBuf, ProxyError> {
    app.path()
        .app_local_data_dir()
        .map(|d| d.join(IMAGE_BASE_DIR_NAME))
        .map_err(|e| ProxyError::network(format!("无法获取应用数据目录: {e}")))
}

pub fn resolve_storage_base_dir(
    app: &tauri::AppHandle,
    custom_storage_path: Option<&str>,
) -> Result<PathBuf, ProxyError> {
    if let Some(path) = normalize_custom_storage_path(custom_storage_path)? {
        return Ok(path);
    }

    image_base_dir(app)
}

fn normalize_custom_storage_path(
    custom_storage_path: Option<&str>,
) -> Result<Option<PathBuf>, ProxyError> {
    let trimmed_path = custom_storage_path
        .map(str::trim)
        .filter(|path| !path.is_empty());
    match trimmed_path {
        Some(path) => {
            let path_buf = PathBuf::from(path);
            if !path_buf.is_absolute() {
                return Err(ProxyError::bad_request("图片存储路径必须是绝对路径。"));
            }
            Ok(Some(path_buf))
        }
        None => Ok(None),
    }
}

pub fn validate_filename(filename: &str) -> Result<(), ProxyError> {
    if filename.is_empty()
        || filename.contains('\0')
        || filename.contains("..")
        || filename.contains('/')
        || filename.contains('\\')
    {
        return Err(ProxyError::bad_request("文件名格式无效。"));
    }
    Ok(())
}

pub fn resolve_image_path(
    app: &tauri::AppHandle,
    filename: &str,
    custom_storage_path: Option<&str>,
) -> Result<PathBuf, ProxyError> {
    validate_filename(filename)?;
    let base = resolve_storage_base_dir(app, custom_storage_path)?;
    Ok(base.join(filename))
}

#[cfg(test)]
mod tests {
    use super::{normalize_custom_storage_path, validate_filename};

    #[test]
    fn rejects_empty_filename() {
        assert!(validate_filename("").is_err());
    }

    #[test]
    fn rejects_directory_traversal() {
        assert!(validate_filename("../etc/passwd").is_err());
        assert!(validate_filename("..\\windows\\system32").is_err());
    }

    #[test]
    fn rejects_path_separator() {
        assert!(validate_filename("foo/bar.png").is_err());
        assert!(validate_filename("foo\\bar.png").is_err());
    }

    #[test]
    fn rejects_null_byte() {
        assert!(validate_filename("foo\0bar.png").is_err());
    }

    #[test]
    fn allows_valid_filename() {
        assert!(validate_filename("1234567890-0.png").is_ok());
        assert!(validate_filename("my-image.webp").is_ok());
    }

    #[test]
    fn ignores_blank_custom_storage_path() {
        assert!(normalize_custom_storage_path(Some("   "))
            .unwrap()
            .is_none());
    }

    #[test]
    fn rejects_relative_custom_storage_path() {
        assert!(normalize_custom_storage_path(Some("generated-images")).is_err());
    }

    #[test]
    fn accepts_absolute_custom_storage_path() {
        let path = std::env::temp_dir();
        assert_eq!(
            normalize_custom_storage_path(path.to_str()).unwrap(),
            Some(path)
        );
    }
}
