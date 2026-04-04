/**
 * Localization entry model tests — covers LocaFileEntry/LocaValue ID generation,
 * validateStoredProject migration for loca entries, and edge cases.
 */
import { describe, it, expect } from "vitest";
import { validateStoredProject } from "../lib/stores/configStore.svelte.js";

// ── validateStoredProject loca migration ────────────────────────────

describe("loca entry ID migration", () => {
  it("assigns unique IDs to entries without them", () => {
    const result = validateStoredProject({
      locaEntries: [
        { label: "Mod_English", values: [{ contentuid: "h1", version: 1, text: "Hello" }] },
        { label: "Mod_French", values: [{ contentuid: "h2", version: 1, text: "Bonjour" }] },
      ],
    });
    expect(result.locaEntries).toHaveLength(2);
    expect(result.locaEntries[0].id).toBeDefined();
    expect(result.locaEntries[1].id).toBeDefined();
    expect(result.locaEntries[0].id).not.toBe(result.locaEntries[1].id);
  });

  it("assigns unique IDs to values without them", () => {
    const result = validateStoredProject({
      locaEntries: [{
        label: "Mod_English",
        values: [
          { contentuid: "h1", version: 1, text: "A" },
          { contentuid: "h2", version: 1, text: "B" },
        ],
      }],
    });
    const vals = result.locaEntries[0].values;
    expect(vals[0].id).toBeDefined();
    expect(vals[1].id).toBeDefined();
    expect(vals[0].id).not.toBe(vals[1].id);
  });

  it("preserves existing IDs", () => {
    const result = validateStoredProject({
      locaEntries: [{
        id: "entry-id-1",
        label: "Mod_English",
        values: [{ id: "val-id-1", contentuid: "h1", version: 1, text: "A" }],
      }],
    });
    expect(result.locaEntries[0].id).toBe("entry-id-1");
    expect(result.locaEntries[0].values[0].id).toBe("val-id-1");
  });

  it("handles mixed — entries with and without IDs", () => {
    const result = validateStoredProject({
      locaEntries: [
        { id: "keep-me", label: "A", values: [{ contentuid: "h1", version: 1, text: "X" }] },
        { label: "B", values: [{ id: "keep-val", contentuid: "h2", version: 1, text: "Y" }] },
      ],
    });
    expect(result.locaEntries[0].id).toBe("keep-me");
    expect(typeof result.locaEntries[0].values[0].id).toBe("string");
    expect(result.locaEntries[1].id).toBeDefined();
    expect(result.locaEntries[1].id).not.toBe("keep-me");
    expect(result.locaEntries[1].values[0].id).toBe("keep-val");
  });

  it("preserves label, contentuid, version, text after migration", () => {
    const result = validateStoredProject({
      locaEntries: [{
        label: "TestMod_Lang",
        values: [{ contentuid: "habcdef", version: 3, text: "Sample text" }],
      }],
    });
    const entry = result.locaEntries[0];
    expect(entry.label).toBe("TestMod_Lang");
    expect(entry.values[0].contentuid).toBe("habcdef");
    expect(entry.values[0].version).toBe(3);
    expect(entry.values[0].text).toBe("Sample text");
  });

  it("generates no warnings for valid entries", () => {
    const result = validateStoredProject({
      locaEntries: [{ label: "A", values: [{ contentuid: "h1", version: 1, text: "T" }] }],
    });
    expect(result.warnings).toHaveLength(0);
  });

  it("rejects entries with missing label", () => {
    const result = validateStoredProject({
      locaEntries: [{ values: [{ contentuid: "h1", version: 1, text: "T" }] }],
    });
    expect(result.locaEntries).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
  });

  it("rejects entries with non-string contentuid", () => {
    const result = validateStoredProject({
      locaEntries: [{ label: "A", values: [{ contentuid: 123, version: 1, text: "T" }] }],
    });
    expect(result.locaEntries).toHaveLength(0);
  });

  it("rejects entries when values is not an array", () => {
    const result = validateStoredProject({
      locaEntries: [{ label: "A", values: "not-array" }],
    });
    expect(result.locaEntries).toHaveLength(0);
  });

  it("handles empty values array", () => {
    const result = validateStoredProject({
      locaEntries: [{ label: "A", values: [] }],
    });
    expect(result.locaEntries).toHaveLength(1);
    expect(result.locaEntries[0].values).toEqual([]);
  });
});
