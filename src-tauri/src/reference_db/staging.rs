//! Staging database — active mod editing workspace.
//!
//! The staging DB is a per-mod SQLite file used for authoring.  It follows
//! the same table schema as `ref_base.sqlite` with three additions per data
//! table:
//!
//!   - `_is_modified` INTEGER DEFAULT 0 — row has been edited in staging
//!   - `_is_new`      INTEGER DEFAULT 0 — row was created in staging (not from vanilla)
//!   - `_is_deleted`  INTEGER DEFAULT 0 — row is marked for deletion on export
//!
//! The staging DB uses WAL mode to allow concurrent reads (UI queries) during
//! writes (user edits).  FK constraints are omitted — cross-DB validation via
//! ATTACH against ref_base handles referential integrity.
//!
//! Lifecycle:
//!   1. `create_staging_db()` — create empty schema with tracking columns
//!   2. (optionally) `populate_staging_from_mod()` — import existing mod files
//!   3. User edits via INSERT/UPDATE/DELETE through Tauri commands
//!   4. Export: query staging rows grouped by table, serialize to LSX/stats/loca

use crate::reference_db::builder::{self, load_schema_from_db};
use crate::reference_db::schema::*;
use crate::reference_db::{BuildOptions, BuildSummary};
use rusqlite::Connection;
use std::path::Path;
use std::time::Instant;

/// Summary returned after staging DB creation.
#[derive(Debug, Clone, serde::Serialize)]
pub struct StagingSummary {
    pub db_path: String,
    pub total_tables: usize,
    pub junction_tables: usize,
    pub elapsed_secs: f64,
    pub db_size_mb: f64,
}

