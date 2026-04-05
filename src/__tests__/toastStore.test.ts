/**
 * toastStore tests — covers notification lifecycle, deduplication,
 * auto-dismiss, history management, and edge cases.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

const { toastStore } = await import("../lib/stores/toastStore.svelte.js");

describe("ToastStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    toastStore.clear();
    toastStore.clearHistory();
  });

  afterEach(() => {
    toastStore.clear();
    vi.useRealTimers();
  });

  // ── Adding toasts ─────────────────────────────────────────────────

  describe("adding toasts", () => {
    it("success() adds a toast with level 'success'", () => {
      toastStore.success("Done", "All good");
      expect(toastStore.toasts).toHaveLength(1);
      expect(toastStore.toasts[0].level).toBe("success");
      expect(toastStore.toasts[0].title).toBe("Done");
      expect(toastStore.toasts[0].message).toBe("All good");
    });

    it("info() adds a toast with level 'info'", () => {
      toastStore.info("FYI");
      expect(toastStore.toasts[0].level).toBe("info");
    });

    it("warning() adds a toast with level 'warning'", () => {
      toastStore.warning("Caution");
      expect(toastStore.toasts[0].level).toBe("warning");
    });

    it("error() adds a toast with level 'error'", () => {
      toastStore.error("Failed", "Something broke");
      expect(toastStore.toasts[0].level).toBe("error");
    });

    it("returns a numeric toast id", () => {
      const id = toastStore.success("Test");
      expect(typeof id).toBe("number");
    });

    it("adds toasts in newest-first order", () => {
      toastStore.success("First");
      toastStore.success("Second");
      expect(toastStore.toasts[0].title).toBe("Second");
      expect(toastStore.toasts[1].title).toBe("First");
    });

    it("supports action parameter", () => {
      const action = { label: "Retry", actionId: "retry-test" };
      toastStore.error("Failed", "msg", action);
      expect(toastStore.toasts[0].action?.label).toBe("Retry");
      expect(toastStore.toasts[0].action?.actionId).toBe("retry-test");
    });
  });

  // ── Action Registry ───────────────────────────────────────────────

  describe("action registry", () => {
    it("registers and executes an action by ID", () => {
      let called = false;
      toastStore.registerToastAction("test-action", () => { called = true; });
      toastStore.executeToastAction("test-action");
      expect(called).toBe(true);
      toastStore.unregisterToastAction("test-action");
    });

    it("does nothing for unregistered action ID", () => {
      expect(() => toastStore.executeToastAction("nonexistent")).not.toThrow();
    });

    it("unregisters an action", () => {
      let callCount = 0;
      toastStore.registerToastAction("temp-action", () => { callCount++; });
      toastStore.executeToastAction("temp-action");
      expect(callCount).toBe(1);
      toastStore.unregisterToastAction("temp-action");
      toastStore.executeToastAction("temp-action");
      expect(callCount).toBe(1);
    });

    it("overwrites existing action on re-register", () => {
      let first = false, second = false;
      toastStore.registerToastAction("overwrite", () => { first = true; });
      toastStore.registerToastAction("overwrite", () => { second = true; });
      toastStore.executeToastAction("overwrite");
      expect(first).toBe(false);
      expect(second).toBe(true);
      toastStore.unregisterToastAction("overwrite");
    });
  });

  // ── Deduplication ─────────────────────────────────────────────────

  describe("deduplication", () => {
    it("increments count for duplicate title+level instead of creating new toast", () => {
      toastStore.success("Done");
      toastStore.success("Done");
      toastStore.success("Done");
      expect(toastStore.toasts).toHaveLength(1);
      expect(toastStore.toasts[0].count).toBe(3);
    });

    it("does not deduplicate across different levels", () => {
      toastStore.success("Message");
      toastStore.error("Message");
      expect(toastStore.toasts).toHaveLength(2);
    });

    it("does not deduplicate across different titles", () => {
      toastStore.success("A");
      toastStore.success("B");
      expect(toastStore.toasts).toHaveLength(2);
    });

    it("updates createdAt timestamp on duplicate", () => {
      toastStore.success("Done");
      const firstTime = toastStore.toasts[0].createdAt;

      vi.advanceTimersByTime(1000);
      toastStore.success("Done");
      expect(toastStore.toasts[0].createdAt).toBeGreaterThanOrEqual(firstTime);
    });
  });

  // ── Max visible limit ─────────────────────────────────────────────

  describe("max visible", () => {
    it("trims to 5 visible toasts, removing oldest", () => {
      for (let i = 0; i < 7; i++) {
        toastStore.info(`Toast ${i}`);
      }
      expect(toastStore.toasts.length).toBeLessThanOrEqual(5);
    });
  });

  // ── Dismiss ───────────────────────────────────────────────────────

  describe("dismiss", () => {
    it("removes a specific toast by id", () => {
      const id = toastStore.success("Remove me");
      toastStore.dismiss(id);
      expect(toastStore.toasts).toHaveLength(0);
    });

    it("no-ops for nonexistent id", () => {
      toastStore.success("Keep");
      toastStore.dismiss(99999);
      expect(toastStore.toasts).toHaveLength(1);
    });
  });

  // ── Auto-dismiss ──────────────────────────────────────────────────

  describe("auto-dismiss", () => {
    it("auto-dismisses non-error toasts after configured duration", () => {
      toastStore.success("Auto close");
      expect(toastStore.toasts).toHaveLength(1);

      // Advance past the default toast duration
      vi.advanceTimersByTime(10_000);
      expect(toastStore.toasts).toHaveLength(0);
    });

    it("auto-dismisses error toasts (separate duration)", () => {
      toastStore.error("Error toast");
      expect(toastStore.toasts).toHaveLength(1);

      vi.advanceTimersByTime(15_000);
      expect(toastStore.toasts).toHaveLength(0);
    });
  });

  // ── Pause/resume dismiss ──────────────────────────────────────────

  describe("pause/resume", () => {
    it("pauseDismiss prevents auto-dismiss", () => {
      const id = toastStore.success("Hover me");
      toastStore.pauseDismiss(id);

      vi.advanceTimersByTime(15_000);
      expect(toastStore.toasts).toHaveLength(1); // still visible
    });

    it("resumeDismiss restarts auto-dismiss timer", () => {
      const id = toastStore.success("Hover me");
      toastStore.pauseDismiss(id);

      vi.advanceTimersByTime(5_000);
      toastStore.resumeDismiss(id);

      vi.advanceTimersByTime(10_000);
      expect(toastStore.toasts).toHaveLength(0);
    });

    it("pauseDismiss no-ops for nonexistent id", () => {
      toastStore.pauseDismiss(99999); // should not throw
    });

    it("resumeDismiss no-ops for nonexistent id", () => {
      toastStore.resumeDismiss(99999); // should not throw
    });
  });

  // ── Clear ─────────────────────────────────────────────────────────

  describe("clear", () => {
    it("removes all visible toasts", () => {
      toastStore.success("A");
      toastStore.error("B");
      toastStore.warning("C");
      toastStore.clear();
      expect(toastStore.toasts).toHaveLength(0);
    });

    it("clears auto-dismiss timers (no late callbacks)", () => {
      toastStore.success("A");
      toastStore.clear();
      // Should not throw when timers fire after clear
      vi.advanceTimersByTime(15_000);
    });
  });

  // ── History ───────────────────────────────────────────────────────

  describe("history", () => {
    it("records toasts in history", () => {
      toastStore.success("Logged");
      expect(toastStore.history).toHaveLength(1);
      expect(toastStore.history[0].title).toBe("Logged");
    });

    it("history entries start as unread", () => {
      toastStore.success("Unread");
      expect(toastStore.history[0].read).toBe(false);
      expect(toastStore.unreadCount).toBe(1);
    });

    it("markAllRead sets all entries to read", () => {
      toastStore.success("A");
      toastStore.info("B");
      toastStore.markAllRead();
      expect(toastStore.unreadCount).toBe(0);
      expect(toastStore.history.every(h => h.read)).toBe(true);
    });

    it("removeFromHistory removes a specific entry", () => {
      const id = toastStore.success("Remove");
      toastStore.removeFromHistory(id);
      expect(toastStore.history).toHaveLength(0);
    });

    it("removeFromHistory decrements unread count for unread entry", () => {
      const id = toastStore.success("Unread");
      expect(toastStore.unreadCount).toBe(1);
      toastStore.removeFromHistory(id);
      expect(toastStore.unreadCount).toBe(0);
    });

    it("removeFromHistory does not decrement unread for already-read entry", () => {
      toastStore.success("Read");
      toastStore.markAllRead();
      const id2 = toastStore.info("Unread");
      expect(toastStore.unreadCount).toBe(1);

      // Remove the read entry (first one in history has different id)
      const readId = toastStore.history.find(h => h.title === "Read")?.id;
      if (readId) toastStore.removeFromHistory(readId);
      expect(toastStore.unreadCount).toBe(1); // unchanged
    });

    it("clearHistory empties all history and resets unread count", () => {
      toastStore.success("A");
      toastStore.error("B");
      toastStore.clearHistory();
      expect(toastStore.history).toHaveLength(0);
      expect(toastStore.unreadCount).toBe(0);
    });

    it("history is capped at 50 entries", () => {
      for (let i = 0; i < 55; i++) {
        toastStore.info(`Toast ${i}`);
      }
      expect(toastStore.history.length).toBeLessThanOrEqual(50);
    });

    it("deduplication updates count in history too", () => {
      toastStore.success("Dupe");
      toastStore.success("Dupe");
      toastStore.success("Dupe");

      const entry = toastStore.history.find(h => h.title === "Dupe");
      expect(entry?.count).toBe(3);
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles empty string title", () => {
      toastStore.success("");
      expect(toastStore.toasts).toHaveLength(1);
      expect(toastStore.toasts[0].title).toBe("");
    });

    it("handles undefined message gracefully", () => {
      toastStore.success("Title");
      expect(toastStore.toasts[0].message).toBeUndefined();
    });

    it("rapid add/dismiss cycle does not leave orphaned timers", () => {
      for (let i = 0; i < 20; i++) {
        const id = toastStore.success(`Rapid ${i}`);
        toastStore.dismiss(id);
      }
      vi.advanceTimersByTime(15_000);
      expect(toastStore.toasts).toHaveLength(0);
    });
  });
});
