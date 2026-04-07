/**
 * fieldCodec tests — covers encode/decode round-trips for all field types,
 * edge cases, and the merging behavior for children.
 */
import { describe, it, expect } from "vitest";
import {
  decodeSimpleFields,
  encodeSimpleFields,
  decodeBooleans,
  encodeBooleans,
  decodeFields,
  encodeFields,
  decodeSpellFields,
  encodeSpellFields,
  decodeSelectors,
  encodeSelectors,
  decodeStrings,
  encodeStrings,
  decodeChildren,
  encodeChildren,
  decodeTags,
  encodeTags,
  decodeSubclasses,
  encodeSubclasses,
  normalizeUuids,
  cssToBg3Color,
  bg3ToCssColor,
  formStateToDbColumns,
} from "../lib/utils/fieldCodec.js";

// ── Simple fields ───────────────────────────────────────────────────

describe("decodeSimpleFields", () => {
  it("extracts fields matching the prefix", () => {
    const result = decodeSimpleFields({ "Field:Name": "Bob", "Field:Level": "5", "Other:X": "Y" }, "Field");
    expect(result).toEqual([
      { key: "Name", value: "Bob" },
      { key: "Level", value: "5" },
    ]);
  });

  it("returns empty array for no matches", () => {
    expect(decodeSimpleFields({ "X:Y": "Z" }, "Field")).toEqual([]);
  });
});

describe("encodeSimpleFields", () => {
  it("encodes key/value pairs under prefix", () => {
    const r: Record<string, string> = {};
    encodeSimpleFields([{ key: "Name", value: "Bob" }], "Field", r);
    expect(r["Field:Name"]).toBe("Bob");
  });

  it("skips entries with empty key", () => {
    const r: Record<string, string> = {};
    encodeSimpleFields([{ key: "", value: "Val" }], "Field", r);
    expect(Object.keys(r)).toHaveLength(0);
  });

  it("skips empty values when requireValue is true", () => {
    const r: Record<string, string> = {};
    encodeSimpleFields([{ key: "A", value: "" }], "Field", r, true);
    expect(Object.keys(r)).toHaveLength(0);
  });

  it("keeps empty values when requireValue is false", () => {
    const r: Record<string, string> = {};
    encodeSimpleFields([{ key: "A", value: "" }], "Field", r, false);
    expect(r["Field:A"]).toBe("");
  });
});

// ── Booleans ────────────────────────────────────────────────────────

describe("booleans", () => {
  it("decode/encode round-trip", () => {
    const pf = { "Boolean:Hidden": "true", "Boolean:IsSpell": "false" };
    const decoded = decodeBooleans(pf);
    expect(decoded).toEqual([
      { key: "Hidden", value: true },
      { key: "IsSpell", value: false },
    ]);
    const r: Record<string, string> = {};
    encodeBooleans(decoded, r);
    expect(r).toEqual(pf);
  });

  it("treats non-'true' as false", () => {
    expect(decodeBooleans({ "Boolean:X": "yes" })[0].value).toBe(false);
  });
});

// ── Fields ──────────────────────────────────────────────────────────

describe("fields", () => {
  it("decode/encode round-trip with requireValue", () => {
    const pf = { "Field:Name": "Elf" };
    const decoded = decodeFields(pf);
    expect(decoded).toEqual([{ key: "Name", value: "Elf" }]);
    const r: Record<string, string> = {};
    encodeFields(decoded, r);
    expect(r).toEqual(pf);
  });

  it("encodeFields skips empty values", () => {
    const r: Record<string, string> = {};
    encodeFields([{ key: "Name", value: "" }], r);
    expect(Object.keys(r)).toHaveLength(0);
  });
});

// ── SpellFields ─────────────────────────────────────────────────────

describe("spellFields", () => {
  it("decode/encode round-trip", () => {
    const pf = { "SpellField:CastingAbility": "Intelligence" };
    const decoded = decodeSpellFields(pf);
    expect(decoded).toHaveLength(1);
    const r: Record<string, string> = {};
    encodeSpellFields(decoded, r);
    expect(r).toEqual(pf);
  });
});

// ── Strings ─────────────────────────────────────────────────────────

