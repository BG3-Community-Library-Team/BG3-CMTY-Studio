//! Nexus Mods file-update-group queries and mod file creation.

use serde::Serialize;

use crate::platform::errors::PlatformError;

use super::client::NexusClient;

/// A file-update group within a Nexus mod.
#[derive(Debug, Clone, Serialize)]
pub struct FileUpdateGroup {
    pub id: u64,
    pub name: String,
    pub version_count: u32,
    pub last_upload: Option<String>,
}

/// Fetch file-update groups for a mod (by UUID).
///
/// `GET /mods/{uuid}/file-update-groups`
pub async fn get_file_groups(
    client: &NexusClient,
    mod_uuid: &str,
) -> Result<Vec<FileUpdateGroup>, PlatformError> {
    let path = format!("/mods/{mod_uuid}/file-update-groups");
    let resp = client.get(&path).await?;

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| PlatformError::HttpError(format!("Failed to parse file-groups response: {e}")))?;

    // The API may return `{ "file_update_groups": [...] }` or a bare array.
    let items = if let Some(arr) = json.as_array() {
        arr.clone()
    } else if let Some(arr) = json.get("file_update_groups").and_then(|v| v.as_array()) {
        arr.clone()
    } else {
        return Err(PlatformError::ApiError {
            status: 200,
            message: "Unexpected file-groups response format".into(),
        });
    };

    let groups = items
        .iter()
        .filter_map(|item| {
            let id = item["id"].as_u64()?;
            let name = item["name"].as_str().unwrap_or("Unnamed").to_string();
            let version_count = item["version_count"]
                .as_u64()
                .or_else(|| item["versions_count"].as_u64())
                .unwrap_or(0) as u32;
            let last_upload = item["last_upload"]
                .as_str()
                .or_else(|| item["updated_at"].as_str())
                .map(String::from);
            Some(FileUpdateGroup {
                id,
                name,
                version_count,
                last_upload,
            })
        })
        .collect();

    Ok(groups)
}

/// Create a new mod file entry on Nexus.
///
/// `POST /mod-files` with the given metadata.
pub async fn create_mod_file(
    client: &NexusClient,
    mod_uuid: &str,
    upload_id: &str,
    name: &str,
    version: &str,
    description: &str,
    category: &str,
) -> Result<(), PlatformError> {
    let body = serde_json::json!({
        "mod_id": mod_uuid,
        "upload_id": upload_id,
        "name": name,
        "version": version,
        "description": description,
        "category": category,
    });

    client.post_json("/mod-files", &body).await?;
    Ok(())
}
