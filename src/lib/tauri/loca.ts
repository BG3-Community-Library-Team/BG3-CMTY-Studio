import { invoke } from "@tauri-apps/api/core";
import { unwrap, type PaginatedResponse } from "./utils.js";

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
