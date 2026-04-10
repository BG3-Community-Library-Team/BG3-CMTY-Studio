use std::path::{Path, PathBuf};

use crate::error::AppError;

const CMTYSTUDIO_DIR: &str = ".cmtystudio";

/// Maximum content size for project settings files (1 MB).
const MAX_CONTENT_SIZE: usize = 1_048_576;

/// Allowed filenames within the `.cmtystudio/` directory.
const ALLOWED_FILENAMES: &[&str] = &["settings.json", "explorer.json", "workspace.json"];

/// Ensure `.cmtystudio/` directory exists within the given project path.
#[tauri::command]
pub async fn cmd_ensure_cmtystudio_dir(project_path: String) -> Result<(), AppError> {
    let dir = PathBuf::from(&project_path).join(CMTYSTUDIO_DIR);
    validate_within_project(&dir, &project_path)?;
    std::fs::create_dir_all(&dir)
        .map_err(|e| AppError::io_error(format!("Failed to create .cmtystudio dir: {e}")))?;
    Ok(())
}

/// Read a JSON file from `.cmtystudio/`.
/// Returns the file content as a string, or `"{}"` if the file does not exist.
#[tauri::command]
pub async fn cmd_read_project_file(
    project_path: String,
    filename: String,
) -> Result<String, AppError> {
    validate_filename(&filename)?;
    let file_path = PathBuf::from(&project_path)
        .join(CMTYSTUDIO_DIR)
        .join(&filename);
    validate_within_project(&file_path, &project_path)?;

    match std::fs::read_to_string(&file_path) {
        Ok(content) => Ok(content),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok("{}".to_string()),
        Err(e) => Err(AppError::io_error(format!(
            "Failed to read {filename}: {e}"
        ))),
    }
}

/// Write a JSON file to `.cmtystudio/` using atomic write (temp file + rename).
#[tauri::command]
pub async fn cmd_write_project_file(
    project_path: String,
    filename: String,
    content: String,
) -> Result<(), AppError> {
    validate_filename(&filename)?;

    if content.len() > MAX_CONTENT_SIZE {
        return Err(AppError::invalid_input(format!(
            "Content exceeds maximum size of {MAX_CONTENT_SIZE} bytes"
        )));
    }

    let dir = PathBuf::from(&project_path).join(CMTYSTUDIO_DIR);
    let file_path = dir.join(&filename);
    validate_within_project(&file_path, &project_path)?;

    // Ensure the directory exists
    std::fs::create_dir_all(&dir)
        .map_err(|e| AppError::io_error(format!("Failed to create .cmtystudio dir: {e}")))?;

    // Atomic write: write to temp file, then rename
    let tmp_path = dir.join(format!(".{filename}.tmp"));
    std::fs::write(&tmp_path, &content)
        .map_err(|e| AppError::io_error(format!("Failed to write temp file: {e}")))?;

    std::fs::rename(&tmp_path, &file_path).map_err(|e| {
        // Clean up temp file on rename failure
        let _ = std::fs::remove_file(&tmp_path);
        AppError::io_error(format!("Failed to rename temp file: {e}"))
    })?;

    Ok(())
}

/// Validate that a resolved path is within the project directory.
fn validate_within_project(path: &Path, project_path: &str) -> Result<(), AppError> {
    let canonical_project = std::fs::canonicalize(project_path)
        .map_err(|e| AppError::io_error(format!("Cannot resolve project path: {e}")))?;

    let canonical_path = if path.exists() {
        std::fs::canonicalize(path)
            .map_err(|e| AppError::io_error(format!("Cannot resolve path: {e}")))?
    } else {
        // For non-existent paths, canonicalize the parent and append the filename
        let parent = path
            .parent()
            .ok_or_else(|| AppError::security("Invalid path: no parent directory"))?;

        // Parent might not exist yet either (e.g. .cmtystudio/ not created yet),
        // so walk up until we find an existing ancestor
        let mut existing_ancestor = parent.to_path_buf();
        let mut missing_parts: Vec<std::ffi::OsString> = Vec::new();

        // Collect the filename component of the original path
        if let Some(fname) = path.file_name() {
            missing_parts.push(fname.to_os_string());
        }

        while !existing_ancestor.exists() {
            if let Some(fname) = existing_ancestor.file_name() {
                missing_parts.push(fname.to_os_string());
            }
            existing_ancestor = match existing_ancestor.parent() {
                Some(p) => p.to_path_buf(),
                None => {
                    return Err(AppError::security("Cannot resolve path ancestry"));
                }
            };
        }

        let mut result = std::fs::canonicalize(&existing_ancestor)
            .map_err(|e| AppError::io_error(format!("Cannot resolve ancestor path: {e}")))?;

        // Re-append the missing components in reverse order
        for part in missing_parts.into_iter().rev() {
            result.push(part);
        }
        result
    };

    if !canonical_path.starts_with(&canonical_project) {
        return Err(AppError::security("Path outside project directory"));
    }
    Ok(())
}

/// Validate that the filename is in the allowlist and contains no path traversal.
fn validate_filename(filename: &str) -> Result<(), AppError> {
    if filename.contains('/')
        || filename.contains('\\')
        || filename.contains("..")
        || filename.is_empty()
    {
        return Err(AppError::security("Invalid filename"));
    }
    if !ALLOWED_FILENAMES.contains(&filename) {
        return Err(AppError::security(format!(
            "Filename not allowed: {filename}"
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_filename_allowed() {
        assert!(validate_filename("settings.json").is_ok());
        assert!(validate_filename("explorer.json").is_ok());
        assert!(validate_filename("workspace.json").is_ok());
    }

    #[test]
    fn test_validate_filename_rejected() {
        assert!(validate_filename("").is_err());
        assert!(validate_filename("../etc/passwd").is_err());
        assert!(validate_filename("foo/bar.json").is_err());
        assert!(validate_filename("unknown.json").is_err());
        assert!(validate_filename("..\\secret.json").is_err());
    }
}
