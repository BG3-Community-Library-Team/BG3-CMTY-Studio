//! Khonsu condition file export handler.
//!
//! Implements [`FileTypeHandler`] for exporting `.khn` condition scripts
//! from `_staging_authoring` entries matching `Scripts/thoth/helpers/%.khn`.

use std::path::PathBuf;

use crate::error::AppError;

use super::{
    ExportContext, ExportUnit, FileAction, FileTypeHandler, HandlerWarning, WarningSeverity,
};

/// Well-known vanilla CommonConditions function names.
/// Used for name-conflict detection.
const VANILLA_COMMON_CONDITIONS: &[&str] = &[
    "IsSpellOfSchool",
    "HasSpellFlag",
    "HasUseCosts",
    "HasFunctor",
    "IsCantrip",
    "IsSpellLevel",
    "HasActionResourceCost",
    "IsSpellType",
];

pub struct KhonsuHandler;

impl FileTypeHandler for KhonsuHandler {
    fn name(&self) -> &str {
        "KhonsuHandler"
    }

    fn claimed_table_prefixes(&self) -> Vec<&str> {
        vec![]
    }

    fn claimed_meta_keys(&self) -> Vec<&str> {
        vec!["khonsu_condition"]
    }

    fn plan(&self, ctx: &ExportContext) -> Result<Vec<ExportUnit>, AppError> {
        let rows = query_khonsu_keys(&ctx.staging_conn)?;

        let mut units = Vec::new();
        for key in rows {
            let rel_path = PathBuf::from(&key);
            let full_path = ctx.mod_path.join(&rel_path);
            let action = if full_path.exists() {
                FileAction::Update
            } else {
                FileAction::Create
            };

            units.push(ExportUnit {
                handler_name: self.name().to_string(),
                output_path: rel_path,
                action,
                entry_count: 1,
                content: None,
            });
        }

        Ok(units)
    }

    fn render(&self, unit: &ExportUnit, ctx: &ExportContext) -> Result<Vec<u8>, AppError> {
        let key = unit.output_path.to_string_lossy().replace('\\', "/");
        let value = ctx
            .staging_conn
            .query_row(
                "SELECT value FROM _staging_authoring WHERE key = ?1 AND \"_is_deleted\" = 0",
                [&key],
                |row| row.get::<_, String>(0),
            )
            .map_err(|e| {
                AppError::internal(format!("KhonsuHandler render read key '{key}': {e}"))
            })?;

        Ok(value.into_bytes())
    }

    fn validate(&self, ctx: &ExportContext) -> Result<Vec<HandlerWarning>, AppError> {
        let khn_keys = query_khonsu_keys(&ctx.staging_conn)?;
        let mut warnings = Vec::new();

        for key in &khn_keys {
            let content = match ctx.staging_conn.query_row(
                "SELECT value FROM _staging_authoring WHERE key = ?1 AND \"_is_deleted\" = 0",
                [key.as_str()],
                |row| row.get::<_, String>(0),
            ) {
                Ok(c) => c,
                Err(_) => continue,
            };

            // Extract function names (simple regex-free approach)
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("function ") {
                    // Extract function name between "function " and "("
                    if let Some(paren_pos) = trimmed.find('(') {
                        let fn_name = trimmed[9..paren_pos].trim();
                        // Check for name conflicts with vanilla CommonConditions
                        if VANILLA_COMMON_CONDITIONS.contains(&fn_name) {
                            warnings.push(HandlerWarning {
                                handler_name: self.name().to_string(),
                                message: format!(
                                    "Function '{fn_name}' in {key} conflicts with vanilla CommonConditions builtin"
                                ),
                                severity: WarningSeverity::Warning,
                            });
                        }
                    }
                }
            }
        }

        Ok(warnings)
    }
}

/// Query all non-deleted `.khn` script keys from `_staging_authoring`.
fn query_khonsu_keys(conn: &rusqlite::Connection) -> Result<Vec<String>, AppError> {
    let mut stmt = conn
        .prepare(
            "SELECT key FROM _staging_authoring \
             WHERE key LIKE '%Scripts/thoth/helpers/%.khn' \
             AND \"_is_deleted\" = 0 \
             ORDER BY key",
        )
        .map_err(|e| AppError::internal(format!("KhonsuHandler query keys: {e}")))?;
    let rows = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| AppError::internal(format!("KhonsuHandler query map: {e}")))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::internal(format!("KhonsuHandler collect: {e}")))?;
    Ok(rows)
}
