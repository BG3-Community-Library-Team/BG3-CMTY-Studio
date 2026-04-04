/**
 * Parse an existing CompatibilityFrameworkConfig (YAML or JSON) into
 * ManualEntry objects suitable for display in the section panels.
 *
 * Uses the `yaml` npm package (v2.x) for robust YAML parsing with full
 * spec compliance including anchor/alias resolution, comment stripping,
 * multi-line strings, and proper quoting.
 */

import YAML from "yaml";
import type { ManualEntry } from "../stores/configStore.svelte.js";
import { SECTIONS_ORDERED, getErrorMessage, type Section } from "../types/index.js";

/** The top-level sections we recognise in a CF config. */
const KNOWN_SECTIONS = SECTIONS_ORDERED;

/**
 * Parse an existing config file content (YAML or JSON) and return ManualEntry[] with any warnings.
 */
export function parseExistingConfig(content: string, filePath: string): { entries: ManualEntry[]; warnings: string[] } {
  const isJson = filePath.endsWith(".json");

  try {
    const result = isJson ? parseJsonConfig(content) : parseYamlConfig(content);
    const warnings: string[] = [];
    // Filter out deprecated subclass insertion entries (Progressions with Subclasses but no Action)
    const filtered = result.filter(entry => {
      if (entry.section === "Progressions" && isDeprecatedSubclassEntry(entry.fields)) {
        const uuid = entry.fields["UUID"] ?? "unknown";
        warnings.push(`Skipped deprecated subclass insertion entry (UUID: ${uuid}). Since CF 2.6.5.8, subclass insertion is automatic — only ChildRemoved on SubClass generates output.`);
        return false;
      }
      return true;
    });
    // Validate structural integrity of parsed entries
    const { valid, warnings: validationWarnings } = validateParsedEntries(filtered);
    warnings.push(...validationWarnings);
    return { entries: valid, warnings };
  } catch (e) {
    console.error("Failed to parse existing config:", e);
    return { entries: [], warnings: [getErrorMessage(e)] };
  }
}

/**
 * Validate structural integrity of parsed config entries.
 * Rejects entries with unknown sections or missing UUIDs; warns on non-standard UUID format.
 */
function validateParsedEntries(entries: ManualEntry[]): { valid: ManualEntry[]; warnings: string[] } {
  const warnings: string[] = [];
  const valid: ManualEntry[] = [];
  const knownSet = new Set<string>(KNOWN_SECTIONS);

  for (const entry of entries) {
    if (!knownSet.has(entry.section)) {
      warnings.push(`Unknown section "${entry.section}" — entry skipped.`);
      continue;
    }

    const uuid = entry.fields["UUID"];
    if (!uuid || uuid.trim() === "") {
      // Some sections (e.g. Spells) use alternative key fields — don't skip, just warn
      warnings.push(`Entry in ${entry.section} missing UUID — may use an alternative key field.`);
    } else if (!/^[0-9a-f-]{36}(\|[0-9a-f-]{36})*$/i.test(uuid.trim())) {
      // Warn on non-standard UUID format (allow pipe-separated UUIDs for Lists)
      warnings.push(`Entry in ${entry.section} has non-standard UUID "${uuid}".`);
    }

    valid.push(entry);
  }

  return { valid, warnings };
}

/**
 * Detect deprecated subclass insertion entries: Progressions entries that contain
 * Subclass fields but have no other content and no ChildRemoved actions.
 * Since CF 2.6.5.8, subclass insertion (ChildAdded) is automatic — these
 * entries are obsolete. Entries with ChildRemoved on SubClass are still valid.
 */
function isDeprecatedSubclassEntry(fields: Record<string, string>): boolean {
  const subclassKeys = Object.keys(fields).filter(k => k.startsWith("Subclass:"));
  if (subclassKeys.length === 0) return false;
  // If any Subclass child has Action: "Remove", this is a valid removal entry
  const hasRemoval = subclassKeys.some(k =>
    k.endsWith(":Action") && fields[k] === "Remove"
  );
  if (hasRemoval) return false;
  // If the entry has other content fields beyond UUID + Subclass, it's not deprecated
  const hasOtherContent = Object.keys(fields).some(k =>
    k.startsWith("Selector:") || k.startsWith("String:") || k.startsWith("Boolean:") ||
    k.startsWith("Field:") || k.startsWith("Tag:") || k.startsWith("Child:")
  );
  return !hasOtherContent;
}

