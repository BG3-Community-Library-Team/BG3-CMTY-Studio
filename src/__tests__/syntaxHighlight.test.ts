import { describe, it, expect } from "vitest";
import {
  esc,
  hl,
  highlightYaml,
  highlightJson,
  highlightLua,
  highlightMarkdown,
  highlightXml,
  hlXmlAttrs,
  highlightOsiris,
  highlightKhonsu,
  highlightFrameworkLua,
  highlightLine,
} from "../lib/utils/syntaxHighlight.js";
import type { HlType, ScriptLanguage } from "../lib/utils/syntaxHighlight.js";

// ── esc() ────────────────────────────────────────────────────────────

describe("esc", () => {
  it("escapes ampersands", () => {
    expect(esc("a & b")).toBe("a &amp; b");
  });

  it("escapes angle brackets", () => {
    expect(esc("<div>")).toBe("&lt;div&gt;");
  });

  it("escapes all entities in one string", () => {
    expect(esc("x < y & y > z")).toBe("x &lt; y &amp; y &gt; z");
  });

  it("returns empty string unchanged", () => {
    expect(esc("")).toBe("");
  });

  it("leaves safe text unchanged", () => {
    expect(esc("hello world")).toBe("hello world");
  });
});

// ── hl() ─────────────────────────────────────────────────────────────

describe("hl", () => {
  it("wraps text in a span with the type class", () => {
    expect(hl("foo", "key")).toBe('<span class="hl-key">foo</span>');
  });

  it("escapes HTML inside the span", () => {
    expect(hl("<b>", "string")).toBe('<span class="hl-string">&lt;b&gt;</span>');
  });

  it("returns escaped text without span for 'text' type", () => {
    expect(hl("<b>", "text")).toBe("&lt;b&gt;");
  });

  it("handles empty string", () => {
    expect(hl("", "key")).toBe('<span class="hl-key"></span>');
  });

  const types: HlType[] = ["key", "string", "comment", "bool", "num", "punct", "keyword", "attr"];
  for (const t of types) {
    it(`wraps with hl-${t} class`, () => {
      expect(hl("x", t)).toContain(`class="hl-${t}"`);
    });
  }
});

// ── highlightYaml (syntaxHighlight.ts) ───────────────────────────────

describe("highlightYaml (syntaxHighlight.ts)", () => {
  it("highlights a full comment line", () => {
    const result = highlightYaml("  # this is a comment");
    expect(result).toContain("hl-comment");
  });

  it("highlights a key-value pair", () => {
    const result = highlightYaml("  Name: Wizard");
    expect(result).toContain("hl-key");
    expect(result).toContain("hl-punct");
  });

  it("highlights quoted strings in value", () => {
    const result = highlightYaml('  UUID: "abc-123"');
    expect(result).toContain("hl-string");
  });

  it("highlights boolean values", () => {
    const result = highlightYaml("  Hidden: true");
    expect(result).toContain("hl-bool");
  });

  it("highlights list items with dash", () => {
    const result = highlightYaml("  - SpellSlot");
    expect(result).toContain("hl-punct");
  });

  it("highlights quoted strings in list items", () => {
    const result = highlightYaml('  - "some value"');
    expect(result).toContain("hl-string");
  });

  it("returns escaped text for plain text lines", () => {
    const result = highlightYaml("just some text <>");
    expect(result).toBe("just some text &lt;&gt;");
  });

  it("handles empty string", () => {
    expect(highlightYaml("")).toBe("");
  });

  it("handles key with hyphen", () => {
    const result = highlightYaml("  my-key: val");
    expect(result).toContain("hl-key");
  });
});

// ── highlightJson (syntaxHighlight.ts) ───────────────────────────────

