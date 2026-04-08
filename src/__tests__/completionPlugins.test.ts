import { describe, it, expect, beforeEach } from "vitest";
import { luaStdlibPlugin } from "../lib/plugins/luaStdlibPlugin.js";
import {
  activeModPlugin,
  updateModSymbols,
  clearModSymbols,
} from "../lib/plugins/activeModPlugin.js";
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

describe("luaStdlibPlugin", () => {
  it("has correct metadata", () => {
    expect(luaStdlibPlugin.id).toBe("lua-stdlib");
    expect(luaStdlibPlugin.languages).toContain("lua");
  });

  it("returns empty for empty prefix", () => {
    const result = luaStdlibPlugin.getCompletions(makeCtx({ typedPrefix: "" }));
    expect(result).toEqual([]);
  });

  it("returns empty for single-char prefix", () => {
    const result = luaStdlibPlugin.getCompletions(makeCtx({ typedPrefix: "p" }));
    expect(result).toEqual([]);
  });

  it("returns matches for 'pr' prefix (print, etc.)", () => {
    const result = luaStdlibPlugin.getCompletions(
      makeCtx({ typedPrefix: "pr" }),
    );
    expect(result.length).toBeGreaterThan(0);
    expect(result.some((r) => r.label === "print")).toBe(true);
  });

  it("returns table library for 'table.' prefix", () => {
    const result = luaStdlibPlugin.getCompletions(
      makeCtx({ typedPrefix: "table." }),
    );
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((r) => r.label.startsWith("table."))).toBe(true);
  });

  it("filters table library by suffix", () => {
    const result = luaStdlibPlugin.getCompletions(
      makeCtx({ typedPrefix: "table.in" }),
    );
    expect(result.some((r) => r.label === "table.insert")).toBe(true);
    expect(result.every((r) => r.label.startsWith("table.in"))).toBe(true);
  });

  it("returns string library for 'string.' prefix", () => {
    const result = luaStdlibPlugin.getCompletions(
      makeCtx({ typedPrefix: "string." }),
    );
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((r) => r.label.startsWith("string."))).toBe(true);
  });

  it("returns math library for 'math.' prefix", () => {
    const result = luaStdlibPlugin.getCompletions(
      makeCtx({ typedPrefix: "math." }),
    );
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((r) => r.label.startsWith("math."))).toBe(true);
  });

  it("returns keywords for 'lo' prefix (local)", () => {
    const result = luaStdlibPlugin.getCompletions(
      makeCtx({ typedPrefix: "lo" }),
    );
    expect(result.some((r) => r.label === "local")).toBe(true);
  });

  it("returns snippets that match prefix", () => {
    const result = luaStdlibPlugin.getCompletions(
      makeCtx({ typedPrefix: "for" }),
    );
    // Should include both keyword 'for' and snippet 'for i = ...'
    expect(result.length).toBeGreaterThan(1);
  });
});

describe("activeModPlugin", () => {
  beforeEach(() => {
    clearModSymbols();
  });

  it("has correct metadata", () => {
    expect(activeModPlugin.id).toBe("active-mod");
    expect(activeModPlugin.languages).toContain("lua");
  });

  it("returns empty for empty prefix", () => {
    const result = activeModPlugin.getCompletions(
      makeCtx({ typedPrefix: "" }),
    );
    expect(result).toEqual([]);
  });

  it("returns empty for single-char prefix", () => {
    const result = activeModPlugin.getCompletions(
      makeCtx({ typedPrefix: "a" }),
    );
    expect(result).toEqual([]);
  });

  it("skips Ext. prefixed queries", () => {
    updateModSymbols(
      new Map([["test.lua", "function ExtHelper() end"]]),
    );
    const result = activeModPlugin.getCompletions(
      makeCtx({ typedPrefix: "Ext." }),
    );
    expect(result).toEqual([]);
  });

  it("skips Osi. prefixed queries", () => {
    updateModSymbols(
      new Map([["test.lua", "function OsiHelper() end"]]),
    );
    const result = activeModPlugin.getCompletions(
      makeCtx({ typedPrefix: "Osi." }),
    );
    expect(result).toEqual([]);
  });

  it("returns cached mod symbols matching prefix", () => {
    updateModSymbols(
      new Map([["abilities.lua", "function MyAbilityCheck(target)\nend"]]),
    );
    const result = activeModPlugin.getCompletions(
      makeCtx({ typedPrefix: "My" }),
    );
    expect(result.some((r) => r.label === "MyAbilityCheck")).toBe(true);
  });

  it("parses global variable assignments", () => {
    updateModSymbols(
      new Map([["globals.lua", "GlobalConfig = {}\nModuleUUID = 'abc'"]]),
    );
    const result = activeModPlugin.getCompletions(
      makeCtx({ typedPrefix: "Gl" }),
    );
    expect(result.some((r) => r.label === "GlobalConfig")).toBe(true);
  });

  it("excludes ModuleUUID from global assignments", () => {
    updateModSymbols(
      new Map([["globals.lua", "ModuleUUID = 'abc'\nCustomGlobal = 42"]]),
    );
    const result = activeModPlugin.getCompletions(
      makeCtx({ typedPrefix: "Mo" }),
    );
    // ModuleUUID excluded by the global regex filter
    expect(result.some((r) => r.label === "ModuleUUID")).toBe(false);
  });

  it("parses table field assignments", () => {
    updateModSymbols(
      new Map([["config.lua", "  Config.Debug = true\n  Config.Version = 2"]]),
    );
    const result = activeModPlugin.getCompletions(
      makeCtx({ typedPrefix: "Config" }),
    );
    expect(result.some((r) => r.label === "Config.Debug")).toBe(true);
  });

  it("parses table initializations", () => {
    updateModSymbols(new Map([["init.lua", "local DataStore = {}"]]));
    const result = activeModPlugin.getCompletions(
      makeCtx({ typedPrefix: "Da" }),
    );
    expect(result.some((r) => r.label === "DataStore")).toBe(true);
  });

  it("includes inline symbols from current document", () => {
    const result = activeModPlugin.getCompletions(
      makeCtx({
        typedPrefix: "In",
        fullText: "function InlineHelper()\nend",
      }),
    );
    expect(result.some((r) => r.label === "InlineHelper")).toBe(true);
  });

  it("deduplicates inline vs cached symbols", () => {
    updateModSymbols(
      new Map([["test.lua", "function SharedFunc() end"]]),
    );
    const result = activeModPlugin.getCompletions(
      makeCtx({
        typedPrefix: "Sh",
        fullText: "function SharedFunc()\nend",
      }),
    );
    // Should only appear once
    const matches = result.filter((r) => r.label === "SharedFunc");
    expect(matches).toHaveLength(1);
  });

  it("skips re-parse when content hash hasn't changed", () => {
    const files = new Map([["test.lua", "function Foo() end"]]);
    updateModSymbols(files);
    // Call again with same content — should not re-parse
    updateModSymbols(files);
    const result = activeModPlugin.getCompletions(
      makeCtx({ typedPrefix: "Fo" }),
    );
    expect(result.some((r) => r.label === "Foo")).toBe(true);
  });

  it("clearModSymbols resets cached state", () => {
    updateModSymbols(
      new Map([["test.lua", "function ClearMe() end"]]),
    );
    clearModSymbols();
    const result = activeModPlugin.getCompletions(
      makeCtx({ typedPrefix: "Cl" }),
    );
    // Cached symbols gone — should not find "ClearMe"
    expect(result.some((r) => r.label === "ClearMe")).toBe(false);
  });
});
