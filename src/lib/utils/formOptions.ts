/**
 * Pure computation functions for ManualEntryForm combobox options, validation, etc.
 * Extracted from ManualEntryForm.svelte to reduce component script size.
 */

import { CHILD_TYPE_SOURCE } from "../data/childTypes.js";
import { validationKey } from "../data/fieldKeys.js";
import { resolveDisplayName, type ComboboxOption } from "./comboboxOptions.js";
import type { VanillaEntryInfo } from "../types/index.js";
import type { SectionCapabilities } from "../data/sectionCaps.js";

// ----- Scan result types (minimal for what we need) -----

interface ScanEntry {
  uuid: string;
  display_name?: string;
  changes: { field?: string }[];
  raw_children?: Record<string, string[]>;
}

interface ScanSection {
  section: string;
  entries: ScanEntry[];
}

interface ScanResult {
  sections: ScanSection[];
}

// ----- Spell options -----

export function computeSpellIdOptions(
  scanResult: ScanResult | null,
  additionalModResults: ScanResult[],
): ComboboxOption[] {
  const optMap = new Map<string, ComboboxOption>();
  if (scanResult) {
    const spellSection = scanResult.sections.find(s => s.section === "Spells");
    if (spellSection) {
      for (const e of spellSection.entries) {
        optMap.set(e.uuid, { value: e.uuid, label: e.display_name ? `${e.display_name} (${e.uuid})` : e.uuid });
      }
    }
  }
  for (const modResult of additionalModResults) {
    const spellSection = modResult.sections.find(s => s.section === "Spells");
    if (spellSection) {
      for (const e of spellSection.entries) {
        if (!optMap.has(e.uuid)) {
          optMap.set(e.uuid, { value: e.uuid, label: e.display_name ? `${e.display_name} (${e.uuid})` : e.uuid });
        }
      }
    }
  }
  return [...optMap.values()];
}

export function computeSpellFieldKeys(
  vanillaStatFieldNames: string[],
  scanResult: ScanResult | null,
  additionalModResults: ScanResult[],
): string[] {
  const keySet = new Set<string>();
  for (const name of vanillaStatFieldNames) {
    keySet.add(name);
  }
  if (scanResult) {
    const spellSection = scanResult.sections.find(s => s.section === "Spells");
    if (spellSection) {
      for (const e of spellSection.entries) {
        for (const change of e.changes) {
          if (change.field) keySet.add(change.field);
        }
      }
    }
  }
  for (const modResult of additionalModResults) {
    const spellSection = modResult.sections.find(s => s.section === "Spells");
    if (spellSection) {
      for (const e of spellSection.entries) {
        for (const change of e.changes) {
          if (change.field) keySet.add(change.field);
        }
      }
    }
  }
  return [...keySet].sort();
}

export function combinedSpellIdOptions(
  vanillaSpellIds: ComboboxOption[],
  spellIdOptions: ComboboxOption[],
): ComboboxOption[] {
  const optMap = new Map<string, ComboboxOption>();
  for (const opt of vanillaSpellIds) optMap.set(opt.value, opt);
  for (const opt of spellIdOptions) {
    if (!optMap.has(opt.value)) optMap.set(opt.value, opt);
  }
  return [...optMap.values()];
}

// ----- List options -----

export function getListItemsPlaceholder(listType: string): string {
  switch (listType) {
    case "SpellList": return "Spell ID 1;Spell ID 2";
    case "PassiveList": return "Passive ID 1;Passive ID 2";
    case "SkillList": return "Skill ID 1;Skill ID 2";
    case "AbilityList": return "Ability ID 1;Ability ID 2";
    case "EquipmentList": return "Equipment ID 1;Equipment ID 2";
    default: return "StatID1;StatID2";
  }
}

export function getListItemsLabel(listType: string): string {
  switch (listType) {
    case "SpellList": return "Spells";
    case "PassiveList": return "Passives";
    case "SkillList": return "Skills";
    case "AbilityList": return "Abilities";
    case "EquipmentList": return "Equipment";
    default: return "Items";
  }
}

