/**
 * Batch entry operation tests — covers addManualEntries(), removeManualEntriesByUuid(),
 * and getManualEntriesForRace() methods added in Epic 0 (Multi-Section Entry Architecture).
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// Polyfill localStorage for node test environment
if (typeof globalThis.localStorage === "undefined") {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    get length() { return store.size; },
    key: (i: number) => [...store.keys()][i] ?? null,
  };
}

const { configStore } = await import("../lib/stores/configStore.svelte.js");
const { undoStore } = await import("../lib/stores/undoStore.svelte.js");

describe("addManualEntries", () => {
  beforeEach(() => {
    configStore.reset();
    undoStore.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does nothing for empty array (no undo pushed)", () => {
    configStore.addManualEntries([]);
    expect(configStore.manualEntries).toHaveLength(0);
    expect(undoStore.canUndo).toBe(false);
  });

  it("adds 5 entries across 3 sections", () => {
    configStore.addManualEntries([
      { section: "Races", fields: { UUID: "r1", Name: "Elf" } },
      { section: "Races", fields: { UUID: "r2", Name: "Dwarf" } },
      { section: "Progressions", fields: { UUID: "p1", TableUUID: "t1" } },
      { section: "Tags", fields: { UUID: "tag1", Name: "ElfTag" } },
      { section: "Tags", fields: { UUID: "tag2", Name: "REALLY_ElfTag" } },
    ]);
    expect(configStore.manualEntries).toHaveLength(5);
    expect(configStore.manualEntries[0].section).toBe("Races");
    expect(configStore.manualEntries[2].section).toBe("Progressions");
    expect(configStore.manualEntries[4].fields.Name).toBe("REALLY_ElfTag");
  });

  it("single undo removes all entries from a batch", () => {
    configStore.addManualEntries([
      { section: "Races", fields: { UUID: "r1", Name: "Elf" } },
      { section: "Tags", fields: { UUID: "t1", Name: "Tag1" } },
      { section: "Tags", fields: { UUID: "t2", Name: "Tag2" } },
    ]);
    expect(configStore.manualEntries).toHaveLength(3);

    undoStore.undo();
    expect(configStore.manualEntries).toHaveLength(0);
  });

  it("redo restores all entries with correct fields", () => {
    configStore.addManualEntries([
      { section: "Races", fields: { UUID: "r1", Name: "Elf" } },
      { section: "Progressions", fields: { UUID: "p1", Level: "1" } },
    ]);
    undoStore.undo();
    expect(configStore.manualEntries).toHaveLength(0);

    undoStore.redo();
    expect(configStore.manualEntries).toHaveLength(2);
    expect(configStore.manualEntries[0].fields.Name).toBe("Elf");
    expect(configStore.manualEntries[1].fields.Level).toBe("1");
  });

  it("clones fields — mutating input after call does not affect store", () => {
    const inputFields = { UUID: "r1", Name: "Original" };
    configStore.addManualEntries([{ section: "Races", fields: inputFields }]);
    inputFields.Name = "Mutated";
    expect(configStore.manualEntries[0].fields.Name).toBe("Original");
  });

  it("custom label appears in undoStore.undoLabel", () => {
    configStore.addManualEntries(
      [{ section: "Tags", fields: { UUID: "t1" } }],
      "Generate race tags"
    );
    expect(undoStore.undoLabel).toBe("Generate race tags");
  });

  it("preserves existing entries when batch is added", () => {
    configStore.addManualEntry("Races", { UUID: "existing", Name: "ExistingRace" });
    undoStore.clear(); // Clear the single-entry undo to simplify

    configStore.addManualEntries([
      { section: "Tags", fields: { UUID: "new1" } },
      { section: "Tags", fields: { UUID: "new2" } },
    ]);
    expect(configStore.manualEntries).toHaveLength(3);
    expect(configStore.manualEntries[0].fields.UUID).toBe("existing");
  });

  it("undo of batch does not affect pre-existing entries", () => {
    configStore.addManualEntry("Races", { UUID: "existing", Name: "ExistingRace" });
    undoStore.clear();

    configStore.addManualEntries([
      { section: "Tags", fields: { UUID: "new1" } },
      { section: "Tags", fields: { UUID: "new2" } },
    ]);
    undoStore.undo();
    expect(configStore.manualEntries).toHaveLength(1);
    expect(configStore.manualEntries[0].fields.UUID).toBe("existing");
  });

  it("marks preview stale", () => {
    configStore.previewStale = false;
    configStore.addManualEntries([{ section: "Races", fields: { UUID: "r1" } }]);
    expect(configStore.previewStale).toBe(true);
  });

  it("preserves comment field when provided", () => {
    configStore.addManualEntries([
      { section: "Races", fields: { UUID: "r1" }, comment: "Auto-generated" },
    ]);
    expect(configStore.manualEntries[0].comment).toBe("Auto-generated");
  });
});

describe("removeManualEntriesByUuid", () => {
  beforeEach(() => {
    configStore.reset();
    undoStore.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("removes entries matching UUID set across sections", () => {
    configStore.addManualEntries([
      { section: "Races", fields: { UUID: "r1", Name: "Elf" } },
      { section: "Tags", fields: { UUID: "t1", Name: "ElfTag" } },
      { section: "Tags", fields: { UUID: "t2", Name: "DwarfTag" } },
      { section: "Progressions", fields: { UUID: "p1", Level: "1" } },
    ]);
    undoStore.clear();

    configStore.removeManualEntriesByUuid(new Set(["t1", "p1"]));
    expect(configStore.manualEntries).toHaveLength(2);
    expect(configStore.manualEntries.map(e => e.fields.UUID)).toEqual(["r1", "t2"]);
  });

  it("does nothing when no UUIDs match", () => {
    configStore.addManualEntries([
      { section: "Races", fields: { UUID: "r1" } },
    ]);
    undoStore.clear();

    configStore.removeManualEntriesByUuid(new Set(["nonexistent"]));
    expect(configStore.manualEntries).toHaveLength(1);
    expect(undoStore.canUndo).toBe(false);
  });

  it("does nothing for empty UUID set", () => {
    configStore.addManualEntries([
      { section: "Races", fields: { UUID: "r1" } },
    ]);
    undoStore.clear();

    configStore.removeManualEntriesByUuid(new Set());
    expect(configStore.manualEntries).toHaveLength(1);
    expect(undoStore.canUndo).toBe(false);
  });

  it("undo restores removed entries at original indices", () => {
    configStore.addManualEntries([
      { section: "Races", fields: { UUID: "r1", Name: "Elf" } },
      { section: "Tags", fields: { UUID: "t1", Name: "ElfTag" } },
      { section: "Races", fields: { UUID: "r2", Name: "Dwarf" } },
      { section: "Tags", fields: { UUID: "t2", Name: "DwarfTag" } },
    ]);
    undoStore.clear();

    configStore.removeManualEntriesByUuid(new Set(["t1", "t2"]));
    expect(configStore.manualEntries).toHaveLength(2);

    undoStore.undo();
    expect(configStore.manualEntries).toHaveLength(4);
    expect(configStore.manualEntries[1].fields.UUID).toBe("t1");
    expect(configStore.manualEntries[3].fields.UUID).toBe("t2");
  });

  it("redo re-removes entries", () => {
    configStore.addManualEntries([
      { section: "Races", fields: { UUID: "r1" } },
      { section: "Tags", fields: { UUID: "t1" } },
    ]);
    undoStore.clear();

    configStore.removeManualEntriesByUuid(new Set(["t1"]));
    undoStore.undo();
    expect(configStore.manualEntries).toHaveLength(2);

    undoStore.redo();
    expect(configStore.manualEntries).toHaveLength(1);
    expect(configStore.manualEntries[0].fields.UUID).toBe("r1");
  });

  it("handles entries without UUID field gracefully", () => {
    configStore.addManualEntries([
      { section: "Races", fields: { Name: "NoUUID" } },
      { section: "Tags", fields: { UUID: "t1" } },
    ]);
    undoStore.clear();

    configStore.removeManualEntriesByUuid(new Set(["t1"]));
    expect(configStore.manualEntries).toHaveLength(1);
    expect(configStore.manualEntries[0].fields.Name).toBe("NoUUID");
  });
});

describe("getManualEntriesForRace", () => {
  beforeEach(() => {
    configStore.reset();
    undoStore.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const RACE_UUID = "aaaa1111-2222-3333-4444-555555555555";
  const TABLE_UUID = "bbbb1111-2222-3333-4444-555555555555";

  it("finds entries by RaceUUID field", () => {
    configStore.addManualEntries([
      { section: "CharacterCreationPresets", fields: { UUID: "p1", RaceUUID: RACE_UUID } },
    ]);
    const results = configStore.getManualEntriesForRace(RACE_UUID);
    expect(results).toHaveLength(1);
    expect(results[0].entry.fields.UUID).toBe("p1");
  });

  it("finds entries by Race field", () => {
    configStore.addManualEntries([
      { section: "RootTemplates", fields: { UUID: "rt1", Race: RACE_UUID } },
    ]);
    const results = configStore.getManualEntriesForRace(RACE_UUID);
    expect(results).toHaveLength(1);
    expect(results[0].entry.section).toBe("RootTemplates");
  });

  it("finds entries by ParentGuid field", () => {
    configStore.addManualEntries([
      { section: "Races", fields: { UUID: "sub1", ParentGuid: RACE_UUID } },
    ]);
    const results = configStore.getManualEntriesForRace(RACE_UUID);
    expect(results).toHaveLength(1);
  });

  it("finds entries by SubRaceUUID field", () => {
    configStore.addManualEntries([
      { section: "CharacterCreationPresets", fields: { UUID: "p1", SubRaceUUID: RACE_UUID } },
    ]);
    const results = configStore.getManualEntriesForRace(RACE_UUID);
    expect(results).toHaveLength(1);
  });

  it("finds Progression entries by TableUUID", () => {
    configStore.addManualEntries([
      { section: "Progressions", fields: { UUID: "prog1", TableUUID: TABLE_UUID, ProgressionType: "2" } },
    ]);
    const results = configStore.getManualEntriesForRace(RACE_UUID, TABLE_UUID);
    expect(results).toHaveLength(1);
    expect(results[0].entry.fields.UUID).toBe("prog1");
  });

  it("does not match TableUUID in non-Progressions sections", () => {
    configStore.addManualEntries([
      { section: "Races", fields: { UUID: "r1", TableUUID: TABLE_UUID } },
    ]);
    const results = configStore.getManualEntriesForRace(RACE_UUID, TABLE_UUID);
    expect(results).toHaveLength(0);
  });

  it("does not match TableUUID when progressionTableUuid not provided", () => {
    configStore.addManualEntries([
      { section: "Progressions", fields: { UUID: "prog1", TableUUID: TABLE_UUID } },
    ]);
    const results = configStore.getManualEntriesForRace(RACE_UUID);
    expect(results).toHaveLength(0);
  });

  it("returns correct indices", () => {
    configStore.addManualEntries([
      { section: "Races", fields: { UUID: "unrelated" } },
      { section: "Tags", fields: { UUID: "t1", RaceUUID: RACE_UUID } },
      { section: "Races", fields: { UUID: "another" } },
      { section: "Progressions", fields: { UUID: "p1", TableUUID: TABLE_UUID } },
    ]);
    const results = configStore.getManualEntriesForRace(RACE_UUID, TABLE_UUID);
    expect(results).toHaveLength(2);
    expect(results[0].index).toBe(1);
    expect(results[1].index).toBe(3);
  });

  it("returns empty array when no matches", () => {
    configStore.addManualEntries([
      { section: "Races", fields: { UUID: "r1", Name: "NoRef" } },
    ]);
    const results = configStore.getManualEntriesForRace(RACE_UUID);
    expect(results).toHaveLength(0);
  });

  it("finds multiple entries across different reference fields", () => {
    configStore.addManualEntries([
      { section: "CharacterCreationPresets", fields: { UUID: "p1", RaceUUID: RACE_UUID } },
      { section: "RootTemplates", fields: { UUID: "rt1", Race: RACE_UUID } },
      { section: "Races", fields: { UUID: "sub1", ParentGuid: RACE_UUID } },
      { section: "Progressions", fields: { UUID: "prog1", TableUUID: TABLE_UUID } },
    ]);
    const results = configStore.getManualEntriesForRace(RACE_UUID, TABLE_UUID);
    expect(results).toHaveLength(4);
  });

  it("does not double-count entries matching multiple fields", () => {
    // An entry where both RaceUUID and SubRaceUUID match (base race referencing itself)
    configStore.addManualEntries([
      { section: "CharacterCreationPresets", fields: { UUID: "p1", RaceUUID: RACE_UUID, SubRaceUUID: RACE_UUID } },
    ]);
    const results = configStore.getManualEntriesForRace(RACE_UUID);
    // Should find it once (continue after first match)
    expect(results).toHaveLength(1);
  });
});
