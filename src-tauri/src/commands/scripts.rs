use crate::blocking;
use crate::error::AppError;
use std::path::PathBuf;

/// Info about a script file in the staging DB.
#[derive(serde::Serialize, Clone)]
pub struct ScriptFileInfo {
    pub path: String,
    pub size: i64,
    pub is_new: bool,
    pub is_modified: bool,
}

/// Built-in script templates.
fn get_script_template(template_id: &str) -> Option<&'static str> {
    match template_id {
        "lua_empty" => Some("-- {{FILE_NAME}}\n-- Created by CMTY Studio\n\n"),
        "lua_se_bootstrap" => Some("-- {{FILE_NAME}}\n-- Script Extender bootstrap\n\nExt.Vars.RegisterModVariable(\n    ModuleUUID,\n    \"{{VAR_NAME}}\",\n    {\n        Server = true,\n        Client = true,\n        SyncToClient = true,\n    }\n)\n"),
        "osiris_goal" => Some(include_str!("../../resources/templates/osiris_basic_goal.txt")),
        "osiris_basic_goal" => Some(include_str!("../../resources/templates/osiris_basic_goal.txt")),
        "osiris_state_machine" => Some(include_str!("../../resources/templates/osiris_state_machine.txt")),
        "osiris_quest_goal" => Some(include_str!("../../resources/templates/osiris_quest_goal.txt")),
        "khonsu_empty" => Some(include_str!("../../resources/templates/khonsu_basic_condition.khn")),
        "khonsu_basic_condition" => Some(include_str!("../../resources/templates/khonsu_basic_condition.khn")),
        "khonsu_context_condition" => Some(include_str!("../../resources/templates/khonsu_context_condition.khn")),
        "anubis_empty" => Some("-- {{FILE_NAME}}\n-- Anubis state script\n\nlocal State = {}\n\nfunction State:OnCreate()\n    -- Initialize state\nend\n\nfunction State:OnActivate()\n    -- Called when state becomes active\nend\n\nreturn State\n"),
        "constellations_empty" => Some("-- {{FILE_NAME}}\n-- Constellations config script\n\nlocal Config = {}\n\nfunction Config:Register()\n    -- Register handlers\nend\n\nreturn Config\n"),
        "se_config" => Some(include_str!("../../resources/templates/se_config.json")),
        "se_bootstrap_server" => Some(include_str!("../../resources/templates/se_bootstrap_server.lua")),
        "se_bootstrap_client" => Some(include_str!("../../resources/templates/se_bootstrap_client.lua")),
        "lua_se_server_module" => Some(include_str!("../../resources/templates/se_server_module.lua")),
        "lua_se_client_module" => Some(include_str!("../../resources/templates/se_client_module.lua")),
        "lua_se_shared_module" => Some(include_str!("../../resources/templates/se_shared_module.lua")),
        _ => None,
    }
}

/// Read a script file from the staging authoring table.
#[tauri::command]
pub async fn cmd_script_read(
    db_path: String,
    file_path: String,
) -> Result<Option<String>, AppError> {
    blocking(move || {
        let db = PathBuf::from(&db_path);
        if !db.is_file() {
            return Err(format!("Staging database not found: {db_path}"));
        }
        let conn = rusqlite::Connection::open(&db)
            .map_err(|e| format!("Open staging DB: {e}"))?;
        let mut stmt = conn
            .prepare("SELECT value FROM _staging_authoring WHERE key = ?1 AND _is_deleted = 0")
            .map_err(|e| format!("Prepare read: {e}"))?;
        let result: Option<String> = stmt
            .query_row(rusqlite::params![file_path], |row| row.get(0))
            .ok();
        Ok(result)
    })
    .await
}

/// Write (insert or update) a script file in the staging authoring table.
/// Sets _is_modified=1 (preserves _is_new=1 if already set).
#[tauri::command]
pub async fn cmd_script_write(
    db_path: String,
    file_path: String,
    content: String,
) -> Result<bool, AppError> {
    blocking(move || {
        let db = PathBuf::from(&db_path);
        if !db.is_file() {
            return Err(format!("Staging database not found: {db_path}"));
        }
        let conn = rusqlite::Connection::open(&db)
            .map_err(|e| format!("Open staging DB: {e}"))?;

        // Check if row exists and what its current state is
        let existing: Option<(bool, Option<String>)> = conn
            .prepare("SELECT _is_new, _original_hash FROM _staging_authoring WHERE key = ?1")
            .map_err(|e| format!("Prepare check: {e}"))?
            .query_row(rusqlite::params![file_path], |row| {
                Ok((row.get::<_, bool>(0)?, row.get::<_, Option<String>>(1)?))
            })
            .ok();

        if let Some((_is_new, _original_hash)) = existing {
            // Update existing — preserve _is_new if set
            conn.execute(
                "UPDATE _staging_authoring SET value = ?1, _is_modified = CASE WHEN _is_new = 1 THEN 0 ELSE 1 END, _is_deleted = 0 WHERE key = ?2",
                rusqlite::params![content, file_path],
            ).map_err(|e| format!("Update script: {e}"))?;
        } else {
            // Compute hash for new content
            use std::collections::hash_map::DefaultHasher;
            use std::hash::{Hash, Hasher};
            let mut hasher = DefaultHasher::new();
            content.hash(&mut hasher);
            let hash = format!("{:016x}", hasher.finish());

            // Insert new row
            conn.execute(
                "INSERT INTO _staging_authoring (key, value, _is_new, _is_modified, _is_deleted, _original_hash) VALUES (?1, ?2, 0, 1, 0, ?3)",
                rusqlite::params![file_path, content, hash],
            ).map_err(|e| format!("Insert script: {e}"))?;
        }

        Ok(true)
    })
    .await
}

