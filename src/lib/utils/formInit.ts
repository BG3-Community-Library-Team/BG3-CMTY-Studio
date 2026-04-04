/**
 * Pure logic extracted from ManualEntryForm for initialization and encoding.
 * Enables unit testing without mounting a Svelte component.
 */

import { SECTION_CAPS } from "../data/sectionCaps.js";
import type { SectionCapabilities } from "../data/sectionCaps.js";
import type { SelectorParamValues } from "../data/selectorDefs.js";
import type { VanillaEntryInfo } from "../types/index.js";
import {
  decodeBooleans, decodeFields, decodeSpellFields,
  decodeSelectors, decodeStrings, decodeChildren, decodeTags, decodeSubclasses,
  encodeBooleans, encodeFields, encodeSpellFields,
  encodeSelectors, encodeStrings, encodeChildren, encodeTags, encodeSubclasses,
  normalizeUuids,
} from "./fieldCodec.js";

export interface FormState {
  uuids: string[];
  displayName: string;
  booleans: { key: string; value: boolean }[];
  fields: { key: string; value: string }[];
  selectors: {
    action: string; fn: string; selectorUuid: string; overwrite: boolean; modGuid: string;
    isReplace: boolean;
    params: SelectorParamValues;
  }[];
  strings: { action: string; type: string; values: string; modGuid: string }[];
  children: { type: string; values: string[]; action: string; modGuid: string }[];
  tags: { uuids: string[]; action: string; type: string; modGuid: string }[];
  subclasses: { uuid: string; action: string; modGuid: string }[];
  listAction: string;
  listType: string;
  listItems: string;
  listInheritList: string[];
  listExcludeList: string[];
  spellAction: string;
  spellFields: { key: string; value: string }[];
  argDefinitionsList: string[];
  argAction: string;
  blacklist: boolean;
  modGuid: string;
  comment: string;
}

export interface BuildFormStateInput {
  prefill: Record<string, string> | null;
  section: string;
  rawAttributes?: Record<string, string> | null;
  entryFilter?: { field: string; value: string };
  editComment?: string;
  /** Vanilla Lists entries for list type detection */
  vanillaLists?: VanillaEntryInfo[];
  /** Scan result sections for list type detection fallback */
  scanSections?: { section: string; entries: { uuid: string; node_id?: string }[] }[];
  /** Pass editIndex to enable auto-UUID generation for new entries (default: -1). */
  editIndex?: number;
  /** If set, this is an auto-entry override — not a new entry. */
  autoEntryId?: string | null;
  /** UUID generator function (e.g. crypto-based). Called for new non-spell entries with no UUID. */
  generateUuid?: () => string;
}

/**
 * Build structured form state from a prefill Record.
 * Pure function — no store or component dependencies.
 */
export function buildFormState(input: BuildFormStateInput): FormState {
  const { prefill: pf, section, rawAttributes, entryFilter, editComment = "", vanillaLists, scanSections } = input;

  const raw = pf?.UUID ?? pf?.UUIDs ?? pf?.StatID ?? "";
  let parts: string[];
  if (!raw) {
    parts = [""];
  } else {
    parts = raw.includes("|")
      ? raw.split("|").map(s => s.trim()).filter(Boolean)
      : raw.split(";").map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) parts = [""];
  }

  const s: FormState = {
    uuids: parts,
    displayName: pf?._entryLabel ?? pf?.EntryName ?? "",
    booleans: [],
    fields: [],
    selectors: [],
    strings: [],
    children: [],
    tags: [],
    subclasses: [],
    listAction: "Insert",
    listType: "SpellList",
    listItems: "",
    listInheritList: [],
    listExcludeList: [],
    spellAction: "Insert",
    spellFields: [],
    argDefinitionsList: [],
    argAction: "Insert",
    blacklist: false,
    modGuid: "",
    comment: editComment,
  };

  if (pf) {
    if (pf["Action"]) { s.listAction = pf["Action"]; s.argAction = pf["Action"]; s.spellAction = pf["Action"]; }
    if (pf["Type"]) s.listType = pf["Type"];
    if (pf["Items"]) s.listItems = pf["Items"];
    if (pf["modGuid"]) s.modGuid = pf["modGuid"];
    if (pf["Inherit"]) s.listInheritList = pf["Inherit"].split(";").map(x => x.trim()).filter(Boolean);
    if (pf["Exclude"]) s.listExcludeList = pf["Exclude"].split(";").map(x => x.trim()).filter(Boolean);
    if (pf["Definitions"]) s.argDefinitionsList = pf["Definitions"].split(";").map(x => x.trim()).filter(Boolean);
    if (pf["Blacklist"]) s.blacklist = pf["Blacklist"] === "true";

    s.booleans = decodeBooleans(pf);
    s.fields = decodeFields(pf);
    s.spellFields = decodeSpellFields(pf);
    s.selectors = decodeSelectors(pf);
    s.strings = decodeStrings(pf);
    s.children = decodeChildren(pf);
    s.tags = decodeTags(pf);
    s.subclasses = decodeSubclasses(pf);
  }

  // Pre-populate section-defined field slots
  const caps = SECTION_CAPS[section];
  if (caps) {
    if (caps.booleanKeys) {
      const used = new Set(s.booleans.map(b => b.key));
      for (const key of caps.booleanKeys) {
        if (!used.has(key)) {
          const rawVal = rawAttributes?.[key];
          const defaultVal = (!rawVal && key === "IsHenchman" && entryFilter?.field === "IsHenchman")
            ? entryFilter.value === "true"
            : rawVal === "true";
          s.booleans.push({ key, value: defaultVal });
        }
      }
    }
    if (caps.fieldKeys) {
      const used = new Set(s.fields.map(f => f.key));
      for (const key of caps.fieldKeys) {
        if (!used.has(key)) {
          const rawVal = rawAttributes?.[key] ?? "";
          s.fields.push({ key, value: rawVal });
        }
      }
    }
    if (caps.stringTypes) {
      const used = new Set(s.strings.map(st => st.type));
      for (const type of caps.stringTypes) {
        if (!used.has(type)) s.strings.push({ action: "Insert", type, values: "", modGuid: "" });
      }
    }
    if (caps.childTypes) {
      const used = new Set(s.children.map(ch => ch.type));
      for (const type of caps.childTypes) {
        if (!used.has(type)) s.children.push({ type, values: [], action: "Insert", modGuid: "" });
      }
    }
    if (caps.tagTypes) {
      const used = new Set(s.tags.map(t => t.type));
      for (const type of caps.tagTypes) {
        if (!used.has(type)) s.tags.push({ uuids: [], action: "Insert", type, modGuid: "" });
      }
    }
  }

  // Auto-generate UUID for new non-spell entries that have no UUID
  const isNew = (input.editIndex ?? -1) === -1 && !input.autoEntryId;
  const isSpell = !!(caps as any)?.isSpell;
  if (isNew && !isSpell && input.generateUuid && (!s.uuids[0] || s.uuids[0] === '')) {
    s.uuids = [input.generateUuid()];
  }

  // List type detection
  if (section === "Lists") {
    if (entryFilter?.field === "node_id" && entryFilter.value) {
      s.listType = entryFilter.value;
    } else if (!pf?.["Type"] && s.uuids[0]) {
      const uuid = s.uuids[0].toLowerCase();
      const vanillaMatch = vanillaLists?.find(e => e.uuid.toLowerCase() === uuid);
      if (vanillaMatch?.node_id) {
        s.listType = vanillaMatch.node_id;
      } else if (scanSections) {
        const listSection = scanSections.find(sec => sec.section === "Lists");
        if (listSection) {
          const scanMatch = listSection.entries.find(e => e.uuid.toLowerCase() === uuid);
          if (scanMatch?.node_id) {
            s.listType = scanMatch.node_id;
          }
        }
      }
    }
  }

  return s;
}