describe("strings", () => {
  it("decode/encode round-trip", () => {
    const pf = {
      "String:0:Action": "Insert",
      "String:0:Type": "Boosts",
      "String:0:Values": "ProficiencyBonus(SavingThrow,Constitution)",
      "String:0:modGuid": "",
    };
    const decoded = decodeStrings(pf);
    expect(decoded).toHaveLength(1);
    expect(decoded[0].type).toBe("Boosts");
    expect(decoded[0].values).toBe("ProficiencyBonus(SavingThrow,Constitution)");
    const r: Record<string, string> = {};
    encodeStrings(decoded, r);
    expect(r["String:0:Values"]).toBe(decoded[0].values);
  });

  it("defaults empty type to 'Boosts'", () => {
    const decoded = decodeStrings({
      "String:0:Action": "Insert",
      "String:0:Type": "",
      "String:0:Values": "x",
    });
    expect(decoded[0].type).toBe("Boosts");
  });

  it("skips entries with empty values on encode", () => {
    const r: Record<string, string> = {};
    encodeStrings([{ action: "Insert", type: "Boosts", values: "", modGuid: "" }], r);
    expect(Object.keys(r)).toHaveLength(0);
  });
});

// ── Children ────────────────────────────────────────────────────────

describe("children", () => {
  it("decode/encode round-trip", () => {
    const pf = {
      "Child:0:Type": "EyeColors",
      "Child:0:Values": "uuid1;uuid2",
      "Child:0:Action": "Insert",
      "Child:0:modGuid": "",
    };
    const decoded = decodeChildren(pf);
    expect(decoded).toHaveLength(1);
    expect(decoded[0].values).toEqual(["uuid1", "uuid2"]);
  });

  it("merges children with same type+action", () => {
    const pf = {
      "Child:0:Type": "EyeColors",
      "Child:0:Values": "uuid1",
      "Child:0:Action": "Insert",
      "Child:1:Type": "EyeColors",
      "Child:1:Values": "uuid2",
      "Child:1:Action": "Insert",
    };
    const decoded = decodeChildren(pf);
    expect(decoded).toHaveLength(1);
    expect(decoded[0].values).toEqual(["uuid1", "uuid2"]);
  });

  it("does not merge children with different actions", () => {
    const pf = {
      "Child:0:Type": "EyeColors",
      "Child:0:Values": "uuid1",
      "Child:0:Action": "Insert",
      "Child:1:Type": "EyeColors",
      "Child:1:Values": "uuid2",
      "Child:1:Action": "Remove",
    };
    const decoded = decodeChildren(pf);
    expect(decoded).toHaveLength(2);
  });

  it("defaults empty action to 'Insert'", () => {
    const decoded = decodeChildren({
      "Child:0:Type": "X",
      "Child:0:Values": "uuid1",
    });
    expect(decoded[0].action).toBe("Insert");
  });

  it("skips empty values on encode", () => {
    const r: Record<string, string> = {};
    encodeChildren([{ type: "X", values: [], action: "Insert", modGuid: "" }], r);
    expect(Object.keys(r)).toHaveLength(0);
  });

  it("handles semicolons and whitespace in values", () => {
    const decoded = decodeChildren({
      "Child:0:Type": "X",
      "Child:0:Values": " uuid1 ; uuid2 ; ; uuid3 ",
      "Child:0:Action": "Insert",
    });
    expect(decoded[0].values).toEqual(["uuid1", "uuid2", "uuid3"]);
  });
});

// ── Tags ────────────────────────────────────────────────────────────

describe("tags", () => {
  it("decode/encode round-trip", () => {
    const pf = {
      "Tag:0:Action": "Insert",
      "Tag:0:UUIDs": "tag-uuid-1;tag-uuid-2",
      "Tag:0:Type": "Tags",
    };
    const decoded = decodeTags(pf);
    expect(decoded).toHaveLength(1);
    expect(decoded[0].uuids).toEqual(["tag-uuid-1", "tag-uuid-2"]);
    const r: Record<string, string> = {};
    encodeTags(decoded, r);
    expect(r["Tag:0:UUIDs"]).toBe("tag-uuid-1;tag-uuid-2");
  });

  it("skips empty UUID lists on encode", () => {
    const r: Record<string, string> = {};
    encodeTags([{ uuids: [], action: "Insert", type: "Tags", modGuid: "" }], r);
    expect(Object.keys(r)).toHaveLength(0);
  });

  it("defaults empty type to 'Tags'", () => {
    const decoded = decodeTags({
      "Tag:0:Action": "Insert",
      "Tag:0:UUIDs": "x",
      "Tag:0:Type": "",
    });
    expect(decoded[0].type).toBe("Tags");
  });
});

// ── Subclasses ──────────────────────────────────────────────────────

