//! Tauri commands for forge operations (GitHub, GitLab, Gitea/Codeberg).

use crate::commands::secure_storage::{get_secure_setting, set_secure_setting};
use crate::git::forge::{detect_forge, ForgeAdapter};
use crate::git::forge_gitea::GiteaAdapter;
use crate::git::forge_github::GitHubAdapter;
use crate::git::forge_gitlab::GitLabAdapter;
use crate::git::types::*;

/// Enum dispatcher — avoids dyn-incompatible async trait methods.
enum Adapter {
    GitHub(GitHubAdapter),
    GitLab(GitLabAdapter),
    Gitea(GiteaAdapter),
}

fn get_adapter(forge_type: &ForgeType, host: &str, api_base: &str) -> Result<Adapter, String> {
    match forge_type {
        ForgeType::GitHub => Ok(Adapter::GitHub(GitHubAdapter::new())),
        ForgeType::GitLab => Ok(Adapter::GitLab(GitLabAdapter::new(host))),
        ForgeType::Gitea => Ok(Adapter::Gitea(GiteaAdapter::new(host, api_base))),
        ForgeType::Unknown => Err(
            "Unknown forge type — forge features are not available for this remote".to_string(),
        ),
    }
}

/// Dispatch macro to avoid repeating match arms for every method call.
macro_rules! dispatch {
    ($adapter:expr, $method:ident ( $($arg:expr),* )) => {
        match $adapter {
            Adapter::GitHub(a) => a.$method($($arg),*).await,
            Adapter::GitLab(a) => a.$method($($arg),*).await,
            Adapter::Gitea(a) => a.$method($($arg),*).await,
        }
    };
}

/// Token keyring key: `forge_token:{host}` — e.g. `forge_token:github.com`
fn token_key(host: &str) -> String {
    format!("forge_token:{}", host)
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn cmd_forge_detect(remote_url: String) -> Result<ForgeInfo, String> {
    Ok(detect_forge(&remote_url))
}

#[tauri::command]
pub async fn cmd_forge_auth_status(
    host: String,
    forge_type: ForgeType,
    api_base: String,
) -> Result<Option<ForgeUser>, String> {
    let token = get_secure_setting(&token_key(&host))?;
    if token.is_empty() {
        return Ok(None);
    }
    let adapter = get_adapter(&forge_type, &host, &api_base)?;
    match dispatch!(adapter, validate_token(&token)) {
        Ok(user) => Ok(Some(user)),
        Err(_) => Ok(None), // Token invalid/expired — treat as not connected
    }
}

#[tauri::command]
pub async fn cmd_forge_set_token(
    host: String,
    forge_type: ForgeType,
    api_base: String,
    token: String,
) -> Result<ForgeUser, String> {
    let adapter = get_adapter(&forge_type, &host, &api_base)?;
    let user = dispatch!(adapter, validate_token(&token))
        .map_err(|e| format!("Token validation failed: {}", e))?;
    set_secure_setting(&token_key(&host), &token)?;
    Ok(user)
}

#[tauri::command]
pub fn cmd_forge_clear_token(host: String) -> Result<(), String> {
    set_secure_setting(&token_key(&host), "")
}

#[tauri::command]
pub async fn cmd_forge_list_repos(
    host: String,
    forge_type: ForgeType,
    api_base: String,
    page: u32,
) -> Result<Vec<ForgeRepo>, String> {
    let token = get_secure_setting(&token_key(&host))?;
    if token.is_empty() {
        return Err("Not authenticated".to_string());
    }
    let adapter = get_adapter(&forge_type, &host, &api_base)?;
    dispatch!(adapter, list_repos(&token, page))
}

#[tauri::command]
pub async fn cmd_forge_create_repo(
    host: String,
    forge_type: ForgeType,
    api_base: String,
    name: String,
    description: String,
    private: bool,
) -> Result<ForgeRepo, String> {
    let token = get_secure_setting(&token_key(&host))?;
    if token.is_empty() {
        return Err("Not authenticated".to_string());
    }
    let adapter = get_adapter(&forge_type, &host, &api_base)?;
    dispatch!(adapter, create_repo(&token, &name, &description, private))
}

#[tauri::command]
pub async fn cmd_forge_list_prs(
    host: String,
    forge_type: ForgeType,
    api_base: String,
    owner: String,
    repo: String,
    state: String,
) -> Result<Vec<ForgePR>, String> {
    let token = get_secure_setting(&token_key(&host))?;
    if token.is_empty() {
        return Err("Not authenticated".to_string());
    }
    let adapter = get_adapter(&forge_type, &host, &api_base)?;
    dispatch!(adapter, list_prs(&token, &owner, &repo, &state))
}

#[tauri::command]
pub async fn cmd_forge_create_pr(
    host: String,
    forge_type: ForgeType,
    api_base: String,
    owner: String,
    repo: String,
    title: String,
    body: String,
    head: String,
    base: String,
) -> Result<ForgePR, String> {
    let token = get_secure_setting(&token_key(&host))?;
    if token.is_empty() {
        return Err("Not authenticated".to_string());
    }
    let adapter = get_adapter(&forge_type, &host, &api_base)?;
    dispatch!(adapter, create_pr(&token, &owner, &repo, &title, &body, &head, &base))
}

#[tauri::command]
pub async fn cmd_forge_list_issues(
    host: String,
    forge_type: ForgeType,
    api_base: String,
    owner: String,
    repo: String,
    state: String,
) -> Result<Vec<ForgeIssue>, String> {
    let token = get_secure_setting(&token_key(&host))?;
    if token.is_empty() {
        return Err("Not authenticated".to_string());
    }
    let adapter = get_adapter(&forge_type, &host, &api_base)?;
    dispatch!(adapter, list_issues(&token, &owner, &repo, &state))
}

#[tauri::command]
pub async fn cmd_forge_create_issue(
    host: String,
    forge_type: ForgeType,
    api_base: String,
    owner: String,
    repo: String,
    title: String,
    body: String,
) -> Result<ForgeIssue, String> {
    let token = get_secure_setting(&token_key(&host))?;
    if token.is_empty() {
        return Err("Not authenticated".to_string());
    }
    let adapter = get_adapter(&forge_type, &host, &api_base)?;
    dispatch!(adapter, create_issue(&token, &owner, &repo, &title, &body))
}
