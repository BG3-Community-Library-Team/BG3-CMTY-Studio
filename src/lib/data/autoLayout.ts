import type { FormLayout, LayoutRow, LayoutField, LayoutSubsection } from "./formLayouts.js";
import type { SectionCapabilities } from "./sectionCaps.js";
import type { NodeSchema } from "../utils/tauri.js";

// ─── Identity attribute names excluded from layout (handled by FormIdentity) ──
const IDENTITY_ATTRS = new Set(["UUID", "MapKey"]);

// ─── Semantic field groupings by prefix/name affinity ──
const SEMANTIC_GROUPS: [string, string[]][] = [
  ["Name / Display", ["Name", "DisplayName", "Description", "DisplayDescription"]],
  ["Template", ["DefaultsTemplate", "RootTemplate", "GlobalTemplate", "ParentTemplateId", "VisualTemplate", "PhysicsTemplate"]],
  ["Race", ["RaceUUID", "SubRaceUUID", "DisplayTypeUUID"]],
  ["Class", ["ClassUUID", "ClassEquipmentOverride"]],
  ["Voice", ["VoiceTableUUID", "VOLinesTableUUID", "SpeakerUUID"]],
  ["Body", ["BodyType", "BodyShape"]],
  ["Closeup", ["CloseUpA", "CloseUpB"]],
  ["Hotbar", ["ClassHotbarColumns", "CommonHotbarColumns", "ItemsHotbarColumns"]],
];

function fieldItem(key: string): LayoutField {
  return { key, type: "field" };
}

function boolItem(key: string): LayoutField {
  return { key, type: "boolean" };
}

/**
 * Try to group attribute names into semantic rows.
 * Returns [groupedRows, remainingKeys].
 */
function groupBySemantics(keys: string[]): [LayoutRow[], string[]] {
  const used = new Set<string>();
  const rows: LayoutRow[] = [];

  for (const [, members] of SEMANTIC_GROUPS) {
    const matched = keys.filter((k) => members.includes(k) && !used.has(k));
    if (matched.length >= 2) {
      rows.push({ items: matched.map(fieldItem) });
      for (const k of matched) used.add(k);
    }
  }

  // Group by common prefix (3+ chars) for remaining keys
  const remaining = keys.filter((k) => !used.has(k));
  const prefixGroups = new Map<string, string[]>();
  for (const key of remaining) {
    const prefix = key.replace(/([A-Z])/g, " $1").trim().split(" ")[0];
    if (prefix.length >= 3) {
      const group = prefixGroups.get(prefix) ?? [];
      group.push(key);
      prefixGroups.set(prefix, group);
    }
  }

  for (const [, members] of prefixGroups) {
    if (members.length >= 2) {
      rows.push({ items: members.map(fieldItem) });
      for (const k of members) used.add(k);
    }
  }

  return [rows, keys.filter((k) => !used.has(k))];
}

function chunkRows(keys: string[], perRow: number): LayoutRow[] {
  const rows: LayoutRow[] = [];
  for (let i = 0; i < keys.length; i += perRow) {
    rows.push({ items: keys.slice(i, i + perRow).map(fieldItem) });
  }
  return rows;
}

export function autoLayoutFromSchema(schema: NodeSchema): FormLayout {
  const booleanKeys: string[] = [];
  const mainFieldKeys: string[] = [];
  const optionalFieldKeys: string[] = [];
  const rareFieldKeys: string[] = [];

  for (const attr of schema.attributes) {
    if (IDENTITY_ATTRS.has(attr.name)) continue;

    if (attr.attr_type === "bool") {
      booleanKeys.push(attr.name);
      continue;
    }

    if (attr.frequency >= 0.8) {
      mainFieldKeys.push(attr.name);
    } else if (attr.frequency >= 0.3) {
      optionalFieldKeys.push(attr.name);
    } else {
      rareFieldKeys.push(attr.name);
    }
  }

  // Build main rows with semantic grouping
  const [semanticRows, ungroupedMain] = groupBySemantics(mainFieldKeys);
  const mainRows: LayoutRow[] = [
    ...semanticRows,
    ...chunkRows(ungroupedMain, 3),
  ];

  // Build subsections for optional and rare fields
  const subsections: LayoutSubsection[] = [];

  if (optionalFieldKeys.length > 0) {
    const [optSemantic, optRemaining] = groupBySemantics(optionalFieldKeys);
    subsections.push({
      title: "Optional Fields",
      rows: [...optSemantic, ...chunkRows(optRemaining, 3)],
    });
  }

  if (rareFieldKeys.length > 0) {
    const [rareSemantic, rareRemaining] = groupBySemantics(rareFieldKeys);
    subsections.push({
      title: "Rare Fields",
      rows: [...rareSemantic, ...chunkRows(rareRemaining, 3)],
      collapsed: true,
    });
  }

  // Child groups from schema children
  const childGroups = schema.children.map((child) => ({
    title: child.group_id,
    types: [child.child_node_id],
  }));

  const allFieldKeys = [...mainFieldKeys, ...optionalFieldKeys, ...rareFieldKeys];

  const layout: FormLayout = {
    maxFieldColumns: 3,
    handledFieldKeys: allFieldKeys,
    handledBooleanKeys: booleanKeys,
  };

  if (mainRows.length > 0) layout.rows = mainRows;
  if (subsections.length > 0) layout.subsections = subsections;
  if (booleanKeys.length > 0) layout.sideColumnBooleans = booleanKeys;
  if (childGroups.length > 0) layout.childGroups = childGroups;

  return layout;
}

export function autoLayoutFromCaps(caps: SectionCapabilities): FormLayout {
  const layout: FormLayout = {
    maxFieldColumns: 3,
  };

  const handledFieldKeys: string[] = [];
  const handledBooleanKeys: string[] = [];

  // Fields → rows (3 per row)
  if (caps.fieldKeys && caps.fieldKeys.length > 0) {
    layout.rows = chunkRows(caps.fieldKeys, 3);
    handledFieldKeys.push(...caps.fieldKeys);
  }

  // Booleans → side column
  if (caps.booleanKeys && caps.booleanKeys.length > 0) {
    layout.sideColumnBooleans = caps.booleanKeys;
    handledBooleanKeys.push(...caps.booleanKeys);
  }

  // String types → subsection
  if (caps.stringTypes && caps.stringTypes.length > 0) {
    const subsection: LayoutSubsection = {
      title: "String Fields",
      rows: [],
      stringKeys: caps.stringTypes,
    };
    layout.subsections = [subsection];
  }

  // Child types → child groups
  if (caps.childTypes && caps.childTypes.length > 0) {
    layout.childGroups = caps.childTypes.map((type) => ({
      title: type,
      types: [type],
    }));
  }

  if (handledFieldKeys.length > 0) layout.handledFieldKeys = handledFieldKeys;
  if (handledBooleanKeys.length > 0) layout.handledBooleanKeys = handledBooleanKeys;

  return layout;
}
