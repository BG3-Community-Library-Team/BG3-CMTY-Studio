import { invokeWithTimeout } from "./utils.js";

// ---- vanilla/mod processing integration ----

export interface PopulateResult {
  paks_extracted: number;
  files_kept: number;
  lsf_converted: number;
  unpack_path: string;
  errors: string[];
  diagnostics: string[];
}

export async function populateVanillaDbs(
  gameDataPath: string,
): Promise<PopulateResult> {
  return invokeWithTimeout("cmd_populate_game_data", { gameDataPath }, 300_000);
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
