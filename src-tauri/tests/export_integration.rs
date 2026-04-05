//! Integration tests for the export engine.
//!
//! Each test creates an in-memory SQLite staging DB with the required meta
//! tables, populates it as needed, then exercises handler plan/render and the
//! delta/writer pipeline.

use std::path::PathBuf;

use rusqlite::Connection;

use bg3_cmty_studio_lib::export::{
    build_export_plan, default_handlers,
    delta::compute_file_delta,
    loca_handler::LocaHandler,
    lsx_handler::LsxHandler,
    meta_handler::MetaLsxHandler,
    osiris_handler::OsirisHandler,
    stats_handler::StatsHandler,
    writer::write_files_atomic,
    ExportContext, ExportPlan, ExportUnit, FileAction, FileTypeHandler,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Create an in-memory staging DB with all required meta tables.
fn create_test_staging_db() -> Connection {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute_batch(
        "
        CREATE TABLE _table_meta (
            table_name TEXT PRIMARY KEY,
            source_type TEXT NOT NULL,
            region_id TEXT,
            node_id TEXT,
            parent_tables TEXT,
            row_count INTEGER DEFAULT 0
        );
        CREATE TABLE _staging_authoring (
            key TEXT PRIMARY KEY,
            value TEXT,
            _is_new INTEGER DEFAULT 0,
            _is_modified INTEGER DEFAULT 0,
            _is_deleted INTEGER DEFAULT 0,
            _original_hash TEXT
        );
        CREATE TABLE _source_files (
            file_id INTEGER PRIMARY KEY,
            path TEXT,
            file_type TEXT,
            mod_name TEXT,
            region_id TEXT,
            row_count INTEGER DEFAULT 0,
            file_size INTEGER DEFAULT 0
        );
        CREATE TABLE _column_types (
            table_name TEXT NOT NULL,
            column_name TEXT NOT NULL,
            bg3_type TEXT,
            sqlite_type TEXT,
            PRIMARY KEY(table_name, column_name)
        );
        ",
    )
    .unwrap();
    conn
}

/// Build an `ExportContext` from the given connection, using a temp dir as the
/// mod path and a non-existent ref_base_path (fine for tests that skip ATTACH).
fn make_context(conn: Connection, mod_path: PathBuf) -> ExportContext {
    ExportContext {
        staging_conn: conn,
        ref_base_path: PathBuf::from("__nonexistent_ref_base.sqlite"),
        mod_path,
        mod_name: "TestMod".to_string(),
        mod_folder: "TestModFolder".to_string(),
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. LsxHandler tests
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_lsx_handler_plan_empty() {
    let conn = create_test_staging_db();
    let ctx = make_context(conn, PathBuf::from("__fake_mod"));
    let handler = LsxHandler;

    let units = handler.plan(&ctx).unwrap();
    assert!(units.is_empty(), "No lsx__ tables → empty plan");
}

#[test]
fn test_lsx_handler_plan_with_data() {
    let conn = create_test_staging_db();

    // Register a table in _table_meta
    conn.execute(
        "INSERT INTO _table_meta (table_name, source_type, region_id, node_id)
         VALUES ('lsx__ClassDescriptions', 'lsx', 'ClassDescriptions', 'ClassDescription')",
        [],
    )
    .unwrap();

    // Create the actual data table with tracking columns
    conn.execute_batch(
        "CREATE TABLE lsx__ClassDescriptions (
            UUID TEXT,
            Name TEXT,
            _is_new INTEGER DEFAULT 0,
            _is_modified INTEGER DEFAULT 0,
            _is_deleted INTEGER DEFAULT 0,
            _file_id INTEGER,
            _SourceID TEXT
        );
        INSERT INTO lsx__ClassDescriptions (UUID, Name, _is_new)
            VALUES ('aaa-bbb', 'Fighter', 1);
        INSERT INTO lsx__ClassDescriptions (UUID, Name, _is_new)
            VALUES ('ccc-ddd', 'Wizard', 1);",
    )
    .unwrap();

    let ctx = make_context(conn, PathBuf::from("__fake_mod"));
    let handler = LsxHandler;

    let units = handler.plan(&ctx).unwrap();
    assert_eq!(units.len(), 1);
    assert_eq!(units[0].handler_name, "LsxHandler");
    assert_eq!(units[0].entry_count, 2);
    assert_eq!(units[0].action, FileAction::Create);
    assert!(
        units[0].output_path.ends_with("ClassDescriptions.lsx"),
        "output path should end with ClassDescriptions.lsx, got {:?}",
        units[0].output_path
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. StatsHandler tests
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_stats_handler_plan_empty() {
    let conn = create_test_staging_db();
    let ctx = make_context(conn, PathBuf::from("__fake_mod"));
    let handler = StatsHandler;

    let units = handler.plan(&ctx).unwrap();
    assert!(units.is_empty(), "No stats__ tables → empty plan");
}

#[test]
fn test_stats_handler_plan_with_data() {
    let conn = create_test_staging_db();

    conn.execute(
        "INSERT INTO _table_meta (table_name, source_type, region_id, node_id)
         VALUES ('stats__Spell', 'stats', NULL, NULL)",
        [],
    )
    .unwrap();

    conn.execute_batch(
        "CREATE TABLE stats__Spell (
            _entry_name TEXT,
            _file_id INTEGER,
            _SourceID TEXT,
            _type TEXT,
            _using TEXT,
            _is_new INTEGER DEFAULT 0,
            _is_modified INTEGER DEFAULT 0,
            _is_deleted INTEGER DEFAULT 0,
            SpellType TEXT,
            Level TEXT
        );
        INSERT INTO stats__Spell (_entry_name, _file_id, _type, _is_new, SpellType, Level)
            VALUES ('Fireball', NULL, 'SpellData', 1, 'Zone', '3');
        INSERT INTO stats__Spell (_entry_name, _file_id, _type, _is_new, SpellType, Level)
            VALUES ('MagicMissile', NULL, 'SpellData', 1, 'Projectile', '1');",
    )
    .unwrap();

    let ctx = make_context(conn, PathBuf::from("__fake_mod"));
    let handler = StatsHandler;

    let units = handler.plan(&ctx).unwrap();
    assert!(!units.is_empty(), "Should produce at least one unit");
    assert_eq!(units[0].handler_name, "StatsHandler");
    assert_eq!(units[0].entry_count, 2);
    assert_eq!(units[0].action, FileAction::Create);
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. LocaHandler tests
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_loca_handler_plan_empty() {
    let conn = create_test_staging_db();
    // The loca handler checks `loca__english` specifically, but that table
    // doesn't exist yet. has_tracked_changes will error → treat as no changes.
    // We need to create the table with no changed rows.
    conn.execute_batch(
        "CREATE TABLE loca__english (
            contentuid TEXT PRIMARY KEY,
            version TEXT,
            text TEXT,
            _is_new INTEGER DEFAULT 0,
            _is_modified INTEGER DEFAULT 0,
            _is_deleted INTEGER DEFAULT 0,
            _file_id INTEGER,
            _SourceID TEXT
        );",
    )
    .unwrap();

    // Register it so has_tracked_changes can query it (but no rows → no changes)
    let ctx = make_context(conn, PathBuf::from("__fake_mod"));
    let handler = LocaHandler;

    let units = handler.plan(&ctx).unwrap();
    assert!(units.is_empty(), "Empty loca__english → no units");
}

#[test]
fn test_loca_handler_plan_with_data() {
    let conn = create_test_staging_db();

    conn.execute_batch(
        "CREATE TABLE loca__english (
            contentuid TEXT PRIMARY KEY,
            version TEXT,
            text TEXT,
            _is_new INTEGER DEFAULT 0,
            _is_modified INTEGER DEFAULT 0,
            _is_deleted INTEGER DEFAULT 0,
            _file_id INTEGER,
            _SourceID TEXT
        );
        INSERT INTO loca__english (contentuid, version, text, _is_new)
            VALUES ('h00001', '1', 'Hello World', 1);
        INSERT INTO loca__english (contentuid, version, text, _is_new)
            VALUES ('h00002', '1', 'Goodbye World', 1);",
    )
    .unwrap();

    let ctx = make_context(conn, PathBuf::from("__fake_mod"));
    let handler = LocaHandler;

    let units = handler.plan(&ctx).unwrap();
    assert_eq!(units.len(), 1);
    assert_eq!(units[0].handler_name, "loca");
    assert_eq!(units[0].entry_count, 2);
    assert!(
        units[0]
            .output_path
            .to_string_lossy()
            .contains("english.xml"),
        "output path should reference english.xml"
    );
}

#[test]
fn test_loca_handler_render() {
    let conn = create_test_staging_db();

    conn.execute_batch(
        "CREATE TABLE loca__english (
            contentuid TEXT PRIMARY KEY,
            version TEXT,
            text TEXT,
            _is_new INTEGER DEFAULT 0,
            _is_modified INTEGER DEFAULT 0,
            _is_deleted INTEGER DEFAULT 0,
            _file_id INTEGER,
            _SourceID TEXT
        );
        INSERT INTO loca__english (contentuid, version, text, _is_new)
            VALUES ('h00001', '1', 'Hello World', 1);
        INSERT INTO loca__english (contentuid, version, text, _is_new)
            VALUES ('h00002', '2', 'Goodbye World', 1);",
    )
    .unwrap();

    let ctx = make_context(conn, PathBuf::from("__fake_mod"));
    let handler = LocaHandler;

    let units = handler.plan(&ctx).unwrap();
    assert_eq!(units.len(), 1);

    let bytes = handler.render(&units[0], &ctx).unwrap();
    let xml = String::from_utf8(bytes).unwrap();

    assert!(
        xml.contains("<?xml version=\"1.0\" encoding=\"utf-8\"?>"),
        "Should have XML declaration"
    );
    assert!(xml.contains("<contentList>"), "Should have contentList root");
    assert!(
        xml.contains("contentuid=\"h00001\""),
        "Should contain first handle"
    );
    assert!(
        xml.contains("contentuid=\"h00002\""),
        "Should contain second handle"
    );
    assert!(
        xml.contains(">Hello World</content>"),
        "Should contain first text"
    );
    assert!(
        xml.contains("version=\"2\""),
        "Should preserve version attribute"
    );
    assert!(xml.contains("</contentList>"), "Should close contentList");
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. OsirisHandler test
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_osiris_handler_returns_empty() {
    let conn = create_test_staging_db();
    let ctx = make_context(conn, PathBuf::from("__fake_mod"));
    let handler = OsirisHandler;

    let units = handler.plan(&ctx).unwrap();
    assert!(units.is_empty(), "OsirisHandler stub always returns empty");

    // Also verify the trait metadata
    assert_eq!(handler.name(), "OsirisHandler");
    assert!(handler.claimed_table_prefixes().is_empty());
    assert!(handler.claimed_meta_keys().contains(&"osiris_goal_entries"));
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. MetaLsxHandler tests
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_meta_handler_plan_with_authoring() {
    let conn = create_test_staging_db();

    // Insert mod authoring metadata
    conn.execute_batch(
        "INSERT INTO _staging_authoring (key, value, _is_new)
            VALUES ('mod_uuid', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 1);
        INSERT INTO _staging_authoring (key, value, _is_new)
            VALUES ('mod_name', 'TestMod', 1);
        INSERT INTO _staging_authoring (key, value, _is_new)
            VALUES ('mod_author', 'TestAuthor', 1);
        INSERT INTO _staging_authoring (key, value, _is_new)
            VALUES ('mod_description', 'A test mod', 1);
        INSERT INTO _staging_authoring (key, value, _is_new)
            VALUES ('mod_version', '36028797018963968', 1);",
    )
    .unwrap();

    let ctx = make_context(conn, PathBuf::from("__fake_mod"));
    let handler = MetaLsxHandler;

    let units = handler.plan(&ctx).unwrap();
    assert_eq!(units.len(), 1);
    assert_eq!(units[0].handler_name, "MetaLsx");
    assert_eq!(units[0].entry_count, 1);
    assert_eq!(units[0].action, FileAction::Create);
    assert!(
        units[0].output_path.ends_with("meta.lsx"),
        "output path should end with meta.lsx, got {:?}",
        units[0].output_path
    );
    // Verify the path includes Mods/{folder}/
    let path_str = units[0].output_path.to_string_lossy();
    assert!(
        path_str.contains("TestModFolder"),
        "output path should contain the mod folder"
    );
}

#[test]
fn test_meta_handler_render_produces_valid_xml() {
    let conn = create_test_staging_db();

    conn.execute_batch(
        "INSERT INTO _staging_authoring (key, value, _is_new)
            VALUES ('mod_uuid', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 1);
        INSERT INTO _staging_authoring (key, value, _is_new)
            VALUES ('mod_name', 'TestMod', 1);
        INSERT INTO _staging_authoring (key, value, _is_new)
            VALUES ('mod_author', 'Author & Co', 1);
        INSERT INTO _staging_authoring (key, value, _is_new)
            VALUES ('mod_description', 'Desc with <special> chars', 1);
        INSERT INTO _staging_authoring (key, value, _is_new)
            VALUES ('mod_version', '36028797018963968', 1);
        INSERT INTO _staging_authoring (key, value, _is_new)
            VALUES ('mod_folder', 'TestModFolder', 1);",
    )
    .unwrap();

    let ctx = make_context(conn, PathBuf::from("__fake_mod"));
    let handler = MetaLsxHandler;

    let units = handler.plan(&ctx).unwrap();
    let bytes = handler.render(&units[0], &ctx).unwrap();
    let xml = String::from_utf8(bytes).unwrap();

    // Verify XML structure
    assert!(xml.contains("<?xml version=\"1.0\" encoding=\"UTF-8\"?>"));
    assert!(xml.contains("<save>"));
    assert!(xml.contains("<region id=\"Config\">"));
    assert!(xml.contains("<node id=\"root\">"));

    // ModuleInfo attributes
    assert!(xml.contains("value=\"aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee\""));
    assert!(xml.contains("value=\"TestMod\""));
    assert!(
        xml.contains("value=\"Author &amp; Co\""),
        "Author should be XML-escaped"
    );
    assert!(
        xml.contains("value=\"Desc with &lt;special&gt; chars\""),
        "Description should be XML-escaped"
    );

    // GustavDev dependency should always be present
    assert!(
        xml.contains("28ac9ce2-2aba-8cda-b3b5-6e922f71b6b8"),
        "GustavDev dependency UUID should be present"
    );
    assert!(xml.contains("<node id=\"Dependencies\">"));
    assert!(xml.contains("<node id=\"ModuleInfo\">"));
    assert!(xml.contains("</save>"));
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. build_export_plan
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_build_export_plan_aggregates_handlers() {
    let conn = create_test_staging_db();

    // Set up data for loca handler
    conn.execute_batch(
        "CREATE TABLE loca__english (
            contentuid TEXT PRIMARY KEY,
            version TEXT,
            text TEXT,
            _is_new INTEGER DEFAULT 0,
            _is_modified INTEGER DEFAULT 0,
            _is_deleted INTEGER DEFAULT 0,
            _file_id INTEGER,
            _SourceID TEXT
        );
        INSERT INTO loca__english (contentuid, version, text, _is_new)
            VALUES ('h00001', '1', 'Hello', 1);",
    )
    .unwrap();

    // Set up authoring for meta handler
    conn.execute_batch(
        "INSERT INTO _staging_authoring (key, value, _is_new)
            VALUES ('mod_uuid', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 1);
        INSERT INTO _staging_authoring (key, value, _is_new)
            VALUES ('mod_name', 'TestMod', 1);",
    )
    .unwrap();

    let ctx = make_context(conn, PathBuf::from("__fake_mod"));
    let handlers = default_handlers();

    let plan = build_export_plan(&ctx, &handlers).unwrap();

    // Should have at least: 1 loca unit + 1 meta unit
    assert!(
        plan.units.len() >= 2,
        "Expected at least 2 units (loca + meta), got {}",
        plan.units.len()
    );

    let handler_names: Vec<&str> = plan.units.iter().map(|u| u.handler_name.as_str()).collect();
    assert!(
        handler_names.contains(&"loca"),
        "Plan should include loca handler units"
    );
    assert!(
        handler_names.contains(&"MetaLsx"),
        "Plan should include MetaLsx handler units"
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. Delta classification tests
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_delta_classify_create() {
    let dir = tempfile::tempdir().unwrap();

    let mut plan = ExportPlan {
        units: vec![ExportUnit {
            handler_name: "test".to_string(),
            output_path: PathBuf::from("Public/TestMod/Foo.lsx"),
            action: FileAction::Create,
            entry_count: 5,
            content: Some(b"<xml>hello</xml>".to_vec()),
        }],
        orphan_files: vec![],
    };

    let delta = compute_file_delta(&mut plan, dir.path()).unwrap();

    assert_eq!(delta.creates.len(), 1, "New file → classified as Create");
    assert!(delta.updates.is_empty());
    assert!(delta.deletes.is_empty());
    assert!(delta.unchanged.is_empty());
    assert_eq!(delta.creates[0].unit.handler_name, "test");
    assert!(!delta.creates[0].is_orphan);
}

#[test]
fn test_delta_classify_unchanged() {
    let dir = tempfile::tempdir().unwrap();

    // Write a file on disk with known content
    let file_rel = PathBuf::from("Public/TestMod/Same.lsx");
    let file_abs = dir.path().join(&file_rel);
    std::fs::create_dir_all(file_abs.parent().unwrap()).unwrap();
    std::fs::write(&file_abs, b"identical content").unwrap();

    let mut plan = ExportPlan {
        units: vec![ExportUnit {
            handler_name: "test".to_string(),
            output_path: file_rel,
            action: FileAction::Update,
            entry_count: 3,
            content: Some(b"identical content".to_vec()),
        }],
        orphan_files: vec![],
    };

    let delta = compute_file_delta(&mut plan, dir.path()).unwrap();

    assert!(delta.creates.is_empty());
    assert!(delta.updates.is_empty());
    assert!(delta.deletes.is_empty());
    assert_eq!(
        delta.unchanged.len(),
        1,
        "Identical content on disk → Unchanged"
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. Writer tests
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_writer_empty_delta() {
    use bg3_cmty_studio_lib::export::delta::FileSystemDelta;

    let mut delta = FileSystemDelta::default();
    let report = write_files_atomic(&mut delta, false).unwrap();

    assert!(report.files_created.is_empty());
    assert!(report.files_updated.is_empty());
    assert!(report.files_deleted.is_empty());
    assert_eq!(report.files_unchanged, 0);
    assert_eq!(report.total_entries, 0);
    assert!(report.errors.is_empty());
}

#[test]
fn test_writer_create_and_delete() {
    use bg3_cmty_studio_lib::export::delta::{DeltaEntry, FileSystemDelta};

    let dir = tempfile::tempdir().unwrap();

    // Phase 1: Create a file through the writer
    let create_path = dir.path().join("Public/TestMod/New.lsx");
    let content = b"<xml>new file content</xml>".to_vec();

    let mut delta = FileSystemDelta {
        creates: vec![DeltaEntry {
            unit: ExportUnit {
                handler_name: "test".to_string(),
                output_path: PathBuf::from("Public/TestMod/New.lsx"),
                action: FileAction::Create,
                entry_count: 1,
                content: Some(content.clone()),
            },
            absolute_path: create_path.clone(),
            is_orphan: false,
        }],
        updates: vec![],
        deletes: vec![],
        unchanged: vec![],
    };

    let report = write_files_atomic(&mut delta, false).unwrap();
    assert_eq!(report.files_created.len(), 1);
    assert!(create_path.exists(), "File should have been created on disk");
    assert_eq!(
        std::fs::read(&create_path).unwrap(),
        b"<xml>new file content</xml>"
    );

    // Phase 2: Delete the file through the writer
    let mut delete_delta = FileSystemDelta {
        creates: vec![],
        updates: vec![],
        deletes: vec![DeltaEntry {
            unit: ExportUnit {
                handler_name: "test".to_string(),
                output_path: PathBuf::from("Public/TestMod/New.lsx"),
                action: FileAction::Delete,
                entry_count: 0,
                content: None,
            },
            absolute_path: create_path.clone(),
            is_orphan: false,
        }],
        unchanged: vec![],
    };

    let report2 = write_files_atomic(&mut delete_delta, false).unwrap();
    assert_eq!(report2.files_deleted.len(), 1);
    assert!(
        !create_path.exists(),
        "File should have been deleted from disk"
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// 9. Full export cycle
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_full_export_cycle() {
    let dir = tempfile::tempdir().unwrap();
    let mod_path = dir.path().to_path_buf();

    let conn = create_test_staging_db();

    // Set up loca data
    conn.execute_batch(
        "CREATE TABLE loca__english (
            contentuid TEXT PRIMARY KEY,
            version TEXT,
            text TEXT,
            _is_new INTEGER DEFAULT 0,
            _is_modified INTEGER DEFAULT 0,
            _is_deleted INTEGER DEFAULT 0,
            _file_id INTEGER,
            _SourceID TEXT
        );
        INSERT INTO loca__english (contentuid, version, text, _is_new)
            VALUES ('h10001', '1', 'Spell Name', 1);
        INSERT INTO loca__english (contentuid, version, text, _is_new)
            VALUES ('h10002', '1', 'Spell Description', 1);",
    )
    .unwrap();

    // Set up meta authoring
    conn.execute_batch(
        "INSERT INTO _staging_authoring (key, value, _is_new)
            VALUES ('mod_uuid', '12345678-1234-1234-1234-123456789abc', 1);
        INSERT INTO _staging_authoring (key, value, _is_new)
            VALUES ('mod_name', 'CycleTestMod', 1);
        INSERT INTO _staging_authoring (key, value, _is_new)
            VALUES ('mod_author', 'Tester', 1);
        INSERT INTO _staging_authoring (key, value, _is_new)
            VALUES ('mod_description', 'Full cycle test', 1);
        INSERT INTO _staging_authoring (key, value, _is_new)
            VALUES ('mod_version', '36028797018963968', 1);
        INSERT INTO _staging_authoring (key, value, _is_new)
            VALUES ('mod_folder', 'CycleTestFolder', 1);",
    )
    .unwrap();

    let ctx = ExportContext {
        staging_conn: conn,
        ref_base_path: PathBuf::from("__nonexistent_ref_base.sqlite"),
        mod_path: mod_path.clone(),
        mod_name: "CycleTestMod".to_string(),
        mod_folder: "CycleTestFolder".to_string(),
    };

    // Step 1: Plan
    let handlers = default_handlers();
    let mut plan = build_export_plan(&ctx, &handlers).unwrap();
    assert!(
        !plan.units.is_empty(),
        "Plan should have at least loca + meta units"
    );

    // Step 2: Render all units
    for unit in &mut plan.units {
        if unit.action == FileAction::Delete || unit.action == FileAction::Unchanged {
            continue;
        }
        // Find the handler that owns this unit
        let handler: &dyn FileTypeHandler = handlers
            .iter()
            .find(|h| h.name() == unit.handler_name)
            .map(|h| h.as_ref())
            .expect("Handler not found for unit");

        let bytes = handler.render(unit, &ctx).unwrap();
        unit.content = Some(bytes);
    }

    // Verify rendered content is present
    for unit in &plan.units {
        if unit.action == FileAction::Create || unit.action == FileAction::Update {
            assert!(
                unit.content.is_some(),
                "Unit {} should have rendered content",
                unit.output_path.display()
            );
        }
    }

    // Step 3: Compute delta
    let mut delta = compute_file_delta(&mut plan, &mod_path).unwrap();

    // All files are new (mod dir is empty temp dir), so everything should be Create
    assert!(
        !delta.creates.is_empty(),
        "All units should be classified as Create"
    );
    assert!(delta.updates.is_empty());

    // Step 4: Write
    let report = write_files_atomic(&mut delta, false).unwrap();
    assert!(report.errors.is_empty(), "No errors expected: {:?}", report.errors);
    assert!(
        !report.files_created.is_empty(),
        "Should have created files"
    );

    // Step 5: Verify files exist on disk
    for created in &report.files_created {
        let full_path = mod_path.join(&created.path);
        assert!(
            full_path.exists(),
            "Created file should exist on disk: {}",
            full_path.display()
        );
        let file_bytes = std::fs::read(&full_path).unwrap();
        assert!(
            !file_bytes.is_empty(),
            "Created file should not be empty: {}",
            created.path
        );
    }

    // Verify a meta.lsx was created
    let meta_created = report
        .files_created
        .iter()
        .any(|f| f.path.contains("meta.lsx"));
    assert!(meta_created, "meta.lsx should have been created");

    // Verify a loca XML was created
    let loca_created = report
        .files_created
        .iter()
        .any(|f| f.path.contains("english.xml"));
    assert!(loca_created, "english.xml loca file should have been created");
}
