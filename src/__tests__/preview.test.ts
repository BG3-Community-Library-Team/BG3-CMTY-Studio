import { describe, it, expect, vi } from "vitest";
import type { Change, SelectedEntry, Section, ChangeType } from "../lib/types/index.js";

// Mock selectorParser before importing preview
vi.mock("../lib/utils/selectorParser.js", () => ({
  parseRawSelectors: vi.fn((raw: string) => {
    // Simple mock: split on ";" and return parsed selector objects
    if (!raw) return [];
    return raw.split(";").filter(Boolean).map((s: string) => {
      const trimmed = s.trim();
      // Minimal mock: extract function name, e.g. "SelectSpells(guid,2)"
      const match = trimmed.match(/^(\w+)\(([^)]*)\)$/);
      if (match) {
        const params: Record<string, string> = {};
        const parts = match[2].split(",").map((p: string) => p.trim());
        if (parts[0]) params["Guid"] = parts[0];
        if (parts[1]) params["Amount"] = parts[1];
        return { fn: match[1], params };
      }
      return { fn: trimmed, params: {} };
    });
  }),
}));

import {
  changesToManualFields,
  splitMixedListEntry,
  summarizeChange,
  highlightYaml,
  highlightJson,
  highlightXml,
} from "../lib/utils/preview.js";

// ── Helper factories ─────────────────────────────────────────────────

function makeChange(overrides: Partial<Change> & { change_type: ChangeType; field: string }): Change {
  return {
    added_values: [],
    removed_values: [],
    vanilla_value: null,
    mod_value: null,
    ...overrides,
  };
}

function makeEntry(overrides: Partial<SelectedEntry> & { section: Section; uuid: string }): SelectedEntry {
  return {
    display_name: "",
    changes: [],
    manual: false,
    ...overrides,
  };
}

// ── summarizeChange ──────────────────────────────────────────────────

describe("summarizeChange", () => {
  it("returns 'New entry' for EntireEntryNew", () => {
    const c = makeChange({ change_type: "EntireEntryNew", field: "" });
    expect(summarizeChange(c)).toBe("New entry");
  });

  it("summarizes StringAdded with count", () => {
    const c = makeChange({ change_type: "StringAdded", field: "PassivesAdded", added_values: ["a", "b"] });
    expect(summarizeChange(c)).toBe("+2 PassivesAdded");
  });

  it("summarizes StringRemoved with count", () => {
    const c = makeChange({ change_type: "StringRemoved", field: "PassivesRemoved", removed_values: ["x"] });
    expect(summarizeChange(c)).toBe("-1 PassivesRemoved");
  });

  it("summarizes SelectorAdded", () => {
    const c = makeChange({ change_type: "SelectorAdded", field: "Selectors", added_values: ["sel1", "sel2", "sel3"] });
    expect(summarizeChange(c)).toBe("+3 Selector(s)");
  });

  it("summarizes SelectorRemoved", () => {
    const c = makeChange({ change_type: "SelectorRemoved", field: "Selectors", removed_values: ["sel1"] });
    expect(summarizeChange(c)).toBe("-1 Selector(s)");
  });

  it("summarizes BooleanChanged with field and value", () => {
    const c = makeChange({ change_type: "BooleanChanged", field: "Hidden", mod_value: "true" });
    expect(summarizeChange(c)).toBe("Hidden: true");
  });

  it("summarizes FieldChanged", () => {
    const c = makeChange({ change_type: "FieldChanged", field: "BaseHp" });
    expect(summarizeChange(c)).toBe("BaseHp changed");
  });

  it("summarizes ChildAdded", () => {
    const c = makeChange({ change_type: "ChildAdded", field: "Tags", added_values: ["t1", "t2"] });
    expect(summarizeChange(c)).toBe("+2 Tags");
  });

  it("summarizes ChildRemoved", () => {
    const c = makeChange({ change_type: "ChildRemoved", field: "Tags", removed_values: ["t1"] });
    expect(summarizeChange(c)).toBe("-1 Tags");
  });

  it("summarizes SpellFieldChanged", () => {
    const c = makeChange({ change_type: "SpellFieldChanged", field: "SpellType" });
    expect(summarizeChange(c)).toBe("SpellType changed");
  });

  it("returns field:null for BooleanChanged with null mod_value", () => {
    const c = makeChange({ change_type: "BooleanChanged" as ChangeType, field: "x" });
    expect(summarizeChange(c)).toBe("x: null");
  });

  it("returns 'Modified' for unknown change type", () => {
    const c = makeChange({ change_type: "FutureType" as ChangeType, field: "x" });
    expect(summarizeChange(c)).toBe("Modified");
  });
});

// ── splitMixedListEntry ──────────────────────────────────────────────