describe("subclasses", () => {
  it("decode/encode round-trip", () => {
    const pf = {
      "Subclass:0:UUID": "sub-uuid-1",
      "Subclass:0:Action": "Remove",
    };
    const decoded = decodeSubclasses(pf);
    expect(decoded).toHaveLength(1);
    expect(decoded[0].uuid).toBe("sub-uuid-1");
    expect(decoded[0].action).toBe("Remove");
  });

  it("defaults empty action to 'Remove'", () => {
    const decoded = decodeSubclasses({ "Subclass:0:UUID": "x" });
    expect(decoded[0].action).toBe("Remove");
  });
});

// ── Selectors ───────────────────────────────────────────────────────

describe("selectors", () => {
  it("decodes basic selector", () => {
    const pf = {
      "Selector:0:Action": "Insert",
      "Selector:0:Function": "SelectSkills",
      "Selector:0:UUID": "sel-uuid",
    };
    const decoded = decodeSelectors(pf);
    expect(decoded).toHaveLength(1);
    expect(decoded[0].fn).toBe("SelectSkills");
    expect(decoded[0].selectorUuid).toBe("sel-uuid");
  });

  it("encodes selector with parameters", () => {
    const r: Record<string, string> = {};
    encodeSelectors([{
      action: "Insert",
      fn: "SelectSkills",
      selectorUuid: "sel-uuid",
      overwrite: false,
      modGuid: "",
      isReplace: false,
      params: { Guid: "", Amount: "3", SwapAmount: "", SelectorId: "", CastingAbility: "", ActionResource: "", PrepareType: "", CooldownType: "", BonusType: "", Amounts: "", LimitToProficiency: "" },
    }], r);
    expect(r["Selector:0:Function"]).toBe("SelectSkills");
  });

  it("maps SelectPassives with isReplace to ReplacePassives", () => {
    const r: Record<string, string> = {};
    encodeSelectors([{
      action: "Insert",
      fn: "SelectPassives",
      selectorUuid: "",
      overwrite: false,
      modGuid: "",
      isReplace: true,
      params: { Guid: "", Amount: "", SwapAmount: "", SelectorId: "", CastingAbility: "", ActionResource: "", PrepareType: "", CooldownType: "", BonusType: "", Amounts: "", LimitToProficiency: "" },
    }], r);
    expect(r["Selector:0:Function"]).toBe("ReplacePassives");
  });

  it("skips selectors with empty function name", () => {
    const r: Record<string, string> = {};
    encodeSelectors([{
      action: "Insert",
      fn: "",
      selectorUuid: "",
      overwrite: false,
      modGuid: "",
      isReplace: false,
      params: { Guid: "", Amount: "", SwapAmount: "", SelectorId: "", CastingAbility: "", ActionResource: "", PrepareType: "", CooldownType: "", BonusType: "", Amounts: "", LimitToProficiency: "" },
    }], r);
    expect(Object.keys(r)).toHaveLength(0);
  });
});

// ── Selectors (extended) ────────────────────────────────────────────

