/**
 * Tests for editor tab behavior: welcome tab protection, tab reordering
 * constraints, and additional tab lifecycle edge cases.
 *
 * Supplements uiStore.test.ts with focused tab-specific coverage.
 */
import { describe, it, expect, beforeEach } from "vitest";

const { uiStore } = await import("../lib/stores/uiStore.svelte.js");
type EditorTab = Parameters<typeof uiStore.openTab>[0];

describe("EditorTabs", () => {
  beforeEach(() => {
    uiStore.reset();
  });

  // ── Welcome tab protection ────────────────────────────────

  describe("welcome tab cannot be closed", () => {
    it("closeTab('welcome') is a no-op", () => {
      expect(uiStore.openTabs.find(t => t.id === "welcome")).toBeTruthy();
      const countBefore = uiStore.openTabs.length;

      uiStore.closeTab("welcome");

      expect(uiStore.openTabs.length).toBe(countBefore);
      expect(uiStore.openTabs.find(t => t.id === "welcome")).toBeTruthy();
    });

    it("closeTab('welcome') does not change activeTabId", () => {
      uiStore.activeTabId = "welcome";
      uiStore.closeTab("welcome");
      expect(uiStore.activeTabId).toBe("welcome");
    });

    it("welcome tab survives a closeAll-then-closeWelcome attempt", () => {
      uiStore.openTab({ id: "a", label: "A", type: "section" });
      uiStore.openTab({ id: "b", label: "B", type: "section" });

      // Close everything except welcome (which can't be closed)
      uiStore.closeTab("a");
      uiStore.closeTab("b");
      uiStore.closeTab("welcome");

      expect(uiStore.openTabs.some(t => t.id === "welcome")).toBe(true);
    });
  });

  // ── Welcome tab reorder constraints ───────────────────────

  describe("welcome tab reorder protection", () => {
    it("welcome tab cannot be moved from position 0", () => {
      uiStore.openTab({ id: "a", label: "A", type: "section" });
      uiStore.openTab({ id: "b", label: "B", type: "section" });

      // Attempt to move welcome (index 0) to index 2
      uiStore.moveTab(0, 2);

      // Welcome should still be at position 0
      expect(uiStore.openTabs[0].id).toBe("welcome");
    });

    it("other tabs cannot be moved to position 0 when welcome is there", () => {
      uiStore.openTab({ id: "a", label: "A", type: "section" });
      uiStore.openTab({ id: "b", label: "B", type: "section" });

      const aIdx = uiStore.openTabs.findIndex(t => t.id === "a");
      // Attempt to move tab "a" to position 0 (welcome's spot)
      uiStore.moveTab(aIdx, 0);

      // Welcome should still be first
      expect(uiStore.openTabs[0].id).toBe("welcome");
    });
  });

  // ── Tab lifecycle edge cases ──────────────────────────────

  describe("tab lifecycle", () => {
    it("closing last non-welcome tab brings back welcome", () => {
      // Remove welcome tab by closing all tabs
      uiStore.closeAllTabs();
      // Open a single tab
      uiStore.openTabs = [{ id: "only", label: "Only", type: "section" }];
      uiStore.activeTabId = "only";

      uiStore.closeTab("only");

      // Welcome should be restored
      expect(uiStore.openTabs).toHaveLength(1);
      expect(uiStore.openTabs[0].id).toBe("welcome");
      expect(uiStore.activeTabId).toBe("welcome");
    });

    it("closeAllTabs clears everything including welcome", () => {
      uiStore.openTab({ id: "a", label: "A", type: "section" });
      uiStore.closeAllTabs();

      expect(uiStore.openTabs).toHaveLength(0);
      expect(uiStore.activeTabId).toBe("");
    });

    it("opening duplicate tab does not increase tab count", () => {
      const tab: EditorTab = { id: "dup", label: "Dup", type: "section" };
      uiStore.openTab(tab);
      const count = uiStore.openTabs.length;
      uiStore.openTab(tab);
      expect(uiStore.openTabs.length).toBe(count);
    });

    it("opening a tab makes it active", () => {
      uiStore.openTab({ id: "tab-x", label: "X", type: "section" });
      expect(uiStore.activeTabId).toBe("tab-x");
    });

    it("closing active tab activates the next available tab", () => {
      uiStore.openTab({ id: "a", label: "A", type: "section" });
      uiStore.openTab({ id: "b", label: "B", type: "section" });
      uiStore.openTab({ id: "c", label: "C", type: "section" });
      uiStore.activeTabId = "b";

      uiStore.closeTab("b");
      // Should activate an adjacent tab, not "b"
      expect(uiStore.activeTabId).not.toBe("b");
      expect(uiStore.openTabs.find(t => t.id === uiStore.activeTabId)).toBeTruthy();
    });

    it("closing non-active tab preserves current activeTabId", () => {
      uiStore.openTab({ id: "a", label: "A", type: "section" });
      uiStore.openTab({ id: "b", label: "B", type: "section" });
      uiStore.activeTabId = "b";

      uiStore.closeTab("a");
      expect(uiStore.activeTabId).toBe("b");
    });

    it("tab with dirty flag is tracked", () => {
      uiStore.openTab({ id: "dirty-tab", label: "Dirty", type: "section", dirty: true });
      const tab = uiStore.openTabs.find(t => t.id === "dirty-tab");
      expect(tab?.dirty).toBe(true);
    });
  });

  // ── Tab movement with multiple tabs ───────────────────────

  describe("tab movement", () => {
    it("moving tab between two others reorders correctly", () => {
      uiStore.openTab({ id: "a", label: "A", type: "section" });
      uiStore.openTab({ id: "b", label: "B", type: "section" });
      uiStore.openTab({ id: "c", label: "C", type: "section" });
      // Tabs: welcome(0), a(1), b(2), c(3)

      // Move c to position 1 (between welcome and a)
      uiStore.moveTab(3, 1);
      expect(uiStore.openTabs[1].id).toBe("c");
    });

    it("moving to same position is a no-op", () => {
      uiStore.openTab({ id: "a", label: "A", type: "section" });
      const before = uiStore.openTabs.map(t => t.id);
      uiStore.moveTab(1, 1);
      expect(uiStore.openTabs.map(t => t.id)).toEqual(before);
    });
  });
});