describe("splitMixedListEntry", () => {
  it("returns null when _hasRemovals is not set", () => {
    expect(splitMixedListEntry({ UUID: "u1", Action: "Insert", Items: "a" })).toBeNull();
  });

  it("returns null when _hasRemovals is 'false'", () => {
    expect(splitMixedListEntry({ UUID: "u1", _hasRemovals: "false" })).toBeNull();
  });

  it("splits into insert and remove entries", () => {
    const fields = {
      UUID: "u1",
      Name: "MyList",
      Type: "SpellList",
      Action: "Insert",
      Items: "spell1;spell2",
      _hasRemovals: "true",
      _removedItems: "spell3",
    };
    const result = splitMixedListEntry(fields);
    expect(result).not.toBeNull();
    expect(result!.insert.Action).toBe("Insert");
    expect(result!.insert.Items).toBe("spell1;spell2");
    expect(result!.insert.UUID).toBe("u1");
    expect(result!.insert.Name).toBe("MyList");
    expect(result!.insert.Type).toBe("SpellList");
    expect(result!.remove.Action).toBe("Remove");
    expect(result!.remove.Items).toBe("spell3");
    expect(result!.remove.UUID).toBe("u1");
  });

  it("uses defaults for missing UUID, Type, Items", () => {
    const fields = { _hasRemovals: "true" };
    const result = splitMixedListEntry(fields);
    expect(result).not.toBeNull();
    expect(result!.insert.UUID).toBe("");
    expect(result!.insert.Type).toBe("SpellList");
    expect(result!.insert.Items).toBe("");
    expect(result!.remove.Items).toBe("");
  });

  it("does not include Name when not present", () => {
    const fields = { UUID: "u1", _hasRemovals: "true", _removedItems: "x" };
    const result = splitMixedListEntry(fields);
    expect(result!.insert).not.toHaveProperty("Name");
  });
});

// ── changesToManualFields — Spells section ───────────────────────────

describe("changesToManualFields — Spells section", () => {
  it("uses EntryName instead of UUID for Spells", () => {
    const entry = makeEntry({
      section: "Spells",
      uuid: "Target_MySpell",
      changes: [makeChange({ change_type: "FieldChanged", field: "SpellType", mod_value: "Target" })],
    });
    const fields = changesToManualFields(entry);
    expect(fields["EntryName"]).toBe("Target_MySpell");
    expect(fields["Action"]).toBe("Insert");
    expect(fields).not.toHaveProperty("UUID");
  });
});

// ── changesToManualFields — non-Spells basic ─────────────────────────

describe("changesToManualFields — basic entry", () => {
  it("sets UUID and display_name", () => {
    const entry = makeEntry({
      section: "Races",
      uuid: "abc-123",
      display_name: "TestRace",
      changes: [],
    });
    const fields = changesToManualFields(entry);
    expect(fields["UUID"]).toBe("abc-123");
    expect(fields["Name"]).toBe("TestRace");
  });

  it("omits Name when display_name is empty", () => {
    const entry = makeEntry({
      section: "Races",
      uuid: "abc",
      display_name: "",
      changes: [],
    });
    const fields = changesToManualFields(entry);
    expect(fields).not.toHaveProperty("Name");
  });
});

// ── changesToManualFields — EntireEntryNew with raw attributes ───────

describe("changesToManualFields — EntireEntryNew", () => {
  it("delegates to populateFromRawAttributes for new entry", () => {
    const entry = makeEntry({
      section: "Progressions",
      uuid: "new-uuid",
      changes: [makeChange({ change_type: "EntireEntryNew", field: "" })],
    });
    const rawAttrs = {
      UUID: "new-uuid",
      AllowImprovement: "true",
      Boosts: "ActionResource(SpellSlot,1,1);ActionResource(SpellSlot,1,2)",
    };
    const fields = changesToManualFields(entry, rawAttrs);
    expect(fields["UUID"]).toBe("new-uuid");
    expect(fields["Boolean:AllowImprovement"]).toBe("true");
    expect(fields["String:0:Type"]).toBe("Boosts");
    expect(fields["String:0:Action"]).toBe("Insert");
  });

  it("skips raw attributes with empty values, UUID, MapKey, Name, Selectors", () => {
    const entry = makeEntry({
      section: "Feats",
      uuid: "feat-uuid",
      changes: [makeChange({ change_type: "EntireEntryNew", field: "" })],
    });
    const rawAttrs = {
      UUID: "feat-uuid",
      MapKey: "key",
      Name: "FeatName",
      Selectors: "",
      "": "empty-key",
      AllowImprovement: "false",
    };
    const fields = changesToManualFields(entry, rawAttrs);
    // Boolean:AllowImprovement should be set but filtered keys should not appear as field entries
    expect(fields["Boolean:AllowImprovement"]).toBe("false");
  });

  it("does not treat unknown keys as boolean/field/string", () => {
    const entry = makeEntry({
      section: "Progressions",
      uuid: "u1",
      changes: [makeChange({ change_type: "EntireEntryNew", field: "" })],
    });
    const rawAttrs = { UnknownField: "value" };
    const fields = changesToManualFields(entry, rawAttrs);
    // Unknown field should not appear in any categorized prefix
    expect(fields["Boolean:UnknownField"]).toBeUndefined();
    expect(fields["Field:UnknownField"]).toBeUndefined();
  });

  it("skips new entry path when rawAttributes is empty", () => {
    const entry = makeEntry({
      section: "Races",
      uuid: "u1",
      changes: [makeChange({ change_type: "EntireEntryNew", field: "" })],
    });
    // Empty raw attrs → falls through to change handler loop
    const fields = changesToManualFields(entry, {});
    expect(fields["UUID"]).toBe("u1");
  });
});

