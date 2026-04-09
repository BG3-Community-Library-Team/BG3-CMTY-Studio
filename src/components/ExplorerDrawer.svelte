<script lang="ts">
  import type { Snippet } from "svelte";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
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
  let headerHovered = $state(false);

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

  function handleHeaderKeydown(e: KeyboardEvent): void {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleCollapse();
    }
  }
</script>

<div
  class="explorer-drawer"
  class:collapsed
  style:height={collapsed ? "24px" : storedHeight ? `${storedHeight}px` : undefined}
  style:flex={collapsed || storedHeight ? "none" : "1 1 0%"}
  style:min-height={collapsed ? "24px" : `${minHeight}px`}
>
  <!-- Drawer header -->
  <button
    class="drawer-header"
    onclick={toggleCollapse}
    onkeydown={handleHeaderKeydown}
    onmouseenter={() => (headerHovered = true)}
    onmouseleave={() => (headerHovered = false)}
    aria-expanded={!collapsed}
    aria-controls="drawer-body-{id}"
  >
    <span class="drawer-chevron" class:expanded={!collapsed}>
      <ChevronRight size={14} />
    </span>
    <span class="drawer-title">{title.toUpperCase()}</span>

    {#if headerActions && headerHovered}
      <span
        class="drawer-actions"
        role="presentation"
        onclick={(e: MouseEvent) => e.stopPropagation()}
        onkeydown={(e: KeyboardEvent) => e.stopPropagation()}
      >
        {@render headerActions()}
      </span>
    {/if}
  </button>

  <!-- Drawer body -->
  {#if !collapsed}
    <div class="drawer-body" id="drawer-body-{id}">
      {@render children()}
    </div>
  {/if}

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
    overflow: hidden;
    transition: height 150ms ease-out;
    position: relative;
    border-bottom: 1px solid var(--th-border-700, #3f3f46);
  }

  .explorer-drawer.collapsed {
    flex: none !important;
  }

  .drawer-header {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 24px;
    min-height: 24px;
    padding: 0 8px;
    background: var(--th-bg-700, #3f3f46);
    border: none;
    cursor: pointer;
    user-select: none;
    position: sticky;
    top: 0;
    z-index: 1;
    width: 100%;
    text-align: left;
    color: var(--th-text-300, #d4d4d8);
  }

  .drawer-header:hover {
    background: color-mix(in srgb, var(--th-bg-700, #3f3f46) 80%, white);
  }

  .drawer-header:focus-visible {
    outline: 2px solid var(--th-accent-sky, #38bdf8);
    outline-offset: -2px;
  }

  .drawer-chevron {
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 150ms ease-out;
    flex-shrink: 0;
    color: var(--th-text-500, #8b8b94);
  }

  .drawer-chevron.expanded {
    transform: rotate(90deg);
  }

  .drawer-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .drawer-actions {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .drawer-body {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    background: var(--th-sidebar-bg, var(--th-bg-900, #18181b));
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

  :global(:root.reduced-motion) .drawer-chevron {
    transition: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .explorer-drawer {
      transition: none;
    }
    .drawer-chevron {
      transition: none;
    }
  }
</style>
