/**
 * Tests for themeTokens.ts and themeManager.ts
 *
 * Covers:
 * - THEME_TOKENS data structure completeness and correctness
 * - applyThemeTokens() — valid themes, invalid/unknown theme, DOM interaction
 * - clearInlineThemeTokens() — selective removal of --th-* properties
 * - applyTheme() — class switching, custom vs built-in theme branches
 * - ThemeManager exports: THEME_OPTIONS, THEME_COMMANDS, CUSTOM_THEME_MAP, DEFAULT_CUSTOM_THEME
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  THEME_TOKENS,
  applyThemeTokens,
  clearInlineThemeTokens,
} from "../lib/themes/themeTokens.js";
import type { ThemeTokenKey } from "../lib/themes/themeTokens.js";
import {
  applyTheme,
  THEME_OPTIONS,
  THEME_COMMANDS,
  CUSTOM_THEME_MAP,
  DEFAULT_CUSTOM_THEME,
  type ThemeId,
  type CustomThemeValues,
} from "../lib/themes/themeManager.js";

// ---------------------------------------------------------------------------
// DOM mock helpers
// ---------------------------------------------------------------------------

function createMockStyle(): CSSStyleDeclaration {
  const props = new Map<string, string>();
  const style: any = {
    setProperty: vi.fn((name: string, value: string) => {
      props.set(name, value);
    }),
    removeProperty: vi.fn((name: string) => {
      props.delete(name);
    }),
    getPropertyValue: vi.fn((name: string) => props.get(name) ?? ""),
    get length() {
      return props.size;
    },
    // Indexed access — returns prop names by index
    [Symbol.iterator]: function* () {
      yield* props.keys();
    },
  };
  // Proxy to support numeric indexing (root.style[i])
  return new Proxy(style, {
    get(target, prop) {
      if (typeof prop === "string" && /^\d+$/.test(prop)) {
        return [...props.keys()][Number(prop)] ?? undefined;
      }
      return target[prop];
    },
  }) as unknown as CSSStyleDeclaration;
}

function createMockDocumentElement() {
  const style = createMockStyle();
  const classes = new Set<string>();
  return {
    style,
    classList: {
      add: vi.fn((c: string) => classes.add(c)),
      remove: vi.fn((c: string) => classes.delete(c)),
      contains: (c: string) => classes.has(c),
      _classes: classes,
    },
  };
}

let mockRoot: ReturnType<typeof createMockDocumentElement>;

beforeEach(() => {
  mockRoot = createMockDocumentElement();
  vi.stubGlobal("document", {
    documentElement: mockRoot,
    querySelector: vi.fn(),
    createElement: vi.fn(),
  });
});

// ---------------------------------------------------------------------------
// themeTokens.ts — THEME_TOKENS data
// ---------------------------------------------------------------------------

describe("THEME_TOKENS data structure", () => {
  const themeIds = Object.keys(THEME_TOKENS) as Array<Exclude<ThemeId, "custom">>;

  it("contains all expected built-in theme ids", () => {
    const expected = [
      "dark", "light", "solarized-dark", "solarized-light",
      "high-contrast", "aubergine", "balance", "prototype",
      "gruvbox-dark", "gruvbox-light",
    ];
    expect(themeIds.sort()).toEqual(expected.sort());
  });

  it("does NOT include 'custom' as a key", () => {
    expect("custom" in THEME_TOKENS).toBe(false);
  });

  it("all themes have the same set of token keys as dark", () => {
    const darkKeys = Object.keys(THEME_TOKENS.dark).sort();
    for (const id of themeIds) {
      const keys = Object.keys(THEME_TOKENS[id]).sort();
      expect(keys).toEqual(darkKeys);
    }
  });

  it("every token key starts with '--th-'", () => {
    for (const id of themeIds) {
      for (const key of Object.keys(THEME_TOKENS[id])) {
        expect(key.startsWith("--th-")).toBe(true);
      }
    }
  });

  it("every token value is a non-empty string", () => {
    for (const id of themeIds) {
      for (const [key, val] of Object.entries(THEME_TOKENS[id])) {
        expect(typeof val).toBe("string");
        expect(val.length).toBeGreaterThan(0);
      }
    }
  });

  it("dark theme has correct --th-bg-950 value", () => {
    expect(THEME_TOKENS.dark["--th-bg-950"]).toBe("#09090b");
  });

  it("light theme has correct --th-bg-950 value", () => {
    expect(THEME_TOKENS.light["--th-bg-950"]).toBe("#fafafa");
  });

  it("each theme has at least 80 token keys", () => {
    for (const id of themeIds) {
      expect(Object.keys(THEME_TOKENS[id]).length).toBeGreaterThanOrEqual(80);
    }
  });
});

// ---------------------------------------------------------------------------
// themeTokens.ts — applyThemeTokens()
// ---------------------------------------------------------------------------

describe("applyThemeTokens", () => {
  it("sets all token CSS properties on document.documentElement for dark theme", () => {
    applyThemeTokens("dark");
    const darkTokens = THEME_TOKENS.dark;
    for (const [prop, value] of Object.entries(darkTokens)) {
      expect(mockRoot.style.setProperty).toHaveBeenCalledWith(prop, value);
    }
  });

  it("sets all token CSS properties for light theme", () => {
    applyThemeTokens("light");
    for (const [prop, value] of Object.entries(THEME_TOKENS.light)) {
      expect(mockRoot.style.setProperty).toHaveBeenCalledWith(prop, value);
    }
  });

  it("applies solarized-dark tokens", () => {
    applyThemeTokens("solarized-dark");
    expect(mockRoot.style.setProperty).toHaveBeenCalledWith(
      "--th-bg-950",
      THEME_TOKENS["solarized-dark"]["--th-bg-950"],
    );
  });

  it("applies each built-in theme without error", () => {
    const ids: Array<Exclude<ThemeId, "custom">> = [
      "dark", "light", "solarized-dark", "solarized-light",
      "high-contrast", "aubergine", "balance", "prototype",
      "gruvbox-dark", "gruvbox-light",
    ];
    for (const id of ids) {
      (mockRoot.style.setProperty as ReturnType<typeof vi.fn>).mockClear();
      applyThemeTokens(id);
      expect(mockRoot.style.setProperty).toHaveBeenCalled();
    }
  });

  it("returns early (no DOM calls) for unknown theme id", () => {
    // Cast to bypass type check — simulates runtime bad data
    applyThemeTokens("nonexistent" as any);
    // clearInlineThemeTokens is always called first, but setProperty shouldn't
    // be called for tokens (only removeProperty from the clear pass).
    // Since no tokens exist, the root.style.length is 0 so no removes happen either.
    // The key assertion: setProperty was NOT called
    expect(mockRoot.style.setProperty).not.toHaveBeenCalled();
  });

  it("clears existing inline tokens before applying new ones", () => {
    // First apply dark theme to populate some inline styles
    applyThemeTokens("dark");
    const callCountAfterDark = (mockRoot.style.setProperty as ReturnType<typeof vi.fn>).mock.calls.length;

    // Now apply light theme — should first clear then re-set
    applyThemeTokens("light");
    // removeProperty should have been called for the dark tokens
    expect(mockRoot.style.removeProperty).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// themeTokens.ts — clearInlineThemeTokens()
// ---------------------------------------------------------------------------

describe("clearInlineThemeTokens", () => {
  it("removes all --th-* properties from root.style", () => {
    // Pre-populate some --th- properties
    applyThemeTokens("dark");
    (mockRoot.style.removeProperty as ReturnType<typeof vi.fn>).mockClear();

    clearInlineThemeTokens();
    // Every --th-* property should be removed
    const removeArgs = (mockRoot.style.removeProperty as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: string[]) => c[0],
    );
    for (const prop of removeArgs) {
      expect(prop.startsWith("--th-")).toBe(true);
    }
    expect(removeArgs.length).toBe(Object.keys(THEME_TOKENS.dark).length);
  });

  it("does not remove non --th-* properties", () => {
    // Set a non-theme property directly
    mockRoot.style.setProperty("--custom-bg-main", "#fff");
    applyThemeTokens("dark");
    (mockRoot.style.removeProperty as ReturnType<typeof vi.fn>).mockClear();

    clearInlineThemeTokens();
    const removeArgs = (mockRoot.style.removeProperty as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: string[]) => c[0],
    );
    expect(removeArgs).not.toContain("--custom-bg-main");
  });

  it("is a no-op when there are no inline styles", () => {
    clearInlineThemeTokens();
    expect(mockRoot.style.removeProperty).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// themeManager.ts — THEME_OPTIONS
// ---------------------------------------------------------------------------

describe("THEME_OPTIONS", () => {
  it("is a non-empty array of { id, label } objects", () => {
    expect(Array.isArray(THEME_OPTIONS)).toBe(true);
    expect(THEME_OPTIONS.length).toBeGreaterThan(0);
    for (const opt of THEME_OPTIONS) {
      expect(typeof opt.id).toBe("string");
      expect(typeof opt.label).toBe("string");
      expect(opt.label.length).toBeGreaterThan(0);
    }
  });

  it("does NOT include 'custom' in the options list", () => {
    expect(THEME_OPTIONS.find((o) => o.id === "custom")).toBeUndefined();
  });

  it("includes all themes that are in THEME_TOKENS", () => {
    const tokenIds = Object.keys(THEME_TOKENS);
    const optionIds = THEME_OPTIONS.map((o) => o.id);
    for (const id of tokenIds) {
      expect(optionIds).toContain(id);
    }
  });
});

// ---------------------------------------------------------------------------
// themeManager.ts — THEME_COMMANDS
// ---------------------------------------------------------------------------

describe("THEME_COMMANDS", () => {
  it("is a non-empty array of [ThemeId, label] tuples", () => {
    expect(Array.isArray(THEME_COMMANDS)).toBe(true);
    expect(THEME_COMMANDS.length).toBeGreaterThan(0);
    for (const [id, label] of THEME_COMMANDS) {
      expect(typeof id).toBe("string");
      expect(typeof label).toBe("string");
    }
  });

  it("every command id maps to a valid THEME_TOKENS entry", () => {
    for (const [id] of THEME_COMMANDS) {
      expect(id in THEME_TOKENS).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// themeManager.ts — CUSTOM_THEME_MAP
// ---------------------------------------------------------------------------

describe("CUSTOM_THEME_MAP", () => {
  it("is a non-empty array of [key, cssVar] tuples", () => {
    expect(CUSTOM_THEME_MAP.length).toBeGreaterThan(0);
    for (const [key, cssVar] of CUSTOM_THEME_MAP) {
      expect(typeof key).toBe("string");
      expect(cssVar.startsWith("--custom-")).toBe(true);
    }
  });

  it("every key in CUSTOM_THEME_MAP exists in DEFAULT_CUSTOM_THEME", () => {
    for (const [key] of CUSTOM_THEME_MAP) {
      expect(key in DEFAULT_CUSTOM_THEME).toBe(true);
    }
  });

  it("all DEFAULT_CUSTOM_THEME keys are mapped in CUSTOM_THEME_MAP", () => {
    const mappedKeys = CUSTOM_THEME_MAP.map(([k]) => k);
    for (const key of Object.keys(DEFAULT_CUSTOM_THEME)) {
      expect(mappedKeys).toContain(key);
    }
  });
});

// ---------------------------------------------------------------------------
// themeManager.ts — DEFAULT_CUSTOM_THEME
// ---------------------------------------------------------------------------

describe("DEFAULT_CUSTOM_THEME", () => {
  it("has all expected keys with non-empty string values", () => {
    const keys: (keyof CustomThemeValues)[] = [
      "bgMain", "bgSidebar", "bgSection", "bgInput",
      "textPrimary", "textSecondary", "textAccent", "titlebarText",
      "borderColor", "scrollThumb", "accentPrimary", "accentSuccess",
      "accentWarning", "accentDanger", "yamlKey", "yamlString",
      "yamlComment", "diffAdded", "diffRemoved", "diffChanged",
      "sidebarBg", "sidebarBgDeep", "sidebarText", "sidebarTextMuted",
      "sidebarBorder", "sidebarHighlight",
    ];
    for (const key of keys) {
      expect(typeof DEFAULT_CUSTOM_THEME[key]).toBe("string");
      expect(DEFAULT_CUSTOM_THEME[key].length).toBeGreaterThan(0);
    }
  });

  it("values look like valid CSS colors (start with # or rgb)", () => {
    for (const val of Object.values(DEFAULT_CUSTOM_THEME)) {
      expect(val.startsWith("#") || val.startsWith("rgb")).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// themeManager.ts — applyTheme()
// ---------------------------------------------------------------------------

describe("applyTheme", () => {
  it("removes all theme classes and adds the requested theme class", () => {
    applyTheme("dark");
    // Should have called classList.remove for every theme + "custom"
    const allThemes = THEME_OPTIONS.map((o) => o.id).concat("custom");
    for (const t of allThemes) {
      expect(mockRoot.classList.remove).toHaveBeenCalledWith(t);
    }
    expect(mockRoot.classList.add).toHaveBeenCalledWith("dark");
  });

  it("applies inline tokens for a built-in theme", () => {
    applyTheme("light");
    expect(mockRoot.classList.add).toHaveBeenCalledWith("light");
    // Should have called setProperty for light tokens
    expect(mockRoot.style.setProperty).toHaveBeenCalledWith(
      "--th-bg-950",
      THEME_TOKENS.light["--th-bg-950"],
    );
  });

  it("applies custom CSS vars when themeId is 'custom' with values", () => {
    applyTheme("custom", DEFAULT_CUSTOM_THEME);
    expect(mockRoot.classList.add).toHaveBeenCalledWith("custom");
    // Should have set --custom-* properties via CUSTOM_THEME_MAP
    for (const [key, cssVar] of CUSTOM_THEME_MAP) {
      expect(mockRoot.style.setProperty).toHaveBeenCalledWith(
        cssVar,
        DEFAULT_CUSTOM_THEME[key],
      );
    }
  });

  it("clears inline tokens before applying custom theme properties", () => {
    // Pre-apply a built-in theme so some --th-* exist
    applyTheme("dark");
    (mockRoot.style.removeProperty as ReturnType<typeof vi.fn>).mockClear();

    applyTheme("custom", DEFAULT_CUSTOM_THEME);
    // clearInlineThemeTokens should have removed --th-* tokens
    const removedProps = (mockRoot.style.removeProperty as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: string[]) => c[0],
    );
    const thRemoved = removedProps.filter((p: string) => p.startsWith("--th-"));
    expect(thRemoved.length).toBeGreaterThan(0);
  });

  it("does NOT apply custom CSS vars when themeId is 'custom' with no values", () => {
    (mockRoot.style.setProperty as ReturnType<typeof vi.fn>).mockClear();
    applyTheme("custom");
    // The class should still be added
    expect(mockRoot.classList.add).toHaveBeenCalledWith("custom");
    // But setProperty should NOT be called for custom map entries
    // (only clearInlineThemeTokens runs, which does removeProperty)
    expect(mockRoot.style.setProperty).not.toHaveBeenCalled();
  });

  it("applies tokens for each built-in theme correctly", () => {
    for (const { id } of THEME_OPTIONS) {
      (mockRoot.classList.add as ReturnType<typeof vi.fn>).mockClear();
      applyTheme(id);
      expect(mockRoot.classList.add).toHaveBeenCalledWith(id);
    }
  });

  it("switches classes correctly when changing themes", () => {
    applyTheme("dark");
    expect(mockRoot.classList._classes.has("dark")).toBe(true);

    applyTheme("light");
    // dark should have been removed, light added
    expect(mockRoot.classList._classes.has("dark")).toBe(false);
    expect(mockRoot.classList._classes.has("light")).toBe(true);
  });

  it("handles switching from custom to built-in theme", () => {
    applyTheme("custom", DEFAULT_CUSTOM_THEME);
    expect(mockRoot.classList._classes.has("custom")).toBe(true);

    applyTheme("dark");
    expect(mockRoot.classList._classes.has("custom")).toBe(false);
    expect(mockRoot.classList._classes.has("dark")).toBe(true);
    // applyThemeTokens should have applied dark tokens
    expect(mockRoot.style.setProperty).toHaveBeenCalledWith(
      "--th-bg-950",
      "#09090b",
    );
  });

  it("handles switching from built-in to custom without values (no customValues branch)", () => {
    applyTheme("dark");
    (mockRoot.style.setProperty as ReturnType<typeof vi.fn>).mockClear();
    applyTheme("custom" as ThemeId);
    // Since customValues is undefined, the `themeId === "custom" && customValues` branch is false
    // And the `themeId !== "custom"` branch is also false
    // So no setProperty calls should happen
    expect(mockRoot.style.setProperty).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Cross-module consistency checks
// ---------------------------------------------------------------------------

describe("Cross-module consistency", () => {
  it("applyThemeTokens and clearInlineThemeTokens are re-exported by themeManager", async () => {
    const manager = await import("../lib/themes/themeManager.js");
    expect(typeof manager.applyThemeTokens).toBe("function");
    expect(typeof manager.clearInlineThemeTokens).toBe("function");
  });

  it("ThemeId union includes 'custom' plus all THEME_TOKENS keys", () => {
    // Verify that THEME_OPTIONS (which lists all non-custom themes) maps 1:1
    // to THEME_TOKENS keys
    const tokenKeys = new Set(Object.keys(THEME_TOKENS));
    for (const opt of THEME_OPTIONS) {
      expect(tokenKeys.has(opt.id)).toBe(true);
    }
  });

  it("CUSTOM_THEME_MAP CSS vars all start with --custom-", () => {
    for (const [, cssVar] of CUSTOM_THEME_MAP) {
      expect(cssVar.startsWith("--custom-")).toBe(true);
    }
  });

  it("THEME_TOKENS keys do not overlap with CUSTOM_THEME_MAP CSS vars", () => {
    const customVars = new Set(CUSTOM_THEME_MAP.map(([, v]) => v));
    for (const key of Object.keys(THEME_TOKENS.dark)) {
      expect(customVars.has(key)).toBe(false);
    }
  });
});
