/**
 * Validation utility tests — Priority 0 coverage for validateEntry/isEntryValid.
 * Tests key branches: no changes, new entry w/ and w/o attributes, no actionable
 * changes, UUID format, removal-only warnings.
 */
import { describe, it, expect } from "vitest";
import { validateEntry, isEntryValid } from "../lib/utils/validation.js";
import type { SelectedEntry, Change } from "../lib/types/index.js";

function makeEntry(overrides: Partial<SelectedEntry> = {}): SelectedEntry {
  return {
    section: "CharacterCreationPresets",
    uuid: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    display_name: "Test Entry",
    changes: [],
    manual: false,
    ...overrides,
  };
}

function makeChange(overrides: Partial<Change> = {}): Change {
  return {
    change_type: "SelectorAdded",
    field: "Selectors",
    added_values: ["SelectSpells(guid,1)"],
    removed_values: [],
    vanilla_value: null,
    mod_value: null,
    ...overrides,
  };
}

describe("validateEntry", () => {
  it("returns valid for entries with no changes", () => {
    const result = validateEntry(makeEntry({ changes: [] }));
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("returns invalid with error for EntireEntryNew with no raw_attributes", () => {
    const result = validateEntry(makeEntry({
      changes: [makeChange({ change_type: "EntireEntryNew", added_values: [], removed_values: [] })],
      raw_attributes: undefined,
    }));
    expect(result.valid).toBe(false);
    expect(result.issues[0].level).toBe("error");
    expect(result.issues[0].message).toContain("no attributes");
  });

  it("returns valid for EntireEntryNew with raw_attributes", () => {
    const result = validateEntry(makeEntry({
      changes: [makeChange({ change_type: "EntireEntryNew", added_values: [], removed_values: [] })],
      raw_attributes: { UUID: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" },
    }));
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("warns on invalid UUID format for new entries", () => {
    const result = validateEntry(makeEntry({
      uuid: "not-a-valid-uuid",
      changes: [makeChange({ change_type: "EntireEntryNew", added_values: [], removed_values: [] })],
      raw_attributes: { UUID: "not-a-valid-uuid" },
    }));
    expect(result.valid).toBe(true);
    expect(result.issues.some(i => i.message.includes("UUID format invalid"))).toBe(true);
  });

  it("returns invalid when no actionable changes (all non-matching types)", () => {
    const result = validateEntry(makeEntry({
      changes: [makeChange({
        change_type: "SelectorAdded",
        added_values: [],
        removed_values: [],
        mod_value: null,
      })],
    }));
    expect(result.valid).toBe(false);
    expect(result.issues[0].message).toContain("No actionable changes");
  });

  it("returns valid with warning for removal-only entries", () => {
    const result = validateEntry(makeEntry({
      changes: [makeChange({
        change_type: "SelectorAdded",
        added_values: [],
        removed_values: ["SelectSpells(guid,1)"],
        mod_value: null,
      })],
    }));
    expect(result.valid).toBe(true);
    expect(result.issues.some(i => i.message.includes("only removes values"))).toBe(true);
  });

  it("returns valid with no issues for standard actionable changes", () => {
    const result = validateEntry(makeEntry({
      changes: [makeChange({
        change_type: "BooleanChanged",
        added_values: [],
        removed_values: [],
        mod_value: "true",
      })],
    }));
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("skips UUID check when raw_attribute_types indicates FixedString identity", () => {
    const result = validateEntry(makeEntry({
      uuid: "GUI_Overhead_THP",
      changes: [makeChange({ change_type: "BooleanChanged", mod_value: "true", added_values: [], removed_values: [] })],
      raw_attribute_types: { MapKey: "FixedString" },
    }));
    expect(result.valid).toBe(true);
    expect(result.issues.some(i => i.message.includes("UUID format invalid"))).toBe(false);
  });

  it("warns on malformed GUID when raw_attribute_types indicates guid identity", () => {
    const result = validateEntry(makeEntry({
      uuid: "not-a-valid-uuid",
      changes: [makeChange({ change_type: "BooleanChanged", mod_value: "true", added_values: [], removed_values: [] })],
      raw_attribute_types: { UUID: "guid" },
    }));
    expect(result.valid).toBe(true);
    expect(result.issues.some(i => i.message.includes("UUID format invalid"))).toBe(true);
  });

  it("defaults to GUID validation when raw_attribute_types is absent", () => {
    const result = validateEntry(makeEntry({
      uuid: "not-a-valid-uuid",
      changes: [makeChange({ change_type: "BooleanChanged", mod_value: "true", added_values: [], removed_values: [] })],
    }));
    expect(result.valid).toBe(true);
    expect(result.issues.some(i => i.message.includes("UUID format invalid"))).toBe(true);
  });
});

describe("isEntryValid", () => {
  it("returns true for valid entries", () => {
    expect(isEntryValid(makeEntry({
      changes: [makeChange({ change_type: "BooleanChanged", mod_value: "true", added_values: [], removed_values: [] })],
    }))).toBe(true);
  });

  it("returns true for entries with no changes", () => {
    expect(isEntryValid(makeEntry({ changes: [] }))).toBe(true);
  });
});

// ── Extended validation coverage (TC-007) ───────────────────────────

describe("validateEntry (extended error paths)", () => {
  it("returns invalid for EntireEntryNew with empty raw_attributes object", () => {
    const result = validateEntry(makeEntry({
      changes: [makeChange({ change_type: "EntireEntryNew", added_values: [], removed_values: [] })],
      raw_attributes: {},
    }));
    expect(result.valid).toBe(false);
    expect(result.issues[0].level).toBe("error");
    expect(result.issues[0].message).toContain("no attributes");
  });

  it("returns valid for FieldChanged actionable change", () => {
    const result = validateEntry(makeEntry({
      changes: [makeChange({
        change_type: "FieldChanged",
        added_values: [],
        removed_values: [],
        mod_value: "NewFieldVal",
      })],
    }));
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("returns valid for SpellFieldChanged actionable change", () => {
    const result = validateEntry(makeEntry({
      changes: [makeChange({
        change_type: "SpellFieldChanged",
        added_values: [],
        removed_values: [],
        mod_value: "Charisma",
      })],
    }));
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("warns on invalid UUID for entries with no changes", () => {
    const result = validateEntry(makeEntry({
      uuid: "bad-uuid",
      changes: [],
    }));
    expect(result.valid).toBe(true);
    expect(result.issues.some(i => i.message.includes("UUID format invalid"))).toBe(true);
  });

  it("multiple mixed changes with some actionable", () => {
    const result = validateEntry(makeEntry({
      changes: [
        makeChange({ change_type: "SelectorAdded", added_values: [], removed_values: [], mod_value: null }),
        makeChange({ change_type: "BooleanChanged", added_values: [], removed_values: [], mod_value: "false" }),
      ],
    }));
    expect(result.valid).toBe(true);
  });

  it("treats added_values as actionable", () => {
    const result = validateEntry(makeEntry({
      changes: [makeChange({
        change_type: "SelectorAdded",
        added_values: ["SelectSpells(guid,1)"],
        removed_values: [],
        mod_value: null,
      })],
    }));
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
});
