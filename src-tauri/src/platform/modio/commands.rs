//! IPC commands for mod.io authentication and management.

use std::sync::Mutex;

use tauri::State;

use crate::error::AppError;
use crate::platform::credentials;
use crate::platform::modio::auth;
use crate::platform::modio::client::ModioClient;
use crate::platform::modio::auth::ModioUserProfile;
use crate::platform::modio::deps::{self, ModioDependency};
use crate::platform::modio::files::{self, EditFileParams, ModioFileEntry};
use crate::platform::modio::manage::{self, CreateModParams, EditModParams, ModioModResponse};
use crate::platform::modio::media::{self, AddMediaParams};
use crate::platform::modio::meta::{self, MetadataEntry};
use crate::platform::modio::mods::{self, ModioModSummary};
use crate::platform::modio::tags::{self, TagOption};
use crate::platform::modio::upload::{self, ModioModfileResponse, ModioUploadParams};

/// Credential service name.
const SERVICE: &str = "modio";

/// Keyring username for the API key.
const KEY_API_KEY: &str = "modio-api-key";

/// Keyring username for the OAuth2 token.
const KEY_OAUTH_TOKEN: &str = "modio-oauth-token";

/// Default BG3 game ID on mod.io.
const BG3_GAME_ID: u64 = 629;

/// Managed Tauri state holding the mod.io client.
pub struct ModioState {
    pub client: Mutex<Option<ModioClient>>,
}

// ── IPC Commands ────────────────────────────────────────────────────

/// Store the mod.io API key in the OS keyring and initialise the client.
#[tauri::command]
pub async fn cmd_modio_set_api_key(
    state: State<'_, ModioState>,
    api_key: String,
) -> Result<(), AppError> {
    credentials::store_credential(SERVICE, KEY_API_KEY, &api_key)?;

    let new_client = ModioClient::new(&api_key)?;
    let mut guard = state.client.lock().map_err(|e| {
        AppError::internal(format!("Failed to lock ModioState: {e}"))
    })?;
    *guard = Some(new_client);
    Ok(())
}

/// Check whether an API key is stored in the keyring.
#[tauri::command]
pub async fn cmd_modio_has_api_key() -> Result<bool, AppError> {
    let val = credentials::get_credential(SERVICE, KEY_API_KEY)?;
    Ok(val.is_some())
}

/// Check whether an OAuth2 token is stored in the keyring.
#[tauri::command]
pub async fn cmd_modio_has_oauth_token() -> Result<bool, AppError> {
    let val = credentials::get_credential(SERVICE, KEY_OAUTH_TOKEN)?;
    Ok(val.is_some())
}

/// Store an OAuth2 Access Token directly, validate it, and return the user profile.
///
/// This is the primary authentication path for third-party tools.
/// The user generates a token at <https://mod.io/me/access> with `read+write`
/// scope and pastes it here.  We validate by calling `GET /me`.
#[tauri::command]
pub async fn cmd_modio_set_oauth_token(
    state: State<'_, ModioState>,
    token: String,
) -> Result<ModioUserProfile, AppError> {
    let trimmed = token.trim().to_string();
    if trimmed.is_empty() {
        return Err(AppError::invalid_input("OAuth token must not be empty"));
    }

    // Build a token-only client and validate via /me
    let new_client = ModioClient::with_token_only(&trimmed)?;
    let profile = auth::get_user(new_client.http_client(), &trimmed).await?;

    // Persist token in keyring
    credentials::store_credential(SERVICE, KEY_OAUTH_TOKEN, &trimmed)?;
    // Clear any old API key — no longer needed
    let _ = credentials::delete_credential(SERVICE, KEY_API_KEY);

    // Install the client
    let mut guard = state.client.lock().map_err(|e| {
        AppError::internal(format!("Failed to lock ModioState: {e}"))
    })?;
    *guard = Some(new_client);

    Ok(profile)
}

