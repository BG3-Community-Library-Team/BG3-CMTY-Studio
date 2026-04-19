import { describe, it, expect, vi } from "vitest";

// Mock settingsStore before importing comboboxOptions
vi.mock("../lib/stores/settingsStore.svelte.js", () => ({
  settingsStore: {
    showModNamePrefix: true,
    showComboboxNames: true,
  },
}));

// Mock localeCompare to avoid import issues in test env
vi.mock("../lib/utils/localeSort.js", () => ({
  localeCompare: (a: string, b: string) => a.localeCompare(b),
}));

import {
  resolveDisplayName,
  sortComboboxOptions,
  buildSectionOptions,
  getFieldComboboxOptions,
  type ComboboxOption,
  type FieldComboboxContext,
} from "../lib/utils/comboboxOptions.js";

import { settingsStore } from "../lib/stores/settingsStore.svelte.js";

describe("resolveDisplayName", () => {
  it("returns 'Unnamed' for empty string", () => {
    expect(resolveDisplayName("")).toBe("Unnamed");
  });

  it("returns raw string for non-loca sections", () => {
    expect(resolveDisplayName("MySpell", "Spells")).toBe("MySpell");
  });

  it("attempts loca lookup for Backgrounds section with handle-format string", () => {
    const lookup = vi.fn().mockReturnValue("Resolved Name");
    const result = resolveDisplayName("h1234g5678", "Backgrounds", lookup);
    expect(lookup).toHaveBeenCalledWith("h1234g5678");
    expect(result).toBe("Resolved Name");
  });

  it("returns raw handle when lookup fails", () => {
    const lookup = vi.fn().mockReturnValue(undefined);
    const result = resolveDisplayName("h1234g5678", "Backgrounds", lookup);
    expect(result).toBe("h1234g5678");
  });

  it("detects loca handles even outside LOCA_SECTIONS", () => {
    const lookup = vi.fn().mockReturnValue("Localized");
    const result = resolveDisplayName("habcdefg12345", "Feats", lookup);
    expect(result).toBe("Localized");
  });

  it("returns raw string for Origins section with non-handle string", () => {
    const result = resolveDisplayName("SomeOriginName", "Origins");
    expect(result).toBe("SomeOriginName");
  });

  it("returns raw string for BackgroundGoals section with non-handle string", () => {
    const result = resolveDisplayName("GoalName", "BackgroundGoals");
    expect(result).toBe("GoalName");
  });

  it("returns raw string when no section provided and string is not handle-like", () => {
    expect(resolveDisplayName("NormalText")).toBe("NormalText");
  });

  it("returns raw handle when no lookupFn provided for loca handle", () => {
    const result = resolveDisplayName("h1234g5678", "Backgrounds");
    // No lookupFn → lookupFn?.() returns undefined → returns raw
    expect(result).toBe("h1234g5678");
  });
});

