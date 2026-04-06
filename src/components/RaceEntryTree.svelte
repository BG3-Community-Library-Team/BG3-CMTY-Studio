<script lang="ts">
  import type { DiffEntry, ManualEntry } from "../lib/types/index.js";
  import { projectStore, sectionToTable } from "../lib/stores/projectStore.svelte.js";
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import { buildRaceTree, type RaceTreeNode, type RaceEntryInput } from "../lib/utils/raceTree.js";
  import EntryRow from "./EntryRow.svelte";
  import ManualEntryCard from "./ManualEntryCard.svelte";
  import { m } from "../paraglide/messages.js";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";

  let {
    entries,
    section,
  }: {
    entries: DiffEntry[];
    section: string;
  } = $props();

  // Build race entry inputs from auto-detected entries
  let activeModInputs = $derived<RaceEntryInput[]>(
    entries.map(e => ({
      uuid: e.uuid,
      displayName: e.display_name || e.uuid,
      parentGuid: e.raw_attributes?.["ParentGuid"] || undefined,
    }))
  );

  // Build race entry inputs from manual entries (new rows in staging)
  let manualInputs = $derived<RaceEntryInput[]>(
    projectStore.getEntries(sectionToTable("Races"))
      .filter(e => e._is_new && !e._is_deleted)
      .map(e => ({
        uuid: String(e["UUID"] ?? ""),
        displayName: String(e["Name"] ?? e["UUID"] ?? "Unnamed"),
        parentGuid: e["ParentGuid"] ? String(e["ParentGuid"]) : undefined,
      }))
      .filter(e => e.uuid !== "")
  );

  // Vanilla entries from store
  let vanillaInputs = $derived<RaceEntryInput[]>(
    (modStore.vanilla.Races ?? []).map(v => ({
      uuid: v.uuid,
      displayName: v.display_name || v.uuid,
    }))
  );

  // Build the full tree — use only roots (depth === 0) and recurse via children
  let fullTree = $derived<RaceTreeNode[]>(
    buildRaceTree(
      activeModInputs,
      manualInputs,
      [],
      modStore.raceParentMap,
      vanillaInputs,
      modStore.selectedModPath || null,
      modStore.additionalModPaths,
    )
  );

  // Extract only root nodes (depth === 0)
  let rootNodes = $derived(fullTree.filter(n => n.depth === 0));

  // Track collapsed state per uuid
  let collapsed: Map<string, boolean> = $state(new Map());

  function toggleCollapse(uuid: string) {
    const newState = new Map(collapsed);
    newState.set(uuid, !(newState.get(uuid) ?? false));
    collapsed = newState;
  }

  // Lookup helpers
  function findAutoEntry(uuid: string): DiffEntry | undefined {
    return entries.find(e => e.uuid === uuid);
  }

  function findManualEntry(uuid: string): { entry: ManualEntry; globalIndex: number } | undefined {
    const entries = projectStore.getEntries(sectionToTable("Races"));
    const idx = entries.findIndex(
      e => e._is_new && !e._is_deleted && String(e["UUID"] ?? "") === uuid
    );
    if (idx >= 0) {
      const e = entries[idx];
      // Adapt to ManualEntry shape for downstream consumers
      const fields: Record<string, string> = {};
      for (const [k, v] of Object.entries(e)) {
        if (!k.startsWith("_") && typeof v === "string") fields[k] = v;
      }
      return { entry: { section: "Races", fields }, globalIndex: idx };
    }
    return undefined;
  }

  const SOURCE_BADGE_CLASSES: Record<string, string> = {
    'active-mod': 'bg-[var(--th-bg-blue-900-50)] text-[var(--th-text-blue-300)]',
    'manual': 'bg-[var(--th-bg-green-900-50)] text-[var(--th-text-green-300)]',
    'additional-mod': 'bg-[var(--th-bg-yellow-900-50)] text-[var(--th-text-yellow-300)]',
    'vanilla': 'bg-[var(--th-bg-700)] text-[var(--th-text-500)]',
  };

  const SOURCE_LABELS: Record<string, () => string> = {
    'active-mod': () => m.race_tree_source_mod(),
    'manual': () => m.race_tree_source_manual(),
    'additional-mod': () => m.race_tree_source_additional(),
    'vanilla': () => m.race_tree_source_vanilla(),
  };
</script>

