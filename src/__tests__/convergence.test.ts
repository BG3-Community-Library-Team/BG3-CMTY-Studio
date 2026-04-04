/**
 * PF-041: Convergence tests — YAML ↔ JSON Parse Convergence.
 *
 * Validates that the same data structure parsed via YAML and JSON
 * paths produces equivalent ManualEntry[].
 */

import { describe, it, expect } from "vitest";
import { parseExistingConfig } from "../lib/utils/configParser.js";

// ── Cross-format Parse Convergence ──────────────────────────

describe("PF-041: YAML ↔ JSON Parse Convergence", () => {
  it("simple Progressions entry produces same ManualEntry from both formats", () => {
    const data = {
      Progressions: [{
        UUID: "aabbccdd-1122-3344-5566-778899001122",
        Booleans: [{ Key: "AllowImprovement", Value: "true" }],
      }],
    };
    const json = JSON.stringify(data);
    const yaml = `
Progressions:
  - UUID: "aabbccdd-1122-3344-5566-778899001122"
    Booleans:
      - Key: AllowImprovement
        Value: "true"
`;
    const fromJson = parseExistingConfig(json, "test.json").entries;
    const fromYaml = parseExistingConfig(yaml, "test.yaml").entries;

    expect(fromJson).toHaveLength(1);
    expect(fromYaml).toHaveLength(1);
    expect(fromJson[0].section).toBe(fromYaml[0].section);
    expect(fromJson[0].fields).toEqual(fromYaml[0].fields);
  });

  it("Lists entry with Items array converges", () => {
    const data = {
      Lists: [{
        UUID: "list-uuid",
        Action: "Insert",
        Type: "SpellList",
        Items: ["Fireball", "IceStorm", "Lightning"],
      }],
    };
    const json = JSON.stringify(data);
    const yaml = `
Lists:
  - UUID: "list-uuid"
    Action: Insert
    Type: SpellList
    Items:
      - Fireball
      - IceStorm
      - Lightning
`;
    const fromJson = parseExistingConfig(json, "test.json").entries;
    const fromYaml = parseExistingConfig(yaml, "test.yaml").entries;

    expect(fromJson[0].fields).toEqual(fromYaml[0].fields);
  });

  it("multi-UUID entry converges", () => {
    const data = {
      Races: [{
        UUIDs: ["uuid-1", "uuid-2", "uuid-3"],
        Children: [{ Type: "Race", Values: "val-1", Action: "Insert" }],
      }],
    };
    const json = JSON.stringify(data);
    const yaml = `
Races:
  - UUIDs:
      - "uuid-1"
      - "uuid-2"
      - "uuid-3"
    Children:
      - Type: Race
        Values: "val-1"
        Action: Insert
`;
    const fromJson = parseExistingConfig(json, "test.json").entries;
    const fromYaml = parseExistingConfig(yaml, "test.yaml").entries;

    expect(fromJson[0].fields["UUID"]).toBe(fromYaml[0].fields["UUID"]);
    expect(fromJson[0].fields["_uuidIsArray"]).toBe(fromYaml[0].fields["_uuidIsArray"]);
  });

  it("Strings sub-entries converge", () => {
    const data = {
      Progressions: [{
        UUID: "prog-uuid",
        Strings: [{
          Action: "Insert",
          Type: "Boosts",
          Strings: ["Boost1", "Boost2"],
        }],
      }],
    };
    const json = JSON.stringify(data);
    const yaml = `
Progressions:
  - UUID: "prog-uuid"
    Strings:
      - Action: Insert
        Type: Boosts
        Strings:
          - "Boost1"
          - "Boost2"
`;
    const fromJson = parseExistingConfig(json, "test.json").entries;
    const fromYaml = parseExistingConfig(yaml, "test.yaml").entries;

    expect(fromJson[0].fields["String:0:Values"]).toBe(fromYaml[0].fields["String:0:Values"]);
    expect(fromJson[0].fields["String:0:Action"]).toBe(fromYaml[0].fields["String:0:Action"]);
    expect(fromJson[0].fields["String:0:Type"]).toBe(fromYaml[0].fields["String:0:Type"]);
  });

  it("Selectors converge", () => {
    const data = {
      Progressions: [{
        UUID: "prog-uuid",
        Selectors: [{
          Action: "Insert",
          Function: "SelectAbilities",
          Overwrite: "true",
          UUID: "sel-uuid",
        }],
      }],
    };
    const json = JSON.stringify(data);
    const yaml = `
Progressions:
  - UUID: "prog-uuid"
    Selectors:
      - Action: Insert
        Function: SelectAbilities
        Overwrite: "true"
        UUID: "sel-uuid"
`;
    const fromJson = parseExistingConfig(json, "test.json").entries;
    const fromYaml = parseExistingConfig(yaml, "test.yaml").entries;

    expect(fromJson[0].fields["Selector:0:Function"]).toBe(fromYaml[0].fields["Selector:0:Function"]);
    expect(fromJson[0].fields["Selector:0:UUID"]).toBe(fromYaml[0].fields["Selector:0:UUID"]);
  });
});