describe("highlightJson (syntaxHighlight.ts)", () => {
  it("highlights a key with colon", () => {
    const result = highlightJson('"UUID": "abc"');
    expect(result).toContain("hl-key");
  });

  it("highlights a standalone string value", () => {
    const result = highlightJson('"hello"');
    expect(result).toContain("hl-string");
  });

  it("highlights booleans", () => {
    const result = highlightJson("true");
    expect(result).toContain("hl-bool");
  });

  it("highlights null", () => {
    const result = highlightJson("null");
    expect(result).toContain("hl-bool");
  });

  it("highlights numbers", () => {
    const result = highlightJson("42");
    expect(result).toContain("hl-num");
  });

  it("highlights floating point numbers", () => {
    const result = highlightJson("3.14");
    expect(result).toContain("hl-num");
  });

  it("highlights scientific notation", () => {
    const result = highlightJson("1e10");
    expect(result).toContain("hl-num");
  });

  it("highlights punctuation", () => {
    const result = highlightJson("{}");
    expect(result).toContain("hl-punct");
  });

  it("highlights brackets and commas", () => {
    const result = highlightJson("[1, 2]");
    expect(result).toContain("hl-punct");
  });

  it("escapes text between tokens", () => {
    const result = highlightJson('< "key": 1 >');
    expect(result).toContain("&lt;");
    expect(result).toContain("&gt;");
  });

  it("handles trailing text after last token", () => {
    const result = highlightJson('"x" end');
    expect(result).toContain("hl-string");
    expect(result).toContain("end");
  });

  it("handles empty string", () => {
    expect(highlightJson("")).toBe("");
  });
});

// ── highlightLua ─────────────────────────────────────────────────────

describe("highlightLua", () => {
  it("highlights full-line comment", () => {
    const result = highlightLua("  -- this is a comment");
    expect(result).toContain("hl-comment");
  });

  it("highlights inline comment", () => {
    const result = highlightLua("x = 1 -- inline");
    expect(result).toContain("hl-comment");
  });

  it("highlights double-quoted strings", () => {
    const result = highlightLua('"hello world"');
    expect(result).toContain("hl-string");
  });

  it("highlights single-quoted strings", () => {
    const result = highlightLua("'hello'");
    expect(result).toContain("hl-string");
  });

  it("highlights keywords", () => {
    for (const kw of ["local", "function", "end", "if", "then", "else", "return", "nil", "true", "false"]) {
      const result = highlightLua(kw);
      expect(result).toContain("hl-keyword");
    }
  });

  it("highlights numbers", () => {
    const result = highlightLua("42");
    expect(result).toContain("hl-num");
  });

  it("highlights floating point", () => {
    const result = highlightLua("3.14");
    expect(result).toContain("hl-num");
  });

  it("preserves plain text between tokens", () => {
    const result = highlightLua("x = local y");
    expect(result).toContain("x = ");
    expect(result).toContain("hl-keyword");
  });

  it("handles empty string", () => {
    expect(highlightLua("")).toBe("");
  });
});

// ── highlightMarkdown ────────────────────────────────────────────────

describe("highlightMarkdown", () => {
  it("highlights headings", () => {
    const result = highlightMarkdown("# Title");
    expect(result).toContain("hl-md-heading");
  });

  it("highlights h3 headings", () => {
    const result = highlightMarkdown("### Sub heading");
    expect(result).toContain("hl-md-heading");
  });

  it("highlights bold text", () => {
    const result = highlightMarkdown("some **bold** text");
    expect(result).toContain("hl-md-bold");
  });

  it("highlights italic text", () => {
    const result = highlightMarkdown("some *italic* text");
    expect(result).toContain("hl-md-italic");
  });

  it("highlights inline code", () => {
    const result = highlightMarkdown("use `code` here");
    expect(result).toContain("hl-md-code");
  });

  it("highlights links", () => {
    const result = highlightMarkdown("[text](http://example.com)");
    expect(result).toContain("hl-md-link");
  });

  it("returns escaped text for plain lines", () => {
    const result = highlightMarkdown("just text <>");
    expect(result).toContain("&lt;");
  });

  it("handles empty string", () => {
    expect(highlightMarkdown("")).toBe("");
  });
});

// ── hlXmlAttrs ───────────────────────────────────────────────────────

