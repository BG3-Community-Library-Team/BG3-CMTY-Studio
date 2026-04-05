import { invoke } from "@tauri-apps/api/core";
import type {
  ScanResult,
  SelectedEntry,
  SerializeOptions,
  AnchorGroup,
  VanillaEntryInfo,
  SectionInfo,
} from "../types/index.js";
import type { ManualEntry } from "../stores/configStore.svelte.js";

/**
 * IPC Parameter Conventions:
 * - Empty string `""` = "all" for String filter params (e.g. `entryType: ""` returns all types)
 * - `undefined` / `null` = omit optional params (maps to Rust `Option::None`)
 */

/** T2-2 / IPC-06: Paginated response envelope from Rust commands. */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
}

/** Extract items from a paginated response, preserving backward-compatible usage. */
function unwrap<T>(resp: PaginatedResponse<T>): T[] {
  return resp.items;
}

/** IPC-ERR-16: Invoke with a timeout to prevent indefinite hangs. */
export async function invokeWithTimeout<T>(
  cmd: string,
  args?: Record<string, unknown>,
  timeoutMs: number = 60_000,
): Promise<T> {
  return Promise.race([
    invoke<T>(cmd, args),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`IPC call '${cmd}' timed out after ${timeoutMs}ms`)),
        timeoutMs,
      ),
    ),
  ]);
}

export async function scanMod(
  modPath: string,
  extraScanPaths?: string[],
  isPrimary?: boolean
): Promise<ScanResult> {
  return invokeWithTimeout("cmd_scan_mod", { modPath, extraScanPaths: extraScanPaths ?? null, isPrimary: isPrimary ?? null }, 120_000);
}

// ---- Dynamic section discovery (DB-driven) ----

/** List all populated sections from the reference DB. No hardcoded enum needed. */
export async function listAvailableSections(): Promise<SectionInfo[]> {
  return invoke("cmd_list_available_sections");
}

/** Query entries for any section by region_id. Unified replacement for
 *  getVanillaEntries + getEntriesByFolder. */
export async function querySectionEntries(
  regionId: string,
  limit?: number,
  offset?: number,
): Promise<VanillaEntryInfo[]> {
  const resp = await invoke<PaginatedResponse<VanillaEntryInfo>>("cmd_query_section_entries", { regionId, limit: limit ?? null, offset: offset ?? null });
  return unwrap(resp);
}

export async function getVanillaEntries(
  section: string,
  limit?: number,
  offset?: number,
): Promise<VanillaEntryInfo[]> {
  const resp = await invoke<PaginatedResponse<VanillaEntryInfo>>("cmd_get_vanilla_entries", { section, limit: limit ?? null, offset: offset ?? null });
  return unwrap(resp);
}

export async function generateConfig(
  entries: SelectedEntry[],
  options: SerializeOptions
): Promise<string> {
  return invoke("cmd_generate_config", { entries, options });
}

export async function saveConfig(
  content: string,
  outputPath: string,
  backup: boolean
): Promise<void> {
  return invoke("cmd_save_config", { content, outputPath, backup });
}

/** Rename (move) a directory on disk. */
export async function renameDir(
  fromPath: string,
  toPath: string,
): Promise<void> {
  return invoke("cmd_rename_dir", { fromPath, toPath });
}

export async function detectAnchors(
  entries: SelectedEntry[],
  threshold: number
): Promise<AnchorGroup[]> {
  return invoke("cmd_detect_anchors", { entries, threshold });
}

export async function readExistingConfig(
  configPath: string
): Promise<string> {
  return invoke("cmd_read_existing_config", { configPath });
}

export async function getEntriesByFolder(
  folderName: string
): Promise<VanillaEntryInfo[]> {
  return invoke("cmd_get_entries_by_folder", { folderName });
}

// ---- Stats & ValueLists ----

export interface StatEntryInfo {
  name: string;
  entry_type: string;
}

export interface ValueListInfo {
  key: string;
  values: string[];
}

