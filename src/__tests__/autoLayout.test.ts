/**
 * Additional tests for autoLayout.ts — realistic BG3 schema inputs
 * that exercise edge cases and structural coverage beyond unifiedForm.test.ts.
 */
import { describe, it, expect } from "vitest";
import { autoLayoutFromSchema } from "../lib/data/autoLayout.js";
import type { NodeSchema, AttrSchema, ChildSchema } from "../lib/utils/tauri.js";

// ─── Helpers ─────────────────────────────────────────────────────────

function attr(name: string, attr_type: string, frequency: number): AttrSchema {
  return { name, attr_type, frequency, examples: [] };
}

function child(group_id: string, child_node_id: string, frequency = 1.0): ChildSchema {
  return { group_id, child_node_id, frequency };
}

function makeSchema(overrides: Partial<NodeSchema> = {}): NodeSchema {
  return {
    node_id: "TestNode",
    section: "TestSection",
    sample_count: 100,
    attributes: [],
    children: [],
    ...overrides,
  };
}

// ─── Schema with only field attributes → layout has rows ─────────────

describe("schema with only field attributes", () => {
  it("produces rows and no childGroups", () => {
    const schema = makeSchema({
      attributes: [
        attr("UUID", "guid", 1.0),
        attr("Name", "FixedString", 0.95),
        attr("Level", "int32", 0.90),
        attr("TableUUID", "guid", 0.85),
      ],
    });
    const layout = autoLayoutFromSchema(schema);

    expect(layout.rows).toBeDefined();
    expect(layout.rows!.length).toBeGreaterThan(0);
    expect(layout.childGroups).toBeUndefined();

    const allKeys = layout.rows!.flatMap(r => r.items.map(i => i.key));
    expect(allKeys).toContain("Name");
    expect(allKeys).toContain("Level");
    expect(allKeys).toContain("TableUUID");
    // UUID excluded as identity attr
    expect(allKeys).not.toContain("UUID");
  });

  it("handledFieldKeys includes all non-identity, non-bool attrs", () => {
    const schema = makeSchema({
      attributes: [
        attr("UUID", "guid", 1.0),
        attr("Alpha", "FixedString", 0.95),
        attr("Beta", "int32", 0.90),
      ],
    });
    const layout = autoLayoutFromSchema(schema);

    expect(layout.handledFieldKeys).toEqual(["Alpha", "Beta"]);
    expect(layout.handledBooleanKeys).toEqual([]);
  });
});

// ─── Schema with children → layout has childGroups ───────────────────

describe("schema with children", () => {
  it("produces childGroups matching schema children", () => {
    const schema = makeSchema({
      attributes: [attr("UUID", "guid", 1.0)],
      children: [
        child("SubclassGroup", "Subclass", 0.3),
        child("SpellSlotGroup", "SpellSlot", 0.5),
        child("BoostGroup", "Boost", 0.8),
      ],
    });
    const layout = autoLayoutFromSchema(schema);

    expect(layout.childGroups).toBeDefined();
    expect(layout.childGroups).toHaveLength(3);
    expect(layout.childGroups![0]).toEqual({ title: "SubclassGroup", types: ["Subclass"] });
    expect(layout.childGroups![1]).toEqual({ title: "SpellSlotGroup", types: ["SpellSlot"] });
    expect(layout.childGroups![2]).toEqual({ title: "BoostGroup", types: ["Boost"] });
  });

  it("includes both rows and childGroups when attrs and children present", () => {
    const schema = makeSchema({
      attributes: [
        attr("UUID", "guid", 1.0),
        attr("Name", "FixedString", 0.95),
      ],
      children: [child("Tags", "Tag", 0.8)],
    });
    const layout = autoLayoutFromSchema(schema);

    expect(layout.rows).toBeDefined();
    expect(layout.childGroups).toBeDefined();
    expect(layout.childGroups).toHaveLength(1);
  });
});

// ─── Mixed frequency attrs → subsections for optional/rare ───────────

describe("mixed frequency attributes", () => {
  it("creates Optional Fields subsection for 0.3–0.8 frequency", () => {
    const schema = makeSchema({
      attributes: [
        attr("UUID", "guid", 1.0),
        attr("Name", "FixedString", 0.95),
        attr("MidFreq", "FixedString", 0.50),
      ],
    });
    const layout = autoLayoutFromSchema(schema);

    const optSub = layout.subsections?.find(s => s.title === "Optional Fields");
    expect(optSub).toBeDefined();
    const keys = optSub!.rows.flatMap(r => r.items.map(i => i.key));
    expect(keys).toContain("MidFreq");
  });

  it("creates Rare Fields subsection for <0.3 frequency", () => {
    const schema = makeSchema({
      attributes: [
        attr("UUID", "guid", 1.0),
        attr("Name", "FixedString", 0.95),
        attr("Obscure", "FixedString", 0.05),
      ],
    });
    const layout = autoLayoutFromSchema(schema);

    const rareSub = layout.subsections?.find(s => s.title === "Rare Fields");
    expect(rareSub).toBeDefined();
    expect(rareSub!.collapsed).toBe(true);
    const keys = rareSub!.rows.flatMap(r => r.items.map(i => i.key));
    expect(keys).toContain("Obscure");
  });

  it("creates both Optional and Rare subsections when both frequency ranges present", () => {
    const schema = makeSchema({
      attributes: [
        attr("UUID", "guid", 1.0),
        attr("Name", "FixedString", 0.95),
        attr("Medium", "FixedString", 0.55),
        attr("Scarce", "FixedString", 0.10),
      ],
    });
    const layout = autoLayoutFromSchema(schema);

    expect(layout.subsections).toBeDefined();
    expect(layout.subsections!.length).toBe(2);

    const titles = layout.subsections!.map(s => s.title);
    expect(titles).toContain("Optional Fields");
    expect(titles).toContain("Rare Fields");
  });

  it("main rows only contain freq ≥0.8 attrs", () => {
    const schema = makeSchema({
      attributes: [
        attr("UUID", "guid", 1.0),
        attr("High", "FixedString", 0.85),
        attr("Mid", "FixedString", 0.60),
        attr("Low", "FixedString", 0.15),
      ],
    });
    const layout = autoLayoutFromSchema(schema);

    const mainKeys = (layout.rows ?? []).flatMap(r => r.items.map(i => i.key));
    expect(mainKeys).toContain("High");
    expect(mainKeys).not.toContain("Mid");
    expect(mainKeys).not.toContain("Low");
  });
});

