//! Tauri IPC commands for Nexus Mods integration.

use std::sync::Mutex;

use tauri::State;

use crate::error::AppError;
use crate::platform::credentials;
use crate::platform::errors::PlatformError;

use super::client::NexusClient;
use super::mod_files::FileUpdateGroup;
use super::mods::NexusModDetails;
use super::upload::NexusUploadParams;

/// Keyring service/username for the Nexus API key.
const NEXUS_SERVICE: &str = "nexus";
const NEXUS_USERNAME: &str = "nexus-api-key";

/// Managed state holding the optional, lazily-initialised Nexus client.
pub struct NexusState {
    pub client: Mutex<Option<NexusClient>>,
}

// ── API Key Management ───────────────────────────────────────────────

/// Store a Nexus API key in the OS keyring and initialise the client.
#[tauri::command]
pub async fn cmd_nexus_set_api_key(
    state: State<'_, NexusState>,
    api_key: String,
) -> Result<(), AppError> {
    if api_key.trim().is_empty() {
        return Err(PlatformError::ValidationError("API key must not be empty".into()).into());
    }

    let key = api_key.trim().to_string();

    // Store in keyring (blocking I/O — run on blocking pool).
    let key_clone = key.clone();
    crate::blocking(move || {
        credentials::store_credential(NEXUS_SERVICE, NEXUS_USERNAME, &key_clone)
            .map_err(|e| e.to_string())
    })
    .await?;

    // Create and store the client.
    let client = NexusClient::new(&key)?;
    let mut guard = state
        .client
        .lock()
        .map_err(|_| AppError::internal("NexusState lock poisoned"))?;
    *guard = Some(client);

    Ok(())
}

/// Delete the stored Nexus API key and tear down the client.
#[tauri::command]
pub async fn cmd_nexus_clear_api_key(
    state: State<'_, NexusState>,
) -> Result<(), AppError> {
    crate::blocking(move || {
        credentials::delete_credential(NEXUS_SERVICE, NEXUS_USERNAME).map_err(|e| e.to_string())
    })
    .await?;

    let mut guard = state
        .client
        .lock()
        .map_err(|_| AppError::internal("NexusState lock poisoned"))?;
    *guard = None;

    Ok(())
}

/// Check whether a Nexus API key is stored (does not reveal it).
#[tauri::command]
pub async fn cmd_nexus_has_api_key() -> Result<bool, AppError> {
    crate::blocking(move || {
        credentials::get_credential(NEXUS_SERVICE, NEXUS_USERNAME)
            .map(|opt| opt.is_some())
            .map_err(|e| e.to_string())
    })
    .await
}

/// Validate the stored API key by making a lightweight API call.
///
/// Returns `true` if the key is valid, `false` if authentication fails.
/// Other errors (network, timeout) propagate as `AppError`.
#[tauri::command]
pub async fn cmd_nexus_validate_api_key(
    state: State<'_, NexusState>,
) -> Result<bool, AppError> {
    let client = get_client(&state)?;

    match client.get("/users/validate").await {
        Ok(_) => Ok(true),
        Err(PlatformError::ApiError { status: 401, .. }) => Ok(false),
        Err(PlatformError::ApiError { status: 403, .. }) => Ok(false),
        Err(e) => Err(e.into()),
    }
}

// ── Mod Resolution ───────────────────────────────────────────────────

/// Resolve a Nexus mod from a URL, partial path, or bare numeric ID.
#[tauri::command]
pub async fn cmd_nexus_resolve_mod(
    state: State<'_, NexusState>,
    url_or_id: String,
) -> Result<NexusModDetails, AppError> {
    let client = get_client(&state)?;
    super::mods::resolve_mod(&client, &url_or_id)
        .await
        .map_err(AppError::from)
}

// ── File Update Groups ───────────────────────────────────────────────

/// Fetch file-update groups for a mod.
#[tauri::command]
pub async fn cmd_nexus_get_file_groups(
    state: State<'_, NexusState>,
    mod_uuid: String,
) -> Result<Vec<FileUpdateGroup>, AppError> {
    let client = get_client(&state)?;
    super::mod_files::get_file_groups(&client, &mod_uuid)
        .await
        .map_err(AppError::from)
}

// ── File Upload ──────────────────────────────────────────────────────

/// Upload a file to Nexus as a new version in a file-update group.
#[tauri::command]
pub async fn cmd_nexus_upload_file(
    app: tauri::AppHandle,
    state: State<'_, NexusState>,
    params: NexusUploadParams,
) -> Result<(), AppError> {
    let client = get_client(&state)?;
    super::upload::upload_file(&client, &params, &app)
        .await
        .map_err(AppError::from)
}

// ── New Mod File Creation (AG7) ──────────────────────────────────────

/// Create a new mod file entry on Nexus from a completed upload.
#[tauri::command]
pub async fn cmd_nexus_create_mod_file(
    state: State<'_, NexusState>,
    mod_uuid: String,
    upload_id: String,
    name: String,
    version: String,
    description: String,
    category: String,
) -> Result<(), AppError> {
    let client = get_client(&state)?;
    super::mod_files::create_mod_file(
        &client, &mod_uuid, &upload_id, &name, &version, &description, &category,
    )
    .await
    .map_err(AppError::from)
}

// ── Helpers ──────────────────────────────────────────────────────────

/// Extract the NexusClient from managed state, returning a user-friendly error
/// if no API key has been configured.
fn get_client(state: &State<'_, NexusState>) -> Result<NexusClient, AppError> {
    // NexusClient is not Clone — we need to recreate from stored key.
    // Instead, we hold the lock only briefly to check presence, then
    // clone is not needed because we use the reference within the lock scope.
    // However, since we need to return an owned type for async use,
    // we'll recreate the client from the keyring credential.
    let guard = state
        .client
        .lock()
        .map_err(|_| AppError::internal("NexusState lock poisoned"))?;

    if guard.is_none() {
        return Err(AppError::invalid_input(
            "No Nexus API key configured. Please add your API key in Settings > Publishing.",
        ));
    }
    drop(guard);

    // Re-read the key from keyring to create a fresh client for this request.
    // This avoids holding the Mutex across an async boundary.
    let key = credentials::get_credential(NEXUS_SERVICE, NEXUS_USERNAME)
        .map_err(AppError::from)?
        .ok_or_else(|| {
            AppError::invalid_input(
                "Nexus API key not found in keyring. Please re-enter your API key.",
            )
        })?;

    NexusClient::new(&key).map_err(AppError::from)
}

/// Try to auto-initialise the Nexus client from a stored keyring credential.
///
/// Called during app setup. Logs warnings on failure but never panics.
pub fn try_auto_init(state: &NexusState) {
    match credentials::get_credential(NEXUS_SERVICE, NEXUS_USERNAME) {
        Ok(Some(key)) => match NexusClient::new(&key) {
            Ok(client) => {
                if let Ok(mut guard) = state.client.lock() {
                    *guard = Some(client);
                    tracing::info!("Nexus client auto-initialised from stored API key");
                }
            }
            Err(e) => {
                tracing::warn!("Failed to create Nexus client from stored key: {e}");
            }
        },
        Ok(None) => {
            tracing::debug!("No stored Nexus API key — client not initialised");
        }
        Err(e) => {
            tracing::warn!("Failed to read Nexus keyring credential: {e}");
        }
    }
}