// ── changesToManualFields — Lists section ────────────────────────────

describe("changesToManualFields — Lists", () => {
  it("handles pure Insert (StringAdded only)", () => {
    const entry = makeEntry({
      section: "Lists",
      uuid: "list-uuid",
      list_type: "PassiveList",
      changes: [
        makeChange({ change_type: "StringAdded", field: "Passives", added_values: ["p1", "p2"] }),
      ],
    });
    const fields = changesToManualFields(entry);
    expect(fields["Action"]).toBe("Insert");
    expect(fields["Type"]).toBe("PassiveList");
    expect(fields["Items"]).toBe("p1;p2");
    expect(fields).not.toHaveProperty("_hasRemovals");
  });

  it("handles pure Remove (StringRemoved only)", () => {
    const entry = makeEntry({
      section: "Lists",
      uuid: "list-uuid",
      changes: [
        makeChange({ change_type: "StringRemoved", field: "Spells", removed_values: ["s1"] }),
      ],
    });
    const fields = changesToManualFields(entry);
    expect(fields["Action"]).toBe("Remove");
    expect(fields["Items"]).toBe("s1");
  });

  it("handles mixed add and remove", () => {
    const entry = makeEntry({
      section: "Lists",
      uuid: "list-uuid",
      list_type: "SpellList",
      changes: [
        makeChange({ change_type: "StringAdded", field: "Spells", added_values: ["a1"] }),
        makeChange({ change_type: "StringRemoved", field: "Spells", removed_values: ["r1", "r2"] }),
      ],
    });
    const fields = changesToManualFields(entry);
    expect(fields["Action"]).toBe("Insert");
    expect(fields["Items"]).toBe("a1");
    expect(fields["_hasRemovals"]).toBe("true");
    expect(fields["_removedItems"]).toBe("r1;r2");
  });

  it("defaults list_type to SpellList when not provided", () => {
    const entry = makeEntry({
      section: "Lists",
      uuid: "list-uuid",
      changes: [
        makeChange({ change_type: "StringAdded", field: "Spells", added_values: ["a1"] }),
      ],
    });
    const fields = changesToManualFields(entry);
    expect(fields["Type"]).toBe("SpellList");
  });
});

// ── changesToManualFields — BooleanChanged ───────────────────────────

describe("changesToManualFields — BooleanChanged", () => {
  it("maps to Boolean: prefixed key", () => {
    const entry = makeEntry({
      section: "Backgrounds",
      uuid: "bg-uuid",
      changes: [makeChange({ change_type: "BooleanChanged", field: "Hidden", mod_value: "true" })],
    });
    const fields = changesToManualFields(entry);
    expect(fields["Boolean:Hidden"]).toBe("true");
  });

  it("defaults to 'false' when mod_value is null", () => {
    const entry = makeEntry({
      section: "Backgrounds",
      uuid: "bg-uuid",
      changes: [makeChange({ change_type: "BooleanChanged", field: "Hidden", mod_value: null })],
    });
    const fields = changesToManualFields(entry);
    expect(fields["Boolean:Hidden"]).toBe("false");
  });
});

// ── changesToManualFields — FieldChanged ─────────────────────────────

describe("changesToManualFields — FieldChanged", () => {
  it("maps to Field: prefixed key", () => {
    const entry = makeEntry({
      section: "ClassDescriptions",
      uuid: "cd-uuid",
      changes: [makeChange({ change_type: "FieldChanged", field: "BaseHp", mod_value: "10" })],
    });
    const fields = changesToManualFields(entry);
    expect(fields["Field:BaseHp"]).toBe("10");
  });

  it("defaults to empty string when mod_value is null", () => {
    const entry = makeEntry({
      section: "ClassDescriptions",
      uuid: "cd-uuid",
      changes: [makeChange({ change_type: "FieldChanged", field: "BaseHp", mod_value: null })],
    });
    const fields = changesToManualFields(entry);
    expect(fields["Field:BaseHp"]).toBe("");
  });
});

// ── changesToManualFields — SpellFieldChanged ────────────────────────

