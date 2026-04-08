use crate::blocking;
use crate::error::AppError;
use std::path::{Path, PathBuf};

/// Info about a script file on disk.
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

/// Validate and resolve a relative `file_path` against the mod root directory.
/// Rejects path-traversal attempts and paths that escape `mod_path`.
fn resolve_script_path(mod_path: &str, file_path: &str) -> Result<PathBuf, String> {
    if file_path.contains("..") || file_path.contains('\0') {
        return Err("Invalid path: traversal not allowed".into());
    }
    let root = PathBuf::from(mod_path);
    if !root.is_dir() {
        return Err(format!("Mod path is not a directory: {mod_path}"));
    }
    let full = root.join(file_path);
    let canon_root = root
        .canonicalize()
        .map_err(|e| format!("Canonicalize mod root: {e}"))?;
    // For existing paths canonicalize directly; for new paths check nearest ancestor.
    let check = if full.exists() {
        full.canonicalize()
            .map_err(|e| format!("Canonicalize: {e}"))?
    } else {
        let mut ancestor = full.parent().map(Path::to_path_buf);
        while let Some(ref a) = ancestor {
            if a.exists() {
                break;
            }
            ancestor = a.parent().map(Path::to_path_buf);
        }
        ancestor
            .unwrap_or_else(|| root.clone())
            .canonicalize()
            .map_err(|e| format!("Canonicalize ancestor: {e}"))?
    };
    if !check.starts_with(&canon_root) {
        return Err("Path escapes mod root".into());
    }
    Ok(full)
}

/// Render a template with `{{VAR}}` substitution and write it to disk.
/// Returns `Ok(true)` if created, `Ok(false)` if the file already exists (skipped).
fn write_template_file(
    mod_path: &str,
    file_path: &str,
    template_id: &str,
    variables: &std::collections::HashMap<String, String>,
) -> Result<bool, String> {
    let full = resolve_script_path(mod_path, file_path)?;
    if full.exists() {
        return Ok(false);
    }
    let template = get_script_template(template_id)
        .ok_or_else(|| format!("Unknown template: {template_id}"))?;
    let mut content = template.to_string();
    for (key, value) in variables {
        content = content.replace(&format!("{{{{{key}}}}}"), value);
    }
    if let Some(parent) = full.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Create directories: {e}"))?;
    }
    std::fs::write(&full, content.as_bytes()).map_err(|e| format!("Write file: {e}"))?;
    Ok(true)
}

/// Recursively collect files from a directory into `out`.
fn collect_files(
    root: &Path,
    dir: &Path,
    out: &mut Vec<ScriptFileInfo>,
) -> Result<(), String> {
    let entries = std::fs::read_dir(dir).map_err(|e| format!("Read dir: {e}"))?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("Dir entry: {e}"))?;
        let path = entry.path();
        if path.is_dir() {
            collect_files(root, &path, out)?;
        } else if path.is_file() {
            let rel = path
                .strip_prefix(root)
                .map_err(|e| format!("Strip prefix: {e}"))?
                .to_string_lossy()
                .replace('\\', "/");
            let size = path
                .metadata()
                .map(|m| m.len() as i64)
                .unwrap_or(0);
            out.push(ScriptFileInfo {
                path: rel,
                size,
                is_new: false,
                is_modified: false,
            });
        }
    }
    Ok(())
}

/// Read a script file from disk.
#[tauri::command]
pub async fn cmd_script_read(
    mod_path: String,
    file_path: String,
) -> Result<Option<String>, AppError> {
    blocking(move || {
        let full = resolve_script_path(&mod_path, &file_path)?;
        if !full.is_file() {
            return Ok(None);
        }
        std::fs::read_to_string(&full)
            .map(Some)
            .map_err(|e| format!("Read script: {e}"))
    })
    .await
}

/// Write a script file to disk (creates parent directories as needed).
#[tauri::command]
pub async fn cmd_script_write(
    mod_path: String,
    file_path: String,
    content: String,
) -> Result<bool, AppError> {
    blocking(move || {
        let full = resolve_script_path(&mod_path, &file_path)?;
        if let Some(parent) = full.parent() {
            std::fs::create_dir_all(parent).map_err(|e| format!("Create directories: {e}"))?;
        }
        std::fs::write(&full, content.as_bytes()).map_err(|e| format!("Write script: {e}"))?;
        Ok(true)
    })
    .await
}

/// Delete a script file from disk.
/// Returns `false` if the file does not exist.
#[tauri::command]
pub async fn cmd_script_delete(
    mod_path: String,
    file_path: String,
) -> Result<bool, AppError> {
    blocking(move || {
        let full = resolve_script_path(&mod_path, &file_path)?;
        if !full.is_file() {
            return Ok(false);
        }
        std::fs::remove_file(&full).map_err(|e| format!("Delete script: {e}"))?;
        Ok(true)
    })
    .await
}