describe("sortComboboxOptions", () => {
  it("sorts entries alphabetically by display name", () => {
    const opts: ComboboxOption[] = [
      { value: "a", label: "A", _source: "Vanilla", _displayName: "Bravo" },
      { value: "b", label: "B", _source: "MyMod", _displayName: "Alpha" },
    ];
    const sorted = sortComboboxOptions(opts);
    expect(sorted[0]._displayName).toBe("Alpha");
    expect(sorted[1]._displayName).toBe("Bravo");
  });

  it("pushes 'Unnamed' entries to the end", () => {
    const opts: ComboboxOption[] = [
      { value: "a", label: "A", _displayName: "Unnamed" },
      { value: "b", label: "B", _displayName: "Charlie" },
    ];
    const sorted = sortComboboxOptions(opts);
    expect(sorted[0]._displayName).toBe("Charlie");
    expect(sorted[1]._displayName).toBe("Unnamed");
  });

  it("treats UUID-like display names as unnamed", () => {
    const opts: ComboboxOption[] = [
      { value: "a", label: "A", _displayName: "12345678-aaaa-bbbb-cccc-dddddddddddd" },
      { value: "b", label: "B", _displayName: "Named Entry" },
    ];
    const sorted = sortComboboxOptions(opts);
    expect(sorted[0]._displayName).toBe("Named Entry");
  });

  it("stable-sorts equal categories by label", () => {
    const opts: ComboboxOption[] = [
      { value: "b", label: "Bravo", _source: "Mod", _displayName: "Bravo" },
      { value: "a", label: "Alpha", _source: "Mod", _displayName: "Alpha" },
    ];
    const sorted = sortComboboxOptions(opts);
    expect(sorted[0].label).toBe("Alpha");
    expect(sorted[1].label).toBe("Bravo");
  });

  it("handles empty array", () => {
    expect(sortComboboxOptions([])).toEqual([]);
  });

  it("treats empty _displayName as unnamed", () => {
    const opts: ComboboxOption[] = [
      { value: "a", label: "[Vanilla][] uuid-1", _displayName: "" },
      { value: "b", label: "[MyMod][Hero] uuid-2", _displayName: "Hero" },
    ];
    const sorted = sortComboboxOptions(opts);
    expect(sorted[0]._displayName).toBe("Hero");
  });

  it("falls back to label regex when _displayName is undefined — ][name] pattern", () => {
    const opts: ComboboxOption[] = [
      { value: "a", label: "[Vanilla][Bravo] uuid-a" },
      { value: "b", label: "[Vanilla][Alpha] uuid-b" },
    ];
    const sorted = sortComboboxOptions(opts);
    expect(sorted[0].value).toBe("b"); // Alpha first
  });

  it("falls back to label regex — [name] single prefix pattern", () => {
    const opts: ComboboxOption[] = [
      { value: "a", label: "[Zeta] some-uuid" },
      { value: "b", label: "[Alpha] some-uuid" },
    ];
    const sorted = sortComboboxOptions(opts);
    expect(sorted[0].value).toBe("b"); // Alpha first
  });

  it("falls back to empty string when label has no bracket pattern", () => {
    const opts: ComboboxOption[] = [
      { value: "a", label: "plain-label-a" },
      { value: "b", label: "plain-label-b" },
    ];
    // Both are empty name → both treated as unnamed, sorted by localeCompare
    const sorted = sortComboboxOptions(opts);
    expect(sorted).toHaveLength(2);
  });

  it("both unnamed entries sort by localeCompare", () => {
    const opts: ComboboxOption[] = [
      { value: "a", label: "A", _displayName: "Unnamed" },
      { value: "b", label: "B", _displayName: "" },
    ];
    const sorted = sortComboboxOptions(opts);
    // Both are unnamed, order by localeCompare of names
    expect(sorted).toHaveLength(2);
  });
});

// ----- buildSectionOptions -----

