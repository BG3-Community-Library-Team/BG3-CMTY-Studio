import { describe, it, expect, vi } from "vitest";

// Mock CHILD_TYPE_SOURCE before importing formOptions
vi.mock("../lib/data/childTypes.js", () => ({
  CHILD_TYPE_SOURCE: {
    EyeColors: { store: "ccpresets", nodeFilter: "CharacterCreationEyeColor" },
    SkinColors: { store: "ccpresets", nodeFilter: "CharacterCreationSkinColor" },
    HairColors: { store: "ccpresets", nodeFilter: "CharacterCreationHairColor" },
    TattooColors: { store: "color" },
    Gods: { store: "god" },
    Tags: { store: "tag" },
    Visuals: { store: "visual", nodeFilter: "CharacterCreationSharedVisual" },
    Subclasses: { store: "classdescription" },
  } as Record<string, { store: string; nodeFilter?: string }>,
}));

// Mock resolveDisplayName
vi.mock("../lib/utils/comboboxOptions.js", () => ({
  resolveDisplayName: (raw: string) => raw || "Unnamed",
}));

const {
  getListItemsPlaceholder,
  getListItemsLabel,
  combinedSpellIdOptions,
  computeSpellIdOptions,
  computeSpellFieldKeys,
  computeListItemsOptions,
  computeChildValueOptions,
  computeTagValueOptions,
  computeReallyTagValueOptions,
  computeValidationErrors,
} = await import("../lib/utils/formOptions.js");

// ----- helpers -----
function makeScanResult(sections: { section: string; entries: any[] }[]) {
  return { sections };
}

describe("getListItemsPlaceholder", () => {
  it("returns spell placeholder for SpellList", () => {
    expect(getListItemsPlaceholder("SpellList")).toBe("Spell ID 1;Spell ID 2");
  });
  it("returns passive placeholder for PassiveList", () => {
    expect(getListItemsPlaceholder("PassiveList")).toBe("Passive ID 1;Passive ID 2");
  });
  it("returns skill placeholder for SkillList", () => {
    expect(getListItemsPlaceholder("SkillList")).toBe("Skill ID 1;Skill ID 2");
  });
  it("returns ability placeholder for AbilityList", () => {
    expect(getListItemsPlaceholder("AbilityList")).toBe("Ability ID 1;Ability ID 2");
  });
  it("returns equipment placeholder for EquipmentList", () => {
    expect(getListItemsPlaceholder("EquipmentList")).toBe("Equipment ID 1;Equipment ID 2");
  });
  it("returns default placeholder for unknown type", () => {
    expect(getListItemsPlaceholder("FooList")).toBe("StatID1;StatID2");
  });
});

describe("getListItemsLabel", () => {
  it("returns Spells for SpellList", () => {
    expect(getListItemsLabel("SpellList")).toBe("Spells");
  });
  it("returns Passives for PassiveList", () => {
    expect(getListItemsLabel("PassiveList")).toBe("Passives");
  });
  it("returns Skills for SkillList", () => {
    expect(getListItemsLabel("SkillList")).toBe("Skills");
  });
  it("returns Abilities for AbilityList", () => {
    expect(getListItemsLabel("AbilityList")).toBe("Abilities");
  });
  it("returns Equipment for EquipmentList", () => {
    expect(getListItemsLabel("EquipmentList")).toBe("Equipment");
  });
  it("returns Items for unknown type", () => {
    expect(getListItemsLabel("FooList")).toBe("Items");
  });
});

describe("combinedSpellIdOptions", () => {
  it("merges vanilla and scanned options", () => {
    const vanilla = [{ value: "a", label: "A" }];
    const scanned = [{ value: "b", label: "B" }];
    const result = combinedSpellIdOptions(vanilla, scanned);
    expect(result).toHaveLength(2);
    expect(result.map(o => o.value)).toContain("a");
    expect(result.map(o => o.value)).toContain("b");
  });

  it("keeps vanilla entry when duplicate", () => {
    const vanilla = [{ value: "x", label: "Vanilla X" }];
    const scanned = [{ value: "x", label: "Scanned X" }];
    const result = combinedSpellIdOptions(vanilla, scanned);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("Vanilla X");
  });

  it("returns empty array when both inputs are empty", () => {
    expect(combinedSpellIdOptions([], [])).toEqual([]);
  });
});

