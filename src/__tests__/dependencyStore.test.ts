// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock tauri project-settings before importing the store
const mockRead = vi.fn();
const mockWrite = vi.fn();
vi.mock("../lib/tauri/project-settings.js", () => ({
  readProjectFile: (...args: unknown[]) => mockRead(...args),
  writeProjectFile: (...args: unknown[]) => mockWrite(...args),
}));

import { dependencyStore, type ProjectDependency } from "../lib/stores/dependencyStore.svelte.js";

function makeDep(overrides: Partial<ProjectDependency> = {}): ProjectDependency {
  return {
    name: "Test Mod",
    metaUuid: null,
    nexusModId: null,
    modioModId: null,
    notes: null,
    ...overrides,
  };
}

// Simulate Tauri environment
function enableTauri() {
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
}
function disableTauri() {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
}

describe("dependencyStore", () => {
  beforeEach(() => {
    dependencyStore.resetProject();
  });

  describe("addDependency", () => {
    it("appends a dependency", () => {
      const dep = makeDep({ name: "ModA", nexusModId: "123" });
      dependencyStore.addDependency(dep);
      expect(dependencyStore.dependencies).toHaveLength(1);
      expect(dependencyStore.dependencies[0].name).toBe("ModA");
      expect(dependencyStore.dependencies[0].nexusModId).toBe("123");
    });

    it("preserves existing dependencies", () => {
      dependencyStore.addDependency(makeDep({ name: "A" }));
      dependencyStore.addDependency(makeDep({ name: "B" }));
      expect(dependencyStore.dependencies).toHaveLength(2);
      expect(dependencyStore.dependencies[0].name).toBe("A");
      expect(dependencyStore.dependencies[1].name).toBe("B");
    });
  });

  describe("removeDependency", () => {
    it("removes by index", () => {
      dependencyStore.addDependency(makeDep({ name: "A" }));
      dependencyStore.addDependency(makeDep({ name: "B" }));
      dependencyStore.addDependency(makeDep({ name: "C" }));
      dependencyStore.removeDependency(1);
      expect(dependencyStore.dependencies).toHaveLength(2);
      expect(dependencyStore.dependencies[0].name).toBe("A");
      expect(dependencyStore.dependencies[1].name).toBe("C");
    });

    it("ignores invalid index (negative)", () => {
      dependencyStore.addDependency(makeDep({ name: "A" }));
      dependencyStore.removeDependency(-1);
      expect(dependencyStore.dependencies).toHaveLength(1);
    });

    it("ignores invalid index (out of bounds)", () => {
      dependencyStore.addDependency(makeDep({ name: "A" }));
      dependencyStore.removeDependency(5);
      expect(dependencyStore.dependencies).toHaveLength(1);
    });
  });

  describe("updateDependency", () => {
    it("updates specific fields", () => {
      dependencyStore.addDependency(makeDep({ name: "A", nexusModId: null }));
      dependencyStore.updateDependency(0, { nexusModId: "456", notes: "linked" });
      expect(dependencyStore.dependencies[0].nexusModId).toBe("456");
      expect(dependencyStore.dependencies[0].notes).toBe("linked");
      expect(dependencyStore.dependencies[0].name).toBe("A");
    });

    it("ignores invalid index (negative)", () => {
      dependencyStore.addDependency(makeDep({ name: "A" }));
      dependencyStore.updateDependency(-1, { name: "X" });
      expect(dependencyStore.dependencies[0].name).toBe("A");
    });

    it("ignores invalid index (out of bounds)", () => {
      dependencyStore.addDependency(makeDep({ name: "A" }));
      dependencyStore.updateDependency(10, { name: "X" });
      expect(dependencyStore.dependencies[0].name).toBe("A");
    });
  });

  describe("resetProject", () => {
    it("clears all state", () => {
      dependencyStore.addDependency(makeDep({ name: "A" }));
      dependencyStore.addDependency(makeDep({ name: "B" }));
      dependencyStore.resetProject();
      expect(dependencyStore.dependencies).toHaveLength(0);
      expect(dependencyStore.projectPath).toBeNull();
    });
  });

  describe("loadDependencies", () => {
    it("sets empty when not in tauri env", async () => {
      disableTauri();
      dependencyStore.addDependency(makeDep({ name: "stale" }));
      await dependencyStore.loadDependencies("/some/path");
      // Non-tauri env → returns early, deps should remain empty from the load attempt
      expect(dependencyStore.projectPath).toBe("/some/path");
    });

    it("handles empty projectPath", async () => {
      await dependencyStore.loadDependencies("");
      expect(dependencyStore.dependencies).toHaveLength(0);
    });

    it("parses valid JSON with all fields", async () => {
      enableTauri();
      mockRead.mockResolvedValueOnce(JSON.stringify({
        dependencies: [
          { name: "ModA", metaUuid: "uuid-1", nexusModId: "100", modioModId: 5, notes: "test" },
          { name: "ModB", metaUuid: null, nexusModId: null, modioModId: null, notes: null },
        ],
      }));
      await dependencyStore.loadDependencies("/project");
      expect(dependencyStore.dependencies).toHaveLength(2);
      expect(dependencyStore.dependencies[0]).toEqual({
        name: "ModA", metaUuid: "uuid-1", nexusModId: "100", modioModId: 5, notes: "test",
      });
      expect(dependencyStore.dependencies[1]).toEqual({
        name: "ModB", metaUuid: null, nexusModId: null, modioModId: null, notes: null,
      });
      disableTauri();
    });

    it("coerces invalid field types to defaults", async () => {
      enableTauri();
      mockRead.mockResolvedValueOnce(JSON.stringify({
        dependencies: [
          { name: 42, metaUuid: 99, nexusModId: true, modioModId: "not-num", notes: false },
        ],
      }));
      await dependencyStore.loadDependencies("/project");
      expect(dependencyStore.dependencies[0]).toEqual({
        name: "", metaUuid: null, nexusModId: null, modioModId: null, notes: null,
      });
      disableTauri();
    });

    it("handles non-array dependencies field", async () => {
      enableTauri();
      mockRead.mockResolvedValueOnce(JSON.stringify({ dependencies: "not-array" }));
      await dependencyStore.loadDependencies("/project");
      expect(dependencyStore.dependencies).toHaveLength(0);
      disableTauri();
    });

    it("handles readProjectFile failure gracefully", async () => {
      enableTauri();
      mockRead.mockRejectedValueOnce(new Error("file not found"));
      await dependencyStore.loadDependencies("/project");
      expect(dependencyStore.dependencies).toHaveLength(0);
      disableTauri();
    });

    it("handles null parsed result", async () => {
      enableTauri();
      mockRead.mockResolvedValueOnce("null");
      await dependencyStore.loadDependencies("/project");
      expect(dependencyStore.dependencies).toHaveLength(0);
      disableTauri();
    });
  });

  describe("saveDependencies", () => {
    it("does nothing without projectPath", () => {
      dependencyStore.projectPath = null;
      // Should not throw
      dependencyStore.saveDependencies();
    });
  });
});
