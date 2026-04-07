/**
 * migration tests — covers migrateLocalStorageProject() from migration.ts
 *
 * Tests legacy localStorage → staging DB migration for:
 * manual entries, disabled entries, auto-entry overrides, loca entries,
 * auto loca entries, osiris goal entries, format preference, and no-op cases.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the staging IPC module
vi.mock("../lib/tauri/staging.js", () => ({
  stagingUpsertRow: vi.fn(),
  stagingMarkDeleted: vi.fn(),
  stagingSetMeta: vi.fn(),
  stagingListSections: vi.fn(),
}));

// Mock the DB management module
vi.mock("../lib/tauri/db-management.js", () => ({
  getDbPaths: vi.fn(),
}));

import {
  stagingUpsertRow,
  stagingMarkDeleted,
  stagingSetMeta,
  stagingListSections,
} from "../lib/tauri/staging.js";
import { getDbPaths } from "../lib/tauri/db-management.js";
import { migrateLocalStorageProject } from "../lib/utils/migration.js";
import { projectKey } from "../lib/data/fieldKeys.js";

const MOCK_DB_PATHS = {
  staging: "/tmp/staging.sqlite",
  base: "/tmp/base.sqlite",
  honor: "",
  mods: "",
  dir: "/tmp",
};

const MOD_PATH = "/home/user/mods/TestMod";

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(getDbPaths).mockResolvedValue(MOCK_DB_PATHS);
  vi.mocked(stagingListSections).mockResolvedValue([]);
  vi.mocked(stagingUpsertRow).mockResolvedValue({ pk_value: "x", was_insert: true });
  vi.mocked(stagingMarkDeleted).mockResolvedValue(true);
  vi.mocked(stagingSetMeta).mockResolvedValue(undefined);
});

describe("migrateLocalStorageProject", () => {
  it("returns false when no legacy data exists", async () => {
    const result = await migrateLocalStorageProject(MOD_PATH);
    expect(result).toBe(false);
    expect(stagingUpsertRow).not.toHaveBeenCalled();
  });

  it("returns false when already migrated", async () => {
    const key = projectKey(MOD_PATH);
    localStorage.setItem(key, JSON.stringify({ manualEntries: [{ section: "Races", fields: { UUID: "a" } }] }));
    localStorage.setItem(key + "_migrated", "true");

    const result = await migrateLocalStorageProject(MOD_PATH);
    expect(result).toBe(false);
    expect(stagingUpsertRow).not.toHaveBeenCalled();
  });

  it("returns false when staging already has tracked changes", async () => {
    const key = projectKey(MOD_PATH);
    localStorage.setItem(key, JSON.stringify({ manualEntries: [{ section: "Races", fields: { UUID: "a" } }] }));
    vi.mocked(stagingListSections).mockResolvedValue([
      { table_name: "Races", region_id: "Races", node_id: "Race", source_type: "lsx", total_rows: 5, active_rows: 5, new_rows: 1, modified_rows: 0, deleted_rows: 0 },
    ]);

    const result = await migrateLocalStorageProject(MOD_PATH);
    expect(result).toBe(false);
  });

  it("migrates manual entries → stagingUpsertRow for each", async () => {
    const key = projectKey(MOD_PATH);
    localStorage.setItem(key, JSON.stringify({
      manualEntries: [
        { section: "Races", fields: { UUID: "r1", Name: "CustomRace" } },
        { section: "ClassDescriptions", fields: { UUID: "c1", Name: "MyClass" } },
      ],
    }));

    const result = await migrateLocalStorageProject(MOD_PATH);
    expect(result).toBe(true);
    expect(stagingUpsertRow).toHaveBeenCalledTimes(2);
    expect(stagingUpsertRow).toHaveBeenCalledWith(
      MOCK_DB_PATHS.staging, "lsx__Races", { UUID: "r1", Name: "CustomRace" }, true,
    );
    expect(stagingUpsertRow).toHaveBeenCalledWith(
      MOCK_DB_PATHS.staging, "lsx__ClassDescriptions", { UUID: "c1", Name: "MyClass" }, true,
    );
  });

  it("migrates disabled entries → stagingMarkDeleted for each", async () => {
    const key = projectKey(MOD_PATH);
    localStorage.setItem(key, JSON.stringify({
      disabled: {
        "Races::race-001": true,
        "Progressions::prog-001": true,
        "Races::race-002": false,  // not disabled, should be skipped
      },
    }));

    const result = await migrateLocalStorageProject(MOD_PATH);
    expect(result).toBe(true);
    expect(stagingMarkDeleted).toHaveBeenCalledTimes(2);
    expect(stagingMarkDeleted).toHaveBeenCalledWith(MOCK_DB_PATHS.staging, "lsx__Races", "race-001");
    expect(stagingMarkDeleted).toHaveBeenCalledWith(MOCK_DB_PATHS.staging, "lsx__Progressions", "prog-001");
  });

  it("migrates auto-entry overrides → stagingUpsertRow with is_new=false", async () => {
    const key = projectKey(MOD_PATH);
    localStorage.setItem(key, JSON.stringify({
      autoEntryOverrides: {
        "Races::race-001": { Name: "ModifiedRace", Description: "Changed" },
      },
    }));

    const result = await migrateLocalStorageProject(MOD_PATH);
    expect(result).toBe(true);
    expect(stagingUpsertRow).toHaveBeenCalledWith(
      MOCK_DB_PATHS.staging, "lsx__Races", { Name: "ModifiedRace", Description: "Changed" }, false,
    );
  });

  it("migrates loca entries → stagingSetMeta", async () => {
    const key = projectKey(MOD_PATH);
    const locaEntries = [{ handle: "h001", text: "Hello", version: 1 }];
    localStorage.setItem(key, JSON.stringify({ locaEntries }));

    const result = await migrateLocalStorageProject(MOD_PATH);
    expect(result).toBe(true);
    expect(stagingSetMeta).toHaveBeenCalledWith(
      MOCK_DB_PATHS.staging, "loca_entries", JSON.stringify(locaEntries),
    );
  });

  it("migrates auto loca entries → stagingUpsertRow for loca__english", async () => {
    const key = projectKey(MOD_PATH);
    localStorage.setItem(key, JSON.stringify({
      autoLocaEntries: [
        { handle: "h100", text: "Spell Name", version: 1 },
        { handle: "h200", text: "Spell Desc", version: 2 },
      ],
    }));

    const result = await migrateLocalStorageProject(MOD_PATH);
    expect(result).toBe(true);
    expect(stagingUpsertRow).toHaveBeenCalledWith(
      MOCK_DB_PATHS.staging, "loca__english",
      { contentuid: "h100", text: "Spell Name", version: "1" }, true,
    );
    expect(stagingUpsertRow).toHaveBeenCalledWith(
      MOCK_DB_PATHS.staging, "loca__english",
      { contentuid: "h200", text: "Spell Desc", version: "2" }, true,
    );
  });

  it("migrates osiris goal entries and file UUID → stagingSetMeta", async () => {
    const key = projectKey(MOD_PATH);
    const goals = [{ name: "Goal1", content: "data" }];
    localStorage.setItem(key, JSON.stringify({
      osirisGoalEntries: goals,
      osirisGoalFileUuid: "goal-uuid-123",
    }));

    const result = await migrateLocalStorageProject(MOD_PATH);
    expect(result).toBe(true);
    expect(stagingSetMeta).toHaveBeenCalledWith(
      MOCK_DB_PATHS.staging, "osiris_goal_entries", JSON.stringify(goals),
    );
    expect(stagingSetMeta).toHaveBeenCalledWith(
      MOCK_DB_PATHS.staging, "osiris_goal_file_uuid", "goal-uuid-123",
    );
  });

  it("migrates format preference → stagingSetMeta", async () => {
    const key = projectKey(MOD_PATH);
    localStorage.setItem(key, JSON.stringify({ format: "Json" }));

    const result = await migrateLocalStorageProject(MOD_PATH);
    expect(result).toBe(true);
    expect(stagingSetMeta).toHaveBeenCalledWith(MOCK_DB_PATHS.staging, "format", "Json");
  });

  it("is a no-op with empty data object", async () => {
    const key = projectKey(MOD_PATH);
    localStorage.setItem(key, JSON.stringify({}));

    const result = await migrateLocalStorageProject(MOD_PATH);
    expect(result).toBe(true);  // migration "occurred" (marked complete) even if nothing to migrate
    expect(stagingUpsertRow).not.toHaveBeenCalled();
    expect(stagingMarkDeleted).not.toHaveBeenCalled();
    expect(stagingSetMeta).not.toHaveBeenCalled();
  });

  it("sets _migrated flag after successful migration", async () => {
    const key = projectKey(MOD_PATH);
    localStorage.setItem(key, JSON.stringify({ format: "Yaml" }));

    await migrateLocalStorageProject(MOD_PATH);
    expect(localStorage.getItem(key + "_migrated")).toBe("true");
  });

  it("returns false on invalid JSON", async () => {
    const key = projectKey(MOD_PATH);
    localStorage.setItem(key, "not valid json {{{");

    const result = await migrateLocalStorageProject(MOD_PATH);
    expect(result).toBe(false);
  });

  it("handles combined migration of all data types", async () => {
    const key = projectKey(MOD_PATH);
    localStorage.setItem(key, JSON.stringify({
      manualEntries: [{ section: "Races", fields: { UUID: "r1", Name: "Race1" } }],
      disabled: { "Races::race-del": true },
      autoEntryOverrides: { "Progressions::prog-001": { Level: "5" } },
      locaEntries: [{ handle: "h1", text: "Text" }],
      format: "Json",
    }));

    const result = await migrateLocalStorageProject(MOD_PATH);
    expect(result).toBe(true);

    // manualEntries
    expect(stagingUpsertRow).toHaveBeenCalledWith(
      MOCK_DB_PATHS.staging, "lsx__Races", { UUID: "r1", Name: "Race1" }, true,
    );
    // disabled
    expect(stagingMarkDeleted).toHaveBeenCalledWith(MOCK_DB_PATHS.staging, "lsx__Races", "race-del");
    // autoEntryOverrides
    expect(stagingUpsertRow).toHaveBeenCalledWith(
      MOCK_DB_PATHS.staging, "lsx__Progressions", { Level: "5" }, false,
    );
    // locaEntries
    expect(stagingSetMeta).toHaveBeenCalledWith(
      MOCK_DB_PATHS.staging, "loca_entries", expect.any(String),
    );
    // format
    expect(stagingSetMeta).toHaveBeenCalledWith(MOCK_DB_PATHS.staging, "format", "Json");
  });
});