// ----- computeSpellIdOptions -----

describe("computeSpellIdOptions", () => {
  it("returns empty when scanResult is null and no additional mods", () => {
    expect(computeSpellIdOptions(null, [])).toEqual([]);
  });

  it("collects spells from scanResult Spells section", () => {
    const scan = makeScanResult([
      { section: "Spells", entries: [
        { uuid: "spell-1", display_name: "Fireball", changes: [] },
        { uuid: "spell-2", display_name: "", changes: [] },
      ]},
    ]);
    const result = computeSpellIdOptions(scan, []);
    expect(result).toHaveLength(2);
    expect(result[0].label).toContain("Fireball");
    // Entry without display_name should just be the uuid
    expect(result[1].label).toBe("spell-2");
  });

  it("skips non-Spells sections in scanResult", () => {
    const scan = makeScanResult([
      { section: "Races", entries: [{ uuid: "race-1", display_name: "Human", changes: [] }] },
    ]);
    const result = computeSpellIdOptions(scan, []);
    expect(result).toEqual([]);
  });

  it("collects spells from additionalModResults", () => {
    const mod1 = makeScanResult([
      { section: "Spells", entries: [{ uuid: "s1", display_name: "Ice Storm", changes: [] }] },
    ]);
    const result = computeSpellIdOptions(null, [mod1]);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("s1");
  });

  it("deduplicates across scanResult and additional mods", () => {
    const scan = makeScanResult([
      { section: "Spells", entries: [{ uuid: "s1", display_name: "Fireball", changes: [] }] },
    ]);
    const mod1 = makeScanResult([
      { section: "Spells", entries: [{ uuid: "s1", display_name: "Fireball Mod", changes: [] }] },
    ]);
    const result = computeSpellIdOptions(scan, [mod1]);
    expect(result).toHaveLength(1);
    // Primary scan wins
    expect(result[0].label).toContain("Fireball");
  });

  it("handles scanResult with no Spells section", () => {
    const scan = makeScanResult([{ section: "Feats", entries: [] }]);
    expect(computeSpellIdOptions(scan, [])).toEqual([]);
  });
});

// ----- computeSpellFieldKeys -----

describe("computeSpellFieldKeys", () => {
  it("returns vanilla field names when no scan data", () => {
    const result = computeSpellFieldKeys(["SpellType", "Level"], null, []);
    expect(result).toContain("SpellType");
    expect(result).toContain("Level");
  });

  it("merges field keys from scanResult Spells section", () => {
    const scan = makeScanResult([
      {
        section: "Spells",
        entries: [
          { uuid: "s1", changes: [{ field: "Damage" }, { field: "SpellType" }] },
        ],
      },
    ]);
    const result = computeSpellFieldKeys(["SpellType"], scan, []);
    expect(result).toContain("Damage");
    expect(result).toContain("SpellType");
  });

  it("skips changes without field property", () => {
    const scan = makeScanResult([
      {
        section: "Spells",
        entries: [{ uuid: "s1", changes: [{ field: "" }, { field: "Range" }] }],
      },
    ]);
    const result = computeSpellFieldKeys([], scan, []);
    expect(result).toContain("Range");
    // Empty field is falsy, should not be added
    expect(result).not.toContain("");
  });

  it("merges from additional mods", () => {
    const mod = makeScanResult([
      { section: "Spells", entries: [{ uuid: "s1", changes: [{ field: "CooldownRound" }] }] },
    ]);
    const result = computeSpellFieldKeys([], null, [mod]);
    expect(result).toContain("CooldownRound");
  });

  it("deduplicates field keys and sorts", () => {
    const scan = makeScanResult([
      { section: "Spells", entries: [{ uuid: "s1", changes: [{ field: "Damage" }] }] },
    ]);
    const mod = makeScanResult([
      { section: "Spells", entries: [{ uuid: "s2", changes: [{ field: "Damage" }] }] },
    ]);
    const result = computeSpellFieldKeys(["Damage"], scan, [mod]);
    const damageCount = result.filter(k => k === "Damage").length;
    expect(damageCount).toBe(1);
    // Should be sorted
    for (let i = 1; i < result.length; i++) {
      expect(result[i] >= result[i - 1]).toBe(true);
    }
  });

  it("returns empty when no sources have data", () => {
    expect(computeSpellFieldKeys([], null, [])).toEqual([]);
  });

  it("ignores non-Spells sections in scanResult and mods", () => {
    const scan = makeScanResult([
      { section: "Races", entries: [{ uuid: "r1", changes: [{ field: "Name" }] }] },
    ]);
    const result = computeSpellFieldKeys([], scan, []);
    expect(result).not.toContain("Name");
  });
});