/** Get stat entry names, optionally filtered by type (e.g. "SpellData", "PassiveData"). */
export async function getStatEntries(
  entryType: string = "",
  limit?: number,
  offset?: number,
): Promise<StatEntryInfo[]> {
  const resp = await invoke<PaginatedResponse<StatEntryInfo>>("cmd_get_stat_entries", { entryType, limit: limit ?? null, offset: offset ?? null });
  return unwrap(resp);
}

/** Get stat entries parsed from the scanned mod (cached after scan_mod). */
export async function getModStatEntries(modPath: string): Promise<StatEntryInfo[]> {
  return invoke("cmd_get_mod_stat_entries", { modPath });
}

/** Get unique stat field names (data keys from .txt files), optionally filtered by entry_type. */
export async function getStatFieldNames(
  entryType: string = ""
): Promise<string[]> {
  return invoke("cmd_get_stat_field_names", { entryType });
}

export interface StatsEntry {
  name: string;
  entry_type: string;
  parent: string | null;
  data: Record<string, string>;
}

/** Serialize Stats entries to BG3 .txt format. */
export async function writeStats(entries: StatsEntry[]): Promise<string> {
  return invoke("cmd_write_stats", { entries });
}

/** Get ValueLists.txt data, optionally filtered by key (e.g. "Ability", "Skill"). */
export async function getValueLists(
  listKey: string = ""
): Promise<ValueListInfo[]> {
  return invoke("cmd_get_value_lists", { listKey });
}

// ---- Localization ----

export interface LocaEntry {
  handle: string;
  text: string;
}

/** CQ-016: Paginated result with parse warnings from Rust. */
export interface ParseResultWithWarnings<T> {
  data: PaginatedResponse<T>;
  warnings: string[];
}

/** CQ-016: Mod localization result with entries and parse warnings. */
export interface ModLocaResult {
  entries: LocaEntry[];
  warnings: string[];
}

/** Get localization data (handle UUID → display text) from unpacked vanilla Localization XML.
 *  Does NOT use the shared `unwrap()` helper because the Rust response wraps
 *  `PaginatedResponse` inside a `ParseResultWithWarnings` envelope that also
 *  carries `.warnings` metadata needed by the caller. */
export async function getLocalizationMap(
  limit?: number,
  offset?: number,
): Promise<{ entries: LocaEntry[]; warnings: string[] }> {
  const resp = await invoke<ParseResultWithWarnings<LocaEntry>>("cmd_get_localization_map", { limit: limit ?? null, offset: offset ?? null });
  return { entries: unwrap(resp.data), warnings: resp.warnings };
}

/** Get localization entries from an unpacked mod's Localization directory. */
export async function getModLocalization(
  modPath: string
): Promise<{ entries: LocaEntry[]; warnings: string[] }> {
  const result = await invoke<ModLocaResult>("cmd_get_mod_localization", { modPath });
  return { entries: result.entries, warnings: result.warnings };
}

/** Generate BG3-format localization XML from auto-localization entries.
 *  If existingXml is provided, merges with it (updates matching, appends new). */
export async function generateLocalizationXml(
  entries: { contentuid: string; version: number; text: string }[],
  existingXml?: string,
): Promise<string> {
  return invoke<string>("cmd_generate_localization_xml", {
    entries,
    existingXml: existingXml ?? null,
  });
}

// ---- vanilla/mod processing integration ----

export interface PopulateResult {
  paks_extracted: number;
  files_kept: number;
  lsf_converted: number;
  unpack_path: string;
  errors: string[];
  diagnostics: string[];
}

export interface ModProcessResult {
  lsf_converted: number;
  unpack_path: string;
  errors: string[];
  /** Parsed mod meta from .pak extraction (null for directory mods). */
  mod_meta: ModMetaInfo | null;
  /** Whether the mod has a Public folder (mods without one are unlikely to have CF-relevant content). */
  has_public_folder: boolean;
}