/// Create a staging database with empty schema + tracking columns.
///
/// `schema_db_path` — path to ref_base.sqlite (schema source).
///                     The embedded schema blob is read from here.
/// `staging_db_path` — output path for the new staging.sqlite file.
///
/// The staging DB gets:
///   - All data tables from the reference schema (same columns)
///   - Three extra tracking columns per data table
///   - No FK constraints (cross-DB ATTACH handles refs to vanilla)
///   - WAL mode for concurrent read/write
///   - Meta tables (_sources, _source_files, _column_types, _table_meta)
///   - Embedded schema blob (same as ref_base for compatibility)
pub fn create_staging_db(
    schema_db_path: &Path,
    staging_db_path: &Path,
) -> Result<StagingSummary, String> {
    let start = Instant::now();

    let schema = load_schema_from_db(schema_db_path)?;

    // Remove existing staging DB and WAL/SHM files
    let _ = std::fs::remove_file(staging_db_path);
    let db_str = staging_db_path.to_string_lossy();
    for suffix in &["-wal", "-shm"] {
        let _ = std::fs::remove_file(format!("{}{}", db_str, suffix));
    }

    let conn = Connection::open(staging_db_path)
        .map_err(|e| format!("Create staging DB: {}", e))?;

    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA page_size = 8192;
         PRAGMA foreign_keys = OFF;",
    )
    .map_err(|e| format!("Pragma error: {}", e))?;

    // Wrap all DDL + metadata in a single transaction to avoid per-statement fsyncs.
    let tx = conn.unchecked_transaction()
        .map_err(|e| format!("Begin transaction: {}", e))?;

    // Meta tables (same as reference DB)
    create_staging_meta_tables(&tx)?;

    // Embedded schema storage
    tx.execute_batch(
        "CREATE TABLE IF NOT EXISTS _embedded_schema (
            key   TEXT PRIMARY KEY,
            value BLOB NOT NULL
         ) WITHOUT ROWID;",
    )
    .map_err(|e| format!("Create _embedded_schema: {}", e))?;

    // Data tables with staging tracking columns, no FK constraints
    for ts in schema.tables.values() {
        create_staging_data_table(&tx, ts)?;
    }

    // Junction tables (no FKs, with tracking columns)
    for jt in &schema.junction_tables {
        let ddl = format!(
            "CREATE TABLE IF NOT EXISTS \"{}\" (\n\
             \x20   parent_id {} NOT NULL,\n\
             \x20   child_id {} NOT NULL,\n\
             \x20   \"_is_modified\" INTEGER NOT NULL DEFAULT 0,\n\
             \x20   \"_is_new\" INTEGER NOT NULL DEFAULT 0,\n\
             \x20   \"_is_deleted\" INTEGER NOT NULL DEFAULT 0,\n\
             \x20   PRIMARY KEY (parent_id, child_id)\n\
             ) WITHOUT ROWID",
            jt.table_name,
            jt.parent_pk_type,
            jt.child_pk_type,
        );
        tx.execute_batch(&ddl)
            .map_err(|e| format!("Create junction '{}': {}", jt.table_name, e))?;
    }

    // DSM-03: Add UNIQUE indexes on non-PK UUID columns to prevent duplicate entries
    for (table_name, ts) in &schema.tables {
        if ts.pk_strategy != PkStrategy::Uuid {
            for col in &ts.columns {
                if col.name == "UUID" {
                    let idx = format!("uq_{}_{}", table_name, col.name);
                    tx.execute_batch(&format!(
                        "CREATE UNIQUE INDEX IF NOT EXISTS \"{}\" ON \"{}\"(\"{}\")",
                        idx, table_name, col.name
                    ))
                    .map_err(|e| format!("UUID index on {}.{}: {}", table_name, col.name, e))?;
                }
            }
        }
    }

    // Store schema blob (matches ref_base format for pipeline compatibility)
    let blob = rmp_serde::to_vec(&schema)
        .map_err(|e| format!("Serialize schema: {}", e))?;
    tx.execute(
        "INSERT OR REPLACE INTO _embedded_schema (key, value) VALUES ('schema', ?1)",
        rusqlite::params![blob],
    )
    .map_err(|e| format!("Store schema blob: {}", e))?;

    // Populate column types metadata
    populate_staging_column_types(&tx, &schema)?;

    tx.commit().map_err(|e| format!("Commit staging DDL: {}", e))?;

    let total_tables = schema.tables.len();
    let junction_tables = schema.junction_tables.len();

    eprintln!(
        "  Staging DB created: {} data tables, {} junctions (no FKs, WAL mode)",
        total_tables, junction_tables,
    );

    // VACUUM the empty DB
    conn.execute_batch("PRAGMA journal_mode = DELETE; VACUUM;")
        .map_err(|e| format!("Vacuum staging DB: {}", e))?;

    conn.close().map_err(|(_conn, e)| format!("Close error: {}", e))?;

    let db_size_bytes = std::fs::metadata(staging_db_path)
        .map(|m| m.len())
        .unwrap_or(0);

    Ok(StagingSummary {
        db_path: staging_db_path.display().to_string(),
        total_tables: total_tables + junction_tables,
        junction_tables,
        elapsed_secs: start.elapsed().as_secs_f64(),
        db_size_mb: db_size_bytes as f64 / (1024.0 * 1024.0),
    })
}

