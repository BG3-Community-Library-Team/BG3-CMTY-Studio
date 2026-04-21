import { describe, expect, it } from "vitest";
import {
  compareInheritanceFields,
  getInheritanceFieldStatus,
  isInheritedField,
  isNewField,
  isOverriddenField,
} from "../lib/utils/inheritanceComparison";

describe("inheritanceComparison", () => {
  it("splits inherited, overridden, and new field keys", () => {
    const result = compareInheritanceFields(
      {
        Damage: "1d8",
        Level: "1",
        SpellType: "Target",
      },
      {
        Using: "Target_MainHandAttack",
        Damage: "2d6",
        Icon: "Spell_Fire",
        Level: "1",
      },
    );

    expect(result.inheritedKeys).toEqual(["Level", "SpellType"]);
    expect(result.overriddenKeys).toEqual(["Damage"]);
    expect(result.newKeys).toEqual(["Icon"]);
  });

  it("treats fields with the same parent and child value as inherited", () => {
    const parentFields = {
      Cooldown: "OncePerTurn",
      SpellType: "Target",
    };
    const childFields = {
      Cooldown: "OncePerTurn",
      Using: "Target_MainHandAttack",
    };

    expect(getInheritanceFieldStatus("Cooldown", parentFields, childFields)).toBe("inherited");
    expect(isInheritedField("Cooldown", parentFields, childFields)).toBe(true);
    expect(isOverriddenField("Cooldown", parentFields, childFields)).toBe(false);
  });

  it("ignores the Using field and reports missing fields as null", () => {
    const parentFields = { Damage: "1d8" };
    const childFields = { Using: "Target_MainHandAttack", Icon: "Spell_Fire" };

    expect(getInheritanceFieldStatus("Using", parentFields, childFields)).toBeNull();
    expect(getInheritanceFieldStatus("Missing", parentFields, childFields)).toBeNull();
    expect(isNewField("Icon", parentFields, childFields)).toBe(true);
  });

  it("handles entries with no parent fields", () => {
    const result = compareInheritanceFields({}, {
      Damage: "1d4",
      SpellType: "Target",
      Using: "Target_MainHandAttack",
    });

    expect(result.inheritedKeys).toEqual([]);
    expect(result.overriddenKeys).toEqual([]);
    expect(result.newKeys).toEqual(["Damage", "SpellType"]);
  });
});