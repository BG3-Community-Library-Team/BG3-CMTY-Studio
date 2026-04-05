/**
 * projectStore tests — covers hydration, lazy section loading, mutations
 * (toggle, add, update, remove, batch toggle), dirty flag tracking,
 * undo/redo integration, and IPC failure rollback.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { StagingSectionSummary, UndoReplayEntry } from "../lib/tauri/staging.js";

// Mock the staging IPC module
vi.mock("../lib/tauri/staging.js", () => ({
  stagingListSections: vi.fn(),
  stagingQuerySection: vi.fn(),
  stagingGetMeta: vi.fn(),
  stagingSetMeta: vi.fn(),
  stagingUpsertRow: vi.fn(),
  stagingMarkDeleted: vi.fn(),
  stagingUnmarkDeleted: vi.fn(),
  stagingBatchWrite: vi.fn(),
  stagingSnapshot: vi.fn(),
  stagingUndo: vi.fn(),
  stagingRedo: vi.fn(),
  stagingGetRow: vi.fn(),
}));

// Mock the DB management module
vi.mock("../lib/tauri/db-management.js", () => ({
  getDbPaths: vi.fn(),
}));

// Mock the toast store
vi.mock("../lib/stores/toastStore.svelte.js", () => ({
  toastStore: {
    warning: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import {
  stagingListSections,
  stagingQuerySection,
  stagingGetMeta,
  stagingUpsertRow,
  stagingMarkDeleted,
  stagingUnmarkDeleted,
  stagingBatchWrite,
  stagingSnapshot,
  stagingUndo,
  stagingRedo,
} from "../lib/tauri/staging.js";
import { getDbPaths } from "../lib/tauri/db-management.js";
import { toastStore } from "../lib/stores/toastStore.svelte.js";

const { projectStore } = await import("../lib/stores/projectStore.svelte.js");

// ── Fixture Data ────────────────────────────────────────────────────

const MOCK_DB_PATHS = {
  staging: "/tmp/staging.sqlite",
  base: "/tmp/base.sqlite",
  honor: "",
  mods: "",
  dir: "/tmp",
};

const MOCK_SECTIONS: StagingSectionSummary[] = [
  {
    table_name: "Races",
    region_id: "Races",
    node_id: "Race",
    source_type: "lsx",
    total_rows: 5,
    active_rows: 4,
    new_rows: 1,
    modified_rows: 1,
    deleted_rows: 1,
  },
  {
    table_name: "Progressions",
    region_id: "Progressions",
    node_id: "Progression",
    source_type: "lsx",
    total_rows: 10,
    active_rows: 10,
    new_rows: 0,
    modified_rows: 0,
    deleted_rows: 0,
  },
];

const MOCK_RACE_ROWS: Record<string, unknown>[] = [
  { UUID: "race-001", Name: "Human", _is_new: 0, _is_modified: 0, _is_deleted: 0, DisplayName: "Human" },
  { UUID: "race-002", Name: "Elf", _is_new: 0, _is_modified: 1, _is_deleted: 0, DisplayName: "Elf" },
  { UUID: "race-003", Name: "Dwarf", _is_new: 1, _is_modified: 0, _is_deleted: 0, DisplayName: "Dwarf" },
  { UUID: "race-004", Name: "Halfling", _is_new: 0, _is_modified: 0, _is_deleted: 1, DisplayName: "Halfling" },
];

// ── Helpers ─────────────────────────────────────────────────────────

/** Set up standard mocks and hydrate the store. */
async function hydrateWithDefaults(): Promise<void> {
  vi.mocked(getDbPaths).mockResolvedValue(MOCK_DB_PATHS);
  vi.mocked(stagingListSections).mockResolvedValue(MOCK_SECTIONS);
  vi.mocked(stagingGetMeta).mockResolvedValue(null);
  await projectStore.hydrate();
}

/** Hydrate + load the Races section into the cache. */
async function hydrateAndLoadRaces(): Promise<void> {
  await hydrateWithDefaults();
  vi.mocked(stagingQuerySection).mockResolvedValue(MOCK_RACE_ROWS);
  await projectStore.loadSection("Races");
}

