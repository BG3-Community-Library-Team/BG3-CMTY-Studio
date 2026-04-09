<script lang="ts">
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import { uiStore } from "../lib/stores/uiStore.svelte.js";
  import { projectStore } from "../lib/stores/projectStore.svelte.js";
  import { listModFiles } from "../lib/utils/tauri.js";
  import { open } from "@tauri-apps/plugin-dialog";
  import { openProject } from "../lib/services/scanService.js";
  import { m } from "../paraglide/messages.js";
  import { commandRegistry } from "../lib/utils/commandRegistry.svelte.js";
  import ExplorerModRoot from "./explorer/ExplorerModRoot.svelte";
  import DataDrawerContent from "./explorer/DataDrawerContent.svelte";
  import LocalizationDrawerContent from "./explorer/LocalizationDrawerContent.svelte";
  import ScriptsDrawerContent from "./explorer/ScriptsDrawerContent.svelte";
  import ScriptCreationModal from "./ScriptCreationModal.svelte";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Cog from "@lucide/svelte/icons/cog";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Package from "@lucide/svelte/icons/package";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import FilePlus2 from "@lucide/svelte/icons/file-plus-2";

  let scanResult = $derived(modStore.scanResult);
  let modName = $derived(scanResult?.mod_meta?.name ?? m.file_explorer_no_mod());
  let modFolder = $derived(scanResult?.mod_meta?.folder ?? "");
  let isRootExpanded = $derived(uiStore.expandedNodes["root"] !== false);
  let refreshingAll = $state(false);

  let activeNodeKey = $derived.by(() => {
    const tab = uiStore.activeTab;
    if (!tab) return "";
    if (tab.type === "meta-lsx") return "meta.lsx";
    return "";
  });

  async function refreshModFiles(): Promise<void> {
    const modPath = modStore.selectedModPath;
    if (!modPath) return;
    try { modStore.modFiles = await listModFiles(modPath); }
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
</script>

<div class="file-explorer" role="none">
  <div class="explorer-header">
    <span class="text-[10px] font-semibold tracking-widest uppercase text-[var(--th-text-500)]">Explorer</span>
    {#if scanResult}
      <button
        class="ml-auto p-1 rounded text-[var(--th-text-500)] hover:text-[var(--th-text-200)] hover:bg-[var(--th-bg-700)] transition-colors"
        title="Refresh all sections"
        aria-label="Refresh all sections"
        onclick={async () => {
          refreshingAll = true;
          try { await Promise.all([projectStore.refreshAllSections(), refreshModFiles()]); }
          finally { refreshingAll = false; }
        }}
      >
        <RefreshCw size={14} class={refreshingAll ? 'animate-spin' : ''} />
      </button>
      <button
        class="p-1 rounded text-[var(--th-text-500)] hover:text-[var(--th-text-200)] hover:bg-[var(--th-bg-700)] transition-colors"
        title="Package project"
        aria-label="Package project"
        onclick={() => commandRegistry.execute('action.packageProject')}
      >
        <Package size={14} />
      </button>
      <button
        class="p-1 rounded text-[var(--th-text-500)] hover:text-[var(--th-text-200)] hover:bg-[var(--th-bg-700)] transition-colors"
        title="Open a different project"
        aria-label="Open project folder"
        onclick={openProjectFolder}
      >
        <FolderOpen size={14} />
      </button>
    {/if}
  </div>

  {#if !scanResult}
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
  {:else}
    <div class="tree-root" role="tree">
      <!-- Root: Mod name -->
      <button
        class="tree-node root-node"
        class:active-node={activeNodeKey === 'meta.lsx'}
        onclick={() => {
          uiStore.expandNode("root");
          uiStore.openTab({ id: "meta.lsx", label: "meta.lsx", type: "meta-lsx", category: "meta", icon: "âš™" });
        }}
      >
        <ChevronRight size={14} class="chevron {isRootExpanded ? 'expanded' : ''}" />
        <Cog size={14} class="text-[var(--th-text-emerald-400)]" />
        <span class="node-label font-semibold truncate">{modName}</span>
      </button>

      {#if isRootExpanded}
        <DataDrawerContent />
        <ExplorerModRoot />
        <LocalizationDrawerContent />
        <ScriptsDrawerContent />
      {/if}
    </div>
  {/if}
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
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    padding-bottom: 1rem;
  }

  .explorer-header {
    display: flex;
    align-items: center;
    padding: 8px 12px 4px;
    user-select: none;
  }

  .empty-state {
    padding: 2rem 1rem;
    text-align: center;
  }

  .tree-root {
    padding: 0 4px;
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
