/**
 * TC-005: scanService / modImportService tests
 *
 * Tests the IPC-dependent service layer with mocked Tauri commands.
 * Covers: generation counter guarding, entry deduplication,
 * disableCommentedEntries two-pass logic, error paths, and concurrent scan ordering.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// â”€â”€ Mock tauri utilities â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// We mock the entire tauri module so scanService doesn't try real IPC calls.

const mockScanMod = vi.fn();
const mockGetStatEntries = vi.fn().mockResolvedValue([]);
const mockGetStatFieldNames = vi.fn().mockResolvedValue([]);
const mockGetValueLists = vi.fn().mockResolvedValue([]);
const mockGetLocalizationMap = vi.fn().mockResolvedValue({ entries: [], warnings: [] });
const mockGetModLocalization = vi.fn().mockResolvedValue({ entries: [], warnings: [] });
const mockGetModStatEntries = vi.fn().mockResolvedValue([]);
const mockReadExistingConfig = vi.fn().mockResolvedValue("");
const mockGetEquipmentNames = vi.fn().mockResolvedValue([]);
const mockListModFiles = vi.fn().mockResolvedValue([]);
const mockListAvailableSections = vi.fn().mockResolvedValue([]);
const mockQuerySectionEntries = vi.fn().mockResolvedValue([]);

// Build a default mock that returns empty/null for every exported function
const noopAsync = () => vi.fn().mockResolvedValue(null);
const noopAsyncArr = () => vi.fn().mockResolvedValue([]);

vi.mock("../lib/utils/tauri.js", () => ({
  // Functions under test â€” controlled per-test
  scanMod: (...args: any[]) => mockScanMod(...args),
  getStatEntries: (...args: any[]) => mockGetStatEntries(...args),
  getStatFieldNames: (...args: any[]) => mockGetStatFieldNames(...args),
  getValueLists: (...args: any[]) => mockGetValueLists(...args),
  getLocalizationMap: (...args: any[]) => mockGetLocalizationMap(...args),
  getModLocalization: (...args: any[]) => mockGetModLocalization(...args),
  getModStatEntries: (...args: any[]) => mockGetModStatEntries(...args),
  readExistingConfig: (...args: any[]) => mockReadExistingConfig(...args),
  getEquipmentNames: (...args: any[]) => mockGetEquipmentNames(...args),
  listModFiles: (...args: any[]) => mockListModFiles(...args),
  listAvailableSections: (...args: any[]) => mockListAvailableSections(...args),
  querySectionEntries: (...args: any[]) => mockQuerySectionEntries(...args),
  // Passthrough stubs for functions used by vanillaRegistry and others
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
  recreateStaging: vi.fn().mockResolvedValue("/mock/staging.sqlite"),
  populateStagingFromMod: vi.fn().mockResolvedValue({ db_path: "", total_files: 0, total_rows: 0, total_tables: 0, fk_constraints: 0, file_errors: 0, row_errors: 0, elapsed_secs: 0, db_size_mb: 0, phase_times: {} }),
  checkStagingIntegrity: vi.fn().mockResolvedValue(null),
}));

// Import stores and service after mocks
const { configStore } = await import("../lib/stores/configStore.svelte.js");
const { modStore } = await import("../lib/stores/modStore.svelte.js");
const { scanAndImport, loadVanillaData, loadCategory, isLazyCategory, rehydrateStaging } = await import("../lib/services/scanService.js");
const { toastStore } = await import("../lib/stores/toastStore.svelte.js");

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Build a minimal ScanResult fixture. */
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

