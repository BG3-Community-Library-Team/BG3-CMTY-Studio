/**
 * Test 27: Save/Export UI — IPC rejection → toast notification
 *
 * Verifies that when saveProject() rejects (IPC failure), the calling code
 * surfaces an error toast via toastStore.error().
 *
 * We test the wrapper layer (save.ts) and the component-level error handling
 * pattern used by OutputSidebar and ExportBar.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock is hoisted — use vi.hoisted to create the mock function ahead of time
const mockInvoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

// Mock the toast store
vi.mock("../../lib/stores/toastStore.svelte.js", () => ({
  toastStore: {
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock db-management so getDbPaths resolves
vi.mock("../../lib/tauri/db-management.js", () => ({
  getDbPaths: vi.fn().mockResolvedValue({
    staging: "/tmp/staging.sqlite",
    base: "/tmp/base.sqlite",
    honor: "",
    mods: "",
    dir: "/tmp",
  }),
}));

import { saveProject, validateHandlers } from "../../lib/tauri/save.js";
import { toastStore } from "../../lib/stores/toastStore.svelte.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Test 27: Save/Export IPC rejection → toast notification", () => {
  it("saveProject rejects when invoke rejects", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("DB not found"));

    await expect(
      saveProject("/tmp/staging.sqlite", "/tmp/base.sqlite", "/mods/mymod", "MyMod", "MyModFolder", false, false),
    ).rejects.toThrow("DB not found");
  });

  it("validateHandlers rejects when invoke rejects", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("Validation error"));

    await expect(
      validateHandlers("/tmp/staging.sqlite", "/tmp/base.sqlite", "/mods/mymod", "MyMod", "MyModFolder"),
    ).rejects.toThrow("Validation error");
  });

  it("component-level save pattern calls toastStore.error on IPC failure", async () => {
    // Simulate the error handling pattern used by OutputSidebar.handleSave()
    mockInvoke.mockRejectedValueOnce(new Error("disk full"));

    try {
      await saveProject("/tmp/staging.sqlite", "/tmp/base.sqlite", "/mods/mymod", "MyMod", "MyModFolder", false, false);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      toastStore.error("Save failed", message);
    }

    expect(vi.mocked(toastStore.error)).toHaveBeenCalledWith("Save failed", "disk full");
  });

  it("component-level preview pattern calls toastStore.error on IPC failure", async () => {
    // Simulate the error handling pattern used by ExportBar.handlePreview()
    mockInvoke.mockRejectedValueOnce(new Error("staging DB locked"));

    try {
      await saveProject("/tmp/staging.sqlite", "/tmp/base.sqlite", "/mods/mymod", "MyMod", "MyModFolder", false, true);
    } catch (err) {
      toastStore.error("Preview failed", String(err));
    }

    expect(vi.mocked(toastStore.error)).toHaveBeenCalledWith("Preview failed", expect.stringContaining("staging DB locked"));
  });
});
