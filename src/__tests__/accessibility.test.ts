/**
 * TC-015: Reduced Motion Tests
 *
 * Verifies getPrefersReducedMotion() correctly combines the OS-level
 * prefers-reduced-motion media query with the user-toggleable setting.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// Polyfill localStorage for node test environment
if (typeof globalThis.localStorage === "undefined") {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    get length() { return store.size; },
    key: (i: number) => [...store.keys()][i] ?? null,
  };
}

// ── Mock matchMedia ──────────────────────────────────────────────────
// motion.svelte.ts reads window.matchMedia at module load time,
// so we must set up the mock before importing the module.

let mockMatches = false;
let changeHandler: ((e: { matches: boolean }) => void) | null = null;

// Polyfill window for node test environment
if (typeof globalThis.window === "undefined") {
  (globalThis as any).window = {};
}

(globalThis.window as any).matchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: mockMatches,
  media: query,
  addEventListener: (_event: string, handler: (e: { matches: boolean }) => void) => {
    changeHandler = handler;
  },
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

// Import after matchMedia is set up
const { settingsStore } = await import("../lib/stores/settingsStore.svelte.js");
const { getPrefersReducedMotion } = await import("../lib/stores/motion.svelte.js");

describe("TC-015: getPrefersReducedMotion", () => {
  beforeEach(() => {
    // Reset to defaults
    settingsStore.reducedMotion = "system";
    mockMatches = false;
  });

  // ── User preference: "on" (always reduce) ─────────────────────

  it("returns true when user setting is 'on', regardless of OS preference", () => {
    settingsStore.reducedMotion = "on";
    mockMatches = false;
    expect(getPrefersReducedMotion()).toBe(true);
  });

  it("returns true when user setting is 'on' even if OS also says reduce", () => {
    settingsStore.reducedMotion = "on";
    mockMatches = true;
    expect(getPrefersReducedMotion()).toBe(true);
  });

  // ── User preference: "off" (never reduce) ─────────────────────

  it("returns false when user setting is 'off', regardless of OS preference", () => {
    settingsStore.reducedMotion = "off";
    mockMatches = true;
    expect(getPrefersReducedMotion()).toBe(false);
  });

  it("returns false when user setting is 'off' and OS does not prefer reduced", () => {
    settingsStore.reducedMotion = "off";
    mockMatches = false;
    expect(getPrefersReducedMotion()).toBe(false);
  });

  // ── User preference: "system" (follow OS) ─────────────────────

  it("returns false when user setting is 'system' and OS does not prefer reduced", () => {
    settingsStore.reducedMotion = "system";
    // The module-level mql was created with mockMatches = false
    expect(getPrefersReducedMotion()).toBe(false);
  });

  it("returns true when user setting is 'system' and OS change event fires with matches=true", () => {
    settingsStore.reducedMotion = "system";
    // Simulate OS preference change
    if (changeHandler) {
      changeHandler({ matches: true });
    }
    expect(getPrefersReducedMotion()).toBe(true);
  });

  it("returns false after OS change event fires with matches=false", () => {
    settingsStore.reducedMotion = "system";
    // First set to true
    if (changeHandler) {
      changeHandler({ matches: true });
    }
    expect(getPrefersReducedMotion()).toBe(true);
    // Then set back to false
    if (changeHandler) {
      changeHandler({ matches: false });
    }
    expect(getPrefersReducedMotion()).toBe(false);
  });

  // ── Edge case: unknown setting value ───────────────────────────

  it("treats unknown setting value as 'system' (falls through to OS preference)", () => {
    (settingsStore as any).reducedMotion = "invalid-value";
    // Neither "on" nor "off" → falls to OS preference (currently false)
    expect(getPrefersReducedMotion()).toBe(false);
  });
});