/// Clear the stored mod.io API key and drop the client.
///
/// Unlike `cmd_modio_disconnect`, this only removes the API key and does NOT
/// attempt to revoke the OAuth token remotely. Use this when the user wants to
/// re-enter a different API key without going through the full disconnect flow.
#[tauri::command]
pub async fn cmd_modio_clear_api_key(
    state: State<'_, ModioState>,
) -> Result<(), AppError> {
    credentials::delete_credential(SERVICE, KEY_API_KEY)?;
    let _ = credentials::delete_credential(SERVICE, KEY_OAUTH_TOKEN);

    let mut guard = state.client.lock().map_err(|e| {
        AppError::internal(format!("Failed to lock ModioState: {e}"))
    })?;
    *guard = None;

    Ok(())
}

/// Start the email authentication flow — sends a security code to the user's email.
#[tauri::command]
pub async fn cmd_modio_connect(
    state: State<'_, ModioState>,
    email: String,
) -> Result<(), AppError> {
    let (client_ref, api_key) = {
        let guard = state.client.lock().map_err(|e| {
            AppError::internal(format!("Failed to lock ModioState: {e}"))
        })?;
        let c = guard.as_ref().ok_or_else(|| {
            AppError::invalid_input("mod.io API key not set — call cmd_modio_set_api_key first")
        })?;
        (c.http_client().clone(), c.api_key().to_string())
    };

    auth::email_request(&client_ref, &api_key, &email).await?;
    Ok(())
}

/// Exchange the emailed security code for an OAuth2 token.
///
/// On success the token is stored in the keyring and the user profile is returned.
#[tauri::command]
pub async fn cmd_modio_verify_code(
    state: State<'_, ModioState>,
    code: String,
) -> Result<ModioUserProfile, AppError> {
    let (client_ref, api_key) = {
        let guard = state.client.lock().map_err(|e| {
            AppError::internal(format!("Failed to lock ModioState: {e}"))
        })?;
        let c = guard.as_ref().ok_or_else(|| {
            AppError::invalid_input("mod.io API key not set")
        })?;
        (c.http_client().clone(), c.api_key().to_string())
    };

    // Exchange code for token
    let token = auth::email_exchange(&client_ref, &api_key, &code).await?;

    // Store token in keyring
    credentials::store_credential(SERVICE, KEY_OAUTH_TOKEN, &token)?;

    // Set token on client (upgrades rate limits)
    {
        let mut guard = state.client.lock().map_err(|e| {
            AppError::internal(format!("Failed to lock ModioState: {e}"))
        })?;
        if let Some(c) = guard.as_mut() {
            c.set_token(&token);
        }
    }

    // Fetch and return user profile
    let profile = auth::get_user(&client_ref, &token).await?;
    Ok(profile)
}

/// Disconnect from mod.io: revoke token, clear credentials, drop client.
#[tauri::command]
pub async fn cmd_modio_disconnect(
    state: State<'_, ModioState>,
) -> Result<(), AppError> {
    // Best-effort remote logout
    let maybe_token = {
        let guard = state.client.lock().map_err(|e| {
            AppError::internal(format!("Failed to lock ModioState: {e}"))
        })?;
        guard.as_ref().and_then(|c| {
            c.token().map(|t| (c.http_client().clone(), t.to_string()))
        })
    };

    if let Some((client_ref, token)) = maybe_token {
        let _ = auth::logout(&client_ref, &token).await;
    }

    // Clear local credentials
    credentials::delete_credential(SERVICE, KEY_API_KEY)?;
    credentials::delete_credential(SERVICE, KEY_OAUTH_TOKEN)?;

    // Drop client
    let mut guard = state.client.lock().map_err(|e| {
        AppError::internal(format!("Failed to lock ModioState: {e}"))
    })?;
    *guard = None;

    Ok(())
}