export async function populateVanillaDbs(
  gameDataPath: string,
): Promise<PopulateResult> {
  return invokeWithTimeout("cmd_populate_game_data", { gameDataPath }, 300_000);
}

export async function processModFolder(
  modPath: string,
  modName: string
): Promise<ModProcessResult> {
  return invokeWithTimeout("cmd_process_mod_folder", { modPath, modName }, 120_000);
}

export async function dirSize(dirPath: string): Promise<number> {
  return invoke("cmd_dir_size", { dirPath });
}

export interface ModMetaInfo {
  uuid: string;
  folder: string;
  name: string;
  author: string;
  version: string;
  version64: string;
  description: string;
  md5: string;
  mod_type: string;
  tags: string;
  num_players: string;
  gm_template: string;
  char_creation_level: string;
  lobby_level: string;
  menu_level: string;
  startup_level: string;
  photo_booth: string;
  main_menu_bg_video: string;
  publish_version: string;
  target_mode: string;
  dependencies: import("../types/index.js").MetaDependency[];
}

export async function readModMeta(modPath: string): Promise<ModMetaInfo> {
  return invoke("cmd_read_mod_meta", { modPath });
}

export async function rediffMod(
  primaryModPath: string,
  compareModPath: string,
): Promise<import("../types/index.js").SectionResult[]> {
  return invoke("cmd_rediff_mod", { primaryModPath, compareModPath });
}

// ---- List item lookup ----

export interface ListItemsInfo {
  uuid: string;
  node_id: string;
  display_name: string;
  items: string[];
  item_key: string;
}

/** Look up the items contained in vanilla List entries by their UUIDs. */
export async function getListItems(
  uuids: string[]
): Promise<ListItemsInfo[]> {
  return invoke("cmd_get_list_items", { uuids });
}

// ---- Equipment ----

/** Get equipment set names from vanilla Equipment.txt files. */
export async function getEquipmentNames(): Promise<string[]> {
  return invoke("cmd_get_equipment_names");
}

// ---- ProgressionTable UUIDs ----

/** Get unique ProgressionTableUUIDs from vanilla Progressions, ClassDescriptions, and Races. */
export async function getProgressionTableUuids(): Promise<VanillaEntryInfo[]> {
  return invoke("cmd_get_progression_table_uuids");
}

// ---- VoiceTable UUIDs ----

/** Get unique VoiceTable UUIDs from vanilla Voice entries (TableUUID attribute). */
export async function getVoiceTableUuids(): Promise<VanillaEntryInfo[]> {
  return invoke("cmd_get_voice_table_uuids");
}

// ---- SelectorId values ----

export interface SelectorIdInfo {
  id: string;
  source: string;
}

/** Scrape unique SelectorId attribute values from ProgressionDescriptions.lsx across vanilla + extra mod paths. */
export async function getSelectorIds(
  extraPaths?: string[],
  limit?: number,
  offset?: number,
): Promise<SelectorIdInfo[]> {
  const resp = await invoke<PaginatedResponse<SelectorIdInfo>>("cmd_get_selector_ids", { extraPaths: extraPaths ?? null, limit: limit ?? null, offset: offset ?? null });
  return unwrap(resp);
}

// ---- Load Order ----

/** List all .pak files in the BG3 Mods directory (%LOCALAPPDATA%/Larian Studios/Baldur's Gate 3/Mods). */
export async function listLoadOrderPaks(): Promise<string[]> {
  return invoke("cmd_list_load_order_paks");
}

/** Get active mod folder names from the most recent modsettings.lsx profile. */
export async function getActiveModFolders(): Promise<string[]> {
  return invoke("cmd_get_active_mod_folders");
}

// ---- Auto-detect & discovery ----

/** Auto-detect the BG3 game Data folder via Windows Registry (Steam & GOG). */
export async function detectGameDataPath(): Promise<string | null> {
  return invoke("cmd_detect_game_data_path");
}

/** Check whether the Game Data folder contains expected vanilla .pak files. */
export async function validateGameDataPath(gameDataPath: string): Promise<boolean> {
  return invoke("cmd_validate_game_data_path", { gameDataPath });
}

