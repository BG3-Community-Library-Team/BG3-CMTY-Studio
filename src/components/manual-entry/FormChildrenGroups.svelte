<script lang="ts">
  import type { FormLayout } from "../../lib/data/formLayouts.js";
  import type { SectionCapabilities } from "../../lib/data/sectionCaps.js";
  import type { ComboboxOption } from "../../lib/utils/comboboxOptions.js";
  import type { ChildItem } from "../../lib/utils/fieldCodec.js";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import X from "@lucide/svelte/icons/x";
  import MultiSelectCombobox from "../MultiSelectCombobox.svelte";
  import ColorGridPicker from "../ColorGridPicker.svelte";
  import ChildrenFieldset from "./ChildrenFieldset.svelte";

  let {
    layout = undefined,
    caps,
    children: childItems = $bindable(),
    section,
    entryFilter = undefined,
    rawAttributes = null,
    getChildValueOptions,
    warnKeys,
  }: {
    layout?: FormLayout;
    caps: SectionCapabilities;
    children: ChildItem[];
    section: string;
    entryFilter?: { field: string; value: string };
    rawAttributes?: Record<string, string> | null;
    getChildValueOptions: (type: string) => ComboboxOption[];
    warnKeys: Set<string>;
  } = $props();

  let openChildren = $state(false);

  /** Track which color panels are currently open (max 2) */
  let openColorPanels: string[] = $state([]);
  let detailsRefs: Record<string, HTMLDetailsElement> = {};

  function handleColorToggle(typeName: string, open: boolean) {
    if (open) {
      openColorPanels = [...openColorPanels, typeName];
      if (openColorPanels.length > 2) {
        const toClose = openColorPanels[0];
        openColorPanels = openColorPanels.slice(1);
        const el = detailsRefs[toClose];
        if (el) {
          el.removeAttribute("open");
          // Manual cleanup in case toggle event doesn't fire
          openColorPanels = openColorPanels.filter(t => t !== toClose);
        }
      }
    } else {
      openColorPanels = openColorPanels.filter(t => t !== typeName);
    }
  }

  let allChildTypesUsed = $derived(
    (caps.childTypes ?? []).length > 0 && childItems.length >= (caps.childTypes ?? []).length
  );

  let childIndexMap = $derived(new Map(childItems.map((c, i) => [c, i])));

  function addChild() {
    const usedTypes = new Set(childItems.map(c => c.type));
    const firstAvailable = (caps.childTypes ?? []).find(t => !usedTypes.has(t)) ?? caps.childTypes?.[0] ?? "EyeColors";
    childItems = [...childItems, { type: firstAvailable, values: [], action: "Insert", modGuid: "" }];
    openChildren = true;
  }

  function removeChild(i: number) { childItems = childItems.filter((_, idx) => idx !== i); }
</script>

