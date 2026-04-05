/**
 * TC-010: Concurrent Operation Safety Tests
 *
 * Verifies that store mutations during async operations don't corrupt state.
 * Tests: interleaved scans, toggle during scan, entry mutation during async,
 * and format changes during preview generation.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// ── Mock tauri ───────────────────────────────────────────────────────

const mockScanMod = vi.fn();

const noopAsync = () => vi.fn().mockResolvedValue(null);
const noopAsyncArr = () => vi.fn().mockResolvedValue([]);

vi.mock("../lib/stores/projectStore.svelte.js", () => ({
  projectStore: {
    hydrate: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn(),
    sections: [],
  },
}));

vi.mock("../lib/utils/tauri.js", () => ({
  scanMod: (...args: any[]) => mockScanMod(...args),
  getStatEntries: noopAsyncArr(),
  getStatFieldNames: noopAsyncArr(),
  getValueLists: noopAsyncArr(),
  getLocalizationMap: vi.fn().mockResolvedValue({ entries: [], warnings: [] }),
  getModLocalization: vi.fn().mockResolvedValue({ entries: [], warnings: [] }),
  getModStatEntries: noopAsyncArr(),
  readExistingConfig: noopAsync(),
  getEquipmentNames: noopAsyncArr(),
  listModFiles: noopAsyncArr(),
  getVanillaEntries: noopAsyncArr(),
  getEntriesByFolder: noopAsyncArr(),
  getProgressionTableUuids: noopAsyncArr(),
  getVoiceTableUuids: noopAsyncArr(),
  generateConfig: noopAsync(),
  saveConfig: noopAsync(),
  renameDir: noopAsync(),
  detectAnchors: noopAsync(),
  getListItems: noopAsync(),
  writeStats: noopAsync(),
  populateVanillaDbs: noopAsync(),
  processModFolder: noopAsync(),
  dirSize: noopAsync(),
  readModMeta: noopAsync(),
  rediffMod: noopAsync(),
  getSelectorIds: noopAsyncArr(),
  listLoadOrderPaks: noopAsyncArr(),
  getActiveModFolders: noopAsyncArr(),
  inferSchemas: noopAsyncArr(),
  listAvailableSections: noopAsyncArr(),
  querySectionEntries: noopAsyncArr(),
  recreateStaging: vi.fn().mockResolvedValue("/mock/staging.sqlite"),
  populateStagingFromMod: vi.fn().mockResolvedValue({ db_path: "", total_files: 0, total_rows: 0, total_tables: 0, fk_constraints: 0, file_errors: 0, row_errors: 0, elapsed_secs: 0, db_size_mb: 0, phase_times: {} }),
  checkStagingIntegrity: vi.fn().mockResolvedValue(null),
}));

// Import stores and service after mocks
const { configStore } = await import("../lib/stores/configStore.svelte.js");
const { undoStore } = await import("../lib/stores/undoStore.svelte.js");
const { modStore } = await import("../lib/stores/modStore.svelte.js");
const { scanAndImport } = await import("../lib/services/scanService.js");

// ── Helpers ──────────────────────────────────────────────────────────

function makeScanResult(opts: {
  sections?: Array<{
    section: string;
    entries: Array<{
      uuid: string;
      display_name: string;
      changes: any[];
      commented?: boolean;
    }>;
  }>;
  existing_config_path?: string | null;
} = {}) {
  return {
    mod_meta: { folder: "TestMod", name: "Test", author: "", description: "", version: "" },
    sections: (opts.sections ?? []).map(s => ({
      section: s.section,
      entries: s.entries.map(e => ({
        uuid: e.uuid,
        display_name: e.display_name,
        changes: e.changes,
        commented: e.commented ?? false,
        node_id: null,
        raw_attributes: {},
        raw_attribute_types: {},
        raw_children: {},
        source_file: "test.lsx",
        entry_kind: "Modified",
      })),
    })),
    existing_config_path: opts.existing_config_path ?? null,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("TC-010: Concurrent operation safety", () => {
  beforeEach(() => {
    configStore.reset();
    undoStore.clear();
    (modStore as any).scanResult = null;
    (modStore as any).selectedModPath = "";
    (modStore as any).isScanning = false;
    (modStore as any).error = "";
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Interleaved scan operations ─────────────────────────────────

  describe("interleaved scans", () => {
    it("two sequential scans: second scan result replaces first", async () => {
      vi.useRealTimers();
      const result1 = makeScanResult({
        sections: [{ section: "Races", entries: [{ uuid: "uuid-1", display_name: "Elf", changes: [] }] }],
      });
      const result2 = makeScanResult({
        sections: [{ section: "Progressions", entries: [{ uuid: "uuid-2", display_name: "Prog1", changes: [] }] }],
      });

      mockScanMod.mockResolvedValueOnce(result1);
      await scanAndImport("/mod1");
      expect(modStore.scanResult?.sections[0].section).toBe("Races");

      mockScanMod.mockResolvedValueOnce(result2);
      await scanAndImport("/mod2");
      expect(modStore.scanResult?.sections[0].section).toBe("Progressions");
      expect(modStore.selectedModPath).toBe("/mod2");
    });

    it("scan A started, scan B started + finished before A: B's results are in store", async () => {
      vi.useRealTimers();
      let resolveA!: (v: any) => void;
      const scanAPromise = new Promise(r => { resolveA = r; });

      const resultA = makeScanResult({
        sections: [{ section: "Races", entries: [{ uuid: "old-uuid", display_name: "Old", changes: [] }] }],
      });
      const resultB = makeScanResult({
        sections: [{ section: "Progressions", entries: [{ uuid: "new-uuid", display_name: "Fresh", changes: [] }] }],
      });

      mockScanMod
        .mockReturnValueOnce(scanAPromise)
        .mockResolvedValueOnce(resultB);

      const pA = scanAndImport("/slow-mod");
      const pB = scanAndImport("/fast-mod");
      await pB;

      // B finished first — store should have B's result
      expect(modStore.selectedModPath).toBe("/fast-mod");
      expect(modStore.scanResult?.sections[0].section).toBe("Progressions");

      // Now resolve A
      resolveA(resultA);
      await pA;

      // A's stale result is discarded by the generation guard (DSM-011 / C6)
      // B's result remains because it was the most recent scan
      expect(modStore.scanResult?.sections[0].section).toBe("Progressions");
    });
  });

  // ── Toggle entries during active scan ─────────────────────────

  describe("entry mutations during scan lifecycle", () => {
    it("toggling entries between scan start and resolution doesn't corrupt disabled map", async () => {
      vi.useRealTimers();
      let resolveScn!: (v: any) => void;
      const scanPromise = new Promise(r => { resolveScn = r; });
      mockScanMod.mockReturnValueOnce(scanPromise);

      const scanP = scanAndImport("/test-mod");

      // While scan is in flight, toggle an entry (from previous scan state)
      configStore.disabled["Races::pre-existing-uuid"] = true;
      configStore.toggleEntry("Races", "pre-existing-uuid");
      expect(configStore.disabled["Races::pre-existing-uuid"]).toBeUndefined();

      // Now resolve the scan (which calls initFromScan → reset)
      resolveScn(makeScanResult({
        sections: [{ section: "Races", entries: [{ uuid: "new-uuid", display_name: "New", changes: [] }] }],
      }));
      await scanP;

      // After scan, disabled map was reset — pre-existing toggles are gone
      expect(configStore.disabled["Races::pre-existing-uuid"]).toBeUndefined();
    });

    it("adding manual entries before scan resolution: entries cleared by scan reset", async () => {
      vi.useRealTimers();
      let resolveScn!: (v: any) => void;
      const scanPromise = new Promise(r => { resolveScn = r; });
      mockScanMod.mockReturnValueOnce(scanPromise);

      const scanP = scanAndImport("/test-mod");

      // Add a manual entry while scan is in flight
      configStore.addManualEntry("Races", { UUID: "manual-uuid", Name: "InFlight" });
      expect(configStore.manualEntries).toHaveLength(1);

      // Scan resolves → reset clears manual entries
      resolveScn(makeScanResult({ sections: [] }));
      await scanP;

      expect(configStore.manualEntries).toHaveLength(0);
    });
  });

  // ── Format change during preview state ────────────────────────

  describe("format changes during preview lifecycle", () => {
    it("changing format marks preview stale", () => {
      configStore.setPreview("old preview");
      expect(configStore.previewStale).toBe(false);

      configStore.toggleFormat();
      expect(configStore.previewStale).toBe(true);
    });

    it("rapid format toggles don't corrupt format state", () => {
      configStore.format = "Yaml";
      for (let i = 0; i < 100; i++) {
        configStore.toggleFormat();
      }
      // 100 toggles from Yaml → should be back to Yaml (even count)
      expect(configStore.format).toBe("Yaml");
    });
  });

  // ── Undo/redo during concurrent mutations ─────────────────────

  describe("undo/redo during rapid mutations", () => {
    it("rapid toggle+undo cycle maintains consistent state", () => {
      configStore.toggleEntry("Races", "uuid-1");
      expect(configStore.disabled["Races::uuid-1"]).toBe(true);

      configStore.toggleEntry("Races", "uuid-2");
      expect(configStore.disabled["Races::uuid-2"]).toBe(true);

      undoStore.undo(); // undo uuid-2 toggle
      expect(configStore.disabled["Races::uuid-2"]).toBeUndefined();
      expect(configStore.disabled["Races::uuid-1"]).toBe(true);

      undoStore.undo(); // undo uuid-1 toggle
      expect(configStore.disabled["Races::uuid-1"]).toBeUndefined();

      undoStore.redo(); // redo uuid-1 toggle
      expect(configStore.disabled["Races::uuid-1"]).toBe(true);
      expect(configStore.disabled["Races::uuid-2"]).toBeUndefined();
    });

    it("undo/redo stack stays bounded at MAX_UNDO (50)", () => {
      // Push 60 commands
      for (let i = 0; i < 60; i++) {
        configStore.toggleEntry("Races", `uuid-${i}`);
      }
      // Undo all — should only be able to undo 50
      let undoCount = 0;
      while (undoStore.canUndo) {
        undoStore.undo();
        undoCount++;
      }
      expect(undoCount).toBe(50);
    });

    it("interleaved add/remove manual entries with undo", () => {
      configStore.addManualEntry("Races", { UUID: "a", Name: "A" });
      configStore.addManualEntry("Races", { UUID: "b", Name: "B" });
      configStore.removeManualEntry(0); // remove A
      expect(configStore.manualEntries).toHaveLength(1);
      expect(configStore.manualEntries[0].fields.Name).toBe("B");

      undoStore.undo(); // undo remove → re-insert A at index 0
      expect(configStore.manualEntries).toHaveLength(2);
      expect(configStore.manualEntries[0].fields.Name).toBe("A");

      undoStore.undo(); // undo add B
      expect(configStore.manualEntries).toHaveLength(1);
      expect(configStore.manualEntries[0].fields.Name).toBe("A");

      undoStore.redo(); // redo add B
      expect(configStore.manualEntries).toHaveLength(2);
    });
  });

  // ── Auto-persist debounce under rapid mutations ─────────────────

  describe("debounced auto-persist", () => {
    it("multiple rapid toggles coalesce into a single persist", () => {
      (modStore as any).selectedModPath = "/test-mod";
      const setItemSpy = vi.spyOn(globalThis.localStorage, "setItem");

      // Multiple rapid mutations
      configStore.toggleEntry("Races", "uuid-1");
      configStore.toggleEntry("Races", "uuid-2");
      configStore.toggleEntry("Races", "uuid-3");

      // No persist yet (debounce hasn't fired)
      expect(setItemSpy).not.toHaveBeenCalled();

      // Advance past debounce interval (500ms)
      vi.advanceTimersByTime(600);

      // Should have persisted exactly once
      expect(setItemSpy).toHaveBeenCalledTimes(1);

      setItemSpy.mockRestore();
    });

    it("persist timer is cancelled by reset", () => {
      (modStore as any).selectedModPath = "/test-mod";
      const setItemSpy = vi.spyOn(globalThis.localStorage, "setItem");

      configStore.toggleEntry("Races", "uuid-1"); // schedules persist
      configStore.reset(); // should cancel timer

      vi.advanceTimersByTime(600);
      expect(setItemSpy).not.toHaveBeenCalled();

      setItemSpy.mockRestore();
    });
  });

  // ── Store state consistency under concurrent access patterns ───

  describe("store state consistency", () => {
    it("disabled map handles mixed section operations atomically", () => {
      // Set up scan with multiple sections
      (modStore as any).scanResult = makeScanResult({
        sections: [
          {
            section: "Races",
            entries: [
              { uuid: "race-1", display_name: "Elf", changes: [] },
              { uuid: "race-2", display_name: "Dwarf", changes: [] },
            ],
          },
          {
            section: "Progressions",
            entries: [
              { uuid: "prog-1", display_name: "Prog1", changes: [] },
            ],
          },
        ],
      });

      // Disable some entries across sections
      configStore.toggleEntry("Races", "race-1"); // disable
      configStore.toggleEntry("Progressions", "prog-1"); // disable

      // Clear only Races section
      configStore.clearSection("Races");

      // Races entries should be disabled (clearSection disables all)
      expect(configStore.disabled["Races::race-1"]).toBe(true);
      expect(configStore.disabled["Races::race-2"]).toBe(true);

      // Progressions should be unaffected
      expect(configStore.disabled["Progressions::prog-1"]).toBe(true);
    });

    it("manual entries survive format toggle", () => {
      configStore.addManualEntry("Races", { UUID: "manual-1", Name: "Keep" });
      configStore.toggleFormat();
      expect(configStore.manualEntries).toHaveLength(1);
      expect(configStore.manualEntries[0].fields.Name).toBe("Keep");
    });

    it("auto entry overrides survive entry toggles", () => {
      configStore.setAutoEntryOverride("Races", "uuid-1", { Name: "Override" });
      configStore.toggleEntry("Races", "uuid-1"); // disable
      configStore.toggleEntry("Races", "uuid-1"); // re-enable

      // Override should still be present
      expect(configStore.getAutoEntryOverride("Races", "uuid-1")).toEqual({ Name: "Override" });
    });

    it("disabled map uses Section::UUID composite — no cross-section leaks", () => {
      (modStore as any).scanResult = makeScanResult({
        sections: [
          { section: "Races", entries: [{ uuid: "shared-uuid", display_name: "Race", changes: [] }] },
          { section: "Progressions", entries: [{ uuid: "shared-uuid", display_name: "Prog", changes: [] }] },
        ],
      });

      configStore.toggleEntry("Races", "shared-uuid"); // disable in Races
      expect(configStore.disabled["Races::shared-uuid"]).toBe(true);
      expect(configStore.disabled["Progressions::shared-uuid"]).toBeUndefined();

      // Enable in Races (toggle back)
      configStore.toggleEntry("Races", "shared-uuid");
      expect(configStore.disabled["Races::shared-uuid"]).toBeUndefined();
    });
  });
});