/**
 * Core config parser: takes a parsed document object and extracts ManualEntry[] from known sections.
 */
function parseConfigDocument(doc: Record<string, unknown>): ManualEntry[] {
  const entries: ManualEntry[] = [];

  for (const section of KNOWN_SECTIONS) {
    const sectionData = doc[section];
    if (!Array.isArray(sectionData)) continue;

    for (const item of sectionData) {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        entries.push({
          section,
          fields: flattenConfigEntry(item as Record<string, unknown>),
        });
      }
    }
  }

  return entries;
}

function parseJsonConfig(content: string): ManualEntry[] {
  return parseConfigDocument(JSON.parse(content));
}

/**
 * Parse a YAML config using the `yaml` npm package.
 * Uses the 'failsafe' schema so all scalars are returned as strings,
 * matching the behaviour expected by flattenConfigEntry().
 * Anchors, aliases, merge keys, comments, multi-line strings, and
 * flow collections are all handled natively.
 */
function parseYamlConfig(content: string): ManualEntry[] {
  // Strip BOM and normalise line endings
  const normalized = content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const doc = YAML.parse(normalized, { schema: "failsafe" }) ?? {};

  if (typeof doc !== "object" || Array.isArray(doc)) {
    throw new Error("YAML document root must be a mapping");
  }

  return parseConfigDocument(doc as Record<string, unknown>);
}

// ──────────────────────────────────────────────
// Schema-driven flattening specs
// ──────────────────────────────────────────────

/** Field mapping within an indexed flatten spec. */
interface IndexedFieldMapping {
  /** Source field name in the parsed object */
  source: string;
  /** Output suffix in the flat key (e.g., "Values") */
  target: string;
  /** Default value when source is missing. If undefined, field is optional (skipped when falsy). */
  default?: string;
  /** If set, join array values with this separator before storing. */
  joinArray?: string;
}

/** Spec for key-value encoded arrays (Booleans, Fields): `Prefix:${Key}` = Value */
interface KeyedFlattenSpec {
  kind: "keyed";
  key: string;
  prefix: string;
  keyField: string;
  valueField: string;
  defaultValue: string;
}

/** Spec for index-encoded arrays (Strings, Tags, Children): `Prefix:${i}:Field` */
interface IndexedFlattenSpec {
  kind: "indexed";
  key: string;
  prefix: string;
  fields: IndexedFieldMapping[];
}

type FlattenSpec = KeyedFlattenSpec | IndexedFlattenSpec;

/**
 * Declarative specs that replace per-type `else if` branches.
 * Covers: Booleans, Fields, Strings, Tags, Children.
 * Subclasses and Selectors have irregular structure and remain as special cases.
 */
