/**
 * Preview pipeline utilities � Change-to-field mapping, syntax highlighting,
 * and change summarization. Config serialization is handled by the Rust
 * backend via `previewConfig()` IPC. This module provides:
 * - `changesToManualFields()` � converts diff changes to manual-entry field records
 * - `populateFromRawAttributes()` � classifies raw LSX attributes for EntireEntryNew entries
 * - `splitMixedListEntry()` � splits Lists entries with both adds and removes into two entries
 * - `highlightYaml()`/`highlightJson()`/`highlightXml()` � syntax highlighting for output preview
 * - `summarizeChange()` � generates human-readable change descriptions for entry rows
 * - `isEntryValid()`/`validateEntry()` � re-exports from validation.ts
 */
import type { SelectedEntry, Section, Change, ChangeType } from "../types/index.js";
import { parseRawSelectors } from "./selectorParser.js";
import { FIELD_PREFIX } from "../data/fieldKeys.js";
export { validateEntry, isEntryValid } from "./validation.js";
export type { ValidationIssue, ValidationResult } from "./validation.js";

/**
 * Populate manual entry fields from raw LSX attributes for a new entry.
 * Maps raw attribute keys to the structured field key system used by ManualEntryForm.
 */
function populateFromRawAttributes(
  fields: Record<string, string>,
  section: Section,
  rawAttributes: Record<string, string>,
  rawChildren?: Record<string, string[]>,
): Record<string, string> {
  // Section-specific boolean keys
  // NOTE: These are intentionally a SUBSET of SECTION_CAPS.booleanKeys.
  // SECTION_CAPS defines what the manual-entry UI supports; these maps classify
  // raw LSX attributes for EntireEntryNew population. ClassDescriptions here
  // omits HasGod/IsDefaultForUseSpellAction (not present in raw LSX attributes
  // of new entries). Do NOT derive from SECTION_CAPS without verifying every key
  // matches a real LSX attribute name.
  const BOOLEAN_KEYS: Record<string, Set<string>> = {
    Progressions: new Set(["AllowImprovement", "IsMulticlass"]),
    Feats: new Set(["AllowImprovement", "CanBeTakenMultipleTimes"]),
    Backgrounds: new Set(["Hidden"]),
    ActionResources: new Set(["IsHidden", "IsSpellResource", "PartyActionResource", "ShowOnActionResourcePanel", "UpdatesSpellPowerLevel"]),
    ClassDescriptions: new Set(["CanLearnSpells", "MustPrepareSpells"]),
  };

  // Section-specific field keys (non-boolean, non-string/delimited)
  // NOTE: Intentional SUBSET of SECTION_CAPS.fieldKeys � Origins has 4 raw LSX
  // keys here vs 22 in SECTION_CAPS; ClassDescriptions has 3 vs 17. These maps
  // classify ONLY the raw LSX attributes observed on new mod entries. Additional
  // SECTION_CAPS fields (e.g. ClassUUID, GodUUID) are human-editable in manual
  // entry forms but not auto-populated from raw attributes.
  const FIELD_KEYS: Record<string, Set<string>> = {
    Origins: new Set(["BodyShape", "BodyType", "VoiceTableUUID", "AppearanceLocked"]),
    BackgroundGoals: new Set(["BackgroundUuid", "ExperienceReward", "InspirationPoints", "RewardLevel"]),
    ActionResources: new Set(["Name", "DiceType", "MaxLevel", "MaxValue", "ReplenishType"]),
    ClassDescriptions: new Set(["BaseHp", "HpPerLevel", "SpellCastingAbility"]),
  };

  // Section-specific delimited string fields (semicolon-delimited)
  const STRING_KEYS: Record<string, Set<string>> = {
    Progressions: new Set(["Boosts", "PassivesAdded", "PassivesRemoved"]),
    Feats: new Set(["PassivesAdded", "Boosts"]),
    Origins: new Set(["Passives"]),
    Backgrounds: new Set(["Passives"]),
  };

  const boolKeys = BOOLEAN_KEYS[section] ?? new Set();
  const fieldKeys = FIELD_KEYS[section] ?? new Set();
  const stringKeys = STRING_KEYS[section] ?? new Set();
  const hasAnyMappings = boolKeys.size > 0 || fieldKeys.size > 0 || stringKeys.size > 0;

  let strIdx = 0;

  // Lists section — items are stored as attributes (Spells, Passives, Skills, etc.)
  if (section === "Lists") {
    // Name fallback: Comment attribute, or if unavailable, use the UUID
    if (rawAttributes["Comment"]) {
      fields["Name"] = rawAttributes["Comment"];
    }
    if (rawAttributes["UUID"]) fields["UUID"] = rawAttributes["UUID"];
    fields["Action"] = "Insert";

    // Determine list type from node_id or explicit Type attribute
    // node_id values are like "SpellList", "SkillList", "PassiveList", etc.
    const listTypeAttr = rawAttributes["Type"];
    if (listTypeAttr) {
      fields["Type"] = listTypeAttr;
    }
    // Note: node_id-based type detection is handled by the calling code

    // Extract items from the attribute fields (Spells, Passives, Skills, Abilities, Equipment)
    const itemFields = ["Spells", "Passives", "Skills", "Abilities", "Equipment"];
    const allItems: string[] = [];
    for (const field of itemFields) {
      const val = rawAttributes[field];
      if (val) {
        // Split by semicolon or comma depending on field type
        const delim = field === "Passives" || field === "Skills" ? "," : ";";
        const parts = val.split(delim).map((s: string) => s.trim()).filter(Boolean);
        allItems.push(...parts);
      }
    }
    if (allItems.length > 0) {
      fields["Items"] = allItems.join(";");
    }

    // Also check rawChildren as fallback (some list structures may use children)
    if (allItems.length === 0 && rawChildren) {
      const childGuids: string[] = [];
      for (const guids of Object.values(rawChildren)) {
        childGuids.push(...guids);
      }
      if (childGuids.length > 0) fields["Items"] = childGuids.join(";");
    }
    return fields;
  }

  // Selectors — parse raw LSX format into structured param fields
  if (rawAttributes["Selectors"]) {
    const parsed = parseRawSelectors(rawAttributes["Selectors"]);
    let selIdx = 0;
    for (const sel of parsed) {
      fields[`${FIELD_PREFIX.Selector}:${selIdx}:Action`] = "Insert";
      fields[`${FIELD_PREFIX.Selector}:${selIdx}:Function`] = sel.fn;
      for (const [paramKey, paramVal] of Object.entries(sel.params)) {
        if (paramVal) {
          fields[`${FIELD_PREFIX.Selector}:${selIdx}:Param:${paramKey}`] = paramVal;
        }
      }
      selIdx++;
    }
  }

  for (const [key, value] of Object.entries(rawAttributes)) {
    if (!value || key === "UUID" || key === "MapKey" || key === "Name" || key === "Selectors") continue;

    if (boolKeys.has(key)) {
      fields[`${FIELD_PREFIX.Boolean}:${key}`] = value.toLowerCase() === "true" ? "true" : "false";
    } else if (fieldKeys.has(key)) {
      fields[`${FIELD_PREFIX.Field}:${key}`] = value;
    } else if (stringKeys.has(key)) {
      const parts = value.split(";").filter((s: string) => s.trim());
      if (parts.length > 0) {
        fields[`${FIELD_PREFIX.String}:${strIdx}:Action`] = "Insert";
        fields[`${FIELD_PREFIX.String}:${strIdx}:Type`] = key;
        fields[`${FIELD_PREFIX.String}:${strIdx}:Values`] = value;
        strIdx++;
      }
    } else if (!hasAnyMappings) {
      // Sections without hardcoded attribute maps (e.g., Stats/Spells):
      // encode all remaining attributes as generic fields
      fields[`${FIELD_PREFIX.Field}:${key}`] = value;
    }
  }

  // Children
  if (rawChildren) {
    let childIdx = 0;
    let tagIdx = 0;
    let subIdx = 0;
    for (const [group, guids] of Object.entries(rawChildren)) {
      if (guids.length === 0) continue;
      if (section === "Races") {
        // Races uses childTypes for everything including Tags — encode as Child:*
        for (const guid of guids) {
          fields[`${FIELD_PREFIX.Child}:${childIdx}:Type`] = group;
          fields[`${FIELD_PREFIX.Child}:${childIdx}:Values`] = guid;
          fields[`${FIELD_PREFIX.Child}:${childIdx}:Action`] = "Insert";
          childIdx++;
        }
      } else if (group.includes("Tags")) {
        fields[`${FIELD_PREFIX.Tag}:${tagIdx}:UUIDs`] = guids.join(";");
        fields[`${FIELD_PREFIX.Tag}:${tagIdx}:Action`] = "Insert";
        fields[`${FIELD_PREFIX.Tag}:${tagIdx}:Type`] = group;
        tagIdx++;
      } else if (group === "SubClass") {
        // Subclass insertion is automatic — skip for new entries
        // Users can manually add subclass removal entries if needed
      }
    }
  }

  return fields;
}

