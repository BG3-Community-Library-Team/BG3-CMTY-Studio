<script module lang="ts">
  // Shared across all ExplorerDrawer instances — ensures only one context menu is open at a time
  let closeActiveMenu: (() => void) | null = null;
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import Drawer from "./Drawer.svelte";
  import { uiStore } from "../lib/stores/uiStore.svelte.js";

  let {
    id,
    title,
    count,
    defaultOpen = true,
    defaultHeight = null,
    minHeight = 80,
    isFirst = false,
    allDrawerIds,
    drawerTitles,
    children,
    headerActions,
  }: {
    id: string;
    title: string;
    count?: number;
    defaultOpen?: boolean;
    defaultHeight?: number | null;
    minHeight?: number;
    isFirst?: boolean;
    allDrawerIds?: string[];
    drawerTitles?: Record<string, string>;
    children: Snippet;
    headerActions?: Snippet;
  } = $props();

  // Initialize drawer state in uiStore if not present
  $effect(() => {
    if (!uiStore.explorerDrawers[id]) {
      uiStore.explorerDrawers[id] = {
        collapsed: !defaultOpen,
        height: defaultHeight,
      };
    }
  });

  let collapsed = $derived(uiStore.explorerDrawers[id]?.collapsed ?? !defaultOpen);
  let storedHeight = $derived(uiStore.explorerDrawers[id]?.height ?? defaultHeight);

  function toggleCollapse(): void {
    uiStore.toggleDrawer(id);
  }

  // ── Resize handle ──
  let resizeDragging = $state(false);
  let resizeStartY = $state(0);
  let resizeStartHeight = $state(0);

  function handleResizeDown(e: PointerEvent): void {
    if (e.button !== 0 || collapsed) return;
    e.preventDefault();
    resizeDragging = true;
    resizeStartY = e.clientY;
    // Measure the actual rendered height of the drawer element
    const el = (e.target as HTMLElement).closest('.explorer-drawer') as HTMLElement | null;
    resizeStartHeight = el ? el.offsetHeight : (storedHeight ?? 120);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handleResizeMove(e: PointerEvent): void {
    if (!resizeDragging) return;
    // Drag up (negative delta) → height increases. Drag down (positive delta) → height decreases.
    const delta = e.clientY - resizeStartY;
    const newHeight = Math.max(minHeight, resizeStartHeight - delta);
    uiStore.setDrawerHeight(id, newHeight);
  }

  function handleResizeUp(e: PointerEvent): void {
    if (!resizeDragging) return;
    resizeDragging = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }

  // ── Context menu for hide/show/pin ──
  let showCtxMenu = $state(false);
  let ctxMenuX = $state(0);
  let ctxMenuY = $state(0);

  function handleContextMenu(e: MouseEvent): void {
    if (!allDrawerIds) return;
    e.preventDefault();

    // Close any other open context menu first
    if (closeActiveMenu) closeActiveMenu();

    ctxMenuX = e.clientX;
    ctxMenuY = e.clientY;

    // Clamp so menu doesn't overflow bottom of viewport (estimate ~220px menu height)
    const menuHeight = 220;
    const viewportH = window.innerHeight;
    if (ctxMenuY + menuHeight > viewportH) {
      ctxMenuY = Math.max(4, viewportH - menuHeight);
    }

    showCtxMenu = true;

    // Register as active menu & close on next click anywhere
    const close = () => {
      showCtxMenu = false;
      document.removeEventListener("click", close);
      if (closeActiveMenu === close) closeActiveMenu = null;
    };
    closeActiveMenu = close;
    setTimeout(() => document.addEventListener("click", close), 0);
  }

  function drawerLabel(did: string): string {
    if (drawerTitles?.[did]) return drawerTitles[did];
    return did.replace(/^git-/, "").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  }
</script>

<div
  class="explorer-drawer"
  class:collapsed
  class:resizing={resizeDragging}
  style:height={collapsed ? "24px" : storedHeight ? `${storedHeight}px` : undefined}
  style:flex={collapsed || storedHeight ? "none" : "1 1 0%"}
  style:min-height={collapsed ? "24px" : `${minHeight}px`}
>
  {#if !isFirst && !collapsed}
    <div
      class="drawer-resize-handle"
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize drawer"
      onpointerdown={handleResizeDown}
      onpointermove={handleResizeMove}
      onpointerup={handleResizeUp}
    ></div>
  {/if}
  <Drawer
    {title}
    {count}
    {collapsed}
    ontoggle={toggleCollapse}
    {headerActions}
    pinned={uiStore.isDrawerPinned(id)}
    onhide={allDrawerIds ? () => uiStore.hideDrawer(id, allDrawerIds!) : undefined}
    oncontextmenu={allDrawerIds
      ? (e: MouseEvent) => handleContextMenu(e)
      : undefined}
  >
    {@render children()}
  </Drawer>
</div>

{#if showCtxMenu && allDrawerIds}
  <div class="drawer-ctx-menu" style:left="{ctxMenuX}px" style:top="{ctxMenuY}px">
    {#if uiStore.isDrawerPinned(id)}
      <button class="drawer-ctx-item" onclick={() => { uiStore.unpinDrawer(id); showCtxMenu = false; }}>
        Unpin drawer
      </button>
    {:else}
      <button class="drawer-ctx-item" onclick={() => { uiStore.pinDrawer(id); showCtxMenu = false; }}>
        Pin to top
      </button>
    {/if}
    <div class="drawer-ctx-separator"></div>
    {#each allDrawerIds as did (did)}
      {@const visible = !uiStore.isDrawerHidden(did)}
      {@const visibleCount = allDrawerIds.filter(d => !uiStore.isDrawerHidden(d)).length}
      <button
        class="drawer-ctx-item drawer-ctx-toggle"
        onclick={() => {
          if (visible) { uiStore.hideDrawer(did, allDrawerIds); }
          else { uiStore.showDrawer(did); }
          showCtxMenu = false;
        }}
        disabled={visible && visibleCount <= 1}
      >
        <span class="drawer-ctx-check">{visible ? "✓" : ""}</span>
        {drawerLabel(did)}
      </button>
    {/each}
  </div>
{/if}

<style>
  .explorer-drawer {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    transition: height 150ms ease-out;
    position: relative;
    border-bottom: 1px solid var(--th-border-700, #3f3f46);
  }

  .explorer-drawer.collapsed {
    flex: none !important;
  }

  /* ── Resize handle at top (absolutely positioned — no layout space) ── */
  .drawer-resize-handle {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 5px;
    cursor: ns-resize;
    background: transparent;
    transition: background 100ms;
    z-index: 10;
  }

  .explorer-drawer.resizing {
    transition: none;
  }

  .drawer-resize-handle:hover,
  .drawer-resize-handle:active {
    background: var(--th-accent-sky, #38bdf8);
  }

  /* Explorer-specific: body background via Drawer's body */
  .explorer-drawer :global(.drawer-body) {
    background: var(--th-sidebar-bg, var(--th-bg-900, #18181b));
  }

  /* Explorer-specific: sticky header in scrollable context */
  .explorer-drawer :global(.drawer-header) {
    position: sticky;
    top: 0;
    z-index: 1;
  }

  /* Reduced motion: remove height transition */
  :global(:root.reduced-motion) .explorer-drawer {
    transition: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .explorer-drawer {
      transition: none;
    }
  }

  /* ── Drawer context menu ── */
  .drawer-ctx-menu {
    position: fixed;
    z-index: 9999;
    min-width: 160px;
    background: var(--th-bg-700, #3f3f46);
    border: 1px solid var(--th-border-600, #52525b);
    border-radius: 6px;
    padding: 4px 0;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  }

  .drawer-ctx-item {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 5px 12px;
    border: none;
    background: none;
    color: var(--th-text-200, #e4e4e7);
    font-size: 0.75rem;
    text-align: left;
    cursor: pointer;
    gap: 6px;
  }

  .drawer-ctx-check {
    display: inline-block;
    width: 14px;
    text-align: center;
    flex-shrink: 0;
    font-size: 0.7rem;
    color: var(--th-success, #22c55e);
  }

  .drawer-ctx-item:hover:not(:disabled) {
    background: var(--th-bg-600, #52525b);
  }

  .drawer-ctx-item:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .drawer-ctx-separator {
    height: 1px;
    margin: 4px 0;
    background: var(--th-border-700, #3f3f46);
  }
</style>