// â”€â”€ Tests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("TC-005: scanAndImport", () => {
  beforeEach(() => {
    configStore.reset();
    (modStore as any).scanResult = null;
    (modStore as any).selectedModPath = "";
    (modStore as any).isScanning = false;
    (modStore as any).error = "";
    vi.clearAllMocks();
  });

  it("sets isScanning true during scan and false after", async () => {
    const result = makeScanResult();
    mockScanMod.mockResolvedValue(result);
    expect(modStore.isScanning).toBe(false);
    const p = scanAndImport("/test/mod");
    // isScanning is set synchronously before the await
    expect(modStore.isScanning).toBe(true);
    await p;
    expect(modStore.isScanning).toBe(false);
  });

  it("stores scanResult and selectedModPath on success", async () => {
    const result = makeScanResult({
      sections: [{ section: "Races", entries: [{ uuid: "aaaa1111-2222-3333-4444-555555555555", display_name: "Elf", changes: [] }] }],
    });
    mockScanMod.mockResolvedValue(result);
    await scanAndImport("/test/mod");
    expect(modStore.scanResult).toBeTruthy();
    expect(modStore.selectedModPath).toBe("/test/mod");
    expect(modStore.scanResult!.sections).toHaveLength(1);
  });

  it("sets error and clears scanResult on IPC failure", async () => {
    mockScanMod.mockRejectedValue(new Error("IPC timeout"));
    await scanAndImport("/bad/path");
    expect(modStore.error).toContain("IPC timeout");
    expect(modStore.scanResult).toBeNull();
    expect(modStore.isScanning).toBe(false);
  });

  it("handles string error from IPC", async () => {
    mockScanMod.mockRejectedValue("Folder not found");
    await scanAndImport("/missing");
    expect(modStore.error).toBe("Folder not found");
  });

  // â”€â”€ disableCommentedEntries two-pass logic â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("disables commented entries that have no active counterpart", async () => {
    const result = makeScanResult({
      sections: [{
        section: "Races",
        entries: [
          { uuid: "commented-only-uuid", display_name: "OldRace", changes: [], commented: true },
        ],
      }],
    });
    mockScanMod.mockResolvedValue(result);
    await scanAndImport("/test/mod");
    expect(configStore.disabled["Races::commented-only-uuid"]).toBe(true);
  });

  it("does NOT disable commented entries that also have an active version", async () => {
    const result = makeScanResult({
      sections: [{
        section: "Races",
        entries: [
          { uuid: "dual-uuid", display_name: "ActiveElf", changes: [], commented: false },
          { uuid: "dual-uuid", display_name: "CommentedElf", changes: [], commented: true },
        ],
      }],
    });
    mockScanMod.mockResolvedValue(result);
    await scanAndImport("/test/mod");
    // The commented entry should NOT be disabled because the active version exists
    expect(configStore.disabled["Races::dual-uuid"]).toBeUndefined();
  });

  it("two-pass logic works across multiple sections", async () => {
    const result = makeScanResult({
      sections: [
        {
          section: "Races",
          entries: [
            { uuid: "race-active", display_name: "R1", changes: [], commented: false },
            { uuid: "race-commented", display_name: "R2", changes: [], commented: true },
          ],
        },
        {
          section: "Progressions",
          entries: [
            { uuid: "prog-only-commented", display_name: "P1", changes: [], commented: true },
          ],
        },
      ],
    });
    mockScanMod.mockResolvedValue(result);
    await scanAndImport("/test/mod");
    // race-commented has no active counterpart with same key
    expect(configStore.disabled["Races::race-commented"]).toBe(true);
    expect(configStore.disabled["Progressions::prog-only-commented"]).toBe(true);
    // race-active is NOT commented, so it shouldn't be disabled
    expect(configStore.disabled["Races::race-active"]).toBeUndefined();
  });

  // â”€â”€ Config import â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("imports existing config when path is present in scan result", async () => {
    const result = makeScanResult({
      sections: [],
      existing_config_path: "/test/mod/config.yaml",
    });
    mockScanMod.mockResolvedValue(result);
    mockReadExistingConfig.mockResolvedValue(
      JSON.stringify({
        Progressions: [{
          UUID: "aabbccdd-1122-3344-5566-778899001122",
          Booleans: [{ Key: "AllowImprovement", Value: "true" }],
        }],
      })
    );
    await scanAndImport("/test/mod");
    expect(mockReadExistingConfig).toHaveBeenCalledWith("/test/mod/config.yaml");
    // Manual entries should have been added
    expect(configStore.manualEntries.length).toBeGreaterThanOrEqual(1);
  });

  it("handles config import failure gracefully", async () => {
    const result = makeScanResult({
      sections: [],
      existing_config_path: "/test/mod/config.yaml",
    });
    mockScanMod.mockResolvedValue(result);
    mockReadExistingConfig.mockRejectedValue(new Error("File not readable"));
    // Should not throw â€” error is caught internally
    await expect(scanAndImport("/test/mod")).resolves.toBeUndefined();
    expect(modStore.isScanning).toBe(false);
  });

  it("skips config import when no existing_config_path", async () => {
    const result = makeScanResult({ sections: [], existing_config_path: null });
    mockScanMod.mockResolvedValue(result);
    await scanAndImport("/test/mod");
    expect(mockReadExistingConfig).not.toHaveBeenCalled();
  });

  // â”€â”€ Entry deduplication (disabled map uses Section::UUID key) â”€â”€

  it("uses Section::UUID composite key for disabled tracking", async () => {
    const result = makeScanResult({
      sections: [
        {
          section: "Races",
          entries: [
            { uuid: "same-uuid", display_name: "RaceEntry", changes: [], commented: true },
          ],
        },
        {
          section: "Progressions",
          entries: [
            { uuid: "same-uuid", display_name: "ProgEntry", changes: [], commented: true },
          ],
        },
      ],
    });
    mockScanMod.mockResolvedValue(result);
    await scanAndImport("/test/mod");
    // Same UUID in different sections should produce separate disabled keys
    expect(configStore.disabled["Races::same-uuid"]).toBe(true);
    expect(configStore.disabled["Progressions::same-uuid"]).toBe(true);
  });

  // â”€â”€ Extra scan paths â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("passes extraScanPaths to scanMod IPC call", async () => {
    const result = makeScanResult();
    mockScanMod.mockResolvedValue(result);
    await scanAndImport("/test/mod", ["/extra/path1", "/extra/path2"]);
    expect(mockScanMod).toHaveBeenCalledWith("/test/mod", ["/extra/path1", "/extra/path2"], true);
  });
});