export function computeListItemsOptions(
  listType: string,
  vanillaStatEntries: { name: string; entry_type: string }[],
  vanillaValueLists: { key: string; values: string[] }[],
  modStatEntries: { name: string; entry_type: string }[] = [],
  modName: string = "Mod",
): ComboboxOption[] {
  /** Merge vanilla + mod entries for a given stat type, deduplicating by name. */
  function mergedStatOptions(entryType: string, labelFn?: (e: { name: string }, isMod: boolean) => string): ComboboxOption[] {
    const seen = new Set<string>();
    const result: ComboboxOption[] = [];
    for (const e of vanillaStatEntries) {
      if (e.entry_type === entryType && !seen.has(e.name)) {
        seen.add(e.name);
        result.push({ value: e.name, label: labelFn ? labelFn(e, false) : e.name });
      }
    }
    for (const e of modStatEntries) {
      if (e.entry_type === entryType && !seen.has(e.name)) {
        seen.add(e.name);
        result.push({ value: e.name, label: labelFn ? labelFn(e, true) : `[${modName}] ${e.name}` });
      }
    }
    return result;
  }

  switch (listType) {
    case "SpellList":
      return mergedStatOptions("SpellData");
    case "PassiveList":
      return mergedStatOptions("PassiveData");
    case "EquipmentList": {
      const seen = new Set<string>();
      const result: ComboboxOption[] = [];
      for (const e of vanillaStatEntries) {
        if (["Armor", "Weapon", "Object"].includes(e.entry_type) && !seen.has(e.name)) {
          seen.add(e.name);
          result.push({ value: e.name, label: `[${e.entry_type}] ${e.name}` });
        }
      }
      for (const e of modStatEntries) {
        if (["Armor", "Weapon", "Object"].includes(e.entry_type) && !seen.has(e.name)) {
          seen.add(e.name);
          result.push({ value: e.name, label: `[${modName}] [${e.entry_type}] ${e.name}` });
        }
      }
      return result;
    }
    case "SkillList": {
      const list = vanillaValueLists.find(l => l.key === "Skill");
      return list ? list.values.map(v => ({ value: v, label: v })) : [];
    }
    case "AbilityList": {
      const list = vanillaValueLists.find(l => l.key === "Ability");
      return list ? list.values.map(v => ({ value: v, label: v })) : [];
    }
    default:
      return [];
  }
}

// ----- Child / tag options -----

export function computeChildValueOptions(
  childType: string,
  vanilla: Record<string, VanillaEntryInfo[]>,
  scanResult: ScanResult | null,
  additionalModResults: ScanResult[],
  lookupLocalizedString: (handle: string) => string | undefined,
): ComboboxOption[] {
  const config = CHILD_TYPE_SOURCE[childType];
  if (!config) return []; // Unknown child type — no predefined options (user can still paste UUIDs)
  const optMap = new Map<string, ComboboxOption>();

  let source: VanillaEntryInfo[] = [];
  switch (config.store) {
    case "ccpresets":
      source = config.nodeFilter
        ? (vanilla.CharacterCreationPresets ?? []).filter(e => e.node_id === config.nodeFilter)
        : (vanilla.CharacterCreationPresets ?? []);
      break;
    case "cc":
      source = config.nodeFilter
        ? (vanilla.CharacterCreation ?? []).filter(e => e.node_id === config.nodeFilter)
        : (vanilla.CharacterCreation ?? []);
      break;
    case "color": source = vanilla.ColorDefinitions ?? []; break;
    case "god": source = vanilla.Gods ?? []; break;
    case "tag": source = vanilla.Tags ?? []; break;
    case "classdescription": source = vanilla.ClassDescriptions ?? []; break;
    case "visual":
      source = vanilla.Visuals ?? [];
      break;
  }

  for (const e of source) {
    optMap.set(e.uuid, { value: e.uuid, label: `[${resolveDisplayName(e.display_name, undefined, (h) => lookupLocalizedString(h))}] ${e.uuid}`, color: e.color });
  }

  if (scanResult) {
    const racesSection = scanResult.sections.find(s => s.section === "Races");
    if (racesSection) {
      for (const e of racesSection.entries) {
        if (e.raw_children?.[childType]) {
          for (const guid of e.raw_children[childType]) {
            if (!optMap.has(guid)) optMap.set(guid, { value: guid, label: guid });
          }
        }
      }
    }
  }

  for (const modResult of additionalModResults) {
    const racesSection = modResult.sections.find(s => s.section === "Races");
    if (racesSection) {
      for (const e of racesSection.entries) {
        if (e.raw_children?.[childType]) {
          for (const guid of e.raw_children[childType]) {
            if (!optMap.has(guid)) optMap.set(guid, { value: guid, label: guid });
          }
        }
      }
    }
  }

  return [...optMap.values()];
}