// ── Tests ───────────────────────────────────────────────────────────

beforeEach(() => {
  projectStore.reset();
  vi.clearAllMocks();
});

// ── 1. Hydration ────────────────────────────────────────────────────

describe("hydrate", () => {
  it("populates sections from staging DB", async () => {
    await hydrateWithDefaults();
    expect(projectStore.sections).toEqual(MOCK_SECTIONS);
    expect(stagingListSections).toHaveBeenCalledWith(MOCK_DB_PATHS.staging);
  });

  it("loads format from meta", async () => {
    vi.mocked(getDbPaths).mockResolvedValue(MOCK_DB_PATHS);
    vi.mocked(stagingListSections).mockResolvedValue(MOCK_SECTIONS);
    vi.mocked(stagingGetMeta).mockResolvedValue("Json");
    await projectStore.hydrate();
    expect(projectStore.format).toBe("Json");
  });

  it("defaults to Yaml when no format meta", async () => {
    await hydrateWithDefaults();
    expect(projectStore.format).toBe("Yaml");
  });

  it("clears cache and resets dirty state", async () => {
    // First hydrate and load a section so there's cached data
    await hydrateAndLoadRaces();
    expect(projectStore.isSectionLoaded("Races")).toBe(true);

    // Re-hydrate should clear the cache
    vi.mocked(stagingQuerySection).mockClear();
    await hydrateWithDefaults();
    expect(projectStore.isSectionLoaded("Races")).toBe(false);
    expect(projectStore.dirty).toBe(false);
  });
});

// ── 2. Lazy Section Loading ─────────────────────────────────────────

describe("loadSection", () => {
  it("fetches from DB on first call", async () => {
    await hydrateWithDefaults();
    vi.mocked(stagingQuerySection).mockResolvedValue(MOCK_RACE_ROWS);

    const entries = await projectStore.loadSection("Races");
    expect(stagingQuerySection).toHaveBeenCalledWith(MOCK_DB_PATHS.staging, "Races", true);
    expect(entries).toHaveLength(4);
  });

  it("returns cached entries on subsequent calls", async () => {
    await hydrateWithDefaults();
    vi.mocked(stagingQuerySection).mockResolvedValue(MOCK_RACE_ROWS);

    await projectStore.loadSection("Races");
    await projectStore.loadSection("Races");
    expect(stagingQuerySection).toHaveBeenCalledTimes(1);
  });

  it("converts raw rows to EntryRow type", async () => {
    await hydrateWithDefaults();
    vi.mocked(stagingQuerySection).mockResolvedValue(MOCK_RACE_ROWS);

    const entries = await projectStore.loadSection("Races");
    const first = entries[0];
    expect(first._pk).toBe("race-001");
    expect(first._pk_column).toBe("UUID");
    expect(first._table).toBe("Races");
    expect(first._is_new).toBe(false);
    expect(first._is_modified).toBe(false);
    expect(first._is_deleted).toBe(false);
    expect(first._source_type).toBe("lsx");
  });

  it("correctly interprets truthy row flags", async () => {
    await hydrateWithDefaults();
    vi.mocked(stagingQuerySection).mockResolvedValue(MOCK_RACE_ROWS);

    const entries = await projectStore.loadSection("Races");
    // race-002 has _is_modified: 1
    expect(entries[1]._is_modified).toBe(true);
    // race-003 has _is_new: 1
    expect(entries[2]._is_new).toBe(true);
    // race-004 has _is_deleted: 1
    expect(entries[3]._is_deleted).toBe(true);
  });
});

// ── 3. Mutation: toggleEntry ────────────────────────────────────────