/// Populate a staging DB from existing mod files.
///
/// This uses the same parallel parse + sequential insert pipeline as the
/// reference DB builder, but writes into a staging DB (with tracking columns
/// defaulting to `_is_new=0, _is_modified=0, _is_deleted=0`).
///
/// Files imported this way represent the mod's current state — they aren't
/// "new" in the staging sense (they already exist on disk).
pub fn populate_staging_from_mod(
    mod_path: &Path,
    mod_name: &str,
    staging_db_path: &Path,
    options: &BuildOptions,
) -> Result<BuildSummary, String> {
    let start = Instant::now();

    let t0 = Instant::now();
    let files = crate::reference_db::collect_mod_files(mod_path, mod_name)?;
    let total_files = files.len();
    let collect_secs = t0.elapsed().as_secs_f64();
    eprintln!(
        "  Phase: collect_mod    {:.1}s  ({} files for staging '{}')",
        collect_secs, total_files, mod_name
    );

    // Use the standard populate pipeline — the staging DB has the same column
    // structure (with extra DEFAULT columns that populate automatically).
    let result = builder::populate_db(staging_db_path, &files, mod_path, options)?;

    let db_size_bytes = std::fs::metadata(staging_db_path)
        .map(|m| m.len())
        .unwrap_or(0);

    let mut phase_times = result.phase_times;
    phase_times.collect_files = collect_secs;

    Ok(BuildSummary {
        db_path: staging_db_path.display().to_string(),
        total_files,
        total_rows: result.total_rows,
        total_tables: result.total_tables,
        fk_constraints: result.fk_constraints,
        file_errors: result.file_errors,
        row_errors: result.row_errors,
        elapsed_secs: start.elapsed().as_secs_f64(),
        db_size_mb: db_size_bytes as f64 / (1024.0 * 1024.0),
        phase_times,
    })
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/// Meta tables for the staging DB.  Same as reference DB meta tables.
fn create_staging_meta_tables(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TABLE _sources (
            id   INTEGER PRIMARY KEY,
            name TEXT NOT NULL UNIQUE
        );

        CREATE TABLE _source_files (
            file_id   INTEGER PRIMARY KEY AUTOINCREMENT,
            path      TEXT NOT NULL UNIQUE,
            file_type TEXT NOT NULL,
            mod_name  TEXT,
            region_id TEXT,
            row_count INTEGER DEFAULT 0,
            file_size INTEGER
        );

        CREATE TABLE _column_types (
            table_name  TEXT NOT NULL,
            column_name TEXT NOT NULL,
            bg3_type    TEXT,
            sqlite_type TEXT NOT NULL,
            PRIMARY KEY (table_name, column_name)
        ) WITHOUT ROWID;

        CREATE TABLE _table_meta (
            table_name    TEXT PRIMARY KEY,
            source_type   TEXT NOT NULL,
            region_id     TEXT,
            node_id       TEXT,
            parent_tables TEXT,
            row_count     INTEGER DEFAULT 0
        ) WITHOUT ROWID;",
    )
    .map_err(|e| format!("Staging meta table error: {}", e))
}

/// Create a data table for the staging DB.
///
/// Same schema as `create_data_table` but:
///   - No FK constraints (cross-DB handles this)
///   - Three extra tracking columns with DEFAULT values
fn create_staging_data_table(
    conn: &Connection,
    ts: &TableSchema,
) -> Result<(), String> {
    let mut ddl = String::new();
    ddl.push_str(&format!("CREATE TABLE IF NOT EXISTS \"{}\" (\n", ts.table_name));

    // PK column
    match &ts.pk_strategy {
        PkStrategy::Rowid => {
            ddl.push_str("    \"_row_id\" INTEGER PRIMARY KEY");
        }
        pk => {
            ddl.push_str(&format!(
                "    \"{}\" {} PRIMARY KEY",
                pk.pk_column(),
                pk.pk_sql_type()
            ));
        }
    }

    // _file_id column
    if ts.has_file_id {
        ddl.push_str(",\n    _file_id INTEGER");
    }

    // _SourceID column (same as base, no FK constraint here)
    if ts.pk_strategy != PkStrategy::Rowid {
        ddl.push_str(",\n    \"_SourceID\" INTEGER");
    }

    // Data columns
    for col in &ts.columns {
        ddl.push_str(&format!(",\n    \"{}\" {}", col.name, col.sqlite_type));
    }

    // Staging tracking columns (with DEFAULTs so the existing insert pipeline works)
    ddl.push_str(",\n    \"_is_modified\" INTEGER NOT NULL DEFAULT 0");
    ddl.push_str(",\n    \"_is_new\" INTEGER NOT NULL DEFAULT 0");
    ddl.push_str(",\n    \"_is_deleted\" INTEGER NOT NULL DEFAULT 0");

    ddl.push_str("\n)");

    conn.execute_batch(&ddl)
        .map_err(|e| format!("Create staging table '{}': {}\nDDL: {}", ts.table_name, e, ddl))?;

    Ok(())
}