// ----- computeListItemsOptions -----

describe("computeListItemsOptions", () => {
  const vanillaStats = [
    { name: "Fireball", entry_type: "SpellData" },
    { name: "Shield", entry_type: "SpellData" },
    { name: "Tough", entry_type: "PassiveData" },
    { name: "PlateArmor", entry_type: "Armor" },
    { name: "Longsword", entry_type: "Weapon" },
    { name: "HealthPotion", entry_type: "Object" },
  ];
  const vanillaValueLists = [
    { key: "Skill", values: ["Athletics", "Acrobatics"] },
    { key: "Ability", values: ["Strength", "Dexterity", "Constitution"] },
  ];

  it("returns SpellData entries for SpellList", () => {
    const result = computeListItemsOptions("SpellList", vanillaStats, [], []);
    expect(result.map(o => o.value)).toContain("Fireball");
    expect(result.map(o => o.value)).toContain("Shield");
    expect(result.map(o => o.value)).not.toContain("Tough");
  });

  it("returns PassiveData entries for PassiveList", () => {
    const result = computeListItemsOptions("PassiveList", vanillaStats, [], []);
    expect(result.map(o => o.value)).toContain("Tough");
    expect(result.map(o => o.value)).not.toContain("Fireball");
  });

  it("returns Armor/Weapon/Object entries for EquipmentList", () => {
    const result = computeListItemsOptions("EquipmentList", vanillaStats, [], []);
    expect(result.map(o => o.value)).toContain("PlateArmor");
    expect(result.map(o => o.value)).toContain("Longsword");
    expect(result.map(o => o.value)).toContain("HealthPotion");
    // Labels should include entry type prefix
    const armor = result.find(o => o.value === "PlateArmor");
    expect(armor?.label).toContain("[Armor]");
  });

  it("includes mod stat entries for EquipmentList with mod prefix", () => {
    const modStats = [{ name: "CustomSword", entry_type: "Weapon" }];
    const result = computeListItemsOptions("EquipmentList", vanillaStats, [], modStats, "TestMod");
    const custom = result.find(o => o.value === "CustomSword");
    expect(custom?.label).toContain("[TestMod]");
  });

  it("returns Skill value list for SkillList", () => {
    const result = computeListItemsOptions("SkillList", [], vanillaValueLists);
    expect(result.map(o => o.value)).toEqual(["Athletics", "Acrobatics"]);
  });

  it("returns Ability value list for AbilityList", () => {
    const result = computeListItemsOptions("AbilityList", [], vanillaValueLists);
    expect(result.map(o => o.value)).toEqual(["Strength", "Dexterity", "Constitution"]);
  });

  it("returns empty for SkillList when value list not found", () => {
    const result = computeListItemsOptions("SkillList", [], []);
    expect(result).toEqual([]);
  });

  it("returns empty for AbilityList when value list not found", () => {
    const result = computeListItemsOptions("AbilityList", [], []);
    expect(result).toEqual([]);
  });

  it("returns empty for unknown list type", () => {
    const result = computeListItemsOptions("UnknownList", vanillaStats, vanillaValueLists);
    expect(result).toEqual([]);
  });

  it("deduplicates vanilla and mod entries for SpellList", () => {
    const modStats = [{ name: "Fireball", entry_type: "SpellData" }];
    const result = computeListItemsOptions("SpellList", vanillaStats, [], modStats);
    const fireballCount = result.filter(o => o.value === "Fireball").length;
    expect(fireballCount).toBe(1);
  });

  it("includes mod entries with mod label for SpellList", () => {
    const modStats = [{ name: "CustomSpell", entry_type: "SpellData" }];
    const result = computeListItemsOptions("SpellList", vanillaStats, [], modStats, "MyMod");
    const custom = result.find(o => o.value === "CustomSpell");
    expect(custom?.label).toContain("[MyMod]");
  });

  it("deduplicates Equipment entries across vanilla and mod", () => {
    const modStats = [{ name: "PlateArmor", entry_type: "Armor" }];
    const result = computeListItemsOptions("EquipmentList", vanillaStats, [], modStats);
    const plateCount = result.filter(o => o.value === "PlateArmor").length;
    expect(plateCount).toBe(1);
  });

  it("handles empty vanilla and mod stat arrays", () => {
    expect(computeListItemsOptions("SpellList", [], [], [])).toEqual([]);
  });
});