export interface EncodeFormStateInput {
  caps: SectionCapabilities;
  uuids: string[];
  displayName: string;
  booleans: { key: string; value: boolean }[];
  fields: { key: string; value: string }[];
  selectors: FormState["selectors"];
  strings: FormState["strings"];
  children: FormState["children"];
  tags: FormState["tags"];
  subclasses: FormState["subclasses"];
  spellFields: FormState["spellFields"];
  listType: string;
  listItems: string;
  listInheritList: string[];
  listExcludeList: string[];
  argDefinitionsList: string[];
  modGuid: string;
  blacklist: boolean;
  selectedNodeType: string;
}

/**
 * Encode structured form state back into a flat Record for configStore.
 * Pure function — no store or component dependencies.
 */
export function encodeFormState(input: EncodeFormStateInput): Record<string, string> {
  const result: Record<string, string> = {};
  const { caps } = input;

  if (caps.isSpell) {
    if (input.displayName.trim()) result["EntryName"] = input.displayName.trim();
  } else if (caps.isList) {
    const { uuid, isArray } = normalizeUuids(input.uuids);
    if (uuid) result["UUID"] = uuid;
    if (isArray) result["_uuidIsArray"] = "true";
    if (input.displayName.trim()) result["_entryLabel"] = input.displayName.trim();
    result["Type"] = input.listType;
    if (input.listItems.trim()) result["Items"] = input.listItems.trim();
    if (input.listInheritList.length > 0) result["Inherit"] = input.listInheritList.join(";");
    if (input.listExcludeList.length > 0) result["Exclude"] = input.listExcludeList.join(";");
    if (input.modGuid.trim()) result["modGuid"] = input.modGuid.trim();
  } else if (caps.isARG) {
    const { uuid, isArray } = normalizeUuids(input.uuids);
    if (uuid) result["UUID"] = uuid;
    if (isArray) result["_uuidIsArray"] = "true";
    if (input.displayName.trim()) result["_entryLabel"] = input.displayName.trim();
    if (input.argDefinitionsList.length > 0) result["Definitions"] = input.argDefinitionsList.join(";");
  } else {
    const { uuid, isArray } = normalizeUuids(input.uuids);
    if (uuid) result["UUID"] = uuid;
    if (isArray) result["_uuidIsArray"] = "true";
    if (input.displayName.trim()) result["_entryLabel"] = input.displayName.trim();
  }

  if (input.modGuid.trim() && !caps.isList) result["modGuid"] = input.modGuid.trim();

  encodeBooleans(input.booleans, result);
  encodeFields(input.fields, result);
  encodeSelectors(input.selectors, result);
  encodeStrings(input.strings, result);
  encodeChildren(input.children, result);
  encodeTags(input.tags, result);
  encodeSubclasses(input.subclasses, result);
  encodeSpellFields(input.spellFields, result);

  if (caps.hasBlacklist && input.blacklist) {
    result["Blacklist"] = "true";
  }

  if (input.selectedNodeType) result["_nodeType"] = input.selectedNodeType;

  return result;
}
