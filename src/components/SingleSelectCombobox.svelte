<script lang="ts">
  /**
   * Single-select combobox with dropdown suggestions and free-text entry.
   * Visually styled like MultiSelectCombobox but allows only one selection.
   */
  import X from "@lucide/svelte/icons/x";
  import Check from "@lucide/svelte/icons/check";
  import { handleComboboxKeydown } from "../lib/utils/comboboxKeyNav.js";
  import { isContentHandle, parseHandleVersion } from "../lib/utils/localizationManager.js";
  import { m } from "../paraglide/messages.js";
  let {
    label = "",
    options = [] as { value: string; label: string }[],
    value = "",
    placeholder = m.singleselect_default_placeholder(),
    required = false,
    maxDisplayed = 0,
    requirePrefix,
    textOnlyPrefixes,
    displayValueOnly = false,
    locaResolver,
    hideLocaPreview = false,
    onchange,
    warnClass = "",
    disabled = false,
  }: {
    label?: string;
    options: { value: string; label: string }[];
    value: string;
    placeholder?: string;
    required?: boolean;
    /** Max results to show in dropdown (0 = unlimited) */
    maxDisplayed?: number;
    /** Only show dropdown when search text starts with one of these prefixes */
    requirePrefix?: string[];
    /** Prefixes that filter only by label (resolved text), not by value (handle/contentuid) */
    textOnlyPrefixes?: string[];
    /** When true, the trigger displays the raw value instead of the resolved label */
    displayValueOnly?: boolean;
    /** Resolve a loca handle to display text; enables built-in preview/error below the combobox */
    locaResolver?: (handle: string | undefined) => string | undefined;
    /** When true, suppresses the built-in loca-preview <details> block (caller renders it). */
    hideLocaPreview?: boolean;
    onchange: (value: string) => void;
    /** Extra CSS class applied to the trigger when a warning state is active */
    warnClass?: string;
    /** When true, the combobox is non-interactive */
    disabled?: boolean;
  } = $props();

  let searchText = $state("");
  let isOpen = $state(false);
  let activeIndex = $state(-1);
  let inputEl: HTMLInputElement | undefined = $state(undefined);
  let containerEl: HTMLDivElement | undefined = $state(undefined);
  /** When true, the input shows the search text; when false it shows the selected label */
  let isSearching = $state(false);

  /** Whether the prefix requirement is met (dropdown should be allowed to open) */
  let prefixMet = $derived.by(() => {
    if (!requirePrefix || requirePrefix.length === 0) return true;
    const q = searchText.toLowerCase();
    return requirePrefix.some(p => q.startsWith(p.toLowerCase()));
  });

  let filteredOptions = $derived.by(() => {
    if (!prefixMet) return [];
    const q = searchText.toLowerCase().trim();
    // Strip the matched prefix from the search query for filtering
    let filterQ = q;
    let isTextOnly = false;
    if (requirePrefix) {
      for (const p of requirePrefix) {
        if (q.startsWith(p.toLowerCase())) {
          filterQ = q.slice(p.length).trim();
          // Check if the matched prefix is a text-only prefix
          if (textOnlyPrefixes?.some(tp => tp.toLowerCase() === p.toLowerCase())) {
            isTextOnly = true;
          }
          break;
        }
      }
    }
    return options
      .filter(o => !filterQ || o.label.toLowerCase().includes(filterQ) || (!isTextOnly && o.value.toLowerCase().includes(filterQ)));
  });

  /** Capped version of filteredOptions for display purposes */
  let displayedOptions = $derived(
    maxDisplayed > 0 ? filteredOptions.slice(0, maxDisplayed) : filteredOptions
  );

  /** O(1) lookup map for option metadata — rebuilds when options change */
  let optionMap = $derived(new Map(options.map(o => [o.value, o])));

  /** Resolve display label for current value */
  let displayLabel = $derived.by(() => {
    if (!value) return "";
    if (displayValueOnly) return value;
    return optionMap.get(value)?.label ?? value;
  });

  /** Loca resolution state — only active when locaResolver is provided */
  let locaResolved = $derived.by(() => {
    if (!locaResolver || !value?.trim()) return undefined;
    return locaResolver(value);
  });
  let locaIsUnresolved = $derived.by(() => {
    if (!locaResolver || !value?.trim()) return false;
    if (locaResolved) return false;
    const raw = value.trim();
    return isContentHandle(raw) || !!parseHandleVersion(raw);
  });

  function selectOption(val: string): void {
    onchange(val);
    searchText = "";
    isSearching = false;
    isOpen = false;
    activeIndex = -1;
    inputEl?.blur();
  }

  function clearValue(): void {
    onchange("");
    searchText = "";
    isSearching = false;
  }

  function handleKeydown(e: KeyboardEvent): void {
    const handled = handleComboboxKeydown(
      e,
      { activeIndex, optionCount: displayedOptions.length, isOpen },
      {
        onOpen(pos) {
          isOpen = true;
          activeIndex = pos === "first" ? 0 : displayedOptions.length - 1;
        },
        onClose() {
          isOpen = false;
          activeIndex = -1;
          isSearching = false;
          searchText = "";
          inputEl?.blur();
        },
        onSelect(idx) {
          selectOption(displayedOptions[idx].value);
        },
        onIndexChange(idx) {
          activeIndex = idx;
        },
      },
    );
    if (handled) {
      e.preventDefault();
      // Handle Enter with no active option: accept typed value
      if (e.key === "Enter" && activeIndex < 0 && searchText.trim()) {
        const match = options.find(
          o => o.value.toLowerCase() === searchText.trim().toLowerCase() ||
               o.label.toLowerCase() === searchText.trim().toLowerCase()
        );
        selectOption(match?.value ?? searchText.trim());
      }
    }
  }

  /** Close dropdown when clicking outside */
  function handleDocumentClick(e: MouseEvent): void {
    if (containerEl && !containerEl.contains(e.target as Node)) {
      isOpen = false;
      isSearching = false;
      searchText = "";
    }
  }

  $effect(() => {
    document.addEventListener("mousedown", handleDocumentClick);
    return () => document.removeEventListener("mousedown", handleDocumentClick);
  });

  const inputId = `sscombo-input-${Math.random().toString(36).slice(2, 8)}`;
  const listboxId = `sscombo-listbox-${Math.random().toString(36).slice(2, 8)}`;
  const optionIdPrefix = `sscombo-opt-${Math.random().toString(36).slice(2, 8)}`;

  // Reset activeIndex when filtered options change
  $effect(() => {
    if (displayedOptions.length === 0) activeIndex = -1;
    else if (activeIndex >= displayedOptions.length) activeIndex = displayedOptions.length - 1;
  });

  // Scroll active option into view on arrow-key navigation
  $effect(() => {
    if (activeIndex >= 0 && isOpen) {
      const el = document.getElementById(`${optionIdPrefix}-${activeIndex}`);
      el?.scrollIntoView({ block: 'nearest' });
    }
  });

  /** Compute fixed-position style for dropdown to avoid clipping by overflow ancestors. */
  function getDropdownStyle(): string {
    if (!containerEl) return '';
    const rect = containerEl.getBoundingClientRect();
    // Detect effective CSS zoom: compare CSS-px size to viewport-px size
    const cssW = containerEl.offsetWidth;
    const zoom = cssW > 0 ? rect.width / cssW : 1;
    return `position: fixed; top: ${rect.bottom / zoom}px; left: ${rect.left / zoom}px; width: ${rect.width / zoom}px;`;
  }