describe("toggleEntry", () => {
  it("calls stagingMarkDeleted for active entries", async () => {
    await hydrateAndLoadRaces();
    vi.mocked(stagingMarkDeleted).mockResolvedValue(true);

    await projectStore.toggleEntry("Races", "race-001");
    expect(stagingMarkDeleted).toHaveBeenCalledWith(MOCK_DB_PATHS.staging, "Races", "race-001");
  });

  it("calls stagingUnmarkDeleted for deleted entries", async () => {
    await hydrateAndLoadRaces();
    vi.mocked(stagingUnmarkDeleted).mockResolvedValue(true);

    // race-004 starts as deleted
    await projectStore.toggleEntry("Races", "race-004");
    expect(stagingUnmarkDeleted).toHaveBeenCalledWith(MOCK_DB_PATHS.staging, "Races", "race-004");
  });

  it("toggles _is_deleted flag optimistically", async () => {
    await hydrateAndLoadRaces();
    vi.mocked(stagingMarkDeleted).mockResolvedValue(true);

    const entries = projectStore.getEntries("Races");
    expect(entries[0]._is_deleted).toBe(false);
    await projectStore.toggleEntry("Races", "race-001");
    expect(entries[0]._is_deleted).toBe(true);
  });

  it("rolls back on IPC failure", async () => {
    await hydrateAndLoadRaces();
    vi.mocked(stagingMarkDeleted).mockRejectedValue(new Error("DB locked"));

    const entries = projectStore.getEntries("Races");
    expect(entries[0]._is_deleted).toBe(false);
    await projectStore.toggleEntry("Races", "race-001");
    expect(entries[0]._is_deleted).toBe(false);
  });

  it("shows toast on failure", async () => {
    await hydrateAndLoadRaces();
    vi.mocked(stagingMarkDeleted).mockRejectedValue(new Error("DB locked"));

    await projectStore.toggleEntry("Races", "race-001");
    expect(toastStore.warning).toHaveBeenCalledWith("Failed to toggle entry", "Error: DB locked");
  });

  it("no-ops for unknown pk", async () => {
    await hydrateAndLoadRaces();
    await projectStore.toggleEntry("Races", "nonexistent");
    expect(stagingMarkDeleted).not.toHaveBeenCalled();
    expect(stagingUnmarkDeleted).not.toHaveBeenCalled();
  });
});

// ── 4. Mutation: addEntry ───────────────────────────────────────────

describe("addEntry", () => {
  it("calls stagingUpsertRow with is_new=true", async () => {
    await hydrateWithDefaults();
    vi.mocked(stagingUpsertRow).mockResolvedValue({ pk_value: "new-uuid", was_insert: true });

    const columns = { UUID: "new-uuid", Name: "NewRace" };
    await projectStore.addEntry("Races", columns);
    expect(stagingUpsertRow).toHaveBeenCalledWith(MOCK_DB_PATHS.staging, "Races", columns, true);
  });

  it("invalidates section cache", async () => {
    await hydrateAndLoadRaces();
    expect(projectStore.isSectionLoaded("Races")).toBe(true);

    vi.mocked(stagingUpsertRow).mockResolvedValue({ pk_value: "new-uuid", was_insert: true });
    await projectStore.addEntry("Races", { UUID: "new-uuid", Name: "NewRace" });
    expect(projectStore.isSectionLoaded("Races")).toBe(false);
  });

  it("marks store as dirty", async () => {
    await hydrateWithDefaults();
    expect(projectStore.dirty).toBe(false);

    vi.mocked(stagingUpsertRow).mockResolvedValue({ pk_value: "new-uuid", was_insert: true });
    await projectStore.addEntry("Races", { UUID: "new-uuid", Name: "NewRace" });
    expect(projectStore.dirty).toBe(true);
  });

  it("shows toast on failure", async () => {
    await hydrateWithDefaults();
    vi.mocked(stagingUpsertRow).mockRejectedValue(new Error("constraint violation"));

    await projectStore.addEntry("Races", { UUID: "dup-uuid", Name: "Dup" });
    expect(toastStore.warning).toHaveBeenCalledWith("Failed to add entry", "Error: constraint violation");
  });
});

// ── 5. Mutation: updateEntry ────────────────────────────────────────

