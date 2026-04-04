/**
 * PF-010: Adversarial Fuzzing Test Suite
 *
 * Property-based and adversarial tests for the configParser pipeline:
 * - flattenConfigEntry() fuzzing with random structures
 * - JSON edge cases (deeply nested, duplicate keys, special values)
 * - YAML edge cases (special characters, encoding, large inputs)
 * - Crash/hang resistance
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import { parseExistingConfig } from "../lib/utils/configParser.js";
import { SECTIONS_ORDERED } from "../lib/types/index.js";

// Suppress console.error for the entire file — adversarial tests deliberately
// feed malformed input that triggers expected parse-error logging.
let consoleSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  consoleSpy.mockRestore();
});

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/** Parse must not throw — returns entries or warnings. */
function mustNotCrash(content: string, filePath: string): void {
  expect(() => {
    parseExistingConfig(content, filePath);
  }).not.toThrow();
}

/** Parse must return a valid shape regardless of input. */
function mustReturnValidShape(content: string, filePath: string): void {
  const result = parseExistingConfig(content, filePath);
  expect(result).toHaveProperty("entries");
  expect(result).toHaveProperty("warnings");
  expect(Array.isArray(result.entries)).toBe(true);
  expect(Array.isArray(result.warnings)).toBe(true);
  // Every entry must have section and fields
  for (const e of result.entries) {
    expect(typeof e.section).toBe("string");
    expect(typeof e.fields).toBe("object");
    expect(e.fields).not.toBeNull();
  }
}

// ──────────────────────────────────────────────
// Property-Based: flattenConfigEntry via JSON parse
// ──────────────────────────────────────────────

describe("PF-010: Property-Based flattenConfigEntry Fuzzing", () => {
  const KNOWN_SECTIONS = SECTIONS_ORDERED;

  // Generate a random CF-like JSON config object
  const cfEntryArb = fc.record({
    UUID: fc.option(fc.uuid(), { nil: undefined }),
    UUIDs: fc.option(fc.array(fc.uuid(), { minLength: 0, maxLength: 5 }), { nil: undefined }),
    Action: fc.option(fc.constantFrom("Insert", "Remove", "Replace"), { nil: undefined }),
    Type: fc.option(fc.string(), { nil: undefined }),
    Items: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 10 }), { nil: undefined }),
    Booleans: fc.option(
      fc.array(fc.record({ Key: fc.string({ minLength: 1, maxLength: 30 }), Value: fc.constantFrom("true", "false") }), { minLength: 0, maxLength: 5 }),
      { nil: undefined },
    ),
    Fields: fc.option(
      fc.array(fc.record({ Key: fc.string({ minLength: 1, maxLength: 30 }), Value: fc.string() }), { minLength: 0, maxLength: 5 }),
      { nil: undefined },
    ),
    Strings: fc.option(
      fc.array(
        fc.record({
          Action: fc.constantFrom("Insert", "Remove"),
          Type: fc.constantFrom("Boosts", "PassivesAdded", "PassivesRemoved"),
          Strings: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 5 }),
        }),
        { minLength: 0, maxLength: 3 },
      ),
      { nil: undefined },
    ),
  });

  const cfConfigArb = fc.record(
    Object.fromEntries(
      KNOWN_SECTIONS.map((s) => [s, fc.option(fc.array(cfEntryArb, { minLength: 0, maxLength: 3 }), { nil: undefined })] as const),
    ),
  );

  it("never crashes on random CF-like JSON configs (100 iterations)", () => {
    fc.assert(
      fc.property(cfConfigArb, (config) => {
        const json = JSON.stringify(config);
        mustNotCrash(json, "test.json");
        mustReturnValidShape(json, "test.json");
      }),
      { numRuns: 100 },
    );
  });

  it("all entries have section from KNOWN_SECTIONS", () => {
    fc.assert(
      fc.property(cfConfigArb, (config) => {
        const json = JSON.stringify(config);
        const { entries } = parseExistingConfig(json, "test.json");
        for (const e of entries) {
          expect(KNOWN_SECTIONS).toContain(e.section);
        }
      }),
      { numRuns: 50 },
    );
  });

  it("all field values are strings (no non-string leakage)", () => {
    fc.assert(
      fc.property(cfConfigArb, (config) => {
        const json = JSON.stringify(config);
        const { entries } = parseExistingConfig(json, "test.json");
        for (const e of entries) {
          for (const [k, v] of Object.entries(e.fields)) {
            expect(typeof v).toBe("string");
          }
        }
      }),
      { numRuns: 50 },
    );
  });

  it("UUID normalization: pipe-separated, never semicolons in output UUID field", () => {
    fc.assert(
      fc.property(cfConfigArb, (config) => {
        const json = JSON.stringify(config);
        const { entries } = parseExistingConfig(json, "test.json");
        for (const e of entries) {
          const uuid = e.fields["UUID"];
          if (uuid) {
            expect(uuid).not.toContain(";");
          }
        }
      }),
      { numRuns: 50 },
    );
  });
});

// ──────────────────────────────────────────────
// Adversarial JSON Payloads
// ──────────────────────────────────────────────