describe("changesToManualFields — SpellFieldChanged", () => {
  it("maps to SpellField: prefixed key", () => {
    const entry = makeEntry({
      section: "Spells",
      uuid: "spell-uuid",
      changes: [makeChange({ change_type: "SpellFieldChanged", field: "SpellType", mod_value: "Target" })],
    });
    const fields = changesToManualFields(entry);
    expect(fields["SpellField:SpellType"]).toBe("Target");
  });
});

// ── changesToManualFields — SelectorAdded / SelectorRemoved ──────────

describe("changesToManualFields — Selectors", () => {
  it("maps SelectorAdded to indexed Selector fields with Insert action", () => {
    const entry = makeEntry({
      section: "Progressions",
      uuid: "p-uuid",
      changes: [makeChange({ change_type: "SelectorAdded", field: "Selectors", added_values: ["SelectSpells(guid,2)", "AddSpells(guid2,1)"] })],
    });
    const fields = changesToManualFields(entry);
    expect(fields["Selector:0:Action"]).toBe("Insert");
    expect(fields["Selector:0:Function"]).toBe("SelectSpells(guid,2)");
    expect(fields["Selector:1:Action"]).toBe("Insert");
    expect(fields["Selector:1:Function"]).toBe("AddSpells(guid2,1)");
  });

  it("maps SelectorRemoved to indexed Selector fields with Remove action", () => {
    const entry = makeEntry({
      section: "Progressions",
      uuid: "p-uuid",
      changes: [makeChange({ change_type: "SelectorRemoved", field: "Selectors", removed_values: ["RemSel"] })],
    });
    const fields = changesToManualFields(entry);
    expect(fields["Selector:0:Action"]).toBe("Remove");
    expect(fields["Selector:0:Function"]).toBe("RemSel");
  });

  it("increments selector index across multiple changes", () => {
    const entry = makeEntry({
      section: "Progressions",
      uuid: "p-uuid",
      changes: [
        makeChange({ change_type: "SelectorAdded", field: "Selectors", added_values: ["a"] }),
        makeChange({ change_type: "SelectorRemoved", field: "Selectors", removed_values: ["b"] }),
      ],
    });
    const fields = changesToManualFields(entry);
    expect(fields["Selector:0:Action"]).toBe("Insert");
    expect(fields["Selector:1:Action"]).toBe("Remove");
  });
});

// ── changesToManualFields — StringAdded / StringRemoved ──────────────

describe("changesToManualFields — Strings (non-Lists)", () => {
  it("maps StringAdded to indexed String fields with Insert", () => {
    const entry = makeEntry({
      section: "Progressions",
      uuid: "p-uuid",
      changes: [makeChange({ change_type: "StringAdded", field: "PassivesAdded", added_values: ["p1", "p2"] })],
    });
    const fields = changesToManualFields(entry);
    expect(fields["String:0:Action"]).toBe("Insert");
    expect(fields["String:0:Type"]).toBe("PassivesAdded");
    expect(fields["String:0:Values"]).toBe("p1;p2");
  });

  it("maps StringRemoved to indexed String fields with Remove", () => {
    const entry = makeEntry({
      section: "Progressions",
      uuid: "p-uuid",
      changes: [makeChange({ change_type: "StringRemoved", field: "Boosts", removed_values: ["b1"] })],
    });
    const fields = changesToManualFields(entry);
    expect(fields["String:0:Action"]).toBe("Remove");
    expect(fields["String:0:Type"]).toBe("Boosts");
    expect(fields["String:0:Values"]).toBe("b1");
  });

  it("increments string index across multiple changes", () => {
    const entry = makeEntry({
      section: "Feats",
      uuid: "f-uuid",
      changes: [
        makeChange({ change_type: "StringAdded", field: "PassivesAdded", added_values: ["a"] }),
        makeChange({ change_type: "StringAdded", field: "Boosts", added_values: ["b"] }),
      ],
    });
    const fields = changesToManualFields(entry);
    expect(fields["String:0:Type"]).toBe("PassivesAdded");
    expect(fields["String:1:Type"]).toBe("Boosts");
  });
});

// ── changesToManualFields — ChildAdded / ChildRemoved ────────────────