describe("updateEntry", () => {
  it("updates cached entry values optimistically", async () => {
    await hydrateAndLoadRaces();
    vi.mocked(stagingUpsertRow).mockResolvedValue({ pk_value: "race-001", was_insert: false });

    await projectStore.updateEntry("Races", "race-001", { Name: "HumanV2" });
    const entries = projectStore.getEntries("Races");
    expect(entries[0].Name).toBe("HumanV2");
    expect(entries[0]._is_modified).toBe(true);
  });

  it("calls stagingUpsertRow with is_new=false", async () => {
    await hydrateAndLoadRaces();
    vi.mocked(stagingUpsertRow).mockResolvedValue({ pk_value: "race-001", was_insert: false });

    const columns = { Name: "HumanV2" };
    await projectStore.updateEntry("Races", "race-001", columns);
    expect(stagingUpsertRow).toHaveBeenCalledWith(MOCK_DB_PATHS.staging, "Races", columns, false);
  });

  it("rolls back on IPC failure", async () => {
    await hydrateAndLoadRaces();
    vi.mocked(stagingUpsertRow).mockRejectedValue(new Error("DB error"));

    await projectStore.updateEntry("Races", "race-001", { Name: "HumanV2" });
    const entries = projectStore.getEntries("Races");
    expect(entries[0].Name).toBe("Human");
  });

  it("shows toast on failure", async () => {
    await hydrateAndLoadRaces();
    vi.mocked(stagingUpsertRow).mockRejectedValue(new Error("DB error"));

    await projectStore.updateEntry("Races", "race-001", { Name: "HumanV2" });
    expect(toastStore.warning).toHaveBeenCalledWith("Failed to update entry", "Error: DB error");
  });
});

// ── 6. Mutation: removeEntry ────────────────────────────────────────

describe("removeEntry", () => {
  it("soft-deletes existing entries", async () => {
    await hydrateAndLoadRaces();
    vi.mocked(stagingMarkDeleted).mockResolvedValue(true);

    // race-001 is not new, so it should be soft-deleted
    await projectStore.removeEntry("Races", "race-001");
    const entries = projectStore.getEntries("Races");
    const entry = entries.find(e => e._pk === "race-001");
    expect(entry?._is_deleted).toBe(true);
    expect(entries).toHaveLength(4); // still in cache
  });

  it("hard-deletes new entries from cache", async () => {
    await hydrateAndLoadRaces();
    vi.mocked(stagingMarkDeleted).mockResolvedValue(true);

    // race-003 is _is_new, so it should be spliced from cache
    await projectStore.removeEntry("Races", "race-003");
    const entries = projectStore.getEntries("Races");
    expect(entries.find(e => e._pk === "race-003")).toBeUndefined();
    expect(entries).toHaveLength(3);
  });

  it("rolls back soft-delete on failure", async () => {
    await hydrateAndLoadRaces();
    vi.mocked(stagingMarkDeleted).mockRejectedValue(new Error("DB locked"));

    await projectStore.removeEntry("Races", "race-001");
    const entries = projectStore.getEntries("Races");
    const entry = entries.find(e => e._pk === "race-001");
    expect(entry?._is_deleted).toBe(false);
  });

  it("marks store as dirty on success", async () => {
    await hydrateAndLoadRaces();
    vi.mocked(stagingMarkDeleted).mockResolvedValue(true);

    await projectStore.removeEntry("Races", "race-001");
    expect(projectStore.dirty).toBe(true);
  });

  it("shows toast on failure", async () => {
    await hydrateAndLoadRaces();
    vi.mocked(stagingMarkDeleted).mockRejectedValue(new Error("DB locked"));

    await projectStore.removeEntry("Races", "race-001");
    expect(toastStore.warning).toHaveBeenCalledWith("Failed to remove entry", "Error: DB locked");
  });
});

// ── 7. Dirty Flag Tracking ──────────────────────────────────────────

