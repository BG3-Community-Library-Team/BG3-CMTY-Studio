<script lang="ts">
  import { uiStore, type EditorTab } from "../lib/stores/uiStore.svelte.js";
  import { m } from "../paraglide/messages.js";
  import type { ContextMenuItemDef } from "../lib/types/contextMenu.js";
  import ContextMenu from "./ContextMenu.svelte";
  import X from "@lucide/svelte/icons/x";
  import Pin from "@lucide/svelte/icons/pin";
  import PinOff from "@lucide/svelte/icons/pin-off";
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import FileCode from "@lucide/svelte/icons/file-code";
  import FileCode2 from "@lucide/svelte/icons/file-code-2";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import Home from "@lucide/svelte/icons/home";
  import Cog from "@lucide/svelte/icons/cog";
  import Languages from "@lucide/svelte/icons/languages";
  import FileText from "@lucide/svelte/icons/file-text";

  import Palette from "@lucide/svelte/icons/palette";
  import BookOpen from "@lucide/svelte/icons/book-open";
  import GitCompareArrows from "@lucide/svelte/icons/git-compare-arrows";
  import GitCommitVertical from "@lucide/svelte/icons/git-commit-vertical";

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
    readme: BookOpen,
    "git-diff": GitCompareArrows,
    "git-commit": GitCommitVertical,
  };

  let tabs = $derived(uiStore.openTabs);
  let activeTabId = $derived(uiStore.activeTabId);

  /** Drag-to-reorder state */
  let dragFromIndex = $state(-1);
  let dragOverIndex = $state(-1);

  /** Tab container element for scroll management */
  let tabContainerEl: HTMLDivElement | undefined = $state(undefined);

  /** Whether the container has overflow on each side */
  let canScrollLeft = $state(false);
  let canScrollRight = $state(false);

  /** Map of tab id → element ref for scrollIntoView */
  let tabElements = new Map<string, HTMLElement>();

  function updateScrollState(): void {
    if (!tabContainerEl) return;
    canScrollLeft = tabContainerEl.scrollLeft > 0;
    canScrollRight =
      tabContainerEl.scrollLeft + tabContainerEl.clientWidth < tabContainerEl.scrollWidth - 1;
  }

  /** Scroll active tab into view when activeTabId changes */
  $effect(() => {
    const id = activeTabId;
    // Tick to let DOM update
    requestAnimationFrame(() => {
      const el = tabElements.get(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      }
      updateScrollState();
    });
  });

  /** Update overflow indicators on scroll */
  function handleScroll(): void {
    updateScrollState();
  }

  /** Convert vertical mouse wheel into horizontal scroll */
  function handleWheel(e: WheelEvent): void {
    if (!tabContainerEl) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      tabContainerEl.scrollLeft += e.deltaY;
      updateScrollState();
    }
  }

  /** Scroll arrows */
  function scrollLeft(): void {
    tabContainerEl?.scrollBy({ left: -120, behavior: "smooth" });
  }
  function scrollRight(): void {
    tabContainerEl?.scrollBy({ left: 120, behavior: "smooth" });
  }

  function handleClose(e: MouseEvent, tab: EditorTab): void {
    e.stopPropagation();
    // Pinned tabs cannot be closed until unpinned
    if (tab.pinned) return;
    if (tab.type === "welcome") return;
    uiStore.closeTab(tab.id);
  }

  /** Middle-click to close (not for welcome or pinned tabs) */
  function handleAuxClick(e: MouseEvent, tab: EditorTab): void {
    if (e.button === 1) {
      e.preventDefault();
      if (tab.type !== "welcome" && !tab.pinned) {
        uiStore.closeTab(tab.id);
      }
    }
  }

  function handleDragStart(e: DragEvent, index: number, tab: EditorTab): void {
    // Welcome tab cannot be dragged
    if (tab.type === "welcome") {
      e.preventDefault();
      return;
    }
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

  /** Context menu state */
  let ctxVisible = $state(false);
  let ctxX = $state(0);
  let ctxY = $state(0);
  let ctxTabId = $state("");

  function handleContextMenu(e: MouseEvent, tab: EditorTab): void {
    e.preventDefault();
    ctxX = e.clientX;
    ctxY = e.clientY;
    ctxTabId = tab.id;
    ctxVisible = true;
  }

  let ctxItems = $derived.by((): ContextMenuItemDef[] => {
    const tab = tabs.find(t => t.id === ctxTabId);
    if (!tab) return [];
    const isWelcome = tab.type === "welcome";
    const isPinned = !!tab.pinned;
    return [
      {
        label: "Close Tab",
        icon: X,
        action: () => uiStore.closeTab(ctxTabId),
        disabled: isWelcome || isPinned,
      },
      {
        label: "Close Other Tabs",
        action: () => {
          const idsToClose = tabs
            .filter(t => t.id !== ctxTabId && t.type !== "welcome" && !t.pinned)
            .map(t => t.id);
          for (const id of idsToClose) uiStore.closeTab(id);
        },
        disabled: tabs.filter(t => t.id !== ctxTabId && t.type !== "welcome" && !t.pinned).length === 0,
        separator: "after",
      },
      {
        label: isPinned ? "Unpin Tab" : "Pin Tab",
        icon: isPinned ? PinOff : Pin,
        action: () => {
          if (isPinned) {
            uiStore.unpinTab(ctxTabId);
          } else {
            uiStore.pinTab(ctxTabId);
          }
        },
        disabled: isWelcome,
      },
    ];
  });

  /** Register / unregister tab element refs (Svelte action) */
  function tabRef(el: HTMLElement, id: string) {
    tabElements.set(id, el);
    return {
      destroy() {
        tabElements.delete(id);
      },
    };
  }
</script>

{#if tabs.length > 0}
  <div class="tab-bar-outer" role="tablist" aria-label={m.editor_tabs_tablist_aria()}>
    <!-- Left scroll arrow (visible when overflow) -->
    {#if canScrollLeft}
      <button class="scroll-arrow scroll-arrow-left" aria-hidden="true" tabindex={-1} onclick={scrollLeft}>
        <ChevronLeft size={14} />
      </button>
    {/if}

    <!-- Tab container with scroll -->
    <div
      class="tab-bar"
      class:fade-left={canScrollLeft}
      class:fade-right={canScrollRight}
      bind:this={tabContainerEl}
      onscroll={handleScroll}
      onwheel={handleWheel}
    >
      {#each tabs as tab, i (tab.id)}
        {@const isActive = tab.id === activeTabId}
        {@const TabIcon = TAB_ICONS[tab.type]}
        {@const isWelcome = tab.type === "welcome"}
        <button
          role="tab"
          class="tab"
          class:active={isActive}
          class:dirty={tab.dirty}
          class:preview={tab.preview}
          class:tab-welcome={isWelcome}
          class:drag-over={dragOverIndex === i && dragFromIndex !== i}
          aria-selected={isActive}
          title={isWelcome ? m.tab_welcome() : tab.label}
          draggable={!isWelcome}
          onclick={() => uiStore.activeTabId = tab.id}
          ondblclick={() => { if (tab.preview) uiStore.promoteTab(tab.id); }}
          onauxclick={(e: MouseEvent) => handleAuxClick(e, tab)}
          onmouseup={(e: MouseEvent) => handleAuxClick(e, tab)}
          oncontextmenu={(e: MouseEvent) => handleContextMenu(e, tab)}
          ondragstart={(e: DragEvent) => handleDragStart(e, i, tab)}
          ondragover={(e: DragEvent) => handleDragOver(e, i)}
          ondrop={(e: DragEvent) => handleDrop(e, i)}
          ondragend={handleDragEnd}
          use:tabRef={tab.id}
        >
          {#if tab.pinned}
            <Pin size={10} class="tab-pin-icon shrink-0" />
          {/if}
          {#if TabIcon}
            <TabIcon size={13} class="tab-icon shrink-0" />
          {/if}
          {#if !isWelcome}
            <span class="tab-label truncate">{tab.label}</span>
            {#if !tab.pinned}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <span
                class="tab-close"
                role="button"
                tabindex={-1}
                aria-label={m.editor_tabs_close_aria({ label: tab.label })}
                onclick={(e: MouseEvent) => handleClose(e, tab)}
                onkeydown={(e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); uiStore.closeTab(tab.id); } }}
              >
                {#if tab.dirty}
                  <span class="dirty-dot"></span>
                {:else}
                  <X size={12} />
                {/if}
              </span>
            {/if}
          {/if}
        </button>
      {/each}
    </div>

    <!-- Right scroll arrow (visible when overflow) -->
    {#if canScrollRight}
      <button class="scroll-arrow scroll-arrow-right" aria-hidden="true" tabindex={-1} onclick={scrollRight}>
        <ChevronRight size={14} />
      </button>
    {/if}
  </div>
{/if}

{#if ctxVisible}
  <ContextMenu x={ctxX} y={ctxY} items={ctxItems} onclose={() => { ctxVisible = false; }} />
{/if}

<style>
  .tab-bar-outer {
    display: flex;
    align-items: stretch;
    background: var(--th-bg-900);
    border-bottom: 1px solid var(--th-border-800, var(--th-bg-700));
    min-height: 32px;
    max-height: 32px;
    position: relative;
  }

  .tab-bar {
    display: flex;
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
  }

  .tab-bar::-webkit-scrollbar {
    display: none;
  }

  /* Edge fade gradients for overflow indication */
  .tab-bar.fade-left {
    mask-image: linear-gradient(to right, transparent, black 24px);
    -webkit-mask-image: linear-gradient(to right, transparent, black 24px);
  }

  .tab-bar.fade-right {
    mask-image: linear-gradient(to left, transparent, black 24px);
    -webkit-mask-image: linear-gradient(to left, transparent, black 24px);
  }

  .tab-bar.fade-left.fade-right {
    mask-image: linear-gradient(to right, transparent, black 24px, black calc(100% - 24px), transparent);
    -webkit-mask-image: linear-gradient(to right, transparent, black 24px, black calc(100% - 24px), transparent);
  }

  .scroll-arrow {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    flex-shrink: 0;
    border: none;
    background: var(--th-bg-900);
    color: var(--th-text-500);
    cursor: pointer;
    z-index: 1;
    padding: 0;
    transition: color 0.1s, background 0.1s;
  }

  .scroll-arrow:hover {
    color: var(--th-text-200);
    background: var(--th-bg-800);
  }

  .scroll-arrow-left {
    border-right: 1px solid var(--th-border-800, var(--th-bg-700));
  }

  .scroll-arrow-right {
    border-left: 1px solid var(--th-border-800, var(--th-bg-700));
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
    min-width: 120px;
    max-width: 160px;
    flex-shrink: 0;
    transition: background 0.1s, color 0.1s;
    user-select: none;
  }

  .tab.tab-welcome {
    min-width: 36px;
    max-width: 36px;
    padding: 0;
    justify-content: center;
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

  :global(.tab-pin-icon) {
    color: var(--th-accent-500, #38bdf8);
    opacity: 0.7;
    margin-right: -3px;
  }
</style>
