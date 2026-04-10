/**
 * Pure utility functions for discovering and enriching sidebar folder structures
 * from schema data. Extracted from DataDrawerContent.svelte.
 */

import type { FolderNode } from "../data/bg3FolderStructure.js";
import type { NodeSchema } from "../tauri/lsx-export.js";

export interface DiscoveredSections {
  cc: FolderNode[];
  content: FolderNode[];
  vfx: FolderNode[];
  sound: FolderNode[];
  general: FolderNode[];
}

/**
 * Scan schema entries and categorize discovered sections into groups.
 * Sections that are already statically defined or explicitly excluded
 * are filtered out.
 */
export function discoverSections(
  sectionEntries: Iterable<[string, NodeSchema[]]>,
  staticSections: ReadonlySet<string>,
  excludedSections: ReadonlySet<string>,
): DiscoveredSections {
  const cc: FolderNode[] = [];
  const content: FolderNode[] = [];
  const vfx: FolderNode[] = [];
  const sound: FolderNode[] = [];
  const general: FolderNode[] = [];

  for (const [sectionKey, schemas] of sectionEntries) {
    if (staticSections.has(sectionKey)) continue;
    if (excludedSections.has(sectionKey)) continue;
    if (sectionKey.startsWith("stats:")) continue;
    if (schemas.every((s) => s.attributes.length === 0)) continue;
    const primary = schemas[0];
    if (!primary) continue;

    const node: FolderNode = {
      name: sectionKey,
      label: sectionKey.replace(/([A-Z])/g, " $1").trim(),
      nodeTypes: schemas.map((s) => s.node_id),
      Section: sectionKey,
      regionId: sectionKey,
    };

    if (sectionKey.startsWith("CharacterCreation")) cc.push(node);
    else if (/^Effect/i.test(sectionKey)) vfx.push(node);
    else if (/Bank/i.test(sectionKey) || /Visual/i.test(sectionKey)) content.push(node);
    else if (/^Sound/i.test(sectionKey) && sectionKey !== "Sound") sound.push(node);
    else general.push(node);
  }

  const sorter = (a: FolderNode, b: FolderNode) => a.label.localeCompare(b.label);
  cc.sort(sorter);
  content.sort(sorter);
  vfx.sort(sorter);
  sound.sort(sorter);
  general.sort(sorter);

  return { cc, content, vfx, sound, general };
}

/**
 * Enrich core folders by appending discovered sections to their
 * matching category children (CharacterCreation, Content, VFX).
 */
export function enrichCoreFolders(
  coreFolders: readonly FolderNode[],
  discovered: DiscoveredSections,
): FolderNode[] {
  const { cc: ccExtra, content: contentExtra, vfx: vfxExtra } = discovered;
  if (ccExtra.length === 0 && contentExtra.length === 0 && vfxExtra.length === 0) {
    return coreFolders as FolderNode[];
  }
  return coreFolders.map((f) => {
    if (f.name === "_CharacterCreation" && f.children && ccExtra.length > 0)
      return { ...f, children: [...f.children, ...ccExtra] };
    if (f.name === "_Content" && f.children && contentExtra.length > 0)
      return { ...f, children: [...f.children, ...contentExtra] };
    if (f.name === "_VFX" && f.children && vfxExtra.length > 0)
      return { ...f, children: [...f.children, ...vfxExtra] };
    return f;
  });
}

/**
 * Merge discovered sound and general sections into the additional folders list.
 */
export function mergeAdditionalSections(
  additionalFolders: readonly FolderNode[],
  discovered: DiscoveredSections,
): FolderNode[] {
  const combined = [...additionalFolders];
  const soundExtra = discovered.sound;
  if (soundExtra.length > 0) {
    for (let i = 0; i < combined.length; i++) {
      const node = combined[i];
      if (node.name === "_Sound" && node.children && soundExtra.length > 0) {
        combined[i] = { ...node, children: [...node.children, ...soundExtra] };
      }
    }
  }
  combined.push(...discovered.general);
  combined.sort((a, b) => a.label.localeCompare(b.label));
  return combined;
}