describe("changesToManualFields — Children", () => {
  it("maps ChildAdded Tags to Tag fields with Insert", () => {
    const entry = makeEntry({
      section: "Progressions",
      uuid: "p-uuid",
      changes: [makeChange({ change_type: "ChildAdded", field: "Tags", added_values: ["tag-uuid-1", "tag-uuid-2"] })],
    });
    const fields = changesToManualFields(entry);
    expect(fields["Tag:0:UUIDs"]).toBe("tag-uuid-1;tag-uuid-2");
    expect(fields["Tag:0:Action"]).toBe("Insert");
    expect(fields["Tag:0:Type"]).toBe("Tags");
  });

  it("maps ChildRemoved Tags to Tag fields with Remove", () => {
    const entry = makeEntry({
      section: "Progressions",
      uuid: "p-uuid",
      changes: [makeChange({ change_type: "ChildRemoved", field: "Tags", removed_values: ["tag-uuid-1"] })],
    });
    const fields = changesToManualFields(entry);
    expect(fields["Tag:0:UUIDs"]).toBe("tag-uuid-1");
    expect(fields["Tag:0:Action"]).toBe("Remove");
  });

  it("skips SubClass ChildAdded (automatic since CF 2.6.5.8)", () => {
    const entry = makeEntry({
      section: "ClassDescriptions",
      uuid: "cd-uuid",
      changes: [makeChange({ change_type: "ChildAdded", field: "SubClass", added_values: ["sub-uuid"] })],
    });
    const fields = changesToManualFields(entry);
    // No Subclass fields for ChildAdded
    expect(Object.keys(fields).filter(k => k.startsWith("Subclass:"))).toHaveLength(0);
  });

  it("maps SubClass ChildRemoved to Subclass fields with Remove", () => {
    const entry = makeEntry({
      section: "ClassDescriptions",
      uuid: "cd-uuid",
      changes: [makeChange({ change_type: "ChildRemoved", field: "SubClass", removed_values: ["sub1", "sub2"] })],
    });
    const fields = changesToManualFields(entry);
    expect(fields["Subclass:0:Action"]).toBe("Remove");
    expect(fields["Subclass:0:UUID"]).toBe("sub1");
    expect(fields["Subclass:1:Action"]).toBe("Remove");
    expect(fields["Subclass:1:UUID"]).toBe("sub2");
  });

  it("maps ChildAdded for Races section to Child fields", () => {
    const entry = makeEntry({
      section: "Races",
      uuid: "race-uuid",
      changes: [makeChange({ change_type: "ChildAdded", field: "EyeColors", added_values: ["color1", "color2"] })],
    });
    const fields = changesToManualFields(entry);
    expect(fields["Child:0:Type"]).toBe("EyeColors");
    expect(fields["Child:0:Values"]).toBe("color1");
    expect(fields["Child:0:Action"]).toBe("Insert");
    expect(fields["Child:1:Values"]).toBe("color2");
  });

  it("maps ChildRemoved for Races section to Child fields with Remove", () => {
    const entry = makeEntry({
      section: "Races",
      uuid: "race-uuid",
      changes: [makeChange({ change_type: "ChildRemoved", field: "HairColors", removed_values: ["hc1"] })],
    });
    const fields = changesToManualFields(entry);
    expect(fields["Child:0:Type"]).toBe("HairColors");
    expect(fields["Child:0:Values"]).toBe("hc1");
    expect(fields["Child:0:Action"]).toBe("Remove");
  });

  it("increments tag index across multiple ChildAdded Tags changes", () => {
    const entry = makeEntry({
      section: "Progressions",
      uuid: "p-uuid",
      changes: [
        makeChange({ change_type: "ChildAdded", field: "Tags", added_values: ["t1"] }),
        makeChange({ change_type: "ChildAdded", field: "OtherTags", added_values: ["t2"] }),
      ],
    });
    const fields = changesToManualFields(entry);
    expect(fields["Tag:0:Type"]).toBe("Tags");
    expect(fields["Tag:1:Type"]).toBe("OtherTags");
  });
});

// ── changesToManualFields — raw attribute backfill ───────────────────

describe("changesToManualFields — raw attribute backfill for non-new entries", () => {
  it("fills in missing Boolean/Field keys from raw attributes", () => {
    const entry = makeEntry({
      section: "Progressions",
      uuid: "p-uuid",
      changes: [makeChange({ change_type: "BooleanChanged", field: "AllowImprovement", mod_value: "true" })],
    });
    const rawAttrs = { IsMulticlass: "false" };
    const fields = changesToManualFields(entry, rawAttrs);
    // The changed boolean should be there
    expect(fields["Boolean:AllowImprovement"]).toBe("true");
    // The raw attribute boolean should be backfilled
    expect(fields["Boolean:IsMulticlass"]).toBe("false");
  });

  it("does not overwrite existing fields from changes", () => {
    const entry = makeEntry({
      section: "Progressions",
      uuid: "p-uuid",
      changes: [makeChange({ change_type: "BooleanChanged", field: "AllowImprovement", mod_value: "true" })],
    });
    const rawAttrs = { AllowImprovement: "false" }; // raw says false, change says true
    const fields = changesToManualFields(entry, rawAttrs);
    // Change takes priority
    expect(fields["Boolean:AllowImprovement"]).toBe("true");
  });
});

// ── changesToManualFields — EntireEntryNew + Lists section ───────────

