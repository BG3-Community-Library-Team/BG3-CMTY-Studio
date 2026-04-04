/**
 * Pure utility for building a hierarchical race tree from multiple data sources.
 */

export type RaceEntrySource = 'active-mod' | 'additional-mod' | 'vanilla' | 'manual';

export interface RaceEntryInput {
  uuid: string;
  displayName: string;
  parentGuid?: string;
}

export interface AdditionalModRaceEntry extends RaceEntryInput {
  modName: string;
}

export interface RaceTreeNode {
  uuid: string;
  displayName: string;
  depth: number;
  source: RaceEntrySource;
  sourceModName?: string;
  children: RaceTreeNode[];
  isInteractive: boolean;
}

interface InternalNode {
  uuid: string;
  displayName: string;
  source: RaceEntrySource;
  sourceModName?: string;
  parentGuid?: string;
  children: InternalNode[];
}

/**
 * Build a hierarchical race tree from active-mod, manual, additional-mod, and vanilla entries.
 *
 * Algorithm:
 *  1. Build lookup maps from all sources
 *  2. Seed with active-mod + manual entries
 *  3. Walk ancestor chains to pull in vanilla/additional-mod context nodes
 *  4. Walk vanilla/additional-mod entries to find children of seed entries
 *  5. Build parent→children links and return roots with depth
 */
export function buildRaceTree(
  activeModEntries: RaceEntryInput[],
  manualEntries: RaceEntryInput[],
  additionalModEntries: AdditionalModRaceEntry[],
  vanillaParentMap: Record<string, string>,
  vanillaEntries: RaceEntryInput[],
  activeModPath: string | null,
  additionalModPaths: string[],
): RaceTreeNode[] {
  const nodeMap = new Map<string, InternalNode>();

  // Determine which additional mod paths overlap with the active mod
  const activeNorm = activeModPath?.replace(/\\/g, '/').toLowerCase() ?? null;
  const skipAdditionalFromActive = activeNorm != null
    && additionalModPaths.some(p => p.replace(/\\/g, '/').toLowerCase() === activeNorm);

  // 1. Add active-mod entries
  for (const e of activeModEntries) {
    if (!nodeMap.has(e.uuid)) {
      nodeMap.set(e.uuid, {
        uuid: e.uuid,
        displayName: e.displayName,
        source: 'active-mod',
        parentGuid: e.parentGuid,
        children: [],
      });
    }
  }

  // 2. Add manual entries (skip duplicates already from active-mod)
  for (const e of manualEntries) {
    if (!nodeMap.has(e.uuid)) {
      nodeMap.set(e.uuid, {
        uuid: e.uuid,
        displayName: e.displayName,
        source: 'manual',
        parentGuid: e.parentGuid,
        children: [],
      });
    }
  }

  // 3. Add additional-mod entries (skip if from the same path as active mod)
  for (const e of additionalModEntries) {
    if (skipAdditionalFromActive) continue;
    if (!nodeMap.has(e.uuid)) {
      nodeMap.set(e.uuid, {
        uuid: e.uuid,
        displayName: e.displayName,
        source: 'additional-mod',
        sourceModName: e.modName,
        parentGuid: e.parentGuid,
        children: [],
      });
    }
  }

  // Build vanilla lookup for ancestor walking
  const vanillaByUuid = new Map(vanillaEntries.map(v => [v.uuid, v]));

  // 4. Walk ancestor chains from seed entries to pull in needed vanilla context nodes
  const seedUuids = [...nodeMap.keys()];
  for (const uuid of seedUuids) {
    let parentId = nodeMap.get(uuid)?.parentGuid;
    let depth = 0;
    while (parentId && depth < 10) {
      if (nodeMap.has(parentId)) break; // already in tree
      const vanilla = vanillaByUuid.get(parentId);
      if (vanilla) {
        nodeMap.set(parentId, {
          uuid: parentId,
          displayName: vanilla.displayName,
          source: 'vanilla',
          parentGuid: vanillaParentMap[parentId] || vanilla.parentGuid,
          children: [],
        });
        parentId = vanillaParentMap[parentId] || vanilla.parentGuid;
      } else {
        break;
      }
      depth++;
    }
  }

  // 5. Walk vanilla entries to find children of existing tree nodes
  for (const v of vanillaEntries) {
    if (nodeMap.has(v.uuid)) continue;
    const parentId = vanillaParentMap[v.uuid] || v.parentGuid;
    if (parentId && nodeMap.has(parentId)) {
      nodeMap.set(v.uuid, {
        uuid: v.uuid,
        displayName: v.displayName,
        source: 'vanilla',
        parentGuid: parentId,
        children: [],
      });
    }
  }

  // 6. Link parent→children
  const roots: InternalNode[] = [];
  for (const node of nodeMap.values()) {
    if (node.parentGuid && nodeMap.has(node.parentGuid)) {
      nodeMap.get(node.parentGuid)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort children alphabetically
  function sortChildren(node: InternalNode) {
    node.children.sort((a, b) => a.displayName.localeCompare(b.displayName));
    for (const child of node.children) sortChildren(child);
  }
  for (const root of roots) sortChildren(root);
  roots.sort((a, b) => a.displayName.localeCompare(b.displayName));

  // 7. Convert to RaceTreeNode with depth
  function toTreeNode(node: InternalNode, depth: number): RaceTreeNode {
    return {
      uuid: node.uuid,
      displayName: node.displayName,
      depth,
      source: node.source,
      sourceModName: node.sourceModName,
      children: node.children.map(c => toTreeNode(c, depth + 1)),
      isInteractive: node.source !== 'vanilla' || node.children.some(c => c.source !== 'vanilla'),
    };
  }

  return roots.map(r => toTreeNode(r, 0));
}
