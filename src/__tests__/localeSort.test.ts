import { describe, it, expect } from "vitest";
import { localeCompare, localeSortStrings } from "../lib/utils/localeSort.js";

describe("localeCompare", () => {
  it("returns negative when a < b", () => {
    expect(localeCompare("apple", "banana")).toBeLessThan(0);
  });

  it("returns positive when a > b", () => {
    expect(localeCompare("banana", "apple")).toBeGreaterThan(0);
  });

  it("returns 0 for case-insensitive equal strings", () => {
    expect(localeCompare("Hello", "hello")).toBe(0);
  });
});

describe("localeSortStrings", () => {
  it("sorts strings in locale order", () => {
    expect(localeSortStrings(["banana", "apple", "cherry"])).toEqual(["apple", "banana", "cherry"]);
  });

  it("handles empty array", () => {
    expect(localeSortStrings([])).toEqual([]);
  });
});
