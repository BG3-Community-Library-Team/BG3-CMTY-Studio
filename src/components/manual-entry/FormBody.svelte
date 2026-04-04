<script lang="ts">
  import type { FormLayout } from "../../lib/data/formLayouts.js";
  import type { SectionCapabilities } from "../../lib/data/sectionCaps.js";
  import type { ComboboxOption } from "../../lib/utils/comboboxOptions.js";
  import type { StringItem, ChildItem } from "../../lib/utils/fieldCodec.js";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import X from "@lucide/svelte/icons/x";
  import LayoutCell from "./LayoutCell.svelte";
  import StringFieldset from "./StringFieldset.svelte";
  import MultiSelectCombobox from "../MultiSelectCombobox.svelte";

  let {
    layout,
    caps,
    strings = $bindable(),
    children: childItems = $bindable(),
    getFieldValue,
    setFieldValue,
    getBoolValue,
    setBoolValue,
    fieldComboboxOptions,
    resolveLocaText,
    generateUuid,
    availablePassiveNames,
    warnKeys,
    getChildValueOptions,
  }: {
    layout: FormLayout;
    caps: SectionCapabilities;
    strings: StringItem[];
    children: ChildItem[];
    getFieldValue: (key: string) => string;
    setFieldValue: (key: string, val: string) => void;
    getBoolValue: (key: string) => boolean;
    setBoolValue: (key: string, val: boolean) => void;
    fieldComboboxOptions: (key: string) => ComboboxOption[];
    resolveLocaText: (handle: string | undefined) => string | undefined;
    generateUuid: () => string;
    availablePassiveNames: ComboboxOption[];
    warnKeys: Set<string>;
    getChildValueOptions: (type: string) => ComboboxOption[];
  } = $props();

  function removeChild(i: number) { childItems = childItems.filter((_, idx) => idx !== i); }

  let childIndexMap = $derived(new Map(childItems.map((c, i) => [c, i])));
</script>