{#snippet treeItem(node: RaceTreeNode, isLast: boolean)}
  {@const autoEntry = findAutoEntry(node.uuid)}
  {@const manualEntry = findManualEntry(node.uuid)}
  {@const hasChildren = node.children.length > 0}
  {@const nodeCollapsed = collapsed.get(node.uuid) ?? false}

  <div role="treeitem" aria-selected="false" aria-expanded={hasChildren ? !nodeCollapsed : undefined} aria-level={node.depth + 1} class="tree-node {node.depth > 0 ? (isLast ? 'tree-node-last' : 'tree-node-mid') : ''}">
    {#if autoEntry}
      <div style="padding-left: {node.depth * 20}px" class="flex items-start gap-1 relative">
        {#if node.depth > 0}
          <span class="tree-connector" aria-hidden="true"></span>
        {/if}
        {#if hasChildren}
          <button
            class="mt-1.5 p-0.5 rounded hover:bg-[var(--th-bg-600)] text-[var(--th-text-500)] shrink-0"
            onclick={() => toggleCollapse(node.uuid)}
            aria-label={nodeCollapsed ? m.race_tree_expand() : m.race_tree_collapse()}
          >
            {#if nodeCollapsed}
              <ChevronRight size={14} />
            {:else}
              <ChevronDown size={14} />
            {/if}
          </button>
        {:else}
          <span class="w-6 shrink-0"></span>
        {/if}
        <div class="flex-1 min-w-0">
          <EntryRow entry={autoEntry} {section} />
        </div>
      </div>
    {:else if manualEntry}
      <div style="padding-left: {node.depth * 20}px" class="flex items-start gap-1 relative">
        {#if node.depth > 0}
          <span class="tree-connector" aria-hidden="true"></span>
        {/if}
        {#if hasChildren}
          <button
            class="mt-1.5 p-0.5 rounded hover:bg-[var(--th-bg-600)] text-[var(--th-text-500)] shrink-0"
            onclick={() => toggleCollapse(node.uuid)}
            aria-label={nodeCollapsed ? m.race_tree_expand() : m.race_tree_collapse()}
          >
            {#if nodeCollapsed}
              <ChevronRight size={14} />
            {:else}
              <ChevronDown size={14} />
            {/if}
          </button>
        {:else}
          <span class="w-6 shrink-0"></span>
        {/if}
        <div class="flex-1 min-w-0">
          <ManualEntryCard entry={manualEntry.entry} globalIndex={manualEntry.globalIndex} {section} />
        </div>
      </div>
    {:else}
      <!-- Structural/context node (vanilla or additional mod) -->
      <div
        style="padding-left: {node.depth * 20}px"
        class="flex items-center gap-1.5 py-1 px-1 relative"
      >
        {#if node.depth > 0}
          <span class="tree-connector" aria-hidden="true"></span>
        {/if}
        {#if hasChildren}
          <button
            class="p-0.5 rounded hover:bg-[var(--th-bg-600)] text-[var(--th-text-500)] shrink-0"
            onclick={() => toggleCollapse(node.uuid)}
            aria-label={nodeCollapsed ? m.race_tree_expand() : m.race_tree_collapse()}
          >
            {#if nodeCollapsed}
              <ChevronRight size={14} />
            {:else}
              <ChevronDown size={14} />
            {/if}
          </button>
        {:else}
          <span class="w-6 shrink-0"></span>
        {/if}
        <span class="text-xs text-[var(--th-text-500)] truncate {node.source === 'vanilla' ? 'italic' : ''}">
          {node.displayName || node.uuid}
        </span>
        <span class="text-[10px] px-1 py-0.5 rounded {SOURCE_BADGE_CLASSES[node.source] ?? ''} shrink-0">
          {SOURCE_LABELS[node.source]?.() ?? node.source}
        </span>
        {#if node.sourceModName}
          <span class="text-[10px] text-[var(--th-text-500)] truncate">({node.sourceModName})</span>
        {/if}
      </div>
    {/if}
  </div>

  {#if hasChildren && !nodeCollapsed}
    <div role="group" class="tree-children" style="margin-left: {node.depth * 20 + 10}px">
      {#each node.children as child, i (child.uuid)}
        {@render treeItem(child, i === node.children.length - 1)}
      {/each}
    </div>
  {/if}
{/snippet}

<div role="tree" aria-label={m.race_tree_hierarchy_aria()} class="space-y-0.5">
  {#each rootNodes as node, i (node.uuid)}
    {@render treeItem(node, i === rootNodes.length - 1)}
  {/each}
</div>

<style>
  .tree-children {
    position: relative;
    border-left: 1px solid var(--th-border-700, #3f3f46);
  }

  .tree-node {
    position: relative;
  }

  /* Horizontal connector from the vertical tree line to the node */
  .tree-connector {
    position: absolute;
    left: -10px;
    top: 50%;
    width: 10px;
    height: 0;
    border-top: 1px solid var(--th-border-700, #3f3f46);
  }

  /* Last child: mask the vertical line below the connector */
  .tree-node-last {
    position: relative;
  }
</style>

