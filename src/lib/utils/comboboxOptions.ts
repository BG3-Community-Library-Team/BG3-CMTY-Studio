/**
 * Combobox option utilities for ManualEntryForm.
 *
 * Pure functions that build option lists for combobox dropdowns from
 * vanilla data, scanned mods, and additional loaded mods.
 */
import type { VanillaEntryInfo, DiffEntry, ScanResult } from "../types/index.js";
import type { SectionCapabilities } from "../data/sectionCaps.js";
import { settingsStore } from "../stores/settingsStore.svelte.js";
import { localeCompare } from "./localeSort.js";

// ---- Types -----------------------------------------------------------------

export interface ComboboxOption {
  value: string;
  label: string;
  color?: string;
  /** Source tag for sorting (e.g. "Vanilla", mod name). Avoids regex label parsing. */
  _source?: string;
  /** Resolved display name for sorting. Avoids regex label parsing. */
  _displayName?: string;
  /** Loca handle from a linked entry's Text attribute (for tooltip section fields). */
  _locaHandle?: string;
}

// ---- Display name resolution -----------------------------------------------

/**
 * Build a combobox label from source, name, and UUID according to user settings.
 * Format: [Source][Name] uuid — either part can be toggled off.
 */
function formatComboboxLabel(source: string, name: string, uuid: string): string {
  const parts: string[] = [];
  if (settingsStore.showModNamePrefix) parts.push(`[${source}]`);
  if (settingsStore.showComboboxNames) parts.push(`[${name}]`);
  if (parts.length > 0) return `${parts.join('')} ${uuid}`;
  return uuid;
}

/** Sections whose display_name may be a localization handle (BG3 loca handle format) */
const LOCA_SECTIONS = new Set(["Backgrounds", "Origins", "BackgroundGoals"]);

/**
 * Resolve a raw display_name — if it looks like a BG3 loca handle, look it up.
 * For sections NOT in LOCA_SECTIONS, returns the raw string unchanged.
 *
 * @param raw - The raw display name string
 * @param sectionName - Optional section name for context
 * @param lookupFn - Function to resolve loca handles (e.g. modStore.lookupLocalizedString)
 */
export function resolveDisplayName(
  raw: string,
  sectionName?: string,
  lookupFn?: (handle: string) => string | undefined,
): string {
  if (!raw) return "Unnamed";
  const mayBeLoca = (sectionName && LOCA_SECTIONS.has(sectionName))
    || /^h[0-9a-f]+g[0-9a-f]/i.test(raw);
  if (mayBeLoca && /^h[0-9a-f]+g[0-9a-f]/i.test(raw)) {
    const resolved = lookupFn?.(raw);
    return resolved || raw;
  }
  return raw;
}

// ---- Sorting ---------------------------------------------------------------

/**
 * Sort combobox options alphabetically by display name (ignoring [Source] prefix),
 * with "Unnamed" entries pushed to the very end.
 */
export function sortComboboxOptions(opts: ComboboxOption[]): ComboboxOption[] {
  return opts.sort((a, b) => {
    const getName = (o: ComboboxOption) => {
      if (o._displayName !== undefined) return o._displayName;
      // Fallback: parse from label for options without metadata
      const m = o.label.match(/\]\[([^\]]*)\]/);
      if (m) return m[1];
      const m2 = o.label.match(/^\[([^\]]*)\]/);
      return m2?.[1] ?? "";
    };
    const aName = getName(a);
    const bName = getName(b);
    const aUnnamed = aName === "Unnamed" || aName === "" || /^[0-9a-f]{8}-/i.test(aName);
    const bUnnamed = bName === "Unnamed" || bName === "" || /^[0-9a-f]{8}-/i.test(bName);

    if (aUnnamed !== bUnnamed) return aUnnamed ? 1 : -1;

    return localeCompare(aName, bName);
  });
}

// ---- Section name → vanilla store key mapping --------------------------------

/**
 * Maps from section descriptor names (used in fieldCombobox and scanResult.section)
 * to the corresponding key in modStore.vanilla (which uses LSX region_ids).
 * Only needed when section name ≠ region_id.
 */
const SECTION_VANILLA_KEY_MAP: Record<string, string> = {
  TooltipExtras: "TooltipExtraTexts",
};

/**
 * Sections whose entries use a `Text` (TranslatedString) attribute as a loca handle.
 * For these sections, the text_handle should be propagated and used as a display name
 * fallback when the Name field is absent or UUID-like.
 */