describe("selectors (extended)", () => {
  it("full decode→encode roundtrip with params", () => {
    const pf: Record<string, string> = {
      "Selector:0:Action": "Insert",
      "Selector:0:Function": "SelectSpells",
      "Selector:0:UUID": "sel-uuid-1",
      "Selector:0:Overwrite": "true",
      "Selector:0:modGuid": "mod-guid-1",
      "Selector:0:IsReplace": "false",
      "Selector:0:Param:Guid": "list-uuid",
      "Selector:0:Param:Amount": "3",
      "Selector:0:Param:CastingAbility": "Intelligence",
    };
    const decoded = decodeSelectors(pf);
    expect(decoded).toHaveLength(1);
    expect(decoded[0].fn).toBe("SelectSpells");
    expect(decoded[0].overwrite).toBe(true);
    expect(decoded[0].modGuid).toBe("mod-guid-1");
    expect(decoded[0].isReplace).toBe(false);
    expect(decoded[0].params.Guid).toBe("list-uuid");
    expect(decoded[0].params.Amount).toBe("3");
    expect(decoded[0].params.CastingAbility).toBe("Intelligence");
    // Encode back
    const r: Record<string, string> = {};
    encodeSelectors(decoded, r);
    expect(r["Selector:0:Function"]).toBe("SelectSpells");
    expect(r["Selector:0:Overwrite"]).toBe("true");
    expect(r["Selector:0:modGuid"]).toBe("mod-guid-1");
    expect(r["Selector:0:Param:Guid"]).toBe("list-uuid");
    expect(r["Selector:0:Param:Amount"]).toBe("3");
    expect(r["Selector:0:Param:CastingAbility"]).toBe("Intelligence");
  });

  it("handles non-contiguous indices", () => {
    const pf: Record<string, string> = {
      "Selector:0:Action": "Insert",
      "Selector:0:Function": "SelectSkills",
      "Selector:2:Action": "Insert",
      "Selector:2:Function": "SelectPassives",
    };
    const decoded = decodeSelectors(pf);
    expect(decoded).toHaveLength(2);
    expect(decoded[0].fn).toBe("SelectSkills");
    expect(decoded[1].fn).toBe("SelectPassives");
  });

  it("decodes multiple selectors and re-indexes on encode", () => {
    const pf: Record<string, string> = {
      "Selector:0:Action": "Insert",
      "Selector:0:Function": "SelectSkills",
      "Selector:0:Param:Amount": "2",
      "Selector:1:Action": "Insert",
      "Selector:1:Function": "AddSpells",
      "Selector:1:Param:Guid": "spell-list",
    };
    const decoded = decodeSelectors(pf);
    expect(decoded).toHaveLength(2);
    const r: Record<string, string> = {};
    encodeSelectors(decoded, r);
    expect(r["Selector:0:Function"]).toBe("SelectSkills");
    expect(r["Selector:0:Param:Amount"]).toBe("2");
    expect(r["Selector:1:Function"]).toBe("AddSpells");
    expect(r["Selector:1:Param:Guid"]).toBe("spell-list");
  });

  it("only encodes params relevant to the function type", () => {
    const r: Record<string, string> = {};
    encodeSelectors([{
      action: "Insert",
      fn: "SelectSkills",
      selectorUuid: "",
      overwrite: false,
      modGuid: "",
      isReplace: false,
      params: { Guid: "g", Amount: "2", SwapAmount: "ignored", SelectorId: "sk1", CastingAbility: "also-ignored", ActionResource: "", PrepareType: "", CooldownType: "", BonusType: "", Amounts: "", LimitToProficiency: "" },
    }], r);
    // SelectSkills relevant: Guid, Amount, SelectorId
    expect(r["Selector:0:Param:Guid"]).toBe("g");
    expect(r["Selector:0:Param:Amount"]).toBe("2");
    expect(r["Selector:0:Param:SelectorId"]).toBe("sk1");
    // SwapAmount and CastingAbility are not relevant to SelectSkills
    expect(r["Selector:0:Param:SwapAmount"]).toBeUndefined();
    expect(r["Selector:0:Param:CastingAbility"]).toBeUndefined();
  });

  it("isReplace decode roundtrip", () => {
    const pf: Record<string, string> = {
      "Selector:0:Action": "Insert",
      "Selector:0:Function": "SelectPassives",
      "Selector:0:IsReplace": "true",
    };
    const decoded = decodeSelectors(pf);
    expect(decoded[0].isReplace).toBe(true);
    const r: Record<string, string> = {};
    encodeSelectors(decoded, r);
    expect(r["Selector:0:Function"]).toBe("ReplacePassives");
    expect(r["Selector:0:IsReplace"]).toBe("true");
  });
});

// ── Strings (extended) ─────────────────────────────────────────────

describe("strings (extended)", () => {
  it("preserves modGuid through roundtrip", () => {
    const pf: Record<string, string> = {
      "String:0:Action": "Insert",
      "String:0:Type": "Passives",
      "String:0:Values": "SomePassive",
      "String:0:modGuid": "mod-123",
    };
    const decoded = decodeStrings(pf);
    expect(decoded[0].modGuid).toBe("mod-123");
    const r: Record<string, string> = {};
    encodeStrings(decoded, r);
    expect(r["String:0:modGuid"]).toBe("mod-123");
  });

  it("handles non-contiguous indices", () => {
    const pf: Record<string, string> = {
      "String:0:Action": "Insert",
      "String:0:Type": "Boosts",
      "String:0:Values": "val0",
      "String:3:Action": "Insert",
      "String:3:Type": "Passives",
      "String:3:Values": "val3",
    };
    const decoded = decodeStrings(pf);
    expect(decoded).toHaveLength(2);
    expect(decoded[0].values).toBe("val0");
    expect(decoded[1].values).toBe("val3");
  });

  it("multiple strings re-indexed on encode", () => {
    const items: import("../lib/utils/fieldCodec.js").StringItem[] = [
      { action: "Insert", type: "Boosts", values: "A", modGuid: "" },
      { action: "Insert", type: "Passives", values: "B", modGuid: "" },
      { action: "Insert", type: "Boosts", values: "C", modGuid: "" },
    ];
    const r: Record<string, string> = {};
    encodeStrings(items, r);
    expect(r["String:0:Values"]).toBe("A");
    expect(r["String:1:Values"]).toBe("B");
    expect(r["String:2:Values"]).toBe("C");
  });

  it("strips whitespace-only values on encode", () => {
    const r: Record<string, string> = {};
    encodeStrings([{ action: "Insert", type: "Boosts", values: "   ", modGuid: "" }], r);
    expect(Object.keys(r)).toHaveLength(0);
  });
});

