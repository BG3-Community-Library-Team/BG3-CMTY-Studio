import { describe, it, expect } from "vitest";
import { FIELD_HELP, getHelpText } from "../lib/utils/helpText.js";

describe("helpText", () => {
  // ── getHelpText() basic lookup ─────────────────────────

  describe("getHelpText()", () => {
    it("returns help text for an existing key", () => {
      const text = getHelpText("UUID");
      expect(text).toBeDefined();
      expect(typeof text).toBe("string");
      expect(text!.length).toBeGreaterThan(0);
    });

    it("returns undefined for a non-existing key", () => {
      expect(getHelpText("nonexistent.key.blah")).toBeUndefined();
    });

    it("returns undefined for an empty string key", () => {
      expect(getHelpText("")).toBeUndefined();
    });
  });

  // ── Section-level help ─────────────────────────────────

  describe("section-level help", () => {
    const sectionKeys = [
      "Races",
      "Progressions",
      "Lists",
      "Feats",
      "Origins",
      "Backgrounds",
      "BackgroundGoals",
      "ActionResources",
      "ActionResourceGroups",
      "ClassDescriptions",
      "Spells",
    ];

    it.each(sectionKeys)("has help text for section '%s'", (section) => {
      const text = getHelpText(section);
      expect(text).toBeDefined();
      expect(text!.length).toBeGreaterThan(10);
    });
  });

  // ── Common field help ──────────────────────────────────

  describe("common field help", () => {
    const commonKeys = [
      "UUID",
      "UUIDs",
      "Action",
      "Type",
      "Name",
      "EntryName",
      "modGuid",
      "Blacklist",
    ];

    it.each(commonKeys)("has help text for common field '%s'", (key) => {
      expect(getHelpText(key)).toBeDefined();
    });
  });

  // ── Progressions field help ────────────────────────────

  describe("Progressions field help", () => {
    const progressionKeys = [
      "Progressions::Selectors",
      "Progressions::Selectors::Action",
      "Progressions::Selectors::Function",
      "Progressions::Selectors::Overwrite",
      "Progressions::Strings",
      "Progressions::Strings::Action",
      "Progressions::Strings::Type",
      "Progressions::Strings::Values",
      "Progressions::Booleans",
    ];

    it.each(progressionKeys)("has help text for '%s'", (key) => {
      expect(getHelpText(key)).toBeDefined();
    });
  });

  // ── Lists field help ──────────────────────────────────

  describe("Lists field help", () => {
    const listKeys = ["Lists::Items", "Lists::Inherit", "Lists::Exclude"];

    it.each(listKeys)("has help text for '%s'", (key) => {
      expect(getHelpText(key)).toBeDefined();
    });
  });

  // ── Races field help ──────────────────────────────────

  describe("Races field help", () => {
    const raceKeys = [
      "Races::Children",
      "Races::Children::Type",
      "Races::Children::Values",
      "Races::Children::Action",
    ];

    it.each(raceKeys)("has help text for '%s'", (key) => {
      expect(getHelpText(key)).toBeDefined();
    });
  });

  // ── Spells field help ─────────────────────────────────

  describe("Spells field help", () => {
    it("has help text for Spells::SpellField", () => {
      expect(getHelpText("Spells::SpellField")).toBeDefined();
    });
  });

  // ── ClassDescriptions field help ──────────────────────

  describe("ClassDescriptions field help", () => {
    const cdKeys = [
      "ClassDescriptions::Subclasses",
      "ClassDescriptions::Subclasses::Action",
      "ClassDescriptions::Subclasses::UUID",
    ];

    it.each(cdKeys)("has help text for '%s'", (key) => {
      expect(getHelpText(key)).toBeDefined();
    });
  });

  // ── ActionResources field help ─────────────────────────

  describe("ActionResources field help", () => {
    const arKeys = [
      "ActionResources::MaxLevel",
      "ActionResources::MaxValue",
      "ActionResources::ReplenishType",
    ];

    it.each(arKeys)("has help text for '%s'", (key) => {
      expect(getHelpText(key)).toBeDefined();
    });
  });

  // ── Badge help ────────────────────────────────────────

  describe("badge help", () => {
    const badgeKeys = [
      "badge::MOD",
      "badge::NEW",
      "badge::IMP",
      "badge::MAN",
      "badge::EDIT",
      "badge::warning",
    ];

    it.each(badgeKeys)("has help text for badge '%s'", (key) => {
      const text = getHelpText(key);
      expect(text).toBeDefined();
      expect(text!.length).toBeGreaterThan(0);
    });
  });

  // ── FIELD_HELP completeness ───────────────────────────

  describe("FIELD_HELP record", () => {
    it("contains only non-empty string values", () => {
      for (const [key, value] of Object.entries(FIELD_HELP)) {
        expect(typeof value).toBe("string");
        expect(value.length, `key "${key}" should have non-empty text`).toBeGreaterThan(0);
      }
    });

    it("has at least 30 entries", () => {
      expect(Object.keys(FIELD_HELP).length).toBeGreaterThanOrEqual(30);
    });
  });
});