</script>

{#if label}
  <label for={inputId} class="text-zinc-400 text-xs">{label}{#if required}<span class="text-red-400 ml-0.5">*</span>{/if}</label>
{/if}
<div
  bind:this={containerEl}
  class="relative"
  role="combobox"
  aria-expanded={isOpen}
  aria-haspopup="listbox"
  aria-owns={listboxId}
  aria-controls={listboxId}
>
  <!-- Trigger: shows selected value or search input -->
  <div
    class="combobox-trigger flex items-center cursor-text pr-12 {warnClass} {locaIsUnresolved ? 'combobox-loca-error' : ''} {isOpen ? 'combobox-trigger-open' : ''} {disabled ? 'combobox-trigger-disabled' : ''}"
    onclick={disabled ? undefined : () => { searchText = value; isSearching = true; isOpen = requirePrefix ? prefixMet : !isOpen; inputEl?.focus(); }}
    role="presentation"
  >
    {#if isSearching || !value}
      <input
        bind:this={inputEl}
        id={inputId}
        type="text"
        class="flex-1 min-w-16 bg-transparent border-none outline-none text-xs text-zinc-100 dark:text-zinc-100 placeholder:text-zinc-500 p-0"
        {placeholder}
        bind:value={searchText}
        onfocus={() => { if (!isSearching) { searchText = value; } isOpen = prefixMet; isSearching = true; activeIndex = -1; }}
        oninput={() => { isOpen = prefixMet; }}
        onkeydown={handleKeydown}
        role="searchbox"
        aria-label={label || m.singleselect_search_aria()}
        aria-activedescendant={activeIndex >= 0 ? `${optionIdPrefix}-${activeIndex}` : undefined}
      />
    {:else}
      <button
        type="button"
        class="flex-1 text-xs text-zinc-100 truncate text-left bg-transparent border-none outline-none cursor-text p-0"
        title={displayLabel}
        onclick={(e: MouseEvent) => { e.stopPropagation(); searchText = value; isSearching = true; setTimeout(() => inputEl?.focus(), 0); }}
      >{displayLabel}</button>
    {/if}
    <!-- Clear button (visible when there's a value) -->
    {#if value}
      <button
        type="button"
        class="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 text-xs px-1"
        onclick={(e: MouseEvent) => { e.stopPropagation(); clearValue(); }}
        aria-label={m.singleselect_clear_aria()}
        title={m.singleselect_clear_title()}
      ><X size={12} /></button>
    {/if}
    <!-- Dropdown chevron -->
    <span class="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none text-xs">
      {isOpen ? "▲" : "▼"}
    </span>
  </div>

  <!-- Dropdown (fixed positioning to avoid overflow clipping) -->
  <ul
    id={listboxId}
    class="z-[100] max-h-80 overflow-y-auto
           bg-[var(--th-bg-800)] border border-[var(--th-input-border)] border-t-0 rounded-b shadow-lg scrollbar-thin"
    style="{isOpen ? getDropdownStyle() : 'display: none;'}"
    role="listbox"
  >
    {#if isOpen && (displayedOptions.length > 0 || searchText.trim())}
      {#if displayedOptions.length > 0}
        {#each displayedOptions as opt, idx}
          {@const isSelected = opt.value === value}
          {@const isActive = idx === activeIndex}
          <li>
            <button
              id="{optionIdPrefix}-{idx}"
              type="button"
              class="w-full text-left px-2 py-1.5 text-xs flex items-center gap-2
                     {isActive ? 'bg-sky-600 text-white' : isSelected ? 'bg-sky-900/30 text-sky-200' : 'text-[var(--th-text-200)] hover:bg-[var(--th-bg-700)]'} truncate"
              onmousedown={(e: MouseEvent) => { e.preventDefault(); selectOption(opt.value); }}
              onmouseenter={() => { activeIndex = idx; }}
              role="option"
              aria-selected={isSelected}
            >
              {#if isSelected}
                <Check size={12} class="text-sky-400" />
              {/if}
              <span class="truncate">{opt.label}</span>
            </button>
          </li>
        {/each}
        {#if maxDisplayed > 0 && filteredOptions.length > maxDisplayed}
          <li class="px-2 py-1 text-[10px] text-[var(--th-text-500)] text-center border-t border-[var(--th-input-border)]">
            {m.singleselect_showing_results({ maxDisplayed, total: filteredOptions.length })}
          </li>
        {/if}
      {:else if searchText.trim()}
        <li class="px-2 py-1.5 text-xs text-[var(--th-text-500)]">
          {m.singleselect_no_matching({ searchText: searchText.trim() })}
        </li>
      {/if}
    {/if}
  </ul>

  <!-- Loca preview / error (built into the combobox when locaResolver is provided) -->
  {#if locaResolver && value?.trim() && !hideLocaPreview}
    {#if locaResolved}
      <details class="loca-preview">
        <summary class="text-xs text-[var(--th-text-400)] cursor-pointer hover:text-[var(--th-text-200)] px-2 py-1 select-none">
          {m.singleselect_preview_summary()}
        </summary>
        <div class="px-2 pb-1.5 pt-0.5 text-xs text-[var(--th-text-200)] whitespace-pre-wrap break-words">
          {locaResolved}
        </div>
      </details>
    {:else if locaIsUnresolved}
      <div class="loca-error">
        {m.singleselect_not_found()}
      </div>
    {/if}
  {/if}
</div>

<style>
  .combobox-trigger {
    position: relative;
    box-sizing: border-box;
    background-color: var(--th-input-bg);
    border: 1px solid var(--th-input-border);
    border-radius: 0.25rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.8125rem;
    color: var(--th-input-text);
    height: 2.25rem;
    overflow: hidden;
  }
  .combobox-trigger:focus-within {
    border-color: rgb(14 165 233);
    outline: none;
  }
  .combobox-trigger input:focus-visible,
  .combobox-trigger button:focus-visible {
    outline: none;
  }
  .combobox-trigger-open {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }
  .combobox-trigger-disabled {
    cursor: default;
    pointer-events: none;
    opacity: 0.65;
  }
  .combobox-loca-error {
    border-color: var(--th-text-red-400, #f87171);
  }
  .loca-preview {
    background-color: var(--th-bg-800, rgba(39, 39, 42, 0.6));
    border: 1px solid var(--th-input-border, rgba(63, 63, 70, 0.5));
    border-radius: 0.25rem;
    margin-top: 0.125rem;
  }
  .loca-error {
    background-color: var(--th-bg-red-900-50, rgba(127, 29, 29, 0.4));
    border: 1px solid var(--th-border-red-700, rgba(185, 28, 28, 0.6));
    border-radius: 0.25rem;
    margin-top: 0.125rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    color: var(--th-text-red-300, #fca5a5);
  }
</style>
