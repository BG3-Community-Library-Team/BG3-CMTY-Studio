//! Nexus Mods file dependency management.
//!
//! Dependencies link Nexus mod files to other mods they require.
//! Uses the Experimental endpoints at `/mod-files/{id}/dependencies`.

use serde::{Deserialize, Serialize};

use crate::platform::errors::PlatformError;

use super::client::NexusClient;

/// A dependency entry from the Nexus API.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NexusDependency {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub mod_id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub version: String,
}

/// Fetch dependencies for a mod file.
///
/// `GET /mod-files/{file_id}/dependencies`
pub async fn get_dependencies(
    client: &NexusClient,
    file_id: &str,
) -> Result<Vec<NexusDependency>, PlatformError> {
    let path = format!("/mod-files/{file_id}/dependencies");
    let resp = client.get(&path).await?;
    let deps: Vec<NexusDependency> = resp
        .json()
        .await
        .map_err(|e| PlatformError::HttpError(format!("Failed to parse dependencies: {e}")))?;
    Ok(deps)
}

/// Replace all dependencies for a mod file.
///
/// `PUT /mod-files/{file_id}/dependencies`
pub async fn set_dependencies(
    client: &NexusClient,
    file_id: &str,
    dependency_mod_ids: &[String],
) -> Result<(), PlatformError> {
    let path = format!("/mod-files/{file_id}/dependencies");
    let body = serde_json::json!({
        "dependencies": dependency_mod_ids,
    });
    client.put_json(&path, &body).await?;
    Ok(())
}