describe("dirty flag", () => {
  it("starts clean after hydrate", async () => {
    await hydrateWithDefaults();
    expect(projectStore.dirty).toBe(false);
  });

  it("becomes dirty after mutation", async () => {
    await hydrateAndLoadRaces();
    vi.mocked(stagingMarkDeleted).mockResolvedValue(true);

    expect(projectStore.dirty).toBe(false);
    await projectStore.toggleEntry("Races", "race-001");
    expect(projectStore.dirty).toBe(true);
  });

  it("resets to clean with markClean()", async () => {
    await hydrateAndLoadRaces();
    vi.mocked(stagingMarkDeleted).mockResolvedValue(true);

    await projectStore.toggleEntry("Races", "race-001");
    expect(projectStore.dirty).toBe(true);

    projectStore.markClean();
    expect(projectStore.dirty).toBe(false);
  });

  it("tracks via generation counter — multiple mutations stay dirty", async () => {
    await hydrateAndLoadRaces();
    vi.mocked(stagingMarkDeleted).mockResolvedValue(true);
    vi.mocked(stagingUnmarkDeleted).mockResolvedValue(true);

    await projectStore.toggleEntry("Races", "race-001");
    await projectStore.toggleEntry("Races", "race-001");
    expect(projectStore.dirty).toBe(true);
  });

  it("does not become dirty on IPC failure", async () => {
    await hydrateAndLoadRaces();
    vi.mocked(stagingMarkDeleted).mockRejectedValue(new Error("fail"));

    await projectStore.toggleEntry("Races", "race-001");
    expect(projectStore.dirty).toBe(false);
  });
});

// ── 8. Batch Toggle ─────────────────────────────────────────────────

describe("batchToggle", () => {
  it("toggles multiple entries in one IPC call", async () => {
    await hydrateAndLoadRaces();
    vi.mocked(stagingBatchWrite).mockResolvedValue({ total: 2, succeeded: 2, failed: 0, errors: [] });

    await projectStore.batchToggle("Races", ["race-001", "race-002"], true);

    expect(stagingBatchWrite).toHaveBeenCalledTimes(1);
    const ops = vi.mocked(stagingBatchWrite).mock.calls[0][1];
    expect(ops).toHaveLength(2);
    expect(ops[0]).toMatchObject({ op: "MarkDeleted", table: "Races", pk: "race-001" });
    expect(ops[1]).toMatchObject({ op: "MarkDeleted", table: "Races", pk: "race-002" });

    const entries = projectStore.getEntries("Races");
    expect(entries[0]._is_deleted).toBe(true);
    expect(entries[1]._is_deleted).toBe(true);
  });

  it("uses UnmarkDeleted when deleted=false", async () => {
    await hydrateAndLoadRaces();
    vi.mocked(stagingBatchWrite).mockResolvedValue({ total: 1, succeeded: 1, failed: 0, errors: [] });

    await projectStore.batchToggle("Races", ["race-004"], false);

    const ops = vi.mocked(stagingBatchWrite).mock.calls[0][1];
    expect(ops[0]).toMatchObject({ op: "UnmarkDeleted", table: "Races", pk: "race-004" });
    expect(projectStore.getEntries("Races")[3]._is_deleted).toBe(false);
  });

  it("rolls back all on batch failure", async () => {
    await hydrateAndLoadRaces();
    vi.mocked(stagingBatchWrite).mockRejectedValue(new Error("batch fail"));

    const entries = projectStore.getEntries("Races");
    const beforeStates = entries.map(e => e._is_deleted);

    await projectStore.batchToggle("Races", ["race-001", "race-002"], true);

    const afterStates = entries.map(e => e._is_deleted);
    expect(afterStates).toEqual(beforeStates);
  });

  it("shows toast on failure", async () => {
    await hydrateAndLoadRaces();
    vi.mocked(stagingBatchWrite).mockRejectedValue(new Error("batch fail"));

    await projectStore.batchToggle("Races", ["race-001"], true);
    expect(toastStore.warning).toHaveBeenCalledWith("Failed to batch toggle", "Error: batch fail");
  });
});

// ── 9. Undo / Redo ──────────────────────────────────────────────────