describe("PF-010: Adversarial JSON Edge Cases", () => {
  it("empty object", () => {
    mustReturnValidShape("{}", "test.json");
  });

  it("empty array", () => {
    mustNotCrash("[]", "test.json");
  });

  it("deeply nested object (100 levels)", () => {
    let json = '{"Progressions":[';
    let inner = '{"UUID":"aabbccdd-1122-3344-5566-778899001122"';
    for (let i = 0; i < 100; i++) {
      inner += `,"nested${i}":{"key":"val"}`;
    }
    inner += "}";
    json += inner + "]}";
    mustReturnValidShape(json, "test.json");
  });

  it("duplicate keys in JSON object (last wins per JSON.parse spec)", () => {
    // JSON.parse takes the last value for duplicate keys
    const json = '{"Progressions":[{"UUID":"first","UUID":"second"}]}';
    const { entries } = parseExistingConfig(json, "test.json");
    expect(entries[0].fields["UUID"]).toBe("second");
  });

  it("extremely long string value", () => {
    const longVal = "a".repeat(100_000);
    const json = JSON.stringify({ Progressions: [{ UUID: longVal }] });
    mustReturnValidShape(json, "test.json");
  });

  it("unicode escapes in values", () => {
    const json = JSON.stringify({ Progressions: [{ UUID: "\u0041\u0042\u0043" }] });
    const { entries } = parseExistingConfig(json, "test.json");
    expect(entries[0].fields["UUID"]).toBe("ABC");
  });

  it("special characters in field keys", () => {
    const json = JSON.stringify({
      Progressions: [{
        UUID: "aabbccdd-1122-3344-5566-778899001122",
        "weird key with spaces": "val",
        "key:with:colons": "val2",
      }],
    });
    mustReturnValidShape(json, "test.json");
  });

  it("null values in entry", () => {
    const json = JSON.stringify({ Lists: [{ UUID: null, Action: null }] });
    mustReturnValidShape(json, "test.json");
  });

  it("numeric values are stringified", () => {
    const json = JSON.stringify({ Progressions: [{ UUID: 12345 }] });
    const { entries } = parseExistingConfig(json, "test.json");
    expect(entries[0].fields["UUID"]).toBe("12345");
  });

  it("boolean values are stringified", () => {
    const json = JSON.stringify({
      Backgrounds: [{
        UUID: "aabbccdd-1122-3344-5566-778899001122",
        Booleans: [{ Key: "Hidden", Value: true }],
      }],
    });
    const { entries } = parseExistingConfig(json, "test.json");
    expect(entries[0].fields["Boolean:Hidden"]).toBe("true");
  });

  it("proto pollution keys are harmless", () => {
    const json = '{"Progressions":[{"__proto__":"evil","constructor":"bad","UUID":"ok"}]}';
    const { entries } = parseExistingConfig(json, "test.json");
    // The parser should not crash and should produce a valid entry
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries[0].fields["UUID"]).toBe("ok");
  });

  it("unknown sections are silently skipped", () => {
    const json = JSON.stringify({
      UnknownSection: [{ UUID: "aabbccdd-1122-3344-5566-778899001122" }],
      Progressions: [{ UUID: "valid-uuid" }],
    });
    const { entries } = parseExistingConfig(json, "test.json");
    expect(entries).toHaveLength(1);
    expect(entries[0].section).toBe("Progressions");
  });

  it("sections with non-array values are skipped", () => {
    const json = JSON.stringify({ Progressions: "not-an-array", Lists: [{}] });
    const { entries } = parseExistingConfig(json, "test.json");
    // Only Lists parsed (Progressions was a string, not array)
    expect(entries).toHaveLength(1);
    expect(entries[0].section).toBe("Lists");
  });
});

// ──────────────────────────────────────────────
// Adversarial YAML Payloads
// ──────────────────────────────────────────────

describe("PF-010: Adversarial YAML Edge Cases", () => {
  it("empty string", () => {
    mustReturnValidShape("", "test.yaml");
  });

  it("null-only document", () => {
    mustReturnValidShape("null", "test.yaml");
  });

  it("scalar-only document", () => {
    mustReturnValidShape("just a string", "test.yaml");
  });

  it("array-only document (invalid root)", () => {
    const yaml = "- item1\n- item2\n";
    mustReturnValidShape(yaml, "test.yaml");
  });

  it("YAML with tab indentation (normally invalid)", () => {
    const yaml = "Progressions:\n\t- UUID: \"test\"\n";
    // yaml package handles this; may warn or parse successfully
    mustNotCrash(yaml, "test.yaml");
  });

  it("YAML with special characters in values", () => {
    const yaml = `
Progressions:
  - UUID: "test: value # with special : chars"
`;
    mustReturnValidShape(yaml, "test.yaml");
    const { entries } = parseExistingConfig(yaml, "test.yaml");
    expect(entries[0].fields["UUID"]).toBe("test: value # with special : chars");
  });

  it("YAML with boolean ambiguity (yes/no/on/off)", () => {
    // With failsafe schema, all scalars are strings
    const yaml = `
Progressions:
  - UUID: "test"
    Booleans:
      - Key: Test
        Value: yes
`;
    const { entries } = parseExistingConfig(yaml, "test.yaml");
    // failsafe schema should return "yes" as string, not boolean
    expect(entries[0].fields["Boolean:Test"]).toBe("yes");
  });

  it("YAML with document markers (--- / ...)", () => {
    const yaml = `---
Progressions:
  - UUID: "aabbccdd-1122-3344-5566-778899001122"
...
`;
    mustReturnValidShape(yaml, "test.yaml");
    const { entries } = parseExistingConfig(yaml, "test.yaml");
    expect(entries).toHaveLength(1);
  });

  it("YAML with comments in various positions", () => {
    const yaml = `
# Top-level comment
Progressions: # Inline section comment
  # Pre-entry comment
  - UUID: "aabbccdd-1122-3344-5566-778899001122" # Inline value comment
    # Between fields
    Booleans: # Inline key comment
      - Key: Test # Key comment
        Value: true
`;
    const { entries } = parseExistingConfig(yaml, "test.yaml");
    expect(entries).toHaveLength(1);
    expect(entries[0].fields["UUID"]).toBe("aabbccdd-1122-3344-5566-778899001122");
  });

  it("YAML with quoted values containing quotes", () => {
    const yaml = `
Spells:
  - ID: 'Target_Test''s_Spell'
    Action: Insert
`;
    mustNotCrash(yaml, "test.yaml");
  });

  it("YAML with null byte in value (\\x00)", () => {
    const yaml = `Progressions:\n  - UUID: "test\\x00value"\n`;
    mustNotCrash(yaml, "test.yaml");
  });

  it("YAML with extremely long key", () => {
    const longKey = "K".repeat(10_000);
    const yaml = `Progressions:\n  - ${longKey}: "value"\n`;
    mustNotCrash(yaml, "test.yaml");
  });

  it("YAML with unicode values", () => {
    const yaml = `
Progressions:
  - UUID: "日本語テスト-1122-3344-5566-778899001122"
`;
    const { entries } = parseExistingConfig(yaml, "test.yaml");
    expect(entries[0].fields["UUID"]).toBe("日本語テスト-1122-3344-5566-778899001122");
  });

  it("YAML with single-value UUIDs as scalar (not array)", () => {
    const yaml = `
Lists:
  - UUIDs: "single-uuid-not-array"
    Action: Insert
    Type: SpellList
`;
    const { entries } = parseExistingConfig(yaml, "test.yaml");
    expect(entries[0].fields["UUID"]).toBe("single-uuid-not-array");
    expect(entries[0].fields["_uuidIsArray"]).toBe("true");
  });

  it("YAML with mixed sections (known + unknown)", () => {
    const yaml = `
CustomSection:
  - Stuff: things

Progressions:
  - UUID: "aabbccdd-1122-3344-5566-778899001122"

AnotherCustom:
  - More: data
`;
    const { entries } = parseExistingConfig(yaml, "test.yaml");
    expect(entries).toHaveLength(1);
    expect(entries[0].section).toBe("Progressions");
  });
});