/// Fetch the authenticated user's profile.
#[tauri::command]
pub async fn cmd_modio_get_user(
    state: State<'_, ModioState>,
) -> Result<ModioUserProfile, AppError> {
    let (client_ref, token) = {
        let guard = state.client.lock().map_err(|e| {
            AppError::internal(format!("Failed to lock ModioState: {e}"))
        })?;
        let c = guard.as_ref().ok_or_else(|| {
            AppError::invalid_input("mod.io client not initialised")
        })?;
        let t = c.token().ok_or_else(|| {
            AppError::invalid_input("Not authenticated with mod.io — no OAuth2 token")
        })?;
        (c.http_client().clone(), t.to_string())
    };

    let profile = auth::get_user(&client_ref, &token).await?;
    Ok(profile)
}

/// List the authenticated user's mods for BG3 (or another game).
#[tauri::command]
pub async fn cmd_modio_get_my_mods(
    state: State<'_, ModioState>,
    game_id: Option<u64>,
) -> Result<Vec<ModioModSummary>, AppError> {
    let client_snapshot = {
        let guard = state.client.lock().map_err(|e| {
            AppError::internal(format!("Failed to lock ModioState: {e}"))
        })?;
        guard.as_ref().ok_or_else(|| {
            AppError::invalid_input("mod.io client not initialised")
        })?.clone_snapshot()
    };

    // Acquire read rate limit
    client_snapshot.read_limiter.acquire().await;

    let gid = game_id.unwrap_or(BG3_GAME_ID);
    let result = mods::get_my_mods(&client_snapshot, gid).await?;
    Ok(result)
}

/// Upload a file to an existing mod on mod.io.
#[tauri::command]
pub async fn cmd_modio_upload_file(
    app: tauri::AppHandle,
    state: State<'_, ModioState>,
    params: ModioUploadParams,
) -> Result<ModioModfileResponse, AppError> {
    let client_snapshot = {
        let guard = state.client.lock().map_err(|e| {
            AppError::internal(format!("Failed to lock ModioState: {e}"))
        })?;
        guard.as_ref().ok_or_else(|| {
            AppError::invalid_input("mod.io client not initialised")
        })?.clone_snapshot()
    };

    // Acquire write rate limit
    client_snapshot.write_limiter.acquire().await;

    let result = upload::upload_file(&client_snapshot, &params, &app).await?;
    Ok(result)
}

/// Try to auto-initialise the ModioClient from stored keyring credentials.
///
/// Called during app setup. Silently returns `Ok(())` if no credentials are found.
pub fn try_restore_client(state: &ModioState) -> Result<(), AppError> {
    let api_key = credentials::get_credential(SERVICE, KEY_API_KEY)?;
    let api_key = match api_key {
        Some(k) => k,
        None => return Ok(()),
    };

    let mut client = ModioClient::new(&api_key)?;

    if let Some(token) = credentials::get_credential(SERVICE, KEY_OAUTH_TOKEN)? {
        client.set_token(&token);
    }

    let mut guard = state.client.lock().map_err(|e| {
        AppError::internal(format!("Failed to lock ModioState: {e}"))
    })?;
    *guard = Some(client);
    Ok(())
}

// ── Mod Profile Management ──────────────────────────────────────────

/// Create a new mod profile on mod.io.
#[tauri::command]
pub async fn cmd_modio_create_mod(
    state: State<'_, ModioState>,
    params: CreateModParams,
) -> Result<ModioModResponse, AppError> {
    let client_snapshot = {
        let guard = state.client.lock().map_err(|e| {
            AppError::internal(format!("Failed to lock ModioState: {e}"))
        })?;
        guard.as_ref().ok_or_else(|| {
            AppError::invalid_input("mod.io client not initialised")
        })?.clone_snapshot()
    };

    client_snapshot.write_limiter.acquire().await;
    let result = manage::create_mod(&client_snapshot, &params).await?;
    Ok(result)
}

