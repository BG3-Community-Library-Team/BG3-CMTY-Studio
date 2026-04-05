pub mod delta;
pub mod loca_handler;
pub mod lsx_handler;
pub mod meta_handler;
pub mod osiris_handler;
pub mod stats_handler;
pub mod writer;

use crate::error::AppError;
use rusqlite::Connection;
use std::path::PathBuf;
use walkdir::WalkDir;

// ---------------------------------------------------------------------------
// Core trait
// ---------------------------------------------------------------------------

/// A handler knows how to export one category of mod files from staging DB state.
pub trait FileTypeHandler: Send + Sync {
    /// Human-readable name for error messages and logging.
    fn name(&self) -> &str;

    /// Which staging table prefixes does this handler claim?
    /// e.g., `["lsx__"]` for LsxHandler, `["stats__"]` for StatsHandler.
    fn claimed_table_prefixes(&self) -> Vec<&str>;

    /// Which `_staging_authoring` meta keys does this handler own?
    fn claimed_meta_keys(&self) -> Vec<&str>;

    /// Build export units from staging DB state.
    /// Each `ExportUnit` maps to one output file.
    fn plan(&self, ctx: &ExportContext) -> Result<Vec<ExportUnit>, AppError>;

    /// Serialize an export unit to file content bytes.
    fn render(&self, unit: &ExportUnit, ctx: &ExportContext) -> Result<Vec<u8>, AppError>;
}

// ---------------------------------------------------------------------------
// Context & plan types
// ---------------------------------------------------------------------------

/// Read-only context passed to every handler during plan and render phases.
pub struct ExportContext {
    /// Read-only staging DB connection.
    pub staging_conn: Connection,
    /// Path to ref_base.sqlite for ATTACH-based vanilla lookups.
    pub ref_base_path: PathBuf,
    /// Root directory of the mod being exported.
    pub mod_path: PathBuf,
    /// User-facing mod name.
    pub mod_name: String,
    /// Mod folder name (used in output paths like `Public/{folder}/...`).
    pub mod_folder: String,
}

/// Represents a single output file to be written (or deleted) during export.
#[derive(Debug, Clone)]
pub struct ExportUnit {
    /// Which handler produced this unit.
    pub handler_name: String,
    /// Relative path from `mod_path` to the output file.
    pub output_path: PathBuf,
    /// What action to take for this file.
    pub action: FileAction,
    /// Number of data entries in this file.
    pub entry_count: usize,
    /// File content bytes, populated during render phase.
    pub content: Option<Vec<u8>>,
}

/// What action to take for an output file during export.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FileAction {
    /// File doesn't exist on disk, entries exist in staging.
    Create,
    /// File exists on disk, entries modified/added/removed.
    Update,
    /// File exists on disk, all entries deleted in staging.
    Delete,
    /// No tracked changes for this file (skip writing).
    Unchanged,
}

/// Aggregated export plan from all handlers.
#[derive(Debug, Default)]
pub struct ExportPlan {
    /// All export units from all handlers.
    pub units: Vec<ExportUnit>,
    /// Files on disk that no handler claims (candidates for deletion).
    pub orphan_files: Vec<PathBuf>,
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/// Returns all built-in file-type handlers.
///
/// Handlers are checked in order. The first handler to claim a table prefix
/// owns that table. Order matters only for conflict resolution (no conflicts
/// expected with current handlers).
pub fn default_handlers() -> Vec<Box<dyn FileTypeHandler>> {
    vec![
        Box::new(lsx_handler::LsxHandler),
        Box::new(stats_handler::StatsHandler),
        Box::new(loca_handler::LocaHandler),
        Box::new(osiris_handler::OsirisHandler),
        Box::new(meta_handler::MetaLsxHandler),
    ]
}

// ---------------------------------------------------------------------------
// Plan builder
// ---------------------------------------------------------------------------

/// Build an export plan by iterating all registered handlers.
///
/// Each handler's `plan()` method is called to produce `ExportUnit`s.
/// After collecting all units, orphan files on disk (not claimed by any handler)
/// are detected and added to the plan for potential deletion.
pub fn build_export_plan(
    ctx: &ExportContext,
    handlers: &[Box<dyn FileTypeHandler>],
) -> Result<ExportPlan, AppError> {
    let mut plan = ExportPlan::default();

    for handler in handlers {
        let units = handler.plan(ctx)?;
        plan.units.extend(units);
    }

    plan.orphan_files = compute_orphan_files(ctx, &plan)?;

    Ok(plan)
}

// ---------------------------------------------------------------------------
// Orphan detection
// ---------------------------------------------------------------------------

/// File extensions considered export artifacts when walking the mod directory.
const EXPORT_EXTENSIONS: &[&str] = &["lsx", "txt", "xml"];

/// Filenames excluded from orphan detection (managed externally).
const ORPHAN_EXCLUSIONS: &[&str] = &[];

/// Walk the mod directory to find files that exist on disk but are not claimed
/// by any handler unit. These are candidates for deletion during export.
fn compute_orphan_files(ctx: &ExportContext, plan: &ExportPlan) -> Result<Vec<PathBuf>, AppError> {
    if !ctx.mod_path.is_dir() {
        return Ok(Vec::new());
    }

    // Collect all output paths from the plan for fast lookup.
    let claimed: std::collections::HashSet<PathBuf> = plan
        .units
        .iter()
        .map(|u| u.output_path.clone())
        .collect();

    let mut orphans = Vec::new();

    for entry in WalkDir::new(&ctx.mod_path)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if !entry.file_type().is_file() {
            continue;
        }

        let path = entry.path();

        // Only consider known export extensions.
        let dominated = match path.extension().and_then(|e| e.to_str()) {
            Some(ext) => EXPORT_EXTENSIONS.iter().any(|&e| e.eq_ignore_ascii_case(ext)),
            None => false,
        };
        if !dominated {
            continue;
        }

        // Compute relative path from mod root.
        let rel = match path.strip_prefix(&ctx.mod_path) {
            Ok(r) => r.to_path_buf(),
            Err(_) => continue,
        };

        // Exclude externally-managed files.
        if let Some(name) = rel.file_name().and_then(|n| n.to_str()) {
            if ORPHAN_EXCLUSIONS.iter().any(|&excl| excl == name) {
                continue;
            }
        }

        if !claimed.contains(&rel) {
            orphans.push(rel);
        }
    }