describe("changesToManualFields — EntireEntryNew for Lists", () => {
  it("populates from raw attributes for Lists new entry", () => {
    const entry = makeEntry({
      section: "Lists",
      uuid: "list-uuid",
      changes: [makeChange({ change_type: "EntireEntryNew", field: "" })],
    });
    const rawAttrs = {
      UUID: "list-uuid",
      Comment: "My Spell List",
      Type: "SpellList",
      Spells: "spell1;spell2;spell3",
    };
    const fields = changesToManualFields(entry, rawAttrs);
    expect(fields["UUID"]).toBe("list-uuid");
    expect(fields["Name"]).toBe("My Spell List");
    expect(fields["Action"]).toBe("Insert");
    expect(fields["Type"]).toBe("SpellList");
    expect(fields["Items"]).toBe("spell1;spell2;spell3");
  });

  it("falls back to rawChildren when no item fields found", () => {
    const entry = makeEntry({
      section: "Lists",
      uuid: "list-uuid",
      changes: [makeChange({ change_type: "EntireEntryNew", field: "" })],
    });
    const rawAttrs = { UUID: "list-uuid" };
    const rawChildren = { SpellList: ["guid1", "guid2"] };
    const fields = changesToManualFields(entry, rawAttrs, rawChildren);
    expect(fields["Items"]).toBe("guid1;guid2");
  });
});

// ── changesToManualFields — EntireEntryNew with Selectors ────────────

describe("changesToManualFields — EntireEntryNew with Selectors", () => {
  it("parses raw Selectors into structured fields", () => {
    const entry = makeEntry({
      section: "Progressions",
      uuid: "p-uuid",
      changes: [makeChange({ change_type: "EntireEntryNew", field: "" })],
    });
    const rawAttrs = {
      Selectors: "SelectSpells(guid1,2);AddSpells(guid2,1)",
    };
    const fields = changesToManualFields(entry, rawAttrs);
    expect(fields["Selector:0:Action"]).toBe("Insert");
    expect(fields["Selector:0:Function"]).toBe("SelectSpells");
    expect(fields["Selector:0:Param:Guid"]).toBe("guid1");
    expect(fields["Selector:0:Param:Amount"]).toBe("2");
    expect(fields["Selector:1:Function"]).toBe("AddSpells");
  });
});

// ── changesToManualFields — EntireEntryNew for various sections ──────

describe("changesToManualFields — EntireEntryNew section-specific", () => {
  it("maps Origins raw attributes correctly", () => {
    const entry = makeEntry({
      section: "Origins",
      uuid: "o-uuid",
      changes: [makeChange({ change_type: "EntireEntryNew", field: "" })],
    });
    const rawAttrs = {
      BodyShape: "Normal",
      BodyType: "Male",
      VoiceTableUUID: "voice-uuid",
      Passives: "Passive1;Passive2",
    };
    const fields = changesToManualFields(entry, rawAttrs);
    expect(fields["Field:BodyShape"]).toBe("Normal");
    expect(fields["Field:BodyType"]).toBe("Male");
    expect(fields["Field:VoiceTableUUID"]).toBe("voice-uuid");
    expect(fields["String:0:Type"]).toBe("Passives");
    expect(fields["String:0:Values"]).toBe("Passive1;Passive2");
  });

  it("maps ActionResources boolean and field keys", () => {
    const entry = makeEntry({
      section: "ActionResources",
      uuid: "ar-uuid",
      changes: [makeChange({ change_type: "EntireEntryNew", field: "" })],
    });
    const rawAttrs = {
      IsHidden: "true",
      Name: "SpellSlot",
      DiceType: "d6",
      MaxLevel: "9",
    };
    const fields = changesToManualFields(entry, rawAttrs);
    expect(fields["Boolean:IsHidden"]).toBe("true");
    // Name is skipped in raw attribute mapping (excluded key)
    expect(fields["Field:DiceType"]).toBe("d6");
    expect(fields["Field:MaxLevel"]).toBe("9");
  });

  it("maps ClassDescriptions boolean and field keys", () => {
    const entry = makeEntry({
      section: "ClassDescriptions",
      uuid: "cd-uuid",
      changes: [makeChange({ change_type: "EntireEntryNew", field: "" })],
    });
    const rawAttrs = {
      CanLearnSpells: "true",
      MustPrepareSpells: "false",
      BaseHp: "8",
      HpPerLevel: "5",
      SpellCastingAbility: "Intelligence",
    };
    const fields = changesToManualFields(entry, rawAttrs);
    expect(fields["Boolean:CanLearnSpells"]).toBe("true");
    expect(fields["Boolean:MustPrepareSpells"]).toBe("false");
    expect(fields["Field:BaseHp"]).toBe("8");
    expect(fields["Field:SpellCastingAbility"]).toBe("Intelligence");
  });

  it("maps Backgrounds boolean key Hidden", () => {
    const entry = makeEntry({
      section: "Backgrounds",
      uuid: "bg-uuid",
      changes: [makeChange({ change_type: "EntireEntryNew", field: "" })],
    });
    const rawAttrs = { Hidden: "true", Passives: "SomePassive" };
    const fields = changesToManualFields(entry, rawAttrs);
    expect(fields["Boolean:Hidden"]).toBe("true");
    expect(fields["String:0:Type"]).toBe("Passives");
  });

  it("maps BackgroundGoals field keys", () => {
    const entry = makeEntry({
      section: "BackgroundGoals",
      uuid: "bgg-uuid",
      changes: [makeChange({ change_type: "EntireEntryNew", field: "" })],
    });
    const rawAttrs = {
      BackgroundUuid: "bg-uuid",
      ExperienceReward: "100",
      InspirationPoints: "1",
      RewardLevel: "2",
    };
    const fields = changesToManualFields(entry, rawAttrs);
    expect(fields["Field:BackgroundUuid"]).toBe("bg-uuid");
    expect(fields["Field:ExperienceReward"]).toBe("100");
  });

  it("skips string keys with no non-empty parts", () => {
    const entry = makeEntry({
      section: "Feats",
      uuid: "f-uuid",
      changes: [makeChange({ change_type: "EntireEntryNew", field: "" })],
    });
    const rawAttrs = { PassivesAdded: ";;;" }; // all empty after split
    const fields = changesToManualFields(entry, rawAttrs);
    // No String: fields should be created for empty parts
    expect(Object.keys(fields).filter(k => k.startsWith("String:"))).toHaveLength(0);
  });
});

