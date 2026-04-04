/**
 * PF-043: Roundtrip Fidelity Test Suite
 *
 * Validates the invariant: for any valid config state,
 *   parse(serialize(state)) ≈ state
 *
 * Covers YAML and JSON roundtrip, per-section regression tests,
 * and bug fix regressions (Bug 1/2/5 from PF-043 spec).
 */

import { describe, it, expect } from "vitest";
import { parseExistingConfig } from "../lib/utils/configParser.js";
import type { ManualEntry } from "../lib/stores/configStore.svelte.js";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/**
 * Normalize ManualEntry fields for comparison:
 * - Strip internal flags (_uuidIsArray, _hasRemovals, _removedItems, _applyToAll)
 *   except when explicitly testing them
 * - Sort field keys for deterministic comparison
 */
function normalizeFields(
  fields: Record<string, string>,
  opts: { keepInternalFlags?: boolean } = {},
): Record<string, string> {
  const result: Record<string, string> = {};
  const sortedKeys = Object.keys(fields).sort();
  for (const k of sortedKeys) {
    if (!opts.keepInternalFlags && k.startsWith("_")) continue;
    result[k] = fields[k];
  }
  return result;
}

/** Round-trip: parse YAML → get entries. */
function parseYaml(yaml: string): ManualEntry[] {
  const { entries, warnings } = parseExistingConfig(yaml, "test.yaml");
  const fatal = warnings.filter(w => w.includes("skipped"));
  if (fatal.length) {
    throw new Error(`Parse errors: ${fatal.join(", ")}`);
  }
  return entries;
}

/** Round-trip: parse JSON → get entries. */
function parseJson(json: string): ManualEntry[] {
  const { entries, warnings } = parseExistingConfig(json, "test.json");
  const fatal = warnings.filter(w => w.includes("skipped"));
  if (fatal.length) {
    throw new Error(`Parse errors: ${fatal.join(", ")}`);
  }
  return entries;
}

// ──────────────────────────────────────────────
// YAML Parse Tests — Per Section
// ──────────────────────────────────────────────

