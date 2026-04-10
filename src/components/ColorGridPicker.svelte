<script lang="ts">
  import type { ComboboxOption } from "../lib/utils/comboboxOptions.js";
  import { localeCompare } from "../lib/utils/localeSort.js";
  import { tooltip } from "../lib/actions/tooltip.js";
  import {
    gridKeyNav,
    nextVisibleIndex,
    type GridNavResult,
  } from "../lib/utils/colorGridNav.js";
  import { m } from "../paraglide/messages.js";

  let {
    label = "",
    options = [] as ComboboxOption[],
    selected = [] as string[],
    onchange,
  }: {
    label?: string;
    options: ComboboxOption[];
    selected: string[];
    onchange: (values: string[]) => void;
  } = $props();

  /** Options sorted by hex color value for visual coherence */
  let sortedOptions = $derived(
    [...options].sort((a, b) => localeCompare(a.color ?? "", b.color ?? ""))
  );

  let selectedSet = $derived(new Set(selected));

  // --- Keyboard navigation state ---
  let activeIndex = $state(-1);
  let containerEl: HTMLElement | undefined = $state();
  let columnCount = $state(10); // safe default, recalculated on mount
  let swatchEls: HTMLButtonElement[] = $state([]);

  // --- Search filter ---
  let filterText = $state("");
  let filterLower = $derived(filterText.toLowerCase());

  /** Whether a swatch at a given index is visible (passes filter) */
  function isVisible(index: number): boolean {
    if (!filterLower) return true;
    return sortedOptions[index].label.toLowerCase().includes(filterLower);
  }

  function recalcColumns() {
    if (!containerEl) return;
    const style = getComputedStyle(containerEl);
    const colTemplate = style.gridTemplateColumns;
    columnCount = colTemplate.split(/\s+/).length || 1;
  }

  $effect(() => {
    if (!containerEl) return;
    recalcColumns();
    const observer = new ResizeObserver(() => recalcColumns());
    observer.observe(containerEl);
    return () => observer.disconnect();
  });

  // Scroll active swatch into view
  $effect(() => {
    if (activeIndex >= 0 && swatchEls[activeIndex]) {
      swatchEls[activeIndex].scrollIntoView({ block: "nearest" });
      swatchEls[activeIndex].focus();
    }
  });

  function toggle(value: string) {
    if (selectedSet.has(value)) {
      onchange(selected.filter(v => v !== value));
    } else {
      onchange([...selected, value]);
    }
  }

  function handleGridKeydown(e: KeyboardEvent) {
    const result: GridNavResult = gridKeyNav(
      e.key,
      activeIndex,
      sortedOptions.length,
      columnCount,
      filterLower
        ? (i) => sortedOptions[i].label.toLowerCase().includes(filterLower)
        : undefined
    );

    if (result.handled) {
      e.preventDefault();
      if (result.newIndex !== undefined) {
        activeIndex = result.newIndex;
      }
      if (result.toggleSelection && activeIndex >= 0 && activeIndex < sortedOptions.length) {
        toggle(sortedOptions[activeIndex].value);
      }
    }
  }

  function handleGridFocus() {
    if (activeIndex < 0) {
      // Focus first selected item, or first visible item
      const firstSelected = sortedOptions.findIndex(
        (o) => selectedSet.has(o.value) && isVisible(sortedOptions.indexOf(o))
      );
      if (firstSelected >= 0) {
        activeIndex = firstSelected;
      } else {
        activeIndex = nextVisibleIndex(-1, 1, sortedOptions.length, filterLower
          ? (i) => sortedOptions[i].label.toLowerCase().includes(filterLower)
          : undefined);
      }
    }
  }

  function selectAll() {
    onchange(sortedOptions.map(o => o.value));
  }

  function clearAll() {
    onchange([]);
  }
</script>

