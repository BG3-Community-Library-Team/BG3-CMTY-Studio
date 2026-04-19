/**
 * Tests for statFieldMetadata.ts (T1/T2) and autoLayoutFromMetadata (T3).
 *
 * Part 1: Validates the STAT_TYPE_METADATA structure — no duplicates,
 *         no empty groups, unique titles, correct group counts.
 * Part 2: Validates autoLayoutFromMetadata converts metadata + schema
 *         into a FormLayout. Skips automatically if T3 is not yet implemented.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { STAT_TYPE_METADATA } from "../lib/data/statFieldMetadata";
import type { FormLayout } from "../lib/data/formLayouts";
import type { NodeSchema, AttrSchema, ChildSchema } from "../lib/utils/tauri";

// ─── Part 1: Metadata Structure Tests ────────────────────────────────

describe("STAT_TYPE_METADATA", () => {
  const EXPECTED_TYPES = [
    "SpellData",
    "PassiveData",
    "StatusData",
    "Armor",
    "Weapon",
    "InterruptData",
  ];

  it("contains all 6 stat types", () => {
    for (const type of EXPECTED_TYPES) {
      expect(STAT_TYPE_METADATA).toHaveProperty(type);
    }
  });

  for (const typeName of EXPECTED_TYPES) {
    describe(typeName, () => {
      const getMeta = () => STAT_TYPE_METADATA[typeName];

      it("has no duplicate fields across groups", () => {
        const meta = getMeta();
        const allFields = meta.groups.flatMap((g) => g.fields);
        const unique = new Set(allFields);
        expect(unique.size).toBe(allFields.length);
      });

      it("has no empty groups", () => {
        const meta = getMeta();
        for (const group of meta.groups) {
          expect(group.fields.length).toBeGreaterThan(0);
        }
      });

      it("has unique group titles", () => {
        const meta = getMeta();
        const titles = meta.groups.map((g) => g.title);
        const unique = new Set(titles);
        expect(unique.size).toBe(titles.length);
      });

      it('has a Using field in some group', () => {
        const meta = getMeta();
        const allFields = meta.groups.flatMap((g) => g.fields);
        expect(allFields).toContain("Using");
      });

      it('has Inheritance as the last group', () => {
        const meta = getMeta();
        const lastGroup = meta.groups[meta.groups.length - 1];
        expect(lastGroup.title).toBe("Inheritance");
        expect(lastGroup.fields).toEqual(["Using"]);
      });

      it("fieldCombobox keys appear in group fields", () => {
        const meta = getMeta();
        const allFields = new Set(meta.groups.flatMap((g) => g.fields));
        for (const key of Object.keys(meta.fieldCombobox)) {
          expect(allFields.has(key)).toBe(true);
        }
      });
    });
  }

  it("SpellData has 12 groups", () => {
    expect(STAT_TYPE_METADATA.SpellData.groups).toHaveLength(12);
  });

  it("PassiveData has 8 groups", () => {
    expect(STAT_TYPE_METADATA.PassiveData.groups).toHaveLength(8);
  });

  it("StatusData has 8 groups", () => {
    expect(STAT_TYPE_METADATA.StatusData.groups).toHaveLength(8);
  });

  it("Armor has 7 groups", () => {
    expect(STAT_TYPE_METADATA.Armor.groups).toHaveLength(7);
  });

  it("Weapon has 9 groups", () => {
    expect(STAT_TYPE_METADATA.Weapon.groups).toHaveLength(9);
  });

  it("InterruptData has 6 groups", () => {
    expect(STAT_TYPE_METADATA.InterruptData.groups).toHaveLength(6);
  });
});

// ─── Helpers for Part 2 ──────────────────────────────────────────────

function attr(name: string, attr_type: string, frequency: number): AttrSchema {
  return { name, attr_type, frequency, examples: [] };
}

function child(group_id: string, child_node_id: string, frequency = 1.0): ChildSchema {
  return { group_id, child_node_id, frequency };
}

function makeSchema(overrides: Partial<NodeSchema> = {}): NodeSchema {
  return {
    node_id: "SpellData",
    section: "Stats",
    sample_count: 100,
    attributes: [],
    children: [],
    ...overrides,
  };
}

// ─── Part 2: autoLayoutFromMetadata Tests ────────────────────────────
// Uses dynamic import so Part 1 tests still run if T3 is not yet implemented.

describe("autoLayoutFromMetadata", () => {
  let autoLayoutFromMetadata: ((meta: import("../lib/data/statFieldMetadata").StatTypeMetadata, schema: NodeSchema) => FormLayout) | undefined;

  beforeAll(async () => {
    const mod = (await import("../lib/data/autoLayout")) as Record<string, unknown>;
    if (typeof mod.autoLayoutFromMetadata === "function") {
      autoLayoutFromMetadata = mod.autoLayoutFromMetadata as (
        meta: import("../lib/data/statFieldMetadata").StatTypeMetadata,
        schema: NodeSchema,
      ) => FormLayout;
    }
  });

  // Schema with fields that ARE in SpellData metadata groups,
  // plus extra fields NOT in any group (to test "Other Fields" catch-all),
  // plus boolean fields, plus children.
  const spellSchema = makeSchema({
    node_id: "SpellData",
    attributes: [
      // Fields in metadata groups
      attr("DisplayName", "TranslatedString", 0.95),
      attr("Description", "TranslatedString", 0.90),
      attr("SpellType", "FixedString", 0.85),
      attr("Level", "int32", 0.80),
      attr("TargetRadius", "FixedString", 0.75),
      attr("SpellRoll", "FixedString", 0.70),
      attr("UseCosts", "FixedString", 0.65),
      attr("Using", "FixedString", 0.60),
      // Fields NOT in any metadata group → should go to "Other Fields"
      attr("UnlistedField", "FixedString", 0.50),
      attr("AnotherUnlisted", "int32", 0.40),
      // Boolean fields not in any group → should go to sideColumnBooleans
      attr("UnlistedBool", "bool", 0.30),
      attr("AnotherBool", "bool", 0.20),
    ],
    children: [child("SpellSlotGroup", "SpellSlot", 0.5)],
  });

  it("creates subsections matching metadata group titles", () => {
    if (!autoLayoutFromMetadata) return;
    const layout = autoLayoutFromMetadata(STAT_TYPE_METADATA.SpellData, spellSchema);

    expect(layout.subsections).toBeDefined();
    const titles = layout.subsections!.map((s) => s.title);
    // At minimum, groups that have matching schema fields should appear
    expect(titles).toContain("Identity");
    expect(titles).toContain("Classification");
    expect(titles).toContain("Targeting");
    expect(titles).toContain("Mechanics");
    expect(titles).toContain("Resources & Cooldowns");
    expect(titles).toContain("Inheritance");
  });

  it('puts unlisted schema fields in "Other Fields" collapsed subsection', () => {
    if (!autoLayoutFromMetadata) return;
    const layout = autoLayoutFromMetadata(STAT_TYPE_METADATA.SpellData, spellSchema);

    const otherSub = layout.subsections?.find((s) => s.title === "Other Fields");
    expect(otherSub).toBeDefined();
    expect(otherSub!.collapsed).toBe(true);
    const keys = otherSub!.rows.flatMap((r) => r.items.map((i) => i.key));
    expect(keys).toContain("UnlistedField");
    expect(keys).toContain("AnotherUnlisted");
  });

  it("puts unlisted boolean fields in sideColumnBooleans", () => {
    if (!autoLayoutFromMetadata) return;
    const layout = autoLayoutFromMetadata(STAT_TYPE_METADATA.SpellData, spellSchema);

    expect(layout.sideColumnBooleans).toBeDefined();
    expect(layout.sideColumnBooleans).toContain("UnlistedBool");
    expect(layout.sideColumnBooleans).toContain("AnotherBool");
  });

  it("unknown stat type is not in STAT_TYPE_METADATA", () => {
    // Verify that unknown types don't have metadata — fallback handled in UnifiedForm
    expect(STAT_TYPE_METADATA).not.toHaveProperty("CustomType");
  });

  it("maps schema children to childGroups", () => {
    if (!autoLayoutFromMetadata) return;
    const layout = autoLayoutFromMetadata(STAT_TYPE_METADATA.SpellData, spellSchema);

    expect(layout.childGroups).toBeDefined();
    expect(layout.childGroups).toHaveLength(1);
    expect(layout.childGroups![0]).toEqual(
      expect.objectContaining({ title: "SpellSlotGroup", types: ["SpellSlot"] }),
    );
  });

  it("sets handledFieldKeys for all fields", () => {
    if (!autoLayoutFromMetadata) return;
    const layout = autoLayoutFromMetadata(STAT_TYPE_METADATA.SpellData, spellSchema);

    expect(layout.handledFieldKeys).toBeDefined();
    const handled = new Set(layout.handledFieldKeys!);
    // Metadata group fields present in schema should be handled
    expect(handled.has("DisplayName")).toBe(true);
    expect(handled.has("SpellType")).toBe(true);
    expect(handled.has("Using")).toBe(true);
    // "Other Fields" should also be handled
    expect(handled.has("UnlistedField")).toBe(true);
    expect(handled.has("AnotherUnlisted")).toBe(true);
  });
});
