<script lang="ts">
  /**
   * Multi-select combobox with dropdown suggestions, checkboxes, and manual text entry.
   * Visually styled as a dropdown with selected value chips.
   */
  import X from "@lucide/svelte/icons/x";
  import Check from "@lucide/svelte/icons/check";
  import Code from "@lucide/svelte/icons/code";
  import { handleComboboxKeydown } from "../lib/utils/comboboxKeyNav.js";
  import { m } from "../paraglide/messages.js";
  let {
    label = "",
    options = [] as { value: string; label: string; color?: string }[],
    selected = [],
    placeholder = "Type to search or add…",
    required = false,
    nonRemovable = [] as string[],
    displayTransform,
    rawTextToggle = false,
    onchange,
  }: {
    label?: string;
    options: { value: string; label: string; color?: string }[];
    selected: string[];
    placeholder?: string;
    required?: boolean;
    nonRemovable?: string[];
    displayTransform?: (value: string) => string;
    rawTextToggle?: boolean;
    onchange: (values: string[]) => void;
  } = $props();

  let rawMode = $state(false);
  let rawText = $state("");

  function enterRawMode(): void {
    rawText = selected.join(";");
    rawMode = true;
  }

  function exitRawMode(): void {
    const parsed = rawText.split(";").map(s => s.trim()).filter(Boolean);
    onchange(parsed);
    rawMode = false;
  }

  let searchText = $state("");
  let isOpen = $state(false);
  let activeIndex = $state(-1);
  let inputEl: HTMLInputElement | undefined = $state(undefined);
  let containerEl: HTMLDivElement | undefined = $state(undefined);

  let filteredOptions = $derived.by(() => {
    const q = searchText.toLowerCase().trim();
    return options
      .filter(o => !q || o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q));
  });

  function toggleOption(value: string): void {
    if (selected.includes(value)) {
      onchange(selected.filter(v => v !== value));
    } else {
      onchange([...selected, value]);
    }
  }

  function addValue(value: string): void {
    if (!value.trim()) return;
    const trimmed = value.trim();
    if (!selected.includes(trimmed)) {
      onchange([...selected, trimmed]);
    }
    searchText = "";
  }

  function removeValue(value: string): void {
    onchange(selected.filter(v => v !== value));
  }

  function handleKeydown(e: KeyboardEvent): void {
    const handled = handleComboboxKeydown(
      e,
      { activeIndex, optionCount: filteredOptions.length, isOpen },
      {
        onOpen(pos) {
          isOpen = true;
          activeIndex = pos === "first" ? 0 : filteredOptions.length - 1;
        },
        onClose() {
          isOpen = false;
          activeIndex = -1;
          inputEl?.blur();
        },
        onSelect(idx) {
          toggleOption(filteredOptions[idx].value);
        },
        onIndexChange(idx) {
          activeIndex = idx;
        },
      },
    );
    if (handled) {
      e.preventDefault();
      // Handle Enter with no active option: add typed value
      if (e.key === "Enter" && activeIndex < 0 && searchText.trim()) {
        const match = options.find(
          o => o.value.toLowerCase() === searchText.trim().toLowerCase() ||
               o.label.toLowerCase() === searchText.trim().toLowerCase()
        );
        addValue(match?.value ?? searchText.trim());
      }
    } else if (e.key === "Backspace" && searchText === "" && selected.length > 0) {
      removeValue(selected[selected.length - 1]);
    }
  }

  function handlePaste(e: ClipboardEvent): void {
    const text = e.clipboardData?.getData("text") ?? "";
    if (text.includes(";")) {
      e.preventDefault();
      const parts = text.split(";").map(s => s.trim()).filter(Boolean);
      const newValues = [...selected];
      for (const p of parts) {
        if (!newValues.includes(p)) newValues.push(p);
      }
      onchange(newValues);
      searchText = "";
    }
  }

  /** Close dropdown when clicking outside */
  function handleDocumentClick(e: MouseEvent): void {
    if (containerEl && !containerEl.contains(e.target as Node)) {
      isOpen = false;
    }
  }

  $effect(() => {
    document.addEventListener("mousedown", handleDocumentClick);
    return () => document.removeEventListener("mousedown", handleDocumentClick);
  });

  /** O(1) lookup map for option metadata — rebuilds when options change */
  let optionMap = $derived(new Map(options.map(o => [o.value, o])));

  const inputId = `mscombo-input-${Math.random().toString(36).slice(2, 8)}`;
  const listboxId = `mscombo-listbox-${Math.random().toString(36).slice(2, 8)}`;
  const optionIdPrefix = `mscombo-opt-${Math.random().toString(36).slice(2, 8)}`;

  // Reset activeIndex when filtered options change
  $effect(() => {
    // Reference filteredOptions.length to subscribe
    if (filteredOptions.length === 0) activeIndex = -1;
    else if (activeIndex >= filteredOptions.length) activeIndex = filteredOptions.length - 1;
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
    // Account for CSS zoom on ancestor containers
    const zoom = getComputedZoom(containerEl);
    return `position: fixed; top: ${rect.bottom / zoom}px; left: ${rect.left / zoom}px; width: ${rect.width / zoom}px;`;
  }

  /** Walk up the DOM to find the effective CSS zoom factor. */
  function getComputedZoom(el: HTMLElement): number {
    let zoom = 1;
    let current: HTMLElement | null = el;
    while (current) {
      const z = parseFloat(getComputedStyle(current).zoom || '1');
      if (z && z !== 1) zoom *= z;
      current = current.parentElement;
    }
    return zoom;
  }
</script>

{#if label || rawTextToggle}
  <div class="flex items-center justify-between">
    {#if label}
      <label for={inputId} class="text-[var(--th-text-500)] text-xs">{label}{#if required}<span class="text-red-400 ml-0.5">*</span>{/if}</label>
    {/if}
    {#if rawTextToggle}
      <button
        type="button"
        class="text-[var(--th-text-500)] hover:text-[var(--th-text-200)] p-0.5 rounded transition-colors"
        title={rawMode ? "Switch to chip view" : "Switch to raw text"}
        aria-label={rawMode ? "Switch to chip view" : "Switch to raw text"}
        onclick={() => { if (rawMode) exitRawMode(); else enterRawMode(); }}
      ><Code size={13} /></button>
    {/if}
  </div>
{/if}
{#if rawMode}
  <textarea
    class="raw-textarea w-full text-xs"
    rows={3}
    bind:value={rawText}
    onblur={exitRawMode}
    placeholder="Value1;Value2;..."
  ></textarea>
{:else}
<div
  bind:this={containerEl}
  class="relative"
  role="combobox"
  aria-expanded={isOpen}
  aria-haspopup="listbox"
  aria-owns={listboxId}
  aria-controls={listboxId}
>
  <!-- Selected chips + input — styled like a dropdown -->
  <div
    class="combobox-trigger flex items-center gap-1 cursor-text pr-6 {isOpen ? 'combobox-trigger-open' : ''}"
    onclick={() => { isOpen = !isOpen; inputEl?.focus(); }}
    role="presentation"
  >
    <div class="flex items-center gap-1 flex-wrap flex-1 min-w-0">
    {#each selected as val}
      {@const opt = optionMap.get(val)}
      {@const baseDisplay = opt?.label ?? val}
      {@const display = displayTransform ? displayTransform(val) : baseDisplay}
      {@const color = opt?.color}
      {@const isFixed = nonRemovable.includes(val)}
      <span class="inline-flex items-center gap-0.5 px-1.5 rounded-full {isFixed ? 'bg-zinc-700/40 text-zinc-300' : 'bg-sky-700/40 text-sky-200'} text-xs max-w-48 truncate shrink-0 leading-[1.375rem]">
        {#if color}
          <span class="shrink-0 w-3 h-3 rounded-sm border border-white/20" style="background-color: {color}"></span>
        {/if}
        <span class="truncate" title={baseDisplay}>{display}</span>
        {#if !isFixed}
          <button
            type="button"
            class="text-sky-300 hover:text-sky-100 p-0.5 leading-none"
            onclick={(e: MouseEvent) => { e.stopPropagation(); removeValue(val); }}
            aria-label={m.multiselect_remove_aria({ display: baseDisplay })}
          ><X size={10} /></button>
        {/if}
      </span>
    {/each}
    <input
      bind:this={inputEl}
      id={inputId}
      type="text"
      class="flex-1 min-w-16 bg-transparent border-none outline-none text-xs text-zinc-100 dark:text-zinc-100 placeholder:text-zinc-500 p-0"
      {placeholder}
      bind:value={searchText}
      onfocus={() => { isOpen = true; activeIndex = -1; }}
      onkeydown={handleKeydown}
      onpaste={handlePaste}
      role="searchbox"
      aria-label={label || "Search values"}
      aria-activedescendant={activeIndex >= 0 ? `${optionIdPrefix}-${activeIndex}` : undefined}
    />
    </div>
    <!-- Clear all button (visible when there are selections) -->
    {#if selected.length > 0}
      <button
        type="button"
        class="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 text-xs px-1"
        onclick={(e: MouseEvent) => { e.stopPropagation(); onchange([]); }}
        aria-label="Clear all selections"
        title={m.multiselect_clear_all()}
      ><X size={12} /></button>
    {/if}
    <!-- Dropdown chevron -->
    <span class="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none text-xs">
      {isOpen ? "▲" : "▼"}
    </span>
  </div>

  <!-- Dropdown with checkboxes (fixed positioning to avoid overflow clipping) -->
  <ul
    id={listboxId}
    class="z-[100] max-h-80 overflow-y-auto
           bg-[var(--th-bg-800)] border border-[var(--th-input-border)] border-t-0 rounded-b shadow-lg scrollbar-thin"
    style="{isOpen ? getDropdownStyle() : 'display: none;'}"
    role="listbox"
  >
    {#if isOpen}
      {#if filteredOptions.length > 0}
        {#each filteredOptions as opt, idx}
          {@const isSelected = selected.includes(opt.value)}
          {@const isActive = idx === activeIndex}
          <li>
            <button
              id="{optionIdPrefix}-{idx}"
              type="button"
              class="w-full text-left px-2 py-1.5 text-xs flex items-center gap-2
                     {isActive ? 'bg-sky-600 text-white' : isSelected ? 'bg-sky-900/30 text-sky-200' : 'text-[var(--th-text-200)] hover:bg-[var(--th-bg-700)]'} truncate"
              onmousedown={(e: MouseEvent) => { e.preventDefault(); toggleOption(opt.value); }}
              onmouseenter={() => { activeIndex = idx; }}
              role="option"
              aria-selected={isSelected}
            >
              <span class="w-3.5 h-3.5 shrink-0 rounded border flex items-center justify-center
                           {isSelected ? 'border-sky-500 bg-sky-600' : 'border-zinc-500'}">
                {#if isSelected}
                  <Check size={11} class="text-white" />
                {/if}
              </span>
              {#if opt.color}
                <span class="shrink-0 w-3 h-3 rounded-sm border border-white/20" style="background-color: {opt.color}"></span>
              {/if}
              <span class="truncate">{opt.label}</span>
            </button>
          </li>
        {/each}
      {:else if searchText.trim()}
        <li class="px-2 py-1.5 text-xs text-[var(--th-text-500)]">
          {m.multiselect_no_matching()}
        </li>
      {:else if options.length === 0}
        <li class="px-2 py-1.5 text-xs text-[var(--th-text-500)] italic">
          {m.multiselect_no_selectable()}
        </li>
      {/if}
    {/if}
  </ul>
</div>
{/if}

<style>
  .raw-textarea {
    box-sizing: border-box;
    min-height: 3rem;
    background-color: var(--th-input-bg);
    border: 1px solid var(--th-input-border);
    border-radius: 0.25rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.8125rem;
    color: var(--th-input-text);
    resize: vertical;
  }
  .raw-textarea:focus {
    outline: none;
    border-color: rgb(14 165 233);
  }
  .combobox-trigger {
    position: relative;
    box-sizing: border-box;
    min-height: 2rem;
    background-color: var(--th-input-bg);
    border: 1px solid var(--th-input-border);
    border-radius: 0.25rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.8125rem;
    color: var(--th-input-text);
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
</style>