<div class="color-grid-header">
  {#if label}
    <span class="text-[10px] text-[var(--th-text-500)] block mb-1">{label} ({selected.length})</span>
  {/if}
</div>

<div class="color-grid-toolbar">
  {#if sortedOptions.length > 30}
    <input
      type="text"
      class="color-grid-filter"
      bind:value={filterText}
      aria-label={m.color_grid_filter_aria({ label })}
      placeholder={m.color_grid_filter_placeholder()}
      onkeydown={(e) => { if (e.key === "Escape") filterText = ""; }}
    />
  {/if}
  <div class="color-grid-controls">
    <button
      type="button"
      class="color-grid-action"
      aria-label={m.color_grid_select_all_aria({ label })}
      onclick={selectAll}
    >{m.color_grid_select_all()}</button>
    <button
      type="button"
      class="color-grid-action"
      aria-label={m.color_grid_clear_all_aria({ label })}
      onclick={clearAll}
    >{m.color_grid_clear()}</button>
  </div>
</div>

<div
  bind:this={containerEl}
  class="color-grid"
  role="grid"
  aria-label={label}
  aria-multiselectable="true"
  tabindex="0"
  onkeydown={handleGridKeydown}
  onfocusin={handleGridFocus}
>
  <div role="row" class="color-grid-row">
    {#each sortedOptions as opt, i (opt.value)}
      {@const isSelected = selectedSet.has(opt.value)}
      {@const hidden = filterLower && !opt.label.toLowerCase().includes(filterLower)}
      {@const colIndex = (i % columnCount) + 1}
      {@const rowIndex = Math.floor(i / columnCount) + 1}
      <div role="gridcell" aria-colindex={colIndex} aria-rowindex={rowIndex} style:display={hidden ? "none" : ""}>
        <button
          bind:this={swatchEls[i]}
          type="button"
          class="color-swatch"
          class:selected={isSelected}
          style="background-color: {opt.color ?? '#333'}"
          role="option"
          aria-selected={isSelected}
          aria-label={opt.label}
          tabindex={i === activeIndex ? 0 : -1}
          use:tooltip={opt.label}
          onclick={() => { activeIndex = i; toggle(opt.value); }}
        ></button>
      </div>
    {/each}
  </div>
</div>

<style>
  .color-grid-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 2px;
  }
  .color-grid-toolbar {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin-bottom: 4px;
  }
  .color-grid-controls {
    display: flex;
    gap: 0.25rem;
    flex-shrink: 0;
  }
  .color-grid-action {
    font-size: 10px;
    color: var(--th-text-400);
    background: var(--th-bg-700, rgba(255,255,255,0.06));
    border: 1px solid var(--th-border-700, #3f3f46);
    cursor: pointer;
    padding: 2px 8px;
    border-radius: 4px;
    line-height: 1.4;
  }
  .color-grid-action:hover {
    color: var(--th-text-200);
    background: var(--th-bg-600, rgba(255,255,255,0.1));
    border-color: var(--th-border-600, #52525b);
  }
  .color-grid-filter {
    flex: 1;
    min-width: 80px;
    font-size: 11px;
    padding: 3px 6px;
    border: 1px solid var(--th-border-700, #3f3f46);
    border-radius: 4px;
    background: var(--th-bg-800, #18181b);
    color: var(--th-text-200, #e4e4e7);
    outline: none;
  }
  .color-grid-filter:focus {
    border-color: var(--th-accent, #38bdf8);
  }
  .color-grid {
    display: grid;
    grid-template-columns: 1fr;
    max-height: 200px;
    overflow-y: auto;
    padding: 2px;
  }
  .color-grid-row {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(18px, 1fr));
    gap: 2px;
  }
  .color-swatch {
    width: 18px;
    height: 18px;
    border-radius: 3px;
    border: 1.5px solid transparent;
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
  }
  .color-swatch:focus-visible {
    outline: 2px solid var(--th-accent, #38bdf8);
    outline-offset: 1px;
    z-index: 1;
  }
  .color-swatch:hover {
    border-color: rgba(255, 255, 255, 0.6);
    box-shadow: 0 0 4px rgba(255, 255, 255, 0.3);
  }
  .color-swatch.selected {
    border-color: rgb(56 189 248);
    box-shadow: 0 0 0 1.5px rgb(56 189 248), inset 0 0 0 1px rgba(255, 255, 255, 0.2);
  }
</style>
