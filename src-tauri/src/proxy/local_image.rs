use std::path::PathBuf;
use tauri::Manager;

use crate::proxy::error::ProxyError;

const IMAGE_BASE_DIR_NAME: &str = "generated-images";

pub fn image_base_dir(app: &tauri::AppHandle) -> Result<PathBuf, ProxyError> {
    app.path()
        .app_data_dir()
        .map(|d| d.join(IMAGE_BASE_DIR_NAME))
        .map_err(|e| ProxyError::network(format!("无法获取应用数据目录: {e}")))
}

pub fn validate_filename(filename: &str) -> Result<(), ProxyError> {
    if filename.is_empty()
        || filename.contains("..")
        || filename.contains('/')
        || filename.contains('\\')
    {
        return Err(ProxyError::bad_request("Invalid filename format."));
    }
    Ok(())
}

pub fn resolve_image_path(app: &tauri::AppHandle, filename: &str) -> Result<PathBuf, ProxyError> {
    validate_filename(filename)?;
    let base = image_base_dir(app)?;
    Ok(base.join(filename))
}

#[cfg(test)]
mod tests {
    use super::validate_filename;

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
    fn allows_valid_filename() {
        assert!(validate_filename("1234567890-0.png").is_ok());
        assert!(validate_filename("my-image.webp").is_ok());
    }
}
