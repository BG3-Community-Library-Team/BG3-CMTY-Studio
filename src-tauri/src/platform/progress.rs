//! Upload progress event system for platform uploads.

use serde::Serialize;

use super::errors::PlatformError;

/// Which platform an upload targets.
#[derive(Clone, Serialize)]
pub enum Platform {
    Nexus,
    Modio,
}

/// Current stage of the upload pipeline.
#[derive(Clone, Serialize)]
pub enum UploadStage {
    Packaging,
    Hashing,
    Uploading,
    Finalizing,
    Processing,
    Publishing,
    Complete,
    Error,
}

/// Progress payload emitted via Tauri events during an upload.
#[derive(Clone, Serialize)]
pub struct UploadProgress {
    pub platform: Platform,
    pub stage: UploadStage,
    pub percent: f64,
    pub bytes_sent: u64,
    pub bytes_total: u64,
    pub message: String,
}

/// Emit an upload-progress event to the frontend.
pub fn emit_progress(
    app_handle: &tauri::AppHandle,
    progress: &UploadProgress,
) -> Result<(), PlatformError> {
    use tauri::Emitter;
    app_handle
        .emit("platform-upload-progress", progress)
        .map_err(|e| PlatformError::IoError(format!("Failed to emit progress event: {e}")))
}
