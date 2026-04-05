import { invoke } from "@tauri-apps/api/core";
import { invokeWithTimeout } from "./utils.js";
import type { BuildSummary } from "./pipeline.js";

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