    Ok(orphans)
}

// ---------------------------------------------------------------------------
// Staging DB helpers
// ---------------------------------------------------------------------------

/// Metadata about a staging table from `_table_meta`.
#[derive(Debug, Clone)]
pub struct TableInfo {
    pub table_name: String,
    pub source_type: String,
    pub region_id: Option<String>,
    pub node_id: Option<String>,
}

/// List staging tables whose name starts with `prefix` (e.g. `"lsx__"`).
pub fn list_staging_tables(conn: &Connection, prefix: &str) -> Result<Vec<TableInfo>, AppError> {
    let pattern = format!("{}%", prefix);
    let mut stmt = conn
        .prepare(
            "SELECT table_name, source_type, region_id, node_id \
             FROM _table_meta \
             WHERE table_name LIKE ?1",
        )
        .map_err(|e| AppError::internal(format!("list_staging_tables prepare: {e}")))?;

    let rows = stmt
        .query_map([&pattern], |row| {
            Ok(TableInfo {
                table_name: row.get(0)?,
                source_type: row.get(1)?,
                region_id: row.get(2)?,
                node_id: row.get(3)?,
            })
        })
        .map_err(|e| AppError::internal(format!("list_staging_tables query: {e}")))?;

    let mut tables = Vec::new();
    for r in rows {
        tables.push(
            r.map_err(|e| AppError::internal(format!("list_staging_tables row: {e}")))?,
        );
    }
    Ok(tables)
}

/// Check if a staging table has any tracked changes (new, modified, or deleted rows).
pub fn has_tracked_changes(conn: &Connection, table_name: &str) -> Result<bool, AppError> {
    let sql = format!(
        "SELECT EXISTS(SELECT 1 FROM \"{}\" WHERE _is_new=1 OR _is_modified=1 OR _is_deleted=1)",
        table_name.replace('"', "\"\"")
    );
    conn.query_row(&sql, [], |row| row.get(0))
        .map_err(|e| AppError::internal(format!("has_tracked_changes({}): {e}", table_name)))
}

/// Check if ALL rows in a table are marked as deleted.
///
/// Returns `true` when the table has at least one row **and** every row has
/// `_is_deleted = 1`.
pub fn all_rows_deleted(conn: &Connection, table_name: &str) -> Result<bool, AppError> {
    let escaped = table_name.replace('"', "\"\"");
    let sql = format!(
        "SELECT COUNT(*), SUM(CASE WHEN _is_deleted=1 THEN 1 ELSE 0 END) FROM \"{}\"",
        escaped
    );
    conn.query_row(&sql, [], |row| {
        let total: i64 = row.get(0)?;
        let deleted: i64 = row.get(1)?;
        Ok(total > 0 && total == deleted)
    })
    .map_err(|e| AppError::internal(format!("all_rows_deleted({}): {e}", table_name)))
}

/// Read a value from `_staging_authoring`.
pub fn get_meta_value(conn: &Connection, key: &str) -> Result<Option<String>, AppError> {
    let result = conn.query_row(
        "SELECT value FROM _staging_authoring WHERE key = ?1 AND \"_is_deleted\" = 0",
        [key],
        |row| row.get(0),
    );
    match result {
        Ok(v) => Ok(Some(v)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(AppError::internal(format!(
            "get_meta_value({key}): {e}"
        ))),
    }
}