/** Mutable context threaded through change handlers. */
interface ChangeHandlerContext {
  fields: Record<string, string>;
  section: Section;
  selIdx: number;
  strIdx: number;
  childIdx: number;
  tagIdx: number;
  subIdx: number;
}

type ChangeHandler = (c: Change, ctx: ChangeHandlerContext) => void;

function handleBooleanChanged(c: Change, ctx: ChangeHandlerContext): void {
  ctx.fields[`${FIELD_PREFIX.Boolean}:${c.field}`] = c.mod_value ?? "false";
}

function handleFieldChanged(c: Change, ctx: ChangeHandlerContext): void {
  ctx.fields[`${FIELD_PREFIX.Field}:${c.field}`] = c.mod_value ?? "";
}

function handleSpellFieldChanged(c: Change, ctx: ChangeHandlerContext): void {
  ctx.fields[`${FIELD_PREFIX.SpellField}:${c.field}`] = c.mod_value ?? "";
}

function handleSelectorAdded(c: Change, ctx: ChangeHandlerContext): void {
  for (const v of c.added_values) {
    ctx.fields[`${FIELD_PREFIX.Selector}:${ctx.selIdx}:Action`] = "Insert";
    ctx.fields[`${FIELD_PREFIX.Selector}:${ctx.selIdx}:Function`] = v;
    ctx.selIdx++;
  }
}

