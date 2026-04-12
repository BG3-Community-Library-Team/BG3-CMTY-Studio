//! mod.io metadata key-value pair management.

use serde::{Deserialize, Serialize};

use crate::platform::errors::PlatformError;
use crate::platform::modio::client::{ModioClientSnapshot, BASE_URL};

// ── Types ───────────────────────────────────────────────────────────

/// A single metadata key-value pair.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetadataEntry {
    pub metakey: String,
    pub metavalue: String,
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

/// Paginated response envelope from mod.io.
#[derive(Deserialize)]
struct PaginatedResponse {
    data: Vec<MetadataEntry>,
}

// ── Public API ──────────────────────────────────────────────────────

/// Get metadata key-value pairs for a mod.
///
/// `GET /games/{game_id}/mods/{mod_id}/metadatakvp` — uses API key or Bearer token.
pub async fn get_metadata(
    client: &ModioClientSnapshot,
    game_id: u64,
    mod_id: u64,
) -> Result<Vec<MetadataEntry>, PlatformError> {
    let url = format!("{BASE_URL}/games/{game_id}/mods/{mod_id}/metadatakvp");

    let mut req = client.http_client().get(&url);
    if let Some(token) = client.token() {
        req = req.bearer_auth(token);
    } else {
        req = req.query(&[("api_key", client.api_key())]);
    }

    let resp = req
        .send()
        .await
        .map_err(|e| PlatformError::HttpError(format!("Get metadata request failed: {e}")))?;

    if resp.status().is_success() {
        let body: PaginatedResponse = resp.json().await.map_err(|e| {
            PlatformError::HttpError(format!("Failed to parse metadata response: {e}"))
        })?;
        Ok(body.data)
    } else {
        let status = resp.status().as_u16();
        let message = match resp.json::<ModioErrorResponse>().await {
            Ok(body) => body.error.message,
            Err(_) => format!("HTTP {status}"),
        };
        Err(PlatformError::ApiError { status, message })
    }
}

/// Add metadata key-value pairs to a mod (max 50).
///
/// `POST /games/{game_id}/mods/{mod_id}/metadatakvp` — requires OAuth2 token.
/// Body format: `metadata[]=key:value&metadata[]=key2:value2`
pub async fn add_metadata(
    client: &ModioClientSnapshot,
    game_id: u64,
    mod_id: u64,
    entries: &[MetadataEntry],
) -> Result<(), PlatformError> {
    let token = client.token().ok_or_else(|| PlatformError::ApiError {
        status: 401,
        message: "Not authenticated — OAuth2 token required to add metadata".into(),
    })?;

    let url = format!("{BASE_URL}/games/{game_id}/mods/{mod_id}/metadatakvp");

    let form_data: Vec<(&str, String)> = entries
        .iter()
        .map(|e| ("metadata[]", format!("{}:{}", e.metakey, e.metavalue)))
        .collect();

    let resp = client
        .http_client()
        .post(&url)
        .bearer_auth(token)
        .form(&form_data)
        .send()
        .await
        .map_err(|e| PlatformError::HttpError(format!("Add metadata request failed: {e}")))?;

    if resp.status().is_success() || resp.status().as_u16() == 201 {
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

/// Remove metadata key-value pairs from a mod.
///
/// `DELETE /games/{game_id}/mods/{mod_id}/metadatakvp` — requires OAuth2 token.
pub async fn remove_metadata(
    client: &ModioClientSnapshot,
    game_id: u64,
    mod_id: u64,
    entries: &[MetadataEntry],
) -> Result<(), PlatformError> {
    let token = client.token().ok_or_else(|| PlatformError::ApiError {
        status: 401,
        message: "Not authenticated — OAuth2 token required to remove metadata".into(),
    })?;

    let url = format!("{BASE_URL}/games/{game_id}/mods/{mod_id}/metadatakvp");

    let form_data: Vec<(&str, String)> = entries
        .iter()
        .map(|e| ("metadata[]", format!("{}:{}", e.metakey, e.metavalue)))
        .collect();

    let resp = client
        .http_client()
        .delete(&url)
        .bearer_auth(token)
        .form(&form_data)
        .send()
        .await
        .map_err(|e| PlatformError::HttpError(format!("Remove metadata request failed: {e}")))?;

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