/** Open a file or directory path in the native OS file explorer. */
export async function openPath(path: string): Promise<void> {
  return invoke("cmd_open_path", { path });
}

/** Generate config preview via Rust IPC (supports manual entries + overrides). */
export async function previewConfig(
  entries: SelectedEntry[],
  manualEntries: ManualEntry[],
  autoEntryOverrides: Record<string, Record<string, string>>,
  format: "yaml" | "json",
  includeComments: boolean,
  enableSectionComments: boolean,
  enableEntryComments: boolean,
): Promise<string> {
  return invoke("cmd_preview_config", {
    entries,
    manualEntries,
    autoEntryOverrides,
    format,
    includeComments,
    enableSectionComments,
    enableEntryComments,
  });
}

// ---- LSX Output ----

/** An entry prepared for LSX preview/export. */
export interface LsxPreviewEntry {
  uuid: string;
  node_id: string;
  raw_attributes: Record<string, string>;
  raw_attribute_types: Record<string, string>;
  raw_children: Record<string, string[]>;
}

/** Preview LSX XML output for a set of entries. */
export async function previewLsx(
  entries: LsxPreviewEntry[],
  regionId: string,
): Promise<string> {
  return invoke("cmd_preview_lsx", { entries, regionId });
}

/** Save entries as an .lsx file to disk. */
export async function saveLsx(
  entries: LsxPreviewEntry[],
  regionId: string,
  outputPath: string,
): Promise<void> {
  return invoke("cmd_save_lsx", { entries, regionId, outputPath });
}

// ---- Multi-file Mod Export ----

/** A single file specification for batch mod export. */
export interface ExportFileSpec {
  output_path: string;
  region_id: string;
  entries: LsxPreviewEntry[];
}

/** Information about a single exported file. */
export interface ExportedFile {
  path: string;
  entry_count: number;
  bytes_written: number;
  backed_up: boolean;
}

/** Result of a full mod export operation. */
export interface ExportModResult {
  files: ExportedFile[];
  errors: string[];
  file_errors: Record<string, string[]>;
}

/** Export an entire mod: batch-write LSX files + optional CF config in one operation. */
export async function exportMod(
  lsxFiles: ExportFileSpec[],
  configContent: string | null,
  configPath: string | null,
  backup: boolean,
): Promise<ExportModResult> {
  return invoke("cmd_export_mod", { lsxFiles, configContent, configPath, backup });
}

/** Get the LSX region ID for a CF section name. */
export async function regionIdForSection(
  section: string,
): Promise<string> {
  return invoke("cmd_region_id_for_section", { section });
}

// ─── Schema Inference ──────────────────────────────────────────────────

export interface AttrSchema {
  name: string;
  attr_type: string;
  frequency: number;
  examples: string[];
}

export interface ChildSchema {
  group_id: string;
  child_node_id: string;
  frequency: number;
}

export interface NodeSchema {
  node_id: string;
  section: string;
  sample_count: number;
  attributes: AttrSchema[];
  children: ChildSchema[];
}

/** Infer LSX schemas from vanilla data. */
export async function inferSchemas(): Promise<NodeSchema[]> {
  return invoke("cmd_infer_schemas");
}

// ─── Mod Scaffold ──────────────────────────────────────────────────

export interface CreateModResult {
  mod_root: string;
  meta_path: string;
  public_path: string;
  has_script_extender: boolean;
}

/** Create a new mod folder scaffold with meta.lsx, Public/ dir, and optional SE dir. */
export async function createModScaffold(
  targetDir: string,
  modName: string,
  author: string,
  description: string,
  useScriptExtender: boolean,
  folder: string = "",
  version: string = "1.0.0.0",
): Promise<CreateModResult> {
  return invoke("cmd_create_mod_scaffold", { targetDir, modName, author, description, useScriptExtender, folder, version });
}

// ─── Granular Extraction ───────────────────────────────────────────

