import { describe, it, expect, beforeEach } from "vitest";
import {
  customSnippetPlugin,
  loadCustomSnippets,
  clearCustomSnippets,
  type CustomSnippetFile,
} from "../lib/editor/customSnippets.js";
import type { CompletionContext } from "../lib/plugins/completionTypes.js";

function makeCtx(overrides: Partial<CompletionContext> = {}): CompletionContext {
  return {
    lineTextBeforeCursor: "",
    fullText: "",
    language: "lua",
    cursorOffset: 0,
    typedPrefix: "",
    ...overrides,
  };
}

const sampleSnippets: CustomSnippetFile[] = [
  {
    label: "my-helper",
    description: "A custom helper snippet",
    language: "lua",
    body: "function ${1:name}()\n\t${2}\nend",
    keywords: ["helper", "func"],
  },
  {
    label: "stats-custom",
    description: "Custom stats entry",
    language: "stats",
    body: 'new entry "${1:Name}"\ntype "StatusData"',
  },
  {
    label: "universal-comment",
    description: "Comment block",
    language: "*",
    body: "// ${1:comment}",
  },
];

beforeEach(() => {
  clearCustomSnippets();
});

describe("customSnippetPlugin metadata", () => {
  it("has correct id", () => {
    expect(customSnippetPlugin.id).toBe("custom-snippets");
  });

  it("has correct name", () => {
    expect(customSnippetPlugin.name).toBe("Custom Snippets");
  });

  it("supports wildcard language", () => {
    expect(customSnippetPlugin.languages).toEqual(["*"]);
  });

  it("has priority 160", () => {
    expect(customSnippetPlugin.priority).toBe(160);
  });
});

describe("customSnippetPlugin with no snippets loaded", () => {
  it("returns empty for any prefix", () => {
    const result = customSnippetPlugin.getCompletions(
      makeCtx({ typedPrefix: "my" }),
    );
    expect(result).toEqual([]);
  });
});