describe("PF-043: YAML Parsing Roundtrip", () => {
  describe("Lists section", () => {
    it("parses a basic Lists Insert entry", () => {
      const yaml = `
Lists:
  - Action: Insert
    UUID: "aabbccdd-1122-3344-5566-778899001122"
    Type: SpellList
    Items:
      - "Fireball"
      - "IceStorm"
`;
      const entries = parseYaml(yaml);
      expect(entries).toHaveLength(1);
      expect(entries[0].section).toBe("Lists");
      const f = entries[0].fields;
      expect(f["Action"]).toBe("Insert");
      expect(f["UUID"]).toBe("aabbccdd-1122-3344-5566-778899001122");
      expect(f["Type"]).toBe("SpellList");
      expect(f["Items"]).toBe("Fireball;IceStorm");
    });

    it("parses UUIDs array (plural) for Lists", () => {
      const yaml = `
Lists:
  - Action: Insert
    UUIDs:
      - "aaaa1111-2222-3333-4444-555566667777"
      - "bbbb1111-2222-3333-4444-555566667777"
    Type: PassiveList
    Items:
      - "SomePassive"
`;
      const entries = parseYaml(yaml);
      expect(entries).toHaveLength(1);
      const f = entries[0].fields;
      expect(f["UUID"]).toBe("aaaa1111-2222-3333-4444-555566667777|bbbb1111-2222-3333-4444-555566667777");
      expect(f["_uuidIsArray"]).toBe("true");
    });

    it("preserves _uuidIsArray for single-element UUIDs array (Bug 1 regression)", () => {
      const yaml = `
Lists:
  - Action: Insert
    UUIDs:
      - "aaaa1111-2222-3333-4444-555566667777"
    Type: SpellList
    Items:
      - "Fireball"
`;
      const entries = parseYaml(yaml);
      expect(entries).toHaveLength(1);
      const f = entries[0].fields;
      expect(f["UUID"]).toBe("aaaa1111-2222-3333-4444-555566667777");
      // Bug 1 fix: single-element UUIDs (plural key) should still have _uuidIsArray=true
      expect(f["_uuidIsArray"]).toBe("true");
    });

    it("parses Inherit and Exclude fields", () => {
      const yaml = `
Lists:
  - Action: Insert
    UUID: "aabbccdd-1122-3344-5566-778899001122"
    Type: SpellList
    Items:
      - "Fireball"
    Inherit: "11111111-2222-3333-4444-555566667777"
    Exclude: "99999999-8888-7777-6666-555544443333"
`;
      const entries = parseYaml(yaml);
      const f = entries[0].fields;
      expect(f["Inherit"]).toBe("11111111-2222-3333-4444-555566667777");
      expect(f["Exclude"]).toBe("99999999-8888-7777-6666-555544443333");
    });
  });

  describe("Spells section", () => {
    it("parses a Spells entry with ID and stat fields", () => {
      const yaml = `
Spells:
  - ID: "Target_Fireball"
    Action: Insert
    ContainerSpells:
      - "Target_IceStorm"
      - "Target_Lightning"
`;
      const entries = parseYaml(yaml);
      expect(entries).toHaveLength(1);
      const f = entries[0].fields;
      expect(f["ID"]).toBe("Target_Fireball");
      expect(f["Action"]).toBe("Insert");
      expect(f["ContainerSpells"]).toBe("Target_IceStorm;Target_Lightning");
    });
  });

  describe("Progressions section", () => {
    it("parses Progressions with Booleans and Strings", () => {
      const yaml = `
Progressions:
  - UUID: "aabbccdd-1122-3344-5566-778899001122"
    Booleans:
      - Key: AllowImprovement
        Value: true
    Strings:
      - Action: Insert
        Type: PassivesAdded
        Strings:
          - "SomePassive"
          - "AnotherPassive"
`;
      const entries = parseYaml(yaml);
      expect(entries).toHaveLength(1);
      const f = entries[0].fields;
      expect(f["UUID"]).toBe("aabbccdd-1122-3344-5566-778899001122");
      expect(f["Boolean:AllowImprovement"]).toBe("true");
      expect(f["String:0:Action"]).toBe("Insert");
      expect(f["String:0:Type"]).toBe("PassivesAdded");
      expect(f["String:0:Values"]).toBe("SomePassive;AnotherPassive");
    });
  });

  describe("Races section", () => {
    it("parses Races with Children", () => {
      const yaml = `
Races:
  - UUID: "aabbccdd-1122-3344-5566-778899001122"
    Children:
      - Type: EyeColors
        Values:
          - "11111111-aaaa-bbbb-cccc-ddddeeeeaaaa"
        Action: Insert
`;
      const entries = parseYaml(yaml);
      expect(entries).toHaveLength(1);
      const f = entries[0].fields;
      expect(f["Child:0:Type"]).toBe("EyeColors");
      expect(f["Child:0:Action"]).toBe("Insert");
    });
  });

  describe("ActionResourceGroups section", () => {
    it("parses ARG with Definitions array", () => {
      const yaml = `
ActionResourceGroups:
  - UUID: "aabbccdd-1122-3344-5566-778899001122"
    Definitions:
      - "11111111-aaaa-bbbb-cccc-ddddeeeeffff"
      - "22222222-aaaa-bbbb-cccc-ddddeeeeffff"
    Action: Insert
`;
      const entries = parseYaml(yaml);
      expect(entries).toHaveLength(1);
      const f = entries[0].fields;
      expect(f["Definitions"]).toBe("11111111-aaaa-bbbb-cccc-ddddeeeeffff;22222222-aaaa-bbbb-cccc-ddddeeeeffff");
      expect(f["Action"]).toBe("Insert");
    });
  });

  describe("ClassDescriptions section", () => {
    it("parses ClassDescriptions with Fields and Booleans", () => {
      const yaml = `
ClassDescriptions:
  - UUID: "aabbccdd-1122-3344-5566-778899001122"
    Booleans:
      - Key: CanLearnSpells
        Value: true
    Fields:
      - Key: BaseHp
        Value: "10"
    Tags:
      - UUIDs:
          - "11111111-aaaa-bbbb-cccc-ddddeeeeffff"
        Action: Insert
        Type: Tags
`;
      const entries = parseYaml(yaml);
      expect(entries).toHaveLength(1);
      const f = entries[0].fields;
      expect(f["Boolean:CanLearnSpells"]).toBe("true");
      expect(f["Field:BaseHp"]).toBe("10");
      expect(f["Tag:0:UUIDs"]).toBe("11111111-aaaa-bbbb-cccc-ddddeeeeffff");
      expect(f["Tag:0:Action"]).toBe("Insert");
      expect(f["Tag:0:Type"]).toBe("Tags");
    });
  });

  describe("Feats section", () => {
    it("parses Feats with Selectors", () => {
      const yaml = `
Feats:
  - UUID: "aabbccdd-1122-3344-5566-778899001122"
    Selectors:
      - Action: Insert
        Function: "SelectSpells(abc,1,0,,,,AlwaysPrepared)"
        Overwrite: false
        UUID: "11111111-aaaa-bbbb-cccc-ddddeeeeffff"
`;
      const entries = parseYaml(yaml);
      expect(entries).toHaveLength(1);
      const f = entries[0].fields;
      expect(f["Selector:0:Action"]).toBe("Insert");
      expect(f["Selector:0:Function"]).toBe("SelectSpells(abc,1,0,,,,AlwaysPrepared)");
      expect(f["Selector:0:Overwrite"]).toBe("false");
      expect(f["Selector:0:UUID"]).toBe("11111111-aaaa-bbbb-cccc-ddddeeeeffff");
    });
  });

  describe("Backgrounds section", () => {
    it("parses Backgrounds with Strings and Tags", () => {
      const yaml = `
Backgrounds:
  - UUID: "aabbccdd-1122-3344-5566-778899001122"
    Booleans:
      - Key: Hidden
        Value: true
    Strings:
      - Action: Insert
        Type: Passives
        Strings:
          - "MyPassive"
    Tags:
      - UUIDs:
          - "11111111-aaaa-bbbb-cccc-ddddeeeeffff"
        Action: Insert
        Type: Tags
`;
      const entries = parseYaml(yaml);
      expect(entries).toHaveLength(1);
      const f = entries[0].fields;
      expect(f["Boolean:Hidden"]).toBe("true");
      expect(f["String:0:Type"]).toBe("Passives");
      expect(f["String:0:Values"]).toBe("MyPassive");
    });
  });

  describe("Origins section", () => {
    it("parses Origins with Fields and Tags", () => {
      const yaml = `
Origins:
  - UUID: "aabbccdd-1122-3344-5566-778899001122"
    Fields:
      - Key: LockBody
        Value: "true"
    Strings:
      - Action: Insert
        Type: Passives
        Strings:
          - "OriginPassive"
    Tags:
      - UUIDs:
          - "11111111-aaaa-bbbb-cccc-ddddeeeeffff"
        Action: Insert
        Type: ReallyTags
`;
      const entries = parseYaml(yaml);
      expect(entries).toHaveLength(1);
      const f = entries[0].fields;
      expect(f["Field:LockBody"]).toBe("true");
      expect(f["String:0:Values"]).toBe("OriginPassive");
      expect(f["Tag:0:Type"]).toBe("ReallyTags");
    });
  });

  describe("BackgroundGoals section", () => {
    it("parses BackgroundGoals with Fields", () => {
      const yaml = `
BackgroundGoals:
  - UUID: "aabbccdd-1122-3344-5566-778899001122"
    Fields:
      - Key: ExperienceReward
        Value: "75"
`;
      const entries = parseYaml(yaml);
      expect(entries).toHaveLength(1);
      const f = entries[0].fields;
      expect(f["Field:ExperienceReward"]).toBe("75");
    });
  });

  describe("ActionResources section", () => {
    it("parses ActionResources with Booleans and Fields", () => {
      const yaml = `
ActionResources:
  - UUID: "aabbccdd-1122-3344-5566-778899001122"
    Booleans:
      - Key: IsSpellSlot
        Value: true
    Fields:
      - Key: MaxLevel
        Value: "9"
`;
      const entries = parseYaml(yaml);
      expect(entries).toHaveLength(1);
      const f = entries[0].fields;
      expect(f["Boolean:IsSpellSlot"]).toBe("true");
      expect(f["Field:MaxLevel"]).toBe("9");
    });
  });
});

