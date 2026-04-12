import { describe, it, expect } from "vitest";
import { statsPlugin } from "../lib/plugins/statsPlugin.js";
import type { CompletionContext } from "../lib/plugins/completionTypes.js";

function makeCtx(overrides: Partial<CompletionContext> = {}): CompletionContext {
  return {
    lineTextBeforeCursor: "",
    fullText: "",
    language: "stats",
    cursorOffset: 0,
    typedPrefix: "",
    ...overrides,
  };
}

describe("statsPlugin", () => {
  it("has correct metadata", () => {
    expect(statsPlugin.id).toBe("bg3-stats");
    expect(statsPlugin.name).toBe("BG3 Stats");
    expect(statsPlugin.languages).toEqual(["stats"]);
    expect(statsPlugin.priority).toBe(50);
  });

  it("returns empty for empty prefix", () => {
    expect(statsPlugin.getCompletions(makeCtx({ typedPrefix: "" }))).toEqual([]);
  });

  it("returns empty for single-char prefix", () => {
    expect(statsPlugin.getCompletions(makeCtx({ typedPrefix: "d" }))).toEqual([]);
  });

  // Context: general (structure keywords)
  it("returns structure keywords in general context", () => {
    const result = statsPlugin.getCompletions(
      makeCtx({ typedPrefix: "ne", lineTextBeforeCursor: "ne" }),
    );
    expect(result.some((r) => r.label === "new")).toBe(true);
  });

  it("returns 'using' for 'us' prefix in general context", () => {
    const result = statsPlugin.getCompletions(
      makeCtx({ typedPrefix: "us", lineTextBeforeCursor: "us" }),
    );
    expect(result.some((r) => r.label === "using")).toBe(true);
  });

  // Context: type line
  it("returns entry types after 'type \"'", () => {
    const result = statsPlugin.getCompletions(
      makeCtx({ typedPrefix: "Sp", lineTextBeforeCursor: 'type "Sp' }),
    );
    expect(result.some((r) => r.label === "SpellData")).toBe(true);
    expect(result.some((r) => r.label === "SpellMetaConditionData")).toBe(true);
  });

  it("returns entry types for 'using' line too", () => {
    const result = statsPlugin.getCompletions(
      makeCtx({ typedPrefix: "Ar", lineTextBeforeCursor: 'using "Ar' }),
    );
    expect(result.some((r) => r.label === "Armor")).toBe(true);
  });

  // Context: data field
  it("returns data fields after 'data \"'", () => {
    const result = statsPlugin.getCompletions(
      makeCtx({ typedPrefix: "Da", lineTextBeforeCursor: 'data "Da' }),
    );
    expect(result.some((r) => r.label === "Damage")).toBe(true);
    expect(result.some((r) => r.label === "DamageType")).toBe(true);
  });

  it("returns data fields with display/desc prefix", () => {
    const result = statsPlugin.getCompletions(
      makeCtx({ typedPrefix: "Di", lineTextBeforeCursor: 'data "Di' }),
    );
    expect(result.some((r) => r.label === "DisplayName")).toBe(true);
  });

  // Context: data value — DamageType field
  it("returns damage types for DamageType value", () => {
    const result = statsPlugin.getCompletions(
      makeCtx({
        typedPrefix: "Fi",
        lineTextBeforeCursor: 'data "DamageType" "Fi',
      }),
    );
    expect(result.some((r) => r.label === "Fire")).toBe(true);
  });

  // Context: data value — SpellType field
  it("returns spell types for SpellType value", () => {
    const result = statsPlugin.getCompletions(
      makeCtx({
        typedPrefix: "Pr",
        lineTextBeforeCursor: 'data "SpellType" "Pr',
      }),
    );
    expect(result.some((r) => r.label === "Projectile")).toBe(true);
  });

  // Context: data value — unknown field gives all enums
  it("returns all enum values for unknown field", () => {
    const result = statsPlugin.getCompletions(
      makeCtx({
        typedPrefix: "Fi",
        lineTextBeforeCursor: 'data "SomeField" "Fi',
      }),
    );
    expect(result.some((r) => r.label === "Fire")).toBe(true);
  });

  it("is case-insensitive", () => {
    const result = statsPlugin.getCompletions(
      makeCtx({ typedPrefix: "sp", lineTextBeforeCursor: 'type "sp' }),
    );
    expect(result.some((r) => r.label === "SpellData")).toBe(true);
  });

  it("returns empty for non-matching prefix", () => {
    const result = statsPlugin.getCompletions(
      makeCtx({ typedPrefix: "zzz", lineTextBeforeCursor: "zzz" }),
    );
    expect(result).toEqual([]);
  });

  it("data fields have kind 'property'", () => {
    const result = statsPlugin.getCompletions(
      makeCtx({ typedPrefix: "Da", lineTextBeforeCursor: 'data "Da' }),
    );
    const field = result.find((r) => r.label === "Damage");
    expect(field?.kind).toBe("property");
  });
});