/// Soft-delete a script file (_is_deleted=1).
/// Returns false if the file doesn't exist.
#[tauri::command]
pub async fn cmd_script_delete(
    db_path: String,
    file_path: String,
) -> Result<bool, AppError> {
    blocking(move || {
        let db = PathBuf::from(&db_path);
        if !db.is_file() {
            return Err(format!("Staging database not found: {db_path}"));
        }
        let conn = rusqlite::Connection::open(&db)
            .map_err(|e| format!("Open staging DB: {e}"))?;
        let affected = conn
            .execute(
                "UPDATE _staging_authoring SET _is_deleted = 1 WHERE key = ?1",
                rusqlite::params![file_path],
            )
            .map_err(|e| format!("Delete script: {e}"))?;
        Ok(affected > 0)
    })
    .await
}

/// List script files by path prefix with size info.
#[tauri::command]
pub async fn cmd_script_list(
    db_path: String,
    prefix: Option<String>,
) -> Result<Vec<ScriptFileInfo>, AppError> {
    blocking(move || {
        let db = PathBuf::from(&db_path);
        if !db.is_file() {
            return Err(format!("Staging database not found: {db_path}"));
        }
        let conn = rusqlite::Connection::open(&db)
            .map_err(|e| format!("Open staging DB: {e}"))?;

        let collect_rows = |stmt: &mut rusqlite::Statement, params: &[&dyn rusqlite::types::ToSql]| -> Result<Vec<ScriptFileInfo>, String> {
            stmt
                .query_map(params, |row| {
                    Ok(ScriptFileInfo {
                        path: row.get(0)?,
                        size: row.get(1)?,
                        is_new: row.get(2)?,
                        is_modified: row.get(3)?,
                    })
                })
                .map_err(|e| format!("Query list: {e}"))?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| format!("Collect list: {e}"))
        };

        if let Some(ref pfx) = prefix {
            // Escape LIKE special characters in the prefix
            let escaped = pfx.replace('%', "\\%").replace('_', "\\_");
            let pattern = format!("{escaped}%");
            let mut stmt = conn.prepare(
                "SELECT key, length(value), _is_new, _is_modified FROM _staging_authoring WHERE key LIKE ?1 ESCAPE '\\' AND _is_deleted = 0"
            ).map_err(|e| format!("Prepare list: {e}"))?;
            collect_rows(&mut stmt, &[&pattern])
        } else {
            let mut stmt = conn.prepare(
                "SELECT key, length(value), _is_new, _is_modified FROM _staging_authoring WHERE _is_deleted = 0"
            ).map_err(|e| format!("Prepare list: {e}"))?;
            collect_rows(&mut stmt, &[])
        }
    })
    .await
}

/// Render a template with {{VAR_NAME}} substitution and insert as new script file.
#[tauri::command]
pub async fn cmd_script_create_from_template(
    db_path: String,
    file_path: String,
    template_id: String,
    variables: std::collections::HashMap<String, String>,
) -> Result<bool, AppError> {
    blocking(move || {
        let db = PathBuf::from(&db_path);
        if !db.is_file() {
            return Err(format!("Staging database not found: {db_path}"));
        }

        // Get template content from the built-in templates
        let template = get_script_template(&template_id)
            .ok_or_else(|| format!("Unknown template: {template_id}"))?;

        // Replace {{VAR_NAME}} placeholders
        let mut content = template.to_string();
        for (key, value) in &variables {
            content = content.replace(&format!("{{{{{key}}}}}"), value);
        }

        let conn = rusqlite::Connection::open(&db)
            .map_err(|e| format!("Open staging DB: {e}"))?;

        // Check if file already exists
        let exists: bool = conn
            .prepare("SELECT COUNT(*) FROM _staging_authoring WHERE key = ?1")
            .map_err(|e| format!("Prepare check: {e}"))?
            .query_row(rusqlite::params![file_path], |row| row.get::<_, i64>(0))
            .map_err(|e| format!("Check existing: {e}"))? > 0;

        if exists {
            return Err(format!("Script file already exists: {file_path}"));
        }

        // Compute hash
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        let mut hasher = DefaultHasher::new();
        content.hash(&mut hasher);
        let hash = format!("{:016x}", hasher.finish());

        conn.execute(
            "INSERT INTO _staging_authoring (key, value, _is_new, _is_modified, _is_deleted, _original_hash) VALUES (?1, ?2, 1, 0, 0, ?3)",
            rusqlite::params![file_path, content, hash],
        ).map_err(|e| format!("Insert from template: {e}"))?;

        Ok(true)
    })
    .await
}