const TEXT_HANDLE_SECTIONS = new Set([
  "TooltipExtras",
  "TooltipUpcastDescriptions",
]);

// ---- Generic section option builder ----------------------------------------

export interface BuildSectionOptionsArgs {
  vanillaEntries: VanillaEntryInfo[];
  sectionName: string;
  nodeFilter?: string;
  scanResult: ScanResult | null;
  additionalModResults: ScanResult[];
  additionalModPaths: string[];
  lookupFn?: (handle: string) => string | undefined;
}

/**
 * Generic option builder for section-based comboboxes.
 * Collects UUIDs from vanilla data → scanned mod → additional mods into a
 * de-duplicated, sorted option list.
 */
export function buildSectionOptions(args: BuildSectionOptionsArgs): ComboboxOption[] {
  const { vanillaEntries, sectionName, nodeFilter, scanResult, additionalModResults, additionalModPaths, lookupFn } = args;
  const optMap = new Map<string, ComboboxOption>();

  const useTextHandle = TEXT_HANDLE_SECTIONS.has(sectionName);

  /** Resolve display name, with Text loca fallback for sections like TooltipExtras. */
  function resolveLabel(displayName: string, uuid: string, textHandle?: string): string {
    let dn = resolveDisplayName(displayName, sectionName, lookupFn);
    // For text-handle sections: if dn is UUID-like (no useful Name), try loca text
    if (useTextHandle && /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(dn) && textHandle) {
      const locaText = lookupFn?.(textHandle);
      if (locaText && locaText !== textHandle) dn = locaText;
    }
    return dn;
  }

  /** Extract loca handle from a raw Text attribute value ("handle;version" format). */
  function extractLocaHandle(rawText: string | undefined): string | undefined {
    if (!rawText) return undefined;
    const handle = rawText.split(';')[0];
    return handle || undefined;
  }

  // 1) Vanilla entries
  for (const e of vanillaEntries) {
    if (nodeFilter && e.node_id && e.node_id !== nodeFilter) continue;
    const textHandle = e.text_handle;
    const dn = resolveLabel(e.display_name, e.uuid, textHandle);
    optMap.set(e.uuid, {
      value: e.uuid,
      label: formatComboboxLabel("Vanilla", dn, e.uuid),
      _source: "Vanilla",
      _displayName: dn,
      ...(textHandle ? { _locaHandle: textHandle } : {}),
    });
  }

  // 2) Primary scanned mod
  if (scanResult) {
    const modName = scanResult.mod_meta?.name || "Mod";
    const sec = scanResult.sections.find(s => s.section === sectionName);
    if (sec) {
      for (const e of sec.entries) {
        if (nodeFilter && e.node_id && e.node_id !== nodeFilter) continue;
        const rawText = useTextHandle ? e.raw_attributes?.["Text"] : undefined;
        const textHandle = extractLocaHandle(rawText);
        const dn = resolveLabel(e.display_name, e.uuid, textHandle);
        optMap.set(e.uuid, {
          value: e.uuid,
          label: formatComboboxLabel(modName, dn, e.uuid),
          _source: modName,
          _displayName: dn,
          ...(textHandle ? { _locaHandle: textHandle } : {}),
        });
      }
    }
  }

  // 3) Additional loaded mods
  for (let mi = 0; mi < additionalModResults.length; mi++) {
    const modResult = additionalModResults[mi];
    const modName = modResult.mod_meta?.name || additionalModPaths[mi]?.split(/[\\/]/).pop() || "Mod";
    const sec = modResult.sections.find(s => s.section === sectionName);
    if (sec) {
      for (const e of sec.entries) {
        if (nodeFilter && e.node_id && e.node_id !== nodeFilter) continue;
        if (!optMap.has(e.uuid)) {
          const rawText = useTextHandle ? e.raw_attributes?.["Text"] : undefined;
          const textHandle = extractLocaHandle(rawText);
          const dn = resolveLabel(e.display_name, e.uuid, textHandle);
          optMap.set(e.uuid, {
            value: e.uuid,
            label: formatComboboxLabel(modName, dn, e.uuid),
            _source: modName,
            _displayName: dn,
            ...(textHandle ? { _locaHandle: textHandle } : {}),
          });
        }
      }
    }
  }

  return sortComboboxOptions([...optMap.values()]);
}

// ---- Field combobox resolver -----------------------------------------------

