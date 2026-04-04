<script lang="ts">
  import { untrack } from "svelte";
  import { m } from "../paraglide/messages.js";
  import { configStore } from "../lib/stores/configStore.svelte.js";
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import { snapshot } from "../lib/utils/formSnapshot.js";
  import { toastStore } from "../lib/stores/toastStore.svelte.js";
  import type { VanillaEntryInfo } from "../lib/types/index.js";
  import { parseRawSelectors } from "../lib/utils/selectorParser.js";
  import { getListItems, type ListItemsInfo } from "../lib/utils/tauri.js";
  import { SECTION_CAPS, type SectionCapabilities } from "../lib/data/sectionCaps.js";
  import { FORM_LAYOUTS, type FormLayout } from "../lib/data/formLayouts.js";
  import { isLazyCategory, loadCategory } from "../lib/services/scanService.js";
  import type { VanillaCategory } from "../lib/data/vanillaRegistry.js";

  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import {
    buildSectionOptions as buildSectionOptionsBase,
    getFieldComboboxOptions as _getFieldComboboxOptions,
    type ComboboxOption, type FieldComboboxContext,
  } from "../lib/utils/comboboxOptions.js";
  import BooleanFieldset from "./manual-entry/BooleanFieldset.svelte";
  import FieldsFieldset from "./manual-entry/FieldsFieldset.svelte";
  import FormSelectors from "./manual-entry/FormSelectors.svelte";
  import StringFieldset from "./manual-entry/StringFieldset.svelte";
  import TagFieldset from "./manual-entry/TagFieldset.svelte";
  import SubclassFieldset from "./manual-entry/SubclassFieldset.svelte";
  import SpellFieldset from "./manual-entry/SpellFieldset.svelte";
  import FormHeader from "./manual-entry/FormHeader.svelte";
  import FormFooter from "./manual-entry/FormFooter.svelte";
  import FormIdentity from "./manual-entry/FormIdentity.svelte";
  import FormBody from "./manual-entry/FormBody.svelte";
  import FormChildrenGroups from "./manual-entry/FormChildrenGroups.svelte";
  import RaceProgressionPanel from "./manual-entry/RaceProgressionPanel.svelte";
  import RaceTagPanel from "./manual-entry/RaceTagPanel.svelte";
  import RacePresetPanel from "./manual-entry/RacePresetPanel.svelte";
  import { buildFormState, encodeFormState } from "../lib/utils/formInit.js";
  import { parseHandleVersion, isContentHandle, resolveLoca } from "../lib/utils/localizationManager.js";
  import {
    computeSpellIdOptions, computeSpellFieldKeys, combinedSpellIdOptions as computeCombinedSpellIdOptions,
    getListItemsPlaceholder, getListItemsLabel, computeListItemsOptions,
    computeChildValueOptions, computeTagValueOptions, computeReallyTagValueOptions,
    computeValidationErrors,
  } from "../lib/utils/formOptions.js";

  let {
    section,
    onclose,
    onsave = null,
    prefill = null,
    editIndex = -1,
    rawAttributes = null,
    rawChildren = null,
    autoEntryId = null,
    editComment = "",
    entryFilter = undefined,
    sourceFile = undefined,
  }: {
    section: string;
    onclose: () => void;
    onsave?: ((result: Record<string, string>) => void) | null;
    prefill?: Record<string, string> | null;
    editIndex?: number;
    rawAttributes?: Record<string, string> | null;
    rawChildren?: Record<string, string[]> | null;
    autoEntryId?: string | null;
    editComment?: string;
    entryFilter?: { field: string; value: string };
    sourceFile?: string;
  } = $props();

  // ---- Core identity fields ----

  /** Generate a random v4 UUID. */
  function generateUuid(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 0x0f);
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // Decoders/encoders + color helpers imported from fieldCodec.ts (AIP-06/07)
  const _init = untrack(() => buildFormState({
    prefill: snapshot(prefill),
    section,
    rawAttributes,
    entryFilter,
    editComment,
    vanillaLists: modStore.vanilla.Lists,
    scanSections: modStore.scanResult?.sections,
    editIndex,
    autoEntryId,
    generateUuid,
  }));

  // Auto-populate selectors from raw LSX Selectors attribute
  const _rawAttrs = untrack(() => snapshot(rawAttributes));
  if (_rawAttrs?.Selectors) {
    const hasUnparsed = _init.selectors.some(s => s.fn.includes("("));
    if (hasUnparsed || _init.selectors.length === 0) {
      const parsed = parseRawSelectors(_rawAttrs.Selectors);
      if (parsed.length > 0) {
        _init.selectors = parsed.map(sel => ({
          action: "Insert",
          fn: sel.fn,
          selectorUuid: "",
          overwrite: false,
          modGuid: "",
          isReplace: sel.isReplace,
          params: sel.params,
        }));
      }
    }
  }

  // Progressive disclosure state for remaining collapsible sections
  let openSubclasses = $state(true);
  let openSpellFields = $state(true);

  // Race panel refs (for syncing on save)
  let raceProgressionPanel: RaceProgressionPanel | undefined = $state(undefined);
  let raceTagPanel: RaceTagPanel | undefined = $state(undefined);

  // Lazy-load Tier D vanilla data when form opens for a lazy category
  $effect(() => {
    const sec = section as VanillaCategory;
    if (isLazyCategory(sec)) {
      loadCategory(sec);
    }
  });

  let uuids: string[] = $state(_init.uuids);
  let displayName = $state(_init.displayName);
  let booleans: { key: string; value: boolean }[] = $state(_init.booleans);
  let fields: { key: string; value: string }[] = $state(_init.fields);

  // When node type changes, ensure all required fields/booleans for the new type exist
  $effect(() => {
    if (!selectedNodeType || !baseCaps.nodeTypeCaps) return;
    const override = baseCaps.nodeTypeCaps[selectedNodeType];
    if (!override) return;
    // Merge base + override field/boolean keys
    const allFieldKeys = [...new Set([...(baseCaps.fieldKeys ?? []), ...(override.fieldKeys ?? [])])];
    const allBoolKeys = [...new Set([...(baseCaps.booleanKeys ?? []), ...(override.booleanKeys ?? [])])];
    const existingFields = new Set(fields.map(f => f.key));
    for (const key of allFieldKeys) {
      if (!existingFields.has(key)) fields = [...fields, { key, value: "" }];
    }
    const existingBools = new Set(booleans.map(b => b.key));
    for (const key of allBoolKeys) {
      if (!existingBools.has(key)) booleans = [...booleans, { key, value: false }];
    }
  });

  let selectors = $state(_init.selectors);
  let strings: { action: string; type: string; values: string; modGuid: string }[] = $state(_init.strings);
  let children: { type: string; values: string[]; action: string; modGuid: string }[] = $state(_init.children);
  let entryComment = $state(_init.comment);
  let tags: { uuids: string[]; action: string; type: string; modGuid: string }[] = $state(_init.tags);
  let subclasses: { uuid: string; action: string; modGuid: string }[] = $state(_init.subclasses);
  // ---- List-specific fields ----
  let listAction = $state(_init.listAction);
  let listType = $state(_init.listType);
  let listItems = $state(_init.listItems);
  let listInheritList: string[] = $state(_init.listInheritList);
  let listExcludeList: string[] = $state(_init.listExcludeList);

  let prevListType = $state(_init.listType);
  $effect(() => {
    if (listType !== prevListType) {
      listItems = "";
      prevListType = listType;
    }
  });
  // ---- Spells-specific ----
  let spellAction = $state(_init.spellAction);
  let spellFields: { key: string; value: string }[] = $state(_init.spellFields);

  let argDefinitionsList: string[] = $state(_init.argDefinitionsList);
  let argAction = $state(_init.argAction);
  let blacklist = $state(_init.blacklist);
  let modGuid = $state(_init.modGuid);
  // ---- List item lookup cache ----
  let listItemsCache: Map<string, ListItemsInfo> = $state(new Map());

  /** Look up list items from mod scan results for UUIDs not found in vanilla. */
  function lookupModListItems(uuids: string[]): ListItemsInfo[] {
    const LIST_ITEM_KEYS = ["Spells", "Passives", "Skills", "Abilities", "Equipment"];
    const results: ListItemsInfo[] = [];
    const sources = [modStore.scanResult, ...modStore.additionalModResults];
    for (const uuid of uuids) {
      let found = false;
      for (const src of sources) {
        if (!src) continue;
        const listSection = src.sections.find(s => s.section === "Lists");
        if (!listSection) continue;
        const entry = listSection.entries.find(e => e.uuid === uuid);
        if (!entry) continue;
        const attrs = entry.raw_attributes;
        let items: string[] = [];
        let itemKey = "";
        for (const key of LIST_ITEM_KEYS) {
          const val = attrs[key];
          if (val && val.trim()) {
            items = val.split(";").map(v => v.trim()).filter(Boolean);
            itemKey = key;
            break;
          }
        }
        results.push({
          uuid,
          node_id: entry.node_id,
          display_name: attrs["Comment"] ?? entry.display_name ?? "",
          items,
          item_key: itemKey,
        });
        found = true;
        break;
      }
    }
    return results;
  }

  $effect(() => {
    const uuidSet = new Set([...listInheritList, ...listExcludeList]);
    for (const f of fields) {
      if (f.key === "SpellList" && f.value.trim()) uuidSet.add(f.value.trim());
    }
    const allUuids = [...uuidSet];
    const missing = allUuids.filter(u => u.trim() && !listItemsCache.has(u));
    if (missing.length === 0) return;
    getListItems(missing).then(results => {
      const updated = new Map(listItemsCache);
      for (const info of results) {
        updated.set(info.uuid, info);
      }
      // Fill remaining UUIDs from mod scan data
      const stillMissing = missing.filter(u => !updated.has(u));
      if (stillMissing.length > 0) {
        const modResults = lookupModListItems(stillMissing);
        for (const info of modResults) updated.set(info.uuid, info);
      }
      listItemsCache = updated;
    }).catch(e => console.warn("List items lookup failed:", e));
  });

  // ---- Section capability flags ----
  const _section = untrack(() => snapshot(section));
  const baseCaps = SECTION_CAPS[_section] ?? {};

  // Node type selector state (for sections like CharacterCreationPresets with multiple entry types)
  const _entryFilter = untrack(() => snapshot(entryFilter));
  let selectedNodeType = $state(
    (_entryFilter?.field === "node_id" && baseCaps.nodeTypes?.[_entryFilter.value])
      ? _entryFilter.value
      : (baseCaps.nodeTypes ? Object.keys(baseCaps.nodeTypes)[0] ?? "" : "")
  );

  /** Merge base caps with per-node-type overrides. */
  let caps = $derived.by((): SectionCapabilities => {
    if (!baseCaps.nodeTypeCaps || !selectedNodeType) return baseCaps;
    const override = baseCaps.nodeTypeCaps[selectedNodeType];
    if (!override) return baseCaps;
    return {
      ...baseCaps,
      ...override,
      fieldCombobox: { ...baseCaps.fieldCombobox, ...override.fieldCombobox },
      fieldTypes: { ...baseCaps.fieldTypes, ...override.fieldTypes },
    };
  });

  const baseLayout = FORM_LAYOUTS[_section] as FormLayout | undefined;

  /** Resolve per-node-type layout override, or fall back to base layout. */
  let layout = $derived.by((): FormLayout | undefined => {
    if (baseLayout?.nodeTypeLayouts && selectedNodeType) {
      const override = baseLayout.nodeTypeLayouts[selectedNodeType];
      if (override) {
        return { ...baseLayout, ...override, nodeTypeLayouts: undefined };
      }
    }
    return baseLayout;
  });

  let allowedTagTypes = $derived(caps.tagTypes ?? ["Tags", "ReallyTags", "AppearanceTags"]);

  /** Set of field keys handled by layout (should not render in legacy FieldsFieldset). */
  let layoutHandledFieldKeys = $derived(new Set(layout?.handledFieldKeys ?? []));
  /** Set of boolean keys handled by layout (should not render in legacy BooleanFieldset). */
  let layoutHandledBooleanKeys = $derived(new Set(layout?.handledBooleanKeys ?? []));

  /** Fields NOT handled by layout — these fall through to legacy FieldsFieldset. */
  let unhandledFields = $derived(fields.filter(f => !layoutHandledFieldKeys.has(f.key)));
  /** Booleans NOT handled by layout — these fall through to legacy BooleanFieldset.
   *  Hidden/IsHidden are always excluded (controlled via eye icon in entry list). */
  const HIDDEN_BOOL_KEYS = new Set(['Hidden', 'IsHidden']);
  let unhandledBooleans = $derived(booleans.filter(b => !layoutHandledBooleanKeys.has(b.key) && !HIDDEN_BOOL_KEYS.has(b.key)));

  /** Get a field's value by key (for layout rendering). */
  function getFieldValue(key: string): string {
    return fields.find(f => f.key === key)?.value ?? '';
  }
  /** Set a field's value by key. */
  function setFieldValue(key: string, value: string): void {
    const idx = fields.findIndex(f => f.key === key);
    if (idx >= 0) {
      fields[idx].value = value;
    } else {
      fields = [...fields, { key, value }];
    }
  }
  /** Get a boolean's value by key (for layout rendering). */
  function getBoolValue(key: string): boolean {
    return booleans.find(b => b.key === key)?.value ?? false;
  }
  /** Set a boolean's value by key. */
  function setBoolValue(key: string, value: boolean): void {
    const idx = booleans.findIndex(b => b.key === key);
    if (idx >= 0) {
      booleans[idx].value = value;
    } else {
      booleans = [...booleans, { key, value }];
    }
  }

  // ---- Combobox helpers (thin wrappers around extracted utilities) ----

  /** Convenience wrapper: builds section options using current store state. */
  function buildSectionOptions(
    vanillaEntries: VanillaEntryInfo[],
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

  /** Pre-built map of field combobox options — only rebuilds when dependencies change */
  let fieldComboboxOptionsMap = $derived.by(() => {
    const ctx: FieldComboboxContext = {
      caps,
      vanilla: modStore.vanilla as unknown as Record<string, VanillaEntryInfo[]>,
      scanResult: modStore.scanResult,
      additionalModResults: modStore.additionalModResults,
      additionalModPaths: modStore.additionalModPaths,
      vanillaValueLists: modStore.vanillaValueLists,
      vanillaStatEntries: modStore.vanillaStatEntries,
      modStatEntries: modStore.modStatEntries,
      vanillaEquipment: modStore.vanillaEquipment,
      modName: modStore.scanResult?.mod_meta?.name,
      lookupFn: (h) => modStore.lookupLocalizedString(h),
      locaValues: configStore.locaEntries.flatMap(f => f.values.map(v => ({ contentuid: v.contentuid, text: v.text }))),
      localizationMap: modStore.localizationMap,
    };
    const map = new Map<string, ComboboxOption[]>();
    if (caps.fieldCombobox) {
      for (const fieldKey of Object.keys(caps.fieldCombobox)) {
        map.set(fieldKey, _getFieldComboboxOptions(fieldKey, ctx));
      }
    }
    return map;
  });

  function fieldComboboxOptions(fieldKey: string): ComboboxOption[] {
    return fieldComboboxOptionsMap.get(fieldKey) ?? [];
  }

  /** Resolve a localization handle to its display text, if known. */
  function resolveLocaText(handle: string | undefined): string | undefined {
    if (!handle) return undefined;
    const resolved = resolveLoca(handle, configStore.autoLocaEntries, (h) => modStore.lookupLocalizedString(h));
    return resolved === handle ? undefined : resolved;
  }

  let availableListOptions = $derived(
    buildSectionOptions(modStore.vanilla.Lists ?? [], "Lists", { nodeFilter: listType })
  );

  let availableActionResourceOptions = $derived(
    buildSectionOptions(modStore.vanilla.ActionResources ?? [], "ActionResources")
  );

  let availableSubclassOptions = $derived(
    buildSectionOptions(modStore.vanilla.ClassDescriptions ?? [], "ClassDescriptions")
  );

  let availableSpellIdOptions = $derived(computeSpellIdOptions(modStore.scanResult, modStore.additionalModResults));

  let availableSpellFieldKeys = $derived(computeSpellFieldKeys(modStore.vanillaStatFieldNames, modStore.scanResult, modStore.additionalModResults));

  let listItemsPlaceholder = $derived(getListItemsPlaceholder(listType));
  let listItemsLabel = $derived(getListItemsLabel(listType));
  let listItemsOptions = $derived(computeListItemsOptions(listType, modStore.vanillaStatEntries, modStore.vanillaValueLists, modStore.modStatEntries, modStore.scanResult?.mod_meta?.name ?? "Mod"));

  let availableVanillaSpellIds = $derived(
    modStore.vanillaStatEntries
      .filter(e => e.entry_type === "SpellData")
      .map(e => ({ value: e.name, label: e.name }))
  );

  let availablePassiveNames = $derived.by(() => {
    const seen = new Set<string>();
    const result: { value: string; label: string }[] = [];
    for (const e of modStore.vanillaStatEntries) {
      if (e.entry_type === "PassiveData" && !seen.has(e.name)) {
        seen.add(e.name);
        result.push({ value: e.name, label: e.name });
      }
    }
    for (const e of modStore.modStatEntries) {
      if (e.entry_type === "PassiveData" && !seen.has(e.name)) {
        seen.add(e.name);
        result.push({ value: e.name, label: `[Mod] ${e.name}` });
      }
    }
    return result;
  });

  let sectionUuidOptions = $derived.by(() => {
    const SECTION_VANILLA: Record<string, VanillaEntryInfo[]> = {
      Progressions: modStore.vanilla.Progressions ?? [],
      Races: modStore.vanilla.Races ?? [],
      Feats: modStore.vanilla.Feats ?? [],
      Origins: modStore.vanilla.Origins ?? [],
      Backgrounds: modStore.vanilla.Backgrounds ?? [],
      BackgroundGoals: modStore.vanilla.BackgroundGoals ?? [],
      ActionResources: modStore.vanilla.ActionResources ?? [],
      ActionResourceGroups: modStore.vanilla.ActionResourceGroups ?? [],
      ClassDescriptions: modStore.vanilla.ClassDescriptions ?? [],
      Lists: modStore.vanilla.Lists ?? [],
    };
    return buildSectionOptions(SECTION_VANILLA[section] ?? [], section);
  });

  function getChildValueOptions(childType: string): ComboboxOption[] {
    return computeChildValueOptions(childType, modStore.vanilla, modStore.scanResult, modStore.additionalModResults, (h) => modStore.lookupLocalizedString(h));
  }

  let tagValueOptions = $derived(computeTagValueOptions(modStore.vanilla.Tags ?? [], modStore.scanResult, modStore.additionalModResults, (h) => modStore.lookupLocalizedString(h)));
  let reallyTagValueOptions = $derived(computeReallyTagValueOptions(modStore.vanilla.Tags ?? []));

  function getTagOptionsForType(tagType: string): ComboboxOption[] {
    if (tagType === "ReallyTags") return reallyTagValueOptions;
    return tagValueOptions;
  }

  // ---- Add/remove helpers ----
  function addBoolean() {
    const usedKeys = new Set(booleans.map(b => b.key));
    const firstAvailable = (caps.booleanKeys ?? []).find(k => !usedKeys.has(k)) ?? "";
    booleans = [...booleans, { key: firstAvailable, value: false }];
  }
  function removeBoolean(i: number) { booleans = booleans.filter((_, idx) => idx !== i); }

  let allBoolKeysUsed = $derived(
    (caps.booleanKeys ?? []).length > 0 && booleans.length >= (caps.booleanKeys ?? []).length
  );

  function addField() {
    const usedKeys = new Set(fields.map(f => f.key));
    const firstAvailable = (caps.fieldKeys ?? []).find(k => !usedKeys.has(k)) ?? "";
    fields = [...fields, { key: firstAvailable, value: "" }];
  }
  function removeField(i: number) { fields = fields.filter((_, idx) => idx !== i); }

  let allFieldKeysUsed = $derived(
    (caps.fieldKeys ?? []).length > 0 && fields.length >= (caps.fieldKeys ?? []).length
  );


  function addString() {
    const usedTypes = new Set(strings.map(s => s.type));
    const firstAvailable = (caps.stringTypes ?? []).find(t => !usedTypes.has(t)) ?? caps.stringTypes?.[0] ?? "Boosts";
    strings = [...strings, { action: "Insert", type: firstAvailable, values: "", modGuid: "" }];
  }
  function removeString(i: number) { strings = strings.filter((_, idx) => idx !== i); }

  /** String types rendered inside a subsection (not in standalone block) */
  let subsectionStringKeys = $derived(
    new Set((layout?.subsections ?? []).flatMap(s => s.stringKeys ?? []))
  );

  let allStringTypesUsed = $derived(
    (caps.stringTypes ?? []).length > 0 && strings.length >= (caps.stringTypes ?? []).length
  );

  /** Strings NOT handled by any subsection — rendered in standalone block */
  let unhandledStringKeys = $derived(
    subsectionStringKeys.size > 0
      ? (caps.stringTypes ?? []).filter(t => !subsectionStringKeys.has(t))
      : undefined
  );

  let allTagTypesUsed = $derived(
    allowedTagTypes.length > 0 && tags.length >= allowedTagTypes.length
  );


  function addTag() { tags = [...tags, { uuids: [], action: "Insert", type: allowedTagTypes[0] ?? "Tags", modGuid: "" }]; }
  function removeTag(i: number) { tags = tags.filter((_, idx) => idx !== i); }

  /** Total selected tag UUIDs across all tag groups (for count display). */
  let totalTagUuids = $derived(tags.reduce((sum, t) => sum + t.uuids.length, 0));

  function addSubclass() { subclasses = [...subclasses, { uuid: "", action: "Remove", modGuid: "" }]; openSubclasses = true; }
  function removeSubclass(i: number) { subclasses = subclasses.filter((_, idx) => idx !== i); }

  function addSpellField() { spellFields = [...spellFields, { key: "", value: "" }]; openSpellFields = true; }
  function removeSpellField(i: number) { spellFields = spellFields.filter((_, idx) => idx !== i); }

  // ---- Validation ----
  let validationErrors = $derived(computeValidationErrors({
    caps, uuids, section, fields,
    vanillaSections: modStore.vanilla as Record<string, VanillaEntryInfo[]>,
  }));

  let hasErrors = $derived(validationErrors.some(e => e.severity === "error"));
  let hasWarnings = $derived(validationErrors.length > 0);
  let warnKeys = $derived(new Set(validationErrors.map(e => e.key)));

  let combinedSpellIdOptions = $derived(computeCombinedSpellIdOptions(availableVanillaSpellIds, availableSpellIdOptions));

  function submit(): void {
    const result = encodeFormState({
      caps, uuids, displayName, booleans, fields, selectors, strings,
      children, tags, subclasses, spellFields, listType, listItems,
      listInheritList, listExcludeList, argDefinitionsList, modGuid,
      blacklist, selectedNodeType,
    });

    if (Object.keys(result).length === 0) return;

    if (editIndex >= 0) {
      configStore.updateManualEntry(editIndex, section, result, entryComment.trim());
      toastStore.success(m.manual_form_entry_updated_title(), m.manual_form_entry_updated_message({ section }));
    } else if (autoEntryId) {
      configStore.setAutoEntryOverride(section, autoEntryId, result);
    } else {
      configStore.addManualEntry(section, result, false, entryComment.trim());
      onsave?.(result);
    }

    // Generate race tags on save
    if (_section === 'Races' && raceTagPanel) {
      raceTagPanel.generateTags();
    }

    // Sync race progression satellite entries
    if (_section === 'Races' && raceProgressionPanel) {
      const { toCreate, toUpdate, toRemove } = raceProgressionPanel.syncProgressions();
      if (toCreate.length > 0) {
        configStore.addManualEntries(toCreate, m.manual_form_create_race_progressions());
      }
      for (const upd of toUpdate) {
        configStore.updateManualEntry(upd.index, upd.section, upd.fields);
      }
      // Remove in reverse index order to avoid index shifting
      for (const idx of [...toRemove].sort((a, b) => b - a)) {
        configStore.removeManualEntry(idx);
      }
    }

    onclose();
  }
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') onclose(); }} />

<div class="bg-zinc-900 border rounded p-3 space-y-3 {hasErrors ? 'border-red-500/60' : hasWarnings ? 'border-amber-500/60' : 'border-zinc-600'}" aria-invalid={hasErrors ? 'true' : undefined}>
  <FormHeader
    isEdit={editIndex >= 0 || !!autoEntryId}
    {baseCaps}
    {caps}
    {entryFilter}
    bind:selectedNodeType
    bind:blacklist
    {layout}
    {rawAttributes}
    {getBoolValue}
    {setBoolValue}
    {onclose}
  />

  <FormIdentity
    {caps}
    bind:uuids
    bind:displayName
    bind:entryComment
    {generateUuid}
    {warnKeys}
    {combinedSpellIdOptions}
    bind:listItems
    bind:listInheritList
    bind:listExcludeList
    {listItemsLabel}
    {listItemsOptions}
    {listItemsPlaceholder}
    {listItemsCache}
    {availableListOptions}
    bind:argDefinitionsList
    {availableActionResourceOptions}
    {sectionUuidOptions}
    {layout}
    {getFieldValue}
    {setFieldValue}
    {getBoolValue}
    {setBoolValue}
    {fieldComboboxOptions}
    {resolveLocaText}
  />

  {#if layout}
    <FormBody
      {layout}
      {caps}
      bind:strings
      bind:children
      {getFieldValue}
      {setFieldValue}
      {getBoolValue}
      {setBoolValue}
      {fieldComboboxOptions}
      {resolveLocaText}
      {generateUuid}
      {availablePassiveNames}
      {warnKeys}
      {getChildValueOptions}
    />
  {/if}

  <!-- Race Progressions inline panel -->
  {#if _section === 'Races'}
    <details class="form-subsection" open={false}>
      <summary class="layout-subsection-summary text-xs font-semibold text-[var(--th-text-400)] cursor-pointer hover:text-[var(--th-text-200)] select-none mb-2 flex items-center gap-1.5">
        <ChevronRight size={12} class="layout-chevron shrink-0 transition-transform" />
        {m.manual_form_race_progressions()}
        {#if getFieldValue('ProgressionTableUUID')}
          <span class="font-mono text-[10px] text-[var(--th-text-500)] select-all cursor-text truncate font-normal translate-y-px">{getFieldValue('ProgressionTableUUID')}</span>
        {/if}
      </summary>
      <RaceProgressionPanel
        bind:this={raceProgressionPanel}
        raceUuid={uuids[0] ?? ''}
        progressionTableUuid={getFieldValue('ProgressionTableUUID')}
        passiveOptions={availablePassiveNames}
      />
    </details>

    <details class="form-subsection" open>
      <summary class="layout-subsection-summary text-xs font-semibold text-[var(--th-text-400)] cursor-pointer hover:text-[var(--th-text-200)] select-none mb-2 flex items-center gap-1.5">
        <ChevronRight size={12} class="layout-chevron shrink-0 transition-transform" />
        {m.manual_form_race_tags()}
      </summary>
      <RaceTagPanel
        bind:this={raceTagPanel}
        raceName={getFieldValue('Name')}
        raceDisplayName={getFieldValue('DisplayName')}
        raceDescription={getFieldValue('Description')}
        raceEntryUuid={uuids[0] ?? ''}
        bind:children
        {getChildValueOptions}
        isNewEntry={!(editIndex >= 0 || !!autoEntryId)}
      />
    </details>

    <details class="form-subsection" open={false}>
      <summary class="layout-subsection-summary text-xs font-semibold text-[var(--th-text-400)] cursor-pointer hover:text-[var(--th-text-200)] select-none mb-2 flex items-center gap-1.5">
        <ChevronRight size={12} class="layout-chevron shrink-0 transition-transform" />
        {m.manual_form_cc_presets()}
      </summary>
      <RacePresetPanel
        raceUuid={uuids[0] ?? ''}
        raceName={getFieldValue('Name')}
      />
    </details>
  {/if}

  <!-- Legacy fieldsets (only render fields/booleans NOT handled by layout) -->
  {#if caps.hasBooleans && unhandledBooleans.length > 0}
    <div class="border-t border-zinc-700 pt-2">
      <BooleanFieldset
        bind:booleans
        {caps}
        {allBoolKeysUsed}
        onaddBoolean={addBoolean}
        onremoveBoolean={removeBoolean}
      />
    </div>
  {/if}
  {#if caps.hasFields && unhandledFields.length > 0}
    <div class="border-t border-zinc-700 pt-2">
      <FieldsFieldset
        bind:fields
        {caps}
        {warnKeys}
        {validationErrors}
        {listItemsCache}
        {allFieldKeysUsed}
        getFieldComboboxOptions={fieldComboboxOptions}
        {resolveLocaText}
        onaddField={addField}
        onremoveField={removeField}
      />
    </div>
  {/if}

  {#if caps.hasSelectors}
    <FormSelectors bind:selectors {warnKeys} />
  {/if}

  {#if caps.hasStrings && (caps.stringTypes ?? []).some(t => !subsectionStringKeys.has(t))}
    <div class="border-t border-zinc-700 pt-2">
      <StringFieldset
        bind:strings
        {caps}
        {availablePassiveNames}
        {warnKeys}
        {allStringTypesUsed}
        hideRemoveButton={layout?.noRemoveButtons ?? false}
        onaddString={addString}
        onremoveString={removeString}
        filterKeys={unhandledStringKeys}
      />
    </div>
  {/if}

  <FormChildrenGroups
    {layout}
    {caps}
    bind:children
    {section}
    {entryFilter}
    {rawAttributes}
    {getChildValueOptions}
    {warnKeys}
  />

  {#if caps.hasTags}
    <div class="border-t border-zinc-700 pt-2">
      <TagFieldset
        bind:tags
        {allowedTagTypes}
        {getTagOptionsForType}
        {warnKeys}
        {allTagTypesUsed}
        hideRemoveButton={layout?.noRemoveButtons ?? false}
        onaddTag={addTag}
        onremoveTag={removeTag}
      />
    </div>
  {/if}

  <!-- Subclass Removal — progressive disclosure -->
  {#if caps.hasSubclasses}
    <details class="border-t border-zinc-700 pt-2" bind:open={openSubclasses}>
      <summary class="layout-subsection-summary text-xs font-semibold text-[var(--th-text-400)] cursor-pointer hover:text-[var(--th-text-200)] select-none mb-2 flex items-center gap-1.5">
        <ChevronRight size={12} class="layout-chevron shrink-0 transition-transform" />
        {m.manual_form_subclass_removal()} ({subclasses.length}) <span class="text-[10px] text-[var(--th-text-600)] font-normal">(optional)</span>
      </summary>
      <SubclassFieldset
        bind:subclasses
        {availableSubclassOptions}
        {warnKeys}
        onaddSubclass={addSubclass}
        onremoveSubclass={removeSubclass}
      />
    </details>
  {/if}

  <!-- Spell fields — progressive disclosure -->
  {#if caps.isSpell}
    <details class="border-t border-zinc-700 pt-2" bind:open={openSpellFields}>
      <summary class="layout-subsection-summary text-xs font-semibold text-[var(--th-text-400)] cursor-pointer hover:text-[var(--th-text-200)] select-none mb-2 flex items-center gap-1.5">
        <ChevronRight size={12} class="layout-chevron shrink-0 transition-transform" />
        {m.manual_form_stat_fields()} ({spellFields.length}) <span class="text-[10px] text-[var(--th-text-600)] font-normal">(optional)</span>
      </summary>
      <SpellFieldset
        bind:spellFields
        {availableSpellFieldKeys}
        onaddSpellField={addSpellField}
        onremoveSpellField={removeSpellField}
      />
    </details>
  {/if}

  <!-- Raw LSX data -->
  {#if rawAttributes && Object.keys(rawAttributes).length > 0}
    <details class="border-t border-zinc-700 pt-2">
      <summary class="layout-subsection-summary text-xs font-semibold text-[var(--th-text-400)] cursor-pointer hover:text-[var(--th-text-200)] select-none flex items-center gap-1.5">
        <ChevronRight size={12} class="layout-chevron shrink-0 transition-transform" />
        {m.manual_form_raw_lsx_data()} ({Object.keys(rawAttributes).length} {m.manual_form_attributes()}){#if sourceFile}<span class="text-[10px] font-normal text-[var(--th-text-600)] ml-1 truncate" title={sourceFile}>— {sourceFile.split(/[\\/]/).pop()}</span>{/if}
      </summary>
      <div class="mt-1 lsx-codeblock">
        <div class="lsx-codeblock-header">
          <span>{m.manual_form_lsx()}</span>
          {#if sourceFile}<span class="text-[10px] text-[var(--th-text-500)] ml-auto truncate" title={sourceFile}>{sourceFile}</span>{/if}
        </div>
        <pre class="lsx-codeblock-body">{#each Object.entries(rawAttributes) as [key, value]}<code><span class="lsx-attr-key">{key}</span><span class="lsx-punct">:</span> <span class="lsx-attr-val">{value}</span>
</code>{/each}{#if rawChildren}{#each Object.entries(rawChildren) as [group, guids]}{#if guids.length > 0}<code><span class="lsx-child-key">{group}</span><span class="lsx-punct">:</span> <span class="lsx-child-val">{guids.join(', ')}</span>
</code>{/if}{/each}{/if}</pre>
      </div>
    </details>
  {/if}



  <!-- Validation + Submit -->
  <FormFooter
    {validationErrors}
    isEdit={editIndex >= 0 || !!autoEntryId}
    onsubmit={submit}
    {onclose}
  />
</div>

<style>
  .lsx-codeblock {
    border: 1px solid var(--th-lsx-border);
    border-radius: 0.375rem;
    overflow: hidden;
    max-height: 12rem;
    font-size: 0.75rem;
  }
  .lsx-codeblock-header {
    background: var(--th-lsx-header-bg);
    padding: 0.25rem 0.5rem;
    font-size: 0.625rem;
    font-weight: 600;
    color: var(--th-lsx-header-text);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid var(--th-lsx-header-border);
    user-select: none;
  }
  .lsx-codeblock-body {
    background: var(--th-lsx-body-bg);
    margin: 0;
    padding: 0.5rem;
    overflow-y: auto;
    max-height: 10rem;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    font-size: 0.75rem;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-all;
    cursor: default;
    user-select: text;
  }
  .lsx-attr-key { color: var(--th-lsx-attr-key); }
  .lsx-attr-val { color: var(--th-lsx-attr-val); }
  .lsx-child-key { color: var(--th-lsx-child-key); }
  .lsx-child-val { color: var(--th-lsx-child-val); }
  .lsx-punct { color: var(--th-lsx-punct); }



  /* Collapsible subsection chevron rotation */
  .layout-subsection-summary :global(.layout-chevron) {
    transform: rotate(0deg);
  }
  details[open] > .layout-subsection-summary :global(.layout-chevron) {
    transform: rotate(90deg);
  }

  /* Inline subsection panels (Race Progressions, Tag Generation) */
  .form-subsection {
    padding: 0.5rem 0.625rem 0.625rem;
    border: 1px solid var(--th-border-700, #3f3f46);
    border-radius: 0.375rem;
    margin-top: 0.25rem;
  }


</style>
