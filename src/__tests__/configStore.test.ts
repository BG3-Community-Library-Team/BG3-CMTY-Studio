/**
 * configStore tests — covers core state mutations, undo/redo integration,
 * edge cases, and unhappy paths for all major ConfigStore methods.
 *
 * Note: configStore's selectedEntries derivation depends on modStore.scanResult,
 * so tests that exercise entry toggling require setting up a mock scanResult.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// Must import stores after mocks are resolved
const { configStore } = await import("../lib/stores/configStore.svelte.js");
const { undoStore } = await import("../lib/stores/undoStore.svelte.js");
const { modStore } = await import("../lib/stores/modStore.svelte.js");

/** Helper: set up modStore with a fake scan result for a given section */
function setupScanResult(section: string, entries: { uuid: string; display_name: string; changes: any[] }[]) {
  (modStore as any).scanResult = {
    mod_meta: { folder: "TestMod", name: "Test", author: "", description: "", version: "" },
    sections: [{ section, entries: entries.map(e => ({ ...e, node_id: null, raw_attributes: [], raw_children: [] })) }],
    config_files: [],
  };
}

describe("ConfigStore mutations", () => {
  beforeEach(() => {
    configStore.reset();
    undoStore.clear();
    (modStore as any).scanResult = null;
    (modStore as any).selectedModPath = "";
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── toggleEntry ───────────────────────────────────────────────────

  describe("toggleEntry", () => {
    it("enables an entry that starts disabled", () => {
      configStore.disabled["Races::aaaa1111-2222-3333-4444-555555555555"] = true;
      configStore.toggleEntry("Races", "aaaa1111-2222-3333-4444-555555555555");
      expect(configStore.disabled["Races::aaaa1111-2222-3333-4444-555555555555"]).toBeUndefined();
    });

    it("disables an active entry (default state)", () => {
      configStore.toggleEntry("Races", "aaaa1111-2222-3333-4444-555555555555");
      expect(configStore.disabled["Races::aaaa1111-2222-3333-4444-555555555555"]).toBe(true);
    });

    it("disables an active entry not yet in the disabled map", () => {
      configStore.toggleEntry("Races", "bbbb1111-2222-3333-4444-555555555555");
      expect(configStore.disabled["Races::bbbb1111-2222-3333-4444-555555555555"]).toBe(true);
    });

    it("marks preview stale after toggle", () => {
      configStore.previewStale = false;
      configStore.toggleEntry("Races", "aaaa1111-2222-3333-4444-555555555555");
      expect(configStore.previewStale).toBe(true);
    });

    it("pushes an undo command that reverses the toggle", () => {
      configStore.disabled["Races::aaaa1111-2222-3333-4444-555555555555"] = true;
      configStore.toggleEntry("Races", "aaaa1111-2222-3333-4444-555555555555");
      expect(configStore.disabled["Races::aaaa1111-2222-3333-4444-555555555555"]).toBeUndefined();

      undoStore.undo();
      expect(configStore.disabled["Races::aaaa1111-2222-3333-4444-555555555555"]).toBe(true);
    });

    it("supports redo after undo", () => {
      configStore.toggleEntry("Races", "aaaa1111-2222-3333-4444-555555555555");
      undoStore.undo();
      undoStore.redo();
      expect(configStore.disabled["Races::aaaa1111-2222-3333-4444-555555555555"]).toBe(true);
    });
  });

  // ── enableSection / disableSection ────────────────────────────────

  describe("enableSection", () => {
    it("enables all entries in a section from scan result", () => {
      setupScanResult("Races", [
        { uuid: "aaaa1111-2222-3333-4444-555555555555", display_name: "Elf", changes: [] },
        { uuid: "bbbb1111-2222-3333-4444-555555555555", display_name: "Dwarf", changes: [] },
      ]);
      configStore.initFromScan();
      // Disable both entries first
      configStore.disabled["Races::aaaa1111-2222-3333-4444-555555555555"] = true;
      configStore.disabled["Races::bbbb1111-2222-3333-4444-555555555555"] = true;

      configStore.enableSection("Races");
      expect(configStore.disabled["Races::aaaa1111-2222-3333-4444-555555555555"]).toBeUndefined();
      expect(configStore.disabled["Races::bbbb1111-2222-3333-4444-555555555555"]).toBeUndefined();
    });

    it("no-ops when scan result is null", () => {
      (modStore as any).scanResult = null;
      configStore.enableSection("Races"); // should not throw
    });

    it("no-ops when section doesn't exist in scan", () => {
      setupScanResult("Progressions", []);
      configStore.enableSection("Races"); // section not in scan
    });

    it("is undoable — restores previous disabled states", () => {
      setupScanResult("Races", [
        { uuid: "aaaa1111-2222-3333-4444-555555555555", display_name: "Elf", changes: [] },
        { uuid: "bbbb1111-2222-3333-4444-555555555555", display_name: "Dwarf", changes: [] },
      ]);
      configStore.initFromScan();
      // Disable only bbbb
      configStore.disabled["Races::bbbb1111-2222-3333-4444-555555555555"] = true;
      undoStore.clear(); // clear init undo

      configStore.enableSection("Races");
      expect(configStore.disabled["Races::bbbb1111-2222-3333-4444-555555555555"]).toBeUndefined();

      undoStore.undo();
      expect(configStore.disabled["Races::aaaa1111-2222-3333-4444-555555555555"]).toBeUndefined(); // was already active
      expect(configStore.disabled["Races::bbbb1111-2222-3333-4444-555555555555"]).toBe(true); // restored to disabled
    });
  });

  describe("disableSection", () => {
    it("disables all entries in a section", () => {
      setupScanResult("Races", [
        { uuid: "aaaa1111-2222-3333-4444-555555555555", display_name: "Elf", changes: [] },
      ]);
      configStore.initFromScan();
      undoStore.clear();

      configStore.disableSection("Races");
      expect(configStore.disabled["Races::aaaa1111-2222-3333-4444-555555555555"]).toBe(true);
    });

    it("no-ops when scan result is null", () => {
      (modStore as any).scanResult = null;
      configStore.disableSection("Races"); // should not throw
    });
  });

  // ── clearSection ──────────────────────────────────────────────────

  describe("clearSection", () => {
    it("disables auto entries, removes manual entries, and clears overrides for the section", () => {
      setupScanResult("Races", [
        { uuid: "aaaa1111-2222-3333-4444-555555555555", display_name: "Elf", changes: [] },
      ]);
      configStore.initFromScan();
      configStore.manualEntries = [{ section: "Races", fields: { Name: "Custom" } }];
      configStore.autoEntryOverrides["Races::aaaa1111-2222-3333-4444-555555555555"] = { Name: "Override" };
      undoStore.clear();

      configStore.clearSection("Races");

      expect(configStore.disabled["Races::aaaa1111-2222-3333-4444-555555555555"]).toBe(true);
      expect(configStore.manualEntries.filter(e => e.section === "Races")).toHaveLength(0);
      expect(configStore.autoEntryOverrides["Races::aaaa1111-2222-3333-4444-555555555555"]).toBeUndefined();
    });

    it("does not affect entries in other sections", () => {
      setupScanResult("Races", [
        { uuid: "aaaa1111-2222-3333-4444-555555555555", display_name: "Elf", changes: [] },
      ]);
      configStore.initFromScan();
      configStore.manualEntries = [
        { section: "Races", fields: { Name: "RaceEntry" } },
        { section: "Progressions", fields: { Name: "ProgEntry" } },
      ];
      undoStore.clear();

      configStore.clearSection("Races");
      expect(configStore.manualEntries).toHaveLength(1);
      expect(configStore.manualEntries[0].section).toBe("Progressions");
    });

    it("is fully undoable — restores entries, disabled states, and overrides", () => {
      setupScanResult("Races", [
        { uuid: "aaaa1111-2222-3333-4444-555555555555", display_name: "Elf", changes: [] },
      ]);
      configStore.initFromScan();
      configStore.manualEntries = [{ section: "Races", fields: { Name: "Custom" } }];
      configStore.autoEntryOverrides["Races::aaaa1111-2222-3333-4444-555555555555"] = { Name: "Override" };
      undoStore.clear();

      configStore.clearSection("Races");
      undoStore.undo();

      expect(configStore.disabled["Races::aaaa1111-2222-3333-4444-555555555555"]).toBeUndefined(); // was active before
      expect(configStore.manualEntries.filter(e => e.section === "Races")).toHaveLength(1);
      expect(configStore.autoEntryOverrides["Races::aaaa1111-2222-3333-4444-555555555555"]).toEqual({ Name: "Override" });
    });
  });

  // ── Manual entries ────────────────────────────────────────────────

  describe("addManualEntry", () => {
    it("adds an entry with section and fields", () => {
      configStore.addManualEntry("Races", { Name: "CustomRace", UUID: "test-uuid" });
      expect(configStore.manualEntries).toHaveLength(1);
      expect(configStore.manualEntries[0].section).toBe("Races");
      expect(configStore.manualEntries[0].fields.Name).toBe("CustomRace");
    });

    it("marks imported entries", () => {
      configStore.addManualEntry("Races", { Name: "Imported" }, true);
      expect(configStore.manualEntries[0].imported).toBe(true);
    });

    it("stores comment when provided", () => {
      configStore.addManualEntry("Races", { Name: "Commented" }, false, "# My comment");
      expect(configStore.manualEntries[0].comment).toBe("# My comment");
    });

    it("does not store empty comment string", () => {
      configStore.addManualEntry("Races", { Name: "NoComment" }, false, "");
      expect(configStore.manualEntries[0].comment).toBeUndefined();
    });

    it("is undoable — pops the added entry", () => {
      configStore.addManualEntry("Races", { Name: "Undo Me" });
      expect(configStore.manualEntries).toHaveLength(1);
      undoStore.undo();
      expect(configStore.manualEntries).toHaveLength(0);
    });
  });

  describe("updateManualEntry", () => {
    it("updates fields at the given index", () => {
      configStore.manualEntries = [{ section: "Races", fields: { Name: "Old" } }];
      configStore.updateManualEntry(0, "Races", { Name: "New" });
      expect(configStore.manualEntries[0].fields.Name).toBe("New");
    });

    it("preserves imported flag on update", () => {
      configStore.manualEntries = [{ section: "Races", fields: { Name: "Old" }, imported: true }];
      configStore.updateManualEntry(0, "Races", { Name: "New" });
      expect(configStore.manualEntries[0].imported).toBe(true);
    });

    it("no-ops for negative index", () => {
      configStore.manualEntries = [{ section: "Races", fields: { Name: "Keep" } }];
      configStore.updateManualEntry(-1, "Races", { Name: "Nope" });
      expect(configStore.manualEntries[0].fields.Name).toBe("Keep");
    });

    it("no-ops for out-of-bounds index", () => {
      configStore.manualEntries = [{ section: "Races", fields: { Name: "Keep" } }];
      configStore.updateManualEntry(5, "Races", { Name: "Nope" });
      expect(configStore.manualEntries[0].fields.Name).toBe("Keep");
    });

    it("is undoable — restores old fields", () => {
      configStore.manualEntries = [{ section: "Races", fields: { Name: "Original" } }];
      undoStore.clear();
      configStore.updateManualEntry(0, "Races", { Name: "Updated" });
      undoStore.undo();
      expect(configStore.manualEntries[0].fields.Name).toBe("Original");
    });
  });

  describe("removeManualEntry", () => {
    it("removes entry at the given index", () => {
      configStore.manualEntries = [
        { section: "Races", fields: { Name: "A" } },
        { section: "Races", fields: { Name: "B" } },
      ];
      configStore.removeManualEntry(0);
      expect(configStore.manualEntries).toHaveLength(1);
      expect(configStore.manualEntries[0].fields.Name).toBe("B");
    });

    it("no-ops for negative index", () => {
      configStore.manualEntries = [{ section: "Races", fields: { Name: "Keep" } }];
      configStore.removeManualEntry(-1);
      expect(configStore.manualEntries).toHaveLength(1);
    });

    it("no-ops for out-of-bounds index", () => {
      configStore.manualEntries = [{ section: "Races", fields: { Name: "Keep" } }];
      configStore.removeManualEntry(99);
      expect(configStore.manualEntries).toHaveLength(1);
    });

    it("is undoable — re-inserts at original position", () => {
      configStore.manualEntries = [
        { section: "Races", fields: { Name: "A" } },
        { section: "Races", fields: { Name: "B" } },
        { section: "Races", fields: { Name: "C" } },
      ];
      undoStore.clear();
      configStore.removeManualEntry(1); // remove "B"
      expect(configStore.manualEntries).toHaveLength(2);

      undoStore.undo();
      expect(configStore.manualEntries).toHaveLength(3);
      expect(configStore.manualEntries[1].fields.Name).toBe("B");
    });
  });

  // ── Edit overrides ────────────────────────────────────────────────

  describe("setEditOverride", () => {
    it("creates a new override when none exists for that field", () => {
      configStore.setEditOverride("Races", "uuid-1", "PassivesAdded", "NewPassive");
      expect(configStore.editOverrides).toHaveLength(1);
      expect(configStore.editOverrides[0].value).toBe("NewPassive");
    });

    it("updates existing override value when one already exists", () => {
      configStore.editOverrides = [{
        key: "Races::uuid-1::PassivesAdded",
        section: "Races", entryId: "uuid-1", field: "PassivesAdded", value: "Old",
      }];
      configStore.setEditOverride("Races", "uuid-1", "PassivesAdded", "New");
      expect(configStore.editOverrides).toHaveLength(1);
      expect(configStore.editOverrides[0].value).toBe("New");
    });

    it("undo of new override removes it", () => {
      undoStore.clear();
      configStore.setEditOverride("Races", "uuid-1", "Field", "Val");
      expect(configStore.editOverrides).toHaveLength(1);
      undoStore.undo();
      expect(configStore.editOverrides).toHaveLength(0);
    });

    it("undo of updated override restores old value", () => {
      configStore.editOverrides = [{
        key: "Races::uuid-1::Field",
        section: "Races", entryId: "uuid-1", field: "Field", value: "Original",
      }];
      undoStore.clear();
      configStore.setEditOverride("Races", "uuid-1", "Field", "Changed");
      undoStore.undo();
      expect(configStore.editOverrides[0].value).toBe("Original");
    });
  });

  describe("removeEditOverride", () => {
    it("removes an existing override", () => {
      configStore.editOverrides = [{
        key: "Races::uuid-1::Field",
        section: "Races", entryId: "uuid-1", field: "Field", value: "Val",
      }];
      configStore.removeEditOverride("Races", "uuid-1", "Field");
      expect(configStore.editOverrides).toHaveLength(0);
    });

    it("no-ops when override doesn't exist", () => {
      configStore.editOverrides = [];
      configStore.removeEditOverride("Races", "nonexistent", "Field");
      expect(configStore.editOverrides).toHaveLength(0);
    });

    it("undo restores the removed override", () => {
      configStore.editOverrides = [{
        key: "Races::uuid-1::Field",
        section: "Races", entryId: "uuid-1", field: "Field", value: "Important",
      }];
      undoStore.clear();
      configStore.removeEditOverride("Races", "uuid-1", "Field");
      undoStore.undo();
      expect(configStore.editOverrides).toHaveLength(1);
      expect(configStore.editOverrides[0].value).toBe("Important");
    });
  });

  // ── Auto entry overrides ──────────────────────────────────────────

  describe("auto entry overrides", () => {
    it("setAutoEntryOverride stores fields for a key", () => {
      configStore.setAutoEntryOverride("Races", "uuid-1", { Name: "Override" });
      expect(configStore.getAutoEntryOverride("Races", "uuid-1")).toEqual({ Name: "Override" });
    });

    it("setAutoEntryOverride overwrites previous entry", () => {
      configStore.setAutoEntryOverride("Races", "uuid-1", { Name: "First" });
      configStore.setAutoEntryOverride("Races", "uuid-1", { Name: "Second" });
      expect(configStore.getAutoEntryOverride("Races", "uuid-1")?.Name).toBe("Second");
    });

    it("clearAutoEntryOverride removes the override", () => {
      configStore.setAutoEntryOverride("Races", "uuid-1", { Name: "Clear Me" });
      undoStore.clear();
      configStore.clearAutoEntryOverride("Races", "uuid-1");
      expect(configStore.getAutoEntryOverride("Races", "uuid-1")).toBeUndefined();
    });

    it("clearAutoEntryOverride is undoable", () => {
      configStore.setAutoEntryOverride("Races", "uuid-1", { Name: "Persist" });
      undoStore.clear();
      configStore.clearAutoEntryOverride("Races", "uuid-1");
      undoStore.undo();
      expect(configStore.getAutoEntryOverride("Races", "uuid-1")).toEqual({ Name: "Persist" });
    });

    it("clearAutoEntryOverride no-ops gracefully when key doesn't exist", () => {
      undoStore.clear();
      configStore.clearAutoEntryOverride("Races", "nonexistent");
      // Should not throw, and undo should also be safe
      undoStore.undo();
    });

    it("getAutoEntryOverride returns undefined for nonexistent keys", () => {
      expect(configStore.getAutoEntryOverride("Races", "nope")).toBeUndefined();
    });
  });

  // ── Format and preview ────────────────────────────────────────────

  describe("format and preview", () => {
    it("toggleFormat switches between Yaml and Json", () => {
      configStore.format = "Yaml";
      configStore.toggleFormat();
      expect(configStore.format).toBe("Json");
      configStore.toggleFormat();
      expect(configStore.format).toBe("Yaml");
    });

    it("setPreview updates preview text and clears stale flag", () => {
      configStore.previewStale = true;
      configStore.setPreview("preview content", "<b>html</b>");
      expect(configStore.previewText).toBe("preview content");
      expect(configStore.highlightedPreviewHtml).toBe("<b>html</b>");
      expect(configStore.previewStale).toBe(false);
    });

    it("setPreview with empty html defaults to empty string", () => {
      configStore.setPreview("content");
      expect(configStore.highlightedPreviewHtml).toBe("");
    });
  });

  // ── reset ─────────────────────────────────────────────────────────

  describe("reset", () => {
    it("clears all state to defaults", () => {
      configStore.disabled = { "Races::uuid": true };
      configStore.manualEntries = [{ section: "Races", fields: { Name: "test" } }];
      configStore.editOverrides = [{ key: "k", section: "s", entryId: "e", field: "f", value: "v" }];
      configStore.autoEntryOverrides = { "Races::uuid": { Name: "x" } };
      configStore.autoEntryOrder = { Races: ["uuid"] };
      configStore.format = "Json";
      configStore.previewText = "text";
      configStore.previewStale = true;

      configStore.reset();

      expect(configStore.disabled).toEqual({});
      expect(configStore.manualEntries).toEqual([]);
      expect(configStore.editOverrides).toEqual([]);
      expect(configStore.autoEntryOverrides).toEqual({});
      expect(configStore.autoEntryOrder).toEqual({});
      expect(configStore.previewText).toBe("");
      expect(configStore.previewStale).toBe(false);
    });

    it("cancels pending persist timer", () => {
      // Toggle to schedule a persist
      configStore.toggleEntry("Races", "uuid");
      // Reset should cancel the timer
      configStore.reset();
      // Advance timers — should not throw or persist
      vi.advanceTimersByTime(1000);
    });
  });

  // ── initFromScan ──────────────────────────────────────────────────

  describe("initFromScan", () => {
    it("initializes all entries as active by default", () => {
      setupScanResult("Races", [
        { uuid: "aaaa1111-2222-3333-4444-555555555555", display_name: "Elf", changes: [] },
      ]);
      configStore.initFromScan();
      expect(configStore.disabled["Races::aaaa1111-2222-3333-4444-555555555555"]).toBeUndefined();
    });

    it("clears undo history", () => {
      undoStore.push({ label: "test", undo: () => {}, redo: () => {} });
      setupScanResult("Races", []);
      configStore.initFromScan();
      expect(undoStore.canUndo).toBe(false);
    });

    it("no-ops when scanResult is null", () => {
      (modStore as any).scanResult = null;
      configStore.initFromScan();
      expect(configStore.disabled).toEqual({});
    });
  });

  // ── isEnabled / isSectionFullyEnabled ─────────────────────────────

  describe("isEnabled", () => {
    it("returns true for active entries (not in disabled map)", () => {
      expect(configStore.isEnabled("Races", "uuid-1")).toBe(true);
    });

    it("returns false for disabled entries", () => {
      configStore.disabled["Races::uuid-1"] = true;
      expect(configStore.isEnabled("Races", "uuid-1")).toBe(false);
    });

    it("returns true for unknown keys (active by default)", () => {
      expect(configStore.isEnabled("Races", "nonexistent")).toBe(true);
    });
  });

  describe("isSectionFullyEnabled", () => {
    it("returns true when all section entries are enabled (none disabled)", () => {
      setupScanResult("Races", [
        { uuid: "uuid-1", display_name: "A", changes: [] },
        { uuid: "uuid-2", display_name: "B", changes: [] },
      ]);
      // No entries in disabled map = all active
      expect(configStore.isSectionFullyEnabled("Races")).toBe(true);
    });

    it("returns false when some entries are disabled", () => {
      setupScanResult("Races", [
        { uuid: "uuid-1", display_name: "A", changes: [] },
        { uuid: "uuid-2", display_name: "B", changes: [] },
      ]);
      configStore.disabled["Races::uuid-2"] = true;
      expect(configStore.isSectionFullyEnabled("Races")).toBe(false);
    });

    it("returns false when scan result is null", () => {
      (modStore as any).scanResult = null;
      expect(configStore.isSectionFullyEnabled("Races")).toBe(false);
    });

    it("returns true when section has no entries (vacuously true)", () => {
      setupScanResult("Races", []);
      expect(configStore.isSectionFullyEnabled("Races")).toBe(true);
    });
  });

  // ── hasSectionChanges ─────────────────────────────────────────────

  describe("hasSectionChanges", () => {
    it("returns false when no changes exist", () => {
      setupScanResult("Races", [
        { uuid: "uuid-1", display_name: "A", changes: [] },
      ]);
      configStore.initFromScan();
      configStore.snapshotImports();
      expect(configStore.hasSectionChanges("Races")).toBe(false);
    });

    it("returns true when an auto entry is disabled by the user", () => {
      setupScanResult("Races", [
        { uuid: "uuid-1", display_name: "A", changes: [] },
      ]);
      configStore.initFromScan();
      configStore.disabled["Races::uuid-1"] = true;
      expect(configStore.hasSectionChanges("Races")).toBe(true);
    });

    it("returns true when a non-imported manual entry exists", () => {
      setupScanResult("Races", []);
      configStore.initFromScan();
      configStore.snapshotImports();
      configStore.manualEntries = [{ section: "Races", fields: { Name: "User Created" } }];
      expect(configStore.hasSectionChanges("Races")).toBe(true);
    });

    it("returns true when an auto-entry override exists", () => {
      setupScanResult("Races", [
        { uuid: "uuid-1", display_name: "A", changes: [] },
      ]);
      configStore.initFromScan();
      configStore.snapshotImports();
      configStore.autoEntryOverrides["Races::uuid-1"] = { Name: "Override" };
      expect(configStore.hasSectionChanges("Races")).toBe(true);
    });

    it("returns true when an imported entry was removed", () => {
      setupScanResult("Races", []);
      configStore.initFromScan();
      configStore.manualEntries = [{ section: "Races", fields: { Name: "Imported" }, imported: true }];
      configStore.snapshotImports();
      // Now remove the imported entry
      configStore.manualEntries = [];
      expect(configStore.hasSectionChanges("Races")).toBe(true);
    });

    it("returns true when an edit override exists", () => {
      setupScanResult("Races", []);
      configStore.initFromScan();
      configStore.snapshotImports();
      configStore.editOverrides = [{ key: "Races::x::f", section: "Races", entryId: "x", field: "f", value: "v" }];
      expect(configStore.hasSectionChanges("Races")).toBe(true);
    });
  });

  // ── Persistence ───────────────────────────────────────────────────

  describe("persistence", () => {
    it("persistProject serializes state to localStorage", () => {
      configStore.disabled = { "Races::uuid-1": true };
      configStore.format = "Json";
      configStore.persistProject("/test/mod");

      const raw = localStorage.getItem("bg3-cmty-project::/test/mod");
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!);
      expect(parsed.disabled["Races::uuid-1"]).toBe(true);
      expect(parsed.format).toBe("Json");
    });

    it("persistProject no-ops for empty path", () => {
      configStore.persistProject("");
      // Should not throw
    });

    it("restoreProject loads validated state from localStorage", () => {
      const data = {
        disabled: { "Races::aaaa1111-2222-3333-4444-555555555555": true },
        manualEntries: [{ section: "Races", fields: { Name: "Restored" } }],
        format: "Json",
      };
      localStorage.setItem("bg3-cmty-project::/test/mod", JSON.stringify(data));

      configStore.reset();
      const restored = configStore.restoreProject("/test/mod");
      expect(restored).toBe(true);
      expect(configStore.disabled["Races::aaaa1111-2222-3333-4444-555555555555"]).toBe(true);
      expect(configStore.format).toBe("Json");
    });

    it("restoreProject returns false when no saved state exists", () => {
      expect(configStore.restoreProject("/nonexistent/path")).toBe(false);
    });

    it("restoreProject returns false for empty path", () => {
      expect(configStore.restoreProject("")).toBe(false);
    });

    it("restoreProject returns false for corrupted JSON", () => {
      localStorage.setItem("bg3-cmty-project::/test/bad", "not-json{{{");
      expect(configStore.restoreProject("/test/bad")).toBe(false);
    });

    it("restoreProject handles non-object JSON gracefully (array passes typeof check)", () => {
      localStorage.setItem("bg3-cmty-project::/test/array", JSON.stringify([1, 2]));
      // Arrays pass typeof === "object" but yield no valid keys; still returns true
      expect(configStore.restoreProject("/test/array")).toBe(true);
    });

    it("restoreProject strips invalid entries and keeps valid ones", () => {
      const data = {
        disabled: {
          "Races::aaaa1111-2222-3333-4444-555555555555": true,
          "InvalidSection::uuid": true,
        },
        format: "Yaml",
      };
      localStorage.setItem("bg3-cmty-project::/test/mixed", JSON.stringify(data));

      configStore.reset();
      const restored = configStore.restoreProject("/test/mixed");
      expect(restored).toBe(true);
      expect(configStore.disabled["Races::aaaa1111-2222-3333-4444-555555555555"]).toBe(true);
      expect(configStore.disabled["InvalidSection::uuid"]).toBeUndefined();
    });
  });

  // ── moveAutoEntry ─────────────────────────────────────────────────

  describe("moveAutoEntry", () => {
    it("reorders entries within a section", () => {
      setupScanResult("Races", [
        { uuid: "uuid-a", display_name: "A", changes: [] },
        { uuid: "uuid-b", display_name: "B", changes: [] },
        { uuid: "uuid-c", display_name: "C", changes: [] },
      ]);
      configStore.initFromScan();
      undoStore.clear();

      configStore.moveAutoEntry("Races", 0, 2); // move A to end
      expect(configStore.autoEntryOrder["Races"]).toEqual(["uuid-b", "uuid-c", "uuid-a"]);
    });

    it("no-ops for same index", () => {
      setupScanResult("Races", [
        { uuid: "uuid-a", display_name: "A", changes: [] },
      ]);
      configStore.initFromScan();
      undoStore.clear();

      configStore.moveAutoEntry("Races", 0, 0);
      expect(configStore.autoEntryOrder["Races"]).toBeUndefined();
    });

    it("no-ops for out-of-bounds indices", () => {
      setupScanResult("Races", [
        { uuid: "uuid-a", display_name: "A", changes: [] },
      ]);
      configStore.initFromScan();
      configStore.moveAutoEntry("Races", -1, 0);
      configStore.moveAutoEntry("Races", 0, 99);
    });

    it("no-ops when scan result is null", () => {
      (modStore as any).scanResult = null;
      configStore.moveAutoEntry("Races", 0, 1); // should not throw
    });

    it("is undoable", () => {
      setupScanResult("Races", [
        { uuid: "uuid-a", display_name: "A", changes: [] },
        { uuid: "uuid-b", display_name: "B", changes: [] },
      ]);
      configStore.initFromScan();
      undoStore.clear();

      configStore.moveAutoEntry("Races", 0, 1);
      expect(configStore.autoEntryOrder["Races"]).toEqual(["uuid-b", "uuid-a"]);

      undoStore.undo();
      // Should restore to no custom order (was first move)
      expect(configStore.autoEntryOrder["Races"]).toBeUndefined();
    });
  });

  // ── getManualEntriesForSection ────────────────────────────────────

  describe("getManualEntriesForSection", () => {
    it("returns only entries for the requested section with global indices", () => {
      configStore.manualEntries = [
        { section: "Races", fields: { Name: "A" } },
        { section: "Progressions", fields: { Name: "B" } },
        { section: "Races", fields: { Name: "C" } },
      ];
      const result = configStore.getManualEntriesForSection("Races");
      expect(result).toHaveLength(2);
      expect(result[0].globalIndex).toBe(0);
      expect(result[1].globalIndex).toBe(2);
    });

    it("returns empty array for section with no manual entries", () => {
      configStore.manualEntries = [{ section: "Progressions", fields: { Name: "B" } }];
      expect(configStore.getManualEntriesForSection("Races")).toEqual([]);
    });
  });

  // ── selectedBySection / selectedEntries ───────────────────────────

  describe("selectedBySection", () => {
    it("returns empty object when scanResult is null", () => {
      (modStore as any).scanResult = null;
      expect(configStore.selectedBySection).toEqual({});
    });

    it("includes all active entries per section", () => {
      setupScanResult("Races", [
        { uuid: "uuid-1", display_name: "Race A", changes: [] },
        { uuid: "uuid-2", display_name: "Race B", changes: [] },
      ]);
      configStore.initFromScan();
      const result = configStore.selectedBySection;
      expect(result["Races"]).toHaveLength(2);
    });

    it("excludes disabled entries", () => {
      setupScanResult("Races", [
        { uuid: "uuid-1", display_name: "Race A", changes: [] },
        { uuid: "uuid-2", display_name: "Race B", changes: [] },
      ]);
      configStore.initFromScan();
      configStore.disabled["Races::uuid-1"] = true;
      const result = configStore.selectedBySection;
      expect(result["Races"]).toHaveLength(1);
      expect(result["Races"][0].uuid).toBe("uuid-2");
    });

    it("omits sections where all entries are disabled", () => {
      setupScanResult("Races", [
        { uuid: "uuid-1", display_name: "Race A", changes: [] },
      ]);
      configStore.initFromScan();
      configStore.disabled["Races::uuid-1"] = true;
      expect(configStore.selectedBySection["Races"]).toBeUndefined();
    });

    it("applies autoEntryOrder reordering", () => {
      setupScanResult("Races", [
        { uuid: "uuid-a", display_name: "A", changes: [] },
        { uuid: "uuid-b", display_name: "B", changes: [] },
        { uuid: "uuid-c", display_name: "C", changes: [] },
      ]);
      configStore.initFromScan();
      configStore.autoEntryOrder["Races"] = ["uuid-c", "uuid-a", "uuid-b"];
      const result = configStore.selectedBySection;
      expect(result["Races"].map(e => e.uuid)).toEqual(["uuid-c", "uuid-a", "uuid-b"]);
    });

    it("handles multiple sections independently", () => {
      (modStore as any).scanResult = {
        mod_meta: { folder: "TestMod", name: "Test", author: "", description: "", version: "" },
        sections: [
          { section: "Races", entries: [{ uuid: "r1", display_name: "Race1", changes: [], node_id: null, raw_attributes: [], raw_children: [] }] },
          { section: "Progressions", entries: [{ uuid: "p1", display_name: "Prog1", changes: [], node_id: null, raw_attributes: [], raw_children: [] }] },
        ],
        config_files: [],
      };
      configStore.initFromScan();
      const result = configStore.selectedBySection;
      expect(Object.keys(result)).toContain("Races");
      expect(Object.keys(result)).toContain("Progressions");
    });
  });

  describe("selectedEntries", () => {
    it("returns flat array from all sections", () => {
      (modStore as any).scanResult = {
        mod_meta: { folder: "TestMod", name: "Test", author: "", description: "", version: "" },
        sections: [
          { section: "Races", entries: [{ uuid: "r1", display_name: "Race1", changes: [], node_id: null, raw_attributes: [], raw_children: [] }] },
          { section: "Progressions", entries: [{ uuid: "p1", display_name: "Prog1", changes: [], node_id: null, raw_attributes: [], raw_children: [] }] },
        ],
        config_files: [],
      };
      configStore.initFromScan();
      expect(configStore.selectedEntries.length).toBe(2);
    });

    it("returns empty array when no scan result", () => {
      (modStore as any).scanResult = null;
      expect(configStore.selectedEntries).toEqual([]);
    });

    it("reflects disabled state changes", () => {
      setupScanResult("Races", [
        { uuid: "uuid-1", display_name: "A", changes: [] },
        { uuid: "uuid-2", display_name: "B", changes: [] },
      ]);
      configStore.initFromScan();
      expect(configStore.selectedEntries.length).toBe(2);
      configStore.disabled["Races::uuid-1"] = true;
      expect(configStore.selectedEntries.length).toBe(1);
    });
  });

  // ── locaEntries migration ─────────────────────────────────────────

  describe("locaEntries migration", () => {
    it("assigns IDs to restored entries without them", () => {
      const data = {
        locaEntries: [{
          label: "TestMod_English",
          values: [{ contentuid: "h123", version: 1, text: "Hello" }],
        }],
      };
      localStorage.setItem("bg3-cmty-project::/test/loca", JSON.stringify(data));
      configStore.reset();
      configStore.restoreProject("/test/loca");
      expect(configStore.locaEntries[0].id).toBeDefined();
      expect(typeof configStore.locaEntries[0].id).toBe("string");
      expect(configStore.locaEntries[0].values[0].id).toBeDefined();
    });

    it("preserves existing IDs on restore", () => {
      const data = {
        locaEntries: [{
          id: "existing-id",
          label: "TestMod_English",
          values: [{ id: "val-id", contentuid: "h123", version: 1, text: "Hello" }],
        }],
      };
      localStorage.setItem("bg3-cmty-project::/test/loca2", JSON.stringify(data));
      configStore.reset();
      configStore.restoreProject("/test/loca2");
      expect(configStore.locaEntries[0].id).toBe("existing-id");
      expect(configStore.locaEntries[0].values[0].id).toBe("val-id");
    });
  });
});
