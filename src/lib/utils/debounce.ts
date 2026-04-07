/**
 * Creates a debounced function that coalesces rapid calls.
 * Designed for reuse by ScriptEditorPanel (Sprint 19/R) with 300ms delay.
 */
export function createDebouncedWriter<T>(
  writer: (key: string, payload: T) => Promise<void>,
  delayMs: number,
): {
  /** Queue a write. Coalesces with pending write for the same key. */
  enqueue(key: string, payload: T): void;
  /** Flush all pending writes immediately. Returns when all complete. */
  flush(): Promise<void>;
  /** Cancel all pending writes without executing them. */
  cancel(): void;
  /** Whether any writes are pending. */
  readonly pending: boolean;
} {
  const pendingMap = new Map<string, { payload: T; timer: ReturnType<typeof setTimeout> }>();
  const inFlight = new Map<string, Promise<void>>();

  async function executeWrite(key: string, payload: T): Promise<void> {
    // If a write is already in flight for this key, wait for it first
    const existing = inFlight.get(key);
    if (existing) {
      await existing;
    }
    const promise = writer(key, payload);
    inFlight.set(key, promise);
    try {
      await promise;
    } finally {
      // Only clear if this is still the tracked promise (not replaced)
      if (inFlight.get(key) === promise) {
        inFlight.delete(key);
      }
    }
  }

  function enqueue(key: string, payload: T): void {
    const existing = pendingMap.get(key);
    if (existing) {
      clearTimeout(existing.timer);
    }
    const timer = setTimeout(() => {
      pendingMap.delete(key);
      executeWrite(key, payload);
    }, delayMs);
    pendingMap.set(key, { payload, timer });
  }

  async function flush(): Promise<void> {
    const entries = Array.from(pendingMap.entries());
    // Clear all timers first
    for (const [, { timer }] of entries) {
      clearTimeout(timer);
    }
    pendingMap.clear();

    // Execute all pending writes + wait for any in-flight writes
    const promises: Promise<void>[] = [];
    for (const [key, { payload }] of entries) {
      promises.push(executeWrite(key, payload));
    }
    for (const p of inFlight.values()) {
      promises.push(p);
    }
    await Promise.all(promises);
  }

  function cancel(): void {
    for (const [, { timer }] of pendingMap) {
      clearTimeout(timer);
    }
    pendingMap.clear();
  }

  return {
    enqueue,
    flush,
    cancel,
    get pending() {
      return pendingMap.size > 0;
    },
  };
}
