import { describe, it, expect } from "vitest";
import { groupEntries, type GroupCriterion } from "../lib/utils/grouping.js";
import type { DiffEntry } from "../lib/types/index.js";

/** Helper to build a minimal DiffEntry. */
function entry(overrides: Partial<DiffEntry> = {}): DiffEntry {
  return {
    uuid: "test-uuid",
    display_name: "Test Entry",
    source_file: "test.lsx",
    entry_kind: "Modified",
    changes: [],
    node_id: "Progression",
    raw_attributes: {},
    raw_attribute_types: {},
    raw_children: {},
    ...overrides,
  };
}

describe("groupEntries", () => {
  it("returns [] for flat criterion", () => {
    const entries = [entry()];
    expect(groupEntries(entries, "flat", "Progressions")).toEqual([]);
  });

  it("returns [] for empty entries", () => {
    expect(groupEntries([], "alphabetical", "Progressions")).toEqual([]);
  });

  describe("alphabetical grouping", () => {
    it("groups by first letter of display_name", () => {
      const entries = [
        entry({ display_name: "Alpha", uuid: "1" }),
        entry({ display_name: "Bravo", uuid: "2" }),
        entry({ display_name: "Another", uuid: "3" }),
      ];
      const groups = groupEntries(entries, "alphabetical", "Progressions");
      expect(groups.map(g => g.key)).toEqual(["A", "B"]);
      expect(groups[0].entries).toHaveLength(2);
      expect(groups[1].entries).toHaveLength(1);
    });

    it("puts numeric-starting names under '#'", () => {
      const entries = [
        entry({ display_name: "123Spell", uuid: "1" }),
        entry({ display_name: "Alpha", uuid: "2" }),
      ];
      const groups = groupEntries(entries, "alphabetical", "Spells");
      const keys = groups.map(g => g.key);
      expect(keys).toContain("#");
      // '#' should sort last
      expect(keys[keys.length - 1]).toBe("#");
    });

    it("preserves originalIndices", () => {
      const entries = [
        entry({ display_name: "Bravo", uuid: "1" }),
        entry({ display_name: "Alpha", uuid: "2" }),
      ];
      const groups = groupEntries(entries, "alphabetical", "X");
      const alphaGroup = groups.find(g => g.key === "A")!;
      expect(alphaGroup.originalIndices).toEqual([1]);
    });
  });

  describe("tag grouping", () => {
    it("classifies enabled entries as ADDED", () => {
      const entries = [
        entry({ uuid: "a", entry_kind: "Modified" }),
        entry({ uuid: "b", entry_kind: "New" }),
      ];
      const isEnabled = (_s: string, uuid: string) => uuid === "a";
      const groups = groupEntries(entries, "tag", "Races", isEnabled);
      const addedGroup = groups.find(g => g.key === "ADDED");
      expect(addedGroup).toBeDefined();
      expect(addedGroup!.entries[0].uuid).toBe("a");
    });

    it("classifies non-enabled New entries as NEW", () => {
      const entries = [entry({ uuid: "a", entry_kind: "New" })];
      const isEnabled = () => false;
      const groups = groupEntries(entries, "tag", "Races", isEnabled);
      expect(groups[0].key).toBe("NEW");
    });

    it("classifies non-enabled Modified entries as AUTO", () => {
      const entries = [entry({ uuid: "a", entry_kind: "Modified" })];
      const isEnabled = () => false;
      const groups = groupEntries(entries, "tag", "Races", isEnabled);
      expect(groups[0].key).toBe("AUTO");
    });

    it("orders groups: ADDED, NEW, AUTO", () => {
      const entries = [
        entry({ uuid: "mod", entry_kind: "Modified" }),
        entry({ uuid: "new", entry_kind: "New" }),
        entry({ uuid: "added", entry_kind: "Modified" }),
      ];
      const isEnabled = (_s: string, uuid: string) => uuid === "added";
      const groups = groupEntries(entries, "tag", "Races", isEnabled);
      const keys = groups.map(g => g.key);
      expect(keys).toEqual(["ADDED", "NEW", "AUTO"]);
    });
  });

  describe("level grouping", () => {
    it("groups by raw_attributes.Level", () => {
      const entries = [
        entry({ uuid: "a", raw_attributes: { Level: "3" } }),
        entry({ uuid: "b", raw_attributes: { Level: "3" } }),
        entry({ uuid: "c", raw_attributes: { Level: "5" } }),
      ];
      const groups = groupEntries(entries, "level", "Progressions");
      expect(groups.find(g => g.key === "Level 3")?.entries).toHaveLength(2);
      expect(groups.find(g => g.key === "Level 5")?.entries).toHaveLength(1);
    });

    it("falls back to display_name regex for level", () => {
      const entries = [
        entry({ uuid: "a", display_name: "Wizard Level 4", raw_attributes: {} }),
      ];
      const groups = groupEntries(entries, "level", "Progressions");
      expect(groups[0].key).toBe("Level 4");
    });

    it("puts entries with no level into 'Unknown Level'", () => {
      const entries = [entry({ uuid: "a", display_name: "NoLevel", raw_attributes: {} })];
      const groups = groupEntries(entries, "level", "Progressions");
      expect(groups[0].key).toBe("Unknown Level");
    });
  });

  describe("listType grouping", () => {
    it("groups by node_id with human-readable labels", () => {
      const entries = [
        entry({ uuid: "a", node_id: "SpellList" }),
        entry({ uuid: "b", node_id: "SpellList" }),
        entry({ uuid: "c", node_id: "PassiveList" }),
      ];
      const groups = groupEntries(entries, "listType", "Lists");
      const spellGroup = groups.find(g => g.key === "SpellList");
      expect(spellGroup).toBeDefined();
      expect(spellGroup!.label).toContain("Spell Lists");
      expect(spellGroup!.entries).toHaveLength(2);
    });

    it("uses raw key for unlabeled node_ids", () => {
      const entries = [entry({ uuid: "a", node_id: "CustomType" })];
      const groups = groupEntries(entries, "listType", "Lists");
      expect(groups[0].label).toContain("CustomType");
    });
  });
});
