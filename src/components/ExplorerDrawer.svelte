<script lang="ts">
  import type { Snippet } from "svelte";
  import Drawer from "./Drawer.svelte";
  import { uiStore } from "../lib/stores/uiStore.svelte.js";

  let {
    id,
    title,
    defaultOpen = true,
    defaultHeight = null,
    minHeight = 80,
    isFirst = false,
    children,
    headerActions,
  }: {
    id: string;
    title: string;
    defaultOpen?: boolean;
    defaultHeight?: number | null;
    minHeight?: number;
    isFirst?: boolean;
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
  <Drawer {title} {collapsed} ontoggle={toggleCollapse} {headerActions}>
    {@render children()}
  </Drawer>
</div>

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
</style>