describe("buildSectionOptions", () => {
  it("returns empty for empty inputs", () => {
    const result = buildSectionOptions({
      vanillaEntries: [],
      sectionName: "Races",
      scanResult: null,
      additionalModResults: [],
      additionalModPaths: [],
    });
    expect(result).toEqual([]);
  });

  it("builds options from vanilla entries", () => {
    const result = buildSectionOptions({
      vanillaEntries: [
        { uuid: "r-1", display_name: "Human", node_id: "Race", color: undefined, parent_guid: undefined },
        { uuid: "r-2", display_name: "Elf", node_id: "Race" },
      ],
      sectionName: "Races",
      scanResult: null,
      additionalModResults: [],
      additionalModPaths: [],
    });
    expect(result).toHaveLength(2);
    expect(result[0].label).toContain("Vanilla");
  });

  it("filters vanilla entries by nodeFilter", () => {
    const result = buildSectionOptions({
      vanillaEntries: [
        { uuid: "r-1", display_name: "Human", node_id: "Race" },
        { uuid: "s-1", display_name: "Spell", node_id: "SpellList" },
      ],
      sectionName: "Races",
      nodeFilter: "Race",
      scanResult: null,
      additionalModResults: [],
      additionalModPaths: [],
    });
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("r-1");
  });

  it("adds entries from primary scanned mod", () => {
    const result = buildSectionOptions({
      vanillaEntries: [],
      sectionName: "Races",
      scanResult: {
        mod_meta: { name: "TestMod" },
        sections: [
          { section: "Races", entries: [{ uuid: "mr-1", display_name: "Custom Race", node_id: "Race", changes: [], raw_children: {}, raw_attributes: {}, raw_attribute_types: {}, source_file: "", entry_kind: "EntireEntryNew", region_id: "" }] },
        ],
        existing_config_path: null,
      } as any,
      additionalModResults: [],
      additionalModPaths: [],
    });
    expect(result).toHaveLength(1);
    expect(result[0].label).toContain("TestMod");
  });

  it("uses fallback mod name when mod_meta.name is falsy", () => {
    const result = buildSectionOptions({
      vanillaEntries: [],
      sectionName: "Races",
      scanResult: {
        mod_meta: { name: "" },
        sections: [
          { section: "Races", entries: [{ uuid: "mr-1", display_name: "X", node_id: "", changes: [], raw_children: {}, raw_attributes: {}, raw_attribute_types: {}, source_file: "", entry_kind: "EntireEntryNew", region_id: "" }] },
        ],
        existing_config_path: null,
      } as any,
      additionalModResults: [],
      additionalModPaths: [],
    });
    expect(result).toHaveLength(1);
    expect(result[0].label).toContain("Mod");
  });

  it("skips non-matching section in scanResult", () => {
    const result = buildSectionOptions({
      vanillaEntries: [],
      sectionName: "Races",
      scanResult: {
        mod_meta: { name: "TestMod" },
        sections: [
          { section: "Feats", entries: [{ uuid: "f-1", display_name: "Tough", node_id: "" }] },
        ],
        existing_config_path: null,
      } as any,
      additionalModResults: [],
      additionalModPaths: [],
    });
    expect(result).toEqual([]);
  });

  it("adds entries from additional mods", () => {
    const additionalMod = {
      mod_meta: { name: "ExtraMod" },
      sections: [
        { section: "Races", entries: [{ uuid: "ar-1", display_name: "Extra Race", node_id: "", changes: [], raw_children: {}, raw_attributes: {}, raw_attribute_types: {}, source_file: "", entry_kind: "EntireEntryNew", region_id: "" }] },
      ],
      existing_config_path: null,
    } as any;
    const result = buildSectionOptions({
      vanillaEntries: [],
      sectionName: "Races",
      scanResult: null,
      additionalModResults: [additionalMod],
      additionalModPaths: ["/some/path/ExtraMod"],
    });
    expect(result).toHaveLength(1);
    expect(result[0].label).toContain("ExtraMod");
  });

  it("uses path-derived name for additional mod when mod_meta.name is falsy", () => {
    const additionalMod = {
      mod_meta: { name: "" },
      sections: [
        { section: "Races", entries: [{ uuid: "ar-1", display_name: "X", node_id: "", changes: [], raw_children: {}, raw_attributes: {}, raw_attribute_types: {}, source_file: "", entry_kind: "EntireEntryNew", region_id: "" }] },
      ],
      existing_config_path: null,
    } as any;
    const result = buildSectionOptions({
      vanillaEntries: [],
      sectionName: "Races",
      scanResult: null,
      additionalModResults: [additionalMod],
      additionalModPaths: ["/mods/CoolMod"],
    });
    expect(result).toHaveLength(1);
    expect(result[0].label).toContain("CoolMod");
  });

  it("deduplicates: primary scan overwrites vanilla", () => {
    const result = buildSectionOptions({
      vanillaEntries: [{ uuid: "r-1", display_name: "Vanilla Human", node_id: "Race" }],
      sectionName: "Races",
      scanResult: {
        mod_meta: { name: "MyMod" },
        sections: [
          { section: "Races", entries: [{ uuid: "r-1", display_name: "Modded Human", node_id: "Race", changes: [], raw_children: {}, raw_attributes: {}, raw_attribute_types: {}, source_file: "", entry_kind: "EntireEntryNew", region_id: "" }] },
        ],
        existing_config_path: null,
      } as any,
      additionalModResults: [],
      additionalModPaths: [],
    });
    expect(result).toHaveLength(1);
    expect(result[0].label).toContain("MyMod");
  });

  it("deduplicates: additional mods do NOT overwrite existing", () => {
    const additionalMod = {
      mod_meta: { name: "Extra" },
      sections: [
        { section: "Races", entries: [{ uuid: "r-1", display_name: "Extra Human", node_id: "Race", changes: [], raw_children: {}, raw_attributes: {}, raw_attribute_types: {}, source_file: "", entry_kind: "EntireEntryNew", region_id: "" }] },
      ],
      existing_config_path: null,
    } as any;
    const result = buildSectionOptions({
      vanillaEntries: [{ uuid: "r-1", display_name: "Vanilla Human", node_id: "Race" }],
      sectionName: "Races",
      scanResult: null,
      additionalModResults: [additionalMod],
      additionalModPaths: ["/extra"],
    });
    expect(result).toHaveLength(1);
    expect(result[0].label).toContain("Vanilla");
  });

  it("applies nodeFilter to scanResult and additional mods", () => {
    const result = buildSectionOptions({
      vanillaEntries: [],
      sectionName: "Races",
      nodeFilter: "Race",
      scanResult: {
        mod_meta: { name: "Mod" },
        sections: [
          {
            section: "Races",
            entries: [
              { uuid: "r-1", display_name: "A", node_id: "Race", changes: [], raw_children: {}, raw_attributes: {}, raw_attribute_types: {}, source_file: "", entry_kind: "EntireEntryNew", region_id: "" },
              { uuid: "r-2", display_name: "B", node_id: "SubRace", changes: [], raw_children: {}, raw_attributes: {}, raw_attribute_types: {}, source_file: "", entry_kind: "EntireEntryNew", region_id: "" },
            ],
          },
        ],
        existing_config_path: null,
      } as any,
      additionalModResults: [],
      additionalModPaths: [],
    });
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("r-1");
  });

  it("resolves display names using lookupFn", () => {
    const lookupFn = vi.fn().mockReturnValue("Localized Name");
    const result = buildSectionOptions({
      vanillaEntries: [{ uuid: "r-1", display_name: "habcdefg12345", node_id: "" }],
      sectionName: "Backgrounds",
      scanResult: null,
      additionalModResults: [],
      additionalModPaths: [],
      lookupFn,
    });
    expect(result).toHaveLength(1);
    expect(lookupFn).toHaveBeenCalled();
  });
});

