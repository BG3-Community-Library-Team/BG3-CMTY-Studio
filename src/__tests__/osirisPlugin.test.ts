import { describe, it, expect } from "vitest";
import { osirisPlugin } from "../lib/plugins/osirisPlugin.js";
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

describe("osirisPlugin", () => {
  it("has correct metadata", () => {
    expect(osirisPlugin.id).toBe("bg3-osiris");
    expect(osirisPlugin.name).toBe("BG3 Osiris");
    expect(osirisPlugin.languages).toEqual(["osiris"]);
    expect(osirisPlugin.priority).toBe(50);
  });

  it("returns empty for empty prefix", () => {
    expect(osirisPlugin.getCompletions(makeCtx({ typedPrefix: "" }))).toEqual([]);
  });

  it("returns empty for single-char prefix", () => {
    expect(osirisPlugin.getCompletions(makeCtx({ typedPrefix: "I" }))).toEqual([]);
  });

  it("returns section keywords for matching prefix", () => {
    const result = osirisPlugin.getCompletions(makeCtx({ typedPrefix: "IN" }));
    expect(result.some((r) => r.label === "INITSECTION")).toBe(true);
    expect(result.every((r) => r.label.toUpperCase().startsWith("IN"))).toBe(true);
  });

  it("returns rule keywords for matching prefix", () => {
    const result = osirisPlugin.getCompletions(makeCtx({ typedPrefix: "TH" }));
    expect(result.some((r) => r.label === "THEN")).toBe(true);
  });

  it("returns type casts for matching prefix", () => {
    const result = osirisPlugin.getCompletions(makeCtx({ typedPrefix: "GU" }));
    expect(result.some((r) => r.label === "GUIDSTRING")).toBe(true);
  });

  it("returns DB operations for matching prefix", () => {
    const result = osirisPlugin.getCompletions(makeCtx({ typedPrefix: "DB_" }));
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((r) => r.label.startsWith("DB_"))).toBe(true);
  });

  it("returns PROC operations for PROC_ prefix", () => {
    const result = osirisPlugin.getCompletions(makeCtx({ typedPrefix: "PROC_" }));
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((r) => r.label.startsWith("PROC_"))).toBe(true);
  });

  it("returns QRY operations for QRY_ prefix", () => {
    const result = osirisPlugin.getCompletions(makeCtx({ typedPrefix: "QRY_" }));
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((r) => r.label.startsWith("QRY_"))).toBe(true);
  });

  it("returns Osiris API functions for matching prefix", () => {
    const result = osirisPlugin.getCompletions(makeCtx({ typedPrefix: "Ap" }));
    expect(result.some((r) => r.label === "ApplyStatus")).toBe(true);
  });

  it("is case-insensitive", () => {
    const result = osirisPlugin.getCompletions(makeCtx({ typedPrefix: "db_" }));
    expect(result.some((r) => r.label === "DB_IsPlayer")).toBe(true);
  });

  it("returns empty for non-matching prefix", () => {
    const result = osirisPlugin.getCompletions(makeCtx({ typedPrefix: "zzz" }));
    expect(result).toEqual([]);
  });

  it("items have correct kind", () => {
    const result = osirisPlugin.getCompletions(makeCtx({ typedPrefix: "IF" }));
    const ifItem = result.find((r) => r.label === "IF");
    expect(ifItem?.kind).toBe("keyword");
  });

  it("API functions have parentheses in insertText", () => {
    const result = osirisPlugin.getCompletions(makeCtx({ typedPrefix: "Ap" }));
    const apply = result.find((r) => r.label === "ApplyStatus");
    expect(apply?.insertText).toBe("ApplyStatus()");
  });
});
