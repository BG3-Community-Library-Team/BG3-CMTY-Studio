/**
 * Tests for UnifiedForm cascade logic, autoLayout generators,
 * and metadata priority resolution.
 *
 * Tests the LOGIC paths, not Svelte rendering. The UnifiedForm component
 * uses a 4-tier metadata cascade:
 *   Tier 1 (layout): section in FORM_LAYOUTS → layout-driven
 *   Tier 2 (caps):   section in SECTION_CAPS but NOT FORM_LAYOUTS → caps-driven
 *   Tier 3 (schema): schema available from schemaStore → schema-driven
 *   Tier 4 (fallback): no metadata → generic fallback
 */
import { describe, it, expect } from "vitest";
import { autoLayoutFromSchema, autoLayoutFromCaps } from "../lib/data/autoLayout.js";
import { FORM_LAYOUTS, type FormLayout } from "../lib/data/formLayouts.js";
import { SECTION_CAPS, type SectionCapabilities } from "../lib/data/sectionCaps.js";
import type { NodeSchema, AttrSchema, ChildSchema } from "../lib/utils/tauri.js";
import { classifyLsxType, renderTypeToFieldType, inferComboboxDescriptor } from "../lib/utils/lsxTypes.js";

// ─── Helpers ─────────────────────────────────────────────────────────

