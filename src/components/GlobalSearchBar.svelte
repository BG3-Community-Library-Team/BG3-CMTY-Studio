<!--
  PF-027: Global Search Bar — Filters entries across all sections.
  Appears above the section accordion when toggled visible (Ctrl+Shift+F).
  Hidden by default unless settingsStore.alwaysShowSearchBar is true.
  Debounced 250ms input, Ctrl+Shift+F to toggle, Escape to clear & hide.
-->
<script lang="ts">
  import { m } from "../paraglide/messages.js";
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import { settingsStore } from "../lib/stores/settingsStore.svelte.js";
  import Search from "@lucide/svelte/icons/search";
  import X from "@lucide/svelte/icons/x";

  let inputEl: HTMLInputElement | undefined = $state(undefined);
  let localValue = $state(modStore.globalFilter);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let manuallyVisible = $state(false);

  let isVisible = $derived(settingsStore.alwaysShowSearchBar || manuallyVisible);

  function handleInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    localValue = value;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      modStore.setGlobalFilter(value);
    }, 250);
  }

  function clear() {
    localValue = "";
    modStore.setGlobalFilter("");
  }

  function hideBar() {
    clear();
    manuallyVisible = false;
  }

  // Keyboard shortcut: Ctrl+Shift+F to toggle visibility
  function handleKeydown(e: KeyboardEvent) {
    if (e.ctrlKey && e.shiftKey && e.key === "F") {
      e.preventDefault();
      if (isVisible && !settingsStore.alwaysShowSearchBar) {
        // Toggle off (unless always-show)
        hideBar();
      } else {
        manuallyVisible = true;
        requestAnimationFrame(() => {
          inputEl?.focus();
          inputEl?.select();
        });
      }
    }
  }

  /** Allow other components (command palette) to show the search bar */
  export function show() {
    manuallyVisible = true;
    requestAnimationFrame(() => {
      inputEl?.focus();
      inputEl?.select();
    });
  }

  // Cleanup debounce timer on unmount
  $effect(() => {
    return () => { if (debounceTimer) clearTimeout(debounceTimer); };
  });
</script>

<svelte:window onkeydown={handleKeydown} />

{#if modStore.scanResult && isVisible}
  <div class="flex items-center gap-2 px-1 mb-2">
    <div class="relative flex-1">
      <input
        bind:this={inputEl}
        type="text"
        placeholder={m.global_search_placeholder()}
        class="w-full bg-[var(--th-bg-800)] border border-[var(--th-border-600)] rounded-md
               px-3 py-1.5 pl-8 text-sm text-[var(--th-text-100)] placeholder-[var(--th-text-500)]
               focus:border-sky-500 transition-colors"
        value={localValue}
        oninput={handleInput}
        onkeydown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            if (!settingsStore.alwaysShowSearchBar) {
              hideBar();
            } else {
              clear();
            }
          }
        }}
        aria-label={m.global_search_aria()}
      />
      <!-- Search icon -->
      <Search
        class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--th-text-500)] pointer-events-none"
        strokeWidth={2.5}
      />

      {#if localValue}
        <button
          class="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--th-text-500)] hover:text-[var(--th-text-200)]
                 text-xs font-bold leading-none p-0.5"
          onclick={clear}
          title={m.global_search_clear_title()}
          aria-label={m.search_clear_aria()}
        ><X size={12} /></button>
      {/if}
    </div>
    {#if !settingsStore.alwaysShowSearchBar}
      <button
        class="text-[var(--th-text-500)] hover:text-[var(--th-text-200)] text-xs p-1"
        onclick={hideBar}
        title={m.global_search_hide_title()}
        aria-label={m.global_search_hide_title()}
      ><X size={12} /></button>
    {/if}
  </div>
{/if}
