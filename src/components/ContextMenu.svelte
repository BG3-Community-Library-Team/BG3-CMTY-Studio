<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    x,
    y,
    header = '',
    headerTitle = '',
    onclose,
    children,
  }: {
    x: number;
    y: number;
    header?: string;
    headerTitle?: string;
    onclose: () => void;
    children: Snippet;
  } = $props();

  let menuEl: HTMLDivElement | undefined = $state(undefined);
  let menuStyle = $state('visibility: hidden');

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
<div
  bind:this={menuEl}
  class="ctx-container fixed z-[151] min-w-[180px] py-1 rounded-lg shadow-xl shadow-black/40
         bg-[var(--th-bg-800,#1f1f23)] border border-[var(--th-border-700,#3f3f46)] text-sm select-none"
  style={menuStyle}
  role="menu"
  tabindex="-1"
  onmousedown={(e) => e.stopPropagation()}
  oncontextmenu={(e) => { e.preventDefault(); onclose(); }}
>
  {#if header}
    <div class="ctx-header" title={headerTitle || header}>
      {header}
    </div>
  {/if}
  {@render children()}
</div>

<style>
  .ctx-header {
    padding: 6px 12px 4px;
    font-size: 10px;
    color: var(--th-text-500);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 240px;
    border-bottom: 1px solid var(--th-border-700);
    margin-bottom: 2px;
  }
  .ctx-container :global(.ctx-item) {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 12px;
    border: none;
    background: transparent;
    color: var(--th-text-200);
    font-size: 12px;
    cursor: pointer;
    text-align: left;
    transition: background-color 0.15s;
  }
  .ctx-container :global(.ctx-item:hover) {
    background: var(--th-bg-700, #27272a);
  }
</style>
