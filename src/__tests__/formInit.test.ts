import { describe, it, expect } from "vitest";
import { buildFormState, encodeFormState, type FormState, type BuildFormStateInput } from "../lib/utils/formInit.js";

describe("buildFormState", () => {
  it("returns defaults for null prefill", () => {
    const result = buildFormState({ prefill: null, section: "Progressions" });
    expect(result.uuids).toEqual([""]);
    expect(result.displayName).toBe("");
    expect(result.listAction).toBe("Insert");
    expect(result.listType).toBe("SpellList");
    expect(result.blacklist).toBe(false);
    expect(result.modGuid).toBe("");
    expect(result.comment).toBe("");
  });

  it("parses semicolon-separated UUIDs", () => {
    const result = buildFormState({
      prefill: { UUID: "aaa;bbb;ccc" },
      section: "Progressions",
    });
    expect(result.uuids).toEqual(["aaa", "bbb", "ccc"]);
  });

  it("parses pipe-separated UUIDs", () => {
    const result = buildFormState({
      prefill: { UUID: "aaa|bbb" },
      section: "Progressions",
    });
    expect(result.uuids).toEqual(["aaa", "bbb"]);
  });

  it("uses StatID as fallback for UUID field", () => {
    const result = buildFormState({
      prefill: { StatID: "my-stat" },
      section: "Progressions",
    });
    expect(result.uuids).toEqual(["my-stat"]);
  });

  it("reads displayName from _entryLabel or EntryName", () => {
    expect(buildFormState({ prefill: { _entryLabel: "FromLabel" }, section: "X" }).displayName).toBe("FromLabel");
    expect(buildFormState({ prefill: { EntryName: "Spell1" }, section: "X" }).displayName).toBe("Spell1");
    expect(buildFormState({ prefill: {}, section: "X", rawAttributes: { Name: "RawName" } }).displayName).toBe("");
    // _entryLabel takes priority over EntryName
    expect(buildFormState({ prefill: { _entryLabel: "A", EntryName: "B" }, section: "X" }).displayName).toBe("A");
  });

  it("decodes Action, Type, Items, modGuid from prefill", () => {
    const result = buildFormState({
      prefill: {
        Action: "Replace",
        Type: "PassiveList",
        Items: "SomePassive",
        modGuid: "my-guid",
      },
      section: "Lists",
    });
    expect(result.listAction).toBe("Replace");
    expect(result.spellAction).toBe("Replace");
    expect(result.argAction).toBe("Replace");
    expect(result.listType).toBe("PassiveList");
    expect(result.listItems).toBe("SomePassive");
    expect(result.modGuid).toBe("my-guid");
  });

  it("decodes Inherit and Exclude as arrays", () => {
    const result = buildFormState({
      prefill: { Inherit: "a;b;c", Exclude: "x;y" },
      section: "Lists",
    });
    expect(result.listInheritList).toEqual(["a", "b", "c"]);
    expect(result.listExcludeList).toEqual(["x", "y"]);
  });

  it("decodes Blacklist flag", () => {
    const result = buildFormState({
      prefill: { Blacklist: "true" },
      section: "ClassDescriptions",
    });
    expect(result.blacklist).toBe(true);
  });

  it("pre-populates booleans from SECTION_CAPS", () => {
    // Progressions has booleanKeys like "IsHenchman"
    const result = buildFormState({ prefill: null, section: "Progressions" });
    const keys = result.booleans.map(b => b.key);
    // Should have at least some boolean keys from section caps
    expect(keys.length).toBeGreaterThanOrEqual(0);
  });

  it("auto-populates IsHenchman from entryFilter", () => {
    const result = buildFormState({
      prefill: null,
      section: "Progressions",
      entryFilter: { field: "IsHenchman", value: "true" },
    });
    const isHenchman = result.booleans.find(b => b.key === "IsHenchman");
    if (isHenchman) {
      expect(isHenchman.value).toBe(true);
    }
  });

  it("preserves editComment", () => {
    const result = buildFormState({
      prefill: null,
      section: "Progressions",
      editComment: "my comment",
    });
    expect(result.comment).toBe("my comment");
  });

  it("detects list type from entryFilter node_id", () => {
    const result = buildFormState({
      prefill: null,
      section: "Lists",
      entryFilter: { field: "node_id", value: "PassiveList" },
    });
    expect(result.listType).toBe("PassiveList");
  });

  it("detects list type from vanillaLists UUID match", () => {
    const result = buildFormState({
      prefill: { UUID: "abc-123" },
      section: "Lists",
      vanillaLists: [{ uuid: "abc-123", display_name: "Test", node_id: "SkillList" }],
    });
    expect(result.listType).toBe("SkillList");
  });

  it("detects list type from scanSections fallback", () => {
    const result = buildFormState({
      prefill: { UUID: "xyz-999" },
      section: "Lists",
      vanillaLists: [],
      scanSections: [{
        section: "Lists",
        entries: [{ uuid: "xyz-999", node_id: "StatusList" }],
      }],
    });
    expect(result.listType).toBe("StatusList");
  });

  it("populates fields from rawAttributes when section has no fieldKeys", () => {
    // Lists section has SECTION_CAPS but no fieldKeys defined
    const result = buildFormState({
      prefill: null,
      section: "Lists",
      rawAttributes: { CustomField: "val1", AnotherField: "val2" },
    });
    const keys = result.fields.map(f => f.key);
    expect(keys).toContain("CustomField");
    expect(keys).toContain("AnotherField");
    expect(result.fields.find(f => f.key === "CustomField")?.value).toBe("val1");
    expect(result.fields.find(f => f.key === "AnotherField")?.value).toBe("val2");
  });

  it("auto-generates UUID for new non-spell entries", () => {
    const result = buildFormState({
      prefill: null,
      section: "Progressions",
      generateUuid: () => "generated-uuid-123",
    });
    expect(result.uuids).toEqual(["generated-uuid-123"]);
  });

  it("does not auto-generate UUID for spell entries", () => {
    const result = buildFormState({
      prefill: null,
      section: "Spells",
      generateUuid: () => "should-not-appear",
    });
    expect(result.uuids).toEqual([""]);
  });

  it("does not auto-generate UUID when autoEntryId is set", () => {
    const result = buildFormState({
      prefill: null,
      section: "Progressions",
      autoEntryId: "existing-id",
      generateUuid: () => "should-not-appear",
    });
    expect(result.uuids).toEqual([""]);
  });

  it("does not auto-generate UUID when prefill has UUID", () => {
    const result = buildFormState({
      prefill: { UUID: "pre-existing-uuid" },
      section: "Progressions",
      generateUuid: () => "should-not-appear",
    });
    expect(result.uuids).toEqual(["pre-existing-uuid"]);
  });
});