// ── Children (extended) ─────────────────────────────────────────────

describe("children (extended)", () => {
  it("full encode→decode roundtrip", () => {
    const items: import("../lib/utils/fieldCodec.js").ChildItem[] = [
      { type: "EyeColors", values: ["uuid1", "uuid2"], action: "Insert", modGuid: "mod-1" },
    ];
    const r: Record<string, string> = {};
    encodeChildren(items, r);
    expect(r["Child:0:Values"]).toBe("uuid1;uuid2");
    expect(r["Child:0:modGuid"]).toBe("mod-1");
    // Re-decode
    const decoded = decodeChildren(r);
    expect(decoded).toHaveLength(1);
    expect(decoded[0].values).toEqual(["uuid1", "uuid2"]);
    expect(decoded[0].modGuid).toBe("mod-1");
  });

  it("merge dedup drops duplicate values within same type+action", () => {
    const pf: Record<string, string> = {
      "Child:0:Type": "EyeColors",
      "Child:0:Values": "uuid1;uuid2",
      "Child:0:Action": "Insert",
      "Child:1:Type": "EyeColors",
      "Child:1:Values": "uuid2;uuid3",
      "Child:1:Action": "Insert",
    };
    const decoded = decodeChildren(pf);
    expect(decoded).toHaveLength(1);
    // uuid2 should appear only once
    expect(decoded[0].values).toEqual(["uuid1", "uuid2", "uuid3"]);
  });

  it("handles non-contiguous indices", () => {
    const pf: Record<string, string> = {
      "Child:0:Type": "EyeColors",
      "Child:0:Values": "a",
      "Child:5:Type": "HairColors",
      "Child:5:Values": "b",
    };
    const decoded = decodeChildren(pf);
    expect(decoded).toHaveLength(2);
    expect(decoded[0].type).toBe("EyeColors");
    expect(decoded[1].type).toBe("HairColors");
  });

  it("multiple children re-indexed on encode", () => {
    const items: import("../lib/utils/fieldCodec.js").ChildItem[] = [
      { type: "EyeColors", values: ["a"], action: "Insert", modGuid: "" },
      { type: "HairColors", values: ["b"], action: "Insert", modGuid: "" },
    ];
    const r: Record<string, string> = {};
    encodeChildren(items, r);
    expect(r["Child:0:Type"]).toBe("EyeColors");
    expect(r["Child:1:Type"]).toBe("HairColors");
  });
});

// ── Tags (extended) ─────────────────────────────────────────────────

describe("tags (extended)", () => {
  it("preserves modGuid through roundtrip", () => {
    const pf: Record<string, string> = {
      "Tag:0:Action": "Insert",
      "Tag:0:UUIDs": "tag-1",
      "Tag:0:Type": "Tags",
      "Tag:0:modGuid": "mod-abc",
    };
    const decoded = decodeTags(pf);
    expect(decoded[0].modGuid).toBe("mod-abc");
    const r: Record<string, string> = {};
    encodeTags(decoded, r);
    expect(r["Tag:0:modGuid"]).toBe("mod-abc");
  });

  it("handles non-contiguous indices", () => {
    const pf: Record<string, string> = {
      "Tag:0:Action": "Insert",
      "Tag:0:UUIDs": "a",
      "Tag:0:Type": "Tags",
      "Tag:3:Action": "Remove",
      "Tag:3:UUIDs": "b",
      "Tag:3:Type": "Tags",
    };
    const decoded = decodeTags(pf);
    expect(decoded).toHaveLength(2);
    expect(decoded[0].uuids).toEqual(["a"]);
    expect(decoded[1].uuids).toEqual(["b"]);
  });

  it("multiple tags re-indexed on encode", () => {
    const items: import("../lib/utils/fieldCodec.js").TagItem[] = [
      { uuids: ["a", "b"], action: "Insert", type: "Tags", modGuid: "" },
      { uuids: ["c"], action: "Remove", type: "Tags", modGuid: "" },
    ];
    const r: Record<string, string> = {};
    encodeTags(items, r);
    expect(r["Tag:0:UUIDs"]).toBe("a;b");
    expect(r["Tag:0:Action"]).toBe("Insert");
    expect(r["Tag:1:UUIDs"]).toBe("c");
    expect(r["Tag:1:Action"]).toBe("Remove");
  });

  it("handles semicolons and whitespace in UUIDs", () => {
    const decoded = decodeTags({
      "Tag:0:Action": "Insert",
      "Tag:0:UUIDs": " x ; y ; ; z ",
      "Tag:0:Type": "Tags",
    });
    expect(decoded[0].uuids).toEqual(["x", "y", "z"]);
  });
});

