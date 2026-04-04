/**
 * Field-type prefix constants used in the flat prefill-field encoding.
 * Single source of truth — imported by ManualEntryForm, preview pipeline, and fieldCodec.
 */
export const FIELD_PREFIX = {
  Boolean: "Boolean",
  Field: "Field",
  SpellField: "SpellField",
  Selector: "Selector",
  String: "String",
  Child: "Child",
  Tag: "Tag",
  Subclass: "Subclass",
} as const;

export type FieldPrefix = (typeof FIELD_PREFIX)[keyof typeof FIELD_PREFIX];

// ── Key helpers ──────────────────────────────────────────────────────

/** Simple key: `Boolean:fieldName` */
export function simpleKey(prefix: string, name: string): string {
  return `${prefix}:${name}`;
}

/** Indexed sub-key: `Selector:0:Action` */
export function indexedKey(prefix: string, idx: number, subkey: string): string {
  return `${prefix}:${idx}:${subkey}`;
}

// ── Composite key helpers ────────────────────────────────────────────

/** Entry key: `section::entryId` — used for enabled map and override maps. */
export function entryKey(section: string, id: string): string {
  return `${section}::${id}`;
}

/** Field-level override key: `section::entryId::field` */
export function fieldOverrideKey(section: string, entryId: string, field: string): string {
  return `${section}::${entryId}::${field}`;
}

/** Validation error key for field inputs: `field:fieldName` */
export function validationKey(fieldName: string): string {
  return `field:${fieldName}`;
}

/** Project persistence key: `bg3-cmty-project::path` */
export function projectKey(path: string): string {
  return `bg3-cmty-project::${path}`;
}
