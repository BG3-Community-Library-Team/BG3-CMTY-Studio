import { describe, it, expect, vi, beforeEach } from "vitest";

// We need to mock settingsStore before importing motion
vi.mock("../lib/stores/settingsStore.svelte.js", () => ({
  settingsStore: {
    reducedMotion: "system" as "system" | "on" | "off",
  },
}));

import { getPrefersReducedMotion } from "../lib/stores/motion.svelte.js";
import { settingsStore } from "../lib/stores/settingsStore.svelte.js";

describe("getPrefersReducedMotion", () => {
  beforeEach(() => {
    (settingsStore as { reducedMotion: string }).reducedMotion = "system";
  });

  it("returns true when user preference is 'on'", () => {
    (settingsStore as { reducedMotion: string }).reducedMotion = "on";
    expect(getPrefersReducedMotion()).toBe(true);
  });

  it("returns false when user preference is 'off'", () => {
    (settingsStore as { reducedMotion: string }).reducedMotion = "off";
    expect(getPrefersReducedMotion()).toBe(false);
  });

  it("returns a boolean when user preference is 'system'", () => {
    (settingsStore as { reducedMotion: string }).reducedMotion = "system";
    const result = getPrefersReducedMotion();
    expect(typeof result).toBe("boolean");
  });
});
