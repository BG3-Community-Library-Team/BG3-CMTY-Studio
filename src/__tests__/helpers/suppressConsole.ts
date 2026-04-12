import { vi, beforeEach, afterEach, expect } from "vitest";

type ConsoleSpy = ReturnType<typeof vi.spyOn>;

/**
 * Suppress `console.error` (or `.warn`) in tests that intentionally trigger
 * error paths. Returns the spy so callers can assert on it.
 *
 * Best practice for unhappy-path tests (Option 3):
 *   1. Mock `console.error` to silence noisy stack traces
 *   2. Assert the mock was called with the expected message
 *   3. Restore the mock so subsequent tests see real errors
 *
 * Usage — scoped to a describe block:
 * ```ts
 * describe("error handling", () => {
 *   const consoleSpy = suppressConsoleError();
 *
 *   it("logs on failure", () => {
 *     doThing();
 *     expectConsoleCalled(consoleSpy, "expected message");
 *   });
 * });
 * ```
 *
 * Usage — inline in a single test:
 * ```ts
 * it("handles bad input", () => {
 *   const spy = mockConsoleError();
 *   doThing();
 *   expectConsoleCalled({ spy }, "expected message");
 *   spy.mockRestore();
 * });
 * ```
 */
export function suppressConsoleError(): { spy: ConsoleSpy } {
  const ref: { spy: ConsoleSpy } = { spy: undefined! };

  beforeEach(() => {
    ref.spy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    ref.spy.mockRestore();
  });

  return ref;
}

export function suppressConsoleWarn(): { spy: ConsoleSpy } {
  const ref: { spy: ConsoleSpy } = { spy: undefined! };

  beforeEach(() => {
    ref.spy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    ref.spy.mockRestore();
  });

  return ref;
}

/** Inline mock (for single-test usage). Caller must call `spy.mockRestore()` when done. */
export function mockConsoleError(): ConsoleSpy {
  return vi.spyOn(console, "error").mockImplementation(() => {});
}

export function mockConsoleWarn(): ConsoleSpy {
  return vi.spyOn(console, "warn").mockImplementation(() => {});
}

/**
 * Assert that a console spy was called with a message matching the given substring.
 * Accepts either the ref object from `suppressConsole*()` or a bare spy.
 */
export function expectConsoleCalled(
  spyOrRef: ConsoleSpy | { spy: ConsoleSpy },
  substring: string,
): void {
  const spy = "spy" in spyOrRef ? spyOrRef.spy : spyOrRef;
  expect(spy).toHaveBeenCalled();
  const allArgs = spy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");
  expect(allArgs).toContain(substring);
}