describe("hlXmlAttrs", () => {
  it("returns empty string for empty input", () => {
    expect(hlXmlAttrs("")).toBe("");
  });

  it("highlights a single attribute", () => {
    const result = hlXmlAttrs(' id="test"');
    expect(result).toContain("hl-attr");
    expect(result).toContain("hl-punct");
    expect(result).toContain("hl-string");
  });

  it("highlights multiple attributes", () => {
    const result = hlXmlAttrs(' id="a" class="b"');
    // Two attr spans
    const matches = result.match(/hl-attr/g);
    expect(matches?.length).toBe(2);
  });

  it("handles namespaced attributes", () => {
    const result = hlXmlAttrs(' xml:lang="en"');
    expect(result).toContain("hl-attr");
  });

  it("escapes text between attributes", () => {
    const result = hlXmlAttrs(' <gap> id="x"');
    expect(result).toContain("&lt;gap&gt;");
  });

  it("preserves trailing text after last attr", () => {
    const result = hlXmlAttrs(' id="x" />');
    expect(result).toContain("hl-attr");
    // trailing " />" is escaped
    expect(result).toContain("/&gt;");
  });
});

// ── highlightXml ─────────────────────────────────────────────────────

describe("highlightXml (syntaxHighlight.ts)", () => {
  it("highlights XML comments", () => {
    const result = highlightXml("<!-- comment -->");
    expect(result).toContain("hl-comment");
  });

  it("highlights processing instructions", () => {
    const result = highlightXml('<?xml version="1.0"?>');
    expect(result).toContain("hl-punct");
    expect(result).toContain("hl-keyword");
  });

  it("highlights opening tags", () => {
    const result = highlightXml("<region>");
    expect(result).toContain("hl-key");
    expect(result).toContain("hl-punct");
  });

  it("highlights closing tags", () => {
    const result = highlightXml("</region>");
    expect(result).toContain("hl-key");
    expect(result).toContain("hl-punct");
  });

  it("highlights self-closing tags with attributes", () => {
    const result = highlightXml('<node id="root" />');
    expect(result).toContain("hl-key");
    expect(result).toContain("hl-attr");
    expect(result).toContain("hl-string");
  });

  it("highlights tag with attributes", () => {
    const result = highlightXml('<attribute id="UUID" type="guid" value="abc-123" />');
    expect(result).toContain("hl-key");
    expect(result).toContain("hl-attr");
  });

  it("escapes plain text content", () => {
    const result = highlightXml("some & text");
    expect(result).toContain("&amp;");
  });

  it("handles empty string", () => {
    expect(highlightXml("")).toBe("");
  });

  it("handles PI that doesn't match detailed pattern", () => {
    // Malformed PI — falls through to esc()
    const result = highlightXml("<?>");
    expect(result).toBeDefined();
  });

  it("handles tag that doesn't match detailed pattern", () => {
    // A '<' followed by text that doesn't match the tag regex
    const result = highlightXml("< notag");
    expect(result).toBeDefined();
  });
});

// ── highlightOsiris ──────────────────────────────────────────────────

