<script lang="ts">
  import { modStore } from "../../lib/stores/modStore.svelte.js";
  import type { SelectorParamValues } from "../../lib/data/selectorDefs.js";
  import { BONUS_TYPE_OPTIONS, emptyParams } from "../../lib/data/selectorDefs.js";
  import { getSelectorIds, type SelectorIdInfo } from "../../lib/utils/tauri.js";
  import {
    buildSectionOptions as buildSectionOptionsBase,
    type ComboboxOption,
  } from "../../lib/utils/comboboxOptions.js";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import SelectorFieldset from "./SelectorFieldset.svelte";

  let {
    selectors = $bindable(),
    warnKeys,
  }: {
    selectors: {
      action: string; fn: string; selectorUuid: string; overwrite: boolean; modGuid: string;
      isReplace: boolean; params: SelectorParamValues;
    }[];
    warnKeys: Set<string>;
  } = $props();

  let openSelectors = $state(true);

  function buildSectionOptions(
    vanillaEntries: import("../../lib/types/index.js").VanillaEntryInfo[],
    sectionName: string,
    opts?: { nodeFilter?: string },
  ): ComboboxOption[] {
    return buildSectionOptionsBase({
      vanillaEntries,
      sectionName,
      nodeFilter: opts?.nodeFilter,
      scanResult: modStore.scanResult,
      additionalModResults: modStore.additionalModResults,
      additionalModPaths: modStore.additionalModPaths,
      lookupFn: (h) => modStore.lookupLocalizedString(h),
    });
  }

  const abilityOptions = $derived(
    (modStore.vanillaValueLists.find(v => v.key === "Ability")?.values ?? [])
      .map(v => ({ value: v, label: v }))
  );

  const actionResourceOptions = $derived(
    buildSectionOptions(modStore.vanilla.ActionResources, "ActionResources")
  );

  let selectorIdValues: SelectorIdInfo[] = $state([]);
  const selectorIdOptions = $derived(
    selectorIdValues.map(info => ({
      value: info.id,
      label: `[${info.source}] ${info.id}`
    }))
  );

  $effect(() => {
    const extraPaths: string[] = [];
    if (modStore.selectedModPath) extraPaths.push(modStore.selectedModPath);
    extraPaths.push(...modStore.additionalModPaths);
    getSelectorIds(extraPaths.length > 0 ? extraPaths : undefined)
      .then(infos => { selectorIdValues = infos; })
      .catch(e => console.warn("Selector ID lookup failed:", e));
  });

  function guidOptionsForFn(fn: string): ComboboxOption[] {
    if (fn === "SelectSpells" || fn === "AddSpells") {
      return buildSectionOptions(modStore.vanilla.Lists, "Lists", { nodeFilter: "SpellList" });
    }
    if (fn === "SelectSkills" || fn === "SelectSkillsExpertise") {
      return (modStore.vanillaValueLists.find(v => v.key === "Skill")?.values ?? [])
        .map(v => ({ value: v, label: v }));
    }
    if (fn === "SelectAbilities" || fn === "SelectAbilityBonus") {
      return abilityOptions;
    }
    if (fn === "SelectEquipment") {
      return modStore.vanillaEquipment.map(v => ({ value: v, label: v }));
    }
    if (fn === "SelectPassives") {
      return buildSectionOptions(modStore.vanilla.Lists, "Lists", { nodeFilter: "PassiveList" });
    }
    return buildSectionOptions(modStore.vanilla.Lists, "Lists");
  }

  function addSelector() {
    selectors = [...(selectors ?? []), { action: "Insert", fn: "SelectSpells", selectorUuid: "", overwrite: false, modGuid: "", isReplace: false, params: emptyParams() }];
    openSelectors = true;
  }
  function removeSelector(i: number) { selectors = (selectors ?? []).filter((_, idx) => idx !== i); }
</script>

<details class="border-t border-zinc-700 pt-2" bind:open={openSelectors}>
  <summary class="layout-subsection-summary text-xs font-semibold text-[var(--th-text-400)] cursor-pointer hover:text-[var(--th-text-200)] select-none mb-2 flex items-center gap-1.5">
    <ChevronRight size={12} class="layout-chevron shrink-0 transition-transform" />
    Selectors ({(selectors ?? []).length}) <span class="text-[10px] text-[var(--th-text-600)] font-normal">(optional)</span>
  </summary>
  <SelectorFieldset
    bind:selectors
    {abilityOptions}
    {actionResourceOptions}
    bonusTypeOptions={BONUS_TYPE_OPTIONS}
    {selectorIdOptions}
    {guidOptionsForFn}
    {warnKeys}
    onaddSelector={addSelector}
    onremoveSelector={removeSelector}
  />
</details>

<style>
  .layout-subsection-summary :global(.layout-chevron) {
    transform: rotate(0deg);
  }
  details[open] > .layout-subsection-summary :global(.layout-chevron) {
    transform: rotate(90deg);
  }
</style>
