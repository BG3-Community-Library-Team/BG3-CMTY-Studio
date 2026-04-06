<script lang="ts">
  import { untrack } from "svelte";
  import { m } from "../paraglide/messages.js";
  import { configStore } from "../lib/stores/configStore.svelte.js";
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import { uiStore } from "../lib/stores/uiStore.svelte.js";
  import { snapshot } from "../lib/utils/formSnapshot.js";
  import { toastStore } from "../lib/stores/toastStore.svelte.js";
  import type { VanillaEntryInfo } from "../lib/types/index.js";
  import { parseRawSelectors } from "../lib/utils/selectorParser.js";
  import { getListItems, type ListItemsInfo } from "../lib/utils/tauri.js";
  import { SECTION_CAPS, type SectionCapabilities } from "../lib/data/sectionCaps.js";
  import { FORM_LAYOUTS, type FormLayout } from "../lib/data/formLayouts.js";
  import { isLazyCategory, loadCategory } from "../lib/services/scanService.js";
  import type { VanillaCategory } from "../lib/data/vanillaRegistry.js";
  import { schemaStore } from "../lib/stores/schemaStore.svelte.js";
  import type { NodeSchema } from "../lib/utils/tauri.js";
  import { autoLayoutFromSchema, autoLayoutFromCaps } from "../lib/data/autoLayout.js";
  import { classifyLsxType, renderTypeToFieldType, inferComboboxDescriptor } from "../lib/utils/lsxTypes.js";

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
  import FormSectionCard from "./manual-entry/FormSectionCard.svelte";
  import FormIdentityCard from "./manual-entry/FormIdentityCard.svelte";
  import RaceProgressionPanel from "./manual-entry/RaceProgressionPanel.svelte";
  import RaceTagPanel from "./manual-entry/RaceTagPanel.svelte";
  import RacePresetPanel from "./manual-entry/RacePresetPanel.svelte";
  import FormNav from "./manual-entry/FormNav.svelte";
  import { buildFormState, encodeFormState } from "../lib/utils/formInit.js";
  import { parseHandleVersion, isContentHandle, resolveLoca } from "../lib/utils/localizationManager.js";
  import { generateUuid } from "../lib/utils/uuid.js";
  import {
    computeSpellIdOptions, computeSpellFieldKeys, combinedSpellIdOptions as computeCombinedSpellIdOptions,
    getListItemsPlaceholder, getListItemsLabel, computeListItemsOptions,
    computeChildValueOptions, computeTagValueOptions, computeReallyTagValueOptions,
    computeValidationErrors,
  } from "../lib/utils/formOptions.js";
  import Search from "@lucide/svelte/icons/search";

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
    initialShowSummary = false,
    nodeId = null,
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
    initialShowSummary?: boolean;
    nodeId?: string | null;
  } = $props();

  // ---- Core identity fields ----

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
  let showSummary = $state(false);
  $effect(() => { if (initialShowSummary) showSummary = true; });

  // Listen for external summary toggle events (from ProgressionTimeline)
  $effect(() => {
    function onToggleSummary(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.section === section && detail?.uuid === autoEntryId) {
        showSummary = !showSummary;
      }
    }
    window.addEventListener('toggle-entry-summary', onToggleSummary);
    return () => window.removeEventListener('toggle-entry-summary', onToggleSummary);
  });

  // Sync summary drawer state to uiStore for App-level rendering
  $effect(() => {
    if (showSummary) {
      uiStore.openSummaryDrawer({
        section,
        displayName: _init.displayName ?? "",
        uuids,
        validationErrors: validationErrors.map(e => ({ key: e.key, msg: e.message, level: e.severity === "error" ? "error" as const : "warn" as const })),
        fields: Object.fromEntries(fields.map(f => [f.key, f.value])),
        booleans,
        strings: strings.map(s => ({ action: s.action, type: s.type, values: s.values.split(";").map(v => v.trim()).filter(Boolean) })),
        rawAttributes: rawAttributes ?? null,
        rawChildren: rawChildren ?? null,
        vanillaAttributes: rawAttributes ?? null,
        autoEntryId: autoEntryId ?? null,
        nodeId: selectedNodeType || rawAttributes?.node_id || section,
        rawAttributeTypes: null,
      });
    } else {
      uiStore.closeSummaryDrawer();
    }
  });

  // Sync back: if drawer was closed externally (e.g. close button), update local state
  $effect(() => {
    if (showSummary && !uiStore.summaryDrawer) {
      showSummary = false;
    }
  });

  // Close summary when this form unmounts
  $effect(() => {
    return () => { uiStore.closeSummaryDrawer(); };
  });

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

  // ── Metadata priority cascade ──────────────────────────────
  const _section = untrack(() => snapshot(section));
  const _hasFormLayout = _section in FORM_LAYOUTS;
  const _hasSectionCaps = _section in SECTION_CAPS;

  // Schema data (reactive — may load asynchronously)
  let schemas = $derived(schemaStore.getBySection(_section));

  // svelte-ignore state_referenced_locally — intentional one-time snapshot
  let selectedSchemaNodeId = $state(snapshot(nodeId) ?? "");
  $effect(() => {
    // Auto-select first schema node when schemas load and no node is pre-selected
    if (!selectedSchemaNodeId && schemas.length > 0) {
      selectedSchemaNodeId = schemas[0].node_id;
    }
  });
  let activeSchema = $derived(
    selectedSchemaNodeId ? schemaStore.getByNodeId(selectedSchemaNodeId) : schemas[0]
  );

  // Tier determination (stable — based on _section which is snapshotted)
  const tier: 'layout' | 'caps' | 'schema' =
    _hasFormLayout ? 'layout'
    : _hasSectionCaps ? 'caps'
    : 'schema'; // Tier 3/4 resolved at render time based on schemas availability

  const isFallback = $derived(tier === 'schema' && schemas.length === 0 && schemaStore.loaded);
  const isSchemaLoading = $derived(tier === 'schema' && schemas.length === 0 && !schemaStore.loaded);

  // Caps resolution
  const baseCaps: SectionCapabilities = _hasSectionCaps ? (SECTION_CAPS[_section] ?? {}) : {};

  /** Synthesize SectionCapabilities from a NodeSchema for schema-only sections. */
  function capsFromSchema(schema: NodeSchema): SectionCapabilities {
    const booleanKeys: string[] = [];
    const fieldKeys: string[] = [];
    const fieldTypes: Record<string, string> = {};
    const fieldCombobox: Record<string, string> = {};

    for (const attr of schema.attributes) {
      if (attr.name === "UUID" || attr.name === "MapKey") continue;

      const renderType = classifyLsxType(attr.attr_type, attr.name, attr.examples);

      if (renderType === 'boolean') {
        booleanKeys.push(attr.name);
      } else {
        fieldKeys.push(attr.name);
        fieldTypes[attr.name] = renderTypeToFieldType(renderType);
      }

      // Combobox inference
      const descriptor = inferComboboxDescriptor(attr.name, attr.attr_type, renderType, attr.examples);
      if (descriptor) {
        fieldCombobox[attr.name] = descriptor;
      }
    }

    return {
      hasFields: fieldKeys.length > 0,
      hasBooleans: booleanKeys.length > 0,
      hasChildren: schema.children.length > 0,
      fieldKeys,
      booleanKeys,
      fieldTypes,
      fieldCombobox: Object.keys(fieldCombobox).length > 0 ? fieldCombobox : undefined,
      childTypes: schema.children.map(c => c.child_node_id),
    };
  }

  // For schema-only sections, synthesize caps from schema
  let effectiveCaps = $derived.by((): SectionCapabilities => {
    if (_hasSectionCaps) return baseCaps;
    if (activeSchema) return capsFromSchema(activeSchema);
    return {};
  });

  // Layout resolution via cascade
  const staticLayout = _hasFormLayout ? (FORM_LAYOUTS[_section] as FormLayout) : undefined;
  let baseLayout = $derived.by((): FormLayout | undefined => {
    if (staticLayout) return staticLayout;
    if (_hasSectionCaps) return autoLayoutFromCaps(SECTION_CAPS[_section]);
    if (activeSchema) return autoLayoutFromSchema(activeSchema);
    return undefined;
  });

  // Large section optimization: collapse all subsections when >50 attrs
  let resolvedLayout = $derived.by((): FormLayout | undefined => {
    if (!baseLayout) return undefined;
    const totalAttrs = (baseLayout.handledFieldKeys?.length ?? 0) + (baseLayout.handledBooleanKeys?.length ?? 0);
    if (totalAttrs > 50 && baseLayout.subsections) {
      return {
        ...baseLayout,
        subsections: baseLayout.subsections.map(s => ({ ...s, collapsed: true })),
      };
    }
    return baseLayout;
  });

  // For schema/fallback tiers, initialize fields from effectiveCaps after schema loads
  $effect(() => {
    if (tier !== 'layout' && !_hasSectionCaps && effectiveCaps.fieldKeys) {
      const existingFieldKeys = new Set(fields.map(f => f.key));
      for (const key of effectiveCaps.fieldKeys ?? []) {
        if (!existingFieldKeys.has(key)) {
          fields = [...fields, { key, value: "" }];
        }
      }
      const existingBoolKeys = new Set(booleans.map(b => b.key));
      for (const key of effectiveCaps.booleanKeys ?? []) {
        if (!existingBoolKeys.has(key)) {
          booleans = [...booleans, { key, value: false }];
        }
      }
    }
  });

  // Node type selector state (for sections like CharacterCreationPresets with multiple entry types)
  const _entryFilter = untrack(() => snapshot(entryFilter));
  let selectedNodeType = $state(
    (_entryFilter?.field === "node_id" && baseCaps.nodeTypes?.[_entryFilter.value])
      ? _entryFilter.value
      : (baseCaps.nodeTypes ? Object.keys(baseCaps.nodeTypes)[0] ?? "" : "")
  );

  /** Merge base caps with per-node-type overrides, using effectiveCaps for schema-only sections. */
  let caps = $derived.by((): SectionCapabilities => {
    const base = _hasSectionCaps ? baseCaps : effectiveCaps;
    if (!base.nodeTypeCaps || !selectedNodeType) return base;
    const override = base.nodeTypeCaps[selectedNodeType];
    if (!override) return base;
    return {
      ...base,
      ...override,
      fieldCombobox: { ...base.fieldCombobox, ...override.fieldCombobox },
      fieldTypes: { ...base.fieldTypes, ...override.fieldTypes },
    };
  });

  /** Resolve per-node-type layout override, or fall back to resolved layout. */
  let layout = $derived.by((): FormLayout | undefined => {
    if (resolvedLayout?.nodeTypeLayouts && selectedNodeType) {
      const override = resolvedLayout.nodeTypeLayouts[selectedNodeType];
      if (override) {
        return { ...resolvedLayout, ...override, nodeTypeLayouts: undefined };
      }
    }
    return resolvedLayout;
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

  // ---- Search filter for large sections ----
  let formFieldFilter = $state("");
  let totalAttrCount = $derived((layout?.handledFieldKeys?.length ?? 0) + (layout?.handledBooleanKeys?.length ?? 0));

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

  // -- Per-descriptor-type combobox option derivations (PF-009) --

  /** section: — vanilla entries + scanned mod + additional mods */
  let _cbSection = $derived.by(() => {
    const fc = caps.fieldCombobox;
    if (!fc) return new Map<string, ComboboxOption[]>();
    const ctx: FieldComboboxContext = {
      caps,
      vanilla: modStore.vanilla as unknown as Record<string, VanillaEntryInfo[]>,
      scanResult: modStore.scanResult,
      additionalModResults: modStore.additionalModResults,
      additionalModPaths: modStore.additionalModPaths,
      vanillaValueLists: [],
      vanillaStatEntries: [],
      modStatEntries: [],
      vanillaEquipment: [],
      modName: modStore.scanResult?.mod_meta?.name,
      lookupFn: (h) => modStore.lookupLocalizedString(h),
    };
    const map = new Map<string, ComboboxOption[]>();
    for (const [fk, desc] of Object.entries(fc)) {
      if (desc.startsWith('section:')) map.set(fk, _getFieldComboboxOptions(fk, ctx));
    }
    return map;
  });

  /** folder: + progressionTable: + voiceTable: — vanilla entries only (no scan data) */
  let _cbVanillaOnly = $derived.by(() => {
    const fc = caps.fieldCombobox;
    if (!fc) return new Map<string, ComboboxOption[]>();
    const ctx: FieldComboboxContext = {
      caps,
      vanilla: modStore.vanilla as unknown as Record<string, VanillaEntryInfo[]>,
      scanResult: null,
      additionalModResults: [],
      additionalModPaths: [],
      vanillaValueLists: [],
      vanillaStatEntries: [],
      modStatEntries: [],
      vanillaEquipment: [],
      lookupFn: (h) => modStore.lookupLocalizedString(h),
    };
    const map = new Map<string, ComboboxOption[]>();
    for (const [fk, desc] of Object.entries(fc)) {
      if (desc.startsWith('folder:') || desc.startsWith('progressionTable:') || desc.startsWith('voiceTable:'))
        map.set(fk, _getFieldComboboxOptions(fk, ctx));
    }
    return map;
  });

  /** valueList: — depends only on vanillaValueLists */
  let _cbValueList = $derived.by(() => {
    const fc = caps.fieldCombobox;
    if (!fc) return new Map<string, ComboboxOption[]>();
    const ctx: FieldComboboxContext = {
      caps,
      vanilla: {},
      scanResult: null,
      additionalModResults: [],
      additionalModPaths: [],
      vanillaValueLists: modStore.vanillaValueLists,
      vanillaStatEntries: [],
      modStatEntries: [],
      vanillaEquipment: [],
    };
    const map = new Map<string, ComboboxOption[]>();
    for (const [fk, desc] of Object.entries(fc)) {
      if (desc.startsWith('valueList:')) map.set(fk, _getFieldComboboxOptions(fk, ctx));
    }
    return map;
  });

  /** static: — no reactive data dependencies (parsed from descriptor string) */
  let _cbStatic = $derived.by(() => {
    const fc = caps.fieldCombobox;
    if (!fc) return new Map<string, ComboboxOption[]>();
    const ctx: FieldComboboxContext = {
      caps,
      vanilla: {},
      scanResult: null,
      additionalModResults: [],
      additionalModPaths: [],
      vanillaValueLists: [],
      vanillaStatEntries: [],
      modStatEntries: [],
      vanillaEquipment: [],
    };
    const map = new Map<string, ComboboxOption[]>();
    for (const [fk, desc] of Object.entries(fc)) {
      if (desc.startsWith('static:')) map.set(fk, _getFieldComboboxOptions(fk, ctx));
    }
    return map;
  });

  /** statType: — depends on stat entries from vanilla + mod */
  let _cbStatType = $derived.by(() => {
    const fc = caps.fieldCombobox;
    if (!fc) return new Map<string, ComboboxOption[]>();
    const ctx: FieldComboboxContext = {
      caps,
      vanilla: {},
      scanResult: null,
      additionalModResults: [],
      additionalModPaths: [],
      vanillaValueLists: [],
      vanillaStatEntries: modStore.vanillaStatEntries,
      modStatEntries: modStore.modStatEntries,
      vanillaEquipment: [],
      modName: modStore.scanResult?.mod_meta?.name,
    };
    const map = new Map<string, ComboboxOption[]>();
    for (const [fk, desc] of Object.entries(fc)) {
      if (desc.startsWith('statType:')) map.set(fk, _getFieldComboboxOptions(fk, ctx));
    }
    return map;
  });

  /** equipment: — depends only on vanillaEquipment */
  let _cbEquipment = $derived.by(() => {
    const fc = caps.fieldCombobox;
    if (!fc) return new Map<string, ComboboxOption[]>();
    const ctx: FieldComboboxContext = {
      caps,
      vanilla: {},
      scanResult: null,
      additionalModResults: [],
      additionalModPaths: [],
      vanillaValueLists: [],
      vanillaStatEntries: [],
      modStatEntries: [],
      vanillaEquipment: modStore.vanillaEquipment,
    };
    const map = new Map<string, ComboboxOption[]>();
    for (const [fk, desc] of Object.entries(fc)) {
      if (desc.startsWith('equipment:')) map.set(fk, _getFieldComboboxOptions(fk, ctx));
    }
    return map;
  });

  /** loca: — depends on user-authored loca entries + vanilla localization map */
  let _cbLoca = $derived.by(() => {
    const fc = caps.fieldCombobox;
    if (!fc) return new Map<string, ComboboxOption[]>();
    const ctx: FieldComboboxContext = {
      caps,
      vanilla: {},
      scanResult: null,
      additionalModResults: [],
      additionalModPaths: [],
      vanillaValueLists: [],
      vanillaStatEntries: [],
      modStatEntries: [],
      vanillaEquipment: [],
      locaValues: configStore.locaEntries.flatMap(f => f.values.map(v => ({ contentuid: v.contentuid, text: v.text }))),
      localizationMap: modStore.localizationMap,
    };
    const map = new Map<string, ComboboxOption[]>();
    for (const [fk, desc] of Object.entries(fc)) {
      if (desc.startsWith('loca:')) map.set(fk, _getFieldComboboxOptions(fk, ctx));
    }
    return map;
  });

  /** Dispatching accessor — routes to the correct per-type derivation. */
  function fieldComboboxOptions(fieldKey: string): ComboboxOption[] {
    const descriptor = caps.fieldCombobox?.[fieldKey];
    if (!descriptor) return [];
    if (descriptor.startsWith('section:')) return _cbSection.get(fieldKey) ?? [];
    if (descriptor.startsWith('folder:') || descriptor.startsWith('progressionTable:') || descriptor.startsWith('voiceTable:'))
      return _cbVanillaOnly.get(fieldKey) ?? [];
    if (descriptor.startsWith('valueList:')) return _cbValueList.get(fieldKey) ?? [];
    if (descriptor.startsWith('static:')) return _cbStatic.get(fieldKey) ?? [];
    if (descriptor.startsWith('statType:')) return _cbStatType.get(fieldKey) ?? [];
    if (descriptor.startsWith('equipment:')) return _cbEquipment.get(fieldKey) ?? [];
    if (descriptor.startsWith('loca:')) return _cbLoca.get(fieldKey) ?? [];
    return [];
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
    const opts = computeChildValueOptions(childType, modStore.vanilla, modStore.scanResult, modStore.additionalModResults, (h) => modStore.lookupLocalizedString(h));
    if (opts.length > 0) return opts;
    // Schema-driven fallback: use vanilla entries from the child node's section
    const childSchema = schemaStore.getByNodeId(childType);
    if (childSchema) {
      const vanillaEntries = modStore.vanilla[childSchema.section] ?? [];
      if (vanillaEntries.length > 0) {
        return buildSectionOptions(vanillaEntries, childSchema.section);
      }
    }
    return [];
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

  // ---- Nav sections + error counts for FormNav ----
  let formContainerEl: HTMLElement | undefined = $state(undefined);

  let navSections = $derived.by(() => {
    const sections: { id: string; label: string }[] = [{ id: 'section-identity', label: 'Basic Info' }];
    if (layout?.subsections) {
      for (const sub of layout.subsections) {
        if (sub.component) continue;
        const id = `section-${sub.title.toLowerCase().replace(/\s+/g, '-')}`;
        sections.push({ id, label: sub.title });
      }
    }
    if (caps.hasBooleans && unhandledBooleans.length > 0) sections.push({ id: 'section-booleans', label: 'Booleans' });
    if (caps.hasFields && unhandledFields.length > 0) sections.push({ id: 'section-fields', label: 'Fields' });
    if (caps.hasSelectors) sections.push({ id: 'section-selectors', label: 'Selectors' });
    if (caps.hasStrings && (caps.stringTypes ?? []).some(t => !subsectionStringKeys.has(t))) sections.push({ id: 'section-strings', label: 'Strings' });
    if (caps.hasTags) sections.push({ id: 'section-tags', label: 'Tags' });
    if (_section === 'Races') {
      sections.push({ id: 'section-race-progressions', label: 'Race Progressions' });
      sections.push({ id: 'section-race-tags', label: 'Race Tags' });
      sections.push({ id: 'section-cc-presets', label: 'CC Presets' });
    }
    if (caps.hasSubclasses) sections.push({ id: 'section-subclass-removal', label: 'Subclasses' });
    if (caps.hasChildren) sections.push({ id: 'section-children', label: 'Children' });
    return sections;
  });

  // Publish form nav sections to uiStore for CommandPalette integration (Y3)
  $effect(() => {
    uiStore.formNavSections = navSections;
    return () => { uiStore.formNavSections = []; };
  });

  let navErrorCounts = $derived.by(() => {
    const counts: Record<string, number> = {};
    for (const err of validationErrors) {
      const fieldKey = err.key.startsWith('field:') ? err.key.slice(6) : '';
      if (fieldKey && layoutHandledFieldKeys.has(fieldKey)) {
        // Error belongs to a layout subsection — find which one
        for (const sub of layout?.subsections ?? []) {
          if (sub.rows?.some(r => r.items.some(i => i.key === fieldKey))) {
            const id = `section-${sub.title.toLowerCase().replace(/\s+/g, '-')}`;
            counts[id] = (counts[id] ?? 0) + 1;
            break;
          }
        }
      } else if (err.key.startsWith('field:')) {
        counts['section-fields'] = (counts['section-fields'] ?? 0) + 1;
      }
    }
    return counts;
  });

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

<div class="bg-[var(--th-bg-900)] border rounded p-3 space-y-3 {hasErrors ? 'border-red-500/60' : hasWarnings ? 'border-amber-500/60' : 'border-[var(--th-border-700)]'}" aria-invalid={hasErrors ? 'true' : undefined}>
  <FormHeader
    isEdit={editIndex >= 0 || !!autoEntryId}
    {baseCaps}
    {caps}
    {entryFilter}
    bind:selectedNodeType
    bind:blacklist
    layout={layout}
    {rawAttributes}
    {showSummary}
    {getBoolValue}
    {setBoolValue}
    {onclose}
    ontoggleSummary={() => { showSummary = !showSummary; }}
  />

  <!-- Schema node type selector for schema-driven sections with multiple node types -->
  {#if tier === 'schema' && schemas.length > 1}
    <div class="flex items-center gap-2 px-1">
      <span class="text-xs text-[var(--th-text-400)]">Node type:</span>
      <select
        class="form-input text-xs h-6 py-0"
        value={selectedSchemaNodeId}
        onchange={(e) => selectedSchemaNodeId = (e.target as HTMLSelectElement).value}
      >
        {#each schemas as s}
          <option value={s.node_id}>{s.node_id} ({s.sample_count} samples)</option>
        {/each}
      </select>
    </div>
  {/if}

  {#if isSchemaLoading}
    <div class="schema-loading" role="status" aria-label="Loading schema data">
      <div class="loading-spinner"></div>
      <p>Loading schema data…</p>
    </div>
  {:else if isFallback}
    <!-- Tier 4: Minimal UUID + flat attribute grid -->
    <FormIdentityCard>
      <FormIdentity
        caps={{ hasFields: false, hasBooleans: false }}
        bind:uuids
        bind:displayName
        bind:entryComment
        {generateUuid}
        warnKeys={new Set()}
        combinedSpellIdOptions={[]}
        bind:listItems
        bind:listInheritList
        bind:listExcludeList
        listItemsLabel=""
        listItemsOptions={[]}
        listItemsPlaceholder=""
        listItemsCache={new Map()}
        availableListOptions={[]}
        bind:argDefinitionsList
        availableActionResourceOptions={[]}
        sectionUuidOptions={[]}
        layout={undefined}
        getFieldValue={() => ''}
        setFieldValue={() => {}}
        getBoolValue={() => false}
        setBoolValue={() => {}}
        fieldComboboxOptions={() => []}
        resolveLocaText={() => undefined}
      />
    </FormIdentityCard>
    <FormSectionCard title={m.form_section_attributes()} open>
      <p class="text-xs text-[var(--th-text-500)] mb-2">
        {m.schema_form_no_vanilla({ section: _section })}
      </p>
      <fieldset class="space-y-1.5">
        <div class="flex items-center gap-2">
          <span class="text-xs text-[var(--th-text-400)] w-36 shrink-0">Name</span>
          <input type="text" class="form-input w-full" value={displayName} oninput={(e) => displayName = (e.target as HTMLInputElement).value} placeholder="Entry name" />
        </div>
      </fieldset>
    </FormSectionCard>

    <!-- Validation + Submit (fallback) -->
    <FormFooter
      {validationErrors}
      isEdit={editIndex >= 0 || !!autoEntryId}
      onsubmit={submit}
      {onclose}
    />
  {:else}
    <!-- Tiers 1-3: Full form rendering -->
    <div class="form-container" bind:this={formContainerEl}>
      <FormNav sections={navSections} errorCounts={navErrorCounts} containerEl={formContainerEl} />
      <div class="form-content">

    <!-- Search filter for large sections (50+ attrs) -->
    {#if totalAttrCount > 50}
      <div class="relative mb-1">
        <Search size={12} class="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--th-text-500)]" />
        <input
          type="text"
          class="form-input w-full pl-7 text-xs h-7"
          placeholder="Filter fields..."
          bind:value={formFieldFilter}
        />
      </div>
    {/if}

    <FormIdentityCard>
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
    </FormIdentityCard>

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
      <FormSectionCard title={m.manual_form_race_progressions()} id="section-race-progressions" open={false}>
        {#snippet headerActions()}
          {#if getFieldValue('ProgressionTableUUID')}
            <span class="font-mono text-[10px] text-[var(--th-text-500)] select-all cursor-text truncate font-normal">{getFieldValue('ProgressionTableUUID')}</span>
          {/if}
        {/snippet}
        <RaceProgressionPanel
          bind:this={raceProgressionPanel}
          raceUuid={uuids[0] ?? ''}
          progressionTableUuid={getFieldValue('ProgressionTableUUID')}
          passiveOptions={availablePassiveNames}
        />
      </FormSectionCard>

      <FormSectionCard title={m.manual_form_race_tags()} id="section-race-tags">
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
      </FormSectionCard>

      <FormSectionCard title={m.manual_form_cc_presets()} id="section-cc-presets" open={false}>
        <RacePresetPanel
          raceUuid={uuids[0] ?? ''}
          raceName={getFieldValue('Name')}
        />
      </FormSectionCard>
    {/if}

    <!-- Legacy fieldsets (only render fields/booleans NOT handled by layout) -->
    {#if caps.hasBooleans && unhandledBooleans.length > 0}
      <FormSectionCard title={m.form_section_booleans()} id="section-booleans">
        <BooleanFieldset
          bind:booleans
          {caps}
          {allBoolKeysUsed}
          onaddBoolean={addBoolean}
          onremoveBoolean={removeBoolean}
        />
      </FormSectionCard>
    {/if}
    {#if caps.hasFields && unhandledFields.length > 0}
      <FormSectionCard title={m.form_section_fields()} id="section-fields">
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
      </FormSectionCard>
    {/if}

    {#if caps.hasSelectors}
      <FormSectionCard title={m.form_section_selectors()} id="section-selectors">
        <FormSelectors bind:selectors {warnKeys} />
      </FormSectionCard>
    {/if}

    {#if caps.hasStrings && (caps.stringTypes ?? []).some(t => !subsectionStringKeys.has(t))}
      <FormSectionCard title={m.form_section_strings()} id="section-strings">
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
      </FormSectionCard>
    {/if}

    <div id="section-children">
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
    </div>

    {#if caps.hasTags}
      <FormSectionCard title={m.form_section_tags()} id="section-tags">
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
      </FormSectionCard>
    {/if}

    <!-- Subclass Removal — progressive disclosure -->
    {#if caps.hasSubclasses}
      <FormSectionCard title="{m.manual_form_subclass_removal()} ({subclasses.length})" id="section-subclass-removal" bind:open={openSubclasses}>
        {#snippet headerActions()}
          <span class="text-[10px] text-[var(--th-text-600)] font-normal">(optional)</span>
        {/snippet}
        <SubclassFieldset
          bind:subclasses
          {availableSubclassOptions}
          {warnKeys}
          onaddSubclass={addSubclass}
          onremoveSubclass={removeSubclass}
        />
      </FormSectionCard>
    {/if}

    <!-- Spell fields — progressive disclosure -->
    {#if caps.isSpell}
      <FormSectionCard title="{m.manual_form_stat_fields()} ({spellFields.length})" bind:open={openSpellFields}>
        {#snippet headerActions()}
          <span class="text-[10px] text-[var(--th-text-600)] font-normal">(optional)</span>
        {/snippet}
        <SpellFieldset
          bind:spellFields
          {availableSpellFieldKeys}
          onaddSpellField={addSpellField}
          onremoveSpellField={removeSpellField}
        />
      </FormSectionCard>
    {/if}

      </div><!-- .form-content -->
    </div><!-- .form-container -->

    <!-- Validation + Submit -->
    <FormFooter
      {validationErrors}
      isEdit={editIndex >= 0 || !!autoEntryId}
      onsubmit={submit}
      {onclose}
    />
  {/if}
</div>

<style>
  .form-container {
    container-type: inline-size;
    display: flex;
    gap: 0.75rem;
    min-height: 0;
    transition: gap 0.2s ease;
  }

  .form-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  /* Narrow: collapse to single column with horizontal pill nav */
  @container (max-width: 639px) {
    .form-container {
      flex-direction: column;
      gap: 0.5rem;
    }
    .form-container :global(.form-nav) {
      position: static;
      width: 100%;
      min-width: unset;
      max-width: unset;
      border-right: none;
      border-bottom: 1px solid var(--th-border-700);
      border-radius: 0.375rem 0.375rem 0 0;
      padding: 0.25rem;
    }
    .form-container :global(.form-nav-list) {
      flex-direction: row;
      flex-wrap: wrap;
      gap: 0.25rem;
      padding: 0;
    }
    .form-container :global(.form-nav-item) {
      border-left: none;
      border-bottom: 2px solid transparent;
      padding: 0.25rem 0.5rem;
      font-size: 0.625rem;
      border-radius: 9999px;
      background: var(--th-bg-700);
    }
    .form-container :global(.form-nav-item.active) {
      border-left-color: transparent;
      border-bottom-color: var(--th-text-sky-400);
      background: var(--th-bg-sky-700-60, rgba(14, 165, 233, 0.15));
    }
  }

  /* Wide: nav + form + optional summary slot */
  @container (min-width: 1024px) {
    .form-container {
      gap: 1rem;
    }
  }

  .schema-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    gap: 1rem;
    color: var(--th-text-secondary, #aaa);
  }
  .schema-loading .loading-spinner {
    width: 28px;
    height: 28px;
    border: 3px solid var(--th-border-700, #333);
    border-top-color: var(--th-accent-500, #0ea5e9);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