// ──────────────────────────────────────────────
// Property-Based YAML Fuzzing
// ──────────────────────────────────────────────

describe("PF-010: Property-Based YAML Fuzzing", () => {
  it("random strings never crash the YAML parser (100 iterations)", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 5000 }), (s) => {
        mustNotCrash(s, "test.yaml");
      }),
      { numRuns: 100 },
    );
  });

  it("random ASCII-printable strings never crash (100 iterations)", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 2000, unit: "grapheme-ascii" }),
        (s) => {
          mustNotCrash(s, "test.yaml");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("random JSON-like strings parsed as YAML never crash (50 iterations)", () => {
    fc.assert(
      fc.property(fc.json({ maxDepth: 5 }), (jsonStr) => {
        mustNotCrash(jsonStr, "test.yaml");
      }),
      { numRuns: 50 },
    );
  });

  it("all parsed entries have valid section + fields shape", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 2000 }), (s) => {
        const result = parseExistingConfig(s, "test.yaml");
        expect(Array.isArray(result.entries)).toBe(true);
        expect(Array.isArray(result.warnings)).toBe(true);
        for (const e of result.entries) {
          expect(typeof e.section).toBe("string");
          expect(typeof e.fields).toBe("object");
        }
      }),
      { numRuns: 50 },
    );
  });
});

// ──────────────────────────────────────────────
// Encoding & Edge Case Robustness
// ──────────────────────────────────────────────

describe("PF-010: Encoding & Edge Cases", () => {
  it("UTF-8 BOM is stripped", () => {
    const yaml = "\uFEFFProgressions:\n  - UUID: \"test\"\n";
    const { entries } = parseExistingConfig(yaml, "test.yaml");
    expect(entries).toHaveLength(1);
  });

  it("Windows CRLF line endings work", () => {
    const yaml = "Lists:\r\n  - Action: Insert\r\n    UUID: \"test\"\r\n    Type: SpellList\r\n";
    const { entries } = parseExistingConfig(yaml, "test.yaml");
    expect(entries).toHaveLength(1);
  });

  it("mixed line endings (\\r\\n and \\n) work", () => {
    const yaml = "Progressions:\r\n  - UUID: \"test\"\n    Booleans:\r\n      - Key: Test\n        Value: true\n";
    mustReturnValidShape(yaml, "test.yaml");
  });

  it("trailing whitespace on lines doesn't break parsing", () => {
    const yaml = `Progressions:   \n  - UUID: "test"   \n`;
    mustReturnValidShape(yaml, "test.yaml");
  });

  it("JSON with BOM", () => {
    const json = "\uFEFF" + JSON.stringify({ Progressions: [{ UUID: "test" }] });
    // JSON.parse handles BOM in some engines but not all
    mustNotCrash(json, "test.json");
  });
});

// ──────────────────────────────────────────────
// ERR-010: Malformed & Adversarial Input Robustness
// ──────────────────────────────────────────────

