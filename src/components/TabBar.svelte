<script lang="ts">
  import { uiStore, type EditorTab } from "../lib/stores/uiStore.svelte.js";
  import { m } from "../paraglide/messages.js";
  import X from "@lucide/svelte/icons/x";
  import FileCode from "@lucide/svelte/icons/file-code";
  import FileCode2 from "@lucide/svelte/icons/file-code-2";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import Home from "@lucide/svelte/icons/home";
  import Cog from "@lucide/svelte/icons/cog";
  import Languages from "@lucide/svelte/icons/languages";
  import FileText from "@lucide/svelte/icons/file-text";

  import Palette from "@lucide/svelte/icons/palette";

  const TAB_ICONS: Record<EditorTab["type"], typeof FileCode> = {
    section: FileCode,
    filteredSection: FileCode,
    group: FolderOpen,
    "lsx-file": FileCode2,
    welcome: Home,
    "meta-lsx": Cog,
    localization: Languages,
    "file-preview": FileText,
    settings: Cog,
    "theme-gallery": Palette,
    "script-editor": FileCode2,
  };

  let tabs = $derived(uiStore.openTabs);
  let activeTabId = $derived(uiStore.activeTabId);

  /** Drag-to-reorder state */
  let dragFromIndex = $state(-1);
  let dragOverIndex = $state(-1);

  function handleClose(e: MouseEvent, tabId: string): void {
    e.stopPropagation();
    uiStore.closeTab(tabId);
  }

  /** Middle-click to close */
  function handleAuxClick(e: MouseEvent, tabId: string): void {
    if (e.button === 1) {
      e.preventDefault();
      uiStore.closeTab(tabId);
    }
  }

  function handleDragStart(e: DragEvent, index: number): void {
    dragFromIndex = index;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
    }
  }

  function handleDragOver(e: DragEvent, index: number): void {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    dragOverIndex = index;
  }

  function handleDrop(e: DragEvent, index: number): void {
    e.preventDefault();
    if (dragFromIndex >= 0 && dragFromIndex !== index) {
      uiStore.moveTab(dragFromIndex, index);
    }
    dragFromIndex = -1;
    dragOverIndex = -1;
  }

  function handleDragEnd(): void {
    dragFromIndex = -1;
    dragOverIndex = -1;
  }
</script>

{#if tabs.length > 0}
  <div class="tab-bar" role="tablist" aria-label={m.editor_tabs_tablist_aria()}>
    {#each tabs as tab, i (tab.id)}
      {@const isActive = tab.id === activeTabId}
      {@const TabIcon = TAB_ICONS[tab.type]}
      <button
        role="tab"
        class="tab"
        class:active={isActive}
        class:dirty={tab.dirty}
        class:preview={tab.preview}
        class:drag-over={dragOverIndex === i && dragFromIndex !== i}
        aria-selected={isActive}
        title={tab.label}
        draggable="true"
        onclick={() => uiStore.activeTabId = tab.id}
        ondblclick={() => uiStore.pinTab(tab.id)}
        onauxclick={(e: MouseEvent) => handleAuxClick(e, tab.id)}
        ondragstart={(e: DragEvent) => handleDragStart(e, i)}
        ondragover={(e: DragEvent) => handleDragOver(e, i)}
        ondrop={(e: DragEvent) => handleDrop(e, i)}
        ondragend={handleDragEnd}
      >
        {#if TabIcon}
          <TabIcon size={13} class="tab-icon shrink-0" />
        {/if}
        <span class="tab-label truncate">{tab.label}</span>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <span
          class="tab-close"
          role="button"
          tabindex={-1}
          aria-label={m.editor_tabs_close_aria({ label: tab.label })}
          onclick={(e: MouseEvent) => handleClose(e, tab.id)}
          onkeydown={(e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); uiStore.closeTab(tab.id); } }}
        >
          {#if tab.dirty}
            <span class="dirty-dot"></span>
          {:else}
            <X size={12} />
          {/if}
        </span>
      </button>
    {/each}
  </div>
{/if}

<style>
  .tab-bar {
    display: flex;
    background: var(--th-bg-900);
    border-bottom: 1px solid var(--th-border-800, var(--th-bg-700));
    overflow-x: auto;
    overflow-y: hidden;
    min-height: 32px;
    max-height: 32px;
    scrollbar-width: none;
  }

  .tab-bar::-webkit-scrollbar {
    display: none;
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 0 8px 0 10px;
    height: 32px;
    border: none;
    border-right: 1px solid var(--th-border-800, var(--th-bg-700));
    background: var(--th-bg-900);
    color: var(--th-text-500);
    font-size: 12px;
    cursor: pointer;
    white-space: nowrap;
    min-width: 0;
    max-width: 160px;
    transition: background 0.1s, color 0.1s;
    user-select: none;
  }

  .tab:hover {
    background: var(--th-bg-800);
    color: var(--th-text-300);
  }

  .tab.active {
    background: var(--th-bg-800);
    color: var(--th-text-100);
    border-bottom: 2px solid var(--th-accent-500, #38bdf8);
  }

  .tab.drag-over {
    border-left: 2px solid var(--th-accent-500, #38bdf8);
  }

  .tab.preview .tab-label {
    font-style: italic;
  }

  .tab-label {
    flex: 1;
    min-width: 0;
  }

  .tab-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 3px;
    border: none;
    background: transparent;
    color: var(--th-text-500);
    cursor: pointer;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.1s, background 0.1s;
  }

  .tab:hover .tab-close,
  .tab.active .tab-close {
    opacity: 1;
  }

  .tab-close:hover {
    background: var(--th-bg-600);
    color: var(--th-text-200);
  }

  .dirty-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--th-text-400);
  }

  .tab.dirty .dirty-dot {
    opacity: 1;
  }
</style>
