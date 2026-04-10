<script lang="ts">
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import { uiStore } from "../lib/stores/uiStore.svelte.js";
  import { projectStore } from "../lib/stores/projectStore.svelte.js";
  import { listModFiles } from "../lib/utils/tauri.js";
  import { open } from "@tauri-apps/plugin-dialog";
  import { openProject } from "../lib/services/scanService.js";
  import { m } from "../paraglide/messages.js";
  import { commandRegistry } from "../lib/utils/commandRegistry.svelte.js";
  import ExplorerHeader from "./ExplorerHeader.svelte";
  import ExplorerDrawer from "./ExplorerDrawer.svelte";
  import ExplorerModRoot from "./explorer/ExplorerModRoot.svelte";
  import DataDrawerContent from "./explorer/DataDrawerContent.svelte";
  import LocalizationDrawerContent from "./explorer/LocalizationDrawerContent.svelte";
  import ScriptsDrawerContent from "./explorer/ScriptsDrawerContent.svelte";
  import FileTreeExplorer from "./explorer/FileTreeExplorer.svelte";
  import ExplorerTreeFilter from "./explorer/ExplorerTreeFilter.svelte";
  import ScriptCreationModal from "./ScriptCreationModal.svelte";
  import { explorerFilter } from "./explorer/explorerShared.js";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Cog from "@lucide/svelte/icons/cog";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import FilePlus2 from "@lucide/svelte/icons/file-plus-2";
  import { keyboardReorder } from "./explorer/dragReorder.js";
  import type { ExplorerDrawerId } from "../lib/stores/uiStore.svelte.js";

  let announceMessage = $state("");
  let scanResult = $derived(modStore.scanResult);
  let isReady = $derived(!!scanResult && !modStore.isScanning);
  let modName = $derived(scanResult?.mod_meta?.name ?? m.file_explorer_no_mod());
  let modFolder = $derived(scanResult?.mod_meta?.folder ?? "");
  let isRootExpanded = $derived(uiStore.expandedNodes["root"] !== false);
  let refreshingAll = $state(false);

  const DEFAULT_DRAWER_ORDER: ExplorerDrawerId[] = ["data", "scripts", "localization"];

  let orderedDrawerIds = $derived.by((): ExplorerDrawerId[] => {
    const seen = new Set<ExplorerDrawerId>();
    const ordered: ExplorerDrawerId[] = [];
    for (const id of uiStore.explorerDrawerOrder) {
      if (!seen.has(id)) {
        seen.add(id);
        ordered.push(id);
      }
    }
    for (const id of DEFAULT_DRAWER_ORDER) {
      if (!seen.has(id)) ordered.push(id);
    }
    return ordered;
  });

  let drawerDefs = $derived.by(() => orderedDrawerIds.map((id) => ({
    id,
    title:
      id === "data"
        ? m.explorer_drawer_data()
        : id === "scripts"
          ? m.explorer_drawer_scripts()
          : m.explorer_drawer_localization(),
    collapsed: uiStore.explorerDrawers[id]?.collapsed ?? (id !== "data"),
  })));



  let draggedDrawerId: ExplorerDrawerId | null = $state(null);
  let dropDrawerId: ExplorerDrawerId | null = $state(null);
  let dropDrawerPosition: "before" | "after" | null = $state(null);

  let activeNodeKey = $derived.by(() => {
    const tab = uiStore.activeTab;
    if (!tab) return "";
    if (tab.type === "meta-lsx") return "meta.lsx";
    return "";
  });

  async function refreshModFiles(): Promise<void> {
    const basePath = modStore.projectPath || modStore.selectedModPath;
    if (!basePath) return;
    try { modStore.modFiles = await listModFiles(basePath); }
    catch (err) { console.warn("Failed to refresh mod files:", err); }
  }

  async function openProjectFolder(): Promise<void> {
    try {
      const selected = await open({ directory: true, title: m.header_select_mod_folder() });
      if (selected == null) return;
      const p = Array.isArray(selected) ? selected[0] : String(selected);
      await openProject(p);
    } catch (e) { console.error("Dialog error:", e); }
  }

  // â”€â”€ Script creation modal (triggered via command registry) â”€â”€
  let showCreateScript = $state(false);
  let createScriptDefaultContext: 'Server' | 'Client' | 'Shared' | 'Other' = $state('Other');
  // ── Tree filter (Ctrl+Alt+F) ──
  let filterRef: ExplorerTreeFilter | null = $state(null);

  function handleExplorerKeydown(e: KeyboardEvent) {
    if (e.ctrlKey && e.altKey && e.key === "f") {
      e.preventDefault();
      e.stopPropagation();
      if (explorerFilter.active) {
        explorerFilter.close();
      } else {
        explorerFilter.open();
        requestAnimationFrame(() => filterRef?.focusInput());
      }
    }
  }

  function focusFirstMatch() {
    const el = document.querySelector<HTMLElement>('.file-explorer .tree-node.filter-match');
    el?.focus();
  }

  function handleDrawerDragStart(event: DragEvent, drawerId: ExplorerDrawerId): void {
    draggedDrawerId = drawerId;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", drawerId);
      // Use only the drawer header as drag image
      const slot = event.currentTarget as HTMLElement;
      const header = slot.querySelector('.drawer-header');
      if (header) {
        event.dataTransfer.setDragImage(header as HTMLElement, event.offsetX, 12);
      }
    }
  }

  function handleDrawerDragOver(event: DragEvent, drawerId: ExplorerDrawerId): void {
    if (!draggedDrawerId || draggedDrawerId === drawerId) {
      dropDrawerId = null;
      dropDrawerPosition = null;
      return;
    }
    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    dropDrawerId = drawerId;
    dropDrawerPosition = event.clientY < midpoint ? "before" : "after";
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  }

  function handleDrawerDrop(event: DragEvent, targetDrawerId: ExplorerDrawerId): void {
    event.preventDefault();
    if (!draggedDrawerId || !dropDrawerPosition || draggedDrawerId === targetDrawerId) {
      clearDrawerDragState();
      return;
    }
    const nextOrder = orderedDrawerIds.filter((id) => id !== draggedDrawerId);
    const targetIndex = nextOrder.indexOf(targetDrawerId);
    const insertIndex = dropDrawerPosition === "before" ? targetIndex : targetIndex + 1;
    nextOrder.splice(insertIndex, 0, draggedDrawerId);
    uiStore.setExplorerDrawerOrder(nextOrder);
    clearDrawerDragState();
  }

  function clearDrawerDragState(): void {
    draggedDrawerId = null;
    dropDrawerId = null;
    dropDrawerPosition = null;
  }

  function announce(msg: string): void {
    announceMessage = "";
    requestAnimationFrame(() => { announceMessage = msg; });
  }

  function handleDrawerKeydown(e: KeyboardEvent, drawerId: ExplorerDrawerId): void {
    if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    e.preventDefault();
    e.stopPropagation();
    const direction = e.key === "ArrowUp" ? "up" : "down";
    const currentIndex = orderedDrawerIds.indexOf(drawerId);
    if (currentIndex < 0) return;
    const newOrder = keyboardReorder(orderedDrawerIds, currentIndex, direction);
    if (!newOrder) return;
    uiStore.setExplorerDrawerOrder(newOrder);
    const newPos = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    const title = drawerDefs.find(d => d.id === drawerId)?.title ?? drawerId;
    announce(m.explorer_reorder_announce({ name: title, position: String(newPos + 1) }));
    // Focus follows the moved drawer header
    requestAnimationFrame(() => {
      const slots = document.querySelectorAll<HTMLElement>('.drawer-layout .drawer-slot');
      const slot = slots[newPos];
      const header = slot?.querySelector<HTMLElement>('.drawer-header');
      header?.focus();
    });
  }

  // ── Resize state removed — resize is now inside ExplorerDrawer ──