// ----- computeChildValueOptions -----

describe("computeChildValueOptions", () => {
  const lookupFn = (h: string) => (h === "handle-1" ? "Resolved" : undefined);

  it("returns empty for unknown child type", () => {
    const result = computeChildValueOptions("UnknownType", {}, null, [], lookupFn);
    expect(result).toEqual([]);
  });

  it("returns ccpresets entries for EyeColors with nodeFilter", () => {
    const vanilla = {
      CharacterCreationPresets: [
        { uuid: "ec-1", display_name: "Blue", node_id: "CharacterCreationEyeColor", color: "#0000FF" },
        { uuid: "sc-1", display_name: "Light", node_id: "CharacterCreationSkinColor" },
      ],
    };
    const result = computeChildValueOptions("EyeColors", vanilla as any, null, [], lookupFn);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("ec-1");
    expect(result[0].color).toBe("#0000FF");
  });

  it("returns all ccpresets entries when no nodeFilter", () => {
    // SkinColors has nodeFilter, so test with a store that has no nodeFilter
    const vanilla = {
      ColorDefinitions: [
        { uuid: "cd-1", display_name: "Red", node_id: "" },
        { uuid: "cd-2", display_name: "Green", node_id: "" },
      ],
    };
    const result = computeChildValueOptions("TattooColors", vanilla as any, null, [], lookupFn);
    expect(result).toHaveLength(2);
  });

  it("returns god entries for Gods child type", () => {
    const vanilla = {
      Gods: [{ uuid: "g-1", display_name: "Selune", node_id: "" }],
    };
    const result = computeChildValueOptions("Gods", vanilla as any, null, [], lookupFn);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("g-1");
  });

  it("returns tag entries for Tags child type", () => {
    const vanilla = {
      Tags: [{ uuid: "t-1", display_name: "REALLY_MyTag", node_id: "" }],
    };
    const result = computeChildValueOptions("Tags", vanilla as any, null, [], lookupFn);
    expect(result).toHaveLength(1);
  });

  it("returns classdescription entries for Subclasses", () => {
    const vanilla = {
      ClassDescriptions: [{ uuid: "cls-1", display_name: "Fighter", node_id: "" }],
    };
    const result = computeChildValueOptions("Subclasses", vanilla as any, null, [], lookupFn);
    expect(result).toHaveLength(1);
  });

  it("returns visual entries with nodeFilter for Visuals", () => {
    const vanilla = {
      Visuals: [
        { uuid: "v-1", display_name: "Horns", node_id: "CharacterCreationSharedVisual" },
        { uuid: "v-2", display_name: "Makeup", node_id: "CharacterCreationMakeUpVisual" },
      ],
    };
    const result = computeChildValueOptions("Visuals", vanilla as any, null, [], lookupFn);
    // visual store returns all entries (nodeFilter not applied at runtime for "visual" case)
    expect(result).toHaveLength(2);
    expect(result[0].value).toBe("v-1");
  });

  it("adds entries from scanResult Races section raw_children", () => {
    const scan = makeScanResult([
      {
        section: "Races",
        entries: [
          { uuid: "race-1", changes: [], raw_children: { EyeColors: ["new-eye-1", "new-eye-2"] } },
        ],
      },
    ]);
    const result = computeChildValueOptions("EyeColors", {}, scan, [], lookupFn);
    expect(result).toHaveLength(2);
    expect(result.map(o => o.value)).toContain("new-eye-1");
  });

  it("does not duplicate entries already in vanilla from scan", () => {
    const vanilla = {
      CharacterCreationPresets: [
        { uuid: "ec-1", display_name: "Blue", node_id: "CharacterCreationEyeColor" },
      ],
    };
    const scan = makeScanResult([
      {
        section: "Races",
        entries: [{ uuid: "race-1", changes: [], raw_children: { EyeColors: ["ec-1"] } }],
      },
    ]);
    const result = computeChildValueOptions("EyeColors", vanilla as any, scan, [], lookupFn);
    expect(result).toHaveLength(1);
  });

  it("adds entries from additionalModResults", () => {
    const mod = makeScanResult([
      {
        section: "Races",
        entries: [{ uuid: "race-1", changes: [], raw_children: { EyeColors: ["mod-eye-1"] } }],
      },
    ]);
    const result = computeChildValueOptions("EyeColors", {}, null, [mod], lookupFn);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("mod-eye-1");
  });

  it("handles missing raw_children in scan entries", () => {
    const scan = makeScanResult([
      { section: "Races", entries: [{ uuid: "race-1", changes: [] }] },
    ]);
    const result = computeChildValueOptions("EyeColors", {}, scan, [], lookupFn);
    expect(result).toEqual([]);
  });

  it("handles missing vanilla category returning empty source", () => {
    // EyeColors → store: "ccpresets" → CharacterCreationPresets, but vanilla doesn't have it
    const vanilla = {};
    const result = computeChildValueOptions("EyeColors", vanilla as any, null, [], lookupFn);
    expect(result).toEqual([]);
  });

  it("handles scan with non-Races section for child values", () => {
    const scan = makeScanResult([
      { section: "Feats", entries: [{ uuid: "f-1", changes: [], raw_children: { EyeColors: ["x"] } }] },
    ]);
    const result = computeChildValueOptions("EyeColors", {}, scan, [], lookupFn);
    // Only Races section is checked
    expect(result).toEqual([]);
  });
});

