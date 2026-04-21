import { invoke } from "@tauri-apps/api/core";
import { unwrap, type PaginatedResponse } from "./utils.js";

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

export async function getStatEntryFields(
  entryName: string,
  entryType: string,
): Promise<Record<string, string>> {
  return invoke("cmd_get_stat_entry_fields", { entryName, entryType });
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
