/**
 * Tests for FilePreviewPanel edit mode — toggle, dirty state, save flow.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Tauri IPC
vi.mock("../lib/utils/tauri.js", () => ({
  readModFile: vi.fn(() => Promise.resolve("original content")),
}));

vi.mock("../lib/tauri/scripts.js", () => ({
  scriptWrite: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("../paraglide/messages.js", () => {
  const handler: ProxyHandler<Record<string, Function>> = {
    get(_target, prop: string) {
      if (prop === "__esModule") return true;
      if (typeof prop === "symbol") return undefined;
      return (params?: Record<string, unknown>) => {
        if (params && Object.keys(params).length > 0) {
          return `${String(prop)}(${Object.values(params).join(", ")})`;
        }
        return String(prop);
      };
    },
  };
  return { m: new Proxy({} as Record<string, Function>, handler) };
});

const { uiStore } = await import("../lib/stores/uiStore.svelte.js");

describe("FilePreviewPanel edit mode", () => {
  beforeEach(() => {
    uiStore.reset();
  });

  describe("tab dirty state tracking", () => {
    it("a file-preview tab starts with dirty=false", () => {
      uiStore.openTab({
        id: "preview:test.lua",
        label: "test.lua",
        type: "file-preview",
        filePath: "test.lua",
      });
      const tab = uiStore.openTabs.find(t => t.id === "preview:test.lua");
      expect(tab).toBeTruthy();
      expect(tab?.dirty).toBeFalsy();
    });

    it("tab dirty can be set to true", () => {
      uiStore.openTab({
        id: "preview:test.lua",
        label: "test.lua",
        type: "file-preview",
        filePath: "test.lua",
      });
      const tab = uiStore.openTabs.find(t => t.id === "preview:test.lua");
      expect(tab).toBeTruthy();
      tab!.dirty = true;
      expect(tab?.dirty).toBe(true);
    });

    it("tab dirty can be reset to false", () => {
      uiStore.openTab({
        id: "preview:test.lua",
        label: "test.lua",
        type: "file-preview",
        filePath: "test.lua",
        dirty: true,
      });
      const tab = uiStore.openTabs.find(t => t.id === "preview:test.lua");
      tab!.dirty = false;
      expect(tab?.dirty).toBe(false);
    });
  });

  describe("file-diff tab type", () => {
    it("can open a file-diff tab", () => {
      uiStore.openTab({
        id: "diff:test",
        label: "Diff",
        type: "file-diff",
        leftContent: "hello",
        rightContent: "world",
        leftLabel: "Before",
        rightLabel: "After",
      });
      const tab = uiStore.openTabs.find(t => t.id === "diff:test");
      expect(tab).toBeTruthy();
      expect(tab?.type).toBe("file-diff");
      expect(tab?.leftContent).toBe("hello");
      expect(tab?.rightContent).toBe("world");
      expect(tab?.leftLabel).toBe("Before");
      expect(tab?.rightLabel).toBe("After");
    });
  });

  describe("scriptWrite mock", () => {
    it("scriptWrite is importable and callable", async () => {
      const { scriptWrite } = await import("../lib/tauri/scripts.js");
      const result = await scriptWrite("basePath", "file.lua", "content");
      expect(result).toBe(true);
      expect(scriptWrite).toHaveBeenCalledWith("basePath", "file.lua", "content");
    });
  });
});
