import { invoke } from "@tauri-apps/api/core";
import type { VanillaEntryInfo, SectionInfo } from "../types/index.js";
import { unwrap, type PaginatedResponse } from "./utils.js";

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

export async function getEntriesByFolder(
  folderName: string
): Promise<VanillaEntryInfo[]> {
  return invoke("cmd_get_entries_by_folder", { folderName });
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