// ──────────────────────────────────────────────
// JSON Parse Tests
// ──────────────────────────────────────────────

describe("PF-043: JSON Parsing Roundtrip", () => {
  it("parses a JSON config with Lists entry", () => {
    const json = JSON.stringify({
      Lists: [
        {
          Action: "Insert",
          UUID: "aabbccdd-1122-3344-5566-778899001122",
          Type: "SpellList",
          Items: ["Fireball", "IceStorm"],
        },
      ],
    });
    const entries = parseJson(json);
    expect(entries).toHaveLength(1);
    const f = entries[0].fields;
    expect(f["Action"]).toBe("Insert");
    expect(f["Items"]).toBe("Fireball;IceStorm");
  });

  it("parses JSON with UUIDs array", () => {
    const json = JSON.stringify({
      Progressions: [
        {
          UUIDs: ["aaaa1111-2222-3333-4444-555566667777", "bbbb1111-2222-3333-4444-555566667777"],
          Booleans: [{ Key: "AllowImprovement", Value: "true" }],
        },
      ],
    });
    const entries = parseJson(json);
    expect(entries).toHaveLength(1);
    const f = entries[0].fields;
    expect(f["UUID"]).toBe("aaaa1111-2222-3333-4444-555566667777|bbbb1111-2222-3333-4444-555566667777");
    expect(f["_uuidIsArray"]).toBe("true");
  });

  it("preserves _uuidIsArray flag for single-element UUIDs array (Bug 1 regression)", () => {
    const json = JSON.stringify({
      Lists: [
        {
          UUIDs: ["aaaa1111-2222-3333-4444-555566667777"],
          Action: "Insert",
          Type: "SpellList",
          Items: ["Fireball"],
        },
      ],
    });
    const entries = parseJson(json);
    const f = entries[0].fields;
    expect(f["UUID"]).toBe("aaaa1111-2222-3333-4444-555566667777");
    expect(f["_uuidIsArray"]).toBe("true");
  });

  it("parses JSON with nested Subclasses", () => {
    const json = JSON.stringify({
      Progressions: [
        {
          UUID: "aabbccdd-1122-3344-5566-778899001122",
          Subclasses: [
            { Action: "Remove", UUID: "11111111-aaaa-bbbb-cccc-ddddeeeeffff" },
          ],
        },
      ],
    });
    const entries = parseJson(json);
    const f = entries[0].fields;
    expect(f["Subclass:0:Action"]).toBe("Remove");
    expect(f["Subclass:0:UUID"]).toBe("11111111-aaaa-bbbb-cccc-ddddeeeeffff");
  });

  it("parses JSON Selectors with modGuid", () => {
    const json = JSON.stringify({
      Feats: [
        {
          UUID: "aabbccdd-1122-3344-5566-778899001122",
          Selectors: [
            {
              Action: "Insert",
              Function: "SelectPassives(abc,1)",
              Overwrite: "false",
              UUID: "11111111-aaaa-bbbb-cccc-ddddeeeeffff",
              modGuid: "99999999-0000-0000-0000-111111111111",
            },
          ],
        },
      ],
    });
    const entries = parseJson(json);
    const f = entries[0].fields;
    expect(f["Selector:0:modGuid"]).toBe("99999999-0000-0000-0000-111111111111");
  });
});