export interface PakSectionInfo {
  folder: string;
  file_count: number;
}

/** List which data sections exist inside a .pak file without extracting. */
export async function listPakSections(
  pakPath: string,
): Promise<PakSectionInfo[]> {
  return invoke("cmd_list_pak_sections", { pakPath });
}

// ---- Mod File Preview ----

/** A text file discovered within the mod directory. */
export interface ModFileEntry {
  rel_path: string;
  extension: string;
  size: number;
}

/** List previewable text files (.md, .txt, .lua, .json, .yaml, etc.) in a mod directory. */
export async function listModFiles(modPath: string): Promise<ModFileEntry[]> {
  return invoke("cmd_list_mod_files", { modPath });
}

/** Read the text content of a file within a mod directory. */
export async function readModFile(modPath: string, relPath: string): Promise<string> {
  return invoke("cmd_read_mod_file", { modPath, relPath });
}

// ---- Database management ----

export interface DbPaths {
  base: string;
  honor: string;
  mods: string;
  staging: string;
  dir: string;
}

export interface DbFileStatus {
  name: string;
  path: string;
  exists: boolean;
  size_bytes: number;
}

/** Get the resolved paths to the writable schema databases (creating dirs if needed). */
export async function getDbPaths(): Promise<DbPaths> {
  return invoke("cmd_get_db_paths");
}

/** Get the status (exists, size) of each schema database file. */
export async function getDbStatus(): Promise<DbFileStatus[]> {
  return invoke("cmd_get_db_status");
}

/** Reset all schema databases to their clean (empty) state by re-copying from bundled resources. */
export async function resetDatabases(): Promise<DbPaths> {
  return invoke("cmd_reset_databases");
}

/** Reset only reference databases (ref_base, ref_honor, ref_mods) to clean state, leaving staging untouched. */
export async function resetReferenceDbs(): Promise<DbPaths> {
  return invoke("cmd_reset_reference_dbs");
}

/** Recreate only the staging database (fresh copy from bundled schema). Returns the staging DB path. */
export async function recreateStaging(): Promise<string> {
  return invoke("cmd_recreate_staging");
}

/** Populate the staging database from an existing mod's files on disk. */
export async function populateStagingFromMod(
  modPath: string,
  modName: string,
  stagingDbPath: string,
  vacuum: boolean = false,
): Promise<BuildSummary> {
  return invokeWithTimeout("cmd_populate_staging_from_mod", { modPath, modName, stagingDbPath, vacuum }, 300_000);
}

/** Run PRAGMA integrity_check on the staging database. Returns null if ok, or details string if issues. */
export async function checkStagingIntegrity(): Promise<string | null> {
  return invoke("cmd_check_staging_integrity");
}

// ---- ref_mods operations ----

/** Ingest a mod's data into ref_mods.sqlite. */
export async function populateModsDb(
  modPath: string,
  modName: string,
  dbPath: string,
  vacuum: boolean = false,
): Promise<BuildSummary> {
  return invokeWithTimeout("cmd_populate_mods_db", { modPath, modName, dbPath, vacuum }, 300_000);
}

/** Remove a single mod's data from ref_mods.sqlite by name. Returns rows deleted. */
export async function removeModFromModsDb(
  modName: string,
  dbPath: string,
): Promise<number> {
  return invoke("cmd_remove_mod_from_mods_db", { modName, dbPath });
}

/** Clear all mod data from ref_mods.sqlite (keeps schema). Returns rows deleted. */
export async function clearModsDb(
  dbPath: string,
): Promise<number> {
  return invoke("cmd_clear_mods_db", { dbPath });
}

// ---- Pipeline (unpack + populate) ----

export interface PhaseTimes {
  collect_files: number;
  discovery: number;
  ddl_creation: number;
  data_insert: number;
  merge: number;
  post_process: number;
  write_to_disk: number;
  vacuum: number;
}

export interface BuildSummary {
  db_path: string;
  total_files: number;
  total_rows: number;
  total_tables: number;
  fk_constraints: number;
  file_errors: number;
  row_errors: number;
  elapsed_secs: number;
  db_size_mb: number;
  phase_times: PhaseTimes;
}