const FLATTEN_SPECS: FlattenSpec[] = [
  // { Booleans: [{ Key: "AllowImprovement", Value: "true" }] } → "Boolean:AllowImprovement" = "true"
  { kind: "keyed", key: "Booleans", prefix: "Boolean", keyField: "Key", valueField: "Value", defaultValue: "false" },
  // { Fields: [{ Key: "Passives", Value: "SomePassive" }] } → "Field:Passives" = "SomePassive"
  { kind: "keyed", key: "Fields", prefix: "Field", keyField: "Key", valueField: "Value", defaultValue: "" },
  // { Strings: [{ Action: "Insert", Type: "Boosts", Strings: ["X","Y"] }] } → "String:0:Action" = "Insert", "String:0:Type" = "Boosts", "String:0:Values" = "X;Y"
  { kind: "indexed", key: "Strings", prefix: "String", fields: [
    { source: "Action", target: "Action", default: "Insert" },
    { source: "Type", target: "Type", default: "Boosts" },
    { source: "Strings", target: "Values", joinArray: ";" },
    { source: "modGuid", target: "modGuid" },
  ]},
  // { Tags: [{ UUIDs: ["abc","def"], Action: "Insert", Type: "Tags" }] } → "Tag:0:UUIDs" = "abc;def", "Tag:0:Action" = "Insert", "Tag:0:Type" = "Tags"
  { kind: "indexed", key: "Tags", prefix: "Tag", fields: [
    { source: "UUIDs", target: "UUIDs", joinArray: ";" },
    { source: "Action", target: "Action", default: "Insert" },
    { source: "Type", target: "Type", default: "Tags" },
    { source: "modGuid", target: "modGuid" },
  ]},
  // { Children: [{ Type: "SubClass", Values: "uuid1", Action: "Remove" }] } → "Child:0:Type" = "SubClass", "Child:0:Values" = "uuid1", "Child:0:Action" = "Remove"
  { kind: "indexed", key: "Children", prefix: "Child", fields: [
    { source: "Type", target: "Type", default: "" },
    { source: "Values", target: "Values", default: "" },
    { source: "Action", target: "Action", default: "Insert" },
    { source: "modGuid", target: "modGuid" },
  ]},
];

// ──────────────────────────────────────────────
// Selector param keys (kept separate since Selectors are a special case)
// ──────────────────────────────────────────────

const SELECTOR_PARAM_KEYS = [
  "Guid", "Amount", "SwapAmount", "SelectorId", "CastingAbility",
  "ActionResource", "PrepareType", "CooldownType", "BonusType", "Amounts", "LimitToProficiency",
] as const;

// ──────────────────────────────────────────────
// Special-case flattening helpers
// ──────────────────────────────────────────────

/**
 * Normalize UUID/UUIDs at the top level of a config entry.
 * `UUIDs` (plural key) takes priority over `UUID`.
 * Arrays → pipe-separated with `_uuidIsArray` flag.
 * Semicolon-delimited strings are split and stored pipe-separated.
 */
function flattenUuids(obj: Record<string, unknown>): [string, string][] {
  const pairs: [string, string][] = [];
  const hasUuidsKey = obj["UUIDs"] != null;
  const uuidsRaw = obj["UUIDs"] ?? obj["UUID"];
  if (uuidsRaw == null) return pairs;

  if (Array.isArray(uuidsRaw)) {
    const arr = uuidsRaw.map(String);
    pairs.push(["UUID", arr.join("|")]);
    pairs.push(["_uuidIsArray", (arr.length > 1 || hasUuidsKey) ? "true" : "false"]);
  } else {
    const str = String(uuidsRaw);
    const parts = str.split(";").map(s => s.trim());
    if (parts.length > 1) {
      pairs.push(["UUID", parts.join("|")]);
      pairs.push(["_uuidIsArray", "true"]);
    } else {
      pairs.push(["UUID", str]);
      if (hasUuidsKey) pairs.push(["_uuidIsArray", "true"]);
    }
  }
  return pairs;
}

/**
 * Flatten a Subclasses array. Each subclass object is an arbitrary-key record;
 * nested objects are JSON-stringified.
 */
function flattenSubclasses(value: unknown[]): [string, string][] {
  const pairs: [string, string][] = [];
  for (let i = 0; i < value.length; i++) {
    const sub = value[i] as Record<string, unknown>;
    for (const [sk, sv] of Object.entries(sub)) {
      if (sv && typeof sv === "object") {
        pairs.push([`Subclass:${i}:${sk}`, JSON.stringify(sv)]);
      } else {
        pairs.push([`Subclass:${i}:${sk}`, String(sv ?? "")]);
      }
    }
  }
  return pairs;
}

/**
 * Flatten a Selectors array. Each selector has top-level fields plus a nested
 * Params object. The `Amounts` param is array-joined with commas.
 */
