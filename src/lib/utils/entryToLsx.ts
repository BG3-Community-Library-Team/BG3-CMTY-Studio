/**
 * Utilities for converting DiffEntry data into LsxPreviewEntry objects
 * suitable for the LSX preview/export Rust IPC commands.
 */

import type { DiffEntry, SectionResult, Section } from "../types/index.js";
import type { LsxPreviewEntry } from "./tauri.js";

/** Section → LSX region ID mapping (mirrors Rust's section_to_region_id).
 *  Only sections where regionId differs from the section name need explicit entries.
 *  getRegionId() falls back to section name for others. */
const SECTION_REGION_MAP: Partial<Record<Section, string>> = {
  ActionResources: "ActionResourceDefinitions",
  ActionResourceGroups: "ActionResourceGroupDefinitions",
  SpellMetadata: "Spell",
  StatusMetadata: "Status",
  Meta: "Config",
  Factions: "FactionContainer",
  Disturbances: "DisturbanceProperties",
  Levelmaps: "LevelMapValues",
  TooltipExtras: "TooltipExtraTexts",
  Encumbrance: "WeightCategories",
  ErrorDescriptions: "ConditionErrors",
  RootTemplates: "Templates",
  Ruleset: "Rulesets",
};

/** Get the LSX region ID for a CF section. */
export function getRegionId(section: Section): string {
  return SECTION_REGION_MAP[section] ?? section;
}

/** Convert a DiffEntry to an LsxPreviewEntry for the Rust IPC. */
export function diffEntryToLsx(entry: DiffEntry): LsxPreviewEntry {
  return {
    uuid: entry.uuid,
    node_id: entry.node_id,
    raw_attributes: entry.raw_attributes,
    raw_attribute_types: entry.raw_attribute_types ?? {},
    raw_children: entry.raw_children,
  };
}

/** Convert all entries in a SectionResult to LsxPreviewEntry[]. */
export function sectionToLsxEntries(section: SectionResult): LsxPreviewEntry[] {
  return section.entries.map(diffEntryToLsx);
}

/**
 * Group entries by region ID for multi-file LSX export.
 * Returns a map of regionId → LsxPreviewEntry[].
 */
export function groupEntriesByRegion(
  sections: SectionResult[],
): Map<string, LsxPreviewEntry[]> {
  const map = new Map<string, LsxPreviewEntry[]>();
  for (const section of sections) {
    const regionId = getRegionId(section.section);
    const entries = sectionToLsxEntries(section);
    const existing = map.get(regionId);
    if (existing) {
      existing.push(...entries);
    } else {
      map.set(regionId, entries);
    }
  }
  return map;
}
