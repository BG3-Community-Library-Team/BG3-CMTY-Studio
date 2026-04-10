/**
 * Lightweight LSX region parsing utilities.
 * Extracts <region id="..."> tags from LSX XML content and maps them to Section names.
 */

import type { Section } from "../types/index.js";

/**
 * Inverse of SECTION_REGION_MAP from entryToLsx.ts.
 * Maps region IDs back to their Section names.
 * Only includes entries where the region ID differs from the section name.
 */
const REGION_TO_SECTION: Record<string, Section> = {
  ActionResourceDefinitions: "ActionResources",
  ActionResourceGroupDefinitions: "ActionResourceGroups",
  Spell: "SpellMetadata",
  Status: "StatusMetadata",
  Config: "Meta",
  FactionContainer: "Factions",
  DisturbanceProperties: "Disturbances",
  LevelMapValues: "Levelmaps",
  TooltipExtraTexts: "TooltipExtras",
  WeightCategories: "Encumbrance",
  ConditionErrors: "ErrorDescriptions",
  Templates: "RootTemplates",
  Rulesets: "Ruleset",
};

/**
 * Extract region IDs from LSX XML content using regex.
 * Returns deduplicated array of region id strings found in <region id="..."> tags.
 */
export function extractLsxRegions(xmlContent: string): string[] {
  const regions: string[] = [];
  const regex = /<region\s+id="([^"]+)"/gi;
  let match;
  while ((match = regex.exec(xmlContent)) !== null) {
    regions.push(match[1]);
  }
  return [...new Set(regions)];
}

/**
 * Map a region ID to a Section name.
 * Uses the inverse lookup for known remapped regions, otherwise returns the region ID as-is
 * (most region IDs match section names directly).
 */
export function regionToSection(regionId: string): string {
  return REGION_TO_SECTION[regionId] ?? regionId;
}

/**
 * Parse LSX content and return the best Section name for form display.
 * Returns the section derived from the first region, or empty string if no regions found.
 */
export function inferSectionFromLsxContent(xmlContent: string): string {
  const regions = extractLsxRegions(xmlContent);
  if (regions.length === 0) return "";
  return regionToSection(regions[0]);
}

/**
 * Parse LSX content and return ALL section names for multi-region files.
 * Returns deduplicated array of section names derived from all regions.
 */
export function inferAllSectionsFromLsxContent(xmlContent: string): string[] {
  const regions = extractLsxRegions(xmlContent);
  return regions.map(regionToSection);
}