function flattenSelectors(value: unknown[]): [string, string][] {
  const pairs: [string, string][] = [];
  for (let i = 0; i < value.length; i++) {
    const s = value[i] as Record<string, unknown>;
    pairs.push([`Selector:${i}:Action`, String(s["Action"] ?? "Insert")]);
    pairs.push([`Selector:${i}:Function`, String(s["Function"] ?? "")]);
    pairs.push([`Selector:${i}:Overwrite`, String(s["Overwrite"] ?? "false")]);
    pairs.push([`Selector:${i}:UUID`, String(s["UUID"] ?? "")]);
    if (s["modGuid"]) pairs.push([`Selector:${i}:modGuid`, String(s["modGuid"])]);
    // Parse Params object
    const params = s["Params"];
    if (params && typeof params === "object" && !Array.isArray(params)) {
      const p = params as Record<string, unknown>;
      for (const pk of SELECTOR_PARAM_KEYS) {
        if (pk in p && p[pk] != null) {
          if (pk === "Amounts" && Array.isArray(p[pk])) {
            pairs.push([`Selector:${i}:Param:${pk}`, (p[pk] as unknown[]).map(String).join(",")]);
          } else {
            pairs.push([`Selector:${i}:Param:${pk}`, String(p[pk])]);
          }
        }
      }
    }
  }
  return pairs;
}

// ──────────────────────────────────────────────
// Main flattener
// ──────────────────────────────────────────────

/**
 * Flatten a JSON config entry object into a flat Record<string, string>.
 * Normalizes UUID/UUIDs: `UUIDs` takes priority over `UUID`.
 * Both accept a single string or array of strings.
 * Arrays are stored pipe-separated with `_uuidIsArray` flag.
 */
function flattenConfigEntry(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};

  // Normalize UUID/UUIDs first (only at top level)
  if (!prefix) {
    for (const [k, v] of flattenUuids(obj)) {
      result[k] = v;
    }
  }

  for (const [key, value] of Object.entries(obj)) {
    if (!prefix && (key === "UUID" || key === "UUIDs")) continue;

    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      result[fullKey] = String(value);
    } else if (Array.isArray(value)) {
      let matched = false;

      if (!prefix) {
        // Schema-driven flattening for typed arrays
        for (const spec of FLATTEN_SPECS) {
          if (key !== spec.key) continue;
          if (!value.every(v => typeof v === "object" && v !== null)) break;

          if (spec.kind === "keyed") {
            for (const item of value) {
              const obj = item as Record<string, unknown>;
              const k = String(obj[spec.keyField] ?? "");
              if (k) result[`${spec.prefix}:${k}`] = String(obj[spec.valueField] ?? spec.defaultValue);
            }
          } else {
            for (let i = 0; i < value.length; i++) {
              const obj = value[i] as Record<string, unknown>;
              for (const fm of spec.fields) {
                const val = obj[fm.source];
                // Optional fields (no default) are skipped when source value is falsy
                if (fm.default === undefined && !fm.joinArray && !val) continue;
                if (fm.joinArray) {
                  result[`${spec.prefix}:${i}:${fm.target}`] = Array.isArray(val) ? val.join(fm.joinArray) : String(val ?? "");
                } else {
                  result[`${spec.prefix}:${i}:${fm.target}`] = String(val ?? fm.default ?? "");
                }
              }
            }
          }
          matched = true;
          break;
        }

        // Special case: Subclasses — arbitrary keys, nested objects → JSON.stringify
        if (!matched && key === "Subclasses" && value.every(v => typeof v === "object" && v !== null)) {
          for (const [k, v] of flattenSubclasses(value)) result[k] = v;
          matched = true;
        }

        // Special case: Selectors — nested Params object with Amounts array join
        if (!matched && key === "Selectors" && value.every(v => typeof v === "object" && v !== null)) {
          for (const [k, v] of flattenSelectors(value)) result[k] = v;
          matched = true;
        }
      }

      if (!matched) {
        if (value.every(v => typeof v === "string" || typeof v === "number")) {
          result[fullKey] = value.join(";");
        } else {
          result[fullKey] = JSON.stringify(value);
        }
      }
    } else if (value && typeof value === "object") {
      Object.assign(result, flattenConfigEntry(value as Record<string, unknown>, fullKey));
    }
  }

  return result;
}
