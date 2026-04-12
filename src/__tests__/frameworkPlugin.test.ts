import { describe, it, expect } from "vitest";
import { frameworkPlugin } from "../lib/plugins/frameworkPlugin.js";
import type { CompletionContext } from "../lib/plugins/completionTypes.js";

function makeCtx(overrides: Partial<CompletionContext> = {}): CompletionContext {
  return {
    lineTextBeforeCursor: "",
    fullText: "",
    language: "anubis",
    cursorOffset: 0,
    typedPrefix: "",
    ...overrides,
  };
}

describe("frameworkPlugin", () => {
  it("has correct metadata", () => {
    expect(frameworkPlugin.id).toBe("bg3-framework");
    expect(frameworkPlugin.name).toBe("BG3 Anubis/Constellations");
    expect(frameworkPlugin.languages).toEqual(["anubis", "constellations"]);
    expect(frameworkPlugin.priority).toBe(50);
  });

  it("returns empty for empty prefix", () => {
    expect(frameworkPlugin.getCompletions(makeCtx({ typedPrefix: "" }))).toEqual([]);
  });

  it("returns empty for single-char prefix", () => {
    expect(frameworkPlugin.getCompletions(makeCtx({ typedPrefix: "C" }))).toEqual([]);
  });

  it("returns constructors for matching prefix", () => {
    const result = frameworkPlugin.getCompletions(makeCtx({ typedPrefix: "Co" }));
    expect(result.some((r) => r.label === "Config")).toBe(true);
  });

  it("returns State/StateRef for 'St' prefix", () => {
    const result = frameworkPlugin.getCompletions(makeCtx({ typedPrefix: "St" }));
    expect(result.some((r) => r.label === "State")).toBe(true);
    expect(result.some((r) => r.label === "StateRef")).toBe(true);
  });

  it("returns game namespace members for 'game.' prefix", () => {
    const result = frameworkPlugin.getCompletions(makeCtx({ typedPrefix: "game." }));
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((r) => r.label.startsWith("game."))).toBe(true);
    expect(result.some((r) => r.label === "game.configs")).toBe(true);
  });

  it("filters game namespace by suffix", () => {
    const result = frameworkPlugin.getCompletions(makeCtx({ typedPrefix: "game.s" }));
    expect(result.some((r) => r.label === "game.states")).toBe(true);
    expect(result.every((r) => r.label.startsWith("game.s"))).toBe(true);
  });

  it("returns Lua keywords for matching prefix", () => {
    const result = frameworkPlugin.getCompletions(makeCtx({ typedPrefix: "fu" }));
    expect(result.some((r) => r.label === "function")).toBe(true);
  });

  it("Lua keywords have sortOrder 200", () => {
    const result = frameworkPlugin.getCompletions(makeCtx({ typedPrefix: "fu" }));
    const fn = result.find((r) => r.label === "function");
    expect(fn?.sortOrder).toBe(200);
  });

  // EParamType — constellations only
  it("returns EParamType for 'EParamType.' in constellations", () => {
    const result = frameworkPlugin.getCompletions(
      makeCtx({ typedPrefix: "EParamType.", language: "constellations" }),
    );
    expect(result.length).toBeGreaterThan(0);
    expect(result.some((r) => r.label === "EParamType.String")).toBe(true);
  });

  it("returns empty for EParamType in anubis language", () => {
    const result = frameworkPlugin.getCompletions(
      makeCtx({ typedPrefix: "EParamType.", language: "anubis" }),
    );
    expect(result).toEqual([]);
  });

  it("includes EParamType in general results for constellations", () => {
    const result = frameworkPlugin.getCompletions(
      makeCtx({ typedPrefix: "EP", language: "constellations" }),
    );
    expect(result.some((r) => r.label === "EParamType.String")).toBe(true);
  });

  it("excludes EParamType from general results for anubis", () => {
    const result = frameworkPlugin.getCompletions(
      makeCtx({ typedPrefix: "EP", language: "anubis" }),
    );
    expect(result).toEqual([]);
  });

  it("is case-insensitive", () => {
    const result = frameworkPlugin.getCompletions(makeCtx({ typedPrefix: "co" }));
    expect(result.some((r) => r.label === "Config")).toBe(true);
  });

  it("returns empty for non-matching prefix", () => {
    expect(frameworkPlugin.getCompletions(makeCtx({ typedPrefix: "zzz" }))).toEqual([]);
  });

  it("constructors have kind 'function'", () => {
    const result = frameworkPlugin.getCompletions(makeCtx({ typedPrefix: "Co" }));
    const item = result.find((r) => r.label === "Config");
    expect(item?.kind).toBe("function");
  });

  it("constructors have parentheses in insertText", () => {
    const result = frameworkPlugin.getCompletions(makeCtx({ typedPrefix: "Co" }));
    const item = result.find((r) => r.label === "Config");
    expect(item?.insertText).toBe("Config()");
  });
});