// ─── Semantic grouping of related fields ─────────────────────────────

describe("semantic field grouping", () => {
  it("groups Race-related fields together", () => {
    const schema = makeSchema({
      attributes: [
        attr("UUID", "guid", 1.0),
        attr("RaceUUID", "FixedString", 0.95),
        attr("SubRaceUUID", "FixedString", 0.90),
        attr("DisplayTypeUUID", "FixedString", 0.85),
      ],
    });
    const layout = autoLayoutFromSchema(schema);
    expect(layout.rows).toBeDefined();

    // The Race semantic group matches RaceUUID, SubRaceUUID, DisplayTypeUUID
    const raceRow = layout.rows!.find(
      r => r.items.length >= 2 &&
        r.items.some(i => i.key === "RaceUUID") &&
        r.items.some(i => i.key === "SubRaceUUID"),
    );
    expect(raceRow).toBeDefined();
  });

  it("groups Template-related fields together", () => {
    const schema = makeSchema({
      attributes: [
        attr("UUID", "guid", 1.0),
        attr("DefaultsTemplate", "FixedString", 0.95),
        attr("RootTemplate", "FixedString", 0.90),
        attr("ParentTemplateId", "FixedString", 0.85),
      ],
    });
    const layout = autoLayoutFromSchema(schema);
    expect(layout.rows).toBeDefined();

    const templateRow = layout.rows!.find(
      r => r.items.length >= 2 &&
        r.items.some(i => i.key === "DefaultsTemplate") &&
        r.items.some(i => i.key === "RootTemplate"),
    );
    expect(templateRow).toBeDefined();
  });
});

// ─── Edge cases ──────────────────────────────────────────────────────

describe("edge cases", () => {
  it("empty attributes and empty children → minimal layout", () => {
    const schema = makeSchema({
      attributes: [],
      children: [],
    });
    const layout = autoLayoutFromSchema(schema);

    expect(layout.rows).toBeUndefined();
    expect(layout.subsections).toBeUndefined();
    expect(layout.sideColumnBooleans).toBeUndefined();
    expect(layout.childGroups).toBeUndefined();
    expect(layout.maxFieldColumns).toBe(3);
  });

  it("all attrs are booleans → only sideColumnBooleans, no rows", () => {
    const schema = makeSchema({
      attributes: [
        attr("UUID", "guid", 1.0),
        attr("FlagA", "bool", 0.9),
        attr("FlagB", "bool", 0.8),
        attr("FlagC", "bool", 0.5),
      ],
    });
    const layout = autoLayoutFromSchema(schema);

    expect(layout.sideColumnBooleans).toBeDefined();
    expect(layout.sideColumnBooleans).toContain("FlagA");
    expect(layout.sideColumnBooleans).toContain("FlagB");
    expect(layout.sideColumnBooleans).toContain("FlagC");
    expect(layout.rows).toBeUndefined();
  });

  it("boundary frequency 0.8 is included in main rows", () => {
    const schema = makeSchema({
      attributes: [
        attr("UUID", "guid", 1.0),
        attr("ExactBoundary", "FixedString", 0.8),
      ],
    });
    const layout = autoLayoutFromSchema(schema);

    const mainKeys = (layout.rows ?? []).flatMap(r => r.items.map(i => i.key));
    expect(mainKeys).toContain("ExactBoundary");
  });

  it("boundary frequency 0.3 is included in optional (not rare)", () => {
    const schema = makeSchema({
      attributes: [
        attr("UUID", "guid", 1.0),
        attr("Name", "FixedString", 0.95),
        attr("BoundaryOpt", "FixedString", 0.3),
      ],
    });
    const layout = autoLayoutFromSchema(schema);

    const optSub = layout.subsections?.find(s => s.title === "Optional Fields");
    expect(optSub).toBeDefined();
    const optKeys = optSub!.rows.flatMap(r => r.items.map(i => i.key));
    expect(optKeys).toContain("BoundaryOpt");
  });

  it("single field attr → one row with one item", () => {
    const schema = makeSchema({
      attributes: [
        attr("UUID", "guid", 1.0),
        attr("OnlyField", "FixedString", 0.95),
      ],
    });
    const layout = autoLayoutFromSchema(schema);

    expect(layout.rows).toBeDefined();
    expect(layout.rows).toHaveLength(1);
    expect(layout.rows![0].items).toHaveLength(1);
    expect(layout.rows![0].items[0].key).toBe("OnlyField");
  });
});