{#if !layout.noDefaultHr && layout.identityExtras}
  <div class="border-t border-zinc-700"></div>
{/if}

<!-- Ungrouped rows -->
{#if layout.rows}
  {#if layout.sideColumnBooleans?.length}
    <!-- Side-column layout: rows on left, stacked booleans on right -->
    <div class="flex gap-4 items-start">
      <div class="flex-1 space-y-2 min-w-0">
        {#each layout.rows as row}
          {@const colCount = layout.maxFieldColumns ? Math.max(Math.min(row.items.length, layout.maxFieldColumns), layout.maxFieldColumns) : row.items.length}
          <div class="grid gap-2" style="grid-template-columns: repeat({colCount}, minmax(0, 1fr));">
            {#each row.items as item}
              <LayoutCell {item} {caps} {getFieldValue} {setFieldValue} {getBoolValue} {setBoolValue} {fieldComboboxOptions} {resolveLocaText} {generateUuid} reversed />
            {/each}
          </div>
        {/each}
      </div>
      <!-- Side column: stacked booleans (right-aligned) -->
      <div class="flex flex-col gap-3 pt-4 shrink-0 items-end">
        {#each layout.sideColumnBooleans as boolKey}
          <div class="flex items-center gap-2 text-xs whitespace-nowrap">
            <span class="text-[11px] cursor-pointer select-none {getBoolValue(boolKey) ? 'text-sky-400' : 'text-[var(--th-text-500)]'}" role="button" tabindex="0" onclick={() => setBoolValue(boolKey, !getBoolValue(boolKey))} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setBoolValue(boolKey, !getBoolValue(boolKey)); } }}>{boolKey}</span>
            <button type="button" class="relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 {getBoolValue(boolKey) ? 'bg-sky-500' : 'bg-[var(--th-bg-600,#52525b)]'}" role="switch" aria-checked={getBoolValue(boolKey)} aria-label={boolKey} onclick={() => setBoolValue(boolKey, !getBoolValue(boolKey))}>
              <span class="pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 {getBoolValue(boolKey) ? 'translate-x-3.5' : 'translate-x-0.5'}"></span>
            </button>
          </div>
        {/each}
      </div>
    </div>
  {:else}
  {#each layout.rows as row}
    {#if row.wrap}
    <div class="flex flex-wrap gap-2">
      {#each row.items as item}
        <div class="flex-1 min-w-[180px]" style={row.maxItemWidth ? `max-width: ${row.maxItemWidth}` : ''}>
          <LayoutCell {item} {caps} {getFieldValue} {setFieldValue} {getBoolValue} {setBoolValue} {fieldComboboxOptions} {resolveLocaText} {generateUuid} reversed />
        </div>
      {/each}
    </div>
    {:else}
    {@const colCount = layout.maxFieldColumns ? Math.max(row.items.length, layout.maxFieldColumns) : row.items.length}
    <div class="grid gap-2" style="grid-template-columns: repeat({colCount}, minmax(0, 1fr));">
      {#each row.items as item}
        <LayoutCell {item} {caps} {getFieldValue} {setFieldValue} {getBoolValue} {setBoolValue} {fieldComboboxOptions} {resolveLocaText} {generateUuid} reversed />
      {/each}
    </div>
    {/if}
  {/each}
  {/if}
{/if}

<!-- Named subsections -->
{#if layout.subsections}
  {#each layout.subsections as sub}
    {#if !sub.component}
    <details class="form-subsection" open>
      <summary class="layout-subsection-summary text-xs font-semibold text-[var(--th-text-400)] cursor-pointer hover:text-[var(--th-text-200)] select-none mb-2 flex items-center gap-1.5">
        <ChevronRight size={12} class="layout-chevron shrink-0 transition-transform" />
        {sub.title}
        {#if sub.headerBooleans}
          {#each sub.headerBooleans as bKey}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <span class="ml-auto flex items-center gap-1.5" onclick={(e) => e.stopPropagation()}>
              <button
                type="button"
                class="relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 {getBoolValue(bKey) ? 'bg-sky-500' : 'bg-[var(--th-bg-600,#52525b)]'}"
                role="switch"
                aria-checked={getBoolValue(bKey)}
                aria-label={bKey}
                onclick={() => setBoolValue(bKey, !getBoolValue(bKey))}
              >
                <span class="pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 {getBoolValue(bKey) ? 'translate-x-3.5' : 'translate-x-0.5'}"></span>
              </button>
              <span class="text-[11px] cursor-pointer select-none {getBoolValue(bKey) ? 'text-sky-400' : 'text-[var(--th-text-500)]'} font-normal" role="button" tabindex="0" onclick={() => setBoolValue(bKey, !getBoolValue(bKey))} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setBoolValue(bKey, !getBoolValue(bKey)); } }}>{sub.headerBooleanLabels?.[bKey] ?? bKey}</span>
            </span>
          {/each}
        {/if}
      </summary>
      <div class="space-y-2">
        {#each sub.rows as row}
          {#if row.wrap}
          <div class="flex flex-wrap gap-2">
            {#each row.items as item}
              <div class="flex-1 min-w-[180px]" style={row.maxItemWidth ? `max-width: ${row.maxItemWidth}` : ''}>
                <LayoutCell {item} {caps} {getFieldValue} {setFieldValue} {getBoolValue} {setBoolValue} {fieldComboboxOptions} {resolveLocaText} {generateUuid} reversed />
              </div>
            {/each}
          </div>
          {:else}
          {@const subColCount = sub.maxFieldColumns ? Math.max(row.items.length, sub.maxFieldColumns) : row.items.length}
          <div class="grid gap-2" style="grid-template-columns: repeat({subColCount}, minmax(0, 1fr));">
            {#each row.items as item}
              <LayoutCell {item} {caps} {getFieldValue} {setFieldValue} {getBoolValue} {setBoolValue} {fieldComboboxOptions} {resolveLocaText} {generateUuid} reversed />
            {/each}
          </div>
          {/if}
        {/each}
      </div>
      {#if sub.stringKeys}
        {@const subStrings = strings.filter(s => sub.stringKeys!.includes(s.type))}
        {@const subStringTypesUsed = new Set(subStrings.map(s => s.type))}
        {@const allSubStringTypesUsed = sub.stringKeys!.every(k => subStringTypesUsed.has(k))}
        <div class="mt-2">
          <StringFieldset
            bind:strings
            {caps}
            {availablePassiveNames}
            {warnKeys}
            allStringTypesUsed={allSubStringTypesUsed}
            hideRemoveButton={layout.noRemoveButtons ?? false}
            onaddString={() => {
              const first = sub.stringKeys!.find(k => !subStringTypesUsed.has(k)) ?? sub.stringKeys![0];
              strings = [...strings, { action: "Insert", type: first, values: "", modGuid: "" }];
            }}
            onremoveString={(i) => { strings = strings.filter((_, idx) => idx !== i); }}
            filterKeys={sub.stringKeys}
            adjacentBooleans={sub.stringAdjacentBooleans}
            {getBoolValue}
            {setBoolValue}
          />
        </div>
      {/if}
      {#if sub.inlineChildGroups}
        {#each sub.inlineChildGroups as group}
          {@const groupChildren = childItems.filter(c => group.types.includes(c.type))}
          {@const groupUsed = new Set(groupChildren.map(c => c.type))}
          {@const groupAvailable = group.types.filter(t => !groupUsed.has(t))}
          <div class="mt-2">
            <fieldset class="space-y-1">
              {#if groupChildren.length === 0}
                {#if groupAvailable.length > 0}
                  <button class="text-xs text-sky-400 hover:text-sky-300" onclick={() => { childItems = [...childItems, { type: groupAvailable[0], values: [], action: "Insert", modGuid: "" }]; }}>+ Add {group.title.toLowerCase()}</button>
                {/if}
              {:else}
                <div class={group.columns ? 'grid gap-2' : 'space-y-1'} style={group.columns ? `grid-template-columns: repeat(${group.columns}, minmax(0, 1fr))` : ''}>
                {#each groupChildren as c}
                  {@const absIdx = childIndexMap.get(c) ?? 0}
                  <div class="flex gap-1 items-start">
                    <div class="flex-1 flex flex-col gap-1 min-w-0">
                      <MultiSelectCombobox
                        label={c.type}
                        options={getChildValueOptions(c.type)}
                        selected={c.values}
                        placeholder="Search or paste UUID(s)…"
                        onchange={(vals) => c.values = vals}
                      />
                    </div>
                    {#if !layout.noRemoveButtons}
                    <button class="text-xs text-red-400 hover:text-red-300 self-center px-1.5 min-w-6 min-h-6 inline-flex items-center justify-center" onclick={() => removeChild(absIdx)} aria-label="Remove child"><X size={14} /></button>
                    {/if}
                  </div>
                {/each}
                </div>
                {#if groupAvailable.length > 0}
                  <button class="text-xs text-sky-400 hover:text-sky-300" onclick={() => { childItems = [...childItems, { type: groupAvailable[0], values: [], action: "Insert", modGuid: "" }]; }}>+ Add {group.types[groupAvailable.length > 1 ? 0 : groupAvailable.length - 1]?.toLowerCase() ?? 'entry'}</button>
                {/if}
              {/if}
            </fieldset>
          </div>
        {/each}
      {/if}
    </details>
    {/if}
  {/each}
{/if}

<style>
  .form-subsection {
    padding: 0.5rem 0.625rem 0.625rem;
    border: 1px solid var(--th-border-700, #3f3f46);
    border-radius: 0.375rem;
    margin-top: 0.25rem;
  }
</style>