// ── changesToManualFields — Children in EntireEntryNew ───────────────

describe("changesToManualFields — EntireEntryNew children", () => {
  it("maps Races children to Child fields", () => {
    const entry = makeEntry({
      section: "Races",
      uuid: "r-uuid",
      changes: [makeChange({ change_type: "EntireEntryNew", field: "" })],
    });
    const rawAttrs = { SomeKey: "val" };
    const rawChildren = { EyeColors: ["ec1", "ec2"], HairColors: ["hc1"] };
    const fields = changesToManualFields(entry, rawAttrs, rawChildren);
    expect(fields["Child:0:Type"]).toBe("EyeColors");
    expect(fields["Child:0:Values"]).toBe("ec1");
    expect(fields["Child:1:Values"]).toBe("ec2");
    expect(fields["Child:2:Type"]).toBe("HairColors");
    expect(fields["Child:2:Values"]).toBe("hc1");
  });

  it("maps Tags children to Tag fields for non-Races sections", () => {
    const entry = makeEntry({
      section: "Progressions",
      uuid: "p-uuid",
      changes: [makeChange({ change_type: "EntireEntryNew", field: "" })],
    });
    const rawAttrs = { SomeKey: "val" };
    const rawChildren = { Tags: ["t1", "t2"] };
    const fields = changesToManualFields(entry, rawAttrs, rawChildren);
    expect(fields["Tag:0:UUIDs"]).toBe("t1;t2");
    expect(fields["Tag:0:Action"]).toBe("Insert");
    expect(fields["Tag:0:Type"]).toBe("Tags");
  });

  it("skips SubClass children in EntireEntryNew", () => {
    const entry = makeEntry({
      section: "ClassDescriptions",
      uuid: "cd-uuid",
      changes: [makeChange({ change_type: "EntireEntryNew", field: "" })],
    });
    const rawAttrs = {};
    const rawChildren = { SubClass: ["sub1"] };
    const fields = changesToManualFields(entry, rawAttrs, rawChildren);
    expect(Object.keys(fields).filter(k => k.startsWith("Subclass:"))).toHaveLength(0);
  });

  it("skips empty children groups", () => {
    const entry = makeEntry({
      section: "Races",
      uuid: "r-uuid",
      changes: [makeChange({ change_type: "EntireEntryNew", field: "" })],
    });
    const rawAttrs = {};
    const rawChildren = { Tags: [] };
    const fields = changesToManualFields(entry, rawAttrs, rawChildren);
    expect(Object.keys(fields).filter(k => k.startsWith("Tag:") || k.startsWith("Child:"))).toHaveLength(0);
  });
});

// ── highlightYaml (preview.ts version) ───────────────────────────────

describe("highlightYaml (preview.ts)", () => {
  it("highlights YAML keys", () => {
    const result = highlightYaml("  UUID: abc-123");
    expect(result).toContain("yaml-key");
  });

  it("highlights quoted strings", () => {
    const result = highlightYaml('  Name: "Wizard"');
    expect(result).toContain("yaml-string");
  });

  it("highlights boolean values", () => {
    const result = highlightYaml("  Hidden: true");
    expect(result).toContain("yaml-boolean");
  });

  it("highlights number values", () => {
    const result = highlightYaml("  Level: 5");
    expect(result).toContain("yaml-number");
  });

  it("highlights comments", () => {
    const result = highlightYaml("  # this is a comment");
    expect(result).toContain("yaml-comment");
  });

  it("highlights anchors", () => {
    const result = highlightYaml("  key: &anchor");
    expect(result).toContain("yaml-anchor");
  });

  it("highlights aliases", () => {
    const result = highlightYaml("  key: *alias");
    expect(result).toContain("yaml-alias");
  });

  it("escapes HTML entities", () => {
    const result = highlightYaml("  key: <value>");
    expect(result).toContain("&lt;");
    expect(result).toContain("&gt;");
  });

  it("handles empty string", () => {
    const result = highlightYaml("");
    expect(result).toBe("");
  });

  it("highlights floating point numbers", () => {
    const result = highlightYaml("  weight: 3.14");
    expect(result).toContain("yaml-number");
  });
});

