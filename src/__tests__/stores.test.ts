/**
 * Store tests — validates configStore.validateStoredProject(), makeKey patterns,
 * and core store logic. Highest-ROI test suite per TC-01 audit finding.
 */
import { describe, it, expect } from "vitest";
import { validateStoredProject } from "../lib/stores/configStore.svelte.js";

// ── validateStoredProject ─────────────────────────────────────────────

describe("validateStoredProject", () => {
  it("returns empty collections for empty data", () => {
    const result = validateStoredProject({});
    expect(result.disabled).toEqual({});
    expect(result.manualEntries).toEqual([]);
    expect(result.autoEntryOverrides).toEqual({});
    expect(result.autoEntryOrder).toEqual({});
    expect(result.format).toBeNull();
    expect(result.locaEntries).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  // ── disabled map ──────────────────────────────────────────────────

  describe("disabled map", () => {
    it("accepts valid Section::UUID keys with boolean true values", () => {
      const result = validateStoredProject({
        disabled: {
          "Races::a1b2c3d4-e5f6-7890-abcd-ef1234567890": true,
          "Progressions::11111111-2222-3333-4444-555555555555": true,
        },
      });
      expect(Object.keys(result.disabled)).toHaveLength(2);
      expect(result.disabled["Races::a1b2c3d4-e5f6-7890-abcd-ef1234567890"]).toBe(true);
      expect(result.disabled["Progressions::11111111-2222-3333-4444-555555555555"]).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it("rejects keys with invalid section names", () => {
      const result = validateStoredProject({
        disabled: { "FakeSection::a1b2c3d4-e5f6-7890-abcd-ef1234567890": true },
      });
      expect(Object.keys(result.disabled)).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain("FakeSection");
    });

    it("rejects keys with malformed UUIDs", () => {
      const result = validateStoredProject({
        disabled: { "Races::not-a-uuid": true },
      });
      expect(Object.keys(result.disabled)).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
    });

    it("rejects non-boolean values", () => {
      const result = validateStoredProject({
        disabled: { "Races::a1b2c3d4-e5f6-7890-abcd-ef1234567890": "yes" },
      });
      expect(Object.keys(result.disabled)).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
    });

    it("rejects keys with single colon separator", () => {
      const result = validateStoredProject({
        disabled: { "Races:a1b2c3d4-e5f6-7890-abcd-ef1234567890": true },
      });
      expect(Object.keys(result.disabled)).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
    });

    it("ignores non-object disabled value", () => {
      const result = validateStoredProject({ disabled: "not-an-object" });
      expect(Object.keys(result.disabled)).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it("strips false values from disabled map (only true entries count)", () => {
      const result = validateStoredProject({
        disabled: { "Races::a1b2c3d4-e5f6-7890-abcd-ef1234567890": false },
      });
      expect(Object.keys(result.disabled)).toHaveLength(0);
    });
  });

  // ── legacy enabled map migration ──────────────────────────────────

  describe("legacy enabled map migration", () => {
    it("migrates enabled:false entries to disabled:true", () => {
      const result = validateStoredProject({
        enabled: {
          "Races::a1b2c3d4-e5f6-7890-abcd-ef1234567890": true,
          "Progressions::11111111-2222-3333-4444-555555555555": false,
        },
      });
      // enabled:true is active (not disabled), enabled:false becomes disabled:true
      expect(Object.keys(result.disabled)).toHaveLength(1);
      expect(result.disabled["Progressions::11111111-2222-3333-4444-555555555555"]).toBe(true);
      expect(result.disabled["Races::a1b2c3d4-e5f6-7890-abcd-ef1234567890"]).toBeUndefined();
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain("Migrated");
    });

    it("prefers disabled map over legacy enabled map", () => {
      const result = validateStoredProject({
        disabled: { "Races::a1b2c3d4-e5f6-7890-abcd-ef1234567890": true },
        enabled: { "Progressions::11111111-2222-3333-4444-555555555555": false },
      });
      // disabled map is used, enabled is ignored
      expect(Object.keys(result.disabled)).toHaveLength(1);
      expect(result.disabled["Races::a1b2c3d4-e5f6-7890-abcd-ef1234567890"]).toBe(true);
    });
  });

  // ── manual entries ────────────────────────────────────────────────

  describe("manual entries", () => {
    it("accepts valid manual entries with section and string fields", () => {
      const result = validateStoredProject({
        manualEntries: [
          { section: "Races", fields: { UUID: "a1b2c3d4-e5f6-7890-abcd-ef1234567890", Name: "TestRace" } },
          { section: "Feats", fields: { UUID: "11111111-2222-3333-4444-555555555555" }, imported: true },
        ],
      });
      expect(result.manualEntries).toHaveLength(2);
      expect(result.warnings).toHaveLength(0);
    });

    it("rejects entries with unknown section names", () => {
      const result = validateStoredProject({
        manualEntries: [{ section: "Bogus", fields: { UUID: "test" } }],
      });
      expect(result.manualEntries).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
    });

    it("rejects entries missing fields property", () => {
      const result = validateStoredProject({
        manualEntries: [{ section: "Races" }],
      });
      expect(result.manualEntries).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
    });

    it("rejects entries with non-string field values", () => {
      const result = validateStoredProject({
        manualEntries: [{ section: "Races", fields: { UUID: 42 } }],
      });
      expect(result.manualEntries).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
    });

    it("rejects null entries in the array", () => {
      const result = validateStoredProject({
        manualEntries: [null, undefined],
      });
      expect(result.manualEntries).toHaveLength(0);
      expect(result.warnings).toHaveLength(2);
    });

    it("ignores non-array manualEntries value", () => {
      const result = validateStoredProject({ manualEntries: "not-array" });
      expect(result.manualEntries).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });

  // ── auto entry overrides ──────────────────────────────────────────

  describe("auto entry overrides", () => {
    it("accepts valid overrides with Section::UUID keys and string values", () => {
      const result = validateStoredProject({
        autoEntryOverrides: {
          "Lists::a1b2c3d4-e5f6-7890-abcd-ef1234567890": { PassivesAdded: "NewPassive" },
        },
      });
      expect(Object.keys(result.autoEntryOverrides)).toHaveLength(1);
      expect(result.warnings).toHaveLength(0);
    });

    it("rejects overrides with invalid keys", () => {
      const result = validateStoredProject({
        autoEntryOverrides: { "Bad::not-uuid": { field: "value" } },
      });
      expect(Object.keys(result.autoEntryOverrides)).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
    });

    it("rejects overrides with non-string field values", () => {
      const result = validateStoredProject({
        autoEntryOverrides: {
          "Races::a1b2c3d4-e5f6-7890-abcd-ef1234567890": { count: 42 },
        },
      });
      expect(Object.keys(result.autoEntryOverrides)).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
    });
  });

  // ── auto entry order ──────────────────────────────────────────────

  describe("auto entry order", () => {
    it("accepts valid section-keyed UUID arrays", () => {
      const result = validateStoredProject({
        autoEntryOrder: {
          Races: ["uuid-1", "uuid-2"],
          Feats: ["uuid-3"],
        },
      });
      expect(Object.keys(result.autoEntryOrder)).toHaveLength(2);
      expect(result.warnings).toHaveLength(0);
    });

    it("rejects entries with invalid section names", () => {
      const result = validateStoredProject({
        autoEntryOrder: { Bogus: ["uuid-1"] },
      });
      expect(Object.keys(result.autoEntryOrder)).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
    });

    it("rejects entries with non-array values", () => {
      const result = validateStoredProject({
        autoEntryOrder: { Races: "not-array" },
      });
      expect(Object.keys(result.autoEntryOrder)).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
    });
  });

  // ── format ────────────────────────────────────────────────────────

  describe("format", () => {
    it("accepts 'Yaml'", () => {
      const result = validateStoredProject({ format: "Yaml" });
      expect(result.format).toBe("Yaml");
      expect(result.warnings).toHaveLength(0);
    });

    it("accepts 'Json'", () => {
      const result = validateStoredProject({ format: "Json" });
      expect(result.format).toBe("Json");
    });

    it("rejects invalid format strings", () => {
      const result = validateStoredProject({ format: "xml" });
      expect(result.format).toBeNull();
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain("xml");
    });

    it("returns null for missing format", () => {
      const result = validateStoredProject({});
      expect(result.format).toBeNull();
      expect(result.warnings).toHaveLength(0);
    });
  });

  // ── loca entries ──────────────────────────────────────────────────

  describe("loca entries", () => {
    it("accepts valid loca entries", () => {
      const result = validateStoredProject({
        locaEntries: [
          {
            label: "MyMod_English",
            values: [
              { contentuid: "h12345", version: 1, text: "Hello World" },
            ],
          },
        ],
      });
      expect(result.locaEntries).toHaveLength(1);
      expect(result.warnings).toHaveLength(0);
    });

    it("rejects loca entries with missing label", () => {
      const result = validateStoredProject({
        locaEntries: [{ values: [{ contentuid: "h1", version: 1, text: "t" }] }],
      });
      expect(result.locaEntries).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
    });

    it("rejects loca entries with invalid value objects", () => {
      const result = validateStoredProject({
        locaEntries: [{ label: "Test", values: [{ contentuid: "h1" }] }],
      });
      expect(result.locaEntries).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
    });

    it("rejects loca entries with non-array values", () => {
      const result = validateStoredProject({
        locaEntries: [{ label: "Test", values: "not-array" }],
      });
      expect(result.locaEntries).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
    });
  });

  // ── mixed valid and invalid data ──────────────────────────────────

  describe("mixed data", () => {
    it("preserves valid entries while stripping invalid ones", () => {
      const result = validateStoredProject({
        disabled: {
          "Races::a1b2c3d4-e5f6-7890-abcd-ef1234567890": true,
          "Bad::invalid": true,
        },
        manualEntries: [
          { section: "Feats", fields: { UUID: "test-uuid" } },
          { section: "NonExistent", fields: {} },
        ],
        format: "Yaml",
      });
      expect(Object.keys(result.disabled)).toHaveLength(1);
      expect(result.manualEntries).toHaveLength(1);
      expect(result.format).toBe("Yaml");
      expect(result.warnings).toHaveLength(2);
    });
  });
});

// ── getErrorMessage ─────────────────────────────────────────────────

describe("getErrorMessage", () => {
  // Import from types since that's where it lives
  let getErrorMessage: (err: unknown) => string;

  // Dynamic import to avoid circular deps
  it("can import getErrorMessage", async () => {
    const mod = await import("../lib/types/index.js");
    getErrorMessage = mod.getErrorMessage;
    expect(typeof getErrorMessage).toBe("function");
  });

  it("extracts message from plain string", async () => {
    const { getErrorMessage } = await import("../lib/types/index.js");
    expect(getErrorMessage("something broke")).toBe("something broke");
  });

  it("extracts message from Error object", async () => {
    const { getErrorMessage } = await import("../lib/types/index.js");
    expect(getErrorMessage(new Error("test error"))).toBe("test error");
  });

  it("extracts message from AppError-shaped object", async () => {
    const { getErrorMessage } = await import("../lib/types/index.js");
    expect(getErrorMessage({ kind: "NotFound", message: "file not found" })).toBe("file not found");
  });

  it("handles null/undefined gracefully", async () => {
    const { getErrorMessage } = await import("../lib/types/index.js");
    expect(getErrorMessage(null)).toBe("null");
    expect(getErrorMessage(undefined)).toBe("undefined");
  });

  it("stringifies plain objects", async () => {
    const { getErrorMessage } = await import("../lib/types/index.js");
    const result = getErrorMessage({ code: 42 });
    expect(typeof result).toBe("string");
  });

  it("extracts message from Timeout error", async () => {
    const { getErrorMessage } = await import("../lib/types/index.js");
    expect(getErrorMessage({ kind: "Timeout", message: "Operation timed out after 120s" }))
      .toBe("Operation timed out after 120s");
  });

  it("detects Timeout kind via isAppError", async () => {
    const { isAppError } = await import("../lib/types/index.js");
    const err = { kind: "Timeout", message: "timed out" };
    expect(isAppError(err)).toBe(true);
    expect(err.kind).toBe("Timeout");
  });
});

// ── Section type re-export (IPC-05) ──────────────────────────────

describe("Section type re-export", () => {
  it("re-exports Section from generated bindings", async () => {
    const indexMod = await import("../lib/types/index.js");
    const generatedMod = await import("../lib/types/generated/Section.js");
    // SECTIONS_ORDERED should contain valid Section values that match generated type
    expect(indexMod.SECTIONS_ORDERED.length).toBeGreaterThan(50);
    // Verify the generated module export exists
    expect(generatedMod).toBeDefined();
  });
});