export interface PipelineSummary {
  elapsed_secs: number;
  paks_extracted: number;
  files_extracted: number;
  lsf_converted: number;
  loca_converted: number;
  base_summary: BuildSummary | null;
  honor_summary: BuildSummary | null;
  errors: string[];
  diagnostics: string[];
}

export interface PipelineProgress {
  phase: string;
  detail: string;
  percent: number;
  elapsed_secs: number;
}

/** Run the full unpack-and-populate pipeline. Emits `pipeline-progress` events during execution. */
export async function populateGameData(
  divinePath: string,
  gameDataPath: string,
  workDir: string,
  baseDbPath: string,
  honorDbPath: string,
  populateHonor: boolean = false,
  vacuum: boolean = true,
  cleanup: boolean = true,
): Promise<PipelineSummary> {
  return invokeWithTimeout("cmd_unpack_and_populate", {
    divinePath,
    gameDataPath,
    workDir,
    baseDbPath,
    honorDbPath,
    populateHonor,
    vacuum,
    cleanup,
  }, 300_000);
}

// ─── Reference DB Build / Populate ─────────────────────────────────

/** Build reference DB from unpacked vanilla data directory. */
export async function buildReferenceDb(
  unpackedPath: string,
  dbPath: string,
): Promise<BuildSummary> {
  return invokeWithTimeout("cmd_build_reference_db", { unpackedPath, dbPath }, 1_200_000);
}

/** Populate reference DB (base) from unpacked data. */
export async function populateReferenceDb(
  unpackedPath: string,
  dbPath: string,
  vacuum: boolean = false,
): Promise<BuildSummary> {
  return invokeWithTimeout("cmd_populate_reference_db", { unpackedPath, dbPath, vacuum }, 1_200_000);
}

/** Populate honor variant reference DB. Optional baseDbPath for fallback lookups. */
export async function populateHonorDb(
  unpackedPath: string,
  dbPath: string,
  vacuum: boolean = false,
  baseDbPath?: string,
): Promise<BuildSummary> {
  return invokeWithTimeout("cmd_populate_honor_db", { unpackedPath, dbPath, vacuum, baseDbPath: baseDbPath ?? null }, 600_000);
}

// ─── Staging DB ────────────────────────────────────────────────────

export interface StagingSummary {
  db_path: string;
  total_tables: number;
  junction_tables: number;
  elapsed_secs: number;
  db_size_mb: number;
}

/** Create staging DB from a schema (ref_base) DB. */
export async function createStagingDb(
  schemaDbPath: string,
  stagingDbPath: string,
): Promise<StagingSummary> {
  return invokeWithTimeout("cmd_create_staging_db", { schemaDbPath, stagingDbPath }, 60_000);
}

// ─── Cross-DB FK Validation ────────────────────────────────────────

export interface FkViolation {
  table: string;
  rowid: number;
  from_column: string;
  value: string;
  target_table: string;
  target_column: string;
}

export interface CrossDbFkReport {
  unresolved: FkViolation[];
  cross_resolved: number;
  total_checked: number;
  attached_schemas: string[];
}

/** Validate foreign keys across attached databases. */
export async function validateCrossDbFks(
  dbPath: string,
  attachPaths: [string, string][],
): Promise<CrossDbFkReport> {
  return invokeWithTimeout("cmd_validate_cross_db_fks", { dbPath, attachPaths }, 300_000);
}

// ─── Secure Storage ────────────────────────────────────────────────

/** Get a value from OS-level secure storage. Returns empty string if not found. */
export async function getSecureSetting(key: string): Promise<string> {
  return invoke("cmd_get_secure_setting", { key });
}

/** Write a value to OS-level secure storage. Pass empty string to delete the entry. */
export async function setSecureSetting(key: string, value: string): Promise<void> {
  return invoke("cmd_set_secure_setting", { key, value });
}
