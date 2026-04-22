/**
 * Vanilla data category registry — DB-driven.
 *
 * Instead of a hardcoded 63-entry array, the system now discovers available
 * sections from the reference DB via `listAvailableSections()`. This file
 * provides the eager/lazy tier classification and synthetic category helpers.
 */
import type { VanillaEntryInfo, SectionInfo } from "../types/index.js";
import {
  querySectionEntries,
  getProgressionTableUuids,
  getVoiceTableUuids,
} from "../utils/tauri.js";

/** Category key is just a string (region_id or synthetic key). */
export type VanillaCategory = string;

/** A single loader definition (built dynamically from DB section list). */
export interface VanillaLoaderDef {
  key: string;
  loader: () => Promise<VanillaEntryInfo[]>;
  eager: boolean;
}

/** Region IDs that should load eagerly (Tier A/B/C). Everything else is lazy (Tier D). */
export const EAGER_REGION_IDS: ReadonlySet<string> = new Set([
  "Lists", "ActionResources", "ClassDescriptions", "Progressions",
  "Races", "Feats", "Origins", "Backgrounds", "BackgroundGoals",
  "ActionResourceGroups", "CharacterCreation", "CharacterCreationPresets",
  "Gods", "Tags", "Voices", "Visuals", "FeatDescriptions", "RootTemplates",
  "Levelmaps", "EquipmentTypes", "Shapeshift", "Flags", "ErrorDescriptions",
  "MultiEffectInfos", "Factions", "Spell", "Status",
  // Tooltip reference sections used by SpellData/PassiveData comboboxes
  "TooltipExtraTexts", "TooltipUpcastDescriptions",
]);

/** Synthetic categories that require dedicated backend commands (not a simple region query). */
const SYNTHETIC_LOADERS: Record<string, () => Promise<VanillaEntryInfo[]>> = {
  ProgressionTables: () => getProgressionTableUuids(),
  VoiceTables:       () => getVoiceTableUuids(),
};

/** All synthetic category keys. */
export const SYNTHETIC_CATEGORY_KEYS: string[] = Object.keys(SYNTHETIC_LOADERS);

/** Whether the given category is a synthetic (non-region) loader. */
export function isSyntheticCategory(key: string): boolean {
  return key in SYNTHETIC_LOADERS;
}

/**
 * Build vanilla data loaders dynamically from the DB section list.
 *
 * @param sections  SectionInfo[] from `listAvailableSections()`
 * @returns Array of loader definitions ready for scanService to fire
 */
export function buildVanillaLoaders(
  sections: SectionInfo[],
): VanillaLoaderDef[] {
  // Only LSX sections go into the vanilla registry (stats/loca have dedicated loaders)
  const lsxSections = sections.filter(s => s.source_type === "lsx");

  const loaders: VanillaLoaderDef[] = lsxSections.map(s => ({
    key: s.region_id,
    loader: () => querySectionEntries(s.region_id),
    eager: EAGER_REGION_IDS.has(s.region_id),
  }));

  // Synthetic loaders (ProgressionTables, VoiceTables)
  for (const [key, loaderFn] of Object.entries(SYNTHETIC_LOADERS)) {
    loaders.push({
      key,
      loader: () => loaderFn(),
      eager: true,
    });
  }

  return loaders;
}