export interface FieldComboboxContext {
  caps: SectionCapabilities;
  vanilla: Record<string, VanillaEntryInfo[]>;
  scanResult: ScanResult | null;
  additionalModResults: ScanResult[];
  additionalModPaths: string[];
  vanillaValueLists: { key: string; values: string[] }[];
  vanillaStatEntries: { name: string; entry_type: string }[];
  modStatEntries: { name: string; entry_type: string }[];
  vanillaEquipment: string[];
  lookupFn?: (handle: string) => string | undefined;
  /** User-authored localization entries from the Localization panel. */
  locaValues?: { contentuid: string; text: string }[];
  /** Vanilla localization map (handle → text) for populating loca comboboxes. */
  localizationMap?: Map<string, string>;
  /** Display name of the primary scanned mod. */
  modName?: string;
}

// ---- Descriptor dispatch table -----------------------------------------------

type DescriptorHandler = (suffix: string, ctx: FieldComboboxContext) => ComboboxOption[];

const DESCRIPTOR_HANDLERS: Record<string, DescriptorHandler> = {
  "section": (suffix, ctx) => {
    const parts = suffix.split(":");
    const sectionName = parts[0];
    const nodeIdFilter = parts[1];
    // Map section name to vanilla store key (region_id). Differs when section name ≠ region_id.
    const vanillaKey = SECTION_VANILLA_KEY_MAP[sectionName] ?? sectionName;
    return buildSectionOptions({
      vanillaEntries: ctx.vanilla[vanillaKey] ?? [],
      sectionName,
      nodeFilter: nodeIdFilter,
      scanResult: ctx.scanResult,
      additionalModResults: ctx.additionalModResults,
      additionalModPaths: ctx.additionalModPaths,
      lookupFn: ctx.lookupFn,
    });
  },
  // multiSection uses the same lookup as section — the 'multi' prefix signals MultiSelectCombobox
  "multiSection": (suffix, ctx) => DESCRIPTOR_HANDLERS["section"](suffix, ctx),
  "valueList": (suffix, ctx) => {
    const list = ctx.vanillaValueLists.find(l => l.key === suffix);
    if (!list) return [];
    // For Ability value lists, map names to their numeric indices (used by SpellCastingAbility/PrimaryAbility)
    if (suffix === "Ability") {
      return list.values.map((v, i) => ({ value: String(i), label: v }));
    }
    return list.values.map(v => ({ value: v, label: v }));
  },
  "static": (suffix) => {
    return suffix.split(",").map(v => {
      const trimmed = v.trim();
      // Support value=label syntax for enum mappings (e.g. "0=AddChildren,1=Prepared")
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const val = trimmed.slice(0, eqIdx);
        const lbl = trimmed.slice(eqIdx + 1);
        return { value: val, label: lbl };
      }
      return { value: trimmed, label: trimmed };
    });
  },
  "multiStatic": (suffix) => {
    return suffix.split(",").map(v => {
      const trimmed = v.trim();
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const val = trimmed.slice(0, eqIdx);
        const lbl = trimmed.slice(eqIdx + 1);
        return { value: val, label: lbl };
      }
      return { value: trimmed, label: trimmed };
    });
  },
  "statType": (suffix, ctx) => {
    const seen = new Set<string>();
    const result: ComboboxOption[] = [];
    for (const e of ctx.vanillaStatEntries) {
      if (e.entry_type === suffix && !seen.has(e.name)) {
        seen.add(e.name);
        result.push({ value: e.name, label: e.name });
      }
    }
    const modLabel = ctx.modName || "Mod";
    for (const e of ctx.modStatEntries) {
      if (e.entry_type === suffix && !seen.has(e.name)) {
        seen.add(e.name);
        result.push({ value: e.name, label: `[${modLabel}] ${e.name}` });
      }
    }
    return result;
  },
  "multiStatType": (suffix, ctx) => {
    const seen = new Set<string>();
    const result: ComboboxOption[] = [];
    for (const e of ctx.vanillaStatEntries) {
      if (e.entry_type === suffix && !seen.has(e.name)) {
        seen.add(e.name);
        result.push({ value: e.name, label: e.name });
      }
    }
    const modLabel = ctx.modName || "Mod";
    for (const e of ctx.modStatEntries) {
      if (e.entry_type === suffix && !seen.has(e.name)) {
        seen.add(e.name);
        result.push({ value: e.name, label: `[${modLabel}] ${e.name}` });
      }
    }
    return result;
  },
  "equipment": (_suffix, ctx) => {
    return ctx.vanillaEquipment.map(name => ({
      value: name,
      label: settingsStore.showModNamePrefix ? `[Vanilla] ${name}` : name,
      _source: "Vanilla",
      _displayName: name,
    }));
  },
  "folder": (suffix, ctx) => {
    const source = ctx.vanilla[suffix] ?? [];
    const opts = source.map(e => {
      const name = resolveDisplayName(e.display_name, undefined, ctx.lookupFn);
      return { value: e.uuid, label: formatComboboxLabel("Vanilla", name, e.uuid), _source: "Vanilla", _displayName: name };
    });
    return sortComboboxOptions(opts);
  },
  "progressionTable": (_suffix, ctx) => {
    const source = ctx.vanilla["ProgressionTables"] ?? [];
    const opts = source.map(e => {
      const dn = resolveDisplayName(e.display_name, undefined, ctx.lookupFn);
      return { value: e.uuid, label: formatComboboxLabel("Vanilla", dn, e.uuid), _source: "Vanilla", _displayName: dn };
    });
    return sortComboboxOptions(opts);
  },
  "voiceTable": (_suffix, ctx) => {
    const source = ctx.vanilla["VoiceTables"] ?? [];
    const opts = source.map(e => {
      const dn = resolveDisplayName(e.display_name, undefined, ctx.lookupFn);
      return { value: e.uuid, label: formatComboboxLabel("Vanilla", dn, e.uuid), _source: "Vanilla", _displayName: dn };
    });
    return sortComboboxOptions(opts);
  },
  "textureFiles": (suffix, ctx) => {
    // suffix = relative path within mod's Public/<ModFolder>/ dir
    // e.g. "Assets/Textures/Icons" lists .dds files from that subfolder
    // TODO: Wire to actual data source — requires a Tauri command that
    //       enumerates DDS/image files (cmd_list_mod_files only covers text files)
    //       and plumbing the results into FieldComboboxContext.
    void suffix;
    void ctx;
    return [];
  },
  "loca": (_suffix, ctx) => {
    const opts: ComboboxOption[] = [];
    const seen = new Set<string>();
    // User-authored localization entries first
    const vals = ctx.locaValues;
    if (vals) {
      for (const v of vals) {
        if (v.contentuid && !seen.has(v.contentuid)) {
          seen.add(v.contentuid);
          opts.push({
            value: v.contentuid,
            label: v.text ? `${v.text}  —  ${v.contentuid}` : v.contentuid,
          });
        }
      }
    }
    // Vanilla localization entries
    const locaMap = ctx.localizationMap;
    if (locaMap) {
      for (const [handle, text] of locaMap) {
        if (!seen.has(handle)) {
          seen.add(handle);
          opts.push({
            value: handle,
            label: text ? `${text}  —  ${handle}` : handle,
          });
        }
      }
    }
    return opts;
  },
};