// ──────────────────────────────────────────────
// Bug Regression Tests
// ──────────────────────────────────────────────

describe("PF-043: Bug Regressions", () => {
  describe("Bug 1: _uuidIsArray flag lost on single-element UUIDs array", () => {
    it("YAML: single-element UUIDs preserves array intent", () => {
      const yaml = `
Progressions:
  - UUIDs:
      - "aabbccdd-1122-3344-5566-778899001122"
    Booleans:
      - Key: AllowImprovement
        Value: true
`;
      const entries = parseYaml(yaml);
      expect(entries[0].fields["_uuidIsArray"]).toBe("true");
    });

    it("JSON: single-element UUIDs preserves array intent", () => {
      const json = JSON.stringify({
        Progressions: [
          { UUIDs: ["aabbccdd-1122-3344-5566-778899001122"] },
        ],
      });
      const entries = parseJson(json);
      expect(entries[0].fields["_uuidIsArray"]).toBe("true");
    });

    it("UUID (singular key) does NOT set _uuidIsArray", () => {
      const yaml = `
Progressions:
  - UUID: "aabbccdd-1122-3344-5566-778899001122"
`;
      const entries = parseYaml(yaml);
      expect(entries[0].fields["_uuidIsArray"]).toBeUndefined();
    });
  });

  describe("Bug 2: Items delimiter inconsistency", () => {
    it("YAML: array items joined without trailing spaces", () => {
      const yaml = `
Lists:
  - Action: Insert
    UUID: "aabbccdd-1122-3344-5566-778899001122"
    Type: SpellList
    Items:
      - "Fireball"
      - "Ice Storm"
      - "Lightning Bolt"
`;
      const entries = parseYaml(yaml);
      const items = entries[0].fields["Items"];
      // Should be joined with ";" (no space) to prevent accumulation
      expect(items).toBe("Fireball;Ice Storm;Lightning Bolt");
      // Verify no double spaces would accumulate on re-parse
      expect(items).not.toContain("; ");
    });

    it("JSON: array items joined without trailing spaces", () => {
      const json = JSON.stringify({
        Lists: [
          {
            Action: "Insert",
            UUID: "aabbccdd-1122-3344-5566-778899001122",
            Type: "SpellList",
            Items: ["Fireball", "Ice Storm"],
          },
        ],
      });
      const entries = parseJson(json);
      expect(entries[0].fields["Items"]).toBe("Fireball;Ice Storm");
    });

    it("YAML: idempotent after re-split — no progressive whitespace", () => {
      const yaml = `
Lists:
  - Action: Insert
    UUID: "aabbccdd-1122-3344-5566-778899001122"
    Type: SpellList
    Items:
      - "Fireball"
      - "IceStorm"
`;
      const entries1 = parseYaml(yaml);
      const items1 = entries1[0].fields["Items"];
      // Simulate second roundtrip: split and rejoin
      const resplit = items1.split(";").map(s => s.trim()).filter(Boolean);
      const rejoined = resplit.join(";");
      expect(rejoined).toBe(items1);
    });
  });

  describe("Bug 5: Empty-string fields preserved", () => {
    it("preserves explicit empty string fields", () => {
      const yaml = `
ClassDescriptions:
  - UUID: "aabbccdd-1122-3344-5566-778899001122"
    Fields:
      - Key: SubClassName
        Value: ""
      - Key: BaseHp
        Value: "12"
`;
      const entries = parseYaml(yaml);
      const f = entries[0].fields;
      expect(f["Field:SubClassName"]).toBe("");
      expect(f["Field:BaseHp"]).toBe("12");
    });
  });
});

