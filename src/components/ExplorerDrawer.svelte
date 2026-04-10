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
    children,
    headerActions,
  }: {
    id: string;
    title: string;
    defaultOpen?: boolean;
    defaultHeight?: number | null;
    minHeight?: number;
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

  let isDragging = $state(false);
  let startY = $state(0);
  let startHeight = $state(0);

  function toggleCollapse(): void {
    uiStore.toggleDrawer(id);
  }

  function handleResizePointerDown(e: PointerEvent): void {
    if (e.button !== 0 || collapsed) return;
    isDragging = true;
    startY = e.clientY;
    startHeight = storedHeight ?? minHeight;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function handleResizePointerMove(e: PointerEvent): void {
    if (!isDragging) return;
    const delta = e.clientY - startY;
    const newHeight = Math.max(minHeight, startHeight + delta);
    uiStore.setDrawerHeight(id, newHeight);
  }

  function handleResizePointerUp(e: PointerEvent): void {
    if (!isDragging) return;
    isDragging = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }
</script>

<div
  class="explorer-drawer"
  class:collapsed
  style:height={collapsed ? "24px" : storedHeight ? `${storedHeight}px` : undefined}
  style:flex={collapsed || storedHeight ? "none" : "1 1 0%"}
  style:min-height={collapsed ? "24px" : `${minHeight}px`}
>
  <Drawer {title} {collapsed} ontoggle={toggleCollapse} {headerActions}>
    {@render children()}
  </Drawer>

  <!-- Resize handle at bottom -->
  {#if !collapsed}
    <div
      class="drawer-resize-handle"
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize {title} drawer"
      onpointerdown={handleResizePointerDown}
      onpointermove={handleResizePointerMove}
      onpointerup={handleResizePointerUp}
    ></div>
  {/if}
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

  .drawer-resize-handle {
    height: 3px;
    cursor: ns-resize;
    background: transparent;
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 2;
    transition: background 100ms;
  }

  .drawer-resize-handle:hover,
  .drawer-resize-handle:active {
    background: var(--th-accent-sky, #38bdf8);
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