// ----- computeTagValueOptions -----

describe("computeTagValueOptions", () => {
  const lookupFn = (h: string) => undefined;

  it("collects tags from vanillaTags", () => {
    const tags = [
      { uuid: "t-1", display_name: "REALLY_Humanoid", node_id: "" },
      { uuid: "t-2", display_name: "Undead", node_id: "" },
    ];
    const result = computeTagValueOptions(tags as any, null, [], lookupFn);
    expect(result).toHaveLength(2);
  });

  it("returns empty for empty vanilla tags and no scan", () => {
    expect(computeTagValueOptions([], null, [], lookupFn)).toEqual([]);
  });

  it("adds tags from scanResult raw_children Tags group", () => {
    const scan = makeScanResult([
      {
        section: "Races",
        entries: [{ uuid: "r1", changes: [], raw_children: { Tags: ["scan-tag-1"] } }],
      },
    ]);
    const result = computeTagValueOptions([], scan, [], lookupFn);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("scan-tag-1");
  });

  it("adds tags from ReallyTags group", () => {
    const scan = makeScanResult([
      {
        section: "Races",
        entries: [{ uuid: "r1", changes: [], raw_children: { ReallyTags: ["rt-1"] } }],
      },
    ]);
    const result = computeTagValueOptions([], scan, [], lookupFn);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("rt-1");
  });

  it("adds tags from AppearanceTags group", () => {
    const scan = makeScanResult([
      {
        section: "Races",
        entries: [{ uuid: "r1", changes: [], raw_children: { AppearanceTags: ["at-1"] } }],
      },
    ]);
    const result = computeTagValueOptions([], scan, [], lookupFn);
    expect(result).toHaveLength(1);
  });

  it("deduplicates tags across vanilla and scan", () => {
    const vanilla = [{ uuid: "t-1", display_name: "Tag1", node_id: "" }];
    const scan = makeScanResult([
      {
        section: "Races",
        entries: [{ uuid: "r1", changes: [], raw_children: { Tags: ["t-1"] } }],
      },
    ]);
    const result = computeTagValueOptions(vanilla as any, scan, [], lookupFn);
    expect(result).toHaveLength(1);
  });

  it("adds tags from additionalModResults", () => {
    const mod = makeScanResult([
      {
        section: "Feats",
        entries: [{ uuid: "f1", changes: [], raw_children: { Tags: ["mod-tag-1"] } }],
      },
    ]);
    const result = computeTagValueOptions([], null, [mod], lookupFn);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("mod-tag-1");
  });

  it("handles entries without raw_children", () => {
    const scan = makeScanResult([
      { section: "Races", entries: [{ uuid: "r1", changes: [] }] },
    ]);
    const result = computeTagValueOptions([], scan, [], lookupFn);
    expect(result).toEqual([]);
  });

  it("collects from multiple tag groups in same entry", () => {
    const scan = makeScanResult([
      {
        section: "Races",
        entries: [{
          uuid: "r1", changes: [],
          raw_children: { Tags: ["a"], ReallyTags: ["b"], AppearanceTags: ["c"] },
        }],
      },
    ]);
    const result = computeTagValueOptions([], scan, [], lookupFn);
    expect(result).toHaveLength(3);
  });
});