// ----- getFieldComboboxOptions -----

describe("getFieldComboboxOptions", () => {
  function makeCtx(overrides: Partial<FieldComboboxContext> = {}): FieldComboboxContext {
    return {
      caps: { fieldCombobox: {} },
      vanilla: {},
      scanResult: null,
      additionalModResults: [],
      additionalModPaths: [],
      vanillaValueLists: [],
      vanillaStatEntries: [],
      modStatEntries: [],
      vanillaEquipment: [],
      ...overrides,
    } as FieldComboboxContext;
  }

  it("returns empty when no descriptor for fieldKey", () => {
    const ctx = makeCtx({ caps: { fieldCombobox: {} } as any });
    expect(getFieldComboboxOptions("SomeField", ctx)).toEqual([]);
  });

  it("returns empty when fieldCombobox is undefined", () => {
    const ctx = makeCtx({ caps: {} as any });
    expect(getFieldComboboxOptions("SomeField", ctx)).toEqual([]);
  });

  // --- valueList descriptor ---
  it("resolves valueList:Ability with numeric indices", () => {
    const ctx = makeCtx({
      caps: { fieldCombobox: { SpellCastingAbility: "valueList:Ability" } } as any,
      vanillaValueLists: [{ key: "Ability", values: ["Strength", "Dexterity", "Constitution"] }],
    });
    const result = getFieldComboboxOptions("SpellCastingAbility", ctx);
    expect(result).toHaveLength(3);
    expect(result[0].value).toBe("0");
    expect(result[0].label).toBe("Strength");
    expect(result[2].value).toBe("2");
  });

  it("resolves valueList:Skill without numeric indices", () => {
    const ctx = makeCtx({
      caps: { fieldCombobox: { SkillField: "valueList:Skill" } } as any,
      vanillaValueLists: [{ key: "Skill", values: ["Athletics", "Acrobatics"] }],
    });
    const result = getFieldComboboxOptions("SkillField", ctx);
    expect(result).toHaveLength(2);
    expect(result[0].value).toBe("Athletics");
    expect(result[0].label).toBe("Athletics");
  });

  it("returns empty for valueList with missing list key", () => {
    const ctx = makeCtx({
      caps: { fieldCombobox: { Field: "valueList:NonExistent" } } as any,
      vanillaValueLists: [{ key: "Skill", values: ["Athletics"] }],
    });
    expect(getFieldComboboxOptions("Field", ctx)).toEqual([]);
  });

  // --- static descriptor ---
  it("resolves static:val1,val2,val3", () => {
    const ctx = makeCtx({
      caps: { fieldCombobox: { Mode: "static:Add,Remove,Replace" } } as any,
    });
    const result = getFieldComboboxOptions("Mode", ctx);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ value: "Add", label: "Add" });
  });

  it("resolves static with value=label syntax", () => {
    const ctx = makeCtx({
      caps: { fieldCombobox: { DistType: "static:0=AddChildren,1=Prepared" } } as any,
    });
    const result = getFieldComboboxOptions("DistType", ctx);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ value: "0", label: "AddChildren" });
    expect(result[1]).toEqual({ value: "1", label: "Prepared" });
  });

  // --- statType descriptor ---
  it("resolves statType:SpellData", () => {
    const ctx = makeCtx({
      caps: { fieldCombobox: { Using: "statType:SpellData" } } as any,
      vanillaStatEntries: [
        { name: "Fireball", entry_type: "SpellData" },
        { name: "Shield", entry_type: "SpellData" },
        { name: "Tough", entry_type: "PassiveData" },
      ],
    });
    const result = getFieldComboboxOptions("Using", ctx);
    expect(result).toHaveLength(2);
    expect(result.map(o => o.value)).toContain("Fireball");
    expect(result.map(o => o.value)).not.toContain("Tough");
  });

  it("includes mod stat entries for statType with mod label", () => {
    const ctx = makeCtx({
      caps: { fieldCombobox: { Using: "statType:SpellData" } } as any,
      vanillaStatEntries: [],
      modStatEntries: [{ name: "CustomSpell", entry_type: "SpellData" }],
      modName: "TestMod",
    });
    const result = getFieldComboboxOptions("Using", ctx);
    expect(result).toHaveLength(1);
    expect(result[0].label).toContain("[TestMod]");
  });

  it("deduplicates statType entries", () => {
    const ctx = makeCtx({
      caps: { fieldCombobox: { Using: "statType:SpellData" } } as any,
      vanillaStatEntries: [{ name: "Fireball", entry_type: "SpellData" }],
      modStatEntries: [{ name: "Fireball", entry_type: "SpellData" }],
    });
    const result = getFieldComboboxOptions("Using", ctx);
    expect(result).toHaveLength(1);
  });

  // --- equipment descriptor ---
  it("resolves equipment descriptor", () => {
    const ctx = makeCtx({
      caps: { fieldCombobox: { Equip: "equipment:" } } as any,
      vanillaEquipment: ["ARM_Leather", "WPN_Longsword"],
    });
    const result = getFieldComboboxOptions("Equip", ctx);
    expect(result).toHaveLength(2);
    expect(result[0].value).toBe("ARM_Leather");
    // With showModNamePrefix=true, label has [Vanilla]
    expect(result[0].label).toContain("Vanilla");
  });

  // --- folder descriptor ---
  it("resolves folder descriptor", () => {
    const ctx = makeCtx({
      caps: { fieldCombobox: { RaceRef: "folder:Races" } } as any,
      vanilla: {
        Races: [
          { uuid: "r-1", display_name: "Human", node_id: "Race" },
          { uuid: "r-2", display_name: "Elf", node_id: "Race" },
        ],
      },
    });
    const result = getFieldComboboxOptions("RaceRef", ctx);
    expect(result).toHaveLength(2);
  });

  it("returns empty for folder descriptor with missing vanilla section", () => {
    const ctx = makeCtx({
      caps: { fieldCombobox: { Ref: "folder:NonExistent" } } as any,
    });
    expect(getFieldComboboxOptions("Ref", ctx)).toEqual([]);
  });

  // --- progressionTable descriptor ---
  it("resolves progressionTable descriptor", () => {
    const ctx = makeCtx({
      caps: { fieldCombobox: { TableUUID: "progressionTable:" } } as any,
      vanilla: {
        ProgressionTables: [{ uuid: "pt-1", display_name: "FighterTable", node_id: "" }],
      },
    });
    const result = getFieldComboboxOptions("TableUUID", ctx);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("pt-1");
  });

  it("returns empty for progressionTable with no data", () => {
    const ctx = makeCtx({
      caps: { fieldCombobox: { TableUUID: "progressionTable:" } } as any,
    });
    expect(getFieldComboboxOptions("TableUUID", ctx)).toEqual([]);
  });

  // --- voiceTable descriptor ---
  it("resolves voiceTable descriptor", () => {
    const ctx = makeCtx({
      caps: { fieldCombobox: { VoiceRef: "voiceTable:" } } as any,
      vanilla: {
        VoiceTables: [{ uuid: "vt-1", display_name: "Voice1", node_id: "" }],
      },
    });
    const result = getFieldComboboxOptions("VoiceRef", ctx);
    expect(result).toHaveLength(1);
  });

  // --- loca descriptor ---
  it("resolves loca descriptor with user-authored and vanilla entries", () => {
    const locaMap = new Map([
      ["h-vanilla-1", "Vanilla Text"],
      ["h-vanilla-2", "Another Text"],
    ]);
    const ctx = makeCtx({
      caps: { fieldCombobox: { DescRef: "loca:" } } as any,
      locaValues: [
        { contentuid: "h-user-1", text: "User Text" },
      ],
      localizationMap: locaMap,
    });
    const result = getFieldComboboxOptions("DescRef", ctx);
    expect(result).toHaveLength(3);
    // User entries come first
    expect(result[0].value).toBe("h-user-1");
    expect(result[0].label).toContain("User Text");
  });

  it("deduplicates loca entries (user wins over vanilla)", () => {
    const locaMap = new Map([["h-shared", "Vanilla Version"]]);
    const ctx = makeCtx({
      caps: { fieldCombobox: { DescRef: "loca:" } } as any,
      locaValues: [{ contentuid: "h-shared", text: "User Version" }],
      localizationMap: locaMap,
    });
    const result = getFieldComboboxOptions("DescRef", ctx);
    expect(result).toHaveLength(1);
    expect(result[0].label).toContain("User Version");
  });

  it("handles loca with empty locaValues", () => {
    const locaMap = new Map([["h-1", "Text"]]);
    const ctx = makeCtx({
      caps: { fieldCombobox: { DescRef: "loca:" } } as any,
      locaValues: undefined,
      localizationMap: locaMap,
    });
    const result = getFieldComboboxOptions("DescRef", ctx);
    expect(result).toHaveLength(1);
  });

  it("handles loca with empty localizationMap", () => {
    const ctx = makeCtx({
      caps: { fieldCombobox: { DescRef: "loca:" } } as any,
      locaValues: [{ contentuid: "h-1", text: "Text" }],
      localizationMap: undefined,
    });
    const result = getFieldComboboxOptions("DescRef", ctx);
    expect(result).toHaveLength(1);
  });

  it("handles loca entry with empty contentuid (skipped)", () => {
    const ctx = makeCtx({
      caps: { fieldCombobox: { DescRef: "loca:" } } as any,
      locaValues: [{ contentuid: "", text: "Orphan" }],
    });
    const result = getFieldComboboxOptions("DescRef", ctx);
    expect(result).toEqual([]);
  });

  it("handles loca entry with empty text (label is just contentuid)", () => {
    const ctx = makeCtx({
      caps: { fieldCombobox: { DescRef: "loca:" } } as any,
      locaValues: [{ contentuid: "h-abc", text: "" }],
    });
    const result = getFieldComboboxOptions("DescRef", ctx);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("h-abc");
  });

  it("handles vanilla loca entry with empty text", () => {
    const locaMap = new Map([["h-1", ""]]);
    const ctx = makeCtx({
      caps: { fieldCombobox: { DescRef: "loca:" } } as any,
      localizationMap: locaMap,
    });
    const result = getFieldComboboxOptions("DescRef", ctx);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("h-1");
  });

  // --- unknown descriptor prefix ---
  it("returns empty for unknown descriptor prefix", () => {
    const ctx = makeCtx({
      caps: { fieldCombobox: { Field: "unknownPrefix:data" } } as any,
    });
    expect(getFieldComboboxOptions("Field", ctx)).toEqual([]);
  });

  // --- section descriptor ---
  it("resolves section:Races descriptor", () => {
    const ctx = makeCtx({
      caps: { fieldCombobox: { RaceRef: "section:Races" } } as any,
      vanilla: {
        Races: [{ uuid: "r-1", display_name: "Human", node_id: "Race" }],
      },
    });
    const result = getFieldComboboxOptions("RaceRef", ctx);
    expect(result).toHaveLength(1);
  });

  it("resolves section:Races:Race with nodeFilter", () => {
    const ctx = makeCtx({
      caps: { fieldCombobox: { RaceRef: "section:Races:Race" } } as any,
      vanilla: {
        Races: [
          { uuid: "r-1", display_name: "Human", node_id: "Race" },
          { uuid: "s-1", display_name: "SubRace", node_id: "SubRace" },
        ],
      },
    });
    const result = getFieldComboboxOptions("RaceRef", ctx);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("r-1");
  });

  // --- descriptor without colon ---
  it("returns empty for descriptor with no handler match and no colon", () => {
    const ctx = makeCtx({
      caps: { fieldCombobox: { Field: "bogus" } } as any,
    });
    expect(getFieldComboboxOptions("Field", ctx)).toEqual([]);
  });
});

