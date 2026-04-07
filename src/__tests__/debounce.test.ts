import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createDebouncedWriter } from "../lib/utils/debounce.js";

describe("createDebouncedWriter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeWriter() {
    const calls: Array<{ key: string; payload: string }> = [];
    const writer = vi.fn(async (key: string, payload: string) => {
      calls.push({ key, payload });
    });
    return { writer, calls };
  }

  // ── enqueue() basic behavior ───────────────────────────

  describe("enqueue()", () => {
    it("executes the writer after the delay", async () => {
      const { writer } = makeWriter();
      const dw = createDebouncedWriter(writer, 300);

      dw.enqueue("file1", "content1");
      expect(writer).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(300);
      expect(writer).toHaveBeenCalledOnce();
      expect(writer).toHaveBeenCalledWith("file1", "content1");
    });

    it("does not execute before the delay elapses", async () => {
      const { writer } = makeWriter();
      const dw = createDebouncedWriter(writer, 500);

      dw.enqueue("k", "v");
      await vi.advanceTimersByTimeAsync(499);
      expect(writer).not.toHaveBeenCalled();
    });

    it("coalesces rapid calls for the same key (only last payload wins)", async () => {
      const { writer } = makeWriter();
      const dw = createDebouncedWriter(writer, 200);

      dw.enqueue("k", "first");
      await vi.advanceTimersByTimeAsync(50);
      dw.enqueue("k", "second");
      await vi.advanceTimersByTimeAsync(50);
      dw.enqueue("k", "third");

      await vi.advanceTimersByTimeAsync(200);
      expect(writer).toHaveBeenCalledOnce();
      expect(writer).toHaveBeenCalledWith("k", "third");
    });

    it("queues independent keys separately", async () => {
      const { writer } = makeWriter();
      const dw = createDebouncedWriter(writer, 100);

      dw.enqueue("a", "dataA");
      dw.enqueue("b", "dataB");

      await vi.advanceTimersByTimeAsync(100);
      expect(writer).toHaveBeenCalledTimes(2);
      expect(writer).toHaveBeenCalledWith("a", "dataA");
      expect(writer).toHaveBeenCalledWith("b", "dataB");
    });

    it("resets the timer on subsequent calls for the same key", async () => {
      const { writer } = makeWriter();
      const dw = createDebouncedWriter(writer, 200);

      dw.enqueue("k", "v1");
      await vi.advanceTimersByTimeAsync(150);
      // Re-enqueue resets the 200ms timer
      dw.enqueue("k", "v2");
      await vi.advanceTimersByTimeAsync(150);
      // Only 150ms since last enqueue — should not have fired yet
      expect(writer).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(50);
      expect(writer).toHaveBeenCalledOnce();
      expect(writer).toHaveBeenCalledWith("k", "v2");
    });
  });

  // ── pending ────────────────────────────────────────────

  describe("pending", () => {
    it("is false when nothing is enqueued", () => {
      const { writer } = makeWriter();
      const dw = createDebouncedWriter(writer, 100);
      expect(dw.pending).toBe(false);
    });

    it("is true when a write is enqueued", () => {
      const { writer } = makeWriter();
      const dw = createDebouncedWriter(writer, 100);
      dw.enqueue("k", "v");
      expect(dw.pending).toBe(true);
    });

    it("becomes false after the timer fires", async () => {
      const { writer } = makeWriter();
      const dw = createDebouncedWriter(writer, 100);
      dw.enqueue("k", "v");
      await vi.advanceTimersByTimeAsync(100);
      expect(dw.pending).toBe(false);
    });
  });

  // ── cancel() ───────────────────────────────────────────

  describe("cancel()", () => {
    it("prevents pending writes from executing", async () => {
      const { writer } = makeWriter();
      const dw = createDebouncedWriter(writer, 200);

      dw.enqueue("k", "v");
      expect(dw.pending).toBe(true);
      dw.cancel();
      expect(dw.pending).toBe(false);

      await vi.advanceTimersByTimeAsync(300);
      expect(writer).not.toHaveBeenCalled();
    });

    it("cancels all pending keys", async () => {
      const { writer } = makeWriter();
      const dw = createDebouncedWriter(writer, 200);

      dw.enqueue("a", "1");
      dw.enqueue("b", "2");
      dw.enqueue("c", "3");
      dw.cancel();

      await vi.advanceTimersByTimeAsync(300);
      expect(writer).not.toHaveBeenCalled();
    });

    it("is idempotent (double cancel is safe)", () => {
      const { writer } = makeWriter();
      const dw = createDebouncedWriter(writer, 100);
      dw.enqueue("k", "v");
      dw.cancel();
      dw.cancel();
      expect(dw.pending).toBe(false);
    });
  });

  // ── flush() ────────────────────────────────────────────

  describe("flush()", () => {
    it("executes all pending writes immediately", async () => {
      const { writer } = makeWriter();
      const dw = createDebouncedWriter(writer, 5000);

      dw.enqueue("a", "A");
      dw.enqueue("b", "B");

      await dw.flush();
      expect(writer).toHaveBeenCalledTimes(2);
      expect(writer).toHaveBeenCalledWith("a", "A");
      expect(writer).toHaveBeenCalledWith("b", "B");
    });

    it("clears pending state after flush", async () => {
      const { writer } = makeWriter();
      const dw = createDebouncedWriter(writer, 5000);

      dw.enqueue("k", "v");
      expect(dw.pending).toBe(true);
      await dw.flush();
      expect(dw.pending).toBe(false);
    });

    it("is a no-op when nothing is pending", async () => {
      const { writer } = makeWriter();
      const dw = createDebouncedWriter(writer, 100);
      await dw.flush(); // Should not throw
      expect(writer).not.toHaveBeenCalled();
    });

    it("waits for in-flight writes to complete", async () => {
      const resolvers: Array<() => void> = [];
      const writer = vi.fn(
        () => new Promise<void>((resolve) => { resolvers.push(resolve); }),
      );
      const dw = createDebouncedWriter(writer, 100);

      dw.enqueue("k", "v");
      await vi.advanceTimersByTimeAsync(100);
      // Writer has been called but the promise is pending
      expect(writer).toHaveBeenCalledOnce();

      // Enqueue another and flush
      dw.enqueue("k2", "v2");
      const flushPromise = dw.flush();
      // Resolve ALL in-flight writes (first + second)
      for (const r of resolvers) r();
      await flushPromise;
      expect(writer).toHaveBeenCalledTimes(2);
    });
  });

  // ── in-flight queuing ──────────────────────────────────

  describe("in-flight write handling", () => {
    it("waits for existing in-flight write before executing a new one for same key", async () => {
      const order: string[] = [];
      let resolveFirst!: () => void;
      const writer = vi.fn((key: string, payload: string) => {
        if (payload === "first") {
          return new Promise<void>((resolve) => {
            resolveFirst = () => { order.push("first-done"); resolve(); };
          });
        }
        order.push("second-done");
        return Promise.resolve();
      });

      const dw = createDebouncedWriter(writer, 50);

      // First enqueue fires after 50ms
      dw.enqueue("k", "first");
      await vi.advanceTimersByTimeAsync(50);
      expect(writer).toHaveBeenCalledWith("k", "first");

      // Second enqueue for same key while first is in-flight
      dw.enqueue("k", "second");
      await vi.advanceTimersByTimeAsync(50);

      // Resolve first write
      resolveFirst();
      await vi.advanceTimersByTimeAsync(0);
      // Allow microtasks
      await Promise.resolve();
      await Promise.resolve();

      expect(order[0]).toBe("first-done");
    });
  });
});