describe("highlightOsiris", () => {
  it("highlights full-line comment", () => {
    const result = highlightOsiris("  // comment");
    expect(result).toContain("hl-comment");
  });

  it("highlights inline comment", () => {
    const result = highlightOsiris("INITSECTION // start");
    expect(result).toContain("hl-comment");
    expect(result).toContain("hl-keyword");
  });

  it("highlights keywords", () => {
    for (const kw of ["INITSECTION", "KBSECTION", "EXITSECTION", "ENDEXITSECTION", "IF", "THEN", "AND", "NOT", "EVENTS", "Version", "SubGoalCombiner", "SGC_AND", "ParentTargetEdge", "PROC", "QRY"]) {
      const result = highlightOsiris(kw);
      expect(result).toContain("hl-keyword");
    }
  });

  it("highlights DB_/PROC_/QRY_ identifiers", () => {
    expect(highlightOsiris("DB_MyDB")).toContain("hl-key");
    expect(highlightOsiris("PROC_MyProc")).toContain("hl-key");
    expect(highlightOsiris("QRY_MyQuery")).toContain("hl-key");
  });

  it("highlights type names", () => {
    for (const t of ["STRING", "INTEGER", "REAL", "GUIDSTRING", "CHARACTERGUID", "ITEMGUID"]) {
      const result = highlightOsiris(t);
      expect(result).toContain("hl-attr");
    }
  });

  it("highlights numbers", () => {
    expect(highlightOsiris("42")).toContain("hl-num");
    expect(highlightOsiris("3.14")).toContain("hl-num");
  });

  it("highlights strings", () => {
    expect(highlightOsiris('"hello"')).toContain("hl-string");
  });

  it("handles plain text", () => {
    const result = highlightOsiris("someName");
    // No special tokens, just escaped
    expect(result).toBe("someName");
  });

  it("highlights section keywords", () => {
    expect(highlightOsiris("Version 1")).toContain("hl-keyword");
    expect(highlightOsiris("SubGoalCombiner SGC_AND")).toContain("hl-keyword");
    expect(highlightOsiris("INITSECTION")).toContain("hl-keyword");
    expect(highlightOsiris("KBSECTION")).toContain("hl-keyword");
    expect(highlightOsiris("ParentTargetEdge")).toContain("hl-keyword");
  });

  it("highlights type casts like (CHARACTER)_Var", () => {
    const result = highlightOsiris('(CHARACTER)_Player');
    expect(result).toContain("hl-attr");
  });

  it("highlights GUIDs", () => {
    const result = highlightOsiris("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
    expect(result).toContain("hl-string");
  });

  it("highlights additional type keywords", () => {
    for (const t of ["INTEGER64", "ACTION", "PASSIVEID", "TAG", "SPLINEGUID", "LEVELTEMPLATEGUID"]) {
      expect(highlightOsiris(t)).toContain("hl-attr");
    }
  });

  it("highlights bare PROC and QRY keywords", () => {
    expect(highlightOsiris("PROC")).toContain("hl-keyword");
    expect(highlightOsiris("QRY")).toContain("hl-keyword");
  });

  it("does not leak comment highlighting into next content", () => {
    // Comments only go to end of line
    const line1 = highlightOsiris("// comment");
    const line2 = highlightOsiris("THEN");
    expect(line1).toContain("hl-comment");
    expect(line2).toContain("hl-keyword");
    expect(line2).not.toContain("hl-comment");
  });

  it("handles empty string", () => {
    expect(highlightOsiris("")).toBe("");
  });
});

// ── highlightKhonsu ─────────────────────────────────────────────────

describe("highlightKhonsu", () => {
  it("highlights full-line comment", () => {
    const result = highlightKhonsu("  -- comment");
    expect(result).toContain("hl-comment");
  });

  it("highlights inline comment", () => {
    const result = highlightKhonsu("x = 1 -- note");
    expect(result).toContain("hl-comment");
  });

  it("highlights Lua keywords", () => {
    expect(highlightKhonsu("local x")).toContain("hl-keyword");
    expect(highlightKhonsu("function foo")).toContain("hl-keyword");
    expect(highlightKhonsu("return true")).toContain("hl-keyword");
  });

  it("highlights Khonsu-specific condition functions", () => {
    for (const fn of ["ConditionResult", "HasPassive", "HasStatus", "HasSpell", "IsClass"]) {
      const result = highlightKhonsu(fn);
      expect(result).toContain("hl-key");
    }
  });

  it("highlights bitwise operators", () => {
    expect(highlightKhonsu("a & b")).toContain("hl-punct");
    expect(highlightKhonsu("a | b")).toContain("hl-punct");
    expect(highlightKhonsu("~x")).toContain("hl-punct");
    expect(highlightKhonsu("a << 2")).toContain("hl-punct");
    expect(highlightKhonsu("a >> 1")).toContain("hl-punct");
  });

  it("highlights strings", () => {
    expect(highlightKhonsu('"test"')).toContain("hl-string");
    expect(highlightKhonsu("'test'")).toContain("hl-string");
  });

  it("highlights numbers", () => {
    expect(highlightKhonsu("42")).toContain("hl-num");
  });

  it("highlights context object paths", () => {
    expect(highlightKhonsu("context.Source")).toContain("hl-attr");
    expect(highlightKhonsu("context.Target.Level")).toContain("hl-attr");
  });

  it("highlights additional condition functions", () => {
    for (const fn of ["Tagged", "GetDistanceTo", "WieldingWeapon", "SpellId", "IsSpellOfSchool", "Self", "Ally", "Enemy", "Dead"]) {
      expect(highlightKhonsu(fn)).toContain("hl-key");
    }
  });

  it("highlights ConditionResult with true/false", () => {
    const result = highlightKhonsu("ConditionResult(true)");
    expect(result).toContain("hl-key");  // ConditionResult
    expect(result).toContain("hl-keyword");  // true
  });

  it("handles empty string", () => {
    expect(highlightKhonsu("")).toBe("");
  });
});

// ── highlightFrameworkLua ────────────────────────────────────────────

describe("highlightFrameworkLua", () => {
  it("highlights full-line comment", () => {
    const result = highlightFrameworkLua("  -- comment");
    expect(result).toContain("hl-comment");
  });

  it("highlights inline comment", () => {
    const result = highlightFrameworkLua("x = 1 -- note");
    expect(result).toContain("hl-comment");
  });

  it("highlights Lua keywords", () => {
    expect(highlightFrameworkLua("local x")).toContain("hl-keyword");
  });

  it("highlights framework-specific keywords", () => {
    for (const kw of ["State", "Config", "Proxy", "AnubisModule", "StateRef", "Action", "Selector", "ImmediateSelector", "Sequence", "Parallel", "RandomSelector", "TriggerOutput", "ExtSocket"]) {
      const result = highlightFrameworkLua(kw);
      expect(result).toContain("hl-key");
    }
  });

  it("highlights strings", () => {
    expect(highlightFrameworkLua('"test"')).toContain("hl-string");
    expect(highlightFrameworkLua("'test'")).toContain("hl-string");
  });

  it("highlights numbers", () => {
    expect(highlightFrameworkLua("42")).toContain("hl-num");
  });

  it("preserves plain text between tokens", () => {
    const result = highlightFrameworkLua("myVar = local x");
    expect(result).toContain("myVar = ");
  });

  it("handles empty string", () => {
    expect(highlightFrameworkLua("")).toBe("");
  });
});

// ── highlightLine (dispatcher) ───────────────────────────────────────

describe("highlightLine", () => {
  it("dispatches yaml", () => {
    const result = highlightLine("  key: value", "yaml");
    expect(result).toContain("hl-key");
  });

  it("dispatches yml alias", () => {
    const result = highlightLine("  key: value", "yml");
    expect(result).toContain("hl-key");
  });

  it("dispatches json", () => {
    const result = highlightLine('"key": 1', "json");
    expect(result).toContain("hl-key");
  });

  it("dispatches lua", () => {
    const result = highlightLine("local x", "lua");
    expect(result).toContain("hl-keyword");
  });

  it("dispatches md", () => {
    const result = highlightLine("# Title", "md");
    expect(result).toContain("hl-md-heading");
  });

  it("dispatches xml", () => {
    const result = highlightLine("<tag>", "xml");
    expect(result).toContain("hl-key");
  });

  it("dispatches lsx as xml", () => {
    const result = highlightLine("<tag>", "lsx");
    expect(result).toContain("hl-key");
  });

  it("dispatches osiris", () => {
    const result = highlightLine("INITSECTION", "osiris");
    expect(result).toContain("hl-keyword");
  });

  it("dispatches khn as Khonsu", () => {
    const result = highlightLine("ConditionResult", "khn");
    expect(result).toContain("hl-key");
  });

  it("dispatches anubis as framework lua", () => {
    const result = highlightLine("State", "anubis");
    expect(result).toContain("hl-key");
  });

  it("dispatches constellations as framework lua", () => {
    const result = highlightLine("Config", "constellations");
    expect(result).toContain("hl-key");
  });

  it("falls back to esc for unknown language", () => {
    const result = highlightLine("<b>test</b>", "unknown");
    expect(result).toBe("&lt;b&gt;test&lt;/b&gt;");
  });

  it("handles empty string in unknown language", () => {
    expect(highlightLine("", "whatever")).toBe("");
  });
});