// â”€â”€ loadVanillaData â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("TC-005: loadVanillaData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads stat entries, field names, value lists, and equipment", async () => {
    mockGetStatEntries.mockResolvedValue([{ name: "Stat1" }]);
    mockGetStatFieldNames.mockResolvedValue(["Field1"]);
    mockGetValueLists.mockResolvedValue([{ list: "VL1" }]);
    mockGetEquipmentNames.mockResolvedValue(["Armor1"]);
    mockGetLocalizationMap.mockResolvedValue({ entries: [], warnings: [] });

    await loadVanillaData();

    expect(mockGetStatEntries).toHaveBeenCalledWith("");
    expect(mockGetStatFieldNames).toHaveBeenCalledWith("");
    expect(mockGetValueLists).toHaveBeenCalledWith("");
    expect(mockGetEquipmentNames).toHaveBeenCalled();
  });

  it("records failed loaders in vanillaLoadFailures", async () => {
    mockGetStatEntries.mockRejectedValue(new Error("stat error"));
    mockGetStatFieldNames.mockResolvedValue([]);
    mockGetValueLists.mockResolvedValue([]);
    mockGetEquipmentNames.mockResolvedValue([]);
    mockGetLocalizationMap.mockResolvedValue({ entries: [], warnings: [] });

    await loadVanillaData();

    expect(modStore.vanillaLoadFailures).toContain("StatEntries");
  });

  it("merges localization entries into modStore.localizationMap", async () => {
    mockGetStatEntries.mockResolvedValue([]);
    mockGetStatFieldNames.mockResolvedValue([]);
    mockGetValueLists.mockResolvedValue([]);
    mockGetEquipmentNames.mockResolvedValue([]);
    mockGetLocalizationMap.mockResolvedValue({
      entries: [{ handle: "h12345g6789", text: "Hello World" }],
      warnings: [],
    });

    await loadVanillaData();

    expect(modStore.localizationMap.get("h12345g6789")).toBe("Hello World");
  });
});

// â”€â”€ guardedWrite / generation counter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("TC-005: Generation counter (concurrent scan safety)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("two sequential loadVanillaData calls: second overwrites first", async () => {
    // First call returns ["old"]
    mockGetStatEntries.mockResolvedValueOnce([{ name: "Old" }]).mockResolvedValueOnce([{ name: "New" }]);
    mockGetStatFieldNames.mockResolvedValue([]);
    mockGetValueLists.mockResolvedValue([]);
    mockGetEquipmentNames.mockResolvedValue([]);
    mockGetLocalizationMap.mockResolvedValue({ entries: [], warnings: [] });

    await loadVanillaData();
    await loadVanillaData();

    // Second call's data should be present
    expect(modStore.vanillaStatEntries).toEqual([{ name: "New" }]);
  });

  it("interleaved loadVanillaData: stale results do not overwrite fresh ones", async () => {
    // Simulate: call 1 starts (slow), call 2 starts+finishes (fast), then call 1 finishes
    let resolveCall1!: (v: any) => void;
    const call1Promise = new Promise(r => { resolveCall1 = r; });

    mockGetStatEntries
      .mockReturnValueOnce(call1Promise) // Call 1 - slow
      .mockResolvedValueOnce([{ name: "Fresh" }]); // Call 2 - fast
    mockGetStatFieldNames.mockResolvedValue([]);
    mockGetValueLists.mockResolvedValue([]);
    mockGetEquipmentNames.mockResolvedValue([]);
    mockGetLocalizationMap.mockResolvedValue({ entries: [], warnings: [] });

    const p1 = loadVanillaData();
    const p2 = loadVanillaData();
    await p2; // Fast call finishes first

    // Now resolve the slow call with stale data
    resolveCall1([{ name: "Stale" }]);
    await p1;

    // Fresh data from call 2 should still be in place
    // (guardedWrite prevents stale gen from overwriting newer gen)
    expect(modStore.vanillaStatEntries).toEqual([{ name: "Fresh" }]);
  });
});

