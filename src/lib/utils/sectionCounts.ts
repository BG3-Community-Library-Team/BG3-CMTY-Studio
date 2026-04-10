/**
 * Pure utility functions for computing section/group entry counts
 * and detecting mod file presence. Extracted from DataDrawerContent.svelte
 * so they can be independently unit-tested.
 */

import type { SectionResult, DiffEntry } from "../types/index.js";
import type { FolderNode } from "../data/bg3FolderStructure.js";

/**
 * Count entries in a single section, combining auto-detected entries
 * (from sectionMap) with manually-created entries (from manualCountBySection).
 */
export function getSectionCount(
  sectionMap: Map<string, SectionResult>,
  manualCountBySection: Map<string, number>,
  section: string | undefined,
  entryFilter?: { field: string; value: string },
): number {
  if (!section) return 0;
  const sec = sectionMap.get(section);
  let autoCount = 0;
  if (sec) {
    if (entryFilter) {
      autoCount = sec.entries.filter((e: DiffEntry) =>
        entryFilter.field === "node_id"
          ? e.node_id === entryFilter.value
          : e.raw_attributes?.[entryFilter.field] === entryFilter.value,
      ).length;
    } else {
      autoCount = sec.entries.length;
    }
  }
  const manualCount = entryFilter ? 0 : (manualCountBySection.get(section) ?? 0);
  return autoCount + manualCount;
}

/**
 * Recursively compute the total entry count for a folder node
 * (including all children and group sections).
 */
export function getGroupCount(
  sectionMap: Map<string, SectionResult>,
  manualCountBySection: Map<string, number>,
  node: FolderNode,
): number {
  if (node.children) {
    return node.children.reduce(
      (sum, child) => sum + getGroupCount(sectionMap, manualCountBySection, child),
      0,
    );
  }
  if (node.Section) return getSectionCount(sectionMap, manualCountBySection, node.Section, node.entryFilter);
  if (node.groupSections) {
    return node.groupSections.reduce(
      (sum, sec) => sum + getSectionCount(sectionMap, manualCountBySection, sec),
      0,
    );
  }
  return 0;
}

/**
 * Check whether a folder node (or any of its descendants) has mod entries.
 */
export function hasModFiles(
  sectionMap: Map<string, SectionResult>,
  manualCountBySection: Map<string, number>,
  node: FolderNode,
): boolean {
  if (node.Section) return getSectionCount(sectionMap, manualCountBySection, node.Section, node.entryFilter) > 0;
  if (node.children) return node.children.some((c) => hasModFiles(sectionMap, manualCountBySection, c));
  if (node.groupSections) return node.groupSections.some((sec) => getSectionCount(sectionMap, manualCountBySection, sec) > 0);
  return false;
}

/**
 * Check whether a folder node (or any descendants) is backed by a data section.
 * Pure function — no state dependency.
 */
export function hasSection(node: FolderNode): boolean {
  if (node.Section) return true;
  if (node.groupSections) return true;
  if (node.children) return node.children.some(hasSection);
  return false;
}