describe("undo/redo", () => {
  const MOCK_REPLAY: UndoReplayEntry[] = [
    { table_name: "Races", pk_value: "race-001", action: "restore" },
  ];

  it("calls stagingUndo and invalidates affected sections", async () => {
    await hydrateAndLoadRaces();
    vi.mocked(stagingUndo).mockResolvedValue(MOCK_REPLAY);
    vi.mocked(stagingListSections).mockResolvedValue(MOCK_SECTIONS);

    expect(projectStore.isSectionLoaded("Races")).toBe(true);
    await projectStore.undo();
    expect(stagingUndo).toHaveBeenCalledWith(MOCK_DB_PATHS.staging);
    expect(projectStore.isSectionLoaded("Races")).toBe(false);
  });

  it("calls stagingRedo and invalidates affected sections", async () => {
    await hydrateAndLoadRaces();
    vi.mocked(stagingRedo).mockResolvedValue(MOCK_REPLAY);
    vi.mocked(stagingListSections).mockResolvedValue(MOCK_SECTIONS);

    await projectStore.redo();
    expect(stagingRedo).toHaveBeenCalledWith(MOCK_DB_PATHS.staging);
    expect(projectStore.isSectionLoaded("Races")).toBe(false);
  });

  it("refreshes section list after undo", async () => {
    await hydrateAndLoadRaces();
    const updatedSections: StagingSectionSummary[] = [MOCK_SECTIONS[0]]; // only Races
    vi.mocked(stagingUndo).mockResolvedValue(MOCK_REPLAY);
    vi.mocked(stagingListSections).mockResolvedValue(updatedSections);

    await projectStore.undo();
    expect(projectStore.sections).toEqual(updatedSections);
  });

  it("no-ops when replay returns empty", async () => {
    await hydrateAndLoadRaces();
    vi.mocked(stagingUndo).mockResolvedValue([]);

    const sectionsBefore = projectStore.sections;
    const dirtyBefore = projectStore.dirty;
    await projectStore.undo();

    // Should not have refreshed sections or marked dirty
    expect(stagingListSections).toHaveBeenCalledTimes(1); // only the hydrate call
    expect(projectStore.dirty).toBe(dirtyBefore);
  });

  it("no-ops when stagingDbPath is empty (not hydrated)", async () => {
    // Store was reset, never hydrated
    await projectStore.undo();
    expect(stagingUndo).not.toHaveBeenCalled();
  });

  it("shows toast on undo failure", async () => {
    await hydrateWithDefaults();
    vi.mocked(stagingUndo).mockRejectedValue(new Error("undo error"));

    await projectStore.undo();
    expect(toastStore.warning).toHaveBeenCalledWith("Undo failed", "Error: undo error");
  });

  it("shows toast on redo failure", async () => {
    await hydrateWithDefaults();
    vi.mocked(stagingRedo).mockRejectedValue(new Error("redo error"));

    await projectStore.redo();
    expect(toastStore.warning).toHaveBeenCalledWith("Redo failed", "Error: redo error");
  });

  it("marks dirty after successful undo", async () => {
    await hydrateWithDefaults();
    vi.mocked(stagingUndo).mockResolvedValue(MOCK_REPLAY);
    vi.mocked(stagingListSections).mockResolvedValue(MOCK_SECTIONS);

    expect(projectStore.dirty).toBe(false);
    await projectStore.undo();
    expect(projectStore.dirty).toBe(true);
  });
});

// ── 10. IPC Failure Rollback ────────────────────────────────────────