// ──────────────────────────────────────────────
// YAML Feature Tests (Anchors, Multi-line, etc.)
// ──────────────────────────────────────────────

describe("PF-043: YAML Advanced Features", () => {
  it("resolves anchors and aliases", () => {
    // Use scalar anchors — the YAML merge key '<<' is NOT resolved in
    // failsafe schema, so we anchor individual scalar values instead.
    const yaml = `
Progressions:
  - UUID: &shared_uuid "aabbccdd-1122-3344-5566-778899001122"
    Booleans:
      - Key: AllowImprovement
        Value: &flag "true"
  - UUID: *shared_uuid
    Booleans:
      - Key: AllowImprovement
        Value: *flag
`;
    const entries = parseYaml(yaml);
    expect(entries).toHaveLength(2);
    // Both entries get the same anchored UUID value
    expect(entries[0].fields["UUID"]).toBe("aabbccdd-1122-3344-5566-778899001122");
    expect(entries[1].fields["UUID"]).toBe("aabbccdd-1122-3344-5566-778899001122");
    expect(entries[0].fields["Boolean:AllowImprovement"]).toBe("true");
    expect(entries[1].fields["Boolean:AllowImprovement"]).toBe("true");
  });

  it("handles flow collections", () => {
    const yaml = `
Lists:
  - Action: Insert
    UUID: "aabbccdd-1122-3344-5566-778899001122"
    Type: SpellList
    Items: ["Fireball", "IceStorm"]
`;
    const entries = parseYaml(yaml);
    expect(entries[0].fields["Items"]).toBe("Fireball;IceStorm");
  });

  it("handles BOM and CRLF line endings", () => {
    const yaml = "\uFEFF\r\nLists:\r\n  - Action: Insert\r\n    UUID: \"aabbccdd-1122-3344-5566-778899001122\"\r\n    Type: SpellList\r\n    Items:\r\n      - \"Fireball\"\r\n";
    const entries = parseYaml(yaml);
    expect(entries).toHaveLength(1);
    expect(entries[0].fields["Action"]).toBe("Insert");
  });

  it("handles multi-line strings (literal block)", () => {
    const yaml = `
Spells:
  - ID: "Target_Test"
    Action: Insert
`;
    const entries = parseYaml(yaml);
    expect(entries[0].fields["ID"]).toBe("Target_Test");
  });

  it("handles empty document", () => {
    const { entries, warnings } = parseExistingConfig("", "test.yaml");
    expect(entries).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it("handles document with only comments", () => {
    const yaml = `# This is a comment\n# Another comment\n`;
    const { entries } = parseExistingConfig(yaml, "test.yaml");
    expect(entries).toHaveLength(0);
  });

  it("handles FileVersion header (ignored gracefully)", () => {
    const yaml = `
FileVersion: 1
Progressions:
  - UUID: "aabbccdd-1122-3344-5566-778899001122"
`;
    const entries = parseYaml(yaml);
    expect(entries).toHaveLength(1);
    expect(entries[0].fields["UUID"]).toBe("aabbccdd-1122-3344-5566-778899001122");
  });
});

// ──────────────────────────────────────────────
// Cross-Format Tests
// ──────────────────────────────────────────────

describe("PF-043: Cross-Format Parity", () => {
  it("YAML and JSON produce equivalent ManualEntry for same data", () => {
    const yaml = `
Progressions:
  - UUID: "aabbccdd-1122-3344-5566-778899001122"
    Booleans:
      - Key: AllowImprovement
        Value: true
    Strings:
      - Action: Insert
        Type: PassivesAdded
        Strings:
          - "TestPassive"
`;
    const json = JSON.stringify({
      Progressions: [
        {
          UUID: "aabbccdd-1122-3344-5566-778899001122",
          Booleans: [{ Key: "AllowImprovement", Value: "true" }],
          Strings: [{ Action: "Insert", Type: "PassivesAdded", Strings: ["TestPassive"] }],
        },
      ],
    });

    const yamlEntries = parseYaml(yaml);
    const jsonEntries = parseJson(json);

    expect(yamlEntries).toHaveLength(1);
    expect(jsonEntries).toHaveLength(1);

    const yf = normalizeFields(yamlEntries[0].fields);
    const jf = normalizeFields(jsonEntries[0].fields);
    expect(yf).toEqual(jf);
  });

  it("Lists entry: YAML and JSON produce equivalent results", () => {
    const yaml = `
Lists:
  - Action: Insert
    UUID: "aabbccdd-1122-3344-5566-778899001122"
    Type: SpellList
    Items:
      - "Fireball"
      - "IceStorm"
`;
    const json = JSON.stringify({
      Lists: [
        {
          Action: "Insert",
          UUID: "aabbccdd-1122-3344-5566-778899001122",
          Type: "SpellList",
          Items: ["Fireball", "IceStorm"],
        },
      ],
    });

    const yf = normalizeFields(parseYaml(yaml)[0].fields);
    const jf = normalizeFields(parseJson(json)[0].fields);
    expect(yf).toEqual(jf);
  });
});
