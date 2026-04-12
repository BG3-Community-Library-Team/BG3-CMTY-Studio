//! Nexus Mods single-part file upload pipeline.
//!
//! Flow: create upload → PUT to presigned S3 URL → finalise → poll → publish.

use std::path::Path;

use serde::Deserialize;

use crate::platform::errors::PlatformError;
use crate::platform::progress::{emit_progress, Platform, UploadProgress, UploadStage};

use super::client::NexusClient;

/// Maximum file size for single-part upload (100 MiB).
const MAX_SINGLE_PART_SIZE: u64 = 100 * 1024 * 1024;

/// Maximum time to wait for server-side processing (5 minutes).
const POLL_TIMEOUT_SECS: u64 = 300;

/// Parameters for a Nexus file upload.
#[derive(Debug, Deserialize)]
pub struct NexusUploadParams {
    pub file_path: String,
    pub mod_uuid: String,
    pub file_group_id: u64,
    pub name: String,
    pub version: String,
    pub description: Option<String>,
    pub category: Option<String>,
}

/// Response from `POST /uploads` — contains the presigned S3 URL.
#[derive(Debug, Deserialize)]
struct CreateUploadResponse {
    id: String,
    #[serde(alias = "presigned_url")]
    url: String,
}

// ── Step 1: create upload session ────────────────────────────────────

async fn create_upload(
    client: &NexusClient,
    file_size: u64,
    filename: &str,
) -> Result<CreateUploadResponse, PlatformError> {
    let body = serde_json::json!({
        "file_size": file_size,
        "filename": filename,
    });

    let resp = client.post_json("/uploads", &body).await?;
    let parsed: CreateUploadResponse = resp
        .json()
        .await
        .map_err(|e| PlatformError::HttpError(format!("Failed to parse create-upload response: {e}")))?;
    Ok(parsed)
}

// ── Step 2: PUT file to presigned S3 URL ─────────────────────────────

async fn put_to_presigned_url(
    presigned_url: &str,
    file_path: &Path,
    file_size: u64,
    app_handle: &tauri::AppHandle,
) -> Result<(), PlatformError> {
    // Build a bare reqwest client (no apikey header — S3 uses presigned auth).
    let s3_client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(600))
        .build()
        .map_err(|e| PlatformError::HttpError(format!("Failed to build S3 client: {e}")))?;

    let file_bytes = std::fs::read(file_path)
        .map_err(|e| PlatformError::IoError(format!("Failed to read file: {e}")))?;

    // Emit initial upload progress.
    let _ = emit_progress(
        app_handle,
        &UploadProgress {
            platform: Platform::Nexus,
            stage: UploadStage::Uploading,
            percent: 0.0,
            bytes_sent: 0,
            bytes_total: file_size,
            message: "Uploading to Nexus…".into(),
        },
    );

    let resp = s3_client
        .put(presigned_url)
        .header("Content-Length", file_size)
        .body(file_bytes)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                PlatformError::Timeout
            } else {
                PlatformError::HttpError(format!("S3 PUT failed: {e}"))
            }
        })?;

    if resp.status().as_u16() == 403 {
        return Err(PlatformError::ApiError {
            status: 403,
            message: "Presigned URL expired or forbidden".into(),
        });
    }

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let body = resp.text().await.unwrap_or_default();
        return Err(PlatformError::ApiError {
            status,
            message: format!("S3 upload failed: {body}"),
        });
    }

    // Emit completion.
    let _ = emit_progress(
        app_handle,
        &UploadProgress {
            platform: Platform::Nexus,
            stage: UploadStage::Uploading,
            percent: 100.0,
            bytes_sent: file_size,
            bytes_total: file_size,
            message: "Upload complete".into(),
        },
    );

    Ok(())
}

// ── Step 3: finalise ─────────────────────────────────────────────────

async fn finalize_upload(client: &NexusClient, upload_id: &str) -> Result<(), PlatformError> {
    let path = format!("/uploads/{upload_id}/finalise");
    client.post_json(&path, &serde_json::json!({})).await?;
    Ok(())
}

// ── Step 4: poll until processed ─────────────────────────────────────

async fn poll_upload(client: &NexusClient, upload_id: &str) -> Result<(), PlatformError> {
    let path = format!("/uploads/{upload_id}");
    let start = std::time::Instant::now();
    let mut delay = std::time::Duration::from_secs(2);
    let max_delay = std::time::Duration::from_secs(30);

    loop {
        if start.elapsed().as_secs() > POLL_TIMEOUT_SECS {
            return Err(PlatformError::UploadTimeout);
        }

        let resp = client.get(&path).await?;
        let json: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| PlatformError::HttpError(format!("Failed to parse poll response: {e}")))?;

        let status = json["status"]
            .as_str()
            .or_else(|| json["state"].as_str())
            .unwrap_or("");

        match status {
            "processed" | "complete" | "completed" => return Ok(()),
            "failed" | "error" => {
                let msg = json["message"]
                    .as_str()
                    .or_else(|| json["error"].as_str())
                    .unwrap_or("Unknown processing error");
                return Err(PlatformError::ApiError {
                    status: 200,
                    message: format!("Upload processing failed: {msg}"),
                });
            }
            _ => {
                // Still processing — exponential backoff.
                tokio::time::sleep(delay).await;
                delay = (delay * 2).min(max_delay);
            }
        }
    }
}

