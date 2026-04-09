<script lang="ts">
  import { explorerFilter } from "./explorerShared.js";
  import { m } from "../../paraglide/messages.js";
  import X from "@lucide/svelte/icons/x";
  import Filter from "@lucide/svelte/icons/filter";
  import Highlighter from "@lucide/svelte/icons/highlighter";
  import Regex from "@lucide/svelte/icons/regex";

  let {
    onfocusfirstmatch,
  }: {
    onfocusfirstmatch?: () => void;
  } = $props();

  let inputEl: HTMLInputElement | null = $state(null);

  export function focusInput() {
    inputEl?.focus();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      explorerFilter.close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      onfocusfirstmatch?.();
    }
  }
</script>

{#if explorerFilter.active}
  <div class="tree-filter" role="search">
    <input
      bind:this={inputEl}
      type="text"
      class="filter-input"
      placeholder={m.explorer_filter_placeholder()}
      value={explorerFilter.query}
      oninput={(e) => { explorerFilter.query = (e.currentTarget as HTMLInputElement).value; }}
      onkeydown={handleKeydown}
      aria-label={m.explorer_filter_placeholder()}
    />
    <button
      class="filter-btn"
      class:filter-btn-active={explorerFilter.mode === "filter"}
      title={explorerFilter.mode === "highlight" ? m.explorer_filter_mode_highlight() : m.explorer_filter_mode_filter()}
      aria-label={explorerFilter.mode === "highlight" ? m.explorer_filter_mode_highlight() : m.explorer_filter_mode_filter()}
      onclick={() => explorerFilter.toggleMode()}
    >
      {#if explorerFilter.mode === "filter"}
        <Filter size={13} />
      {:else}
        <Highlighter size={13} />
      {/if}
    </button>
    <button
      class="filter-btn"
      class:filter-btn-active={explorerFilter.fuzzy}
      title={m.explorer_filter_fuzzy_toggle()}
      aria-label={m.explorer_filter_fuzzy_toggle()}
      onclick={() => explorerFilter.toggleFuzzy()}
    >
      <Regex size={13} />
    </button>
    <button
      class="filter-btn"
      title={m.common_close()}
      aria-label={m.common_close()}
      onclick={() => explorerFilter.close()}
    >
      <X size={13} />
    </button>
  </div>
{/if}

<style>
  .tree-filter {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 2px 6px;
    border-bottom: 1px solid var(--th-border-700);
    background: var(--th-bg-800);
    height: 24px;
    flex-shrink: 0;
  }

  .filter-input {
    flex: 1;
    min-width: 0;
    height: 20px;
    padding: 0 4px;
    border: 1px solid var(--th-border-600);
    border-radius: 3px;
    background: var(--th-bg-900);
    color: var(--th-text-100);
    font-size: 11px;
    outline: none;
  }

  .filter-input:focus {
    border-color: var(--th-accent-500, #0ea5e9);
  }

  .filter-input::placeholder {
    color: var(--th-text-500);
  }

  .filter-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: none;
    border-radius: 3px;
    background: transparent;
    color: var(--th-text-400);
    cursor: pointer;
    flex-shrink: 0;
    padding: 0;
  }

  .filter-btn:hover {
    background: var(--th-bg-600);
    color: var(--th-text-200);
  }

  .filter-btn-active {
    color: var(--th-accent-400, #38bdf8);
    background: color-mix(in srgb, var(--th-accent-500, #0ea5e9) 15%, transparent);
  }

  .filter-btn-active:hover {
    background: color-mix(in srgb, var(--th-accent-500, #0ea5e9) 25%, transparent);
  }
</style>
