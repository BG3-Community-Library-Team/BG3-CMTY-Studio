import { describe, it, expect } from "vitest";
import { isLsxEntry, isStatsEntry, isLocaEntry } from "../lib/types/entryRow.js";
import type { EntryRow } from "../lib/types/entryRow.js";

function makeRow(sourceType: "lsx" | "stats" | "loca"): EntryRow {
  return {
    _pk: "test-uuid",
    _pk_column: "UUID",
    _table: "test_table",
    _is_new: false,
    _is_modified: false,
    _is_deleted: false,
    _source_type: sourceType,
  };
}

describe("entryRow type guards", () => {
  describe("isLsxEntry", () => {
    it("returns true for lsx source type", () => {
      expect(isLsxEntry(makeRow("lsx"))).toBe(true);
    });
    it("returns false for stats source type", () => {
      expect(isLsxEntry(makeRow("stats"))).toBe(false);
    });
    it("returns false for loca source type", () => {
      expect(isLsxEntry(makeRow("loca"))).toBe(false);
    });
  });

  describe("isStatsEntry", () => {
    it("returns true for stats source type", () => {
      expect(isStatsEntry(makeRow("stats"))).toBe(true);
    });
    it("returns false for lsx source type", () => {
      expect(isStatsEntry(makeRow("lsx"))).toBe(false);
    });
    it("returns false for loca source type", () => {
      expect(isStatsEntry(makeRow("loca"))).toBe(false);
    });
  });

  describe("isLocaEntry", () => {
    it("returns true for loca source type", () => {
      expect(isLocaEntry(makeRow("loca"))).toBe(true);
    });
    it("returns false for lsx source type", () => {
      expect(isLocaEntry(makeRow("lsx"))).toBe(false);
    });
    it("returns false for stats source type", () => {
      expect(isLocaEntry(makeRow("stats"))).toBe(false);
    });
  });
});
