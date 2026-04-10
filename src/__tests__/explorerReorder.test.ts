/**
 * Tests for explorer node reorder, pin-to-top, and getOrderedNodes logic.
 * Exercises uiStore's explorerNodeOrder management.
 */
import { describe, it, expect, beforeEach } from "vitest";

const { uiStore } = await import("../lib/stores/uiStore.svelte.js");

describe("Explorer Reorder (uiStore node ordering)", () => {
  beforeEach(() => {
    uiStore.reset();
    localStorage.clear();
  });

  // ── getOrderedNodes ───────────────────────────────────────

  describe("getOrderedNodes", () => {
    it("returns defaultIds when no custom state exists", () => {
      const result = uiStore.getOrderedNodes("drawer1", ["a", "b", "c"]);
      expect(result).toEqual(["a", "b", "c"]);
    });

    it("returns pinned nodes first", () => {
      uiStore.pinNode("drawer1", "c");
      const result = uiStore.getOrderedNodes("drawer1", ["a", "b", "c"]);
      expect(result[0]).toBe("c");
      expect(result).toContain("a");
      expect(result).toContain("b");
    });

    it("preserves custom order for non-pinned nodes", () => {
      uiStore.reorderNode("drawer1", "b", "a", "before");
      const result = uiStore.getOrderedNodes("drawer1", ["a", "b", "c"]);
      // b should appear before a in the ordered portion
      const bIdx = result.indexOf("b");
      const aIdx = result.indexOf("a");
      expect(bIdx).toBeLessThan(aIdx);
    });

    it("pinned + custom ordered + remaining", () => {
      uiStore.pinNode("drawer1", "d");
      uiStore.reorderNode("drawer1", "c", "a", "before");
      const result = uiStore.getOrderedNodes("drawer1", ["a", "b", "c", "d"]);
      // d is pinned, so first
      expect(result[0]).toBe("d");
      // After that, the ordered nodes (c, a) should appear, then unordered (b)
      expect(result).toHaveLength(4);
    });

    it("excludes IDs not in defaultIds from result", () => {
      uiStore.pinNode("drawer1", "ghost");
      const result = uiStore.getOrderedNodes("drawer1", ["a", "b"]);
      expect(result).not.toContain("ghost");
      expect(result).toEqual(["a", "b"]);
    });

    it("handles multiple pinned nodes", () => {
      uiStore.pinNode("drawer1", "b");
      uiStore.pinNode("drawer1", "c");
      const result = uiStore.getOrderedNodes("drawer1", ["a", "b", "c", "d"]);
      expect(result[0]).toBe("b");
      expect(result[1]).toBe("c");
    });
  });

  // ── pinNode / unpinNode ───────────────────────────────────

  describe("pinNode / unpinNode", () => {
    it("pinning adds to pinned array", () => {
      uiStore.pinNode("drawer1", "node-x");
      expect(uiStore.isNodePinned("drawer1", "node-x")).toBe(true);
    });

    it("unpinning removes from pinned array", () => {
      uiStore.pinNode("drawer1", "node-x");
      uiStore.unpinNode("drawer1", "node-x");
      expect(uiStore.isNodePinned("drawer1", "node-x")).toBe(false);
    });

    it("pinning already-pinned node is idempotent", () => {
      uiStore.pinNode("drawer1", "node-x");
      uiStore.pinNode("drawer1", "node-x");
      const state = uiStore.explorerNodeOrder["drawer1"];
      expect(state.pinned.filter((id: string) => id === "node-x")).toHaveLength(1);
    });

    it("unpinning not-pinned node is safe (no-op)", () => {
      uiStore.unpinNode("drawer1", "not-pinned");
      // Should not throw
      expect(uiStore.isNodePinned("drawer1", "not-pinned")).toBe(false);
    });

    it("pinning persists to localStorage", () => {
      uiStore.pinNode("drawer1", "node-y");
      const stored = localStorage.getItem("bg3-cmty-explorer-node-order");
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed["drawer1"].pinned).toContain("node-y");
    });

    it("isNodePinned returns false for unknown drawer", () => {
      expect(uiStore.isNodePinned("nonexistent", "any")).toBe(false);
    });
  });

  // ── reorderNode ───────────────────────────────────────────

  describe("reorderNode", () => {
    it("preserves relative placement when the first reorder seeds an empty order list", () => {
      uiStore.reorderNode("drawer1", "c", "b", "after");

      const state = uiStore.explorerNodeOrder["drawer1"];
      expect(state.order).toEqual(["b", "c"]);
      expect(uiStore.getOrderedNodes("drawer1", ["a", "b", "c", "d"])).toEqual(["b", "c", "a", "d"]);
    });

    it("moves a node before another in unpinned list", () => {
      // Establish initial order
      uiStore.reorderNode("drawer1", "a", "b", "before");
      uiStore.reorderNode("drawer1", "c", "a", "after");

      const state = uiStore.explorerNodeOrder["drawer1"];
      const aIdx = state.order.indexOf("a");
      const cIdx = state.order.indexOf("c");
      // c should be right after a
      expect(cIdx).toBe(aIdx + 1);
    });

    it("moves a node after another in unpinned list", () => {
      uiStore.reorderNode("drawer1", "a", "x", "after");
      const state = uiStore.explorerNodeOrder["drawer1"];
      // Both should be in the order list
      expect(state.order).toContain("a");
    });

    it("moves within pinned group", () => {
      uiStore.pinNode("drawer1", "p1");
      uiStore.pinNode("drawer1", "p2");
      uiStore.pinNode("drawer1", "p3");

      uiStore.reorderNode("drawer1", "p3", "p1", "before");
      const state = uiStore.explorerNodeOrder["drawer1"];
      expect(state.pinned.indexOf("p3")).toBeLessThan(state.pinned.indexOf("p1"));
    });

    it("cross-zone drag (pinned↔unpinned) is a no-op for ordering", () => {
      uiStore.pinNode("drawer1", "pinned-node");
      // Drag pinned node to an unpinned node — should not reorder
      uiStore.reorderNode("drawer1", "pinned-node", "unpinned-node", "before");
      // pinned-node should still be pinned
      expect(uiStore.isNodePinned("drawer1", "pinned-node")).toBe(true);
    });

    it("reorder persists to localStorage", () => {
      uiStore.reorderNode("drawer1", "a", "b", "before");
      const stored = localStorage.getItem("bg3-cmty-explorer-node-order");
      expect(stored).toBeTruthy();
    });
  });
});
