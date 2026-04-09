<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { ContextMenuItemDef } from '../lib/types/contextMenu.js';
  import ContextMenuItem from './ContextMenuItem.svelte';
  import ContextMenuSeparator from './ContextMenuSeparator.svelte';

  let {
    x,
    y,
    header = '',
    headerTitle = '',
    onclose,
    children,
    items,
  }: {
    x: number;
    y: number;
    header?: string;
    headerTitle?: string;
    onclose: () => void;
    children?: Snippet;
    items?: ContextMenuItemDef[];
  } = $props();

  let menuEl: HTMLDivElement | undefined = $state(undefined);
  let menuStyle = $state('visibility: hidden');
  let focusIdx = $state(-1);

  // Filtered items for keyboard navigation (skip disabled)
  let navigableIndices = $derived.by(() => {
    if (!items) return [];
    return items.reduce<number[]>((acc, item, i) => {
      if (!item.disabled) acc.push(i);
      return acc;
    }, []);
  });

  // Track which item has an open submenu
  let openSubmenuIdx = $state(-1);

  $effect(() => {
    // Re-run when x, y, or the menu element changes
    if (!menuEl) {
      menuStyle = `left: ${x}px; top: ${y}px; visibility: hidden`;
      return;
    }
    // Use requestAnimationFrame to let the browser lay out the menu first
    const curX = x;
    const curY = y;
    requestAnimationFrame(() => {
      if (!menuEl) return;
      const rect = menuEl.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const clampedX = Math.min(curX, vw - rect.width - 8);
      const clampedY = Math.min(curY, vh - rect.height - 8);
      menuStyle = `left: ${Math.max(4, clampedX)}px; top: ${Math.max(4, clampedY)}px`;
    });
  });

  // Auto-focus menu on mount for keyboard navigation
  $effect(() => {
    if (menuEl) menuEl.focus();
  });

  function moveFocus(delta: number) {
    if (!navigableIndices.length) return;
    const currentPos = navigableIndices.indexOf(focusIdx);
    let nextPos: number;
    if (currentPos === -1) {
      nextPos = delta > 0 ? 0 : navigableIndices.length - 1;
    } else {
      nextPos = (currentPos + delta + navigableIndices.length) % navigableIndices.length;
    }
    focusIdx = navigableIndices[nextPos];
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!items?.length) {
      if (e.key === 'Escape') onclose();
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        moveFocus(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        moveFocus(-1);
        break;
      case 'Home':
        e.preventDefault();
        if (navigableIndices.length) focusIdx = navigableIndices[0];
        break;
      case 'End':
        e.preventDefault();
        if (navigableIndices.length) focusIdx = navigableIndices[navigableIndices.length - 1];
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusIdx >= 0 && items[focusIdx]) {
          const item = items[focusIdx];
          if (!item.disabled) {
            if (item.submenu?.length) {
              openSubmenuIdx = focusIdx;
            } else {
              item.action?.();
              onclose();
            }
          }
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (focusIdx >= 0 && items[focusIdx]?.submenu?.length) {
          openSubmenuIdx = focusIdx;
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (openSubmenuIdx >= 0) {
          openSubmenuIdx = -1;
        } else {
          onclose();
        }
        break;
      case 'Escape':
        e.preventDefault();
        if (openSubmenuIdx >= 0) {
          openSubmenuIdx = -1;
        } else {
          onclose();
        }
        break;
    }
  }
</script>

<!-- Backdrop -->
<div
  class="fixed inset-0 z-[150]"
  role="none"
  onclick={onclose}
  onkeydown={(e) => { if (e.key === 'Escape') onclose(); }}
  oncontextmenu={(e) => { e.preventDefault(); onclose(); }}
></div>

<!-- Context menu -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  bind:this={menuEl}
  class="ctx-container fixed z-[151] min-w-[160px] max-w-[280px] py-1 rounded-md select-none
         bg-[var(--th-bg-600,#27272a)] border border-[var(--th-border-700,#3f3f46)] text-sm"
  style="{menuStyle}; box-shadow: 0 2px 8px rgba(0,0,0,0.25);"
  role="menu"
  tabindex="-1"
  onkeydown={handleKeydown}
  onmousedown={(e) => e.stopPropagation()}
  oncontextmenu={(e) => { e.preventDefault(); onclose(); }}
>
  {#if header}
    <div class="ctx-header" title={headerTitle || header}>
      {header}
    </div>
  {/if}
  {#if items?.length}
    {#each items as item, i}
      {#if item.separator === "before"}
        <ContextMenuSeparator />
      {/if}
      <ContextMenuItem
        {item}
        focused={focusIdx === i}
        onactivate={onclose}
        onsubmenuopen={() => { openSubmenuIdx = i; }}
        onsubmenuclose={() => { if (openSubmenuIdx === i) openSubmenuIdx = -1; }}
        onpointermove={() => { focusIdx = i; }}
      />
      {#if item.separator === "after"}
        <ContextMenuSeparator />
      {/if}
    {/each}
  {:else if children}
    {@render children()}
  {/if}
</div>

<style>
  .ctx-header {
    padding: 4px 10px 3px;
    font-size: 10px;
    color: var(--th-text-500);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 260px;
    border-bottom: 1px solid var(--th-border-700);
    margin-bottom: 2px;
  }
  /* Legacy snippet-based API: ctx-item class support */
  .ctx-container :global(.ctx-item) {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 4px 10px;
    border: none;
    background: transparent;
    color: var(--th-text-200);
    font-size: 12px;
    cursor: pointer;
    text-align: left;
    transition: background-color 0.1s;
  }
  .ctx-container :global(.ctx-item:hover) {
    background: var(--th-bg-500, #3f3f46);
  }
</style>