// ── Subclasses (extended) ───────────────────────────────────────────

describe("subclasses (extended)", () => {
  it("full encode→decode roundtrip with modGuid", () => {
    const items: import("../lib/utils/fieldCodec.js").SubclassItem[] = [
      { uuid: "sub-1", action: "Remove", modGuid: "mod-1" },
      { uuid: "sub-2", action: "Insert", modGuid: "" },
    ];
    const r: Record<string, string> = {};
    encodeSubclasses(items, r);
    expect(r["Subclass:0:UUID"]).toBe("sub-1");
    expect(r["Subclass:0:modGuid"]).toBe("mod-1");
    expect(r["Subclass:1:UUID"]).toBe("sub-2");
    // Re-decode
    const decoded = decodeSubclasses(r);
    expect(decoded).toHaveLength(2);
    expect(decoded[0].uuid).toBe("sub-1");
    expect(decoded[0].modGuid).toBe("mod-1");
    expect(decoded[1].uuid).toBe("sub-2");
    expect(decoded[1].action).toBe("Insert");
  });

  it("skips entries with empty uuid on encode", () => {
    const r: Record<string, string> = {};
    encodeSubclasses([{ uuid: "", action: "Remove", modGuid: "" }], r);
    expect(Object.keys(r)).toHaveLength(0);
  });

  it("skips whitespace-only uuid on encode", () => {
    const r: Record<string, string> = {};
    encodeSubclasses([{ uuid: "   ", action: "Remove", modGuid: "" }], r);
    expect(Object.keys(r)).toHaveLength(0);
  });

  it("handles non-contiguous indices", () => {
    const pf: Record<string, string> = {
      "Subclass:0:UUID": "s0",
      "Subclass:0:Action": "Remove",
      "Subclass:4:UUID": "s4",
      "Subclass:4:Action": "Insert",
    };
    const decoded = decodeSubclasses(pf);
    expect(decoded).toHaveLength(2);
    expect(decoded[0].uuid).toBe("s0");
    expect(decoded[1].uuid).toBe("s4");
  });
});

// ── Special characters ──────────────────────────────────────────────

describe("special characters in values", () => {
  it("preserves unicode in simple fields", () => {
    const pf = { "Field:Name": "Elf — «Ñoño»" };
    const decoded = decodeFields(pf);
    expect(decoded[0].value).toBe("Elf — «Ñoño»");
    const r: Record<string, string> = {};
    encodeFields(decoded, r);
    expect(r["Field:Name"]).toBe("Elf — «Ñoño»");
  });

  it("preserves colons in decoded key names", () => {
    const decoded = decodeBooleans({ "Boolean:Has:Colon": "true" });
    expect(decoded).toHaveLength(1);
    expect(decoded[0].key).toBe("Has:Colon");
    expect(decoded[0].value).toBe(true);
  });

  it("preserves parentheses and commas in string values", () => {
    const pf: Record<string, string> = {
      "String:0:Action": "Insert",
      "String:0:Type": "Boosts",
      "String:0:Values": "ProficiencyBonus(SavingThrow,Constitution)",
    };
    const decoded = decodeStrings(pf);
    const r: Record<string, string> = {};
    encodeStrings(decoded, r);
    expect(r["String:0:Values"]).toBe("ProficiencyBonus(SavingThrow,Constitution)");
  });
});

// ── normalizeUuids ──

describe("normalizeUuids", () => {
  it("returns single uuid without array flag", () => {
    expect(normalizeUuids(["abc-123"])).toEqual({ uuid: "abc-123", isArray: false });
  });

  it("joins multiple uuids with pipe", () => {
    expect(normalizeUuids(["a", "b", "c"])).toEqual({ uuid: "a|b|c", isArray: true });
  });

  it("filters out empty and whitespace-only entries", () => {
    expect(normalizeUuids(["a", "", "  ", "b"])).toEqual({ uuid: "a|b", isArray: true });
  });

  it("returns empty string for all-empty input", () => {
    expect(normalizeUuids(["", "  "])).toEqual({ uuid: "", isArray: false });
  });

  it("trims whitespace from entries", () => {
    expect(normalizeUuids(["  x  "])).toEqual({ uuid: "x", isArray: false });
  });
});