/// List script files under a prefix on disk.
#[tauri::command]
pub async fn cmd_script_list(
    mod_path: String,
    prefix: Option<String>,
) -> Result<Vec<ScriptFileInfo>, AppError> {
    blocking(move || {
        let root = PathBuf::from(&mod_path);
        if !root.is_dir() {
            return Err(format!("Mod path is not a directory: {mod_path}"));
        }
        let walk_dir = if let Some(ref pfx) = prefix {
            root.join(pfx)
        } else {
            root.clone()
        };
        if !walk_dir.is_dir() {
            return Ok(Vec::new());
        }
        let mut files = Vec::new();
        collect_files(&root, &walk_dir, &mut files)?;
        Ok(files)
    })
    .await
}

/// Render a template with `{{VAR_NAME}}` substitution and write to disk.
#[tauri::command]
pub async fn cmd_script_create_from_template(
    mod_path: String,
    file_path: String,
    template_id: String,
    variables: std::collections::HashMap<String, String>,
) -> Result<bool, AppError> {
    blocking(move || {
        let full = resolve_script_path(&mod_path, &file_path)?;
        if full.exists() {
            return Err(format!("File already exists: {file_path}"));
        }
        let template = get_script_template(&template_id)
            .ok_or_else(|| format!("Unknown template: {template_id}"))?;
        let mut content = template.to_string();
        for (key, value) in &variables {
            content = content.replace(&format!("{{{{{key}}}}}"), value);
        }
        if let Some(parent) = full.parent() {
            std::fs::create_dir_all(parent).map_err(|e| format!("Create directories: {e}"))?;
        }
        std::fs::write(&full, content.as_bytes())
            .map_err(|e| format!("Write template file: {e}"))?;
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

/// Scaffold the SE directory structure on disk.
/// Creates Config.json and optionally BootstrapServer.lua / BootstrapClient.lua.
#[tauri::command]
pub async fn cmd_scaffold_se_structure(
    mod_path: String,
    mod_folder: String,
    include_server: bool,
    include_client: bool,
) -> Result<Vec<String>, AppError> {
    blocking(move || {
        let mod_table = sanitize_lua_identifier(&mod_folder);
        let base = format!("Mods/{mod_folder}/ScriptExtender");
        let mut created: Vec<String> = Vec::new();

        let mut vars = std::collections::HashMap::new();
        vars.insert("MOD_TABLE".to_string(), mod_table.clone());
        vars.insert("MOD_NAME".to_string(), mod_folder.clone());
        vars.insert("VAR_NAME".to_string(), mod_table.clone());

        // 1. Config.json
        let config_path = format!("{base}/Config.json");
        if write_template_file(&mod_path, &config_path, "se_config", &vars)? {
            created.push(config_path);
        }

        // 2. Server bootstrap
        if include_server {
            vars.insert("FILE_NAME".to_string(), "BootstrapServer.lua".to_string());
            let server_path = format!("{base}/Lua/BootstrapServer.lua");
            if write_template_file(&mod_path, &server_path, "se_bootstrap_server", &vars)? {
                created.push(server_path);
            }
        }

        // 3. Client bootstrap
        if include_client {
            vars.insert("FILE_NAME".to_string(), "BootstrapClient.lua".to_string());
            let client_path = format!("{base}/Lua/BootstrapClient.lua");
            if write_template_file(&mod_path, &client_path, "se_bootstrap_client", &vars)? {
                created.push(client_path);
            }
        }

        Ok(created)
    })
    .await
}

/// Scaffold the Khonsu Scripts/ directory structure on disk.
/// Creates a starter `.khn` condition file.
#[tauri::command]
pub async fn cmd_scaffold_khonsu_structure(
    mod_path: String,
    mod_folder: String,
) -> Result<Vec<String>, AppError> {
    blocking(move || {
        let base = format!("Mods/{mod_folder}/Scripts");
        let mut created: Vec<String> = Vec::new();

        let mut vars = std::collections::HashMap::new();
        vars.insert("MOD_NAME".to_string(), mod_folder.clone());
        vars.insert("FILE_NAME".to_string(), "basic_condition.khn".to_string());

        let file_path = format!("{base}/basic_condition.khn");
        if write_template_file(&mod_path, &file_path, "khonsu_basic_condition", &vars)? {
            created.push(file_path);
        }

        Ok(created)
    })
    .await
}

/// Scaffold the Osiris Story/RawFiles/Goals/ directory structure on disk.
/// Creates a starter goal file.
#[tauri::command]
pub async fn cmd_scaffold_osiris_structure(
    mod_path: String,
    mod_folder: String,
) -> Result<Vec<String>, AppError> {
    blocking(move || {
        let base = format!("Mods/{mod_folder}/Story/RawFiles/Goals");
        let mut created: Vec<String> = Vec::new();

        let mut vars = std::collections::HashMap::new();
        vars.insert("MOD_NAME".to_string(), mod_folder.clone());
        vars.insert("FILE_NAME".to_string(), "MyGoal.txt".to_string());
        vars.insert("GOAL_NAME".to_string(), "MyGoal".to_string());

        let file_path = format!("{base}/MyGoal.txt");
        if write_template_file(&mod_path, &file_path, "osiris_basic_goal", &vars)? {
            created.push(file_path);
        }

        Ok(created)
    })
    .await
}
