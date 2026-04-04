import { describe, it, expect } from "vitest";
import { fuzzyScore } from "../lib/utils/fuzzyScore.js";

describe("fuzzyScore", () => {
  it("returns { score: 0, matches: [] } for empty query", () => {
    const r = fuzzyScore("", "anything");
    expect(r).toEqual({ score: 0, matches: [] });
  });

  it("returns null when no match is found", () => {
    expect(fuzzyScore("xyz", "hello")).toBeNull();
  });

  it("returns null when query is longer than target", () => {
    expect(fuzzyScore("abcdef", "abc")).toBeNull();
  });

  it("matches exact prefix with prefix bonus", () => {
    const r = fuzzyScore("hel", "hello");
    expect(r).not.toBeNull();
    expect(r!.matches).toEqual([0, 1, 2]);
    // Base: 3, consecutive: 5+5, word boundary (index 0): 10, prefix: 20 = 43
    expect(r!.score).toBe(43);
  });

  it("is case-insensitive", () => {
    const r = fuzzyScore("HEL", "hello");
    expect(r).not.toBeNull();
    expect(r!.matches).toEqual([0, 1, 2]);
  });

  it("awards word boundary bonus for camelCase transitions", () => {
    const r = fuzzyScore("sP", "sectionPanel");
    expect(r).not.toBeNull();
    // 's' matches index 0 (word boundary +10), 'P' matches index 7 (camelCase boundary +10)
    expect(r!.matches).toEqual([0, 7]);
    expect(r!.score).toBeGreaterThanOrEqual(22); // 2 base + 10 + 10
  });

  it("awards word boundary bonus for underscore separators", () => {
    const r = fuzzyScore("ab", "a_b");
    expect(r).not.toBeNull();
    // 'a' at index 0 (boundary), 'b' at index 2 (after '_', boundary)
    expect(r!.matches).toEqual([0, 2]);
    expect(r!.score).toBeGreaterThanOrEqual(22);
  });

  it("scores consecutive matches higher than scattered", () => {
    const consecutive = fuzzyScore("ab", "abcdef");
    const scattered = fuzzyScore("ab", "a_c_b_d");
    expect(consecutive).not.toBeNull();
    expect(scattered).not.toBeNull();
    expect(consecutive!.score).toBeGreaterThan(scattered!.score);
  });

  it("handles single character query", () => {
    const r = fuzzyScore("a", "apple");
    expect(r).not.toBeNull();
    expect(r!.matches).toEqual([0]);
  });

  it("handles full match", () => {
    const r = fuzzyScore("hello", "hello");
    expect(r).not.toBeNull();
    expect(r!.matches).toEqual([0, 1, 2, 3, 4]);
    // Should include prefix bonus
    expect(r!.score).toBeGreaterThanOrEqual(20);
  });
});
