import { describe, it, expect } from "vitest";
import { parser } from "../lib/editor/lang-osiris/osiris.parser.js";
import { osiris } from "../lib/editor/lang-osiris/index.js";
import { LanguageSupport } from "@codemirror/language";

/** Collect all node names from a parse tree in depth-first order. */
function nodeNames(input: string): string[] {
  const tree = parser.parse(input);
  const names: string[] = [];
  tree.iterate({ enter(node) { names.push(node.name); } });
  return names;
}

/** Get the text associated with a named node (first match). */
function nodeText(input: string, nodeName: string): string | null {
  const tree = parser.parse(input);
  let result: string | null = null;
  tree.iterate({
    enter(node) {
      if (result === null && node.name === nodeName) {
        result = input.slice(node.from, node.to);
      }
    },
  });
  return result;
}

describe("Osiris language", () => {
  describe("osiris() export", () => {
    it("returns a LanguageSupport instance", () => {
      const ls = osiris();
      expect(ls).toBeInstanceOf(LanguageSupport);
    });

    it("has a language with name 'osiris'", () => {
      const ls = osiris();
      expect(ls.language.name).toBe("osiris");
    });
  });

  describe("parser — declarations", () => {
    it("parses Version declaration", () => {
      const names = nodeNames("Version 1");
      expect(names).toContain("VersionDecl");
      expect(names).toContain("Version");
      expect(names).toContain("Number");
    });

    it("parses SubGoalCombiner SGC_AND", () => {
      const names = nodeNames("SubGoalCombiner SGC_AND");
      expect(names).toContain("CombinerDecl");
      expect(names).toContain("SubGoalCombiner");
      expect(names).toContain("SGC_AND");
    });

    it("parses ParentTargetEdge", () => {
      const names = nodeNames('ParentTargetEdge "MyGoal"');
      expect(names).toContain("ParentEdge");
      expect(names).toContain("ParentTargetEdge");
      expect(names).toContain("String");
    });
  });

  describe("parser — sections", () => {
    it("parses INITSECTION with statements", () => {
      const input = "INITSECTION\nDB_MyDb(1);\nDB_Other(2);";
      const names = nodeNames(input);
      expect(names).toContain("InitSection");
      expect(names).toContain("INITSECTION");
      expect(names).toContain("Statement");
      expect(names).toContain("FuncCall");
      const stmtCount = names.filter((n) => n === "Statement").length;
      expect(stmtCount).toBe(2);
    });

    it("parses empty INITSECTION", () => {
      const names = nodeNames("INITSECTION");
      expect(names).toContain("InitSection");
      expect(names).toContain("INITSECTION");
      expect(names).not.toContain("Statement");
    });

    it("parses EXITSECTION with ENDEXITSECTION", () => {
      const input = 'EXITSECTION\nDB_Cleanup("a");\nENDEXITSECTION';
      const names = nodeNames(input);
      expect(names).toContain("ExitSection");
      expect(names).toContain("EXITSECTION");
      expect(names).toContain("ENDEXITSECTION");
      expect(names).toContain("Statement");
    });

    it("parses empty KbSection", () => {
      const names = nodeNames("KBSECTION");
      expect(names).toContain("KbSection");
      expect(names).toContain("KBSECTION");
    });
  });

  describe("parser — rules", () => {
    it("parses a simple IF/THEN rule", () => {
      const input = "KBSECTION\nIF\nDB_IsPlayer(_Player)\nTHEN\nDB_Result(1);";
      const names = nodeNames(input);
      expect(names).toContain("Rule");
      expect(names).toContain("IF");
      expect(names).toContain("THEN");
      expect(names).toContain("Condition");
      expect(names).toContain("Statement");
    });

    it("parses rule with AND conditions", () => {
      const input = "KBSECTION\nIF\nDB_A(1)\nAND\nDB_B(2)\nTHEN\nDB_C(3);";
      const names = nodeNames(input);
      expect(names).toContain("AND");
      const condCount = names.filter((n) => n === "Condition").length;
      expect(condCount).toBe(2);
    });

    it("parses NOT condition", () => {
      const input = "KBSECTION\nIF\nNOT DB_Dead(_x)\nTHEN\nDB_Alive(_x);";
      const names = nodeNames(input);
      expect(names).toContain("NOT");
      expect(names).toContain("Condition");
    });

    it("parses multiple statements in THEN", () => {
      const input = "KBSECTION\nIF\nDB_A(1)\nTHEN\nDB_B(2);\nDB_C(3);\nDB_D(4);";
      const names = nodeNames(input);
      const stmtCount = names.filter((n) => n === "Statement").length;
      expect(stmtCount).toBe(3);
    });
  });

  describe("parser — PROC and QRY", () => {
    it("parses PROC definition", () => {
      const input = "KBSECTION\nPROC\nMyProc(_a, _b)\nTHEN\nDB_Result(_a);";
      const names = nodeNames(input);
      expect(names).toContain("ProcDef");
      expect(names).toContain("PROC");
    });

    it("parses QRY definition", () => {
      const input = "KBSECTION\nQRY\nMyQuery(_x)\nTHEN\nDB_Answer(_x);";
      const names = nodeNames(input);
      expect(names).toContain("QryDef");
      expect(names).toContain("QRY");
    });

    it("parses PROC with AND conditions", () => {
      const input = "KBSECTION\nPROC\nMyProc(_a)\nAND\nDB_Check(_a)\nTHEN\nDB_Ok(1);";
      const names = nodeNames(input);
      expect(names).toContain("ProcDef");
      expect(names).toContain("AND");
    });
  });

  describe("parser — arguments and type casts", () => {
    it("parses function call with typed argument", () => {
      const input = "INITSECTION\nSetTag((CHARACTERGUID)_Player, \"Hero\");";
      const names = nodeNames(input);
      expect(names).toContain("TypeCast");
      expect(names).toContain("CHARACTERGUID");
    });

    it("parses multiple type casts", () => {
      const input = "INITSECTION\nFunc((INTEGER)_a, (STRING)_b, (GUIDSTRING)_c);";
      const names = nodeNames(input);
      expect(names).toContain("INTEGER");
      expect(names).toContain("STRING");
      expect(names).toContain("GUIDSTRING");
      const castCount = names.filter((n) => n === "TypeCast").length;
      expect(castCount).toBe(3);
    });

    it("parses string arguments", () => {
      const input = 'INITSECTION\nDB_Test("hello world");';
      expect(nodeText(input, "String")).toBe('"hello world"');
    });

    it("parses numeric arguments", () => {
      const input = "INITSECTION\nDB_Val(42);";
      expect(nodeText(input, "Number")).toBe("42");
    });

    it("parses negative numbers", () => {
      const input = "INITSECTION\nDB_Val(-5);";
      expect(nodeText(input, "Number")).toBe("-5");
    });

    it("parses decimal numbers", () => {
      const input = "INITSECTION\nDB_Val(3.14);";
      expect(nodeText(input, "Number")).toBe("3.14");
    });

    it("parses GUID-suffixed identifiers", () => {
      const input = "INITSECTION\nDB_Test(S_Player_739cee40-776a-4e09-855c-ab6b7b97b027);";
      const idText = nodeText(input, "Identifier");
      // The first identifier is DB_Test, second is the GUID-suffixed one
      const tree = parser.parse(input);
      const ids: string[] = [];
      tree.iterate({
        enter(node) {
          if (node.name === "Identifier") ids.push(input.slice(node.from, node.to));
        },
      });
      expect(ids).toContain("S_Player_739cee40-776a-4e09-855c-ab6b7b97b027");
    });
  });

  describe("parser — comments", () => {
    it("skips line comments", () => {
      const input = "// Goal comment\nVersion 1\n// Another comment\nSubGoalCombiner SGC_AND";
      const names = nodeNames(input);
      expect(names).toContain("VersionDecl");
      expect(names).toContain("CombinerDecl");
    });
  });

  describe("parser — edge cases", () => {
    it("parses an empty file", () => {
      const names = nodeNames("");
      expect(names).toEqual(["GoalFile"]);
    });

    it("parses a full goal file structure", () => {
      const input = [
        "Version 1",
        "SubGoalCombiner SGC_AND",
        "INITSECTION",
        "DB_Init(1);",
        "KBSECTION",
        "IF",
        "DB_Init(_x)",
        "THEN",
        "DB_Ready(_x);",
        "EXITSECTION",
        "DB_Cleanup(1);",
        "ENDEXITSECTION",
        'ParentTargetEdge "MainGoal"',
      ].join("\n");
      const names = nodeNames(input);
      expect(names).toContain("VersionDecl");
      expect(names).toContain("CombinerDecl");
      expect(names).toContain("InitSection");
      expect(names).toContain("KbSection");
      expect(names).toContain("ExitSection");
      expect(names).toContain("ParentEdge");
      expect(names).toContain("Rule");
    });

    it("parses function call with no arguments", () => {
      const input = "INITSECTION\nNoArgs();";
      const names = nodeNames(input);
      expect(names).toContain("FuncCall");
      expect(names).not.toContain("ArgList");
    });

    it("parses function call with multiple arguments", () => {
      const input = 'INITSECTION\nMulti(1, "two", _three);';
      const names = nodeNames(input);
      expect(names).toContain("ArgList");
      const argCount = names.filter((n) => n === "Arg").length;
      expect(argCount).toBe(3);
    });
  });
});