{#if layout?.childGroups && caps.hasChildren}
  {#each layout.childGroups as group}
    {#if !(group.types.includes('Subclasses') && ((entryFilter?.field === 'ProgressionType' && entryFilter.value !== '0') || (rawAttributes?.ProgressionType && rawAttributes.ProgressionType !== '0')))}
    {@const groupChildren = childItems.filter(c => group.types.includes(c.type))}
    {@const groupUsed = new Set(groupChildren.map(c => c.type))}
    {@const groupAvailable = group.types.filter(t => !groupUsed.has(t))}
    {#if group.inline}
      <!-- Inline child group — no collapsible header -->
      <div class="{group.noBorder ? '' : 'border-t border-zinc-700'} pt-2">
        <fieldset class="space-y-1">
          {#if groupChildren.length === 0}
            {#if groupAvailable.length > 0}
              <button class="text-xs text-sky-400 hover:text-sky-300" onclick={() => { childItems = [...childItems, { type: groupAvailable[0], values: [], action: "Insert", modGuid: "" }]; }}>+ Add {group.title.toLowerCase()}</button>
            {/if}
          {:else}
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
                {#if !layout?.noRemoveButtons}
                <button class="text-xs text-red-400 hover:text-red-300 self-center px-1.5 min-w-6 min-h-6 inline-flex items-center justify-center" onclick={() => removeChild(absIdx)} aria-label="Remove child"><X size={14} /></button>
                {/if}
              </div>
            {/each}
          {/if}
        </fieldset>
      </div>
    {:else}
      <!-- Collapsible child group -->
      <details class="border-t border-zinc-700 pt-2" open>
        <summary class="layout-subsection-summary text-xs font-semibold text-[var(--th-text-400)] cursor-pointer hover:text-[var(--th-text-200)] select-none mb-2 flex items-center gap-1.5">
          <ChevronRight size={12} class="layout-chevron shrink-0 transition-transform" />
          {group.title} ({groupChildren.length})
        </summary>
        {#if group.colorGrid}
          <div class="color-groups-container">
            {#each group.types as colorType}
              {@const opts = getChildValueOptions(colorType)}
              {@const existing = groupChildren.find(c => c.type === colorType)}
              {@const selectedVals = existing?.values ?? []}
              {#if opts.length > 0}
                <details
                  class="color-type-details"
                  bind:this={detailsRefs[colorType]}
                  ontoggle={(e: Event) => handleColorToggle(colorType, (e.currentTarget as HTMLDetailsElement).open)}
                >
                  <summary class="text-[10px] text-[var(--th-text-500)] cursor-pointer hover:text-[var(--th-text-300)] select-none flex items-center gap-1 py-0.5">
                    <ChevronRight size={10} class="layout-chevron shrink-0 transition-transform" />
                    {colorType} ({selectedVals.length})
                  </summary>
                  {#if openColorPanels.includes(colorType)}
                    <div class="pt-1">
                      <ColorGridPicker
                        options={opts}
                        selected={selectedVals}
                        onchange={(vals) => {
                          if (vals.length === 0 && existing) {
                            childItems = childItems.filter(c => c !== existing);
                          } else if (existing) {
                            existing.values = vals;
                          } else {
                            childItems = [...childItems, { type: colorType, values: vals, action: "Insert", modGuid: "" }];
                          }
                        }}
                      />
                    </div>
                  {/if}
                </details>
              {/if}
            {/each}
          </div>
        {:else}
        <fieldset class="space-y-1">
          {#if groupChildren.length === 0}
            <div class="flex flex-col items-center justify-center py-4 border border-dashed border-[var(--th-border-700)] rounded">
              <p class="text-xs text-[var(--th-text-500)] mb-2">No {group.title.toLowerCase()} added</p>
              {#if groupAvailable.length > 0}
                <button class="text-xs text-sky-400 hover:text-sky-300" onclick={() => { childItems = [...childItems, { type: groupAvailable[0], values: [], action: "Insert", modGuid: "" }]; }}>+ Add {group.title.toLowerCase()}</button>
              {/if}
            </div>
          {:else}
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
                {#if !layout?.noRemoveButtons}
                <button class="text-xs text-red-400 hover:text-red-300 self-center px-1.5 min-w-6 min-h-6 inline-flex items-center justify-center" onclick={() => removeChild(absIdx)} aria-label="Remove child"><X size={14} /></button>
                {/if}
              </div>
            {/each}
            {#if groupAvailable.length > 0}
              <button class="text-xs text-sky-400 hover:text-sky-300" onclick={() => { childItems = [...childItems, { type: groupAvailable[0], values: [], action: "Insert", modGuid: "" }]; }}>+ Add {group.title.toLowerCase()}</button>
            {/if}
          {/if}
        </fieldset>
        {/if}
      </details>
    {/if}
    {/if}
  {/each}
{:else if caps.hasChildren}
  <details class="border-t border-zinc-700 pt-2" bind:open={openChildren}>
    <summary class="layout-subsection-summary text-xs font-semibold text-[var(--th-text-400)] cursor-pointer hover:text-[var(--th-text-200)] select-none mb-2 flex items-center gap-1.5">
      <ChevronRight size={12} class="layout-chevron shrink-0 transition-transform" />
      {section === "Gods" ? "Tags" : "Children"} ({childItems.length}) <span class="text-[10px] text-[var(--th-text-600)] font-normal">(optional)</span>
    </summary>
    <ChildrenFieldset
      bind:children={childItems}
      {caps}
      {getChildValueOptions}
      {warnKeys}
      {allChildTypesUsed}
      onaddChild={addChild}
      onremoveChild={removeChild}
    />
  </details>
{/if}

<style>
  .color-groups-container {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }
  .color-type-details > summary > :global(.layout-chevron) {
    transition: transform 0.15s ease;
  }
  .color-type-details[open] > summary > :global(.layout-chevron) {
    transform: rotate(90deg);
  }
</style>