// ----- multi-select descriptor handlers -----

describe("multi-select descriptor handlers", () => {
  // --- multiStatic descriptor ---
  it("multiStatic: descriptor returns options from comma-separated values", () => {
    const ctx: FieldComboboxContext = {
      caps: { fieldCombobox: { SpellFlags: "multiStatic:IsAttack,IsMelee,IsHarmful" } } as any,
      vanilla: {},
      scanResult: null,
      additionalModResults: [],
      additionalModPaths: [],
      vanillaValueLists: [],
      vanillaStatEntries: [],
      modStatEntries: [],
      vanillaEquipment: [],
    };
    const result = getFieldComboboxOptions("SpellFlags", ctx);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ value: "IsAttack", label: "IsAttack" });
    expect(result[1]).toEqual({ value: "IsMelee", label: "IsMelee" });
    expect(result[2]).toEqual({ value: "IsHarmful", label: "IsHarmful" });
  });

  it("multiStatic: supports value=label syntax", () => {
    const ctx: FieldComboboxContext = {
      caps: { fieldCombobox: { TestField: "multiStatic:0=None,1=Active,2=Disabled" } } as any,
      vanilla: {},
      scanResult: null,
      additionalModResults: [],
      additionalModPaths: [],
      vanillaValueLists: [],
      vanillaStatEntries: [],
      modStatEntries: [],
      vanillaEquipment: [],
    };
    const result = getFieldComboboxOptions("TestField", ctx);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ value: "0", label: "None" });
    expect(result[1]).toEqual({ value: "1", label: "Active" });
  });

  it("multiStatic: returns empty array for empty suffix", () => {
    const ctx: FieldComboboxContext = {
      caps: { fieldCombobox: { TestField: "multiStatic:" } } as any,
      vanilla: {},
      scanResult: null,
      additionalModResults: [],
      additionalModPaths: [],
      vanillaValueLists: [],
      vanillaStatEntries: [],
      modStatEntries: [],
      vanillaEquipment: [],
    };
    const result = getFieldComboboxOptions("TestField", ctx);
    // split(",") on empty string gives [""] which maps to one item with empty value
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("");
  });

  // --- multiStatType descriptor ---
  it("multiStatType: returns options from vanilla stat entries", () => {
    const ctx: FieldComboboxContext = {
      caps: { fieldCombobox: { ContainerSpells: "multiStatType:SpellData" } } as any,
      vanilla: {},
      scanResult: null,
      additionalModResults: [],
      additionalModPaths: [],
      vanillaValueLists: [],
      vanillaStatEntries: [
        { name: "Target_Bless", entry_type: "SpellData" },
        { name: "Projectile_ChromaticOrb", entry_type: "SpellData" },
        { name: "SomePassive", entry_type: "PassiveData" },
      ],
      modStatEntries: [],
      vanillaEquipment: [],
    };
    const result = getFieldComboboxOptions("ContainerSpells", ctx);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ value: "Target_Bless", label: "Target_Bless" });
    expect(result[1]).toEqual({ value: "Projectile_ChromaticOrb", label: "Projectile_ChromaticOrb" });
  });

  it("multiStatType: includes mod entries with mod prefix", () => {
    const ctx: FieldComboboxContext = {
      caps: { fieldCombobox: { ContainerSpells: "multiStatType:SpellData" } } as any,
      vanilla: {},
      scanResult: null,
      additionalModResults: [],
      additionalModPaths: [],
      vanillaValueLists: [],
      vanillaStatEntries: [
        { name: "Target_Bless", entry_type: "SpellData" },
      ],
      modStatEntries: [
        { name: "MyCustomSpell", entry_type: "SpellData" },
      ],
      vanillaEquipment: [],
      modName: "TestMod",
    };
    const result = getFieldComboboxOptions("ContainerSpells", ctx);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ value: "Target_Bless", label: "Target_Bless" });
    expect(result[1]).toEqual({ value: "MyCustomSpell", label: "[TestMod] MyCustomSpell" });
  });

  it("multiStatType: deduplicates entries across vanilla and mod", () => {
    const ctx: FieldComboboxContext = {
      caps: { fieldCombobox: { ContainerSpells: "multiStatType:SpellData" } } as any,
      vanilla: {},
      scanResult: null,
      additionalModResults: [],
      additionalModPaths: [],
      vanillaValueLists: [],
      vanillaStatEntries: [
        { name: "Target_Bless", entry_type: "SpellData" },
      ],
      modStatEntries: [
        { name: "Target_Bless", entry_type: "SpellData" },
      ],
      vanillaEquipment: [],
    };
    const result = getFieldComboboxOptions("ContainerSpells", ctx);
    expect(result).toHaveLength(1);
  });

  it("multiStatType: returns empty for no matching type", () => {
    const ctx: FieldComboboxContext = {
      caps: { fieldCombobox: { TestField: "multiStatType:NonexistentType" } } as any,
      vanilla: {},
      scanResult: null,
      additionalModResults: [],
      additionalModPaths: [],
      vanillaValueLists: [],
      vanillaStatEntries: [
        { name: "Target_Bless", entry_type: "SpellData" },
      ],
      modStatEntries: [],
      vanillaEquipment: [],
    };
    const result = getFieldComboboxOptions("TestField", ctx);
    expect(result).toHaveLength(0);
  });
});