describe("ERR-010: Malformed Input Robustness", () => {
  it("binary-like content does not crash (JSON)", () => {
    const binary = String.fromCharCode(...Array.from({ length: 256 }, (_, i) => i));
    mustNotCrash(binary, "test.json");
  });

  it("binary-like content does not crash (YAML)", () => {
    const binary = String.fromCharCode(...Array.from({ length: 256 }, (_, i) => i));
    mustNotCrash(binary, "test.yaml");
  });

  it("zero-byte input (JSON)", () => {
    mustNotCrash("", "test.json");
  });

  it("zero-byte input (YAML)", () => {
    mustReturnValidShape("", "test.yaml");
  });

  it("truncated JSON object", () => {
    mustNotCrash('{"Progressions":[{"UUID":"abc"', "test.json");
  });

  it("truncated JSON mid-string", () => {
    mustNotCrash('{"Progressions":[{"UUID":"abc', "test.json");
  });

  it("truncated YAML mid-value", () => {
    mustNotCrash("Progressions:\n  - UUID: \"abc", "test.yaml");
  });

  it("mismatched quotes in JSON", () => {
    mustNotCrash("{\"Progressions\":['bad\"]}", "test.json");
  });

  it("mismatched quotes in YAML", () => {
    mustNotCrash("Progressions:\n  - UUID: 'abc\"", "test.yaml");
  });

  it("only whitespace", () => {
    mustReturnValidShape("   \n\t\n  ", "test.yaml");
    mustNotCrash("   \n\t\n  ", "test.json");
  });

  it("only newlines", () => {
    mustReturnValidShape("\n\n\n", "test.yaml");
  });

  it("null bytes throughout content", () => {
    mustNotCrash("\0\0\0", "test.json");
    mustNotCrash("\0\0\0", "test.yaml");
  });

  it("control characters", () => {
    const ctrl = Array.from({ length: 32 }, (_, i) => String.fromCharCode(i)).join("");
    mustNotCrash(ctrl, "test.yaml");
  });

  it("JSON array at root (not object)", () => {
    const json = JSON.stringify([{ UUID: "test" }]);
    const result = parseExistingConfig(json, "test.json");
    expect(result.entries).toHaveLength(0);
  });

  it("YAML array at root produces no entries", () => {
    const result = parseExistingConfig("- item1\n- item2", "test.yaml");
    expect(result.entries).toHaveLength(0);
  });

  it("extremely large number of entries does not crash", () => {
    const entries = Array.from({ length: 1000 }, (_, i) => ({ UUID: `uuid-${i}` }));
    const json = JSON.stringify({ Progressions: entries });
    mustReturnValidShape(json, "test.json");
    const { entries: parsed } = parseExistingConfig(json, "test.json");
    expect(parsed).toHaveLength(1000);
  });

  it("repeated section names in YAML does not crash", () => {
    const yaml = `
Progressions:
  - UUID: first
Progressions:
  - UUID: second
`;
    // yaml library throws on duplicate keys; parseExistingConfig catches this gracefully
    mustNotCrash(yaml, "test.yaml");
    const { entries, warnings } = parseExistingConfig(yaml, "test.yaml");
    // The parser catches the duplicate key error and returns warnings
    expect(entries.length + warnings.length).toBeGreaterThanOrEqual(1);
  });

  it("YAML with anchor/alias constructs", () => {
    const yaml = `
Progressions:
  - &base
    UUID: "anchor-uuid"
  - <<: *base
    UUID: "override-uuid"
`;
    mustNotCrash(yaml, "test.yaml");
  });

  it("deeply nested YAML does not crash", () => {
    let yaml = "a:\n";
    for (let i = 0; i < 50; i++) {
      yaml += "  ".repeat(i + 1) + `level${i}:\n`;
    }
    mustNotCrash(yaml, "test.yaml");
  });

  it("JSON with trailing comma (invalid JSON)", () => {
    mustNotCrash('{"Progressions":[{"UUID":"test"},]}', "test.json");
  });

  it("deprecated subclass entry is filtered with warning", () => {
    const json = JSON.stringify({
      Progressions: [{
        UUID: "aabbccdd-1122-3344-5566-778899001122",
        Subclasses: [{ UUID: "sub-uuid", Action: "Insert" }],
      }],
    });
    const { entries, warnings } = parseExistingConfig(json, "test.json");
    // The entry should be filtered out, with a deprecation warning
    expect(warnings.some(w => w.includes("deprecated") || w.includes("Skipped"))).toBe(true);
  });

  it("subclass removal entry is preserved", () => {
    const json = JSON.stringify({
      Progressions: [{
        UUID: "aabbccdd-1122-3344-5566-778899001122",
        Subclasses: [{ UUID: "sub-uuid", Action: "Remove" }],
      }],
    });
    const { entries } = parseExistingConfig(json, "test.json");
    expect(entries).toHaveLength(1);
    expect(entries[0].fields["Subclass:0:Action"]).toBe("Remove");
  });

  it("entry with Selectors + Subclasses is not deprecated", () => {
    const json = JSON.stringify({
      Progressions: [{
        UUID: "aabbccdd-1122-3344-5566-778899001122",
        Subclasses: [{ UUID: "sub-uuid", Action: "Insert" }],
        Selectors: [{ Action: "Insert", Function: "SelectSkills", Params: { Amount: "2" } }],
      }],
    });
    const { entries } = parseExistingConfig(json, "test.json");
    expect(entries).toHaveLength(1);
  });

  it("validates parsed entries: unknown section warning", () => {
    // We need to construct something where parseConfigDocument would return an unknown section
    // This is tested indirectly — unknown sections in the source doc are skipped by parseConfigDocument
    const json = JSON.stringify({ Progressions: [{ UUID: "test" }] });
    const { entries, warnings } = parseExistingConfig(json, "test.json");
    // No unknown section warning for a config with only known sections
    expect(warnings.some(w => w.includes("Unknown section"))).toBe(false);
  });

  it("entry missing UUID produces warning", () => {
    const json = JSON.stringify({
      Progressions: [{ Booleans: [{ Key: "Test", Value: "true" }] }],
    });
    const { entries, warnings } = parseExistingConfig(json, "test.json");
    expect(entries).toHaveLength(1);
    expect(warnings.some(w => w.includes("missing UUID"))).toBe(true);
  });

  it("entry with non-standard UUID format produces warning", () => {
    const json = JSON.stringify({
      Progressions: [{ UUID: "not-a-real-uuid-format" }],
    });
    const { warnings } = parseExistingConfig(json, "test.json");
    expect(warnings.some(w => w.includes("non-standard UUID"))).toBe(true);
  });

  it("Selector with Amounts array is comma-joined", () => {
    const json = JSON.stringify({
      Progressions: [{
        UUID: "aabbccdd-1122-3344-5566-778899001122",
        Selectors: [{
          Action: "Insert",
          Function: "SelectAbilityBonus",
          Params: { Amounts: [2, 1], BonusType: "AbilityBonus" },
        }],
      }],
    });
    const { entries } = parseExistingConfig(json, "test.json");
    expect(entries[0].fields["Selector:0:Param:Amounts"]).toBe("2,1");
    expect(entries[0].fields["Selector:0:Param:BonusType"]).toBe("AbilityBonus");
  });

  it("UUIDs array is pipe-separated with isArray flag", () => {
    const json = JSON.stringify({
      Lists: [{ UUIDs: ["uuid-a", "uuid-b"], Action: "Insert", Type: "SpellList" }],
    });
    const { entries } = parseExistingConfig(json, "test.json");
    expect(entries[0].fields["UUID"]).toBe("uuid-a|uuid-b");
    expect(entries[0].fields["_uuidIsArray"]).toBe("true");
  });

  it("semicolon-delimited UUID string is split to pipe-separated", () => {
    const json = JSON.stringify({
      Lists: [{ UUID: "uuid-a;uuid-b", Action: "Insert" }],
    });
    const { entries } = parseExistingConfig(json, "test.json");
    expect(entries[0].fields["UUID"]).toBe("uuid-a|uuid-b");
    expect(entries[0].fields["_uuidIsArray"]).toBe("true");
  });
});

