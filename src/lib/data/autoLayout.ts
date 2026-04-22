import type { FormLayout, LayoutRow, LayoutField, LayoutSubsection } from "./formLayouts.js";
import type { SectionCapabilities } from "./sectionCaps.js";
import type { NodeSchema } from "../utils/tauri.js";
import type { StatTypeMetadata } from "./statFieldMetadata.js";

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

function spacerItem(): LayoutField {
  return { key: '', type: "spacer" };
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
      // Cap prefix groups to rows of 3 to prevent overflow
      for (let i = 0; i < members.length; i += 3) {
        const chunk = members.slice(i, i + 3);
        rows.push({ items: chunk.map(fieldItem) });
      }
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

export function autoLayoutFromMetadata(
  meta: StatTypeMetadata,
  schema: NodeSchema,
): FormLayout {
  // Build set of all field keys mentioned in metadata groups
  const metaFieldSet = new Set<string>();
  for (const group of meta.groups) {
    for (const f of group.fields) {
      metaFieldSet.add(f);
    }
  }

  // Build set of all boolean keys from schema
  const schemaBoolSet = new Set<string>();
  const schemaFieldSet = new Set<string>();
  for (const attr of schema.attributes) {
    if (IDENTITY_ATTRS.has(attr.name)) continue;
    if (attr.attr_type === "bool") {
      schemaBoolSet.add(attr.name);
    } else {
      schemaFieldSet.add(attr.name);
    }
  }

  // Build subsections from metadata groups
  const subsections: LayoutSubsection[] = [];
  for (const group of meta.groups) {
    let rows: LayoutRow[];
    if (group.customRows) {
      rows = group.customRows.map((rowFields, i) => ({
        items: rowFields.map(k => k === null ? spacerItem() : fieldItem(k)),
        gridTemplate: group.customRowTemplates?.[i],
      }));
    } else if (group.innerCards) {
      // Groups with inner cards only; rows stays empty
      rows = [];
    } else if (group.flagGroupKeys) {
      // Rows contain only the non-flag fields; flag fields render via FlagGroupBadges
      const flagSet = new Set([...(group.flagGroupKeys ?? []), ...(group.boolFlagKeys ?? [])]);
      const nonFlagFields = group.fields.filter(f => !flagSet.has(f));
      rows = chunkRows(nonFlagFields, 3);
    } else {
      rows = chunkRows(group.fields, 3);
    }

    const sub: LayoutSubsection = {
      title: group.title,
      rows,
    };
    if (group.collapsed) sub.collapsed = true;
    if (group.maxFieldColumns) sub.maxFieldColumns = group.maxFieldColumns;
    if (group.flagGroupKeys) sub.flagGroupKeys = group.flagGroupKeys;
    if (group.boolFlagKeys) sub.boolFlagKeys = group.boolFlagKeys;
    if (group.innerCards) {
      sub.innerCards = group.innerCards.map((card) => {
        const layoutCard: import('./formLayouts.js').LayoutInnerCard = {
          title: card.title,
          width: card.width,
          collapsed: card.collapsed,
          fullRow: card.fullRow,
          col: card.col,
          navRowLabel: card.navRowLabel,
          rows: card.columnGroups
            ? []
            : card.customRows
              ? card.customRows.map(rowFields => ({
                  items: rowFields.map(k => k === null ? spacerItem() : fieldItem(k)),
                }))
              : chunkRows(card.fields, card.fieldsPerRow ?? 1),
        };
        if (card.columnGroups) {
          layoutCard.columnGroups = card.columnGroups.map(group => group.map(k => fieldItem(k)));
        }
        return layoutCard;
      });
    }
    subsections.push(sub);
  }

  // Booleans NOT in any metadata group → side column
  const sideColumnBooleans: string[] = [];
  for (const bk of schemaBoolSet) {
    if (!metaFieldSet.has(bk)) {
      sideColumnBooleans.push(bk);
    }
  }

  // Non-boolean schema fields NOT in any metadata group → "Other Fields" subsection
  const otherFieldKeys: string[] = [];
  for (const fk of schemaFieldSet) {
    if (!metaFieldSet.has(fk)) {
      otherFieldKeys.push(fk);
    }
  }

  if (otherFieldKeys.length > 0) {
    subsections.push({
      title: "Other Fields",
      rows: chunkRows(otherFieldKeys, 3),
      collapsed: true,
    });
  }

  // All handled keys
  const allMetaFields = [...metaFieldSet];
  const handledFieldKeys = [...allMetaFields, ...otherFieldKeys];
  const handledBooleanKeys = [...schemaBoolSet];

  // Child groups from schema children
  const childGroups = schema.children.map((child) => ({
    title: child.group_id,
    types: [child.child_node_id],
  }));

  const layout: FormLayout = {
    maxFieldColumns: 3,
    handledFieldKeys,
    handledBooleanKeys,
    subsections,
  };

  if (sideColumnBooleans.length > 0) layout.sideColumnBooleans = sideColumnBooleans;
  if (childGroups.length > 0) layout.childGroups = childGroups;

  return layout;
}
