//! mod.io media management — add/delete images, logos, and YouTube links.

use std::path::Path;

use serde::Deserialize;

use crate::platform::errors::PlatformError;
use crate::platform::modio::client::{ModioClientSnapshot, BASE_URL};

// ── Request types ───────────────────────────────────────────────────

/// Parameters for adding media to a mod.
#[derive(Debug, Clone, Deserialize)]
pub struct AddMediaParams {
    pub game_id: u64,
    pub mod_id: u64,
    /// Paths to image files on disk (JPEG/PNG/GIF, up to 100).
    pub image_paths: Option<Vec<String>>,
    /// Path to a single logo image on disk.
    pub logo_path: Option<String>,
    /// YouTube video URLs.
    pub youtube_urls: Option<Vec<String>>,
}

// ── Error envelope ──────────────────────────────────────────────────

#[derive(Deserialize)]
struct ErrorObject {
    message: String,
}

#[derive(Deserialize)]
struct ModioErrorResponse {
    error: ErrorObject,
}

// ── Helpers ─────────────────────────────────────────────────────────

fn mime_for_image(path: &Path) -> &'static str {
    match path.extension().and_then(|e| e.to_str()).unwrap_or("") {
        e if e.eq_ignore_ascii_case("jpg") || e.eq_ignore_ascii_case("jpeg") => "image/jpeg",
        e if e.eq_ignore_ascii_case("png") => "image/png",
        e if e.eq_ignore_ascii_case("gif") => "image/gif",
        e if e.eq_ignore_ascii_case("webp") => "image/webp",
        _ => "application/octet-stream",
    }
}

// ── Public API ──────────────────────────────────────────────────────

/// Add images, a logo, or YouTube links to a mod.
///
/// `POST /games/{game_id}/mods/{mod_id}/media` — requires OAuth2 token.
pub async fn add_media(
    client: &ModioClientSnapshot,
    params: &AddMediaParams,
) -> Result<(), PlatformError> {
    let token = client.token().ok_or_else(|| PlatformError::ApiError {
        status: 401,
        message: "Not authenticated — OAuth2 token required to add media".into(),
    })?;

    let mut form = reqwest::multipart::Form::new();

    if let Some(ref image_paths) = params.image_paths {
        for (i, img_path) in image_paths.iter().enumerate() {
            let p = Path::new(img_path);
            if !p.exists() {
                return Err(PlatformError::ValidationError(format!(
                    "Image file does not exist: {img_path}"
                )));
            }
            let bytes = tokio::fs::read(p)
                .await
                .map_err(|e| PlatformError::IoError(format!("Failed to read image: {e}")))?;
            let filename = p
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("image.png")
                .to_string();
            let mime = mime_for_image(p);
            let part = reqwest::multipart::Part::bytes(bytes)
                .file_name(filename)
                .mime_str(mime)
                .map_err(|e| PlatformError::HttpError(format!("Failed to set MIME type: {e}")))?;
            form = form.part(format!("image{i}"), part);
        }
    }

    if let Some(ref logo_path) = params.logo_path {
        let p = Path::new(logo_path);
        if !p.exists() {
            return Err(PlatformError::ValidationError(format!(
                "Logo file does not exist: {logo_path}"
            )));
        }
        let bytes = tokio::fs::read(p)
            .await
            .map_err(|e| PlatformError::IoError(format!("Failed to read logo: {e}")))?;
        let filename = p
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("logo.png")
            .to_string();
        let mime = mime_for_image(p);
        let part = reqwest::multipart::Part::bytes(bytes)
            .file_name(filename)
            .mime_str(mime)
            .map_err(|e| PlatformError::HttpError(format!("Failed to set MIME type: {e}")))?;
        form = form.part("logo", part);
    }

    if let Some(ref urls) = params.youtube_urls {
        for url in urls {
            form = form.text("youtube[]", url.clone());
        }
    }

    let url = format!(
        "{BASE_URL}/games/{}/mods/{}/media",
        params.game_id, params.mod_id
    );

    let resp = client
        .http_client()
        .post(&url)
        .bearer_auth(token)
        .multipart(form)
        .send()
        .await
        .map_err(|e| PlatformError::HttpError(format!("Add media request failed: {e}")))?;

    if resp.status().is_success() {
        Ok(())
    } else {
        let status = resp.status().as_u16();
        let message = match resp.json::<ModioErrorResponse>().await {
            Ok(body) => body.error.message,
            Err(_) => format!("HTTP {status}"),
        };
        Err(PlatformError::ApiError { status, message })
    }
}

/// Delete images from a mod by filename.
///
/// `DELETE /games/{game_id}/mods/{mod_id}/media` — requires OAuth2 token.
pub async fn delete_media(
    client: &ModioClientSnapshot,
    game_id: u64,
    mod_id: u64,
    image_filenames: &[String],
) -> Result<(), PlatformError> {
    let token = client.token().ok_or_else(|| PlatformError::ApiError {
        status: 401,
        message: "Not authenticated — OAuth2 token required to delete media".into(),
    })?;

    let url = format!("{BASE_URL}/games/{game_id}/mods/{mod_id}/media");

    let form_data: Vec<(&str, &str)> = image_filenames
        .iter()
        .map(|f| ("images[]", f.as_str()))
        .collect();

    let resp = client
        .http_client()
        .delete(&url)
        .bearer_auth(token)
        .form(&form_data)
        .send()
        .await
        .map_err(|e| PlatformError::HttpError(format!("Delete media request failed: {e}")))?;

    if resp.status().is_success() || resp.status().as_u16() == 204 {
        Ok(())
    } else {
        let status = resp.status().as_u16();
        let message = match resp.json::<ModioErrorResponse>().await {
            Ok(body) => body.error.message,
            Err(_) => format!("HTTP {status}"),
        };
        Err(PlatformError::ApiError { status, message })
    }
}
