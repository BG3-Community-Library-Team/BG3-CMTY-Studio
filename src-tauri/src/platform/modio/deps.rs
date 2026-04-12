//! mod.io dependency management — get, add, and remove mod dependencies.

use serde::{Deserialize, Serialize};

use crate::platform::errors::PlatformError;
use crate::platform::modio::client::{ModioClientSnapshot, BASE_URL};

// ── Response types ──────────────────────────────────────────────────

/// A single dependency entry from mod.io.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModioDependency {
    pub mod_id: u64,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub name_id: String,
    #[serde(default)]
    pub date_added: u64,
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
    data: Vec<ModioDependency>,
}

// ── Public API ──────────────────────────────────────────────────────

/// Get dependencies for a mod.
///
/// `GET /games/{game_id}/mods/{mod_id}/dependencies` — uses API key or Bearer token.
pub async fn get_dependencies(
    client: &ModioClientSnapshot,
    game_id: u64,
    mod_id: u64,
) -> Result<Vec<ModioDependency>, PlatformError> {
    let url = format!("{BASE_URL}/games/{game_id}/mods/{mod_id}/dependencies");

    let mut req = client.http_client().get(&url);
    if let Some(token) = client.token() {
        req = req.bearer_auth(token);
    } else {
        req = req.query(&[("api_key", client.api_key())]);
    }

    let resp = req
        .send()
        .await
        .map_err(|e| PlatformError::HttpError(format!("Get dependencies request failed: {e}")))?;

    if resp.status().is_success() {
        let body: PaginatedResponse = resp.json().await.map_err(|e| {
            PlatformError::HttpError(format!("Failed to parse dependencies response: {e}"))
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

/// Add dependencies to a mod (up to 5 at a time).
///
/// `POST /games/{game_id}/mods/{mod_id}/dependencies` — requires OAuth2 token.
pub async fn add_dependencies(
    client: &ModioClientSnapshot,
    game_id: u64,
    mod_id: u64,
    dependency_ids: &[u64],
) -> Result<(), PlatformError> {
    let token = client.token().ok_or_else(|| PlatformError::ApiError {
        status: 401,
        message: "Not authenticated — OAuth2 token required to add dependencies".into(),
    })?;

    let url = format!("{BASE_URL}/games/{game_id}/mods/{mod_id}/dependencies");

    let form_data: Vec<(&str, String)> = dependency_ids
        .iter()
        .map(|id| ("dependencies[]", id.to_string()))
        .collect();

    let resp = client
        .http_client()
        .post(&url)
        .bearer_auth(token)
        .form(&form_data)
        .send()
        .await
        .map_err(|e| PlatformError::HttpError(format!("Add dependencies request failed: {e}")))?;

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

/// Remove dependencies from a mod.
///
/// `DELETE /games/{game_id}/mods/{mod_id}/dependencies` — requires OAuth2 token.
pub async fn remove_dependencies(
    client: &ModioClientSnapshot,
    game_id: u64,
    mod_id: u64,
    dependency_ids: &[u64],
) -> Result<(), PlatformError> {
    let token = client.token().ok_or_else(|| PlatformError::ApiError {
        status: 401,
        message: "Not authenticated — OAuth2 token required to remove dependencies".into(),
    })?;

    let url = format!("{BASE_URL}/games/{game_id}/mods/{mod_id}/dependencies");

    let form_data: Vec<(&str, String)> = dependency_ids
        .iter()
        .map(|id| ("dependencies[]", id.to_string()))
        .collect();

    let resp = client
        .http_client()
        .delete(&url)
        .bearer_auth(token)
        .form(&form_data)
        .send()
        .await
        .map_err(|e| {
            PlatformError::HttpError(format!("Remove dependencies request failed: {e}"))
        })?;

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
