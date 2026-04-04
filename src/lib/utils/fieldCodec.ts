/**
 * Shared encode/decode helpers for the flat prefill-field format.
 * Eliminates duplication across ManualEntryForm decoders/encoders and preview.ts.
 *
 * AIP-06/07: Indexed codec functions replace 10 copy-paste decoder/encoder functions.
 */
import { FIELD_PREFIX, simpleKey, indexedKey } from "../data/fieldKeys.js";
import { SELECTOR_PARAMS_BY_FN, type SelectorParamValues } from "../data/selectorDefs.js";

// ── Simple (non-indexed) codec ──────────────────────────────────────

export interface SimpleField {
  key: string;
  value: string;
}

/**
 * Decode all entries matching a simple prefix (`Prefix:keyName` = value).
 * Works for Boolean, Field, and SpellField types.
 */
export function decodeSimpleFields(
  pf: Record<string, string>,
  prefix: string,
): SimpleField[] {
  const tag = `${prefix}:`;
  const result: SimpleField[] = [];
  for (const [k, v] of Object.entries(pf)) {
    if (k.startsWith(tag)) result.push({ key: k.slice(tag.length), value: v });
  }
  return result;
}

/**
 * Encode an array of simple key/value pairs under the given prefix.
 * Skips entries with empty key (or empty value when `requireValue` is true).
 */
export function encodeSimpleFields(
  items: SimpleField[],
  prefix: string,
  result: Record<string, string>,
  requireValue = false,
): void {
  for (const f of items) {
    const k = f.key.trim();
    const v = f.value.trim();
    if (!k) continue;
    if (requireValue && !v) continue;
    result[simpleKey(prefix, k)] = v;
  }
}

// ── Convenience wrappers matching the original ManualEntryForm API ──

export function decodeBooleans(pf: Record<string, string>): { key: string; value: boolean }[] {
  return decodeSimpleFields(pf, FIELD_PREFIX.Boolean).map(f => ({
    key: f.key,
    value: f.value === "true",
  }));
}

export function decodeFields(pf: Record<string, string>): SimpleField[] {
  return decodeSimpleFields(pf, FIELD_PREFIX.Field);
}

export function decodeSpellFields(pf: Record<string, string>): SimpleField[] {
  return decodeSimpleFields(pf, FIELD_PREFIX.SpellField);
}

export function encodeBooleans(
  items: { key: string; value: boolean }[],
  result: Record<string, string>,
): void {
  for (const b of items) {
    const k = b.key.trim();
    if (k) result[simpleKey(FIELD_PREFIX.Boolean, k)] = String(b.value);
  }
}

export function encodeFields(
  items: SimpleField[],
  result: Record<string, string>,
): void {
  encodeSimpleFields(items, FIELD_PREFIX.Field, result, true);
}

export function encodeSpellFields(
  items: SimpleField[],
  result: Record<string, string>,
): void {
  encodeSimpleFields(items, FIELD_PREFIX.SpellField, result, true);
}

// ── Indexed codec (AIP-06 / AIP-07) ────────────────────────────────
// Generic factory helpers that replace 10 duplicated decode/encode functions.

/**
 * Extract unique sorted indices from flat keys matching `Prefix:N:TriggerField`.
 */
function getIndices(pf: Record<string, string>, prefix: string, trigger: string): string[] {
  const re = new RegExp(`^${prefix}:(\\d+):${trigger}$`);
  const seen = new Set<string>();
  for (const k of Object.keys(pf)) {
    const m = k.match(re);
    if (m) seen.add(m[1]);
  }
  return [...seen].sort((a, b) => Number(a) - Number(b));
}

/** Read an indexed sub-key, defaulting to "" if missing. */
function ival(pf: Record<string, string>, prefix: string, idx: string, subkey: string): string {
  return pf[`${prefix}:${idx}:${subkey}`] ?? "";
}

// ── Selector types ──

export interface SelectorItem {
  action: string;
  fn: string;
  selectorUuid: string;
  overwrite: boolean;
  modGuid: string;
  isReplace: boolean;
  params: SelectorParamValues;
}

const PARAM_KEYS: (keyof SelectorParamValues)[] = [
  "Guid", "Amount", "SwapAmount", "SelectorId", "CastingAbility",
  "ActionResource", "PrepareType", "CooldownType", "BonusType", "Amounts", "LimitToProficiency",
];

