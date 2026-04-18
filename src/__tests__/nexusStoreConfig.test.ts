/**
 * Tests for nexusStore config persistence — loadProjectConfig, saveProjectConfig,
 * resetProject, missing config, corrupted JSON.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  suppressConsoleWarn,
  expectConsoleCalled,
} from "./helpers/suppressConsole.js";

// ── Mocks ────────────────────────────────────────────────────────

const mockReadProjectFile = vi.fn().mockResolvedValue("{}");
const mockWriteProjectFile = vi.fn().mockResolvedValue(undefined);

vi.mock("../lib/tauri/project-settings.js", () => ({
  readProjectFile: (...args: unknown[]) => mockReadProjectFile(...args),
  writeProjectFile: (...args: unknown[]) => mockWriteProjectFile(...args),
}));

vi.mock("../lib/tauri/nexus.js", () => ({
  nexusHasApiKey: vi.fn().mockResolvedValue(false),
  nexusSetApiKey: vi.fn().mockResolvedValue(undefined),
  nexusValidateApiKey: vi.fn().mockResolvedValue(true),
  nexusClearApiKey: vi.fn().mockResolvedValue(undefined),
  nexusResolveMod: vi.fn().mockResolvedValue({
    id: "uuid-123",
    name: "Test Mod",
    game_scoped_id: 1933,
  }),
  nexusGetFileGroups: vi.fn().mockResolvedValue([]),
}));

// Need __TAURI_INTERNALS__ on window for isTauri() checks
beforeEach(() => {
  (globalThis as any).window = { __TAURI_INTERNALS__: true };
});

afterEach(() => {
  delete (globalThis as any).window;
});

import { nexusStore } from "../lib/stores/nexusStore.svelte.js";

describe("nexusStore config persistence", () => {
  beforeEach(() => {
    nexusStore.resetProject();
    mockReadProjectFile.mockReset().mockResolvedValue("{}");
    mockWriteProjectFile.mockReset().mockResolvedValue(undefined);
  });

  // ── Config roundtrip ───────────────────────────────────

  it("loadProjectConfig populates store fields from platforms.json", async () => {
    const platformsData = {
      TestMod: {
        nexus: {
          modId: "42",
          modUuid: "abc-def",
          modName: "My Cool Mod",
          modUrl: "https://nexusmods.com/baldursgate3/mods/42",
          selectedFileGroupId: "group-1",
          category: "update",
          defaultFileGroup: "Main Files",
        },
      },
    };
    mockReadProjectFile.mockResolvedValueOnce(JSON.stringify(platformsData));

    await nexusStore.loadProjectConfig("/project/path", "TestMod");

    expect(nexusStore.modId).toBe("42");
    expect(nexusStore.modUuid).toBe("abc-def");
    expect(nexusStore.modName).toBe("My Cool Mod");
    expect(nexusStore.modUrl).toBe("https://nexusmods.com/baldursgate3/mods/42");
    expect(nexusStore.selectedFileGroupId).toBe("group-1");
    expect(nexusStore.category).toBe("update");
    expect(nexusStore.defaultFileGroup).toBe("Main Files");
    expect(nexusStore.projectPath).toBe("/project/path");
  });

  it("loadProjectConfig falls back to legacy nexus.json", async () => {
    const legacyConfig = {
      modId: "42",
      modName: "Legacy Mod",
    };
    // platforms.json has no entry for this mod
    mockReadProjectFile.mockResolvedValueOnce("{}");
    // legacy nexus.json
    mockReadProjectFile.mockResolvedValueOnce(JSON.stringify(legacyConfig));

    await nexusStore.loadProjectConfig("/project/path", "TestMod");

    expect(nexusStore.modId).toBe("42");
    expect(nexusStore.modName).toBe("Legacy Mod");
  });

  it("saveProjectConfig writes the expected JSON shape to platforms.json", async () => {
    // Pre-populate store via platforms.json
    mockReadProjectFile.mockResolvedValueOnce(
      JSON.stringify({
        SaveMod: {
          nexus: {
            modId: "99",
            modUuid: "uuid-99",
            modName: "Saved Mod",
            modUrl: "https://nexusmods.com/baldursgate3/mods/99",
            category: "optional",
            defaultFileGroup: "Optional Files",
          },
        },
      }),
    );
    await nexusStore.loadProjectConfig("/save/path", "SaveMod");

    // Mock for the read-merge-write in #executeSave
    mockReadProjectFile.mockResolvedValueOnce("{}");

    // Trigger debounced save
    vi.useFakeTimers();
    nexusStore.saveProjectConfig();
    vi.advanceTimersByTime(600);
    vi.useRealTimers();

    // Wait for the async #executeSave
    await vi.waitFor(() => {
      expect(mockWriteProjectFile).toHaveBeenCalled();
    });

    const [path, filename, content] = mockWriteProjectFile.mock.calls[0];
    expect(path).toBe("/save/path");
    expect(filename).toBe("platforms.json");

    const written = JSON.parse(content as string);
    expect(written.SaveMod.nexus.modId).toBe("99");
    expect(written.SaveMod.nexus.modUuid).toBe("uuid-99");
    expect(written.SaveMod.nexus.modName).toBe("Saved Mod");
    expect(written.SaveMod.nexus.modUrl).toBe("https://nexusmods.com/baldursgate3/mods/99");
    expect(written.SaveMod.nexus.category).toBe("optional");
    expect(written.SaveMod.nexus.defaultFileGroup).toBe("Optional Files");
  });

  // ── nexus.json schema — only known keys written ────────

  it("only writes known keys to platforms.json nexus subobject", async () => {
    // Fall back to legacy nexus.json
    mockReadProjectFile.mockResolvedValueOnce("{}");
    mockReadProjectFile.mockResolvedValueOnce(
      JSON.stringify({ modId: "1", modName: "Test" }),
    );
    await nexusStore.loadProjectConfig("/schema/path", "SchemaMod");

    // Mock for read-merge-write
    mockReadProjectFile.mockResolvedValueOnce("{}");

    vi.useFakeTimers();
    nexusStore.saveProjectConfig();
    vi.advanceTimersByTime(600);
    vi.useRealTimers();

    await vi.waitFor(() => {
      expect(mockWriteProjectFile).toHaveBeenCalled();
    });

    const written = JSON.parse(mockWriteProjectFile.mock.calls[0][2] as string);
    const nexusData = written.SchemaMod?.nexus;
    expect(nexusData).toBeDefined();
    const allowedKeys = [
      "modId",
      "modUuid",
      "modName",
      "modUrl",
      "selectedFileGroupId",
      "category",
      "defaultFileGroup",
    ];
    for (const key of Object.keys(nexusData)) {
      expect(allowedKeys).toContain(key);
    }
  });

  // ── resetProject ───────────────────────────────────────

  it("resetProject clears all per-project state", async () => {
    // platforms.json has no entry → falls back to legacy nexus.json
    mockReadProjectFile.mockResolvedValueOnce("{}");
    mockReadProjectFile.mockResolvedValueOnce(
      JSON.stringify({
        modId: "10",
        modUuid: "uuid-10",
        modName: "To Be Reset",
        modUrl: "https://example.com",
        selectedFileGroupId: "fg-1",
        category: "update",
        defaultFileGroup: "Files",
      }),
    );
    await nexusStore.loadProjectConfig("/reset/path", "ResetMod");

    // Verify populated
    expect(nexusStore.modId).toBe("10");

    nexusStore.resetProject();

    expect(nexusStore.modId).toBeNull();
    expect(nexusStore.modName).toBeNull();
    expect(nexusStore.modUuid).toBeNull();
    expect(nexusStore.modUrl).toBeNull();
    expect(nexusStore.fileGroups).toEqual([]);
    expect(nexusStore.selectedFileGroupId).toBeNull();
    expect(nexusStore.category).toBeNull();
    expect(nexusStore.defaultFileGroup).toBe("");
    expect(nexusStore.projectPath).toBeNull();
  });

  // ── Missing config file returns defaults ───────────────

  it("missing config file returns defaults without error", async () => {
    mockReadProjectFile.mockResolvedValueOnce("{}");  // platforms.json
    mockReadProjectFile.mockResolvedValueOnce("{}");  // legacy nexus.json

    await nexusStore.loadProjectConfig("/empty/path", "EmptyMod");

    expect(nexusStore.modId).toBeNull();
    expect(nexusStore.modUuid).toBeNull();
    expect(nexusStore.modName).toBeNull();
    expect(nexusStore.modUrl).toBeNull();
    expect(nexusStore.selectedFileGroupId).toBeNull();
    expect(nexusStore.category).toBeNull();
    expect(nexusStore.defaultFileGroup).toBe("");
    expect(nexusStore.projectPath).toBe("/empty/path");
  });

  // ── Corrupted JSON returns defaults + logs warning ─────

  describe("corrupted config", () => {
    const warnRef = suppressConsoleWarn();

    it("returns defaults and logs warning for invalid JSON", async () => {
      mockReadProjectFile.mockResolvedValueOnce("not valid json {{{");

      await nexusStore.loadProjectConfig("/corrupt/path", "CorruptMod");

      // Should still be defaults
      expect(nexusStore.modId).toBeNull();
      expect(nexusStore.modUuid).toBeNull();
      expect(nexusStore.modName).toBeNull();
      expect(nexusStore.projectPath).toBe("/corrupt/path");

      // Should have logged a warning
      expectConsoleCalled(warnRef, "[nexusStore]");
    });
  });
});