// ── Step 5: create update-group version ──────────────────────────────

async fn create_update_group_version(
    client: &NexusClient,
    group_id: u64,
    upload_id: &str,
    name: &str,
    version: &str,
    description: Option<&str>,
    category: Option<&str>,
) -> Result<(), PlatformError> {
    let body = serde_json::json!({
        "upload_id": upload_id,
        "name": name,
        "version": version,
        "description": description.unwrap_or(""),
        "category": category.unwrap_or("main"),
    });

    let path = format!("/file-update-groups/{group_id}/versions");
    client.post_json(&path, &body).await?;
    Ok(())
}

// ── Orchestrator ─────────────────────────────────────────────────────

/// Execute the full Nexus single-part upload pipeline.
///
/// 1. Validate inputs
/// 2. Create upload session → presigned URL
/// 3. PUT file to S3 (retry once on 403)
/// 4. Finalise upload
/// 5. Poll until processed
/// 6. Create update-group version
pub async fn upload_file(
    client: &NexusClient,
    params: &NexusUploadParams,
    app_handle: &tauri::AppHandle,
) -> Result<(), PlatformError> {
    let file_path = Path::new(&params.file_path);

    // ── Validate ─────────────────────────────────────────────────────
    if !file_path.exists() {
        return Err(PlatformError::ValidationError(format!(
            "File does not exist: {}",
            params.file_path
        )));
    }

    let metadata = std::fs::metadata(file_path)
        .map_err(|e| PlatformError::IoError(format!("Cannot read file metadata: {e}")))?;
    let file_size = metadata.len();

    if file_size > MAX_SINGLE_PART_SIZE {
        return Err(PlatformError::ValidationError(format!(
            "File size ({:.1} MiB) exceeds the 100 MiB single-part limit. \
             Multipart upload is not yet supported.",
            file_size as f64 / (1024.0 * 1024.0)
        )));
    }

    crate::platform::validation::validate_nexus_name(&params.name)?;
    crate::platform::validation::validate_nexus_version(&params.version)?;

    let filename = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("upload.zip");

    // ── Stage: Packaging ─────────────────────────────────────────────
    let _ = emit_progress(
        app_handle,
        &UploadProgress {
            platform: Platform::Nexus,
            stage: UploadStage::Packaging,
            percent: 100.0,
            bytes_sent: 0,
            bytes_total: file_size,
            message: "File ready for upload".into(),
        },
    );

    // ── Step 1: create upload ────────────────────────────────────────
    let upload_info = create_upload(client, file_size, filename).await?;

    // ── Step 2: PUT to S3 (retry once on 403) ────────────────────────
    let put_result = put_to_presigned_url(&upload_info.url, file_path, file_size, app_handle).await;

    if let Err(PlatformError::ApiError { status: 403, .. }) = &put_result {
        // Presigned URL may have expired — get a fresh one and retry.
        let retry_info = create_upload(client, file_size, filename).await?;
        put_to_presigned_url(&retry_info.url, file_path, file_size, app_handle).await?;
        // Use the retry upload ID for subsequent steps.
        return finish_upload(client, &retry_info.id, params, file_size, app_handle).await;
    }

    put_result?;

    finish_upload(client, &upload_info.id, params, file_size, app_handle).await
}

/// Finalise, poll, and publish — shared by normal path and 403-retry path.
async fn finish_upload(
    client: &NexusClient,
    upload_id: &str,
    params: &NexusUploadParams,
    file_size: u64,
    app_handle: &tauri::AppHandle,
) -> Result<(), PlatformError> {
    // ── Stage: Finalizing ────────────────────────────────────────────
    let _ = emit_progress(
        app_handle,
        &UploadProgress {
            platform: Platform::Nexus,
            stage: UploadStage::Finalizing,
            percent: 0.0,
            bytes_sent: file_size,
            bytes_total: file_size,
            message: "Finalising upload…".into(),
        },
    );

    finalize_upload(client, upload_id).await?;

    // ── Stage: Processing ────────────────────────────────────────────
    let _ = emit_progress(
        app_handle,
        &UploadProgress {
            platform: Platform::Nexus,
            stage: UploadStage::Processing,
            percent: 0.0,
            bytes_sent: file_size,
            bytes_total: file_size,
            message: "Waiting for Nexus to process upload…".into(),
        },
    );

    poll_upload(client, upload_id).await?;

    // ── Stage: Publishing ────────────────────────────────────────────
    let _ = emit_progress(
        app_handle,
        &UploadProgress {
            platform: Platform::Nexus,
            stage: UploadStage::Publishing,
            percent: 0.0,
            bytes_sent: file_size,
            bytes_total: file_size,
            message: "Publishing file version…".into(),
        },
    );

    create_update_group_version(
        client,
        params.file_group_id,
        upload_id,
        &params.name,
        &params.version,
        params.description.as_deref(),
        params.category.as_deref(),
    )
    .await?;

    // ── Stage: Complete ──────────────────────────────────────────────
    let _ = emit_progress(
        app_handle,
        &UploadProgress {
            platform: Platform::Nexus,
            stage: UploadStage::Complete,
            percent: 100.0,
            bytes_sent: file_size,
            bytes_total: file_size,
            message: "Upload complete!".into(),
        },
    );

    Ok(())
}
