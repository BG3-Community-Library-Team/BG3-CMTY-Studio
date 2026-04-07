import { describe, it, expect } from "vitest";
import { getRegionId, diffEntryToLsx, sectionToLsxEntries, groupEntriesByRegion } from "../lib/utils/entryToLsx.js";
import type { DiffEntry, SectionResult } from "../lib/types/index.js";

/** Helper to build a minimal DiffEntry. */
function entry(overrides: Partial<DiffEntry> = {}): DiffEntry {
  return {
    uuid: "test-uuid",
    display_name: "Test",
    source_file: "test.lsx",
    entry_kind: "Modified",
    changes: [],
    node_id: "Progression",
    region_id: "",
    raw_attributes: { UUID: "test-uuid", Name: "TestEntry" },
    raw_attribute_types: { UUID: "guid", Name: "FixedString" },
    raw_children: {},
    ...overrides,
  };
}

describe("getRegionId", () => {
  it("maps ActionResources → ActionResourceDefinitions", () => {
    expect(getRegionId("ActionResources")).toBe("ActionResourceDefinitions");
  });

  it("maps ActionResourceGroups → ActionResourceGroupDefinitions", () => {
    expect(getRegionId("ActionResourceGroups")).toBe("ActionResourceGroupDefinitions");
  });

  it("maps SpellMetadata → Spell", () => {
    expect(getRegionId("SpellMetadata")).toBe("Spell");
  });

  it("maps Meta → Config", () => {
    expect(getRegionId("Meta")).toBe("Config");
  });

  it("returns section name as fallback for unmapped sections", () => {
    expect(getRegionId("SomeUnknown" as any)).toBe("SomeUnknown");
  });

  it("maps Progressions → Progressions (identity)", () => {
    expect(getRegionId("Progressions")).toBe("Progressions");
  });
});

describe("diffEntryToLsx", () => {
  it("maps all required fields", () => {
    const e = entry();
    const lsx = diffEntryToLsx(e);
    expect(lsx.uuid).toBe("test-uuid");
    expect(lsx.node_id).toBe("Progression");
    expect(lsx.raw_attributes).toEqual({ UUID: "test-uuid", Name: "TestEntry" });
    expect(lsx.raw_attribute_types).toEqual({ UUID: "guid", Name: "FixedString" });
    expect(lsx.raw_children).toEqual({});
  });

  it("defaults raw_attribute_types to {} when missing", () => {
    const e = entry({ raw_attribute_types: undefined as any });
    const lsx = diffEntryToLsx(e);
    expect(lsx.raw_attribute_types).toEqual({});
  });

  it("passes through raw_children", () => {
    const e = entry({ raw_children: { SubClasses: ["guid-1", "guid-2"] } });
    const lsx = diffEntryToLsx(e);
    expect(lsx.raw_children).toEqual({ SubClasses: ["guid-1", "guid-2"] });
  });
});

describe("sectionToLsxEntries", () => {
  it("maps all entries in a section", () => {
    const section: SectionResult = {
      section: "Progressions",
      entries: [entry({ uuid: "a" }), entry({ uuid: "b" })],
    };
    const result = sectionToLsxEntries(section);
    expect(result).toHaveLength(2);
    expect(result[0].uuid).toBe("a");
    expect(result[1].uuid).toBe("b");
  });

  it("returns empty array for empty section", () => {
    const section: SectionResult = { section: "Races", entries: [] };
    expect(sectionToLsxEntries(section)).toEqual([]);
  });
});

describe("groupEntriesByRegion", () => {
  it("groups entries by region ID", () => {
    const sections: SectionResult[] = [
      { section: "Progressions", entries: [entry({ uuid: "a" })] },
      { section: "Races", entries: [entry({ uuid: "b" })] },
    ];
    const map = groupEntriesByRegion(sections);
    expect(map.get("Progressions")).toHaveLength(1);
    expect(map.get("Races")).toHaveLength(1);
  });

  it("merges sections that map to the same region", () => {
    // ActionResources and another section mapping to ActionResourceDefinitions
    const sections: SectionResult[] = [
      { section: "ActionResources", entries: [entry({ uuid: "a" })] },
      { section: "ActionResources", entries: [entry({ uuid: "b" })] },
    ];
    const map = groupEntriesByRegion(sections);
    expect(map.get("ActionResourceDefinitions")).toHaveLength(2);
  });

  it("returns empty map for empty input", () => {
    expect(groupEntriesByRegion([])).toEqual(new Map());
  });
});
