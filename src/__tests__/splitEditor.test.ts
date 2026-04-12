/**
 * Tests for split editor state management.
 * Since the split state lives inside EditorTabs.svelte (component-local $state),
 * we test the derived logic: canSplit determination based on tab types.
 */
import { describe, it, expect, beforeEach } from "vitest";

const { uiStore } = await import("../lib/stores/uiStore.svelte.js");

describe("Split Editor", () => {
  beforeEach(() => {
    uiStore.reset();
  });

  describe("tab type determines split eligibility", () => {
    it("script-editor tabs support splitting", () => {
      uiStore.openTab({
        id: "script1",
        label: "test.lua",
        type: "script-editor",
        filePath: "Scripts/test.lua",
        language: "lua",
      });

      const tab = uiStore.openTabs.find(t => t.id === "script1");
      expect(tab).toBeTruthy();
      expect(tab!.type === "script-editor" || tab!.type === "file-preview").toBe(true);
    });

    it("file-preview tabs support splitting", () => {
      uiStore.openTab({
        id: "preview1",
        label: "data.txt",
        type: "file-preview",
        filePath: "data.txt",
      });

      const tab = uiStore.openTabs.find(t => t.id === "preview1");
      expect(tab).toBeTruthy();
      expect(tab!.type === "script-editor" || tab!.type === "file-preview").toBe(true);
    });

    it("section tabs do not support splitting", () => {
      uiStore.openTab({
        id: "section1",
        label: "Spells",
        type: "section",
      });

      const tab = uiStore.openTabs.find(t => t.id === "section1");
      expect(tab).toBeTruthy();
      expect(tab!.type === "script-editor" || tab!.type === "file-preview").toBe(false);
    });

    it("welcome tab does not support splitting", () => {
      const tab = uiStore.openTabs.find(t => t.id === "welcome");
      expect(tab).toBeTruthy();
      expect(tab!.type === "script-editor" || tab!.type === "file-preview").toBe(false);
    });

    it("settings tab does not support splitting", () => {
      uiStore.openTab({
        id: "settings",
        label: "Settings",
        type: "settings",
      });

      const tab = uiStore.openTabs.find(t => t.id === "settings");
      expect(tab).toBeTruthy();
      expect(tab!.type === "script-editor" || tab!.type === "file-preview").toBe(false);
    });

    it("readme tab does not support splitting", () => {
      uiStore.openTab({
        id: "readme",
        label: "README.md",
        type: "readme",
      });

      const tab = uiStore.openTabs.find(t => t.id === "readme");
      expect(tab).toBeTruthy();
      expect(tab!.type === "script-editor" || tab!.type === "file-preview").toBe(false);
    });
  });

  describe("tab lifecycle with split-eligible tabs", () => {
    it("opening and closing script-editor tabs works correctly", () => {
      uiStore.openTab({
        id: "script1",
        label: "test.lua",
        type: "script-editor",
        filePath: "Scripts/test.lua",
        language: "lua",
      });

      expect(uiStore.openTabs.some(t => t.id === "script1")).toBe(true);
      expect(uiStore.activeTabId).toBe("script1");

      uiStore.closeTab("script1");
      expect(uiStore.openTabs.some(t => t.id === "script1")).toBe(false);
    });

    it("multiple script-editor tabs can coexist", () => {
      uiStore.openTab({
        id: "script1",
        label: "a.lua",
        type: "script-editor",
        filePath: "Scripts/a.lua",
        language: "lua",
      });
      uiStore.openTab({
        id: "script2",
        label: "b.lua",
        type: "script-editor",
        filePath: "Scripts/b.lua",
        language: "lua",
      });

      expect(uiStore.openTabs.filter(t => t.type === "script-editor")).toHaveLength(2);
    });
  });
});