export function decodeSelectors(pf: Record<string, string>): SelectorItem[] {
  return getIndices(pf, FIELD_PREFIX.Selector, "Action").map((idx) => {
    const params = {} as SelectorParamValues;
    for (const pk of PARAM_KEYS) params[pk] = ival(pf, FIELD_PREFIX.Selector, idx, `Param:${pk}`);
    return {
      action: ival(pf, FIELD_PREFIX.Selector, idx, "Action"),
      fn: ival(pf, FIELD_PREFIX.Selector, idx, "Function"),
      selectorUuid: ival(pf, FIELD_PREFIX.Selector, idx, "UUID"),
      overwrite: ival(pf, FIELD_PREFIX.Selector, idx, "Overwrite") === "true",
      modGuid: ival(pf, FIELD_PREFIX.Selector, idx, "modGuid"),
      isReplace: ival(pf, FIELD_PREFIX.Selector, idx, "IsReplace") === "true",
      params,
    };
  });
}

export function encodeSelectors(items: SelectorItem[], result: Record<string, string>): void {
  for (let i = 0; i < items.length; i++) {
    const s = items[i];
    if (!s.fn.trim()) continue;
    result[indexedKey(FIELD_PREFIX.Selector, i, "Action")] = s.action;
    const outputFn = s.fn.trim() === "SelectPassives" && s.isReplace ? "ReplacePassives" : s.fn.trim();
    result[indexedKey(FIELD_PREFIX.Selector, i, "Function")] = outputFn;
    if (s.selectorUuid.trim()) result[indexedKey(FIELD_PREFIX.Selector, i, "UUID")] = s.selectorUuid.trim();
    if (s.overwrite) result[indexedKey(FIELD_PREFIX.Selector, i, "Overwrite")] = "true";
    if (s.isReplace) result[indexedKey(FIELD_PREFIX.Selector, i, "IsReplace")] = "true";
    if (s.modGuid.trim()) result[indexedKey(FIELD_PREFIX.Selector, i, "modGuid")] = s.modGuid.trim();
    const relevantParams = SELECTOR_PARAMS_BY_FN[s.fn.trim()] ?? [];
    for (const pk of relevantParams) {
      const pv = s.params[pk as keyof SelectorParamValues];
      if (pv?.trim()) result[indexedKey(FIELD_PREFIX.Selector, i, `Param:${pk}`)] = pv.trim();
    }
  }
}

// ── String types ──

export interface StringItem {
  action: string;
  type: string;
  values: string;
  modGuid: string;
}

export function decodeStrings(pf: Record<string, string>): StringItem[] {
  return getIndices(pf, FIELD_PREFIX.String, "Action").map((idx) => ({
    action: ival(pf, FIELD_PREFIX.String, idx, "Action"),
    type: ival(pf, FIELD_PREFIX.String, idx, "Type") || "Boosts",
    values: ival(pf, FIELD_PREFIX.String, idx, "Values"),
    modGuid: ival(pf, FIELD_PREFIX.String, idx, "modGuid"),
  }));
}

export function encodeStrings(items: StringItem[], result: Record<string, string>): void {
  for (let i = 0; i < items.length; i++) {
    const s = items[i];
    if (!s.values.trim()) continue;
    result[indexedKey(FIELD_PREFIX.String, i, "Action")] = s.action;
    result[indexedKey(FIELD_PREFIX.String, i, "Type")] = s.type;
    result[indexedKey(FIELD_PREFIX.String, i, "Values")] = s.values.trim();
    if (s.modGuid.trim()) result[indexedKey(FIELD_PREFIX.String, i, "modGuid")] = s.modGuid.trim();
  }
}

// ── Children types ──

export interface ChildItem {
  type: string;
  values: string[];
  action: string;
  modGuid: string;
}

export function decodeChildren(pf: Record<string, string>): ChildItem[] {
  const raw = getIndices(pf, FIELD_PREFIX.Child, "Type").map((idx) => {
    const rawVals = ival(pf, FIELD_PREFIX.Child, idx, "Values");
    return {
      type: ival(pf, FIELD_PREFIX.Child, idx, "Type"),
      values: rawVals ? rawVals.split(";").map(x => x.trim()).filter(Boolean) : [],
      action: ival(pf, FIELD_PREFIX.Child, idx, "Action") || "Insert",
      modGuid: ival(pf, FIELD_PREFIX.Child, idx, "modGuid"),
    };
  });
  // Condense children with the same type+action into a single row
  const merged = new Map<string, ChildItem>();
  for (const c of raw) {
    const key = `${c.type}|${c.action}`;
    const existing = merged.get(key);
    if (existing) {
      for (const v of c.values) {
        if (!existing.values.includes(v)) existing.values.push(v);
      }
    } else {
      merged.set(key, { ...c, values: [...c.values] });
    }
  }
  return Array.from(merged.values());
}