function handleSelectorRemoved(c: Change, ctx: ChangeHandlerContext): void {
  for (const v of c.removed_values) {
    ctx.fields[`${FIELD_PREFIX.Selector}:${ctx.selIdx}:Action`] = "Remove";
    ctx.fields[`${FIELD_PREFIX.Selector}:${ctx.selIdx}:Function`] = v;
    ctx.selIdx++;
  }
}

function handleStringAdded(c: Change, ctx: ChangeHandlerContext): void {
  ctx.fields[`${FIELD_PREFIX.String}:${ctx.strIdx}:Action`] = "Insert";
  ctx.fields[`${FIELD_PREFIX.String}:${ctx.strIdx}:Type`] = c.field;
  ctx.fields[`${FIELD_PREFIX.String}:${ctx.strIdx}:Values`] = c.added_values.join(";");
  ctx.strIdx++;
}

function handleStringRemoved(c: Change, ctx: ChangeHandlerContext): void {
  ctx.fields[`${FIELD_PREFIX.String}:${ctx.strIdx}:Action`] = "Remove";
  ctx.fields[`${FIELD_PREFIX.String}:${ctx.strIdx}:Type`] = c.field;
  ctx.fields[`${FIELD_PREFIX.String}:${ctx.strIdx}:Values`] = c.removed_values.join(";");
  ctx.strIdx++;
}

function handleChildAdded(c: Change, ctx: ChangeHandlerContext): void {
  if (c.field.includes("Tags")) {
    ctx.fields[`${FIELD_PREFIX.Tag}:${ctx.tagIdx}:UUIDs`] = c.added_values.join(";");
    ctx.fields[`${FIELD_PREFIX.Tag}:${ctx.tagIdx}:Action`] = "Insert";
    ctx.fields[`${FIELD_PREFIX.Tag}:${ctx.tagIdx}:Type`] = c.field;
    ctx.tagIdx++;
  } else if (c.field === "SubClass") {
    // Subclass insertion is automatic since CF 2.6.5.8 � skip
  } else if (ctx.section === "Races") {
    for (const v of c.added_values) {
      ctx.fields[`${FIELD_PREFIX.Child}:${ctx.childIdx}:Type`] = c.field;
      ctx.fields[`${FIELD_PREFIX.Child}:${ctx.childIdx}:Values`] = v;
      ctx.fields[`${FIELD_PREFIX.Child}:${ctx.childIdx}:Action`] = "Insert";
      ctx.childIdx++;
    }
  }
}