</script>

<div class="file-explorer" role="none" onkeydown={handleExplorerKeydown}>
  <ExplorerHeader
    {isReady}
    onrefresh={async () => {
      refreshingAll = true;
      try { await Promise.all([projectStore.refreshAllSections(), refreshModFiles()]); }
      finally { refreshingAll = false; }
    }}
    onpackage={() => commandRegistry.execute('action.packageProject')}
    onopenproject={openProjectFolder}
    refreshing={refreshingAll}
  />
  <ExplorerTreeFilter bind:this={filterRef} onfocusfirstmatch={focusFirstMatch} />

  {#if !isReady}
    <div class="empty-state">
      <p class="text-xs text-[var(--th-text-500)] mb-4">No mod loaded.</p>
      <div class="flex flex-col gap-2 px-4">
        <button
          class="flex items-center gap-2 w-full px-3 py-2 rounded text-left text-xs
                 bg-[var(--th-bg-700)]/60 border border-[var(--th-border-700)]
                 hover:bg-[var(--th-bg-600)]/80 hover:border-[var(--th-border-600)] transition-colors"
          onclick={openProjectFolder}
        >
          <FolderOpen size={14} class="text-[var(--th-accent-500,#0ea5e9)] shrink-0" />
          <span class="text-[var(--th-text-200)]">Open Project</span>
        </button>
        <button
          class="flex items-center gap-2 w-full px-3 py-2 rounded text-left text-xs
                 bg-[var(--th-bg-700)]/60 border border-[var(--th-border-700)]
                 hover:bg-[var(--th-bg-600)]/80 hover:border-[var(--th-border-600)] transition-colors"
          onclick={() => uiStore.showCreateModModal = true}
        >
          <FilePlus2 size={14} class="text-emerald-400 shrink-0" />
          <span class="text-[var(--th-text-200)]">New Project</span>
        </button>
      </div>
    </div>
  {:else if uiStore.explorerViewMode === "studio"}
    <div class="tree-root" role="tree">
      <div class="explorer-static-root">
        <button
          class="tree-node root-node"
          class:active-node={activeNodeKey === 'meta.lsx'}
          onclick={() => {
            uiStore.expandNode("root");
            uiStore.openTab({ id: "meta.lsx", label: "meta.lsx", type: "meta-lsx", category: "meta", icon: "⚙" });
          }}
        >
          <ChevronRight size={14} class="chevron {isRootExpanded ? 'expanded' : ''}" />
          <Cog size={14} class="text-[var(--th-text-emerald-400)]" />
          <span class="node-label font-semibold truncate">{modName}</span>
        </button>

        {#if isRootExpanded}
          <ExplorerModRoot />
        {/if}
      </div>

      <div class="drawer-layout">
        {#each drawerDefs as drawer, i (drawer.id)}
          {@const hasStoredHeight = !drawer.collapsed && uiStore.explorerDrawers[drawer.id]?.height != null}
          <div
            class="drawer-slot"
            class:drawer-collapsed={drawer.collapsed}
            class:drawer-sized={hasStoredHeight}
            class:drop-before={dropDrawerId === drawer.id && dropDrawerPosition === 'before'}
            class:drop-after={dropDrawerId === drawer.id && dropDrawerPosition === 'after'}
            role="presentation"
            draggable="true"
            ondragstart={(event) => handleDrawerDragStart(event, drawer.id)}
            ondragover={(event) => handleDrawerDragOver(event, drawer.id)}
            ondrop={(event) => handleDrawerDrop(event, drawer.id)}
            ondragend={clearDrawerDragState}
            onkeydown={(e) => handleDrawerKeydown(e, drawer.id)}
          >
            <ExplorerDrawer id={drawer.id} title={drawer.title} defaultOpen={!drawer.collapsed} isFirst={i === 0}>
              {#snippet children()}
                {#if drawer.id === 'data'}
                  <DataDrawerContent />
                {:else if drawer.id === 'scripts'}
                  <ScriptsDrawerContent />
                {:else}
                  <LocalizationDrawerContent />
                {/if}
              {/snippet}
            </ExplorerDrawer>
          </div>
        {/each}
      </div>
    </div>
  {:else}
    <FileTreeExplorer />
  {/if}

  <div class="sr-only" aria-live="polite" aria-atomic="true">
    {announceMessage}
  </div>
</div>

{#if showCreateScript && modFolder}
  <ScriptCreationModal
    {modFolder}
    defaultContext={createScriptDefaultContext}
    onClose={() => { showCreateScript = false; }}
    onCreated={async () => { showCreateScript = false; await refreshModFiles(); }}
  />
{/if}

<style>
  .file-explorer {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    overflow-x: hidden;
  }

  .empty-state {
    padding: 2rem 1rem;
    text-align: center;
  }

  .tree-root {
    display: flex;
    flex: 1;
    min-height: 0;
    flex-direction: column;
    overflow: hidden;
    padding: 0;
  }

  .explorer-static-root {
    flex: none;
  }

  .drawer-layout {
    display: flex;
    flex: 1;
    min-height: 0;
    flex-direction: column;
    gap: 0;
    overflow: hidden;
    justify-content: flex-end;
  }

  .drawer-slot {
    position: relative;
    min-height: 0;
    flex: 1 1 0%;
    overflow: hidden;
  }

  .drawer-slot.drawer-collapsed,
  .drawer-slot.drawer-sized {
    flex: 0 0 auto;
  }

  .drawer-slot.drop-before::before,
  .drawer-slot.drop-after::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--th-accent-500, #0ea5e9);
    z-index: 5;
  }

  .drawer-slot.drop-before::before {
    top: 0;
  }

  .drawer-slot.drop-after::after {
    bottom: 0;
  }

  .tree-node {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    padding: 2px 8px 2px 4px;
    border: none;
    background: transparent;
    color: var(--th-sidebar-text-muted, var(--th-text-300));
    font-size: 12px;
    cursor: pointer;
    border-radius: 3px;
    text-align: left;
    min-height: 24px;
    user-select: none;
    position: relative;
  }

  .tree-node:hover {
    background: var(--th-bg-700);
  }

  .tree-node.active-node {
    background: color-mix(in srgb, var(--th-accent-500, #0ea5e9) 12%, transparent);
    color: var(--th-text-100);
  }

  .tree-node.active-node::before {
    content: "";
    position: absolute;
    left: 0;
    top: 2px;
    bottom: 2px;
    width: 2px;
    border-radius: 1px;
    background: var(--th-accent-500, #0ea5e9);
  }

  .root-node {
    font-size: 12px;
    padding: 4px 8px 4px 4px;
  }

  .node-label {
    flex: 1;
    min-width: 0;
  }

  :global(.chevron) {
    transition: transform 0.15s;
    flex-shrink: 0;
  }

  :global(.chevron.expanded) {
    transform: rotate(90deg);
  }

  /* ── Shared explorer tree styles (scoped to .file-explorer) ── */

  .file-explorer :global(.tree-node) {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    padding: 2px 8px 2px 4px;
    border: none;
    background: transparent;
    color: var(--th-sidebar-text-muted, var(--th-text-300));
    font-size: 12px;
    cursor: pointer;
    border-radius: 3px;
    text-align: left;
    min-height: 24px;
    user-select: none;
    position: relative;
  }

  .file-explorer :global(.tree-node:hover) {
    background: var(--th-bg-700);
  }

  .file-explorer :global(.tree-node.has-files) {
    color: var(--th-text-100);
  }

  .file-explorer :global(.tree-node.active-node) {
    background: color-mix(in srgb, var(--th-accent-500, #0ea5e9) 12%, transparent);
    color: var(--th-text-100);
  }

  .file-explorer :global(.tree-node.active-node::before) {
    content: "";
    position: absolute;
    left: 0;
    top: 2px;
    bottom: 2px;
    width: 2px;
    border-radius: 1px;
    background: var(--th-accent-500, #0ea5e9);
  }

  .file-explorer :global(.tree-children) {
    padding-left: 12px;
  }

  .file-explorer :global(.node-label) {
    flex: 1;
    min-width: 0;
  }

  .file-explorer :global(.node-label.text-muted) {
    color: var(--th-text-500);
    opacity: 0.7;
  }

  .file-explorer :global(.entry-count) {
    font-size: 10px;
    padding: 0 5px;
    border-radius: 8px;
    background: var(--th-bg-600);
    color: var(--th-text-300);
    font-weight: 500;
    line-height: 16px;
    flex-shrink: 0;
  }

  .file-explorer :global(.ext-badge) {
    font-size: 9px;
    padding: 0 4px;
    border-radius: 3px;
    color: white;
    font-weight: 600;
    line-height: 14px;
    flex-shrink: 0;
    opacity: 0.7;
  }

  .file-explorer :global(.se-ctx-badge) {
    font-size: 8px;
    padding: 0 3px;
    border-radius: 2px;
    color: white;
    font-weight: 700;
    line-height: 13px;
    flex-shrink: 0;
    opacity: 0.8;
    letter-spacing: 0.5px;
  }

  .file-explorer :global(.chevron-hit) {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    cursor: pointer;
    border-radius: 3px;
    border: none;
    background: transparent;
  }

  .file-explorer :global(.chevron-hit:hover) {
    background: var(--th-bg-600);
  }

  .file-explorer :global(.tree-node-label) {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    color: inherit;
    font-size: inherit;
    cursor: pointer;
    text-align: left;
    padding: 0;
  }

  .file-explorer :global(.hover-actions) {
    display: flex;
    gap: 2px;
    margin-left: auto;
    flex-shrink: 0;
  }

  .file-explorer :global(.hover-action-btn) {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border: none;
    background: transparent;
    color: var(--th-text-400);
    cursor: pointer;
    border-radius: 3px;
    padding: 0;
  }

  .file-explorer :global(.hover-action-btn:hover) {
    background: var(--th-bg-600);
    color: var(--th-text-200);
  }

  .file-explorer :global(.inline-create) {
    gap: 4px;
  }

  .file-explorer :global(.inline-create-input) {
    flex: 1;
    background: var(--th-bg-700);
    border: 1px solid var(--th-accent-500);
    border-radius: 2px;
    color: var(--th-text-200);
    font-size: 11px;
    padding: 1px 4px;
    outline: none;
    font-family: inherit;
  }

  /* ── Filter highlight styles ── */

  .file-explorer :global(.filter-match .node-label) {
    color: var(--th-text-100);
  }

  .file-explorer :global(.filter-dimmed) {
    opacity: 0.4;
  }

  .file-explorer :global(.filter-hidden) {
    display: none;
  }

  .file-explorer :global(.filter-match-count) {
    font-size: 9px;
    padding: 0 4px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--th-accent-500, #0ea5e9) 20%, transparent);
    color: var(--th-accent-300, #7dd3fc);
    font-weight: 600;
    line-height: 14px;
    flex-shrink: 0;
  }

  .file-explorer :global(.filter-highlight) {
    background: color-mix(in srgb, var(--th-accent-500, #0ea5e9) 35%, transparent);
    border-radius: 1px;
    color: var(--th-text-100);
  }

  .file-explorer :global(.inline-create-input:focus) {
    border-color: var(--th-accent-400);
  }

  :global(.ctx-separator) {
    height: 1px;
    background: var(--th-border-700);
    margin: 4px 8px;
  }

  .file-explorer :global(.ctx-group-label) {
    display: block;
    padding: 2px 12px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--th-text-500);
    letter-spacing: 0.05em;
    user-select: none;
  }

  .file-explorer :global(.add-entry-btn) {
    display: none;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 3px;
    flex-shrink: 0;
    color: var(--th-text-500);
    cursor: pointer;
  }

  .file-explorer :global(.add-entry-btn:hover) {
    color: var(--th-text-100);
    background: var(--th-bg-600);
  }

  .file-explorer :global(.tree-node:hover .add-entry-btn) {
    display: inline-flex;
  }

  .file-explorer :global(.separator-node) {
    margin-top: 4px;
    padding-top: 4px;
    border-top: 1px solid var(--th-bg-700);
  }

</style>
