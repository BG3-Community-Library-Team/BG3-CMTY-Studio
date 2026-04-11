/**
 * Lightweight LSX region parsing utilities.
 * Extracts <region id="..."> tags from LSX XML content and maps them to Section names.
 */

import type { Section, DiffEntry, SectionResult } from "../types/index.js";

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

/**
 * Parse LSX XML content into SectionResult objects with DiffEntry entries.
 * Uses regex-based parsing (no DOMParser) so it works in both browser and Node.js.
 * Used for the File Tree form view where we need entries from a single file
 * without diffing against vanilla. All entries get entry_kind = "New".
 */
export function parseLsxContentToSections(xmlContent: string): SectionResult[] {
  if (!xmlContent.trim()) return [];
  const results: SectionResult[] = [];

  // Extract each <region id="...">...</region> block
  const regionRe = /<region\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/region>/gi;
  let regionMatch;
  while ((regionMatch = regionRe.exec(xmlContent)) !== null) {
    const regionId = regionMatch[1];
    const regionBody = regionMatch[2];
    const section = regionToSection(regionId);
    const entries: DiffEntry[] = [];

    // Find root node, then extract its <children> block with depth tracking
    const rootNodeRe = /<node\s+id="root"[^>]*>/i;
    const rootNodeMatch = rootNodeRe.exec(regionBody);
    if (!rootNodeMatch) continue;
    const rootInner = regionBody.slice(rootNodeMatch.index + rootNodeMatch[0].length);
    const rootChildrenContent = extractChildrenContent(rootInner);
    if (!rootChildrenContent) continue;

    // Parse each top-level <node> entry within root's children
    const entryNodes = parseTopLevelNodes(rootChildrenContent);
    for (const entryNode of entryNodes) {
      const attrs: Record<string, string> = {};
      const attrTypes: Record<string, string> = {};
      const children: Record<string, string[]> = {};

      // Extract <attribute> elements from this node
      const attrRe = new RegExp('<attribute\\s+id="([^"]+)"\\s+type="([^"]+)"\\s+value="([^"]*)"\\s*\\/>', 'gi');
      let attrMatch;
      while ((attrMatch = attrRe.exec(entryNode.body)) !== null) {
        attrs[attrMatch[1]] = attrMatch[3];
        attrTypes[attrMatch[1]] = attrMatch[2];
      }

      // Extract child groups with depth-aware parsing
      const directChildren = extractChildrenContent(entryNode.body);
      if (directChildren) {
        const groupNodes = parseTopLevelNodes(directChildren);
        for (const groupNode of groupNodes) {
          const groupId = groupNode.id;
          if (!groupId) continue;
          const guids: string[] = [];
          const innerChildren = extractChildrenContent(groupNode.body);
          if (innerChildren) {
            const innerObjRe = new RegExp('<attribute\\s+id="(?:Object|MapKey)"\\s+type="[^"]+"\\s+value="([^"]*)"\\s*\\/>', 'gi');
            let objMatch;
            while ((objMatch = innerObjRe.exec(innerChildren)) !== null) {
              if (objMatch[1]) guids.push(objMatch[1]);
            }
          }
          if (guids.length > 0) {
            children[groupId] = guids;
          }
        }
      }

      const uuid = attrs["UUID"] ?? attrs["MapKey"] ?? crypto.randomUUID();
      const displayName = attrs["Name"] ?? attrs["DisplayName"] ?? uuid.slice(0, 8);

      entries.push({
        uuid,
        display_name: displayName,
        source_file: "",
        entry_kind: "New",
        changes: [],
        node_id: entryNode.id,
        region_id: regionId,
        raw_attributes: attrs,
        raw_attribute_types: attrTypes,
        raw_children: children,
      });
    }

    if (entries.length > 0) {
      results.push({ section: section as Section, entries });
    }
  }

  return results;
}

/** Extract content of the first <children>...</children> block, handling nested children properly. */
function extractChildrenContent(xml: string): string | null {
  const openTag = "<children>";
  const closeTag = "</children>";
  const startIdx = xml.indexOf(openTag);
  if (startIdx === -1) return null;
  const contentStart = startIdx + openTag.length;
  let depth = 1;
  let pos = contentStart;
  while (pos < xml.length && depth > 0) {
    const nextOpen = xml.indexOf(openTag, pos);
    const nextClose = xml.indexOf(closeTag, pos);
    if (nextClose === -1) return null;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      pos = nextOpen + openTag.length;
    } else {
      depth--;
      if (depth === 0) return xml.slice(contentStart, nextClose);
      pos = nextClose + closeTag.length;
    }
  }
  return null;
}

/** Parse top-level <node id="...">...</node> elements from an XML fragment, handling nesting. */
function parseTopLevelNodes(xml: string): Array<{ id: string; body: string }> {
  const nodes: Array<{ id: string; body: string }> = [];
  const openRe = new RegExp('<node\\s+id="([^"]+)"([^>]*?)(\\/)?>|<\\/node>', 'gi');
  let match;
  let depth = 0;
  let currentId = "";
  let bodyStart = 0;

  while ((match = openRe.exec(xml)) !== null) {
    if (match[0].startsWith("</node")) {
      // Closing tag
      depth--;
      if (depth === 0) {
        nodes.push({ id: currentId, body: xml.slice(bodyStart, match.index) });
      }
    } else if (match[3] === "/") {
      // Self-closing <node id="..." />
      if (depth === 0) {
        nodes.push({ id: match[1], body: "" });
      }
    } else {
      // Opening tag
      if (depth === 0) {
        currentId = match[1];
        bodyStart = match.index + match[0].length;
      }
      depth++;
    }
  }

  return nodes;
}
