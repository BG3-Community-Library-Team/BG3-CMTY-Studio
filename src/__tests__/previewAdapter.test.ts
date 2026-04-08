import { describe, it, expect, vi } from "vitest";

// Mock the tauri/staging imports that projectStore uses
vi.mock("../lib/tauri/staging.js", () => ({
  stagingListSections: vi.fn().mockResolvedValue([]),
  stagingQuerySection: vi.fn().mockResolvedValue([]),
  stagingGetMeta: vi.fn().mockResolvedValue(null),
  stagingSetMeta: vi.fn().mockResolvedValue(undefined),
  stagingUpsertRow: vi.fn().mockResolvedValue(undefined),
  stagingMarkDeleted: vi.fn().mockResolvedValue(undefined),
  stagingUnmarkDeleted: vi.fn().mockResolvedValue(undefined),
  stagingBatchWrite: vi.fn().mockResolvedValue(undefined),
  stagingSnapshot: vi.fn().mockResolvedValue(undefined),
  stagingUndo: vi.fn().mockResolvedValue(undefined),
  stagingRedo: vi.fn().mockResolvedValue(undefined),
  stagingGetRow: vi.fn().mockResolvedValue(null),
  stagingCompactUndo: vi.fn().mockResolvedValue(undefined),
  stagingReplaceSection: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/tauri/db-management.js", () => ({
  getDbPaths: vi.fn().mockResolvedValue({ staging: "", ref_base: "" }),
  checkStagingIntegrity: vi.fn().mockResolvedValue([]),
  recreateStaging: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/tauri/save.js", () => ({
  saveSection: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/tauri/lsx-export.js", () => ({
  previewLsx: vi.fn().mockResolvedValue("<lsx/>"),
}));

import { entryRowToLsxPreview } from "../lib/utils/previewAdapter.js";
import type { EntryRow } from "../lib/types/entryRow.js";

describe("entryRowToLsxPreview", () => {
  it("converts an EntryRow to LsxPreviewEntry excluding meta columns", () => {
    const row: EntryRow = {
      _pk: "test-uuid",
      _pk_column: "UUID",
      _table: "Races",
      _is_new: false,
      _is_modified: false,
      _is_deleted: false,
      _source_type: "lsx",
      UUID: "test-uuid",
      Name: "CustomRace",
      DisplayName: "Custom Race",
    };
    const result = entryRowToLsxPreview(row, "Race");
    expect(result.uuid).toBe("test-uuid");
    expect(result.node_id).toBe("Race");
    expect(result.raw_attributes).toHaveProperty("UUID");
    expect(result.raw_attributes).toHaveProperty("Name");
    expect(result.raw_attributes).toHaveProperty("DisplayName");
    // Meta columns should be excluded
    expect(result.raw_attributes).not.toHaveProperty("_pk");
    expect(result.raw_attributes).not.toHaveProperty("_is_new");
    expect(result.raw_attributes).not.toHaveProperty("_table");
    expect(result.raw_attributes).not.toHaveProperty("_source_type");
  });

  it("skips null and undefined values", () => {
    const row: EntryRow = {
      _pk: "uuid1",
      _pk_column: "UUID",
      _table: "test",
      _is_new: false,
      _is_modified: false,
      _is_deleted: false,
      _source_type: "lsx",
      UUID: "uuid1",
      Name: null as unknown as string,
      Desc: undefined as unknown as string,
      Valid: "yes",
    };
    const result = entryRowToLsxPreview(row, "Node");
    expect(result.raw_attributes).not.toHaveProperty("Name");
    expect(result.raw_attributes).not.toHaveProperty("Desc");
    expect(result.raw_attributes).toHaveProperty("Valid", "yes");
  });

  it("converts non-string values to strings", () => {
    const row: EntryRow = {
      _pk: "uuid1",
      _pk_column: "UUID",
      _table: "test",
      _is_new: false,
      _is_modified: false,
      _is_deleted: false,
      _source_type: "lsx",
      UUID: "uuid1",
      Level: 5,
      IsHidden: true,
    };
    const result = entryRowToLsxPreview(row, "Node");
    expect(result.raw_attributes["Level"]).toBe("5");
    expect(result.raw_attributes["IsHidden"]).toBe("true");
  });

  it("excludes all underscore-prefixed columns", () => {
    const row: EntryRow = {
      _pk: "uuid1",
      _pk_column: "UUID",
      _table: "test",
      _is_new: false,
      _is_modified: false,
      _is_deleted: false,
      _source_type: "lsx",
      _file_id: "something",
      _SourceID: "src",
      _row_id: "123",
      _original_hash: "abc",
      UUID: "uuid1",
    };
    const result = entryRowToLsxPreview(row, "Node");
    expect(Object.keys(result.raw_attributes)).toEqual(["UUID"]);
  });
});