/// Edit an existing mod profile on mod.io.
#[tauri::command]
pub async fn cmd_modio_edit_mod(
    state: State<'_, ModioState>,
    params: EditModParams,
) -> Result<ModioModResponse, AppError> {
    let client_snapshot = {
        let guard = state.client.lock().map_err(|e| {
            AppError::internal(format!("Failed to lock ModioState: {e}"))
        })?;
        guard.as_ref().ok_or_else(|| {
            AppError::invalid_input("mod.io client not initialised")
        })?.clone_snapshot()
    };

    client_snapshot.write_limiter.acquire().await;
    let result = manage::edit_mod(&client_snapshot, &params).await?;
    Ok(result)
}

// ── Media Management ────────────────────────────────────────────────

/// Add images, logo, or YouTube links to a mod.
#[tauri::command]
pub async fn cmd_modio_add_media(
    state: State<'_, ModioState>,
    params: AddMediaParams,
) -> Result<(), AppError> {
    let client_snapshot = {
        let guard = state.client.lock().map_err(|e| {
            AppError::internal(format!("Failed to lock ModioState: {e}"))
        })?;
        guard.as_ref().ok_or_else(|| {
            AppError::invalid_input("mod.io client not initialised")
        })?.clone_snapshot()
    };

    client_snapshot.write_limiter.acquire().await;
    media::add_media(&client_snapshot, &params).await?;
    Ok(())
}

/// Delete images from a mod by filename.
#[tauri::command]
pub async fn cmd_modio_delete_media(
    state: State<'_, ModioState>,
    game_id: u64,
    mod_id: u64,
    filenames: Vec<String>,
) -> Result<(), AppError> {
    let client_snapshot = {
        let guard = state.client.lock().map_err(|e| {
            AppError::internal(format!("Failed to lock ModioState: {e}"))
        })?;
        guard.as_ref().ok_or_else(|| {
            AppError::invalid_input("mod.io client not initialised")
        })?.clone_snapshot()
    };

    client_snapshot.write_limiter.acquire().await;
    media::delete_media(&client_snapshot, game_id, mod_id, &filenames).await?;
    Ok(())
}

// ── File/Version Management ─────────────────────────────────────────

/// List all files for a mod.
#[tauri::command]
pub async fn cmd_modio_list_files(
    state: State<'_, ModioState>,
    game_id: Option<u64>,
    mod_id: u64,
) -> Result<Vec<ModioFileEntry>, AppError> {
    let client_snapshot = {
        let guard = state.client.lock().map_err(|e| {
            AppError::internal(format!("Failed to lock ModioState: {e}"))
        })?;
        guard.as_ref().ok_or_else(|| {
            AppError::invalid_input("mod.io client not initialised")
        })?.clone_snapshot()
    };

    client_snapshot.read_limiter.acquire().await;
    let gid = game_id.unwrap_or(BG3_GAME_ID);
    let result = files::list_files(&client_snapshot, gid, mod_id).await?;
    Ok(result)
}

/// Edit a modfile's metadata (version, changelog, active status).
#[tauri::command]
pub async fn cmd_modio_edit_file(
    state: State<'_, ModioState>,
    params: EditFileParams,
) -> Result<(), AppError> {
    let client_snapshot = {
        let guard = state.client.lock().map_err(|e| {
            AppError::internal(format!("Failed to lock ModioState: {e}"))
        })?;
        guard.as_ref().ok_or_else(|| {
            AppError::invalid_input("mod.io client not initialised")
        })?.clone_snapshot()
    };

    client_snapshot.write_limiter.acquire().await;
    files::edit_file(&client_snapshot, &params).await?;
    Ok(())
}

/// Delete a modfile.
#[tauri::command]
pub async fn cmd_modio_delete_file(
    state: State<'_, ModioState>,
    game_id: Option<u64>,
    mod_id: u64,
    file_id: u64,
) -> Result<(), AppError> {
    let client_snapshot = {
        let guard = state.client.lock().map_err(|e| {
            AppError::internal(format!("Failed to lock ModioState: {e}"))
        })?;
        guard.as_ref().ok_or_else(|| {
            AppError::invalid_input("mod.io client not initialised")
        })?.clone_snapshot()
    };

    client_snapshot.write_limiter.acquire().await;
    let gid = game_id.unwrap_or(BG3_GAME_ID);
    files::delete_file(&client_snapshot, gid, mod_id, file_id).await?;
    Ok(())
}