// â”€â”€ isLazyCategory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("TC-005: isLazyCategory", () => {
  it("returns boolean for any string input", () => {
    // isLazyCategory should return true/false, never throw
    const result = isLazyCategory("NonExistentCategory" as any);
    expect(typeof result).toBe("boolean");
  });
});

// ── rehydrateStaging ─────────────────────────────────────────────────────────

const mockRecreateStaging = vi.mocked((await import("../lib/utils/tauri.js")).recreateStaging);
const mockPopulateStagingFromMod = vi.mocked((await import("../lib/utils/tauri.js")).populateStagingFromMod);
const mockCheckStagingIntegrity = vi.mocked((await import("../lib/utils/tauri.js")).checkStagingIntegrity);

describe("TC-005: rehydrateStaging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecreateStaging.mockResolvedValue("/mock/staging.sqlite");
    mockPopulateStagingFromMod.mockResolvedValue({
      db_path: "/mock/staging.sqlite",
      total_files: 10,
      total_rows: 100,
      total_tables: 5,
      fk_constraints: 0,
      file_errors: 0,
      row_errors: 0,
      elapsed_secs: 1.5,
      db_size_mb: 2.0,
      phase_times: {} as any,
    });
    mockCheckStagingIntegrity.mockResolvedValue(null);
  });

  it("calls recreateStaging, populateStagingFromMod, and checkStagingIntegrity in order", async () => {
    await rehydrateStaging("/test/mod", "TestMod");

    expect(mockRecreateStaging).toHaveBeenCalledOnce();
    expect(mockPopulateStagingFromMod).toHaveBeenCalledWith("/test/mod", "TestMod", "/mock/staging.sqlite");
    expect(mockCheckStagingIntegrity).toHaveBeenCalledOnce();
  });

  it("does not throw when recreateStaging fails", async () => {
    mockRecreateStaging.mockRejectedValue(new Error("DB creation failed"));

    await expect(rehydrateStaging("/test/mod", "TestMod")).resolves.toBeUndefined();
    expect(mockPopulateStagingFromMod).not.toHaveBeenCalled();
  });

  it("does not throw when populateStagingFromMod fails", async () => {
    mockPopulateStagingFromMod.mockRejectedValue(new Error("Populate failed"));

    await expect(rehydrateStaging("/test/mod", "TestMod")).resolves.toBeUndefined();
    // Integrity check should be skipped since populate failed
    expect(mockCheckStagingIntegrity).not.toHaveBeenCalled();
  });

  it("surfaces toast warning when populate reports errors", async () => {
    const warningSpy = vi.spyOn(toastStore, "warning");
    mockPopulateStagingFromMod.mockResolvedValue({
      db_path: "/mock/staging.sqlite",
      total_files: 10,
      total_rows: 100,
      total_tables: 5,
      fk_constraints: 0,
      file_errors: 3,
      row_errors: 1,
      elapsed_secs: 1.5,
      db_size_mb: 2.0,
      phase_times: {} as any,
    });

    await rehydrateStaging("/test/mod", "TestMod");

    expect(warningSpy).toHaveBeenCalledWith(
      "Staging rehydration warnings",
      expect.stringContaining("3 file error(s)"),
    );
    warningSpy.mockRestore();
  });

  it("does not throw when integrity check fails", async () => {
    mockCheckStagingIntegrity.mockRejectedValue(new Error("Integrity check error"));

    await expect(rehydrateStaging("/test/mod", "TestMod")).resolves.toBeUndefined();
  });

  it("surfaces toast when integrity check returns issues", async () => {
    const warningSpy = vi.spyOn(toastStore, "warning");
    mockCheckStagingIntegrity.mockResolvedValue("Foreign key mismatch on table X");

    await rehydrateStaging("/test/mod", "TestMod");

    expect(warningSpy).toHaveBeenCalledWith(
      "Staging integrity issue",
      "Foreign key mismatch on table X",
    );
    warningSpy.mockRestore();
  });
});