// ── cssToBg3Color / bg3ToCssColor ──

describe("cssToBg3Color", () => {
  it("adds ff alpha to 6-char hex", () => {
    expect(cssToBg3Color("#ff0000")).toBe("#ffff0000");
  });

  it("passes through 8-char hex as-is", () => {
    expect(cssToBg3Color("#80ff0000")).toBe("#80ff0000");
  });

  it("handles hex without hash", () => {
    expect(cssToBg3Color("aabbcc")).toBe("#ffaabbcc");
  });
});

describe("bg3ToCssColor", () => {
  it("strips alpha from 8-char hex", () => {
    expect(bg3ToCssColor("#ffff0000")).toBe("#ff0000");
  });

  it("passes through 6-char hex as-is", () => {
    expect(bg3ToCssColor("#ff0000")).toBe("#ff0000");
  });

  it("handles hex without hash", () => {
    expect(bg3ToCssColor("80aabbcc")).toBe("#aabbcc");
  });
});

// ── formStateToDbColumns ────────────────────────────────────────────

describe("formStateToDbColumns", () => {
  it("maps Field: prefixed keys to raw column names", () => {
    const result = formStateToDbColumns({ "Field:Name": "Elf", "Field:Level": "5" });
    expect(result["Name"]).toBe("Elf");
    expect(result["Level"]).toBe("5");
  });

  it("maps Boolean: prefixed keys to raw column names", () => {
    const result = formStateToDbColumns({ "Boolean:Hidden": "true", "Boolean:AllowImprovement": "false" });
    expect(result["Hidden"]).toBe("true");
    expect(result["AllowImprovement"]).toBe("false");
  });

  it("maps SpellField: prefixed keys to raw column names", () => {
    const result = formStateToDbColumns({ "SpellField:CastingAbility": "Intelligence" });
    expect(result["CastingAbility"]).toBe("Intelligence");
  });

  it("strips META_KEYS from output", () => {
    const result = formStateToDbColumns({
      "_entryLabel": "My Entry",
      "_nodeType": "some-node",
      "_uuidIsArray": "true",
      "modGuid": "some-guid",
      "Action": "Insert",
      "Blacklist": "x",
      "Field:Name": "Elf",
    });
    expect(result["_entryLabel"]).toBeUndefined();
    expect(result["_nodeType"]).toBeUndefined();
    expect(result["_uuidIsArray"]).toBeUndefined();
    expect(result["modGuid"]).toBeUndefined();
    expect(result["Action"]).toBeUndefined();
    expect(result["Blacklist"]).toBeUndefined();
    expect(result["Name"]).toBe("Elf");
  });

  it("passes through direct keys (UUID, EntryName, etc.)", () => {
    const result = formStateToDbColumns({ "UUID": "abc-123", "EntryName": "MyEntry", "Type": "ClassDescription" });
    expect(result["UUID"]).toBe("abc-123");
    expect(result["EntryName"]).toBe("MyEntry");
    expect(result["Type"]).toBe("ClassDescription");
  });

  it("serializes String:N:Type + Values into typed columns", () => {
    const result = formStateToDbColumns({
      "String:0:Action": "Insert",
      "String:0:Type": "Boosts",
      "String:0:Values": "ProficiencyBonus(SavingThrow,Constitution)",
    });
    expect(result["Boosts"]).toBe("ProficiencyBonus(SavingThrow,Constitution)");
  });

  it("serializes multiple String entries into separate columns", () => {
    const result = formStateToDbColumns({
      "String:0:Action": "Insert",
      "String:0:Type": "Boosts",
      "String:0:Values": "BoostA",
      "String:1:Action": "Insert",
      "String:1:Type": "Passives",
      "String:1:Values": "PassiveB",
    });
    expect(result["Boosts"]).toBe("BoostA");
    expect(result["Passives"]).toBe("PassiveB");
  });

  it("skips String entries with empty type or values", () => {
    const result = formStateToDbColumns({
      "String:0:Action": "Insert",
      "String:0:Type": "",
      "String:0:Values": "val",
      "String:1:Action": "Insert",
      "String:1:Type": "Boosts",
      "String:1:Values": "",
    });
    expect(result["Boosts"]).toBeUndefined();
    expect(result[""]).toBeUndefined();
  });

  it("serializes Selector entries to LSX format Selectors column", () => {
    const result = formStateToDbColumns({
      "Selector:0:Action": "Insert",
      "Selector:0:Function": "SelectSpells",
      "Selector:0:Param:Guid": "spell-list-uuid",
      "Selector:0:Param:Amount": "3",
    });
    expect(result["Selectors"]).toBe("SelectSpells(spell-list-uuid,3)");
  });

  it("serializes multiple selectors joined by semicolons", () => {
    const result = formStateToDbColumns({
      "Selector:0:Action": "Insert",
      "Selector:0:Function": "SelectSkills",
      "Selector:0:Param:Guid": "g1",
      "Selector:0:Param:Amount": "2",
      "Selector:1:Action": "Insert",
      "Selector:1:Function": "AddSpells",
      "Selector:1:Param:Guid": "g2",
    });
    expect(result["Selectors"]).toBe("SelectSkills(g1,2);AddSpells(g2)");
  });

  it("maps IsReplace selectors to ReplacePassives in Selectors column", () => {
    const result = formStateToDbColumns({
      "Selector:0:Action": "Insert",
      "Selector:0:Function": "SelectPassives",
      "Selector:0:IsReplace": "true",
      "Selector:0:Param:Guid": "g1",
    });
    expect(result["Selectors"]).toBe("ReplacePassives(g1)");
  });

  it("skips selectors without a Function key", () => {
    const result = formStateToDbColumns({
      "Selector:0:Action": "Insert",
      "Selector:0:Param:Guid": "g1",
    });
    expect(result["Selectors"]).toBeUndefined();
  });

  it("trims trailing empty positional args in selectors", () => {
    const result = formStateToDbColumns({
      "Selector:0:Action": "Insert",
      "Selector:0:Function": "SelectSpells",
      "Selector:0:Param:Guid": "g1",
      "Selector:0:Param:Amount": "",
      "Selector:0:Param:SwapAmount": "",
      "Selector:0:Param:SelectorId": "",
    });
    expect(result["Selectors"]).toBe("SelectSpells(g1)");
  });

  it("skips Child:, Tag:, Subclass: prefixed keys", () => {
    const result = formStateToDbColumns({
      "Child:0:Type": "EyeColors",
      "Child:0:Values": "uuid1",
      "Tag:0:Action": "Insert",
      "Tag:0:UUIDs": "tag1",
      "Subclass:0:UUID": "sub1",
      "Field:Name": "Elf",
    });
    expect(result["Name"]).toBe("Elf");
    expect(Object.keys(result)).toEqual(["Name"]);
  });

  it("skips indexed String sub-keys missing colon separator", () => {
    const result = formStateToDbColumns({
      "String:0Type": "Boosts",
      "Field:Name": "Elf",
    });
    // The malformed key has no colon after the index, so it's not an indexed String
    // It's also not a recognized prefix, so falls through to direct key
    expect(result["Name"]).toBe("Elf");
  });

  it("handles mixed prefixed and direct keys", () => {
    const result = formStateToDbColumns({
      "UUID": "my-uuid",
      "Field:DisplayName": "Cool Race",
      "Boolean:AllowImprovement": "true",
      "SpellField:CastAbility": "Wisdom",
      "String:0:Type": "Boosts",
      "String:0:Values": "ActionSurge",
      "String:0:Action": "Insert",
      "_entryLabel": "label",
      "modGuid": "guid",
    });
    expect(result["UUID"]).toBe("my-uuid");
    expect(result["DisplayName"]).toBe("Cool Race");
    expect(result["AllowImprovement"]).toBe("true");
    expect(result["CastAbility"]).toBe("Wisdom");
    expect(result["Boosts"]).toBe("ActionSurge");
    expect(result["_entryLabel"]).toBeUndefined();
    expect(result["modGuid"]).toBeUndefined();
  });

  it("sorts selector indices numerically", () => {
    const result = formStateToDbColumns({
      "Selector:2:Action": "Insert",
      "Selector:2:Function": "AddSpells",
      "Selector:2:Param:Guid": "g2",
      "Selector:0:Action": "Insert",
      "Selector:0:Function": "SelectSkills",
      "Selector:0:Param:Guid": "g0",
    });
    expect(result["Selectors"]).toBe("SelectSkills(g0);AddSpells(g2)");
  });

  it("returns empty object for empty input", () => {
    expect(formStateToDbColumns({})).toEqual({});
  });

  it("returns empty object when only meta keys provided", () => {
    const result = formStateToDbColumns({
      "_entryLabel": "label",
      "modGuid": "g",
      "Action": "Insert",
    });
    expect(result).toEqual({});
  });
});