export function encodeChildren(items: ChildItem[], result: Record<string, string>): void {
  for (let i = 0; i < items.length; i++) {
    const c = items[i];
    if (c.values.length === 0) continue;
    result[indexedKey(FIELD_PREFIX.Child, i, "Type")] = c.type;
    result[indexedKey(FIELD_PREFIX.Child, i, "Values")] = c.values.join(";");
    result[indexedKey(FIELD_PREFIX.Child, i, "Action")] = c.action;
    if (c.modGuid.trim()) result[indexedKey(FIELD_PREFIX.Child, i, "modGuid")] = c.modGuid.trim();
  }
}

// ── Tag types ──

export interface TagItem {
  uuids: string[];
  action: string;
  type: string;
  modGuid: string;
}

export function decodeTags(pf: Record<string, string>): TagItem[] {
  return getIndices(pf, FIELD_PREFIX.Tag, "Action").map((idx) => {
    const rawTagUuids = ival(pf, FIELD_PREFIX.Tag, idx, "UUIDs");
    return {
      uuids: rawTagUuids ? rawTagUuids.split(";").map(x => x.trim()).filter(Boolean) : [],
      action: ival(pf, FIELD_PREFIX.Tag, idx, "Action"),
      type: ival(pf, FIELD_PREFIX.Tag, idx, "Type") || "Tags",
      modGuid: ival(pf, FIELD_PREFIX.Tag, idx, "modGuid"),
    };
  });
}

export function encodeTags(items: TagItem[], result: Record<string, string>): void {
  for (let i = 0; i < items.length; i++) {
    const t = items[i];
    if (t.uuids.length === 0) continue;
    result[indexedKey(FIELD_PREFIX.Tag, i, "UUIDs")] = t.uuids.join(";");
    result[indexedKey(FIELD_PREFIX.Tag, i, "Action")] = t.action;
    result[indexedKey(FIELD_PREFIX.Tag, i, "Type")] = t.type;
    if (t.modGuid.trim()) result[indexedKey(FIELD_PREFIX.Tag, i, "modGuid")] = t.modGuid.trim();
  }
}

// ── Subclass types ──

export interface SubclassItem {
  uuid: string;
  action: string;
  modGuid: string;
}

export function decodeSubclasses(pf: Record<string, string>): SubclassItem[] {
  return getIndices(pf, FIELD_PREFIX.Subclass, "UUID").map((idx) => ({
    uuid: ival(pf, FIELD_PREFIX.Subclass, idx, "UUID"),
    action: ival(pf, FIELD_PREFIX.Subclass, idx, "Action") || "Remove",
    modGuid: ival(pf, FIELD_PREFIX.Subclass, idx, "modGuid"),
  }));
}

export function encodeSubclasses(items: SubclassItem[], result: Record<string, string>): void {
  for (let i = 0; i < items.length; i++) {
    const s = items[i];
    if (!s.uuid.trim()) continue;
    result[indexedKey(FIELD_PREFIX.Subclass, i, "Action")] = s.action;
    result[indexedKey(FIELD_PREFIX.Subclass, i, "UUID")] = s.uuid.trim();
    if (s.modGuid.trim()) result[indexedKey(FIELD_PREFIX.Subclass, i, "modGuid")] = s.modGuid.trim();
  }
}

// ── Utility functions extracted from ManualEntryForm ──

/** Normalize a multi-UUID array into a pipe-separated string and array flag. */
export function normalizeUuids(rawUuids: string[]): { uuid: string; isArray: boolean } {
  const clean = rawUuids.map(s => s.trim()).filter(Boolean);
  if (clean.length > 1) return { uuid: clean.join("|"), isArray: true };
  return { uuid: clean[0] ?? "", isArray: false };
}

/** Convert CSS #RRGGBB to BG3's #AARRGGBB format (fully opaque). */
export function cssToBg3Color(css: string): string {
  const hex = css.replace('#', '');
  if (hex.length === 6) return `#ff${hex}`;
  return css;
}

/** Convert BG3's #AARRGGBB to CSS #RRGGBB (drop alpha for color picker). */
export function bg3ToCssColor(bg3: string): string {
  const hex = bg3.replace('#', '');
  if (hex.length === 8) return `#${hex.slice(2)}`;
  return bg3;
}
