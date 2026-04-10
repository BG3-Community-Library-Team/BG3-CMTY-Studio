<script lang="ts">
  import { uiStore } from "../lib/stores/uiStore.svelte.js";
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import { m } from "../paraglide/messages.js";

  interface Props {
    isReady?: boolean;
    onrefresh?: () => void;
    onpackage?: () => void;
    onopenproject?: () => void;
    refreshing?: boolean;
  }

  let { isReady = false, onrefresh, onpackage, onopenproject, refreshing = false }: Props = $props();
</script>

<div class="explorer-header">
  <span class="explorer-label">{m.explorer_header_title().toUpperCase()}</span>

  {#if isReady}
    <div class="header-actions">
      <button
        class="header-icon-btn"
        title="Refresh all sections"
        aria-label="Refresh all sections"
        onclick={onrefresh}
      >
        <svg class="icon {refreshing ? 'animate-spin' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
      </button>
      <button
        class="header-icon-btn"
        title="Package project"
        aria-label="Package project"
        onclick={onpackage}
      >
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
      </button>
      <button
        class="header-icon-btn"
        title="Open a different project"
        aria-label="Open project folder"
        onclick={onopenproject}
      >
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/></svg>
      </button>

      <div class="view-mode-toggle">
        <button
          class="view-mode-btn"
          class:active={uiStore.explorerViewMode === "studio"}
          onclick={() => uiStore.setExplorerViewMode("studio")}
          aria-pressed={uiStore.explorerViewMode === "studio"}
        >
          {m.explorer_view_mode_studio()}
        </button>
        <button
          class="view-mode-btn"
          class:active={uiStore.explorerViewMode === "file-tree"}
          onclick={() => uiStore.setExplorerViewMode("file-tree")}
          aria-pressed={uiStore.explorerViewMode === "file-tree"}
        >
          {m.explorer_view_mode_file_tree()}
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .explorer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 28px;
    min-height: 28px;
    padding: 0 12px 0 16px;
    background: var(--th-sidebar-bg, var(--th-bg-900, #18181b));
    border-bottom: 1px solid var(--th-border-700, #3f3f46);
    user-select: none;
  }

  .explorer-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--th-text-500, #8b8b94);
    white-space: nowrap;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .header-icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border: none;
    background: transparent;
    color: var(--th-text-500, #8b8b94);
    cursor: pointer;
    border-radius: 3px;
    padding: 0;
  }

  .header-icon-btn:hover {
    color: var(--th-text-200, #e4e4e7);
    background: var(--th-bg-700, #3f3f46);
  }

  .header-icon-btn .icon {
    width: 14px;
    height: 14px;
  }

  .view-mode-toggle {
    display: flex;
    gap: 0;
    border: 1px solid var(--th-border-700, #3f3f46);
    border-radius: 4px;
    overflow: hidden;
    margin-left: 4px;
  }

  .view-mode-btn {
    font-size: 10px;
    padding: 2px 8px;
    border: none;
    background: transparent;
    color: var(--th-text-500, #8b8b94);
    cursor: pointer;
    white-space: nowrap;
    transition: background 100ms, color 100ms;
  }

  .view-mode-btn:hover {
    background: color-mix(in srgb, var(--th-bg-700, #3f3f46) 60%, transparent);
    color: var(--th-text-300, #d4d4d8);
  }

  .view-mode-btn.active {
    background: var(--th-bg-700, #3f3f46);
    color: var(--th-text-100, #f4f4f5);
  }

  .view-mode-btn:focus-visible {
    outline: 2px solid var(--th-accent-sky, #38bdf8);
    outline-offset: -2px;
    z-index: 1;
  }

  /* Reduced motion */
  :global(:root.reduced-motion) .view-mode-btn {
    transition: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .view-mode-btn {
      transition: none;
    }
  }
</style>