function handleChildRemoved(c: Change, ctx: ChangeHandlerContext): void {
  if (c.field.includes("Tags")) {
    ctx.fields[`${FIELD_PREFIX.Tag}:${ctx.tagIdx}:UUIDs`] = c.removed_values.join(";");
    ctx.fields[`${FIELD_PREFIX.Tag}:${ctx.tagIdx}:Action`] = "Remove";
    ctx.fields[`${FIELD_PREFIX.Tag}:${ctx.tagIdx}:Type`] = c.field;
    ctx.tagIdx++;
  } else if (c.field === "SubClass") {
    for (const v of c.removed_values) {
      ctx.fields[`${FIELD_PREFIX.Subclass}:${ctx.subIdx}:Action`] = "Remove";
      ctx.fields[`${FIELD_PREFIX.Subclass}:${ctx.subIdx}:UUID`] = v;
      ctx.fields[`${FIELD_PREFIX.Subclass}:${ctx.subIdx}:SubClassName`] = "";
      ctx.fields[`${FIELD_PREFIX.Subclass}:${ctx.subIdx}:Class`] = "";
      ctx.subIdx++;
    }
  } else if (ctx.section === "Races") {
    for (const v of c.removed_values) {
      ctx.fields[`${FIELD_PREFIX.Child}:${ctx.childIdx}:Type`] = c.field;
      ctx.fields[`${FIELD_PREFIX.Child}:${ctx.childIdx}:Values`] = v;
      ctx.fields[`${FIELD_PREFIX.Child}:${ctx.childIdx}:Action`] = "Remove";
      ctx.childIdx++;
    }
  }
}

/** Exhaustive mapping from ChangeType to its handler function. */
const CHANGE_HANDLERS: Record<ChangeType, ChangeHandler> = {
  BooleanChanged: handleBooleanChanged,
  FieldChanged: handleFieldChanged,
  SpellFieldChanged: handleSpellFieldChanged,
  SelectorAdded: handleSelectorAdded,
  SelectorRemoved: handleSelectorRemoved,
  StringAdded: handleStringAdded,
  StringRemoved: handleStringRemoved,
  ChildAdded: handleChildAdded,
  ChildRemoved: handleChildRemoved,
  EntireEntryNew: () => {}, // Handled by early return above
};

/**
 * Convert a DiffEntry's changes into ManualEntry-style structured field keys.
 * Used when editing an auto-detected entry.
 */
export function changesToManualFields(
  entry: SelectedEntry,
  rawAttributes?: Record<string, string>,
  rawChildren?: Record<string, string[]>,
): Record<string, string> {
  const fields: Record<string, string> = {};

  if (entry.section === "Spells") {
    fields["EntryName"] = entry.uuid;
    fields["Action"] = "Insert";
  } else {
    fields["UUID"] = entry.uuid;
  }
  if (entry.display_name) fields["Name"] = entry.display_name;

  // For new entries, populate from raw LSX attributes instead of changes.
  // Stats entries (from diff_stats) have changes: [] with populated raw_attributes.
  const isNew = (entry.changes.length === 1 && entry.changes[0].change_type === "EntireEntryNew")
    || entry.changes.length === 0;
  if (isNew && rawAttributes && Object.keys(rawAttributes).length > 0) {
    return populateFromRawAttributes(fields, entry.section, rawAttributes, rawChildren);
  }

  // Lists section: use Action/Type/Items format instead of generic String:N
  if (entry.section === "Lists") {
    const added = entry.changes.filter(c => c.change_type === "StringAdded");
    const removed = entry.changes.filter(c => c.change_type === "StringRemoved");

    // Determine list type from entry metadata
    fields["Type"] = entry.list_type ?? "SpellList";

    if (added.length > 0 && removed.length === 0) {
      // Pure Insert
      fields["Action"] = "Insert";
      fields["Items"] = added.flatMap(c => c.added_values).join(";");
    } else if (removed.length > 0 && added.length === 0) {
      // Pure Remove
      fields["Action"] = "Remove";
      fields["Items"] = removed.flatMap(c => c.removed_values).join(";");
    } else if (added.length > 0 && removed.length > 0) {
      // Mixed: prefer Insert as primary action (Remove is handled by splitMixedListEntry)
      fields["Action"] = "Insert";
      fields["Items"] = added.flatMap(c => c.added_values).join(";");
      // Tag that this entry has removals too — used by splitMixedListEntry()
      fields["_hasRemovals"] = "true";
      fields["_removedItems"] = removed.flatMap(c => c.removed_values).join(";");
    }

    return fields;
  }

  const ctx: ChangeHandlerContext = {
    fields, section: entry.section,
    selIdx: 0, strIdx: 0, childIdx: 0, tagIdx: 0, subIdx: 0,
  };

  for (const c of entry.changes) {
    CHANGE_HANDLERS[c.change_type](c, ctx);
  }

  // Fill in unset Boolean/Field values from raw LSX attributes so the form
  // shows the full entry context, not just the diff changes.
  if (rawAttributes && Object.keys(rawAttributes).length > 0) {
    const rawFields: Record<string, string> = {};
    populateFromRawAttributes(rawFields, entry.section, rawAttributes, rawChildren);
    for (const [key, value] of Object.entries(rawFields)) {
      if ((key.startsWith("Boolean:") || key.startsWith("Field:") || key.startsWith("Child:") || key.startsWith("Tag:")) && !(key in ctx.fields)) {
        ctx.fields[key] = value;
      }
    }
  }

  return ctx.fields;
}

