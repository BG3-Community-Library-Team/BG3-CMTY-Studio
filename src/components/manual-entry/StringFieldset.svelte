<script lang="ts">
  import type { SectionCapabilities } from "../../lib/data/sectionCaps.js";
  import type { ComboboxOption } from "../../lib/utils/comboboxOptions.js";
  import MultiSelectCombobox from "../MultiSelectCombobox.svelte";
  import X from "@lucide/svelte/icons/x";

  let {
    strings = $bindable(),
    caps,
    availablePassiveNames,
    warnKeys,
    allStringTypesUsed = false,
    hideRemoveButton = false,
    onaddString,
    onremoveString,
    filterKeys,
    adjacentBooleans,
    getBoolValue,
    setBoolValue,
  }: {
    strings: { action: string; type: string; values: string; modGuid: string }[];
    caps: SectionCapabilities;
    availablePassiveNames: ComboboxOption[];
    warnKeys: Set<string>;
    allStringTypesUsed?: boolean;
    hideRemoveButton?: boolean;
    onaddString: () => void;
    onremoveString: (i: number) => void;
    filterKeys?: string[];
    adjacentBooleans?: Record<string, { boolKey: string; label: string }>;
    getBoolValue?: (key: string) => boolean;
    setBoolValue?: (key: string, val: boolean) => void;
  } = $props();

  let filterSet = $derived(filterKeys ? new Set(filterKeys) : null);

  const chipEligibleTypes = new Set(["Passives", "PassivesAdded", "PassivesRemoved", "SkillList"]);

  /** Pairs of [originalIndex, stringEntry] visible in this fieldset, sorted by filterKeys order when present */
  let visibleStrings = $derived(
    strings
      .map((s, i) => [i, s] as const)
      .filter(([, s]) => !filterSet || filterSet.has(s.type))
      .sort(([, a], [, b]) => {
        if (!filterKeys) return 0;
        return filterKeys.indexOf(a.type) - filterKeys.indexOf(b.type);
      })
  );

</script>

<fieldset class="space-y-1">
  {#each visibleStrings as [origIdx, s]}
      <div class="flex items-start gap-2">
        <div class="flex-1 flex flex-col gap-1 min-w-0">

          <!-- Values row -->
          {#if chipEligibleTypes.has(s.type) && availablePassiveNames.length > 0}
            <MultiSelectCombobox
              label={s.type}
              options={availablePassiveNames}
              selected={s.values ? s.values.split(";").map(v => v.trim()).filter(Boolean) : []}
              placeholder="Select or type values…"
              rawTextToggle={true}
              onchange={(vals) => s.values = vals.join(";")}
            />
          {:else}
            <label class="flex flex-col gap-1.5 text-xs">
              <span class="text-[10px] text-[var(--th-text-500)]">{s.type}</span>
              <input type="text" class="form-input w-full" bind:value={s.values}
                placeholder="Value1;Value2;..." />
            </label>
          {/if}
        </div>
        {#if adjacentBooleans?.[s.type] && getBoolValue && setBoolValue}
          {@const adj = adjacentBooleans[s.type]}
          <span class="flex items-center gap-1.5 self-end pb-1.5 shrink-0">
            <button
              type="button"
              class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 {getBoolValue(adj.boolKey) ? 'bg-sky-500' : 'bg-[var(--th-bg-600,#52525b)]'}"
              role="switch"
              aria-checked={getBoolValue(adj.boolKey)}
              aria-label={adj.label}
              onclick={() => setBoolValue(adj.boolKey, !getBoolValue(adj.boolKey))}
            >
              <span class="pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 {getBoolValue(adj.boolKey) ? 'translate-x-4.5' : 'translate-x-0.5'}"></span>
            </button>
            <span class="text-[11px] whitespace-nowrap cursor-pointer select-none transition-colors duration-200 {getBoolValue(adj.boolKey) ? 'text-sky-400' : 'text-[var(--th-text-500)]'}" role="button" tabindex="0" onclick={() => setBoolValue(adj.boolKey, !getBoolValue(adj.boolKey))} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setBoolValue(adj.boolKey, !getBoolValue(adj.boolKey)); } }}>{adj.label}</span>
          </span>
        {/if}
        {#if !hideRemoveButton}
        <button class="text-xs text-red-400 hover:text-red-300 self-center px-1.5 min-w-6 min-h-6 inline-flex items-center justify-center" onclick={() => onremoveString(origIdx)} aria-label="Remove string"><X size={14} /></button>
        {/if}
      </div>
  {/each}
  {#if !allStringTypesUsed}
  <button
    class="text-xs text-sky-400 hover:text-sky-300"
    onclick={onaddString}
  >+ Add string</button>
  {/if}
</fieldset>

<style>
  .form-input {
    box-sizing: border-box;
    height: 2.25rem;
    background-color: var(--th-input-bg);
    border: 1px solid var(--th-input-border);
    border-radius: 0.25rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.8125rem;
    color: var(--th-input-text);
  }
  .form-input:focus {
    outline: none;
    border-color: rgb(14 165 233);
  }
</style>
