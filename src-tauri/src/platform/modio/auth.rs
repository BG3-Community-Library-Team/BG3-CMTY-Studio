//! mod.io email-based OAuth2 authentication flow.

use serde::{Deserialize, Serialize};

use crate::platform::errors::PlatformError;

/// User profile returned by the mod.io `/me` endpoint.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModioUserProfile {
    pub id: u64,
    #[serde(alias = "username")]
    pub name: String,
    #[serde(default)]
    pub avatar_url: String,
    pub date_online: u64,
}

/// mod.io API base URL.
const BASE_URL: &str = "https://api.mod.io/v1";

// ── Response wrappers (mod.io envelope) ─────────────────────────────

#[derive(Deserialize)]
struct EmailRequestResponse {
    #[allow(dead_code)]
    message: String,
}

#[derive(Deserialize)]
struct EmailExchangeResponse {
    access_token: String,
}

#[derive(Deserialize)]
struct ErrorObject {
    message: String,
}

#[derive(Deserialize)]
struct ModioErrorResponse {
    error: ErrorObject,
}

// ── Public API ──────────────────────────────────────────────────────

/// Step 1: Request a security code be sent to the user's email.
///
/// `POST /oauth/emailrequest` with `api_key` + `email` form data.
pub async fn email_request(
    client: &reqwest::Client,
    api_key: &str,
    email: &str,
) -> Result<(), PlatformError> {
    let url = format!("{BASE_URL}/oauth/emailrequest");
    let resp = client
        .post(&url)
        .form(&[("api_key", api_key), ("email", email)])
        .send()
        .await
        .map_err(|e| PlatformError::HttpError(format!("Email request failed: {e}")))?;

    if resp.status().is_success() {
        Ok(())
    } else {
        Err(extract_api_error(resp).await)
    }
}

/// Step 2: Exchange the emailed security code for an OAuth2 access token.
///
/// `POST /oauth/emailexchange` with `api_key` + `security_code` form data.
/// Returns the OAuth2 bearer token.
pub async fn email_exchange(
    client: &reqwest::Client,
    api_key: &str,
    code: &str,
) -> Result<String, PlatformError> {
    let url = format!("{BASE_URL}/oauth/emailexchange");
    let resp = client
        .post(&url)
        .form(&[("api_key", api_key), ("security_code", code)])
        .send()
        .await
        .map_err(|e| PlatformError::HttpError(format!("Email exchange failed: {e}")))?;

    if resp.status().is_success() {
        let body: EmailExchangeResponse = resp
            .json()
            .await
            .map_err(|e| PlatformError::HttpError(format!("Failed to parse token response: {e}")))?;
        Ok(body.access_token)
    } else {
        Err(extract_api_error(resp).await)
    }
}

/// Fetch the authenticated user's profile.
///
/// `GET /me` with `Authorization: Bearer {token}`.
pub async fn get_user(
    client: &reqwest::Client,
    token: &str,
) -> Result<ModioUserProfile, PlatformError> {
    let url = format!("{BASE_URL}/me");
    let resp = client
        .get(&url)
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| PlatformError::HttpError(format!("Get user failed: {e}")))?;

    if resp.status().is_success() {
        // mod.io wraps user in a top-level object; the fields are at root level
        let profile: ModioUserProfile = resp
            .json()
            .await
            .map_err(|e| PlatformError::HttpError(format!("Failed to parse user profile: {e}")))?;
        Ok(profile)
    } else {
        Err(extract_api_error(resp).await)
    }
}

/// Revoke the current OAuth2 token.
///
/// `POST /oauth/logout` with `Authorization: Bearer {token}`.
pub async fn logout(
    client: &reqwest::Client,
    token: &str,
) -> Result<(), PlatformError> {
    let url = format!("{BASE_URL}/oauth/logout");
    let resp = client
        .post(&url)
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| PlatformError::HttpError(format!("Logout failed: {e}")))?;

    if resp.status().is_success() {
        Ok(())
    } else {
        // Best-effort: if logout fails we still clear local state
        let _ = extract_api_error(resp).await;
        Ok(())
    }
}

// ── Helpers ─────────────────────────────────────────────────────────

async fn extract_api_error(resp: reqwest::Response) -> PlatformError {
    let status = resp.status().as_u16();
    match resp.json::<ModioErrorResponse>().await {
        Ok(body) => PlatformError::ApiError {
            status,
            message: body.error.message,
        },
        Err(_) => PlatformError::ApiError {
            status,
            message: format!("HTTP {status}"),
        },
    }
}