// ── highlightJson (preview.ts version) ───────────────────────────────

describe("highlightJson (preview.ts)", () => {
  it("highlights JSON keys", () => {
    const result = highlightJson('"UUID": "abc"');
    expect(result).toContain("json-key");
  });

  it("highlights string values", () => {
    const result = highlightJson(': "value"');
    expect(result).toContain("json-string");
  });

  it("highlights numbers", () => {
    const result = highlightJson(": 42");
    expect(result).toContain("json-number");
  });

  it("highlights booleans", () => {
    const result = highlightJson(": true");
    expect(result).toContain("json-boolean");
  });

  it("escapes HTML entities", () => {
    const result = highlightJson('"key": "<>"');
    expect(result).toContain("&lt;");
  });

  it("handles empty string", () => {
    expect(highlightJson("")).toBe("");
  });
});

// ── highlightXml (preview.ts version) ────────────────────────────────

describe("highlightXml (preview.ts)", () => {
  it("highlights XML declaration", () => {
    const result = highlightXml('<?xml version="1.0"?>');
    expect(result).toContain("xml-decl");
  });

  it("highlights XML comments", () => {
    const result = highlightXml("<!-- comment -->");
    expect(result).toContain("xml-comment");
  });

  it("highlights closing tags", () => {
    const result = highlightXml("</region>");
    expect(result).toContain("xml-tag");
  });

  it("highlights self-closing tags with attributes", () => {
    const result = highlightXml('<attribute id="UUID" type="guid" value="abc" />');
    expect(result).toContain("xml-tag");
    expect(result).toContain("xml-attr");
    expect(result).toContain("xml-value");
  });

  it("highlights opening tags with attributes", () => {
    const result = highlightXml('<node id="root">');
    expect(result).toContain("xml-tag");
    expect(result).toContain("xml-attr");
    expect(result).toContain("xml-value");
  });

  it("escapes HTML entities", () => {
    const result = highlightXml("a & b");
    expect(result).toContain("&amp;");
  });

  it("handles empty string", () => {
    expect(highlightXml("")).toBe("");
  });
});

// ── changesToManualFields — Passives field splitting ─────────────────

describe("changesToManualFields — Lists item extraction", () => {
  it("splits Passives by comma in Lists population", () => {
    const entry = makeEntry({
      section: "Lists",
      uuid: "list-uuid",
      changes: [makeChange({ change_type: "EntireEntryNew", field: "" })],
    });
    const rawAttrs = { UUID: "list-uuid", Passives: "Passive1,Passive2,Passive3" };
    const fields = changesToManualFields(entry, rawAttrs);
    expect(fields["Items"]).toBe("Passive1;Passive2;Passive3");
  });

  it("splits Skills by comma in Lists population", () => {
    const entry = makeEntry({
      section: "Lists",
      uuid: "list-uuid",
      changes: [makeChange({ change_type: "EntireEntryNew", field: "" })],
    });
    const rawAttrs = { UUID: "list-uuid", Skills: "Arcana,Athletics" };
    const fields = changesToManualFields(entry, rawAttrs);
    expect(fields["Items"]).toBe("Arcana;Athletics");
  });

  it("splits Spells by semicolon in Lists population", () => {
    const entry = makeEntry({
      section: "Lists",
      uuid: "list-uuid",
      changes: [makeChange({ change_type: "EntireEntryNew", field: "" })],
    });
    const rawAttrs = { UUID: "list-uuid", Spells: "Spell1;Spell2" };
    const fields = changesToManualFields(entry, rawAttrs);
    expect(fields["Items"]).toBe("Spell1;Spell2");
  });

  it("merges multiple item fields", () => {
    const entry = makeEntry({
      section: "Lists",
      uuid: "list-uuid",
      changes: [makeChange({ change_type: "EntireEntryNew", field: "" })],
    });
    const rawAttrs = {
      UUID: "list-uuid",
      Spells: "Spell1",
      Abilities: "Str;Dex",
    };
    const fields = changesToManualFields(entry, rawAttrs);
    expect(fields["Items"]).toContain("Spell1");
    expect(fields["Items"]).toContain("Str");
    expect(fields["Items"]).toContain("Dex");
  });
});
