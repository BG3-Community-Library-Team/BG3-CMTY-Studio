/**
 * Tests for NexusPanel sidebar — store state transitions, upload enablement logic,
 * dependencyStore CRUD, and upload error classification.
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
  nexusPackageAndUpload: vi.fn().mockResolvedValue(undefined),
  nexusUploadFile: vi.fn().mockResolvedValue(undefined),
  nexusCreateModFile: vi.fn().mockResolvedValue(undefined),
  nexusGetFileDependencies: vi.fn().mockResolvedValue([]),
  nexusGetModRequirements: vi.fn().mockResolvedValue([]),
  nexusSetFileDependencies: vi.fn().mockResolvedValue(undefined),
  nexusRenameFileGroup: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  (globalThis as any).window = { __TAURI_INTERNALS__: true };
});

afterEach(() => {
  delete (globalThis as any).window;
});

import { nexusStore } from "../lib/stores/nexusStore.svelte.js";
import { dependencyStore } from "../lib/stores/dependencyStore.svelte.js";

// ── Upload enablement helper ─────────────────────────────────────
// Mirrors the disabled condition from NexusPanel.svelte line 286:
//   disabled={!nexusStore.apiKeyValid || !nexusStore.modUuid ||
//             !nexusStore.selectedFileGroupId || !uploadVersion.trim() ||
//             platformUploadStore.isUploading}

function isUploadEnabled(state: {
  apiKeyValid: boolean;
  modUuid: string | null;
  selectedFileGroupId: string | null;
  version: string;
  isUploading: boolean;
}): boolean {
  return (
    state.apiKeyValid &&
    !!state.modUuid &&
    !!state.selectedFileGroupId &&
    !!state.version.trim() &&
    !state.isUploading
  );
}

// ── Error classification helper ──────────────────────────────────
// Mirrors the catch block in NexusPanel.svelte handleUpload()

function classifyUploadError(
  message: string,
): "rate_limit" | "network" | "packaging" | "generic" {
  const msg = message.toLowerCase();
  if (msg.includes("429") || msg.includes("rate")) return "rate_limit";
  if (
    msg.includes("network") ||
    msg.includes("connection") ||
    msg.includes("timeout")
  )
    return "network";
  if (msg.includes("package") || msg.includes("pak") || msg.includes("zip"))
    return "packaging";
  return "generic";
}

// ══════════════════════════════════════════════════════════════════
// nexusStore — state conditions
// ══════════════════════════════════════════════════════════════════

describe("NexusPanel — state conditions", () => {
  beforeEach(() => {
    nexusStore.resetProject();
    mockReadProjectFile.mockReset().mockResolvedValue("{}");
    mockWriteProjectFile.mockReset().mockResolvedValue(undefined);
  });

  it("nexusStore starts unlinked (no modUuid)", () => {
    expect(nexusStore.modUuid).toBeNull();
    expect(nexusStore.modId).toBeNull();
    expect(nexusStore.modName).toBeNull();
  });

  it("linked state after resolveMod populates modId, modName, modUuid", async () => {
    await nexusStore.resolveMod("https://nexusmods.com/baldursgate3/mods/1933");

    expect(nexusStore.modUuid).toBe("uuid-123");
    expect(nexusStore.modName).toBe("Test Mod");
    expect(nexusStore.modId).toBe("1933");
  });

  it("resetProject clears all linked state", async () => {
    await nexusStore.resolveMod("https://nexusmods.com/baldursgate3/mods/1933");
    expect(nexusStore.modUuid).toBe("uuid-123");

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
});

// ══════════════════════════════════════════════════════════════════
// Upload enablement logic
// ══════════════════════════════════════════════════════════════════

describe("NexusPanel — upload enablement", () => {
  it("upload should be disabled when apiKeyValid is false", () => {
    expect(
      isUploadEnabled({
        apiKeyValid: false,
        modUuid: "uuid-1",
        selectedFileGroupId: "fg-1",
        version: "1.0.0",
        isUploading: false,
      }),
    ).toBe(false);
  });

  it("upload should be disabled when modUuid is null", () => {
    expect(
      isUploadEnabled({
        apiKeyValid: true,
        modUuid: null,
        selectedFileGroupId: "fg-1",
        version: "1.0.0",
        isUploading: false,
      }),
    ).toBe(false);
  });

  it("upload should be disabled when selectedFileGroupId is null", () => {
    expect(
      isUploadEnabled({
        apiKeyValid: true,
        modUuid: "uuid-1",
        selectedFileGroupId: null,
        version: "1.0.0",
        isUploading: false,
      }),
    ).toBe(false);
  });

  it("upload should be disabled when version is empty", () => {
    expect(
      isUploadEnabled({
        apiKeyValid: true,
        modUuid: "uuid-1",
        selectedFileGroupId: "fg-1",
        version: "",
        isUploading: false,
      }),
    ).toBe(false);
  });

  it("upload should be disabled when version is whitespace-only", () => {
    expect(
      isUploadEnabled({
        apiKeyValid: true,
        modUuid: "uuid-1",
        selectedFileGroupId: "fg-1",
        version: "   ",
        isUploading: false,
      }),
    ).toBe(false);
  });

  it("upload should be disabled when isUploading is true", () => {
    expect(
      isUploadEnabled({
        apiKeyValid: true,
        modUuid: "uuid-1",
        selectedFileGroupId: "fg-1",
        version: "1.0.0",
        isUploading: true,
      }),
    ).toBe(false);
  });

  it("upload should be enabled when all conditions met", () => {
    expect(
      isUploadEnabled({
        apiKeyValid: true,
        modUuid: "uuid-1",
        selectedFileGroupId: "fg-1",
        version: "1.0.0",
        isUploading: false,
      }),
    ).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════
// dependencyStore
// ══════════════════════════════════════════════════════════════════

describe("dependencyStore", () => {
  beforeEach(() => {
    dependencyStore.resetProject();
    mockReadProjectFile.mockReset().mockResolvedValue("{}");
    mockWriteProjectFile.mockReset().mockResolvedValue(undefined);
  });

  it("loads dependencies from JSON", async () => {
    const deps = {
      dependencies: [
        {
          name: "Mod Framework",
          metaUuid: "meta-uuid-1",
          nexusModId: "123",
          modioModId: null,
          notes: "Required",
        },
        {
          name: "Patch Helper",
          metaUuid: null,
          nexusModId: "456",
          modioModId: 789,
          notes: null,
        },
      ],
    };
    mockReadProjectFile.mockResolvedValueOnce(JSON.stringify(deps));

    await dependencyStore.loadDependencies("/project/path");

    expect(dependencyStore.dependencies).toHaveLength(2);
    expect(dependencyStore.dependencies[0].name).toBe("Mod Framework");
    expect(dependencyStore.dependencies[0].metaUuid).toBe("meta-uuid-1");
    expect(dependencyStore.dependencies[0].nexusModId).toBe("123");
    expect(dependencyStore.dependencies[0].modioModId).toBeNull();
    expect(dependencyStore.dependencies[0].notes).toBe("Required");
    expect(dependencyStore.dependencies[1].name).toBe("Patch Helper");
    expect(dependencyStore.dependencies[1].modioModId).toBe(789);
  });

  it("handles missing dependencies.json gracefully", async () => {
    // Empty object — no dependencies key
    mockReadProjectFile.mockResolvedValueOnce("{}");

    await dependencyStore.loadDependencies("/project/path");

    expect(dependencyStore.dependencies).toEqual([]);
    expect(dependencyStore.projectPath).toBe("/project/path");
  });

  describe("corrupted JSON", () => {
    const warnRef = suppressConsoleWarn();

    it("handles corrupted JSON gracefully", async () => {
      mockReadProjectFile.mockResolvedValueOnce("not valid json {{{");

      await dependencyStore.loadDependencies("/corrupt/path");

      expect(dependencyStore.dependencies).toEqual([]);
      expectConsoleCalled(warnRef, "[dependencyStore]");
    });
  });

  it("addDependency adds and triggers save", async () => {
    dependencyStore.projectPath = "/project/path";

    vi.useFakeTimers();
    dependencyStore.addDependency({
      name: "New Dep",
      metaUuid: "meta-1",
      nexusModId: "100",
      modioModId: null,
      notes: null,
    });

    expect(dependencyStore.dependencies).toHaveLength(1);
    expect(dependencyStore.dependencies[0].name).toBe("New Dep");

    // Advance past debounce timer
    vi.advanceTimersByTime(600);
    vi.useRealTimers();

    await vi.waitFor(() => {
      expect(mockWriteProjectFile).toHaveBeenCalled();
    });

    const [path, filename] = mockWriteProjectFile.mock.calls[0];
    expect(path).toBe("/project/path");
    expect(filename).toBe("dependencies.json");
  });

  it("removeDependency removes by index and triggers save", async () => {
    dependencyStore.projectPath = "/project/path";

    // Add two deps first
    dependencyStore.addDependency({
      name: "Dep A",
      metaUuid: null,
      nexusModId: null,
      modioModId: null,
      notes: null,
    });
    dependencyStore.addDependency({
      name: "Dep B",
      metaUuid: null,
      nexusModId: null,
      modioModId: null,
      notes: null,
    });
    expect(dependencyStore.dependencies).toHaveLength(2);

    mockWriteProjectFile.mockReset().mockResolvedValue(undefined);

    vi.useFakeTimers();
    dependencyStore.removeDependency(0);
    vi.advanceTimersByTime(600);
    vi.useRealTimers();

    expect(dependencyStore.dependencies).toHaveLength(1);
    expect(dependencyStore.dependencies[0].name).toBe("Dep B");

    await vi.waitFor(() => {
      expect(mockWriteProjectFile).toHaveBeenCalled();
    });
  });

  it("removeDependency ignores out-of-bounds index", () => {
    dependencyStore.projectPath = "/project/path";
    dependencyStore.addDependency({
      name: "Only",
      metaUuid: null,
      nexusModId: null,
      modioModId: null,
      notes: null,
    });

    dependencyStore.removeDependency(5);
    dependencyStore.removeDependency(-1);

    expect(dependencyStore.dependencies).toHaveLength(1);
    expect(dependencyStore.dependencies[0].name).toBe("Only");
  });

  it("updateDependency updates specific fields", async () => {
    dependencyStore.projectPath = "/project/path";
    dependencyStore.addDependency({
      name: "Original",
      metaUuid: null,
      nexusModId: null,
      modioModId: null,
      notes: null,
    });

    mockWriteProjectFile.mockReset().mockResolvedValue(undefined);

    vi.useFakeTimers();
    dependencyStore.updateDependency(0, {
      name: "Updated",
      nexusModId: "999",
    });
    vi.advanceTimersByTime(600);
    vi.useRealTimers();

    expect(dependencyStore.dependencies[0].name).toBe("Updated");
    expect(dependencyStore.dependencies[0].nexusModId).toBe("999");
    // Untouched fields remain
    expect(dependencyStore.dependencies[0].metaUuid).toBeNull();

    await vi.waitFor(() => {
      expect(mockWriteProjectFile).toHaveBeenCalled();
    });
  });

  it("resetProject clears all state", () => {
    dependencyStore.projectPath = "/project/path";
    dependencyStore.addDependency({
      name: "Temp",
      metaUuid: null,
      nexusModId: null,
      modioModId: null,
      notes: null,
    });
    expect(dependencyStore.dependencies).toHaveLength(1);

    dependencyStore.resetProject();

    expect(dependencyStore.dependencies).toEqual([]);
    expect(dependencyStore.projectPath).toBeNull();
  });

  it("debounces save calls", async () => {
    dependencyStore.projectPath = "/project/path";

    vi.useFakeTimers();

    // Rapid-fire three adds — only the last timer should fire
    dependencyStore.addDependency({
      name: "A",
      metaUuid: null,
      nexusModId: null,
      modioModId: null,
      notes: null,
    });
    dependencyStore.addDependency({
      name: "B",
      metaUuid: null,
      nexusModId: null,
      modioModId: null,
      notes: null,
    });
    dependencyStore.addDependency({
      name: "C",
      metaUuid: null,
      nexusModId: null,
      modioModId: null,
      notes: null,
    });

    // Not yet saved (within debounce window)
    expect(mockWriteProjectFile).not.toHaveBeenCalled();

    // Advance past the 500ms debounce
    vi.advanceTimersByTime(600);
    vi.useRealTimers();

    await vi.waitFor(() => {
      expect(mockWriteProjectFile).toHaveBeenCalledTimes(1);
    });

    // The saved data should contain all three deps
    const written = JSON.parse(
      mockWriteProjectFile.mock.calls[0][2] as string,
    );
    expect(written.dependencies).toHaveLength(3);
  });
});

// ══════════════════════════════════════════════════════════════════
// Upload error classification
// ══════════════════════════════════════════════════════════════════

describe("upload error classification", () => {
  it("classifies 429 as rate limit error", () => {
    expect(classifyUploadError("HTTP 429 Too Many Requests")).toBe(
      "rate_limit",
    );
    expect(classifyUploadError("Rate limit exceeded")).toBe("rate_limit");
    expect(classifyUploadError("rate limited by server")).toBe("rate_limit");
  });

  it("classifies network errors", () => {
    expect(classifyUploadError("Network error occurred")).toBe("network");
    expect(classifyUploadError("Connection refused")).toBe("network");
    expect(classifyUploadError("Request timeout after 30s")).toBe("network");
  });

  it("classifies packaging errors", () => {
    expect(classifyUploadError("Failed to package mod")).toBe("packaging");
    expect(classifyUploadError("Invalid .pak file")).toBe("packaging");
    expect(classifyUploadError("zip creation failed")).toBe("packaging");
  });

  it("falls back to generic upload error", () => {
    expect(classifyUploadError("Something went wrong")).toBe("generic");
    expect(classifyUploadError("Unknown server error 500")).toBe("generic");
    expect(classifyUploadError("")).toBe("generic");
  });
});
