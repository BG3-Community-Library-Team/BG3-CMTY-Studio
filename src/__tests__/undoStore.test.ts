/**
 * undoStore tests — covers push, undo, redo, clear, stack limits,
 * label tracking, and edge cases (empty stacks, overflow).
 */
import { describe, it, expect, beforeEach } from "vitest";

const { undoStore } = await import("../lib/stores/undoStore.svelte.js");

describe("UndoStore", () => {
  beforeEach(() => {
    undoStore.clear();
  });

  // ── Basic push/undo/redo ──────────────────────────────────────────

  describe("push", () => {
    it("adds a command to the undo stack", () => {
      undoStore.push({ label: "test", undo: () => {}, redo: () => {} });
      expect(undoStore.canUndo).toBe(true);
      expect(undoStore.undoLabel).toBe("test");
    });

    it("clears the redo stack on push", async () => {
      undoStore.push({ label: "first", undo: () => {}, redo: () => {} });
      await undoStore.undo();
      expect(undoStore.canRedo).toBe(true);

      undoStore.push({ label: "second", undo: () => {}, redo: () => {} });
      expect(undoStore.canRedo).toBe(false);
    });
  });

  describe("undo", () => {
    it("calls the undo function and returns the label", async () => {
      let undone = false;
      undoStore.push({ label: "toggle", undo: () => { undone = true; }, redo: () => {} });
      const label = await undoStore.undo();
      expect(label).toBe("toggle");
      expect(undone).toBe(true);
    });

    it("returns null when stack is empty", async () => {
      expect(await undoStore.undo()).toBeNull();
    });

    it("moves command to redo stack", async () => {
      undoStore.push({ label: "test", undo: () => {}, redo: () => {} });
      await undoStore.undo();
      expect(undoStore.canUndo).toBe(false);
      expect(undoStore.canRedo).toBe(true);
      expect(undoStore.redoLabel).toBe("test");
    });

    it("processes multiple undos in LIFO order", async () => {
      const order: string[] = [];
      undoStore.push({ label: "first", undo: () => order.push("first"), redo: () => {} });
      undoStore.push({ label: "second", undo: () => order.push("second"), redo: () => {} });
      undoStore.push({ label: "third", undo: () => order.push("third"), redo: () => {} });

      await undoStore.undo();
      await undoStore.undo();
      await undoStore.undo();
      expect(order).toEqual(["third", "second", "first"]);
    });
  });

  describe("redo", () => {
    it("calls the redo function and returns the label", async () => {
      let redone = false;
      undoStore.push({ label: "toggle", undo: () => {}, redo: () => { redone = true; } });
      await undoStore.undo();
      const label = await undoStore.redo();
      expect(label).toBe("toggle");
      expect(redone).toBe(true);
    });

    it("returns null when redo stack is empty", async () => {
      expect(await undoStore.redo()).toBeNull();
    });

    it("moves command back to undo stack", async () => {
      undoStore.push({ label: "test", undo: () => {}, redo: () => {} });
      await undoStore.undo();
      await undoStore.redo();
      expect(undoStore.canUndo).toBe(true);
      expect(undoStore.canRedo).toBe(false);
    });

    it("supports multiple undo/redo cycles", async () => {
      let value = 0;
      undoStore.push({ label: "inc", undo: () => { value--; }, redo: () => { value++; } });
      value = 1; // simulate the "do" that happened before push

      await undoStore.undo(); // value = 0
      expect(value).toBe(0);
      await undoStore.redo(); // value = 1
      expect(value).toBe(1);
      await undoStore.undo(); // value = 0
      expect(value).toBe(0);
      await undoStore.redo(); // value = 1
      expect(value).toBe(1);
    });
  });

  // ── Stack limits ──────────────────────────────────────────────────

  describe("stack limits", () => {
    it("enforces MAX_UNDO = 50 — oldest commands are dropped", async () => {
      for (let i = 0; i < 60; i++) {
        undoStore.push({ label: `cmd-${i}`, undo: () => {}, redo: () => {} });
      }
      // Should have at most 50 items
      expect(undoStore.canUndo).toBe(true);
      expect(undoStore.undoLabel).toBe("cmd-59");

      // Undo 50 times — all should succeed
      let count = 0;
      while ((await undoStore.undo()) !== null) count++;
      expect(count).toBe(50);

      // The 51st should be null (oldest were trimmed)
      expect(await undoStore.undo()).toBeNull();
    });
  });

  // ── clear ─────────────────────────────────────────────────────────

  describe("clear", () => {
    it("empties both undo and redo stacks", async () => {
      undoStore.push({ label: "a", undo: () => {}, redo: () => {} });
      undoStore.push({ label: "b", undo: () => {}, redo: () => {} });
      await undoStore.undo(); // move b to redo

      undoStore.clear();
      expect(undoStore.canUndo).toBe(false);
      expect(undoStore.canRedo).toBe(false);
    });
  });

  // ── Labels ────────────────────────────────────────────────────────

  describe("labels", () => {
    it("undoLabel returns empty string when stack is empty", () => {
      expect(undoStore.undoLabel).toBe("");
    });

    it("redoLabel returns empty string when stack is empty", () => {
      expect(undoStore.redoLabel).toBe("");
    });

    it("labels reflect the top of each stack", async () => {
      undoStore.push({ label: "first", undo: () => {}, redo: () => {} });
      undoStore.push({ label: "second", undo: () => {}, redo: () => {} });
      expect(undoStore.undoLabel).toBe("second");

      await undoStore.undo();
      expect(undoStore.undoLabel).toBe("first");
      expect(undoStore.redoLabel).toBe("second");
    });
  });
});