function attr(name: string, attr_type: string, frequency: number, examples: string[] = []): AttrSchema {
  return { name, attr_type, frequency, examples };
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

// ─── autoLayoutFromSchema ────────────────────────────────────────────

describe("autoLayoutFromSchema", () => {
  it("places all high-frequency attrs (≥80%) in main rows", () => {
    const schema = makeSchema({
      attributes: [
        attr("UUID", "guid", 1.0),
        attr("Name", "FixedString", 0.95),
        attr("DisplayName", "TranslatedString", 0.90),
        attr("Level", "int32", 0.85),
      ],
    });
    const layout = autoLayoutFromSchema(schema);

    // UUID is excluded (identity attr), the other 3 should be in main rows
    expect(layout.rows).toBeDefined();
    const allRowKeys = layout.rows!.flatMap(r => r.items.map(i => i.key));
    expect(allRowKeys).toContain("Name");
    expect(allRowKeys).toContain("DisplayName");
    expect(allRowKeys).toContain("Level");
    expect(allRowKeys).not.toContain("UUID");

    // No subsections needed (no optional/rare)
    expect(layout.subsections ?? []).toHaveLength(0);
  });

  it("groups attrs into main, optional, and rare by frequency", () => {
    const schema = makeSchema({
      attributes: [
        attr("UUID", "guid", 1.0),
        attr("Name", "FixedString", 0.95),          // main (≥0.8)
        attr("Description", "FixedString", 0.50),    // optional (0.3–0.8)
        attr("RareField", "FixedString", 0.10),       // rare (<0.3)
      ],
    });
    const layout = autoLayoutFromSchema(schema);

    const mainKeys = layout.rows!.flatMap(r => r.items.map(i => i.key));
    expect(mainKeys).toContain("Name");
    expect(mainKeys).not.toContain("Description");
    expect(mainKeys).not.toContain("RareField");

    expect(layout.subsections).toBeDefined();
    expect(layout.subsections!.length).toBeGreaterThanOrEqual(2);

    const optionalSub = layout.subsections!.find(s => s.title === "Optional Fields");
    const rareSub = layout.subsections!.find(s => s.title === "Rare Fields");

    expect(optionalSub).toBeDefined();
    const optKeys = optionalSub!.rows.flatMap(r => r.items.map(i => i.key));
    expect(optKeys).toContain("Description");

    expect(rareSub).toBeDefined();
    const rareKeys = rareSub!.rows.flatMap(r => r.items.map(i => i.key));
    expect(rareKeys).toContain("RareField");
  });

  it("rare subsection is collapsed by default", () => {
    const schema = makeSchema({
      attributes: [
        attr("UUID", "guid", 1.0),
        attr("Name", "FixedString", 0.95),
        attr("RareField", "FixedString", 0.05),
      ],
    });
    const layout = autoLayoutFromSchema(schema);
    const rareSub = layout.subsections?.find(s => s.title === "Rare Fields");
    expect(rareSub).toBeDefined();
    expect(rareSub!.collapsed).toBe(true);
  });

  it("separates boolean attrs into sideColumnBooleans", () => {
    const schema = makeSchema({
      attributes: [
        attr("UUID", "guid", 1.0),
        attr("Name", "FixedString", 0.95),
        attr("IsMulticlass", "bool", 0.80),
        attr("AllowImprovement", "bool", 0.60),
      ],
    });
    const layout = autoLayoutFromSchema(schema);

    expect(layout.sideColumnBooleans).toBeDefined();
    expect(layout.sideColumnBooleans).toContain("IsMulticlass");
    expect(layout.sideColumnBooleans).toContain("AllowImprovement");

    // Booleans should NOT appear in rows
    const allRowKeys = (layout.rows ?? []).flatMap(r => r.items.map(i => i.key));
    expect(allRowKeys).not.toContain("IsMulticlass");
    expect(allRowKeys).not.toContain("AllowImprovement");
  });

  it("populates childGroups from schema children", () => {
    const schema = makeSchema({
      attributes: [attr("UUID", "guid", 1.0)],
      children: [
        child("SubclassGroup", "Subclass"),
        child("SpellGroup", "SpellSlot", 0.8),
      ],
    });
    const layout = autoLayoutFromSchema(schema);

    expect(layout.childGroups).toBeDefined();
    expect(layout.childGroups).toHaveLength(2);
    expect(layout.childGroups![0]).toEqual({ title: "SubclassGroup", types: ["Subclass"] });
    expect(layout.childGroups![1]).toEqual({ title: "SpellGroup", types: ["SpellSlot"] });
  });

  it("handles large schemas (50+ attrs) with subsection structure", () => {
    const attrs: AttrSchema[] = [attr("UUID", "guid", 1.0)];
    for (let i = 0; i < 30; i++) {
      attrs.push(attr(`MainField${i}`, "FixedString", 0.85));
    }
    for (let i = 0; i < 15; i++) {
      attrs.push(attr(`OptField${i}`, "FixedString", 0.50));
    }
    for (let i = 0; i < 10; i++) {
      attrs.push(attr(`RareField${i}`, "FixedString", 0.10));
    }
    const schema = makeSchema({ attributes: attrs });
    const layout = autoLayoutFromSchema(schema);

    // Should have both optional and rare subsections
    expect(layout.subsections).toBeDefined();
    expect(layout.subsections!.length).toBeGreaterThanOrEqual(2);

    // handledFieldKeys should cover all non-identity, non-bool keys
    expect(layout.handledFieldKeys).toBeDefined();
    expect(layout.handledFieldKeys!.length).toBe(55); // 30 + 15 + 10

    // handledBooleanKeys should be empty (no bools added)
    expect(layout.handledBooleanKeys).toBeDefined();
    expect(layout.handledBooleanKeys!.length).toBe(0);
  });

  it("excludes MapKey from field layout (identity attr)", () => {
    const schema = makeSchema({
      attributes: [
        attr("UUID", "guid", 1.0),
        attr("MapKey", "FixedString", 1.0),
        attr("Name", "FixedString", 0.95),
      ],
    });
    const layout = autoLayoutFromSchema(schema);
    const allKeys = (layout.rows ?? []).flatMap(r => r.items.map(i => i.key));
    expect(allKeys).not.toContain("UUID");
    expect(allKeys).not.toContain("MapKey");
    expect(allKeys).toContain("Name");
  });

  it("returns empty layout for schema with only identity attrs", () => {
    const schema = makeSchema({
      attributes: [
        attr("UUID", "guid", 1.0),
        attr("MapKey", "FixedString", 1.0),
      ],
    });
    const layout = autoLayoutFromSchema(schema);

    // No rows, no subsections, no booleans
    expect(layout.rows).toBeUndefined();
    expect(layout.subsections).toBeUndefined();
    expect(layout.sideColumnBooleans).toBeUndefined();
    expect(layout.childGroups).toBeUndefined();
  });

  it("groups semantically related fields into rows", () => {
    const schema = makeSchema({
      attributes: [
        attr("UUID", "guid", 1.0),
        attr("Name", "FixedString", 0.95),
        attr("DisplayName", "TranslatedString", 0.95),
        attr("Description", "FixedString", 0.90),
        attr("DisplayDescription", "FixedString", 0.90),
      ],
    });
    const layout = autoLayoutFromSchema(schema);
    expect(layout.rows).toBeDefined();

    // Name/DisplayName/Description/DisplayDescription should be semantically grouped
    // The semantic grouping "Name / Display" matches Name, DisplayName, Description, DisplayDescription
    const groupedRow = layout.rows!.find(
      (r) => r.items.length >= 2 && r.items.some(i => i.key === "Name") && r.items.some(i => i.key === "DisplayName")
    );
    expect(groupedRow).toBeDefined();
  });

  it("chunks ungrouped fields into rows of 3", () => {
    const schema = makeSchema({
      attributes: [
        attr("UUID", "guid", 1.0),
        attr("Alpha", "FixedString", 0.95),
        attr("Beta", "FixedString", 0.95),
        attr("Gamma", "FixedString", 0.95),
        attr("Delta", "FixedString", 0.95),
        attr("Epsilon", "FixedString", 0.95),
      ],
    });
    const layout = autoLayoutFromSchema(schema);
    expect(layout.rows).toBeDefined();

    // 5 ungrouped fields → 2 rows (3 + 2)
    const totalItems = layout.rows!.reduce((sum, r) => sum + r.items.length, 0);
    expect(totalItems).toBe(5);
    // Each row <= 3 items
    for (const row of layout.rows!) {
      expect(row.items.length).toBeLessThanOrEqual(3);
    }
  });

  // Representative schemas for different BG3 section types

  it("handles a Progression-like schema", () => {
    const schema = makeSchema({
      node_id: "Progression",
      section: "Progressions",
      sample_count: 500,
      attributes: [
        attr("UUID", "guid", 1.0),
        attr("TableUUID", "guid", 0.98),
        attr("Name", "FixedString", 0.95),
        attr("Level", "int32", 0.98),
        attr("AllowImprovement", "bool", 0.20),
        attr("IsMulticlass", "bool", 0.15),
        attr("Boosts", "FixedString", 0.60),
        attr("PassivesAdded", "FixedString", 0.55),
      ],
      children: [child("SubClasses", "Subclass", 0.10)],
    });
    const layout = autoLayoutFromSchema(schema);

    // Main fields: TableUUID, Name, Level (≥0.8)
    const mainKeys = (layout.rows ?? []).flatMap(r => r.items.map(i => i.key));
    expect(mainKeys).toContain("TableUUID");
    expect(mainKeys).toContain("Name");
    expect(mainKeys).toContain("Level");

    // Booleans in side column
    expect(layout.sideColumnBooleans).toContain("AllowImprovement");
    expect(layout.sideColumnBooleans).toContain("IsMulticlass");

    // Optional fields
    const optSub = layout.subsections?.find(s => s.title === "Optional Fields");
    expect(optSub).toBeDefined();
    const optKeys = optSub!.rows.flatMap(r => r.items.map(i => i.key));
    expect(optKeys).toContain("Boosts");
    expect(optKeys).toContain("PassivesAdded");

    // Children
    expect(layout.childGroups).toHaveLength(1);
    expect(layout.childGroups![0].types).toContain("Subclass");
  });

  it("handles a God-like schema (fields + children, no bools)", () => {
    const schema = makeSchema({
      node_id: "God",
      section: "Gods",
      sample_count: 20,
      attributes: [
        attr("UUID", "guid", 1.0),
        attr("Name", "FixedString", 1.0),
        attr("DisplayName", "TranslatedString", 1.0),
        attr("Description", "TranslatedString", 0.90),
      ],
      children: [child("Tags", "Tag", 0.80)],
    });
    const layout = autoLayoutFromSchema(schema);

    expect(layout.sideColumnBooleans).toBeUndefined();
    expect(layout.childGroups).toHaveLength(1);
    expect(layout.rows).toBeDefined();
  });
});

// ─── autoLayoutFromCaps ──────────────────────────────────────────────

describe("autoLayoutFromCaps", () => {
  it("generates rows from fieldKeys (3 per row)", () => {
    const caps: SectionCapabilities = {
      fieldKeys: ["Name", "Level", "TableUUID", "Description", "ExtraField"],
    };
    const layout = autoLayoutFromCaps(caps);

    expect(layout.rows).toBeDefined();
    // 5 fields → 2 rows (3 + 2)
    expect(layout.rows!.length).toBe(2);
    expect(layout.rows![0].items).toHaveLength(3);
    expect(layout.rows![1].items).toHaveLength(2);
    expect(layout.handledFieldKeys).toEqual(caps.fieldKeys);
  });

  it("places booleanKeys in sideColumnBooleans", () => {
    const caps: SectionCapabilities = {
      booleanKeys: ["AllowImprovement", "IsMulticlass"],
    };
    const layout = autoLayoutFromCaps(caps);

    expect(layout.sideColumnBooleans).toEqual(["AllowImprovement", "IsMulticlass"]);
    expect(layout.handledBooleanKeys).toEqual(caps.booleanKeys);
  });

  it("creates subsection for stringTypes", () => {
    const caps: SectionCapabilities = {
      stringTypes: ["Boosts", "PassivesAdded"],
    };
    const layout = autoLayoutFromCaps(caps);

    expect(layout.subsections).toBeDefined();
    expect(layout.subsections).toHaveLength(1);
    expect(layout.subsections![0].title).toBe("String Fields");
    expect(layout.subsections![0].stringKeys).toEqual(["Boosts", "PassivesAdded"]);
  });

  it("creates childGroups from childTypes", () => {
    const caps: SectionCapabilities = {
      childTypes: ["Subclasses", "Tags"],
    };
    const layout = autoLayoutFromCaps(caps);

    expect(layout.childGroups).toBeDefined();
    expect(layout.childGroups).toHaveLength(2);
    expect(layout.childGroups![0]).toEqual({ title: "Subclasses", types: ["Subclasses"] });
    expect(layout.childGroups![1]).toEqual({ title: "Tags", types: ["Tags"] });
  });

  it("produces empty layout from empty caps", () => {
    const caps: SectionCapabilities = {};
    const layout = autoLayoutFromCaps(caps);

    expect(layout.maxFieldColumns).toBe(3);
    expect(layout.rows).toBeUndefined();
    expect(layout.sideColumnBooleans).toBeUndefined();
    expect(layout.subsections).toBeUndefined();
    expect(layout.childGroups).toBeUndefined();
    expect(layout.handledFieldKeys).toBeUndefined();
    expect(layout.handledBooleanKeys).toBeUndefined();
  });

  it("handles caps with all properties populated", () => {
    const caps: SectionCapabilities = {
      fieldKeys: ["Name", "Level"],
      booleanKeys: ["IsMulticlass"],
      stringTypes: ["Boosts"],
      childTypes: ["Subclasses"],
    };
    const layout = autoLayoutFromCaps(caps);

    expect(layout.rows).toBeDefined();
    expect(layout.sideColumnBooleans).toBeDefined();
    expect(layout.subsections).toBeDefined();
    expect(layout.childGroups).toBeDefined();
    expect(layout.handledFieldKeys).toEqual(["Name", "Level"]);
    expect(layout.handledBooleanKeys).toEqual(["IsMulticlass"]);
  });
});

// ─── Metadata priority cascade (tier determination) ──────────────────

describe("metadata priority cascade", () => {
  // Tier determination logic from UnifiedForm.svelte:
  //   const _hasFormLayout = _section in FORM_LAYOUTS;
  //   const _hasSectionCaps = _section in SECTION_CAPS;
  //   const tier = _hasFormLayout ? 'layout' : _hasSectionCaps ? 'caps' : 'schema';

  function determineTier(section: string): "layout" | "caps" | "schema" {
    if (section in FORM_LAYOUTS) return "layout";
    if (section in SECTION_CAPS) return "caps";
    return "schema";
  }

  describe("tier 1: layout-driven sections", () => {
    it.each([
      "Progressions", "Feats", "Races", "Origins", "Backgrounds",
      "ClassDescriptions", "Gods", "Tags", "ActionResources",
      "CharacterCreationPresets", "CompanionPresets", "Voices",
      "BackgroundGoals", "ColorDefinitions", "EquipmentTypes",
      "Levelmaps", "RootTemplates", "Shapeshift", "FeatDescriptions",
    ])("section '%s' resolves to tier 'layout'", (section) => {
      expect(determineTier(section)).toBe("layout");
      expect(FORM_LAYOUTS[section]).toBeDefined();
    });
  });

  describe("tier 2: caps-only sections", () => {
    // Sections that appear in SECTION_CAPS but NOT in FORM_LAYOUTS
    it.each([
      "Lists", "Spells", "ActionResourceGroups",
    ])("section '%s' resolves to tier 'caps' (in SECTION_CAPS, not in FORM_LAYOUTS)", (section) => {
      expect(determineTier(section)).toBe("caps");
      expect(section in SECTION_CAPS).toBe(true);
      expect(section in FORM_LAYOUTS).toBe(false);
    });
  });

  describe("tier 3/4: schema-driven or fallback", () => {
    it("unknown section resolves to tier 'schema'", () => {
      expect(determineTier("SomeNewSection")).toBe("schema");
      expect("SomeNewSection" in FORM_LAYOUTS).toBe(false);
      expect("SomeNewSection" in SECTION_CAPS).toBe(false);
    });

    it("completely novel section resolves to 'schema'", () => {
      expect(determineTier("InventedSectionXYZ")).toBe("schema");
    });
  });

  describe("cascade consistency", () => {
    it("every FORM_LAYOUTS key is also in SECTION_CAPS or is layout-only", () => {
      // Sections with FORM_LAYOUTS always resolve to 'layout' regardless of SECTION_CAPS presence
      for (const section of Object.keys(FORM_LAYOUTS)) {
        expect(determineTier(section)).toBe("layout");
      }
    });

    it("FORM_LAYOUTS sections never fall through to caps or schema", () => {
      for (const section of Object.keys(FORM_LAYOUTS)) {
        const tier = determineTier(section);
        expect(tier).not.toBe("caps");
        expect(tier).not.toBe("schema");
      }
    });
  });
});

// ─── capsFromSchema logic (tested indirectly) ───────────────────────

describe("capsFromSchema logic", () => {
  // capsFromSchema is defined inside UnifiedForm.svelte and not exported.
  // We replicate the logic here and verify consistency with autoLayoutFromSchema behavior.

  function capsFromSchema(schema: NodeSchema): SectionCapabilities {
    const booleanKeys = schema.attributes
      .filter(a => a.attr_type === "bool" && a.name !== "UUID" && a.name !== "MapKey")
      .map(a => a.name);
    const fieldKeys = schema.attributes
      .filter(a => a.attr_type !== "bool" && a.name !== "UUID" && a.name !== "MapKey")
      .map(a => a.name);
    const fieldTypes: Record<string, string> = {};
    for (const a of schema.attributes) {
      if (a.name !== "UUID" && a.name !== "MapKey") {
        fieldTypes[a.name] = a.attr_type;
      }
    }
    return {
      hasFields: fieldKeys.length > 0,
      hasBooleans: booleanKeys.length > 0,
      hasChildren: schema.children.length > 0,
      fieldKeys,
      booleanKeys,
      fieldTypes,
      childTypes: schema.children.map(c => c.child_node_id),
    };
  }

  it("separates bool attrs from non-bool attrs", () => {
    const schema = makeSchema({
      attributes: [
        attr("UUID", "guid", 1.0),
        attr("Name", "FixedString", 0.95),
        attr("IsActive", "bool", 0.80),
        attr("Level", "int32", 0.90),
      ],
    });
    const caps = capsFromSchema(schema);

    expect(caps.fieldKeys).toEqual(["Name", "Level"]);
    expect(caps.booleanKeys).toEqual(["IsActive"]);
    expect(caps.hasFields).toBe(true);
    expect(caps.hasBooleans).toBe(true);
  });

  it("excludes UUID and MapKey from both fieldKeys and booleanKeys", () => {
    const schema = makeSchema({
      attributes: [
        attr("UUID", "guid", 1.0),
        attr("MapKey", "FixedString", 1.0),
        attr("Name", "FixedString", 0.95),
      ],
    });
    const caps = capsFromSchema(schema);

    expect(caps.fieldKeys).toEqual(["Name"]);
    expect(caps.booleanKeys).toEqual([]);
    expect(caps.fieldKeys).not.toContain("UUID");
    expect(caps.fieldKeys).not.toContain("MapKey");
  });

  it("populates fieldTypes map correctly", () => {
    const schema = makeSchema({
      attributes: [
        attr("UUID", "guid", 1.0),
        attr("Name", "FixedString", 0.95),
        attr("Level", "int32", 0.90),
        attr("IsActive", "bool", 0.80),
      ],
    });
    const caps = capsFromSchema(schema);

    expect(caps.fieldTypes).toEqual({
      Name: "FixedString",
      Level: "int32",
      IsActive: "bool",
    });
    // UUID excluded from fieldTypes
    expect(caps.fieldTypes!["UUID"]).toBeUndefined();
  });

  it("extracts childTypes from schema children", () => {
    const schema = makeSchema({
      attributes: [attr("UUID", "guid", 1.0)],
      children: [
        child("SubClasses", "Subclass"),
        child("SpellSlots", "SpellSlot"),
      ],
    });
    const caps = capsFromSchema(schema);

    expect(caps.hasChildren).toBe(true);
    expect(caps.childTypes).toEqual(["Subclass", "SpellSlot"]);
  });

  it("returns hasChildren=false when no children", () => {
    const schema = makeSchema({
      attributes: [attr("UUID", "guid", 1.0), attr("Name", "FixedString", 0.9)],
      children: [],
    });
    const caps = capsFromSchema(schema);
    expect(caps.hasChildren).toBe(false);
    expect(caps.childTypes).toEqual([]);
  });

  it("handles schema with only booleans (no fields)", () => {
    const schema = makeSchema({
      attributes: [
        attr("UUID", "guid", 1.0),
        attr("FlagA", "bool", 0.9),
        attr("FlagB", "bool", 0.8),
      ],
    });
    const caps = capsFromSchema(schema);
    expect(caps.hasFields).toBe(false);
    expect(caps.hasBooleans).toBe(true);
    expect(caps.fieldKeys).toEqual([]);
    expect(caps.booleanKeys).toEqual(["FlagA", "FlagB"]);
  });
});

// ─── Large section collapse optimization ─────────────────────────────

describe("large section collapse optimization", () => {
  // From UnifiedForm.svelte:
  //   const totalAttrs = (baseLayout.handledFieldKeys?.length ?? 0) + (baseLayout.handledBooleanKeys?.length ?? 0);
  //   if (totalAttrs > 50 && baseLayout.subsections) {
  //     return { ...baseLayout, subsections: baseLayout.subsections.map(s => ({ ...s, collapsed: true })) };
  //   }

  function applyCollapseOptimization(layout: FormLayout): FormLayout {
    const totalAttrs = (layout.handledFieldKeys?.length ?? 0) + (layout.handledBooleanKeys?.length ?? 0);
    if (totalAttrs > 50 && layout.subsections) {
      return {
        ...layout,
        subsections: layout.subsections.map(s => ({ ...s, collapsed: true })),
      };
    }
    return layout;
  }

  it("collapses all subsections when >50 total attrs", () => {
    const attrs: AttrSchema[] = [attr("UUID", "guid", 1.0)];
    for (let i = 0; i < 40; i++) {
      attrs.push(attr(`Field${i}`, "FixedString", 0.85));
    }
    for (let i = 0; i < 15; i++) {
      attrs.push(attr(`OptField${i}`, "FixedString", 0.50));
    }
    const schema = makeSchema({ attributes: attrs });
    const baseLayout = autoLayoutFromSchema(schema);

    // Verify we have >50 attrs
    expect(baseLayout.handledFieldKeys!.length).toBeGreaterThan(50);

    const resolved = applyCollapseOptimization(baseLayout);
    expect(resolved.subsections).toBeDefined();
    for (const sub of resolved.subsections!) {
      expect(sub.collapsed).toBe(true);
    }
  });

  it("does not collapse when ≤50 total attrs", () => {
    const schema = makeSchema({
      attributes: [
        attr("UUID", "guid", 1.0),
        attr("Name", "FixedString", 0.95),
        attr("Description", "FixedString", 0.50),
        attr("RareField", "FixedString", 0.10),
      ],
    });
    const baseLayout = autoLayoutFromSchema(schema);

    const resolved = applyCollapseOptimization(baseLayout);

    // Rare subsection was already collapsed by autoLayoutFromSchema, but Optional should remain uncollapsed
    const optSub = resolved.subsections?.find(s => s.title === "Optional Fields");
    if (optSub) {
      expect(optSub.collapsed).toBeUndefined();
    }
  });

  it("preserves layout when no subsections exist", () => {
    const schema = makeSchema({
      attributes: [
        attr("UUID", "guid", 1.0),
        attr("Name", "FixedString", 0.95),
        attr("Level", "int32", 0.90),
      ],
    });
    const baseLayout = autoLayoutFromSchema(schema);
    const resolved = applyCollapseOptimization(baseLayout);

    // No subsections → layout unchanged
    expect(resolved).toEqual(baseLayout);
  });

  it("counts booleans toward total attr threshold", () => {
    const attrs: AttrSchema[] = [attr("UUID", "guid", 1.0)];
    for (let i = 0; i < 35; i++) {
      attrs.push(attr(`Field${i}`, "FixedString", 0.85));
    }
    for (let i = 0; i < 20; i++) {
      attrs.push(attr(`Bool${i}`, "bool", 0.85));
    }
    // Add some optional to produce subsections
    for (let i = 0; i < 5; i++) {
      attrs.push(attr(`Opt${i}`, "FixedString", 0.50));
    }
    const schema = makeSchema({ attributes: attrs });
    const baseLayout = autoLayoutFromSchema(schema);

    // 35 fields + 20 bools + 5 optional = 60 total handled
    expect(
      (baseLayout.handledFieldKeys?.length ?? 0) + (baseLayout.handledBooleanKeys?.length ?? 0)
    ).toBeGreaterThan(50);

    const resolved = applyCollapseOptimization(baseLayout);
    expect(resolved.subsections).toBeDefined();
    for (const sub of resolved.subsections!) {
      expect(sub.collapsed).toBe(true);
    }
  });
});

// ─── autoLayoutFromCaps with real SECTION_CAPS entries ──────────────

describe("autoLayoutFromCaps with real SECTION_CAPS", () => {
  it("generates layout for Lists caps (isList only)", () => {
    const caps = SECTION_CAPS["Lists"];
    const layout = autoLayoutFromCaps(caps);

    // Lists has no fieldKeys, no booleanKeys, etc. — just { isList: true }
    expect(layout.maxFieldColumns).toBe(3);
    expect(layout.rows).toBeUndefined();
  });

  it("generates layout for Spells caps (isSpell only)", () => {
    const caps = SECTION_CAPS["Spells"];
    const layout = autoLayoutFromCaps(caps);

    expect(layout.maxFieldColumns).toBe(3);
    expect(layout.rows).toBeUndefined();
  });

  it("generates layout for ActionResourceGroups caps (isARG only)", () => {
    const caps = SECTION_CAPS["ActionResourceGroups"];
    const layout = autoLayoutFromCaps(caps);

    expect(layout.maxFieldColumns).toBe(3);
    expect(layout.rows).toBeUndefined();
  });

  it("generates layout for Progressions caps (full caps)", () => {
    const caps = SECTION_CAPS["Progressions"];
    const layout = autoLayoutFromCaps(caps);

    // Should have rows for fieldKeys
    expect(layout.rows).toBeDefined();
    const rowKeys = layout.rows!.flatMap(r => r.items.map(i => i.key));
    expect(rowKeys).toContain("TableUUID");
    expect(rowKeys).toContain("Name");
    expect(rowKeys).toContain("Level");

    // Should have booleans
    expect(layout.sideColumnBooleans).toContain("AllowImprovement");
    expect(layout.sideColumnBooleans).toContain("IsMulticlass");

    // Should have string subsection
    expect(layout.subsections).toBeDefined();
    expect(layout.subsections![0].stringKeys).toContain("Boosts");

    // Should have children
    expect(layout.childGroups).toBeDefined();
    expect(layout.childGroups![0].types).toContain("Subclasses");
  });
});

// ─── Layout structure assertions ─────────────────────────────────────

describe("FORM_LAYOUTS structural integrity", () => {
  it("all FORM_LAYOUTS entries are valid FormLayout objects", () => {
    for (const [section, layout] of Object.entries(FORM_LAYOUTS)) {
      expect(layout).toBeDefined();
      // maxFieldColumns is set on some layouts
      if (layout.rows) {
        expect(Array.isArray(layout.rows)).toBe(true);
        for (const row of layout.rows) {
          expect(Array.isArray(row.items)).toBe(true);
          for (const item of row.items) {
            expect(item.key).toBeTruthy();
            expect(["field", "boolean"]).toContain(item.type);
          }
        }
      }
      if (layout.subsections) {
        expect(Array.isArray(layout.subsections)).toBe(true);
        for (const sub of layout.subsections) {
          expect(typeof sub.title).toBe("string");
          expect(Array.isArray(sub.rows)).toBe(true);
        }
      }
    }
  });

  it("FORM_LAYOUTS covers all expected high-priority sections", () => {
    const expected = [
      "Progressions", "Feats", "Races", "Origins", "Backgrounds",
      "ClassDescriptions", "Gods", "Tags",
    ];
    for (const section of expected) {
      expect(FORM_LAYOUTS[section]).toBeDefined();
    }
  });
});

describe("SECTION_CAPS structural integrity", () => {
  it("all SECTION_CAPS entries have valid capability flags", () => {
    const validFlags = new Set([
      "hasBooleans", "hasFields", "hasSelectors", "hasStrings",
      "hasChildren", "hasTags", "hasSubclasses", "isList", "isSpell", "isARG",
      "hasBlacklist", "booleanKeys", "stringTypes", "childTypes", "fieldKeys",
      "fieldTypes", "fieldCombobox", "tagTypes", "nodeTypes", "nodeTypeCaps",
    ]);

    for (const [section, caps] of Object.entries(SECTION_CAPS)) {
      for (const key of Object.keys(caps)) {
        expect(validFlags.has(key)).toBe(true);
      }
    }
  });

  it("every caps with fieldKeys has matching fieldTypes entries", () => {
    for (const [section, caps] of Object.entries(SECTION_CAPS)) {
      if (caps.fieldKeys && caps.fieldTypes) {
        for (const key of caps.fieldKeys) {
          expect(
            caps.fieldTypes[key],
            `${section}: fieldKey '${key}' missing from fieldTypes`
          ).toBeDefined();
        }
      }
    }
  });
});

// ─── Schema-driven combobox inference integration ────────────────────

describe("schema-driven combobox inference", () => {
  it("RaceUUID FixedString with UUID examples → section:Races combobox", () => {
    const renderType = classifyLsxType("FixedString", "RaceUUID", [
      "0eb594cb-8820-4be6-a58d-8be7a1a98fba",
    ]);
    expect(renderType).toBe("uuid");
    expect(inferComboboxDescriptor("RaceUUID", "FixedString", renderType)).toBe("section:Races");
  });

  it("TranslatedString fields get loca: combobox", () => {
    const renderType = classifyLsxType("TranslatedString", "DisplayName");
    expect(renderType).toBe("loca");
    expect(inferComboboxDescriptor("DisplayName", "TranslatedString", renderType)).toBe("loca:");
  });

  it("int32 fields get 'int' fieldType", () => {
    const renderType = classifyLsxType("int32", "Level");
    expect(renderType).toBe("number");
    expect(renderTypeToFieldType(renderType)).toBe("int");
  });

  it("float fields get 'float' fieldType", () => {
    const renderType = classifyLsxType("float", "Weight");
    expect(renderType).toBe("float");
    expect(renderTypeToFieldType(renderType)).toBe("float");
  });

  it("bool fields get 'bool' fieldType", () => {
    const renderType = classifyLsxType("bool", "IsActive");
    expect(renderType).toBe("boolean");
    expect(renderTypeToFieldType(renderType)).toBe("bool");
  });

  it("guid fields get 'string (UUID)' fieldType", () => {
    const renderType = classifyLsxType("guid", "TableUUID");
    expect(renderType).toBe("uuid");
    expect(renderTypeToFieldType(renderType)).toBe("string (UUID)");
  });

  it("capsFromSchema + lsxType classify produces consistent results for a full schema", () => {
    const schema = makeSchema({
      attributes: [
        attr("UUID", "guid", 1.0),
        attr("Name", "FixedString", 0.95),
        attr("DisplayName", "TranslatedString", 0.95),
        attr("RaceUUID", "FixedString", 0.90),
        attr("Level", "int32", 0.85),
        attr("Weight", "float", 0.80),
        attr("IsActive", "bool", 0.80),
      ],
    });
    const layout = autoLayoutFromSchema(schema);

    // Layout should have handled all non-identity, non-bool fields
    expect(layout.handledFieldKeys).toContain("Name");
    expect(layout.handledFieldKeys).toContain("DisplayName");
    expect(layout.handledFieldKeys).toContain("RaceUUID");
    expect(layout.handledFieldKeys).toContain("Level");
    expect(layout.handledFieldKeys).toContain("Weight");
    expect(layout.handledBooleanKeys).toContain("IsActive");

    // Type classification is consistent
    expect(classifyLsxType("TranslatedString", "DisplayName")).toBe("loca");
    expect(classifyLsxType("int32", "Level")).toBe("number");
    expect(classifyLsxType("float", "Weight")).toBe("float");
  });
});
