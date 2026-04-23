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

export interface CostResourceInfo {
  name: string;
  display_name: string;
  max_level: number;
  kind: string;
}

/** Look up the items contained in vanilla List entries by their UUIDs. */
export async function getListItems(
  uuids: string[]
): Promise<ListItemsInfo[]> {
  return invoke("cmd_get_list_items", { uuids });
}

/** Load ActionResource definitions and group definitions used by stats cost fields. */
export async function getCostResources(): Promise<CostResourceInfo[]> {
  return invoke("cmd_get_cost_resources");
}

// ---- Equipment ----

/** Get equipment set names from vanilla Equipment.txt files. */
export async function getEquipmentNames(): Promise<string[]> {
  return invoke("cmd_get_equipment_names");
}

/** Get icon MapKey names from all IconUVList tables in the reference DB. */
export async function getIconNames(): Promise<string[]> {
  return invoke("cmd_get_icon_names");
}

/** UV coordinates + atlas path for a single icon as returned by the reference/staging DB.
 *  Raw form — atlas_path is relative to the Public/Game/GUI or mod Public/<folder> root. */
export interface VanillaIconAtlasEntry {
  map_key: string;
  /** Path attribute from TextureAtlasPath node, e.g. "Assets/Textures/Icons/Icons_Skills.dds" */
  atlas_path: string;
  u1: number;
  v1: number;
  u2: number;
  v2: number;
}

/**
 * Resolved icon atlas entry with pre-computed DDS path arguments for cmd_convert_dds_to_png.
 * Stored in modStore.iconAtlasData after annotation in scanService.
 */
export interface IconAtlasEntry {
  map_key: string;
  /** Relative path to pass as `path` to cmd_convert_dds_to_png */
  dds_path: string;
  /** Directory to pass as `projectDir` to cmd_convert_dds_to_png */
  project_dir: string;
  u1: number;
  v1: number;
  u2: number;
  v2: number;
}

/** Get atlas UV data for all icons from the reference (vanilla) DB. */
export async function getIconAtlasData(): Promise<VanillaIconAtlasEntry[]> {
  return invoke("cmd_get_icon_atlas_data");
}

/** Get atlas UV data for icons defined in the active mod's staging DB. */
export async function getStagingIconAtlasData(): Promise<VanillaIconAtlasEntry[]> {
  return invoke("cmd_get_staging_icon_atlas_data");
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
