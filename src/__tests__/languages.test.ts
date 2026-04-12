import { describe, it, expect } from "vitest";
import { getLanguageExtension } from "../lib/editor/languages.js";

describe("getLanguageExtension", () => {
  const knownLanguages = [
    "lua", "json", "xml", "yaml", "markdown",
    "osiris", "stats", "khn", "anubis", "constellations",
  ] as const;

  for (const lang of knownLanguages) {
    it(`returns a non-empty extension for "${lang}"`, () => {
      const ext = getLanguageExtension(lang);
      // Known languages return LanguageSupport or StreamLanguage (truthy, not empty array)
      expect(ext).toBeTruthy();
      // Should not be an empty array
      expect(ext).not.toEqual([]);
    });
  }

  it("returns empty extension for 'plaintext'", () => {
    const ext = getLanguageExtension("plaintext");
    expect(ext).toEqual([]);
  });

  it("returns empty extension for unknown language", () => {
    const ext = getLanguageExtension("brainfuck");
    expect(ext).toEqual([]);
  });

  it("returns empty extension for empty string", () => {
    const ext = getLanguageExtension("");
    expect(ext).toEqual([]);
  });

  it("returns fresh extension on each call (not cached)", () => {
    const a = getLanguageExtension("lua");
    const b = getLanguageExtension("lua");
    // Each call creates a new instance (lazy factory)
    expect(a).not.toBe(b);
  });
});