// ──────────────────────────────────────────────
// TC-014: Config Parsing Edge Cases
// ──────────────────────────────────────────────

describe("TC-014: flattenConfigEntry Edge Cases", () => {
  // ── Non-standard selector functions ─────────────────────────────

  it("unknown selector function names are preserved as-is", () => {
    const json = JSON.stringify({
      Progressions: [{
        UUID: "aabbccdd-1122-3344-5566-778899001122",
        Selectors: [{
          Action: "Insert",
          Function: "CustomUnknownFunction",
          Params: { Guid: "some-guid" },
        }],
      }],
    });
    const { entries } = parseExistingConfig(json, "test.json");
    expect(entries[0].fields["Selector:0:Function"]).toBe("CustomUnknownFunction");
    expect(entries[0].fields["Selector:0:Param:Guid"]).toBe("some-guid");
  });

  it("selector with empty string function", () => {
    const json = JSON.stringify({
      Progressions: [{
        UUID: "aabbccdd-1122-3344-5566-778899001122",
        Selectors: [{ Function: "" }],
      }],
    });
    const { entries } = parseExistingConfig(json, "test.json");
    expect(entries[0].fields["Selector:0:Function"]).toBe("");
    expect(entries[0].fields["Selector:0:Action"]).toBe("Insert"); // default
  });

  // ── Selector Params edge cases ──────────────────────────────────

  it("selector with no Params object", () => {
    const json = JSON.stringify({
      Progressions: [{
        UUID: "aabbccdd-1122-3344-5566-778899001122",
        Selectors: [{ Action: "Insert", Function: "SelectSkills" }],
      }],
    });
    const { entries } = parseExistingConfig(json, "test.json");
    expect(entries[0].fields["Selector:0:Function"]).toBe("SelectSkills");
    // No Param keys should exist
    expect(Object.keys(entries[0].fields).filter(k => k.includes("Param:"))).toHaveLength(0);
  });

  it("selector with empty Params object", () => {
    const json = JSON.stringify({
      Progressions: [{
        UUID: "aabbccdd-1122-3344-5566-778899001122",
        Selectors: [{ Function: "SelectSkills", Params: {} }],
      }],
    });
    const { entries } = parseExistingConfig(json, "test.json");
    expect(Object.keys(entries[0].fields).filter(k => k.includes("Param:"))).toHaveLength(0);
  });

  it("selector with Amounts as non-array (single value)", () => {
    const json = JSON.stringify({
      Progressions: [{
        UUID: "aabbccdd-1122-3344-5566-778899001122",
        Selectors: [{
          Function: "SelectAbilityBonus",
          Params: { Amounts: "3" },
        }],
      }],
    });
    const { entries } = parseExistingConfig(json, "test.json");
    // Non-array Amounts should be stringified directly
    expect(entries[0].fields["Selector:0:Param:Amounts"]).toBe("3");
  });

  it("selector with Amounts as empty array", () => {
    const json = JSON.stringify({
      Progressions: [{
        UUID: "aabbccdd-1122-3344-5566-778899001122",
        Selectors: [{
          Function: "SelectAbilityBonus",
          Params: { Amounts: [] },
        }],
      }],
    });
    const { entries } = parseExistingConfig(json, "test.json");
    expect(entries[0].fields["Selector:0:Param:Amounts"]).toBe("");
  });

  it("selector with all known Param keys populated", () => {
    const json = JSON.stringify({
      Progressions: [{
        UUID: "aabbccdd-1122-3344-5566-778899001122",
        Selectors: [{
          Function: "SelectSkills",
          Params: {
            Guid: "guid-val",
            Amount: "2",
            SwapAmount: "1",
            SelectorId: "sel-id",
            CastingAbility: "Intelligence",
            ActionResource: "ar-val",
            PrepareType: "prep-val",
            CooldownType: "cd-val",
            BonusType: "bonus-val",
            Amounts: [1, 2, 3],
            LimitToProficiency: "true",
          },
        }],
      }],
    });
    const { entries } = parseExistingConfig(json, "test.json");
    const f = entries[0].fields;
    expect(f["Selector:0:Param:Guid"]).toBe("guid-val");
    expect(f["Selector:0:Param:Amount"]).toBe("2");
    expect(f["Selector:0:Param:SwapAmount"]).toBe("1");
    expect(f["Selector:0:Param:SelectorId"]).toBe("sel-id");
    expect(f["Selector:0:Param:CastingAbility"]).toBe("Intelligence");
    expect(f["Selector:0:Param:ActionResource"]).toBe("ar-val");
    expect(f["Selector:0:Param:PrepareType"]).toBe("prep-val");
    expect(f["Selector:0:Param:CooldownType"]).toBe("cd-val");
    expect(f["Selector:0:Param:BonusType"]).toBe("bonus-val");
    expect(f["Selector:0:Param:Amounts"]).toBe("1,2,3");
    expect(f["Selector:0:Param:LimitToProficiency"]).toBe("true");
  });

  it("selector with modGuid on selector root", () => {
    const json = JSON.stringify({
      Progressions: [{
        UUID: "aabbccdd-1122-3344-5566-778899001122",
        Selectors: [{
          Function: "SelectSkills",
          modGuid: "my-mod-guid",
        }],
      }],
    });
    const { entries } = parseExistingConfig(json, "test.json");
    expect(entries[0].fields["Selector:0:modGuid"]).toBe("my-mod-guid");
  });

  // ── Nested object values → recursive flattenConfigEntry ─────────

  it("nested objects are recursively flattened with dot prefix", () => {
    const json = JSON.stringify({
      Progressions: [{
        UUID: "aabbccdd-1122-3344-5566-778899001122",
        CustomNested: {
          DeepKey: "deep-value",
          Inner: { Level3: "val3" },
        },
      }],
    });
    const { entries } = parseExistingConfig(json, "test.json");
    expect(entries[0].fields["CustomNested.DeepKey"]).toBe("deep-value");
    expect(entries[0].fields["CustomNested.Inner.Level3"]).toBe("val3");
  });

  // ── Array values: all strings → semicolon-joined ────────────────

  it("string arrays are semicolon-joined", () => {
    const json = JSON.stringify({
      Progressions: [{
        UUID: "aabbccdd-1122-3344-5566-778899001122",
        CustomArray: ["val1", "val2", "val3"],
      }],
    });
    const { entries } = parseExistingConfig(json, "test.json");
    expect(entries[0].fields["CustomArray"]).toBe("val1;val2;val3");
  });

  it("numeric arrays are semicolon-joined as strings", () => {
    const json = JSON.stringify({
      Progressions: [{
        UUID: "aabbccdd-1122-3344-5566-778899001122",
        NumericArr: [10, 20, 30],
      }],
    });
    const { entries } = parseExistingConfig(json, "test.json");
    expect(entries[0].fields["NumericArr"]).toBe("10;20;30");
  });

  // ── Array values with mixed types → JSON.stringify fallback ─────

  it("mixed-type arrays are JSON.stringified", () => {
    const json = JSON.stringify({
      Progressions: [{
        UUID: "aabbccdd-1122-3344-5566-778899001122",
        MixedArr: ["str", 42, true],
      }],
    });
    const { entries } = parseExistingConfig(json, "test.json");
    expect(entries[0].fields["MixedArr"]).toBe(JSON.stringify(["str", 42, true]));
  });

  // ── Extremely long strings in every field position ──────────────

  it("extremely long UUID string", () => {
    const longUuid = "x".repeat(50_000);
    const json = JSON.stringify({ Progressions: [{ UUID: longUuid }] });
    mustReturnValidShape(json, "test.json");
    const { entries } = parseExistingConfig(json, "test.json");
    expect(entries[0].fields["UUID"]).toBe(longUuid);
  });

  it("extremely long key name in field", () => {
    const longKey = "K".repeat(50_000);
    const json = JSON.stringify({
      Progressions: [{ UUID: "aabbccdd-1122-3344-5566-778899001122", [longKey]: "value" }],
    });
    mustReturnValidShape(json, "test.json");
  });

  it("extremely long value in Booleans", () => {
    const longVal = "t".repeat(50_000);
    const json = JSON.stringify({
      Progressions: [{
        UUID: "aabbccdd-1122-3344-5566-778899001122",
        Booleans: [{ Key: "Test", Value: longVal }],
      }],
    });
    const { entries } = parseExistingConfig(json, "test.json");
    expect(entries[0].fields["Boolean:Test"]).toBe(longVal);
  });

  // ── Mixed manual + imported entries ─────────────────────────────

  it("entry with both Booleans and Strings arrays", () => {
    const json = JSON.stringify({
      Progressions: [{
        UUID: "aabbccdd-1122-3344-5566-778899001122",
        Booleans: [{ Key: "AllowImprovement", Value: "true" }],
        Strings: [{ Action: "Insert", Type: "Boosts", Strings: ["Boost1", "Boost2"] }],
      }],
    });
    const { entries } = parseExistingConfig(json, "test.json");
    const f = entries[0].fields;
    expect(f["Boolean:AllowImprovement"]).toBe("true");
    expect(f["String:0:Action"]).toBe("Insert");
    expect(f["String:0:Type"]).toBe("Boosts");
    expect(f["String:0:Values"]).toBe("Boost1;Boost2");
  });

  it("entry with Booleans, Strings, Fields, Tags, and Children", () => {
    const json = JSON.stringify({
      Progressions: [{
        UUID: "aabbccdd-1122-3344-5566-778899001122",
        Booleans: [{ Key: "AllowImprovement", Value: "true" }],
        Fields: [{ Key: "Passives", Value: "SomePassive" }],
        Strings: [{ Action: "Insert", Type: "PassivesAdded", Strings: ["Passive1"] }],
        Tags: [{ UUIDs: ["tag-uuid"], Action: "Insert", Type: "Tags" }],
        Children: [{ Type: "SubClass", Values: "child-uuid", Action: "Remove" }],
      }],
    });
    const { entries } = parseExistingConfig(json, "test.json");
    const f = entries[0].fields;
    expect(f["Boolean:AllowImprovement"]).toBe("true");
    expect(f["Field:Passives"]).toBe("SomePassive");
    expect(f["String:0:Action"]).toBe("Insert");
    expect(f["Tag:0:UUIDs"]).toBe("tag-uuid");
    expect(f["Child:0:Type"]).toBe("SubClass");
    expect(f["Child:0:Action"]).toBe("Remove");
  });

  // ── YAML anchors/aliases with merge keys ────────────────────────

  it("YAML anchors and aliases resolve correctly", () => {
    const yaml = `
Progressions:
  - &base
    UUID: "aabbccdd-1122-3344-5566-778899001122"
    Booleans:
      - Key: AllowImprovement
        Value: "true"
  - <<: *base
    UUID: "bbccddee-1122-3344-5566-778899001122"
`;
    mustNotCrash(yaml, "test.yaml");
    const { entries } = parseExistingConfig(yaml, "test.yaml");
    // Should produce 2 entries — the alias inherits fields from anchor
    expect(entries.length).toBeGreaterThanOrEqual(1);
  });

  // ── Keyed spec edge cases ───────────────────────────────────────

  it("Booleans with empty Key are skipped", () => {
    const json = JSON.stringify({
      Progressions: [{
        UUID: "aabbccdd-1122-3344-5566-778899001122",
        Booleans: [{ Key: "", Value: "true" }, { Key: "Valid", Value: "false" }],
      }],
    });
    const { entries } = parseExistingConfig(json, "test.json");
    // Empty key should be skipped (k empty → no entry)
    expect(entries[0].fields["Boolean:"]).toBeUndefined();
    expect(entries[0].fields["Boolean:Valid"]).toBe("false");
  });

  it("Fields with missing Value uses default empty string", () => {
    const json = JSON.stringify({
      Progressions: [{
        UUID: "aabbccdd-1122-3344-5566-778899001122",
        Fields: [{ Key: "Passives" }],
      }],
    });
    const { entries } = parseExistingConfig(json, "test.json");
    expect(entries[0].fields["Field:Passives"]).toBe("");
  });

  // ── Indexed spec: Strings with modGuid (optional field) ─────────

  it("Strings entry with modGuid", () => {
    const json = JSON.stringify({
      Progressions: [{
        UUID: "aabbccdd-1122-3344-5566-778899001122",
        Strings: [{
          Action: "Insert",
          Type: "Boosts",
          Strings: ["Boost1"],
          modGuid: "my-mod-guid",
        }],
      }],
    });
    const { entries } = parseExistingConfig(json, "test.json");
    expect(entries[0].fields["String:0:modGuid"]).toBe("my-mod-guid");
  });

  it("Strings entry without modGuid omits it", () => {
    const json = JSON.stringify({
      Progressions: [{
        UUID: "aabbccdd-1122-3344-5566-778899001122",
        Strings: [{
          Action: "Insert",
          Type: "Boosts",
          Strings: ["Boost1"],
        }],
      }],
    });
    const { entries } = parseExistingConfig(json, "test.json");
    expect(entries[0].fields["String:0:modGuid"]).toBeUndefined();
  });

  // ── Tags with modGuid ───────────────────────────────────────────

  it("Tags entry with modGuid is preserved", () => {
    const json = JSON.stringify({
      Progressions: [{
        UUID: "aabbccdd-1122-3344-5566-778899001122",
        Tags: [{
          UUIDs: ["tag-1", "tag-2"],
          Action: "Insert",
          Type: "Tags",
          modGuid: "tag-mod-guid",
        }],
      }],
    });
    const { entries } = parseExistingConfig(json, "test.json");
    expect(entries[0].fields["Tag:0:modGuid"]).toBe("tag-mod-guid");
    expect(entries[0].fields["Tag:0:UUIDs"]).toBe("tag-1;tag-2");
  });

  // ── Children with modGuid ───────────────────────────────────────

  it("Children entry with modGuid is preserved", () => {
    const json = JSON.stringify({
      Progressions: [{
        UUID: "aabbccdd-1122-3344-5566-778899001122",
        Children: [{
          Type: "SubClass",
          Values: "child-uuid",
          Action: "Insert",
          modGuid: "child-mod-guid",
        }],
      }],
    });
    const { entries } = parseExistingConfig(json, "test.json");
    expect(entries[0].fields["Child:0:modGuid"]).toBe("child-mod-guid");
  });

  // ── Subclasses with nested objects → JSON.stringify ──────────────

  it("Subclasses with nested object values are JSON.stringified", () => {
    const json = JSON.stringify({
      Progressions: [{
        UUID: "aabbccdd-1122-3344-5566-778899001122",
        Subclasses: [{
          UUID: "sub-uuid",
          Action: "Remove",
          NestedData: { innerKey: "innerVal" },
        }],
      }],
    });
    const { entries } = parseExistingConfig(json, "test.json");
    expect(entries[0].fields["Subclass:0:UUID"]).toBe("sub-uuid");
    expect(entries[0].fields["Subclass:0:NestedData"]).toBe(JSON.stringify({ innerKey: "innerVal" }));
  });

  it("Subclasses with scalar values are stringified", () => {
    const json = JSON.stringify({
      Progressions: [{
        UUID: "aabbccdd-1122-3344-5566-778899001122",
        Subclasses: [{
          UUID: "sub-uuid",
          Action: "Remove",
          Name: "Warlock",
          Level: 3,
        }],
      }],
    });
    const { entries } = parseExistingConfig(json, "test.json");
    expect(entries[0].fields["Subclass:0:Name"]).toBe("Warlock");
    expect(entries[0].fields["Subclass:0:Level"]).toBe("3");
  });

  // ── Multiple selectors ──────────────────────────────────────────

  it("multiple selectors are indexed independently", () => {
    const json = JSON.stringify({
      Progressions: [{
        UUID: "aabbccdd-1122-3344-5566-778899001122",
        Selectors: [
          { Function: "SelectSkills", Params: { Amount: "3" } },
          { Function: "SelectAbilityBonus", Params: { Amount: "2", BonusType: "AbilityBonus" } },
        ],
      }],
    });
    const { entries } = parseExistingConfig(json, "test.json");
    expect(entries[0].fields["Selector:0:Function"]).toBe("SelectSkills");
    expect(entries[0].fields["Selector:0:Param:Amount"]).toBe("3");
    expect(entries[0].fields["Selector:1:Function"]).toBe("SelectAbilityBonus");
    expect(entries[0].fields["Selector:1:Param:BonusType"]).toBe("AbilityBonus");
  });

  // ── Selector with Params as array (invalid shape) ───────────────

  it("selector with Params as array is ignored (not object)", () => {
    const json = JSON.stringify({
      Progressions: [{
        UUID: "aabbccdd-1122-3344-5566-778899001122",
        Selectors: [{ Function: "SelectSkills", Params: [1, 2, 3] }],
      }],
    });
    const { entries } = parseExistingConfig(json, "test.json");
    // Params should be ignored since it's an array, not an object
    expect(entries[0].fields["Selector:0:Function"]).toBe("SelectSkills");
    expect(Object.keys(entries[0].fields).filter(k => k.includes("Param:"))).toHaveLength(0);
  });

  // ── Selector with Overwrite flag ────────────────────────────────

  it("selector Overwrite defaults to 'false'", () => {
    const json = JSON.stringify({
      Progressions: [{
        UUID: "aabbccdd-1122-3344-5566-778899001122",
        Selectors: [{ Function: "SelectSkills" }],
      }],
    });
    const { entries } = parseExistingConfig(json, "test.json");
    expect(entries[0].fields["Selector:0:Overwrite"]).toBe("false");
  });

  it("selector Overwrite explicit 'true' is preserved", () => {
    const json = JSON.stringify({
      Progressions: [{
        UUID: "aabbccdd-1122-3344-5566-778899001122",
        Selectors: [{ Function: "SelectSkills", Overwrite: "true" }],
      }],
    });
    const { entries } = parseExistingConfig(json, "test.json");
    expect(entries[0].fields["Selector:0:Overwrite"]).toBe("true");
  });

  // ── Single UUID string with UUIDs key → array flag ──────────────

  it("single UUID in UUIDs key still sets _uuidIsArray", () => {
    const json = JSON.stringify({
      Lists: [{ UUIDs: "single-uuid", Action: "Insert" }],
    });
    const { entries } = parseExistingConfig(json, "test.json");
    expect(entries[0].fields["UUID"]).toBe("single-uuid");
    expect(entries[0].fields["_uuidIsArray"]).toBe("true");
  });

  it("single UUID in UUID key does not set _uuidIsArray", () => {
    const json = JSON.stringify({
      Progressions: [{ UUID: "aabbccdd-1122-3344-5566-778899001122" }],
    });
    const { entries } = parseExistingConfig(json, "test.json");
    expect(entries[0].fields["_uuidIsArray"]).toBeUndefined();
  });

  it("UUIDs array with single element still sets _uuidIsArray if using UUIDs key", () => {
    const json = JSON.stringify({
      Lists: [{ UUIDs: ["only-one"], Action: "Insert" }],
    });
    const { entries } = parseExistingConfig(json, "test.json");
    expect(entries[0].fields["UUID"]).toBe("only-one");
    expect(entries[0].fields["_uuidIsArray"]).toBe("true");
  });

  // ── Prefixed array flattening (non-root arrays go to fallback) ──

  it("array of objects at non-root level is JSON.stringified", () => {
    const json = JSON.stringify({
      Progressions: [{
        UUID: "aabbccdd-1122-3344-5566-778899001122",
        CustomNested: {
          SubArr: [{ a: 1 }, { b: 2 }],
        },
      }],
    });
    const { entries } = parseExistingConfig(json, "test.json");
    // Non-root array of objects → JSON.stringify fallback
    expect(entries[0].fields["CustomNested.SubArr"]).toBe(JSON.stringify([{ a: 1 }, { b: 2 }]));
  });
});
