/**
 * Theme contrast-ratio validation — verifies all built-in themes meet
 * WCAG 2.1 AA contrast requirements for text/background pairs.
 */
import { describe, it, expect } from "vitest";
import { THEME_TOKENS } from "../lib/themes/themeTokens.js";
import type { ThemeTokenKey } from "../lib/themes/themeTokens.js";
import type { ThemeId } from "../lib/themes/themeManager.js";
import {
  parseHexColor,
  relativeLuminance,
  computeContrastRatio,
} from "../lib/utils/colorContrast.js";

// ---------------------------------------------------------------------------
// Contrast pair definitions
// ---------------------------------------------------------------------------

interface ContrastPair {
  fg: ThemeTokenKey;
  bg: ThemeTokenKey;
  minRatio: number; // 4.5 = AA normal, 3.0 = AA large text
  label: string;
}

const CONTRAST_PAIRS: ContrastPair[] = [
  // Primary text on surfaces (AA normal — 4.5:1)
  { fg: "--th-text-100", bg: "--th-bg-950", minRatio: 4.5, label: "text-100 on bg-950" },
  { fg: "--th-text-100", bg: "--th-bg-900", minRatio: 4.5, label: "text-100 on bg-900" },
  { fg: "--th-text-200", bg: "--th-bg-900", minRatio: 4.5, label: "text-200 on bg-900" },
  { fg: "--th-text-200", bg: "--th-bg-800", minRatio: 4.5, label: "text-200 on bg-800" },

  // Secondary text (AA large — 3.0:1)
  { fg: "--th-text-400", bg: "--th-bg-900", minRatio: 3.0, label: "text-400 on bg-900 (large)" },
  { fg: "--th-text-500", bg: "--th-bg-900", minRatio: 3.0, label: "text-500 on bg-900 (large)" },

  // Input text (AA normal — 4.5:1)
  { fg: "--th-input-text", bg: "--th-input-bg", minRatio: 4.5, label: "input text on input bg" },

  // Card text on card backgrounds (4.5:1 / 3.0:1)
  { fg: "--th-text-200", bg: "--th-card-bg", minRatio: 4.5, label: "text-200 on card-bg" },
  { fg: "--th-text-400", bg: "--th-card-header-bg", minRatio: 3.0, label: "text-400 on card-header-bg" },

  // Accent text on main background (AA large — 3.0:1)
  { fg: "--th-text-red-400", bg: "--th-bg-900", minRatio: 3.0, label: "red-400 on bg-900" },
  { fg: "--th-text-sky-400", bg: "--th-bg-900", minRatio: 3.0, label: "sky-400 on bg-900" },
  { fg: "--th-text-emerald-400", bg: "--th-bg-900", minRatio: 3.0, label: "emerald-400 on bg-900" },
  { fg: "--th-text-amber-400", bg: "--th-bg-900", minRatio: 3.0, label: "amber-400 on bg-900" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check if a CSS value is a parseable solid color (hex or rgb/rgba). */
function isSolidColor(value: string): boolean {
  const v = value.trim();
  if (v.startsWith("#")) return true;
  if (/^rgb\(/.test(v)) return true;
  // rgba with alpha < 1 is semi-transparent — we can still parse the RGB channels
  if (/^rgba\(/.test(v)) return true;
  return /^[0-9a-fA-F]{3,6}$/.test(v);
}

// ---------------------------------------------------------------------------
// Unit tests for the contrast utility itself
// ---------------------------------------------------------------------------

describe("colorContrast utilities", () => {
  describe("parseHexColor", () => {
    it("parses 6-digit hex with #", () => {
      expect(parseHexColor("#ff8800")).toEqual([255, 136, 0]);
    });

    it("parses 6-digit hex without #", () => {
      expect(parseHexColor("ff8800")).toEqual([255, 136, 0]);
    });

    it("parses 3-digit hex", () => {
      expect(parseHexColor("#f80")).toEqual([255, 136, 0]);
    });

    it("parses rgb() with commas", () => {
      expect(parseHexColor("rgb(39, 39, 42)")).toEqual([39, 39, 42]);
    });

    it("parses rgb() with spaces (CSS modern)", () => {
      expect(parseHexColor("rgb(39 39 42)")).toEqual([39, 39, 42]);
    });

    it("parses rgba() and strips alpha", () => {
      expect(parseHexColor("rgba(24,24,27,.5)")).toEqual([24, 24, 27]);
    });

    it("throws on unparseable values", () => {
      expect(() => parseHexColor("none")).toThrow("Cannot parse color value");
      expect(() => parseHexColor("0 1px 3px rgba(0,0,0,.1)")).toThrow(
        "Cannot parse color value",
      );
    });
  });

  describe("relativeLuminance", () => {
    it("returns 0 for black", () => {
      expect(relativeLuminance([0, 0, 0])).toBe(0);
    });

    it("returns 1 for white", () => {
      expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1.0, 4);
    });
  });

  describe("computeContrastRatio", () => {
    it("black on white = 21:1", () => {
      expect(computeContrastRatio("#000000", "#ffffff")).toBeCloseTo(21.0, 1);
    });

    it("same color = 1:1", () => {
      expect(computeContrastRatio("#336699", "#336699")).toBeCloseTo(1.0, 4);
    });

    it("order does not matter", () => {
      const a = computeContrastRatio("#000000", "#ffffff");
      const b = computeContrastRatio("#ffffff", "#000000");
      expect(a).toBeCloseTo(b, 4);
    });

    it("handles rgb() format", () => {
      const ratio = computeContrastRatio("rgb(0 0 0)", "rgb(255, 255, 255)");
      expect(ratio).toBeCloseTo(21.0, 1);
    });
  });
});

// ---------------------------------------------------------------------------
// Per-theme contrast validation
// ---------------------------------------------------------------------------

describe("theme contrast compliance", () => {
  const themeIds = Object.keys(THEME_TOKENS) as Exclude<ThemeId, "custom">[];

  // Sanity check: we expect 10 built-in themes
  it("has 10 built-in themes", () => {
    expect(themeIds.length).toBe(10);
  });

  for (const themeId of themeIds) {
    describe(themeId, () => {
      const tokens = THEME_TOKENS[themeId];

      for (const pair of CONTRAST_PAIRS) {
        const fgVal = tokens[pair.fg];
        const bgVal = tokens[pair.bg];

        // Skip pairs where either token is not a solid parseable color
        if (!isSolidColor(fgVal) || !isSolidColor(bgVal)) continue;

        it(`${pair.label} ≥ ${pair.minRatio}:1`, () => {
          const ratio = computeContrastRatio(fgVal, bgVal);
          expect(
            ratio,
            `${themeId}: ${pair.label} — contrast ${ratio.toFixed(2)}:1, need ${pair.minRatio}:1 (fg=${fgVal}, bg=${bgVal})`,
          ).toBeGreaterThanOrEqual(pair.minRatio);
        });
      }
    });
  }
});