export function computeTagValueOptions(
  vanillaTags: VanillaEntryInfo[],
  scanResult: ScanResult | null,
  additionalModResults: ScanResult[],
  lookupLocalizedString: (handle: string) => string | undefined,
): ComboboxOption[] {
  const optMap = new Map<string, ComboboxOption>();
  for (const e of vanillaTags) {
    optMap.set(e.uuid, { value: e.uuid, label: `[${resolveDisplayName(e.display_name, undefined, (h) => lookupLocalizedString(h))}] ${e.uuid}` });
  }
  if (scanResult) {
    for (const sec of scanResult.sections) {
      for (const e of sec.entries) {
        if (e.raw_children) {
          for (const group of ["Tags", "ReallyTags", "AppearanceTags"]) {
            if (e.raw_children[group]) {
              for (const guid of e.raw_children[group]) {
                if (!optMap.has(guid)) optMap.set(guid, { value: guid, label: guid });
              }
            }
          }
        }
      }
    }
  }
  for (const modResult of additionalModResults) {
    for (const sec of modResult.sections) {
      for (const e of sec.entries) {
        if (e.raw_children) {
          for (const group of ["Tags", "ReallyTags", "AppearanceTags"]) {
            if (e.raw_children[group]) {
              for (const guid of e.raw_children[group]) {
                if (!optMap.has(guid)) optMap.set(guid, { value: guid, label: guid });
              }
            }
          }
        }
      }
    }
  }
  return [...optMap.values()];
}

export function computeReallyTagValueOptions(vanillaTags: VanillaEntryInfo[]): ComboboxOption[] {
  const optMap = new Map<string, ComboboxOption>();
  for (const e of vanillaTags) {
    if (e.display_name?.toUpperCase().startsWith("REALLY_")) {
      optMap.set(e.uuid, { value: e.uuid, label: `[${e.display_name}] ${e.uuid}` });
    }
  }
  return [...optMap.values()];
}

// ----- Validation -----

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ValidationError {
  key: string;
  message: string;
  severity: "error" | "warning";
}

export function computeValidationErrors(params: {
  caps: SectionCapabilities;
  uuids: string[];
  section: string;
  fields: { key: string; value: string }[];
  vanillaSections: Record<string, VanillaEntryInfo[]>;
}): ValidationError[] {
  const { caps, uuids, section, fields, vanillaSections } = params;
  const errors: ValidationError[] = [];

  if (!caps.isSpell) {
    for (let i = 0; i < uuids.length; i++) {
      const u = uuids[i].trim();
      if (u && !UUID_RE.test(u)) {
        errors.push({ key: `uuid:${i}`, message: `UUID ${i + 1} is not a valid UUID format`, severity: "warning" });
      }
    }
  }

  // Cross-section UUID conflict detection (root-level entries only)
  if (!caps.isSpell && !caps.isList && !caps.isARG) {
    const enteredUuid = uuids[0]?.trim().toLowerCase();
    if (enteredUuid && UUID_RE.test(enteredUuid)) {
      const SECTION_TO_VANILLA: Record<string, string> = {
        Progressions: "Progressions", Races: "Races", Feats: "Feats",
        Origins: "Origins", Backgrounds: "Backgrounds", BackgroundGoals: "BackgroundGoals",
        ActionResources: "ActionResources", ActionResourceGroups: "ActionResourceGroups",
        ClassDescriptions: "ClassDescriptions", Lists: "Lists",
      };
      for (const [sec, cat] of Object.entries(SECTION_TO_VANILLA)) {
        if (sec === section) continue;
        const vanillaEntries = vanillaSections[cat];
        if (vanillaEntries?.some(e => e.uuid.toLowerCase() === enteredUuid)) {
          errors.push({ key: "uuid:cross", message: `UUID exists in ${sec} — using it in ${section} will cause data type conflicts`, severity: "error" });
          break;
        }
      }
      const sameEntries = vanillaSections[SECTION_TO_VANILLA[section] ?? ""];
      if (sameEntries?.some(e => e.uuid.toLowerCase() === enteredUuid)) {
        errors.push({ key: "uuid:exists", message: "This UUID already exists in vanilla — your config will override it", severity: "warning" });
      }
    }
  }

  if (caps.hasFields && caps.fieldTypes) {
    for (const f of fields) {
      const expectedType = caps.fieldTypes[f.key];
      if (!expectedType || !f.value.trim()) continue;
      if (expectedType === "int" && !/^-?\d+$/.test(f.value.trim())) {
        errors.push({ key: validationKey(f.key), message: `"${f.key}" expects ${expectedType} but got "${f.value}"`, severity: "error" });
      }
      if (expectedType === "bool" && !["true", "false"].includes(f.value.trim().toLowerCase())) {
        errors.push({ key: validationKey(f.key), message: `"${f.key}" expects ${expectedType} but got "${f.value}"`, severity: "error" });
      }
      if (expectedType === "string (UUID)" && f.value.trim() && !UUID_RE.test(f.value.trim())) {
        errors.push({ key: validationKey(f.key), message: `"${f.key}" expects a UUID but got "${f.value}"`, severity: "warning" });
      }
    }
  }

  return errors;
}