/**
 * Resolve combobox options for a field based on its fieldCombobox descriptor.
 *   - "section:Races" → vanilla + scanned + additional mods entries
 *   - "valueList:Ability" → from ValueLists.txt
 *   - "static:val1,val2,val3" → static list
 *   - "multiStatic:val1,val2,val3" → multi-select static list (semicolon-delimited storage)
 *   - "statType:SpellData" → stat entries by type
 *   - "multiStatType:SpellData" → multi-select stat entries by type (semicolon-delimited storage)
 *   - "equipment:" → vanilla equipment names
 *   - "folder:X" → vanilla folder entries
 *   - "progressionTable:" → progression table UUIDs
 *   - "voiceTable:" → voice table UUIDs
 *   - "textureFiles:Path" → .dds files from mod subfolder (e.g. "textureFiles:Assets/Textures/Icons")
 *   - "loca:" → user-authored localization contentuid entries
 */
export function getFieldComboboxOptions(fieldKey: string, ctx: FieldComboboxContext): ComboboxOption[] {
  const descriptor = ctx.caps.fieldCombobox?.[fieldKey];
  if (!descriptor) return [];

  const colonIdx = descriptor.indexOf(":");
  const prefix = colonIdx >= 0 ? descriptor.slice(0, colonIdx) : descriptor;
  const suffix = colonIdx >= 0 ? descriptor.slice(colonIdx + 1) : "";

  const handler = DESCRIPTOR_HANDLERS[prefix];
  return handler ? handler(suffix, ctx) : [];
}
