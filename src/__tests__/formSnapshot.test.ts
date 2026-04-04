import { describe, it, expect } from "vitest";
import { snapshot } from "../lib/utils/formSnapshot.js";

describe("snapshot", () => {
  it("returns primitives as-is", () => {
    expect(snapshot("hello")).toBe("hello");
    expect(snapshot(42)).toBe(42);
    expect(snapshot(true)).toBe(true);
  });

  it("returns null and undefined as-is", () => {
    expect(snapshot(null)).toBe(null);
    expect(snapshot(undefined)).toBe(undefined);
  });

  it("deep-clones objects", () => {
    const original = { a: 1, nested: { b: 2 } };
    const copy = snapshot(original);
    expect(copy).toEqual(original);
    expect(copy).not.toBe(original);
    expect(copy.nested).not.toBe(original.nested);
  });

  it("deep-clones arrays", () => {
    const original = [1, [2, 3]];
    const copy = snapshot(original);
    expect(copy).toEqual(original);
    expect(copy).not.toBe(original);
    expect(copy[1]).not.toBe(original[1]);
  });

  it("deep-clones Record<string, string>", () => {
    const original: Record<string, string> = { UUID: "abc-123", Name: "Test" };
    const copy = snapshot(original);
    expect(copy).toEqual(original);
    expect(copy).not.toBe(original);
  });
});
