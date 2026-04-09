<script lang="ts">
  import { uiStore } from "../lib/stores/uiStore.svelte.js";
  import { m } from "../paraglide/messages.js";
</script>

<div class="explorer-header">
  <span class="explorer-label">{m.explorer_header_title().toUpperCase()}</span>

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

  .view-mode-toggle {
    display: flex;
    gap: 0;
    border: 1px solid var(--th-border-700, #3f3f46);
    border-radius: 4px;
    overflow: hidden;
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