/**
 * For Lists entries with both added AND removed items, split the fields into
 * two separate field sets: one for Insert, one for Remove.
 * Returns null if the entry is not a mixed-action Lists entry.
 */
export function splitMixedListEntry(fields: Record<string, string>): { insert: Record<string, string>; remove: Record<string, string> } | null {
  if (fields["_hasRemovals"] !== "true") return null;

  const base: Record<string, string> = { UUID: fields["UUID"] ?? "", Type: fields["Type"] ?? "SpellList" };
  if (fields["Name"]) {
    base.Name = fields["Name"];
  }

  const insert: Record<string, string> = { ...base, Action: "Insert", Items: fields["Items"] ?? "" };
  const remove: Record<string, string> = { ...base, Action: "Remove", Items: fields["_removedItems"] ?? "" };

  return { insert, remove };
}

/**
 * Lightweight YAML syntax highlighting for the preview.
 * Uses a two-pass token approach to avoid regex self-corruption
 * (e.g. the string regex matching class="yaml-key" inside already-created spans).
 */
export function highlightYaml(text: string): string {
  // Pass 1: escape HTML entities
  let result = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Pass 2: tokenize with null-byte delimiters (won't appear in YAML text)
  result = result
    .replace(/(#.+)$/gm, '\x00C\x01$1\x02')                  // comments first
    .replace(/^(\s*)([\w_]+)(:)/gm, '$1\x00K\x01$2\x02$3')   // keys
    .replace(/"([^"]*)"/g, '\x00S\x01"$1"\x02')               // strings
    .replace(/(&amp;\w+)/g, '\x00A\x01$1\x02')                // anchors
    .replace(/(\*\w+)/g, '\x00L\x01$1\x02')                   // aliases
    .replace(/:\s+(true|false)\b/g, ': \x00B\x01$1\x02')      // booleans
    .replace(/:\s+(\d+(?:\.\d+)?)\s*$/gm, ': \x00N\x01$1\x02'); // numbers

  // Pass 3: convert tokens to styled spans
  result = result
    .replace(/\x00K\x01(.*?)\x02/g, '<span class="yaml-key">$1</span>')
    .replace(/\x00S\x01(.*?)\x02/g, '<span class="yaml-string">$1</span>')
    .replace(/\x00A\x01(.*?)\x02/g, '<span class="yaml-anchor">$1</span>')
    .replace(/\x00L\x01(.*?)\x02/g, '<span class="yaml-alias">$1</span>')
    .replace(/\x00C\x01(.*?)\x02/g, '<span class="yaml-comment">$1</span>')
    .replace(/\x00B\x01(.*?)\x02/g, '<span class="yaml-boolean">$1</span>')
    .replace(/\x00N\x01(.*?)\x02/g, '<span class="yaml-number">$1</span>');

  return result;
}

/**
 * Lightweight JSON syntax highlighting.
 * Uses the same token approach to avoid self-corruption.
 */
export function highlightJson(text: string): string {
  let result = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Tokenize
  result = result
    .replace(/"(\w+)"(\s*:)/g, '\x00K\x01"$1"\x02$2')           // keys
    .replace(/:\s*"([^"]+)"/g, ': \x00S\x01"$1"\x02')           // string values
    .replace(/:\s*(\d+)/g, ': \x00N\x01$1\x02')                 // numbers
    .replace(/:\s*(true|false)/g, ': \x00B\x01$1\x02');         // booleans

  // Convert to spans
  result = result
    .replace(/\x00K\x01(.*?)\x02/g, '<span class="json-key">$1</span>')
    .replace(/\x00S\x01(.*?)\x02/g, '<span class="json-string">$1</span>')
    .replace(/\x00N\x01(.*?)\x02/g, '<span class="json-number">$1</span>')
    .replace(/\x00B\x01(.*?)\x02/g, '<span class="json-boolean">$1</span>');

  return result;
}

/**
 * Lightweight XML/LSX syntax highlighting for the LSX preview tab.
 * Uses the same token approach as YAML/JSON highlighters.
 */
export function highlightXml(text: string): string {
  let result = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Tokenize XML structures
  result = result
    // XML declaration: <?xml ... ?>
    .replace(/(&lt;\?xml.*?\?&gt;)/g, '\x00D\x01$1\x02')
    // Comments: <!-- ... -->
    .replace(/(&lt;!--.*?--&gt;)/gs, '\x00C\x01$1\x02')
    // Closing tags: </tagname>
    .replace(/(&lt;\/)(\w+)(&gt;)/g, '$1\x00T\x01$2\x02$3')
    // Self-closing tags with attributes: <tagname ... />
    .replace(/(&lt;)(\w+)((?:\s+\w+="[^"]*")*\s*\/&gt;)/g, function(_m, lt, tag, rest) {
      const highlighted = rest.replace(/(\w+)(=")([^"]*?)(")/g, '\x00A\x01$1\x02$2\x00V\x01$3\x02$4');
      return lt + '\x00T\x01' + tag + '\x02' + highlighted;
    })
    // Opening tags with attributes: <tagname ... >
    .replace(/(&lt;)(\w+)((?:\s+\w+="[^"]*")*\s*&gt;)/g, function(_m, lt, tag, rest) {
      const highlighted = rest.replace(/(\w+)(=")([^"]*?)(")/g, '\x00A\x01$1\x02$2\x00V\x01$3\x02$4');
      return lt + '\x00T\x01' + tag + '\x02' + highlighted;
    });

  // Convert tokens to styled spans
  result = result
    .replace(/\x00D\x01(.*?)\x02/g, '<span class="xml-decl">$1</span>')
    .replace(/\x00C\x01(.*?)\x02/gs, '<span class="xml-comment">$1</span>')
    .replace(/\x00T\x01(.*?)\x02/g, '<span class="xml-tag">$1</span>')
    .replace(/\x00A\x01(.*?)\x02/g, '<span class="xml-attr">$1</span>')
    .replace(/\x00V\x01(.*?)\x02/g, '<span class="xml-value">$1</span>');

  return result;
}

/**
 * Summarize a change for display in entry rows.
 */
export function summarizeChange(change: Change): string {
  switch (change.change_type) {
    case "EntireEntryNew":
      return "New entry";
    case "StringAdded":
      return `+${change.added_values.length} ${change.field}`;
    case "StringRemoved":
      return `-${change.removed_values.length} ${change.field}`;
    case "SelectorAdded":
      return `+${change.added_values.length} Selector(s)`;
    case "SelectorRemoved":
      return `-${change.removed_values.length} Selector(s)`;
    case "BooleanChanged":
      return `${change.field}: ${change.mod_value}`;
    case "FieldChanged":
      return `${change.field} changed`;
    case "ChildAdded":
      return `+${change.added_values.length} ${change.field}`;
    case "ChildRemoved":
      return `-${change.removed_values.length} ${change.field}`;
    case "SpellFieldChanged":
      return `${change.field} changed`;
    default:
      return "Modified";
  }
}