/// Populate _column_types for the staging DB.
fn populate_staging_column_types(
    conn: &Connection,
    schema: &DiscoveredSchema,
) -> Result<(), String> {
    let mut stmt = conn
        .prepare(
            "INSERT OR IGNORE INTO _column_types (table_name, column_name, bg3_type, sqlite_type) \
             VALUES (?1, ?2, ?3, ?4)",
        )
        .map_err(|e| format!("Prepare column_types insert: {}", e))?;

    for (table_name, ts) in &schema.tables {
        // PK column
        let pk_col = ts.pk_strategy.pk_column();
        let pk_type = ts.pk_strategy.pk_sql_type();
        stmt.execute(rusqlite::params![table_name, pk_col, Option::<&str>::None, pk_type])
            .map_err(|e| format!("Insert column_types {}.{}: {}", table_name, pk_col, e))?;

        // Data columns
        for col in &ts.columns {
            let bg3_ref: Option<&str> = if col.bg3_type.is_empty() {
                None
            } else {
                Some(&col.bg3_type)
            };
            stmt.execute(rusqlite::params![
                table_name,
                col.name,
                bg3_ref,
                col.sqlite_type
            ])
            .map_err(|e| format!("Insert column_types {}.{}: {}", table_name, col.name, e))?;
        }

        // Staging-specific columns
        for staging_col in &["_is_modified", "_is_new", "_is_deleted"] {
            stmt.execute(rusqlite::params![table_name, staging_col, Option::<&str>::None, "INTEGER"])
                .map_err(|e| format!("Insert column_types {}.{}: {}", table_name, staging_col, e))?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_staging_data_table_ddl_has_tracking_cols() {
        // Verify that staging DDL includes the three tracking columns
        let conn = Connection::open_in_memory().unwrap();
        create_staging_meta_tables(&conn).unwrap();

        let ts = TableSchema {
            table_name: "test_table".to_string(),
            pk_strategy: PkStrategy::Uuid,
            source_type: "lsx".to_string(),
            region_id: None,
            node_id: None,
            columns: vec![
                ColumnDef {
                    name: "Name".to_string(),
                    bg3_type: "FixedString".to_string(),
                    sqlite_type: "TEXT".to_string(),
                },
            ],
            fk_constraints: vec![],
            has_file_id: true,
            parent_tables: std::collections::HashSet::new(),
        };

        create_staging_data_table(&conn, &ts).unwrap();

        // Check columns exist
        let cols: Vec<String> = conn
            .prepare("PRAGMA table_info(test_table)")
            .unwrap()
            .query_map([], |row| row.get::<_, String>(1))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert!(cols.contains(&"UUID".to_string()), "Missing UUID PK");
        assert!(cols.contains(&"Name".to_string()), "Missing Name column");
        assert!(cols.contains(&"_is_modified".to_string()), "Missing _is_modified");
        assert!(cols.contains(&"_is_new".to_string()), "Missing _is_new");
        assert!(cols.contains(&"_is_deleted".to_string()), "Missing _is_deleted");
        assert!(cols.contains(&"_file_id".to_string()), "Missing _file_id");
        assert!(cols.contains(&"_SourceID".to_string()), "Missing _SourceID");
    }

    #[test]
    fn test_staging_junction_has_tracking_cols() {
        let conn = Connection::open_in_memory().unwrap();

        // Staging junctions should have tracking columns
        conn.execute_batch(
            "CREATE TABLE jct_test (\n\
             \x20   parent_id TEXT NOT NULL,\n\
             \x20   child_id TEXT NOT NULL,\n\
             \x20   \"_is_modified\" INTEGER NOT NULL DEFAULT 0,\n\
             \x20   \"_is_new\" INTEGER NOT NULL DEFAULT 0,\n\
             \x20   \"_is_deleted\" INTEGER NOT NULL DEFAULT 0,\n\
             \x20   PRIMARY KEY (parent_id, child_id)\n\
             ) WITHOUT ROWID",
        )
        .unwrap();

        let cols: Vec<String> = conn
            .prepare("PRAGMA table_info(jct_test)")
            .unwrap()
            .query_map([], |row| row.get::<_, String>(1))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert_eq!(cols.len(), 5);
        assert!(cols.contains(&"parent_id".to_string()));
        assert!(cols.contains(&"child_id".to_string()));
        assert!(cols.contains(&"_is_modified".to_string()));
        assert!(cols.contains(&"_is_new".to_string()));
        assert!(cols.contains(&"_is_deleted".to_string()));
    }

    #[test]
    fn test_staging_rowid_table_no_sourceid() {
        let conn = Connection::open_in_memory().unwrap();
        create_staging_meta_tables(&conn).unwrap();

        let ts = TableSchema {
            table_name: "child_table".to_string(),
            pk_strategy: PkStrategy::Rowid,
            source_type: "lsx".to_string(),
            region_id: None,
            node_id: None,
            columns: vec![
                ColumnDef {
                    name: "Value".to_string(),
                    bg3_type: "int32".to_string(),
                    sqlite_type: "INTEGER".to_string(),
                },
            ],
            fk_constraints: vec![],
            has_file_id: false,
            parent_tables: std::collections::HashSet::new(),
        };

        create_staging_data_table(&conn, &ts).unwrap();

        let cols: Vec<String> = conn
            .prepare("PRAGMA table_info(child_table)")
            .unwrap()
            .query_map([], |row| row.get::<_, String>(1))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        // Rowid tables should NOT have _SourceID (children inherit parent's source)
        assert!(!cols.contains(&"_SourceID".to_string()), "_SourceID should not exist on Rowid table");
        // But SHOULD have tracking columns
        assert!(cols.contains(&"_is_modified".to_string()));
        assert!(cols.contains(&"_is_new".to_string()));
        assert!(cols.contains(&"_is_deleted".to_string()));
    }

    #[test]
    fn staging_meta_tables_created_successfully() {
        let conn = Connection::open_in_memory().unwrap();
        create_staging_meta_tables(&conn).unwrap();

        // Verify all four meta tables exist
        let tables: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .unwrap()
            .query_map([], |row| row.get::<_, String>(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert!(tables.contains(&"_sources".to_string()), "Missing _sources");
        assert!(tables.contains(&"_source_files".to_string()), "Missing _source_files");
        assert!(tables.contains(&"_column_types".to_string()), "Missing _column_types");
        assert!(tables.contains(&"_table_meta".to_string()), "Missing _table_meta");
    }

    #[test]
    fn staging_uuid_pk_table_has_uuid_as_pk() {
        // When PK is UUID, the PK already ensures uniqueness
        let conn = Connection::open_in_memory().unwrap();
        create_staging_meta_tables(&conn).unwrap();

        let ts = TableSchema {
            table_name: "uuid_pk_table".to_string(),
            pk_strategy: PkStrategy::Uuid,
            source_type: "lsx".to_string(),
            region_id: None,
            node_id: None,
            columns: vec![
                ColumnDef {
                    name: "Name".to_string(),
                    bg3_type: "FixedString".to_string(),
                    sqlite_type: "TEXT".to_string(),
                },
            ],
            fk_constraints: vec![],
            has_file_id: true,
            parent_tables: std::collections::HashSet::new(),
        };

        create_staging_data_table(&conn, &ts).unwrap();

        // UUID is the PK — verify it
        let pk_cols: Vec<(String, i32)> = conn
            .prepare("PRAGMA table_info(uuid_pk_table)")
            .unwrap()
            .query_map([], |row| {
                let name: String = row.get(1)?;
                let pk: i32 = row.get(5)?;
                Ok((name, pk))
            })
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        let uuid_entry = pk_cols.iter().find(|(name, _)| name == "UUID");
        assert!(uuid_entry.is_some(), "UUID column should exist");
        assert!(uuid_entry.unwrap().1 != 0, "UUID should be the PK");
    }

    #[test]
    fn staging_summary_serializes_correctly() {
        let summary = StagingSummary {
            db_path: "/tmp/staging.sqlite".to_string(),
            total_tables: 42,
            junction_tables: 5,
            elapsed_secs: 1.234,
            db_size_mb: 0.5,
        };

        let json = serde_json::to_string(&summary).unwrap();
        assert!(json.contains("\"total_tables\":42"));
        assert!(json.contains("\"junction_tables\":5"));
        assert!(json.contains("\"db_path\":\"/tmp/staging.sqlite\""));
    }
}