describe("customSnippetPlugin prefix filtering", () => {
  it("returns empty for empty prefix", () => {
    loadCustomSnippets(sampleSnippets);
    const result = customSnippetPlugin.getCompletions(makeCtx({ typedPrefix: "" }));
    expect(result).toEqual([]);
  });

  it("returns empty for single-char prefix", () => {
    loadCustomSnippets(sampleSnippets);
    const result = customSnippetPlugin.getCompletions(makeCtx({ typedPrefix: "m" }));
    expect(result).toEqual([]);
  });

  it("returns matches for 2-char prefix", () => {
    loadCustomSnippets(sampleSnippets);
    const result = customSnippetPlugin.getCompletions(
      makeCtx({ typedPrefix: "my", language: "lua" }),
    );
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("customSnippetPlugin language filtering", () => {
  it("returns only matching-language snippets", () => {
    loadCustomSnippets(sampleSnippets);
    const result = customSnippetPlugin.getCompletions(
      makeCtx({ typedPrefix: "st", language: "stats" }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("stats-custom");
  });

  it("returns wildcard snippets for any language", () => {
    loadCustomSnippets(sampleSnippets);
    const result = customSnippetPlugin.getCompletions(
      makeCtx({ typedPrefix: "un", language: "osiris" }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("universal-comment");
  });

  it("returns both language-specific and wildcard matches", () => {
    loadCustomSnippets([
      { label: "my-lua", language: "lua", body: "lua code" },
      { label: "my-any", language: "*", body: "any code" },
    ]);
    const result = customSnippetPlugin.getCompletions(
      makeCtx({ typedPrefix: "my", language: "lua" }),
    );
    expect(result).toHaveLength(2);
  });

  it("excludes snippets from other languages", () => {
    loadCustomSnippets(sampleSnippets);
    const result = customSnippetPlugin.getCompletions(
      makeCtx({ typedPrefix: "my", language: "stats" }),
    );
    // "my-helper" is lua-only, should not appear for stats
    expect(result.every((r) => r.label !== "my-helper")).toBe(true);
  });
});

describe("customSnippetPlugin keyword matching", () => {
  it("matches on keyword prefix", () => {
    loadCustomSnippets(sampleSnippets);
    const result = customSnippetPlugin.getCompletions(
      makeCtx({ typedPrefix: "he", language: "lua" }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("my-helper");
  });

  it("matches on alternate keyword", () => {
    loadCustomSnippets(sampleSnippets);
    const result = customSnippetPlugin.getCompletions(
      makeCtx({ typedPrefix: "fu", language: "lua" }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("my-helper");
  });
});

describe("loadCustomSnippets / clearCustomSnippets", () => {
  it("loadCustomSnippets makes snippets available", () => {
    loadCustomSnippets(sampleSnippets);
    const result = customSnippetPlugin.getCompletions(
      makeCtx({ typedPrefix: "my", language: "lua" }),
    );
    expect(result).toHaveLength(1);
  });

  it("clearCustomSnippets removes all loaded snippets", () => {
    loadCustomSnippets(sampleSnippets);
    clearCustomSnippets();
    const result = customSnippetPlugin.getCompletions(
      makeCtx({ typedPrefix: "my", language: "lua" }),
    );
    expect(result).toEqual([]);
  });

  it("loadCustomSnippets replaces previous snippets", () => {
    loadCustomSnippets(sampleSnippets);
    loadCustomSnippets([
      { label: "new-one", language: "lua", body: "new" },
    ]);
    const old = customSnippetPlugin.getCompletions(
      makeCtx({ typedPrefix: "my", language: "lua" }),
    );
    expect(old).toEqual([]);
    const fresh = customSnippetPlugin.getCompletions(
      makeCtx({ typedPrefix: "ne", language: "lua" }),
    );
    expect(fresh).toHaveLength(1);
    expect(fresh[0].label).toBe("new-one");
  });
});

describe("customSnippetPlugin item shape", () => {
  it("all items have kind='snippet'", () => {
    loadCustomSnippets(sampleSnippets);
    const result = customSnippetPlugin.getCompletions(
      makeCtx({ typedPrefix: "my", language: "lua" }),
    );
    expect(result.every((r) => r.kind === "snippet")).toBe(true);
  });

  it("all items have sortOrder=160", () => {
    loadCustomSnippets(sampleSnippets);
    const result = customSnippetPlugin.getCompletions(
      makeCtx({ typedPrefix: "my", language: "lua" }),
    );
    expect(result.every((r) => r.sortOrder === 160)).toBe(true);
  });

  it("all items have source='custom-snippets'", () => {
    loadCustomSnippets(sampleSnippets);
    const result = customSnippetPlugin.getCompletions(
      makeCtx({ typedPrefix: "my", language: "lua" }),
    );
    expect(result.every((r) => r.source === "custom-snippets")).toBe(true);
  });

  it("uses description as detail, falling back to empty string", () => {
    loadCustomSnippets(sampleSnippets);
    const withDesc = customSnippetPlugin.getCompletions(
      makeCtx({ typedPrefix: "my", language: "lua" }),
    );
    expect(withDesc[0].detail).toBe("A custom helper snippet");

    const noDesc = customSnippetPlugin.getCompletions(
      makeCtx({ typedPrefix: "un", language: "lua" }),
    );
    expect(noDesc[0].detail).toBe("Comment block");
  });

  it("snippet without description uses empty string for detail", () => {
    loadCustomSnippets([
      { label: "no-desc", language: "lua", body: "code" },
    ]);
    const result = customSnippetPlugin.getCompletions(
      makeCtx({ typedPrefix: "no", language: "lua" }),
    );
    expect(result[0].detail).toBe("");
  });
});

describe("customSnippetPlugin case insensitivity", () => {
  it("matches case-insensitively on label", () => {
    loadCustomSnippets(sampleSnippets);
    const result = customSnippetPlugin.getCompletions(
      makeCtx({ typedPrefix: "MY", language: "lua" }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("my-helper");
  });

  it("matches case-insensitively on keywords", () => {
    loadCustomSnippets(sampleSnippets);
    const result = customSnippetPlugin.getCompletions(
      makeCtx({ typedPrefix: "HE", language: "lua" }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("my-helper");
  });
});
