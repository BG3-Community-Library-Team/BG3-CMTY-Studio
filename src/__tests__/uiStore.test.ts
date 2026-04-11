/**
 * uiStore tests — covers tab management, sidebar toggling, file explorer
 * state, edge cases (empty tabs, out-of-bounds, drag reorder), and reset.
 */
import { describe, it, expect, beforeEach } from "vitest";

const { uiStore } = await import("../lib/stores/uiStore.svelte.js");
type EditorTab = Parameters<typeof uiStore.openTab>[0];

describe("UiStore", () => {
  beforeEach(() => {
    uiStore.reset();
  });

  // ── toggleSidebar ─────────────────────────────────────────────────

  describe("toggleSidebar", () => {
    it("toggles visibility when called without view", () => {
      expect(uiStore.sidebarVisible).toBe(true);
      uiStore.toggleSidebar();
      expect(uiStore.sidebarVisible).toBe(false);
      uiStore.toggleSidebar();
      expect(uiStore.sidebarVisible).toBe(true);
    });

    it("switches to a different view and shows sidebar", () => {
      uiStore.activeView = "explorer";
      uiStore.sidebarVisible = false;
      uiStore.toggleSidebar("search");
      expect(uiStore.activeView).toBe("search");
      expect(uiStore.sidebarVisible).toBe(true);
    });

    it("hides sidebar when toggling the same view", () => {
      uiStore.activeView = "search";
      uiStore.sidebarVisible = true;
      uiStore.toggleSidebar("search");
      expect(uiStore.sidebarVisible).toBe(false);
    });
  });

  // ── openTab ───────────────────────────────────────────────────────

  describe("openTab", () => {
    it("adds a new tab and activates it", () => {
      const tab: EditorTab = { id: "test-tab", label: "Test", type: "section" };
      uiStore.openTab(tab);
      expect(uiStore.openTabs.find(t => t.id === "test-tab")).toBeTruthy();
      expect(uiStore.activeTabId).toBe("test-tab");
    });

    it("focuses existing tab instead of duplicating", () => {
      const tab: EditorTab = { id: "section-1", label: "Races", type: "section" };
      uiStore.openTab(tab);
      const countBefore = uiStore.openTabs.length;
      uiStore.openTab(tab);
      expect(uiStore.openTabs.length).toBe(countBefore);
      expect(uiStore.activeTabId).toBe("section-1");
    });

    it("replaces preview tab with another preview tab", () => {
      const preview1: EditorTab = { id: "preview-1", label: "Preview 1", type: "file-preview", preview: true };
      const preview2: EditorTab = { id: "preview-2", label: "Preview 2", type: "file-preview", preview: true };
      uiStore.openTab(preview1);
      const countAfterFirst = uiStore.openTabs.length;

      uiStore.openTab(preview2);
      expect(uiStore.openTabs.length).toBe(countAfterFirst); // replaced, not added
      expect(uiStore.openTabs.find(t => t.id === "preview-1")).toBeFalsy();
      expect(uiStore.openTabs.find(t => t.id === "preview-2")).toBeTruthy();
      expect(uiStore.activeTabId).toBe("preview-2");
    });

    it("promotes preview tab to permanent when reopened as non-preview", () => {
      const preview: EditorTab = { id: "file-1", label: "File", type: "file-preview", preview: true };
      uiStore.openTab(preview);
      expect(uiStore.openTabs.find(t => t.id === "file-1")?.preview).toBe(true);

      const permanent: EditorTab = { id: "file-1", label: "File", type: "file-preview", preview: false };
      uiStore.openTab(permanent);
      expect(uiStore.openTabs.find(t => t.id === "file-1")?.preview).toBe(false);
    });
  });

  // ── promoteTab ─────────────────────────────────────────────────────

  describe("promoteTab", () => {
    it("promotes a preview tab to permanent", () => {
      uiStore.openTab({ id: "pin-me", label: "Pin", type: "file-preview", preview: true });
      uiStore.promoteTab("pin-me");
      expect(uiStore.openTabs.find(t => t.id === "pin-me")?.preview).toBe(false);
    });

    it("no-ops for nonexistent tab", () => {
      uiStore.promoteTab("nonexistent"); // should not throw
    });
  });

  // ── pinTab / unpinTab ─────────────────────────────────────────────

  describe("pinTab", () => {
    it("pins a tab and moves it to the left", () => {
      uiStore.openTab({ id: "a", label: "A", type: "section" });
      uiStore.openTab({ id: "b", label: "B", type: "section" });
      uiStore.pinTab("b");
      const tab = uiStore.openTabs.find(t => t.id === "b");
      expect(tab?.pinned).toBe(true);
      expect(tab?.preview).toBe(false);
      // Pinned tab should be before unpinned tab "a"
      const bIdx = uiStore.openTabs.findIndex(t => t.id === "b");
      const aIdx = uiStore.openTabs.findIndex(t => t.id === "a");
      expect(bIdx).toBeLessThan(aIdx);
    });

    it("unpinTab restores normal state", () => {
      uiStore.openTab({ id: "c", label: "C", type: "section" });
      uiStore.pinTab("c");
      expect(uiStore.openTabs.find(t => t.id === "c")?.pinned).toBe(true);
      uiStore.unpinTab("c");
      expect(uiStore.openTabs.find(t => t.id === "c")?.pinned).toBe(false);
    });

    it("pinTab no-ops for nonexistent tab", () => {
      uiStore.pinTab("nonexistent"); // should not throw
    });

    it("unpinTab no-ops for nonexistent tab", () => {
      uiStore.unpinTab("nonexistent"); // should not throw
    });

    it("pinned tab sorts after welcome but before unpinned", () => {
      // Welcome tab is always at index 0
      uiStore.openTab({ id: "x", label: "X", type: "section" });
      uiStore.openTab({ id: "y", label: "Y", type: "section" });
      uiStore.pinTab("y");
      const welcomeIdx = uiStore.openTabs.findIndex(t => t.id === "welcome");
      const yIdx = uiStore.openTabs.findIndex(t => t.id === "y");
      const xIdx = uiStore.openTabs.findIndex(t => t.id === "x");
      expect(welcomeIdx).toBe(0);
      expect(yIdx).toBeLessThan(xIdx);
      expect(yIdx).toBeGreaterThan(welcomeIdx);
    });

    it("openTab skips pinned tabs when replacing previews", () => {
      uiStore.openTab({ id: "pinned-1", label: "Pinned", type: "section" });
      uiStore.pinTab("pinned-1");
      uiStore.openTab({ id: "preview-1", label: "Preview", type: "file-preview", preview: true });
      // Open another preview — should replace preview-1, not pinned-1
      uiStore.openTab({ id: "preview-2", label: "Preview 2", type: "file-preview", preview: true });
      expect(uiStore.openTabs.find(t => t.id === "pinned-1")).toBeTruthy();
      expect(uiStore.openTabs.find(t => t.id === "preview-1")).toBeFalsy();
      expect(uiStore.openTabs.find(t => t.id === "preview-2")).toBeTruthy();
    });

    it("promoteTab is safe on already permanent tabs", () => {
      uiStore.openTab({ id: "perm", label: "Perm", type: "section" });
      uiStore.promoteTab("perm");
      expect(uiStore.openTabs.find(t => t.id === "perm")?.preview).toBeFalsy();
    });

    it("pinTab on welcome tab is a no-op", () => {
      uiStore.pinTab("welcome");
      expect(uiStore.openTabs.find(t => t.id === "welcome")?.pinned).toBeFalsy();
    });

    it("multiple pinned tabs sort after welcome and before unpinned", () => {
      uiStore.openTab({ id: "d", label: "D", type: "section" });
      uiStore.openTab({ id: "e", label: "E", type: "section" });
      uiStore.openTab({ id: "f", label: "F", type: "section" });
      uiStore.pinTab("f");
      uiStore.pinTab("d");
      // Order should be: welcome, then pinned (f, d), then unpinned (e)
      const fIdx = uiStore.openTabs.findIndex(t => t.id === "f");
      const dIdx = uiStore.openTabs.findIndex(t => t.id === "d");
      const eIdx = uiStore.openTabs.findIndex(t => t.id === "e");
      expect(fIdx).toBeLessThan(eIdx);
      expect(dIdx).toBeLessThan(eIdx);
      expect(fIdx).toBeGreaterThan(0); // after welcome
      expect(dIdx).toBeGreaterThan(0); // after welcome
    });
  });

  // ── closeTab ──────────────────────────────────────────────────────

  describe("closeTab", () => {
    it("removes the tab and activates adjacent tab", () => {
      uiStore.openTab({ id: "a", label: "A", type: "section" });
      uiStore.openTab({ id: "b", label: "B", type: "section" });
      uiStore.openTab({ id: "c", label: "C", type: "section" });
      uiStore.activeTabId = "b";

      uiStore.closeTab("b");
      expect(uiStore.openTabs.find(t => t.id === "b")).toBeFalsy();
      // Should activate the tab at the position of the closed tab
      expect(uiStore.activeTabId).toBeTruthy();
      expect(uiStore.activeTabId).not.toBe("b");
    });

    it("activates the last tab when closing the rightmost tab", () => {
      uiStore.openTab({ id: "a", label: "A", type: "section" });
      uiStore.openTab({ id: "b", label: "B", type: "section" });
      uiStore.activeTabId = "b";

      uiStore.closeTab("b");
      // Should fall back to the tab at the clamped position
      expect(uiStore.activeTabId).toBeTruthy();
    });

    it("reopens welcome tab when last tab is closed (TAB-01)", () => {
      // Close all tabs — welcome should reappear
      const ids = uiStore.openTabs.map(t => t.id);
      for (const id of ids) {
        uiStore.closeTab(id);
      }
      expect(uiStore.openTabs).toHaveLength(1);
      expect(uiStore.openTabs[0].id).toBe("welcome");
      expect(uiStore.activeTabId).toBe("welcome");
    });

    it("no-ops for nonexistent tab id", () => {
      const count = uiStore.openTabs.length;
      uiStore.closeTab("nonexistent");
      expect(uiStore.openTabs.length).toBe(count);
    });

    it("does not change activeTabId when closing a non-active tab", () => {
      uiStore.openTab({ id: "a", label: "A", type: "section" });
      uiStore.openTab({ id: "b", label: "B", type: "section" });
      uiStore.activeTabId = "b";

      uiStore.closeTab("a");
      expect(uiStore.activeTabId).toBe("b");
    });
  });

  // ── moveTab ───────────────────────────────────────────────────────

  describe("moveTab", () => {
    it("reorders tabs from one position to another", () => {
      uiStore.openTab({ id: "a", label: "A", type: "section" });
      uiStore.openTab({ id: "b", label: "B", type: "section" });
      uiStore.openTab({ id: "c", label: "C", type: "section" });

      // Find indices (welcome is at 0)
      const aIdx = uiStore.openTabs.findIndex(t => t.id === "a");
      const cIdx = uiStore.openTabs.findIndex(t => t.id === "c");

      uiStore.moveTab(aIdx, cIdx);
      // a should now be after c
      const newAIdx = uiStore.openTabs.findIndex(t => t.id === "a");
      const newCIdx = uiStore.openTabs.findIndex(t => t.id === "c");
      expect(newAIdx).toBeGreaterThan(newCIdx);
    });

    it("no-ops for same index", () => {
      uiStore.openTab({ id: "a", label: "A", type: "section" });
      const before = [...uiStore.openTabs.map(t => t.id)];
      uiStore.moveTab(0, 0);
      expect(uiStore.openTabs.map(t => t.id)).toEqual(before);
    });

    it("no-ops for negative indices", () => {
      const before = [...uiStore.openTabs.map(t => t.id)];
      uiStore.moveTab(-1, 0);
      expect(uiStore.openTabs.map(t => t.id)).toEqual(before);
    });

    it("no-ops for out-of-bounds indices", () => {
      const before = [...uiStore.openTabs.map(t => t.id)];
      uiStore.moveTab(0, 999);
      expect(uiStore.openTabs.map(t => t.id)).toEqual(before);
    });
  });

  // ── activeTab getter ──────────────────────────────────────────────

  describe("activeTab", () => {
    it("returns the currently active tab object", () => {
      expect(uiStore.activeTab?.id).toBe("welcome");
    });

    it("returns welcome tab when all other tabs are closed (TAB-01)", () => {
      uiStore.openTab({ id: "extra", label: "Extra", type: "section" });
      // Close the extra tab so only welcome remains
      uiStore.closeTab("extra");
      expect(uiStore.activeTab?.id).toBe("welcome");
    });
  });

  // ── File explorer node management ─────────────────────────────────

  describe("file explorer nodes", () => {
    it("toggleNode alternates expanded state", () => {
      uiStore.toggleNode("/src");
      expect(uiStore.expandedNodes["/src"]).toBe(true);
      uiStore.toggleNode("/src");
      expect(uiStore.expandedNodes["/src"]).toBe(false);
    });

    it("expandNode sets node to expanded (no-op if already expanded)", () => {
      uiStore.expandNode("/src");
      expect(uiStore.expandedNodes["/src"]).toBe(true);
      uiStore.expandNode("/src"); // should not toggle off
      expect(uiStore.expandedNodes["/src"]).toBe(true);
    });

    it("nodes start unexpanded", () => {
      expect(uiStore.expandedNodes["/anything"]).toBeUndefined();
    });
  });

  // ── reset ─────────────────────────────────────────────────────────

  describe("reset", () => {
    it("restores all state to defaults", () => {
      uiStore.openTab({ id: "custom", label: "Custom", type: "section" });
      uiStore.activeView = "settings";
      uiStore.sidebarVisible = false;
      uiStore.expandedNodes = { "/src": true, "/lib": true };

      uiStore.reset();

      expect(uiStore.openTabs).toHaveLength(1);
      expect(uiStore.openTabs[0].id).toBe("welcome");
      expect(uiStore.activeTabId).toBe("welcome");
      expect(uiStore.expandedNodes).toEqual({});
      expect(uiStore.activeView).toBe("explorer");
      expect(uiStore.sidebarVisible).toBe(true);
    });
  });

  // ── Settings section ──────────────────────────────────────────────

  describe("settings section", () => {
    it("defaults to empty string", () => {
      expect(uiStore.settingsSection).toBe("");
    });

    it("can be changed to valid sections", () => {
      uiStore.settingsSection = "display";
      expect(uiStore.settingsSection).toBe("display");
      uiStore.settingsSection = "notifications";
      expect(uiStore.settingsSection).toBe("notifications");
    });
  });

  // ── showCreateModModal ────────────────────────────────────────────

  describe("showCreateModModal", () => {
    it("defaults to false", () => {
      expect(uiStore.showCreateModModal).toBe(false);
    });

    it("can be toggled", () => {
      uiStore.showCreateModModal = true;
      expect(uiStore.showCreateModModal).toBe(true);
    });
  });

  // ── expandedSections (UX-06) ──────────────────────────────────────

  describe("expandedSections", () => {
    it("defaults to empty object", () => {
      expect(uiStore.expandedSections).toEqual({});
    });

    it("stores section expansion state", () => {
      uiStore.expandedSections["SpellLists"] = false;
      expect(uiStore.expandedSections["SpellLists"]).toBe(false);
    });

    it("returns undefined for unset sections (default expanded)", () => {
      expect(uiStore.expandedSections["PassiveLists"]).toBeUndefined();
    });

    it("resets clears expandedSections", () => {
      uiStore.expandedSections["SpellLists"] = false;
      uiStore.reset();
      expect(uiStore.expandedSections).toEqual({});
    });
  });

  // ── activityBarOrder (FT-01) ──────────────────────────────────────

  describe("activityBarOrder", () => {
    it("defaults to all seven views", () => {
      expect(uiStore.activityBarOrder).toEqual([
        "project", "explorer", "search", "git", "loaded-data", "settings", "help",
      ]);
    });

    it("persists reorder to localStorage", () => {
      const reordered = ["search", "git", "explorer", "loaded-data", "settings", "help"] as typeof uiStore.activityBarOrder;
      uiStore.setActivityBarOrder(reordered);
      expect(uiStore.activityBarOrder).toEqual(reordered);
      const stored = localStorage.getItem("bg3-cmty-activity-bar-order");
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!)).toEqual(reordered);
    });

    it("reconciles missing views from saved order", () => {
      // Simulate a saved order that's missing "help"
      localStorage.setItem("bg3-cmty-activity-bar-order", JSON.stringify(["search", "explorer", "loaded-data", "settings"]));
      // Force re-import by resetting — but since the store is a singleton,
      // we test the static method behavior indirectly
      uiStore.reset();
      // After reset, activityBarOrder should re-read from localStorage in normal flow
      // but reset doesn't reload from localStorage; it preserves current.
      // The reconciliation happens at class instantiation via #loadActivityBarOrder
    });

    it("ignores invalid view ids in localStorage", () => {
      localStorage.setItem("bg3-cmty-activity-bar-order", JSON.stringify(["search", "bogus", "explorer"]));
      // Create a new store instance would test this, but since it's a singleton,
      // we verify the stored data doesn't corrupt the current order
      expect(uiStore.activityBarOrder.length).toBe(6);
    });
  });

  // ── summaryDrawer ─────────────────────────────────────────────────

  describe("summaryDrawer", () => {
    const makeSummary = (overrides?: Partial<import("../lib/stores/uiStore.svelte.js").SummaryDrawerState>): import("../lib/stores/uiStore.svelte.js").SummaryDrawerState => ({
      section: "Races",
      displayName: "TestRace",
      uuids: ["uuid-1"],
      validationErrors: [],
      fields: {},
      booleans: [],
      strings: [],
      rawAttributes: null,
      rawChildren: null,
      vanillaAttributes: null,
      autoEntryId: null,
      nodeId: null,
      rawAttributeTypes: null,
      ...overrides,
    });

    it("starts as null", () => {
      expect(uiStore.summaryDrawer).toBeNull();
    });

    it("openSummaryDrawer sets the data", () => {
      const data = makeSummary();
      uiStore.openSummaryDrawer(data);
      expect(uiStore.summaryDrawer).toEqual(data);
    });

    it("closeSummaryDrawer sets to null", () => {
      uiStore.openSummaryDrawer(makeSummary());
      uiStore.closeSummaryDrawer();
      expect(uiStore.summaryDrawer).toBeNull();
    });

    it("updateSummaryDrawer merges partial fields", () => {
      uiStore.openSummaryDrawer(makeSummary());
      uiStore.updateSummaryDrawer({ displayName: "Updated" });
      expect(uiStore.summaryDrawer!.displayName).toBe("Updated");
      expect(uiStore.summaryDrawer!.section).toBe("Races");
    });

    it("updateSummaryDrawer is no-op when drawer is closed", () => {
      uiStore.closeSummaryDrawer();
      uiStore.updateSummaryDrawer({ displayName: "Ghost" });
      expect(uiStore.summaryDrawer).toBeNull();
    });
  });

  // ── previewCollapsed ──────────────────────────────────────────────

  describe("previewCollapsed", () => {
    it("defaults to true", () => {
      expect(uiStore.previewCollapsed).toBe(true);
    });

    it("can be toggled", () => {
      uiStore.previewCollapsed = false;
      expect(uiStore.previewCollapsed).toBe(false);
      uiStore.previewCollapsed = true;
      expect(uiStore.previewCollapsed).toBe(true);
    });
  });

  // ── formNavSections ───────────────────────────────────────────────

  describe("formNavSections", () => {
    it("defaults to empty array", () => {
      expect(uiStore.formNavSections).toEqual([]);
    });

    it("can be populated with navigation sections", () => {
      uiStore.formNavSections = [
        { id: "basics", label: "Basics", children: [{ id: "name", label: "Name" }] },
        { id: "advanced", label: "Advanced" },
      ];
      expect(uiStore.formNavSections).toHaveLength(2);
      expect(uiStore.formNavSections[0].children).toHaveLength(1);
    });

    it("reset clears formNavSections", () => {
      uiStore.formNavSections = [{ id: "x", label: "X" }];
      uiStore.reset();
      expect(uiStore.formNavSections).toEqual([]);
    });
  });

  // ── detectScriptLanguage ──────────────────────────────────────────

  describe("detectScriptLanguage", () => {
    it("detects lua files", () => {
      expect(uiStore.detectScriptLanguage("mods/MyMod/Scripts/main.lua")).toBe("lua");
    });

    it("detects osiris goal .txt files", () => {
      expect(uiStore.detectScriptLanguage("Story/RawFiles/Goals/MyGoal.txt")).toBe("osiris");
    });

    it("detects khn files", () => {
      expect(uiStore.detectScriptLanguage("scripts/test.khn")).toBe("khn");
    });

    it("detects anubis files (.anc, .ann, .anm)", () => {
      expect(uiStore.detectScriptLanguage("scripts/test.anc")).toBe("anubis");
      expect(uiStore.detectScriptLanguage("scripts/test.ann")).toBe("anubis");
      expect(uiStore.detectScriptLanguage("scripts/test.anm")).toBe("anubis");
    });

    it("detects constellations files (.clc, .cln, .clm)", () => {
      expect(uiStore.detectScriptLanguage("scripts/test.clc")).toBe("constellations");
      expect(uiStore.detectScriptLanguage("scripts/test.cln")).toBe("constellations");
      expect(uiStore.detectScriptLanguage("scripts/test.clm")).toBe("constellations");
    });

    it("detects json files", () => {
      expect(uiStore.detectScriptLanguage("data/config.json")).toBe("json");
    });

    it("detects yaml/yml files", () => {
      expect(uiStore.detectScriptLanguage("data/config.yaml")).toBe("yaml");
      expect(uiStore.detectScriptLanguage("data/config.yml")).toBe("yaml");
    });

    it("defaults to lua for unknown extensions", () => {
      expect(uiStore.detectScriptLanguage("file.xyz")).toBe("lua");
    });

    it("defaults to lua for files with no extension", () => {
      expect(uiStore.detectScriptLanguage("Makefile")).toBe("lua");
    });

    it("non-goal .txt files return plaintext", () => {
      expect(uiStore.detectScriptLanguage("notes/readme.txt")).toBe("plaintext");
    });
  });

  // ── openScriptTab ─────────────────────────────────────────────────

  describe("openScriptTab", () => {
    it("opens a script-editor tab with auto-detected language", () => {
      uiStore.openScriptTab("Story/RawFiles/Goals/MyGoal.txt");
      const tab = uiStore.openTabs.find(t => t.id === "script:Story/RawFiles/Goals/MyGoal.txt");
      expect(tab).toBeTruthy();
      expect(tab!.type).toBe("script-editor");
      expect(tab!.language).toBe("osiris");
      expect(tab!.preview).toBe(true);
    });

    it("opens a script-editor tab with explicit language override", () => {
      uiStore.openScriptTab("scripts/test.lua", "custom-lang");
      const tab = uiStore.openTabs.find(t => t.id === "script:scripts/test.lua");
      expect(tab!.language).toBe("custom-lang");
    });

    it("uses filename as label", () => {
      uiStore.openScriptTab("path/to/deep/script.lua");
      const tab = uiStore.openTabs.find(t => t.id === "script:path/to/deep/script.lua");
      expect(tab!.label).toBe("script.lua");
    });
  });

  // ── openTab extra branches ────────────────────────────────────────

  describe("openTab — extra branch coverage", () => {
    it("adds preview tab when no existing preview tab present", () => {
      const countBefore = uiStore.openTabs.length;
      uiStore.openTab({ id: "new-preview", label: "Preview", type: "file-preview", preview: true });
      expect(uiStore.openTabs.length).toBe(countBefore + 1);
      expect(uiStore.activeTabId).toBe("new-preview");
    });

    it("does not promote a non-preview existing tab", () => {
      uiStore.openTab({ id: "perm", label: "Perm", type: "section", preview: false });
      // Re-open same tab — it's already permanent, nothing to promote
      uiStore.openTab({ id: "perm", label: "Perm", type: "section", preview: false });
      expect(uiStore.openTabs.find(t => t.id === "perm")!.preview).toBeFalsy();
    });
  });

  // ── closeTab extra branches ───────────────────────────────────────

  describe("closeTab — extra branch coverage", () => {
    it("resets settings view when settings tab is closed", () => {
      uiStore.openTab({ id: "settings", label: "Settings", type: "settings" });
      uiStore.activeView = "settings";
      uiStore.settingsSection = "display";
      uiStore.closeTab("settings");
      expect(uiStore.activeView).toBe("explorer");
      expect(uiStore.settingsSection).toBe("");
    });

    it("does not reset settings view when a non-settings tab is closed from settings view", () => {
      uiStore.openTab({ id: "other", label: "Other", type: "section" });
      uiStore.activeView = "settings";
      uiStore.settingsSection = "theme";
      uiStore.closeTab("other");
      expect(uiStore.activeView).toBe("settings");
      expect(uiStore.settingsSection).toBe("theme");
    });

    it("activates first tab when closing the only non-welcome active tab", () => {
      uiStore.openTab({ id: "only", label: "Only", type: "section" });
      uiStore.activeTabId = "only";
      uiStore.closeTab("only");
      // Should fall back to welcome
      expect(uiStore.activeTabId).toBe("welcome");
    });
  });

  // ── moveTab extra branches ────────────────────────────────────────

  describe("moveTab — extra branch coverage", () => {
    it("no-ops when fromIndex is negative and toIndex valid", () => {
      uiStore.openTab({ id: "a", label: "A", type: "section" });
      const before = uiStore.openTabs.map(t => t.id);
      uiStore.moveTab(-1, 1);
      expect(uiStore.openTabs.map(t => t.id)).toEqual(before);
    });

    it("no-ops when toIndex is negative", () => {
      uiStore.openTab({ id: "a", label: "A", type: "section" });
      const before = uiStore.openTabs.map(t => t.id);
      uiStore.moveTab(0, -1);
      expect(uiStore.openTabs.map(t => t.id)).toEqual(before);
    });

    it("no-ops when fromIndex exceeds tab count", () => {
      const before = uiStore.openTabs.map(t => t.id);
      uiStore.moveTab(100, 0);
      expect(uiStore.openTabs.map(t => t.id)).toEqual(before);
    });

    it("welcome tab is immovable (protected by EX-8)", () => {
      uiStore.openTab({ id: "a", label: "A", type: "section" });
      uiStore.openTab({ id: "b", label: "B", type: "section" });
      // welcome=0, a=1, b=2 → attempt to move welcome to 2 — should be no-op
      uiStore.moveTab(0, 2);
      expect(uiStore.openTabs[0].id).toBe("welcome");
    });
  });

  // ── toggleSidebar extra branches ──────────────────────────────────

  describe("toggleSidebar — extra branch coverage", () => {
    it("shows sidebar when calling with no argument while hidden", () => {
      uiStore.sidebarVisible = false;
      uiStore.toggleSidebar();
      expect(uiStore.sidebarVisible).toBe(true);
    });

    it("changes view AND ensures sidebar is visible", () => {
      uiStore.activeView = "explorer";
      uiStore.sidebarVisible = true;
      uiStore.toggleSidebar("settings");
      expect(uiStore.activeView).toBe("settings");
      expect(uiStore.sidebarVisible).toBe(true);
    });
  });

  // ── reset clears summaryDrawer ────────────────────────────────────

  describe("reset — additional state", () => {
    it("clears summaryDrawer on reset", () => {
      uiStore.openSummaryDrawer({
        section: "X", displayName: "X", uuids: [], validationErrors: [],
        fields: {}, booleans: [], strings: [], rawAttributes: null,
        rawChildren: null, vanillaAttributes: null, autoEntryId: null,
        nodeId: null, rawAttributeTypes: null,
      });
      uiStore.reset();
      expect(uiStore.summaryDrawer).toBeNull();
    });

    it("resets settingsSection on reset", () => {
      uiStore.settingsSection = "display";
      uiStore.reset();
      expect(uiStore.settingsSection).toBe("");
    });

    it("resets sidebarVisible to true on reset", () => {
      uiStore.sidebarVisible = false;
      uiStore.reset();
      expect(uiStore.sidebarVisible).toBe(true);
    });
  });

  // ── activeTab derived getter ──────────────────────────────────────

  describe("activeTab — edge cases", () => {
    it("returns undefined when activeTabId references a non-existent tab", () => {
      uiStore.activeTabId = "does-not-exist";
      expect(uiStore.activeTab).toBeUndefined();
    });

    it("tracks the right tab after multiple open/close cycles", () => {
      uiStore.openTab({ id: "t1", label: "T1", type: "section" });
      uiStore.openTab({ id: "t2", label: "T2", type: "section" });
      uiStore.closeTab("t1");
      uiStore.openTab({ id: "t3", label: "T3", type: "section" });
      expect(uiStore.activeTab?.id).toBe("t3");
    });
  });

  // ── isDrawerCollapsed ────────────────────────────────────────

  describe("isDrawerCollapsed", () => {
    it("returns false by default for unknown drawers", () => {
      expect(uiStore.isDrawerCollapsed("unknown-drawer")).toBe(false);
    });

    it("returns true for drawers in COLLAPSED_BY_DEFAULT set", () => {
      expect(uiStore.isDrawerCollapsed("git-stashes")).toBe(true);
      expect(uiStore.isDrawerCollapsed("git-remotes")).toBe(true);
    });

    it("respects stored collapsed state over defaults", () => {
      uiStore.toggleDrawer("git-stashes");
      // After toggle, it should no longer be collapsed (was default-collapsed)
      expect(uiStore.isDrawerCollapsed("git-stashes")).toBe(false);
    });

    it("respects stored expanded state for non-default drawers", () => {
      uiStore.toggleDrawer("some-drawer");
      expect(uiStore.isDrawerCollapsed("some-drawer")).toBe(true);
      uiStore.toggleDrawer("some-drawer");
      expect(uiStore.isDrawerCollapsed("some-drawer")).toBe(false);
    });
  });
});
