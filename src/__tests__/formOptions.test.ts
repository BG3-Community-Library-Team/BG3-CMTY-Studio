import { describe, it, expect } from "vitest";

const { getListItemsPlaceholder, getListItemsLabel, combinedSpellIdOptions } =
  await import("../lib/utils/formOptions.js");

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
});