// ── Dependency Management ───────────────────────────────────────────

/// Get dependencies for a mod.
#[tauri::command]
pub async fn cmd_modio_get_dependencies(
    state: State<'_, ModioState>,
    game_id: Option<u64>,
    mod_id: u64,
) -> Result<Vec<ModioDependency>, AppError> {
    let client_snapshot = {
        let guard = state.client.lock().map_err(|e| {
            AppError::internal(format!("Failed to lock ModioState: {e}"))
        })?;
        guard.as_ref().ok_or_else(|| {
            AppError::invalid_input("mod.io client not initialised")
        })?.clone_snapshot()
    };

    client_snapshot.read_limiter.acquire().await;
    let gid = game_id.unwrap_or(BG3_GAME_ID);
    let result = deps::get_dependencies(&client_snapshot, gid, mod_id).await?;
    Ok(result)
}

/// Add dependencies to a mod.
#[tauri::command]
pub async fn cmd_modio_add_dependencies(
    state: State<'_, ModioState>,
    game_id: Option<u64>,
    mod_id: u64,
    dependency_ids: Vec<u64>,
) -> Result<(), AppError> {
    let client_snapshot = {
        let guard = state.client.lock().map_err(|e| {
            AppError::internal(format!("Failed to lock ModioState: {e}"))
        })?;
        guard.as_ref().ok_or_else(|| {
            AppError::invalid_input("mod.io client not initialised")
        })?.clone_snapshot()
    };

    client_snapshot.write_limiter.acquire().await;
    let gid = game_id.unwrap_or(BG3_GAME_ID);
    deps::add_dependencies(&client_snapshot, gid, mod_id, &dependency_ids).await?;
    Ok(())
}

/// Remove dependencies from a mod.
#[tauri::command]
pub async fn cmd_modio_remove_dependencies(
    state: State<'_, ModioState>,
    game_id: Option<u64>,
    mod_id: u64,
    dependency_ids: Vec<u64>,
) -> Result<(), AppError> {
    let client_snapshot = {
        let guard = state.client.lock().map_err(|e| {
            AppError::internal(format!("Failed to lock ModioState: {e}"))
        })?;
        guard.as_ref().ok_or_else(|| {
            AppError::invalid_input("mod.io client not initialised")
        })?.clone_snapshot()
    };

    client_snapshot.write_limiter.acquire().await;
    let gid = game_id.unwrap_or(BG3_GAME_ID);
    deps::remove_dependencies(&client_snapshot, gid, mod_id, &dependency_ids).await?;
    Ok(())
}

// ── Tag Management ──────────────────────────────────────────────────

/// Get available tag options for a game.
#[tauri::command]
pub async fn cmd_modio_get_game_tags(
    state: State<'_, ModioState>,
    game_id: Option<u64>,
) -> Result<Vec<TagOption>, AppError> {
    let client_snapshot = {
        let guard = state.client.lock().map_err(|e| {
            AppError::internal(format!("Failed to lock ModioState: {e}"))
        })?;
        guard.as_ref().ok_or_else(|| {
            AppError::invalid_input("mod.io client not initialised")
        })?.clone_snapshot()
    };

    client_snapshot.read_limiter.acquire().await;
    let gid = game_id.unwrap_or(BG3_GAME_ID);
    let result = tags::get_game_tags(&client_snapshot, gid).await?;
    Ok(result)
}