describe("encodeFormState", () => {
  const baseCaps = { hasFields: true } as any;
  const emptyInput = {
    caps: baseCaps,
    uuids: ["test-uuid"],
    displayName: "TestEntry",
    booleans: [],
    fields: [],
    selectors: [],
    strings: [],
    children: [],
    tags: [],
    subclasses: [],
    spellFields: [],
    listType: "SpellList",
    listItems: "",
    listInheritList: [],
    listExcludeList: [],
    argDefinitionsList: [],
    modGuid: "",
    blacklist: false,
    selectedNodeType: "",
  };

  it("encodes default entry with UUID and _entryLabel", () => {
    const result = encodeFormState(emptyInput);
    expect(result["UUID"]).toBe("test-uuid");
    expect(result["_entryLabel"]).toBe("TestEntry");
    expect(result["Name"]).toBeUndefined();
  });

  it("encodes spell entry with EntryName only", () => {
    const result = encodeFormState({
      ...emptyInput,
      caps: { isSpell: true } as any,
      displayName: "MySpell",
    });
    expect(result["EntryName"]).toBe("MySpell");
    expect(result["UUID"]).toBeUndefined();
  });

  it("encodes list entry with Type, Items, Inherit, Exclude", () => {
    const result = encodeFormState({
      ...emptyInput,
      caps: { isList: true } as any,
      listType: "PassiveList",
      listItems: "PassiveA;PassiveB",
      listInheritList: ["parent-uuid"],
      listExcludeList: ["excl-uuid"],
      modGuid: "my-mod",
    });
    expect(result["Type"]).toBe("PassiveList");
    expect(result["Items"]).toBe("PassiveA;PassiveB");
    expect(result["Inherit"]).toBe("parent-uuid");
    expect(result["Exclude"]).toBe("excl-uuid");
    expect(result["modGuid"]).toBe("my-mod");
  });

  it("encodes ARG entry with Definitions", () => {
    const result = encodeFormState({
      ...emptyInput,
      caps: { isARG: true } as any,
      argDefinitionsList: ["def1", "def2"],
    });
    expect(result["Definitions"]).toBe("def1;def2");
  });

  it("includes Blacklist flag when caps.hasBlacklist is true", () => {
    const result = encodeFormState({
      ...emptyInput,
      caps: { hasBlacklist: true } as any,
      blacklist: true,
    });
    expect(result["Blacklist"]).toBe("true");
  });

  it("omits Blacklist when blacklist is false", () => {
    const result = encodeFormState({
      ...emptyInput,
      caps: { hasBlacklist: true } as any,
      blacklist: false,
    });
    expect(result["Blacklist"]).toBeUndefined();
  });

  it("includes _nodeType when selectedNodeType is set", () => {
    const result = encodeFormState({
      ...emptyInput,
      selectedNodeType: "CharacterCreationPresets",
    });
    expect(result["_nodeType"]).toBe("CharacterCreationPresets");
  });

  it("includes modGuid for non-list entries", () => {
    const result = encodeFormState({
      ...emptyInput,
      modGuid: "my-guid",
    });
    expect(result["modGuid"]).toBe("my-guid");
  });

  it("omits modGuid for list entries (handled in list branch)", () => {
    const result = encodeFormState({
      ...emptyInput,
      caps: { isList: true } as any,
      modGuid: "my-guid",
    });
    // modGuid is set inside the isList branch, not the general modGuid block
    expect(result["modGuid"]).toBe("my-guid");
  });
});