describe("IPC failure rollback", () => {
  it("restores toggleEntry state on failure", async () => {
    await hydrateAndLoadRaces();
    vi.mocked(stagingMarkDeleted).mockRejectedValue(new Error("DB locked"));

    const entries = projectStore.getEntries("Races");
    const original = entries[0]._is_deleted;
    await projectStore.toggleEntry("Races", "race-001");
    expect(entries[0]._is_deleted).toBe(original);
  });

  it("restores updateEntry values on failure", async () => {
    await hydrateAndLoadRaces();
    vi.mocked(stagingUpsertRow).mockRejectedValue(new Error("DB locked"));

    const entries = projectStore.getEntries("Races");
    const originalName = entries[0].Name;
    await projectStore.updateEntry("Races", "race-001", { Name: "ChangedName" });
    expect(entries[0].Name).toBe(originalName);
  });

  it("shows warning toast on any failure", async () => {
    await hydrateAndLoadRaces();
    vi.mocked(stagingMarkDeleted).mockRejectedValue(new Error("fail"));
    vi.mocked(stagingUpsertRow).mockRejectedValue(new Error("fail2"));

    await projectStore.toggleEntry("Races", "race-001");
    await projectStore.updateEntry("Races", "race-002", { Name: "X" });
    expect(toastStore.warning).toHaveBeenCalledTimes(2);
  });

  it("restores batchToggle states on failure", async () => {
    await hydrateAndLoadRaces();
    vi.mocked(stagingBatchWrite).mockRejectedValue(new Error("batch fail"));

    const entries = projectStore.getEntries("Races");
    const before = entries.map(e => e._is_deleted);
    await projectStore.batchToggle("Races", ["race-001", "race-002"], true);
    const after = entries.map(e => e._is_deleted);
    expect(after).toEqual(before);
  });

  it("does not modify dirty flag on failure", async () => {
    await hydrateAndLoadRaces();
    vi.mocked(stagingMarkDeleted).mockRejectedValue(new Error("fail"));

    expect(projectStore.dirty).toBe(false);
    await projectStore.toggleEntry("Races", "race-001");
    expect(projectStore.dirty).toBe(false);
  });
});

// ── 11. Lifecycle / Reset ───────────────────────────────────────────

describe("reset", () => {
  it("clears all state to initial values", async () => {
    await hydrateAndLoadRaces();
    vi.mocked(stagingMarkDeleted).mockResolvedValue(true);
    await projectStore.toggleEntry("Races", "race-001");

    projectStore.reset();

    expect(projectStore.sections).toEqual([]);
    expect(projectStore.format).toBe("Yaml");
    expect(projectStore.dirty).toBe(false);
    expect(projectStore.isSectionLoaded("Races")).toBe(false);
    expect(projectStore.getEntries("Races")).toEqual([]);
  });
});

// ── 12. Cache Accessors ─────────────────────────────────────────────

describe("cache accessors", () => {
  it("getEntries returns empty array for unloaded sections", async () => {
    await hydrateWithDefaults();
    expect(projectStore.getEntries("Races")).toEqual([]);
  });

  it("isSectionLoaded returns false before loading", async () => {
    await hydrateWithDefaults();
    expect(projectStore.isSectionLoaded("Races")).toBe(false);
  });

  it("isSectionLoaded returns true after loading", async () => {
    await hydrateAndLoadRaces();
    expect(projectStore.isSectionLoaded("Races")).toBe(true);
  });

  it("invalidateSection forces re-fetch on next load", async () => {
    await hydrateAndLoadRaces();
    projectStore.invalidateSection("Races");
    expect(projectStore.isSectionLoaded("Races")).toBe(false);

    vi.mocked(stagingQuerySection).mockResolvedValue(MOCK_RACE_ROWS);
    await projectStore.loadSection("Races");
    expect(stagingQuerySection).toHaveBeenCalledTimes(2);
  });
});

// ── 13. Snapshot ────────────────────────────────────────────────────

describe("snapshot", () => {
  it("calls stagingSnapshot with label", async () => {
    await hydrateWithDefaults();
    vi.mocked(stagingSnapshot).mockResolvedValue(1);

    await projectStore.snapshot("before toggle");
    expect(stagingSnapshot).toHaveBeenCalledWith(MOCK_DB_PATHS.staging, "before toggle");
  });

  it("no-ops when not hydrated", async () => {
    await projectStore.snapshot("test");
    expect(stagingSnapshot).not.toHaveBeenCalled();
  });
});
