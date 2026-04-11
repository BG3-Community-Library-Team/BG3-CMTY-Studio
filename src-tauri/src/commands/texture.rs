use std::path::PathBuf;

use base64::prelude::*;

/// Convert a DDS file to PNG, returning a base64-encoded PNG string.
pub fn convert_dds_to_png(path: &str, project_dir: &str) -> Result<String, String> {
    let file_path = resolve_and_validate(path, project_dir)?;

    let img = image::open(&file_path)
        .map_err(|e| format!("Failed to read DDS file '{}': {e}", file_path.display()))?;

    let mut png_bytes = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut png_bytes);
    img.write_to(&mut cursor, image::ImageFormat::Png)
        .map_err(|e| format!("Failed to encode PNG: {e}"))?;

    Ok(BASE64_STANDARD.encode(&png_bytes))
}

/// Get the dimensions (width, height) from a DDS file without full decode.
pub fn get_dds_dimensions(path: &str, project_dir: &str) -> Result<(u32, u32), String> {
    let file_path = resolve_and_validate(path, project_dir)?;

    let reader = image::ImageReader::open(&file_path)
        .map_err(|e| format!("Failed to open file '{}': {e}", file_path.display()))?
        .with_guessed_format()
        .map_err(|e| format!("Failed to detect format: {e}"))?;

    reader
        .into_dimensions()
        .map_err(|e| format!("Failed to read DDS dimensions: {e}"))
}

/// Validate path is within the project directory (prevent path traversal).
fn resolve_and_validate(path: &str, project_dir: &str) -> Result<PathBuf, String> {
    let project = PathBuf::from(project_dir)
        .canonicalize()
        .map_err(|e| format!("Invalid project directory: {e}"))?;

    let file_path = project
        .join(path)
        .canonicalize()
        .map_err(|e| format!("File not found: {e}"))?;

    if !file_path.starts_with(&project) {
        return Err("Path traversal outside project directory rejected".to_string());
    }

    Ok(file_path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn path_traversal_rejected() {
        let tmp = TempDir::new().unwrap();
        let project_dir = tmp.path().to_str().unwrap();

        let result = convert_dds_to_png("../../etc/passwd", project_dir);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(
            err.contains("File not found") || err.contains("Path traversal"),
            "Expected path traversal error, got: {err}"
        );
    }

    #[test]
    fn nonexistent_file_errors() {
        let tmp = TempDir::new().unwrap();
        let project_dir = tmp.path().to_str().unwrap();

        let result = convert_dds_to_png("does_not_exist.dds", project_dir);
        assert!(result.is_err());
        assert!(
            result.unwrap_err().contains("File not found"),
            "Expected descriptive file-not-found error"
        );
    }

    #[test]
    fn dimensions_nonexistent_file_errors() {
        let tmp = TempDir::new().unwrap();
        let project_dir = tmp.path().to_str().unwrap();

        let result = get_dds_dimensions("missing.dds", project_dir);
        assert!(result.is_err());
        assert!(
            result.unwrap_err().contains("File not found"),
            "Expected descriptive file-not-found error"
        );
    }
}
