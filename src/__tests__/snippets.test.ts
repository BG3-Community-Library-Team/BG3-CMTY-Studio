import { describe, it, expect } from "vitest";
import { snippetPlugin } from "../lib/editor/snippets.js";
import type { CompletionContext } from "../lib/plugins/completionTypes.js";

function makeCtx(overrides: Partial<CompletionContext> = {}): CompletionContext {
  return {
    lineTextBeforeCursor: "",
    fullText: "",
    language: "osiris",
    cursorOffset: 0,
    typedPrefix: "",
    ...overrides,
  };
}

describe("snippetPlugin metadata", () => {
  it("has correct id", () => {
    expect(snippetPlugin.id).toBe("bg3-snippets");
  });

  it("has correct name", () => {
    expect(snippetPlugin.name).toBe("BG3 Snippets");
  });

  it("supports all expected languages", () => {
    expect(snippetPlugin.languages).toEqual(
      expect.arrayContaining(["osiris", "lua", "khn", "anubis", "constellations", "stats", "json"]),
    );
    expect(snippetPlugin.languages).toHaveLength(7);
  });

  it("has priority 150", () => {
    expect(snippetPlugin.priority).toBe(150);
  });
});

describe("snippetPlugin prefix filtering", () => {
  it("returns empty for empty prefix", () => {
    const result = snippetPlugin.getCompletions(makeCtx({ typedPrefix: "" }));
    expect(result).toEqual([]);
  });

  it("returns empty for single-char prefix", () => {
    const result = snippetPlugin.getCompletions(makeCtx({ typedPrefix: "o" }));
    expect(result).toEqual([]);
  });

  it("returns results for 2-char prefix", () => {
    const result = snippetPlugin.getCompletions(
      makeCtx({ typedPrefix: "os", language: "osiris" }),
    );
    expect(result.length).toBeGreaterThan(0);
  });

  it("filters by prefix match on label", () => {
    const result = snippetPlugin.getCompletions(
      makeCtx({ typedPrefix: "osiris-r", language: "osiris" }),
    );
    expect(result.length).toBe(1);
    expect(result[0].label).toBe("osiris-rule");
  });

  it("is case-insensitive", () => {
    const result = snippetPlugin.getCompletions(
      makeCtx({ typedPrefix: "OSIRIS-R", language: "osiris" }),
    );
    expect(result.length).toBe(1);
    expect(result[0].label).toBe("osiris-rule");
  });
});

describe("snippetPlugin returns correct items per language", () => {
  it("returns 7 osiris snippets", () => {
    const result = snippetPlugin.getCompletions(
      makeCtx({ typedPrefix: "os", language: "osiris" }),
    );
    expect(result).toHaveLength(7);
  });

  it("returns 10 lua snippets", () => {
    const result = snippetPlugin.getCompletions(
      makeCtx({ typedPrefix: "se", language: "lua" }),
    );
    expect(result).toHaveLength(10);
  });

  it("returns 3 khonsu snippets", () => {
    const result = snippetPlugin.getCompletions(
      makeCtx({ typedPrefix: "kh", language: "khn" }),
    );
    expect(result).toHaveLength(3);
  });

  it("returns 5 stats snippets", () => {
    const result = snippetPlugin.getCompletions(
      makeCtx({ typedPrefix: "st", language: "stats" }),
    );
    expect(result).toHaveLength(5);
  });

  it("returns 3 anubis snippets", () => {
    const result = snippetPlugin.getCompletions(
      makeCtx({ typedPrefix: "an", language: "anubis" }),
    );
    expect(result).toHaveLength(3);
  });

  it("returns 1 constellations snippet", () => {
    const result = snippetPlugin.getCompletions(
      makeCtx({ typedPrefix: "cl", language: "constellations" }),
    );
    expect(result).toHaveLength(1);
  });

  it("returns 1 json snippet", () => {
    const result = snippetPlugin.getCompletions(
      makeCtx({ typedPrefix: "mc", language: "json" }),
    );
    expect(result).toHaveLength(1);
  });
});

describe("snippetPlugin returns empty for unsupported language", () => {
  it("returns empty for unknown language", () => {
    const result = snippetPlugin.getCompletions(
      makeCtx({ typedPrefix: "os", language: "xml" }),
    );
    expect(result).toEqual([]);
  });
});

describe("snippetPlugin item shape", () => {
  it("all items have kind='snippet'", () => {
    const result = snippetPlugin.getCompletions(
      makeCtx({ typedPrefix: "os", language: "osiris" }),
    );
    expect(result.every((r) => r.kind === "snippet")).toBe(true);
  });

  it("all items have sortOrder=150", () => {
    const result = snippetPlugin.getCompletions(
      makeCtx({ typedPrefix: "os", language: "osiris" }),
    );
    expect(result.every((r) => r.sortOrder === 150)).toBe(true);
  });

  it("all items have source='bg3-snippets'", () => {
    const result = snippetPlugin.getCompletions(
      makeCtx({ typedPrefix: "os", language: "osiris" }),
    );
    expect(result.every((r) => r.source === "bg3-snippets")).toBe(true);
  });

  it("items have non-empty insertText (body)", () => {
    const result = snippetPlugin.getCompletions(
      makeCtx({ typedPrefix: "os", language: "osiris" }),
    );
    expect(result.every((r) => r.insertText.length > 0)).toBe(true);
  });

  it("items have non-empty detail", () => {
    const result = snippetPlugin.getCompletions(
      makeCtx({ typedPrefix: "os", language: "osiris" }),
    );
    expect(result.every((r) => r.detail.length > 0)).toBe(true);
  });
});

describe("snippetPlugin specific snippets", () => {
  it("osiris-goal has expected body content", () => {
    const result = snippetPlugin.getCompletions(
      makeCtx({ typedPrefix: "osiris-goal", language: "osiris" }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].insertText).toContain("SubGoalCombiner");
    expect(result[0].insertText).toContain("KBSECTION");
  });

  it("stats-spell has expected body content", () => {
    const result = snippetPlugin.getCompletions(
      makeCtx({ typedPrefix: "stats-spell", language: "stats" }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].insertText).toContain("SpellData");
    expect(result[0].insertText).toContain("SpellProperties");
  });

  it("mcm-blueprint has expected body content", () => {
    const result = snippetPlugin.getCompletions(
      makeCtx({ typedPrefix: "mcm-blueprint", language: "json" }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].insertText).toContain("SchemaVersion");
    expect(result[0].insertText).toContain("Tabs");
  });
});
