import { describe, it, expect, beforeEach } from "vitest";
import { contextKeys } from "../lib/plugins/contextKeyService.svelte.js";

describe("ContextKeyService", () => {
  // Reset all test keys before each test since contextKeys is a singleton
  const TEST_KEYS = [
    "myKey",
    "someKey",
    "missingKey",
    "a",
    "b",
    "branch",
    "k",
    "false",
  ];

  beforeEach(() => {
    for (const key of TEST_KEYS) {
      contextKeys.delete(key);
    }
  });

  // ── Truthy / falsy evaluation ──────────────────────────

  it("returns true for a key set to true", () => {
    contextKeys.set("myKey", true);
    expect(contextKeys.evaluate("myKey")).toBe(true);
  });

  it("returns false for a key that was never set", () => {
    expect(contextKeys.evaluate("someKey")).toBe(false);
  });

  // ── Negation ───────────────────────────────────────────

  it("negation: !key returns false when key is truthy", () => {
    contextKeys.set("myKey", true);
    expect(contextKeys.evaluate("!myKey")).toBe(false);
  });

  it("negation: !key returns true when key is missing", () => {
    expect(contextKeys.evaluate("!missingKey")).toBe(true);
  });

  // ── AND ────────────────────────────────────────────────

  it("AND: true && true returns true", () => {
    contextKeys.set("a", true);
    contextKeys.set("b", true);
    expect(contextKeys.evaluate("a && b")).toBe(true);
  });

  it("AND: true && false returns false", () => {
    contextKeys.set("a", true);
    expect(contextKeys.evaluate("a && b")).toBe(false);
  });

  // ── OR ─────────────────────────────────────────────────

  it("OR: true || false returns true", () => {
    contextKeys.set("a", true);
    expect(contextKeys.evaluate("a || b")).toBe(true);
  });

  it("OR: false || false returns false", () => {
    expect(contextKeys.evaluate("a || b")).toBe(false);
  });

  // ── Equality / inequality ──────────────────────────────

  it("equality: matches when value equals", () => {
    contextKeys.set("branch", "main");
    expect(contextKeys.evaluate("branch == 'main'")).toBe(true);
  });

  it("equality: mismatches when value differs", () => {
    contextKeys.set("branch", "dev");
    expect(contextKeys.evaluate("branch == 'main'")).toBe(false);
  });

  it("inequality: true when value differs", () => {
    contextKeys.set("branch", "dev");
    expect(contextKeys.evaluate("branch != 'main'")).toBe(true);
  });

  // ── Edge cases ─────────────────────────────────────────

  it("empty expression returns true (no clause = always visible)", () => {
    expect(contextKeys.evaluate("")).toBe(true);
  });

  it("undefined expression returns true", () => {
    expect(contextKeys.evaluate(undefined)).toBe(true);
  });

  it("invalid expression returns false (fail-closed)", () => {
    // An expression referencing a non-existent key evaluates to falsy
    expect(contextKeys.evaluate("false")).toBe(false);
  });

  it('string "false" evaluates to false (no key named false)', () => {
    expect(contextKeys.evaluate("false")).toBe(false);
  });

  // ── delete / get ───────────────────────────────────────

  it("delete removes a key so evaluate returns false", () => {
    contextKeys.set("k", true);
    expect(contextKeys.evaluate("k")).toBe(true);
    contextKeys.delete("k");
    expect(contextKeys.evaluate("k")).toBe(false);
  });

  it("get returns the stored value", () => {
    contextKeys.set("k", 42);
    expect(contextKeys.get("k")).toBe(42);
  });

  it("get returns undefined for a missing key", () => {
    expect(contextKeys.get("missingKey")).toBeUndefined();
  });
});