/// Sanitize a string to a valid Lua identifier (replace non-alphanumeric with `_`, strip leading digits).
fn sanitize_lua_identifier(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for ch in s.chars() {
        if ch.is_ascii_alphanumeric() || ch == '_' {
            out.push(ch);
        } else {
            out.push('_');
        }
    }
    // Strip leading digits/underscores so the result starts with a letter
    let trimmed = out.trim_start_matches(|c: char| c.is_ascii_digit() || c == '_');
    if trimmed.is_empty() {
        "ModTable".to_string()
    } else {
        trimmed.to_string()
    }
}

/// Helper: render a template with variable substitution and insert into the staging DB.
/// Returns `Ok(true)` if inserted, `Ok(false)` if the file already exists (skipped).
fn insert_template_file(
    conn: &rusqlite::Connection,
    file_path: &str,
    template_id: &str,
    variables: &std::collections::HashMap<String, String>,
) -> Result<bool, String> {
    // Check if file already exists
    let exists: bool = conn
        .prepare("SELECT COUNT(*) FROM _staging_authoring WHERE key = ?1 AND _is_deleted = 0")
        .map_err(|e| format!("Prepare check: {e}"))?
        .query_row(rusqlite::params![file_path], |row| row.get::<_, i64>(0))
        .map_err(|e| format!("Check existing: {e}"))? > 0;

    if exists {
        return Ok(false);
    }

    let template = get_script_template(template_id)
        .ok_or_else(|| format!("Unknown template: {template_id}"))?;

    let mut content = template.to_string();
    for (key, value) in variables {
        content = content.replace(&format!("{{{{{key}}}}}"), value);
    }

    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    content.hash(&mut hasher);
    let hash = format!("{:016x}", hasher.finish());

    conn.execute(
        "INSERT INTO _staging_authoring (key, value, _is_new, _is_modified, _is_deleted, _original_hash) VALUES (?1, ?2, 1, 0, 0, ?3)",
        rusqlite::params![file_path, content, hash],
    ).map_err(|e| format!("Insert template file: {e}"))?;

    Ok(true)
}

/// Scaffold the SE directory structure in the staging DB.
/// Creates Config.json and optionally BootstrapServer.lua / BootstrapClient.lua.
#[tauri::command]
pub async fn cmd_scaffold_se_structure(
    db_path: String,
    mod_folder: String,
    include_server: bool,
    include_client: bool,
) -> Result<Vec<String>, AppError> {
    blocking(move || {
        let db = PathBuf::from(&db_path);
        if !db.is_file() {
            return Err(format!("Staging database not found: {db_path}"));
        }
        let conn = rusqlite::Connection::open(&db)
            .map_err(|e| format!("Open staging DB: {e}"))?;

        let mod_table = sanitize_lua_identifier(&mod_folder);
        let base = format!("Mods/{mod_folder}/ScriptExtender");
        let mut created: Vec<String> = Vec::new();

        let mut vars = std::collections::HashMap::new();
        vars.insert("MOD_TABLE".to_string(), mod_table.clone());
        vars.insert("MOD_NAME".to_string(), mod_folder.clone());
        vars.insert("VAR_NAME".to_string(), mod_table.clone());

        // 1. Config.json
        let config_path = format!("{base}/Config.json");
        if insert_template_file(&conn, &config_path, "se_config", &vars)? {
            created.push(config_path);
        }

        // 2. Server bootstrap
        if include_server {
            vars.insert("FILE_NAME".to_string(), "BootstrapServer.lua".to_string());
            let server_path = format!("{base}/Lua/BootstrapServer.lua");
            if insert_template_file(&conn, &server_path, "se_bootstrap_server", &vars)? {
                created.push(server_path);
            }
        }

        // 3. Client bootstrap
        if include_client {
            vars.insert("FILE_NAME".to_string(), "BootstrapClient.lua".to_string());
            let client_path = format!("{base}/Lua/BootstrapClient.lua");
            if insert_template_file(&conn, &client_path, "se_bootstrap_client", &vars)? {
                created.push(client_path);
            }
        }

        Ok(created)
    })
    .await
}