// ----- computeReallyTagValueOptions -----

describe("computeReallyTagValueOptions", () => {
  it("filters only REALLY_ prefixed tags", () => {
    const tags = [
      { uuid: "t-1", display_name: "REALLY_Humanoid", node_id: "" },
      { uuid: "t-2", display_name: "Undead", node_id: "" },
      { uuid: "t-3", display_name: "REALLY_Beast", node_id: "" },
    ];
    const result = computeReallyTagValueOptions(tags as any);
    expect(result).toHaveLength(2);
    expect(result.map(o => o.value)).toContain("t-1");
    expect(result.map(o => o.value)).toContain("t-3");
  });

  it("returns empty for tags without REALLY_ prefix", () => {
    const tags = [
      { uuid: "t-1", display_name: "Normal", node_id: "" },
    ];
    expect(computeReallyTagValueOptions(tags as any)).toEqual([]);
  });

  it("returns empty for empty array", () => {
    expect(computeReallyTagValueOptions([])).toEqual([]);
  });

  it("handles tags with undefined display_name", () => {
    const tags = [{ uuid: "t-1", node_id: "" }];
    // display_name is undefined, toUpperCase will not match
    expect(computeReallyTagValueOptions(tags as any)).toEqual([]);
  });

  it("is case-insensitive for REALLY_ check via toUpperCase", () => {
    // The code uses toUpperCase().startsWith("REALLY_")
    const tags = [{ uuid: "t-1", display_name: "really_Test", node_id: "" }];
    const result = computeReallyTagValueOptions(tags as any);
    expect(result).toHaveLength(1);
  });
});

// ----- computeValidationErrors -----