/// Add tags to a mod.
#[tauri::command]
pub async fn cmd_modio_add_tags(
    state: State<'_, ModioState>,
    game_id: Option<u64>,
    mod_id: u64,
    tags: Vec<String>,
) -> Result<(), AppError> {
    let client_snapshot = {
        let guard = state.client.lock().map_err(|e| {
            AppError::internal(format!("Failed to lock ModioState: {e}"))
        })?;
        guard.as_ref().ok_or_else(|| {
            AppError::invalid_input("mod.io client not initialised")
        })?.clone_snapshot()
    };

    client_snapshot.write_limiter.acquire().await;
    let gid = game_id.unwrap_or(BG3_GAME_ID);
    tags::add_tags(&client_snapshot, gid, mod_id, &tags).await?;
    Ok(())
}

/// Remove tags from a mod.
#[tauri::command]
pub async fn cmd_modio_remove_tags(
    state: State<'_, ModioState>,
    game_id: Option<u64>,
    mod_id: u64,
    tags: Vec<String>,
) -> Result<(), AppError> {
    let client_snapshot = {
        let guard = state.client.lock().map_err(|e| {
            AppError::internal(format!("Failed to lock ModioState: {e}"))
        })?;
        guard.as_ref().ok_or_else(|| {
            AppError::invalid_input("mod.io client not initialised")
        })?.clone_snapshot()
    };

    client_snapshot.write_limiter.acquire().await;
    let gid = game_id.unwrap_or(BG3_GAME_ID);
    tags::remove_tags(&client_snapshot, gid, mod_id, &tags).await?;
    Ok(())
}

// ── Metadata KVP ────────────────────────────────────────────────────

/// Get metadata key-value pairs for a mod.
#[tauri::command]
pub async fn cmd_modio_get_metadata(
    state: State<'_, ModioState>,
    game_id: Option<u64>,
    mod_id: u64,
) -> Result<Vec<MetadataEntry>, AppError> {
    let client_snapshot = {
        let guard = state.client.lock().map_err(|e| {
            AppError::internal(format!("Failed to lock ModioState: {e}"))
        })?;
        guard.as_ref().ok_or_else(|| {
            AppError::invalid_input("mod.io client not initialised")
        })?.clone_snapshot()
    };

    client_snapshot.read_limiter.acquire().await;
    let gid = game_id.unwrap_or(BG3_GAME_ID);
    let result = meta::get_metadata(&client_snapshot, gid, mod_id).await?;
    Ok(result)
}

/// Add metadata key-value pairs to a mod.
#[tauri::command]
pub async fn cmd_modio_add_metadata(
    state: State<'_, ModioState>,
    game_id: Option<u64>,
    mod_id: u64,
    entries: Vec<MetadataEntry>,
) -> Result<(), AppError> {
    let client_snapshot = {
        let guard = state.client.lock().map_err(|e| {
            AppError::internal(format!("Failed to lock ModioState: {e}"))
        })?;
        guard.as_ref().ok_or_else(|| {
            AppError::invalid_input("mod.io client not initialised")
        })?.clone_snapshot()
    };

    client_snapshot.write_limiter.acquire().await;
    let gid = game_id.unwrap_or(BG3_GAME_ID);
    meta::add_metadata(&client_snapshot, gid, mod_id, &entries).await?;
    Ok(())
}

/// Remove metadata key-value pairs from a mod.
#[tauri::command]
pub async fn cmd_modio_remove_metadata(
    state: State<'_, ModioState>,
    game_id: Option<u64>,
    mod_id: u64,
    entries: Vec<MetadataEntry>,
) -> Result<(), AppError> {
    let client_snapshot = {
        let guard = state.client.lock().map_err(|e| {
            AppError::internal(format!("Failed to lock ModioState: {e}"))
        })?;
        guard.as_ref().ok_or_else(|| {
            AppError::invalid_input("mod.io client not initialised")
        })?.clone_snapshot()
    };

    client_snapshot.write_limiter.acquire().await;
    let gid = game_id.unwrap_or(BG3_GAME_ID);
    meta::remove_metadata(&client_snapshot, gid, mod_id, &entries).await?;
    Ok(())
}
