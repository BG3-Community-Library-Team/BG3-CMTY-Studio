import { describe, it, expect } from "vitest";
import { parser } from "../lib/editor/lang-stats/stats.parser.js";
import { stats } from "../lib/editor/lang-stats/index.js";
import { LanguageSupport } from "@codemirror/language";

/** Collect all node names from a parse tree in depth-first order. */
function nodeNames(input: string): string[] {
  const tree = parser.parse(input);
  const names: string[] = [];
  tree.iterate({ enter(node) { names.push(node.name); } });
  return names;
}

describe("Stats language", () => {
  describe("stats() export", () => {
    it("returns a LanguageSupport instance", () => {
      const ls = stats();
      expect(ls).toBeInstanceOf(LanguageSupport);
    });

    it("has a language with name 'stats'", () => {
      const ls = stats();
      expect(ls.language.name).toBe("stats");
    });
  });

  describe("parser — happy paths", () => {
    it("parses a minimal entry", () => {
      const names = nodeNames('new entry "TestEntry"');
      expect(names).toContain("StatsFile");
      expect(names).toContain("StatsEntry");
      expect(names).toContain("new");
      expect(names).toContain("entry");
      expect(names).toContain("String");
    });

    it("parses an equipment entry", () => {
      const names = nodeNames('new equipment "Shield_Buckler"');
      expect(names).toContain("equipment");
    });

    it("parses entry with type declaration", () => {
      const names = nodeNames(
        'new entry "TestSpell"\ntype "SpellData"',
      );
      expect(names).toContain("TypeDecl");
      expect(names).toContain("type");
    });

    it("parses entry with using declaration", () => {
      const names = nodeNames(
        'new entry "Child"\ntype "SpellData"\nusing "Parent"',
      );
      expect(names).toContain("UsingDecl");
      expect(names).toContain("using");
    });

    it("parses data lines", () => {
      const names = nodeNames(
        'new entry "Sword"\ntype "Weapon"\ndata "Damage" "1d8"',
      );
      expect(names).toContain("DataLine");
      expect(names).toContain("data");
      // Should have multiple String nodes (entry name, type value, field name, field value)
      const stringCount = names.filter((n) => n === "String").length;
      expect(stringCount).toBe(4);
    });

    it("parses multiple data lines", () => {
      const input = [
        'new entry "Armor"',
        'type "Armor"',
        'data "ArmorClass" "14"',
        'data "Slot" "Breast"',
      ].join("\n");
      const names = nodeNames(input);
      const dataLineCount = names.filter((n) => n === "DataLine").length;
      expect(dataLineCount).toBe(2);
    });

    it("parses multiple entries", () => {
      const input = [
        'new entry "A"',
        'type "SpellData"',
        'new entry "B"',
        'type "StatusData"',
      ].join("\n");
      const names = nodeNames(input);
      const entryCount = names.filter((n) => n === "StatsEntry").length;
      expect(entryCount).toBe(2);
    });

    it("skips comments", () => {
      const input = [
        "// This is a comment",
        'new entry "Test"',
        'type "SpellData"',
        "// Another comment",
        'data "Level" "1"',
      ].join("\n");
      const names = nodeNames(input);
      expect(names).toContain("StatsEntry");
      expect(names).toContain("DataLine");
    });
  });

  describe("parser — edge cases", () => {
    it("parses an empty file", () => {
      const names = nodeNames("");
      expect(names).toEqual(["StatsFile"]);
    });

    it("parses entry without type or using", () => {
      const names = nodeNames('new entry "Bare"');
      expect(names).not.toContain("TypeDecl");
      expect(names).not.toContain("UsingDecl");
    });

    it("handles comment-only file without crash", () => {
      const names = nodeNames("// just a comment\n// another");
      expect(names).toContain("StatsFile");
    });

    it("handles entry with only type, no data lines", () => {
      const names = nodeNames('new entry "Empty"\ntype "StatusData"');
      expect(names).toContain("TypeDecl");
      expect(names).not.toContain("DataLine");
    });
  });

  describe("parser — tree structure", () => {
    it("StatsEntry contains expected children in order", () => {
      const input = 'new entry "Test"\ntype "SpellData"\nusing "Base"\ndata "K" "V"';
      const tree = parser.parse(input);
      const cursor = tree.cursor();
      // Enter StatsFile
      expect(cursor.firstChild()).toBe(true); // StatsEntry
      expect(cursor.name).toBe("StatsEntry");

      // First child of StatsEntry should be 'new'
      expect(cursor.firstChild()).toBe(true);
      expect(cursor.name).toBe("new");

      // Sibling: 'entry'
      expect(cursor.nextSibling()).toBe(true);
      expect(cursor.name).toBe("entry");

      // Sibling: String (entry name)
      expect(cursor.nextSibling()).toBe(true);
      expect(cursor.name).toBe("String");

      // Sibling: TypeDecl
      expect(cursor.nextSibling()).toBe(true);
      expect(cursor.name).toBe("TypeDecl");

      // Sibling: UsingDecl
      expect(cursor.nextSibling()).toBe(true);
      expect(cursor.name).toBe("UsingDecl");

      // Sibling: DataLine
      expect(cursor.nextSibling()).toBe(true);
      expect(cursor.name).toBe("DataLine");
    });
  });
});