describe("computeValidationErrors", () => {
  const baseCaps = {
    isSpell: false,
    isList: false,
    isARG: false,
    hasFields: false,
  };

  it("returns empty for valid UUID in non-spell section", () => {
    const result = computeValidationErrors({
      caps: baseCaps as any,
      uuids: ["aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"],
      section: "Races",
      fields: [],
      vanillaSections: {},
    });
    expect(result).toEqual([]);
  });

  it("warns for invalid UUID format", () => {
    const result = computeValidationErrors({
      caps: baseCaps as any,
      uuids: ["not-a-uuid"],
      section: "Races",
      fields: [],
      vanillaSections: {},
    });
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe("warning");
    expect(result[0].key).toBe("uuid:0");
  });

  it("skips UUID validation for spell sections", () => {
    const result = computeValidationErrors({
      caps: { ...baseCaps, isSpell: true } as any,
      uuids: ["not-a-uuid"],
      section: "Spells",
      fields: [],
      vanillaSections: {},
    });
    expect(result).toEqual([]);
  });

  it("validates multiple UUIDs", () => {
    const result = computeValidationErrors({
      caps: baseCaps as any,
      uuids: ["bad-1", "bad-2"],
      section: "Races",
      fields: [],
      vanillaSections: {},
    });
    expect(result).toHaveLength(2);
    expect(result[0].key).toBe("uuid:0");
    expect(result[1].key).toBe("uuid:1");
  });

  it("skips empty UUID strings", () => {
    const result = computeValidationErrors({
      caps: baseCaps as any,
      uuids: [""],
      section: "Races",
      fields: [],
      vanillaSections: {},
    });
    expect(result).toEqual([]);
  });

  it("skips whitespace-only UUID strings", () => {
    const result = computeValidationErrors({
      caps: baseCaps as any,
      uuids: ["   "],
      section: "Races",
      fields: [],
      vanillaSections: {},
    });
    expect(result).toEqual([]);
  });

  it("detects cross-section UUID conflict", () => {
    const uuid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const result = computeValidationErrors({
      caps: baseCaps as any,
      uuids: [uuid],
      section: "Races",
      fields: [],
      vanillaSections: {
        Progressions: [{ uuid, display_name: "test", node_id: "" }],
      },
    });
    const crossError = result.find(e => e.key === "uuid:cross");
    expect(crossError).toBeDefined();
    expect(crossError!.severity).toBe("error");
  });

  it("detects same-section UUID exists in vanilla (override warning)", () => {
    const uuid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const result = computeValidationErrors({
      caps: baseCaps as any,
      uuids: [uuid],
      section: "Races",
      fields: [],
      vanillaSections: {
        Races: [{ uuid, display_name: "test", node_id: "" }],
      },
    });
    const existsWarn = result.find(e => e.key === "uuid:exists");
    expect(existsWarn).toBeDefined();
    expect(existsWarn!.severity).toBe("warning");
  });

  it("skips cross-section check for List sections", () => {
    const uuid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const result = computeValidationErrors({
      caps: { ...baseCaps, isList: true } as any,
      uuids: [uuid],
      section: "Lists",
      fields: [],
      vanillaSections: {
        Progressions: [{ uuid, display_name: "test", node_id: "" }],
      },
    });
    expect(result.find(e => e.key === "uuid:cross")).toBeUndefined();
  });

  it("skips cross-section check for ARG sections", () => {
    const uuid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const result = computeValidationErrors({
      caps: { ...baseCaps, isARG: true } as any,
      uuids: [uuid],
      section: "ActionResourceGroups",
      fields: [],
      vanillaSections: {
        Progressions: [{ uuid, display_name: "test", node_id: "" }],
      },
    });
    expect(result.find(e => e.key === "uuid:cross")).toBeUndefined();
  });

  it("detects int field type error", () => {
    const result = computeValidationErrors({
      caps: { ...baseCaps, hasFields: true, fieldTypes: { Level: "int" } } as any,
      uuids: ["aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"],
      section: "Progressions",
      fields: [{ key: "Level", value: "abc" }],
      vanillaSections: {},
    });
    const err = result.find(e => e.key === "field:Level");
    expect(err).toBeDefined();
    expect(err!.severity).toBe("error");
  });

  it("accepts valid int field values", () => {
    const result = computeValidationErrors({
      caps: { ...baseCaps, hasFields: true, fieldTypes: { Level: "int" } } as any,
      uuids: ["aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"],
      section: "Progressions",
      fields: [{ key: "Level", value: "5" }],
      vanillaSections: {},
    });
    expect(result.find(e => e.key === "field:Level")).toBeUndefined();
  });

  it("accepts negative int field values", () => {
    const result = computeValidationErrors({
      caps: { ...baseCaps, hasFields: true, fieldTypes: { Level: "int" } } as any,
      uuids: ["aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"],
      section: "Progressions",
      fields: [{ key: "Level", value: "-3" }],
      vanillaSections: {},
    });
    expect(result.find(e => e.key === "field:Level")).toBeUndefined();
  });

  it("detects bool field type error", () => {
    const result = computeValidationErrors({
      caps: { ...baseCaps, hasFields: true, fieldTypes: { AllowImprovement: "bool" } } as any,
      uuids: ["aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"],
      section: "Progressions",
      fields: [{ key: "AllowImprovement", value: "yes" }],
      vanillaSections: {},
    });
    const err = result.find(e => e.key === "field:AllowImprovement");
    expect(err).toBeDefined();
    expect(err!.severity).toBe("error");
  });

  it("accepts valid bool field values (case insensitive)", () => {
    const result = computeValidationErrors({
      caps: { ...baseCaps, hasFields: true, fieldTypes: { AllowImprovement: "bool" } } as any,
      uuids: ["aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"],
      section: "Progressions",
      fields: [{ key: "AllowImprovement", value: "True" }],
      vanillaSections: {},
    });
    expect(result.find(e => e.key === "field:AllowImprovement")).toBeUndefined();
  });

  it("warns for string (UUID) field with invalid UUID", () => {
    const result = computeValidationErrors({
      caps: { ...baseCaps, hasFields: true, fieldTypes: { TableUUID: "string (UUID)" } } as any,
      uuids: ["aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"],
      section: "Progressions",
      fields: [{ key: "TableUUID", value: "not-uuid" }],
      vanillaSections: {},
    });
    const warn = result.find(e => e.key === "field:TableUUID");
    expect(warn).toBeDefined();
    expect(warn!.severity).toBe("warning");
  });

  it("accepts valid string (UUID) field", () => {
    const result = computeValidationErrors({
      caps: { ...baseCaps, hasFields: true, fieldTypes: { TableUUID: "string (UUID)" } } as any,
      uuids: ["aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"],
      section: "Progressions",
      fields: [{ key: "TableUUID", value: "11111111-2222-3333-4444-555555555555" }],
      vanillaSections: {},
    });
    expect(result.find(e => e.key === "field:TableUUID")).toBeUndefined();
  });

  it("skips fields with empty values", () => {
    const result = computeValidationErrors({
      caps: { ...baseCaps, hasFields: true, fieldTypes: { Level: "int" } } as any,
      uuids: ["aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"],
      section: "Progressions",
      fields: [{ key: "Level", value: "" }],
      vanillaSections: {},
    });
    expect(result.find(e => e.key === "field:Level")).toBeUndefined();
  });

  it("skips fields with no matching fieldType", () => {
    const result = computeValidationErrors({
      caps: { ...baseCaps, hasFields: true, fieldTypes: { Level: "int" } } as any,
      uuids: ["aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"],
      section: "Progressions",
      fields: [{ key: "Name", value: "anything" }],
      vanillaSections: {},
    });
    expect(result).toEqual([]);
  });

  it("skips field type checks when hasFields is false", () => {
    const result = computeValidationErrors({
      caps: { ...baseCaps, hasFields: false, fieldTypes: { Level: "int" } } as any,
      uuids: ["aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"],
      section: "Progressions",
      fields: [{ key: "Level", value: "abc" }],
      vanillaSections: {},
    });
    // Only UUID validation runs, not field type
    expect(result.find(e => e.key === "field:Level")).toBeUndefined();
  });

  it("skips field type checks when fieldTypes is undefined", () => {
    const result = computeValidationErrors({
      caps: { ...baseCaps, hasFields: true } as any,
      uuids: ["aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"],
      section: "Progressions",
      fields: [{ key: "Level", value: "abc" }],
      vanillaSections: {},
    });
    expect(result.find(e => e.key === "field:Level")).toBeUndefined();
  });

  it("skips cross-section check when UUID is invalid format", () => {
    const result = computeValidationErrors({
      caps: baseCaps as any,
      uuids: ["not-valid"],
      section: "Races",
      fields: [],
      vanillaSections: {
        Progressions: [{ uuid: "not-valid", display_name: "test", node_id: "" }],
      },
    });
    // Should only have the format warning, not cross-section
    expect(result.find(e => e.key === "uuid:cross")).toBeUndefined();
  });

  it("UUID comparison is case-insensitive", () => {
    const result = computeValidationErrors({
      caps: baseCaps as any,
      uuids: ["AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE"],
      section: "Races",
      fields: [],
      vanillaSections: {
        Races: [{ uuid: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", display_name: "test", node_id: "" }],
      },
    });
    expect(result.find(e => e.key === "uuid:exists")).toBeDefined();
  });
});
