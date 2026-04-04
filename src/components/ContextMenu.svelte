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

  let menuStyle = $derived.by(() => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : x + 200;
    const vh = typeof window !== 'undefined' ? window.innerHeight : y + 200;
    const clampedX = Math.min(x, vw - 200 - 8);
    const clampedY = Math.min(y, vh - 200 - 8);
    return `left: ${clampedX}px; top: ${clampedY}px`;
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
