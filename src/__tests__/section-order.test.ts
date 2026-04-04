import { describe, it, expect } from "vitest";
import { SECTIONS_ORDERED } from "../lib/types/index.js";

/**
 * Cross-language validation: ensures SECTIONS_ORDERED matches the canonical
 * section order. A matching Rust test in models/mod.rs checks
 * Section::all_ordered() against the same expected list.
 * If either side changes, one of the two tests will fail.
 */
describe("SECTIONS_ORDERED cross-language validation", () => {
  const EXPECTED_ORDER = [
    "Races",
    "Progressions",
    "Lists",
    "Backgrounds",
    "BackgroundGoals",
    "ActionResources",
    "ActionResourceGroups",
    "ClassDescriptions",
    "Origins",
    "Feats",
    "Spells",
    "Gods",
    "Tags",
    "Visuals",
    "CharacterCreation",
    "CharacterCreationPresets",
    "ColorDefinitions",
    "FeatDescriptions",
    "Animation",
    "AnimationOverrides",
    "Calendar",
    "CinematicArenaFrequencyGroups",
    "CombatCameraGroups",
    "Content",
    "CustomDice",
    "DefaultValues",
    "DifficultyClasses",
    "Disturbances",
    "Encumbrance",
    "EquipmentTypes",
    "Factions",
    "Flags",
    "FixedHotBarSlots",
    "GUI",
    "ItemThrowParams",
    "Levelmaps",
    "LimbsMapping",
    "Meta",
    "MultiEffectInfos",
    "ProjectileDefaults",
    "RandomCasts",
    "RootTemplates",
    "Ruleset",
    "Shapeshift",
    "Sound",
    "SpellMetadata",
    "StatusMetadata",
    "Surface",
    "TooltipExtras",
    "TrajectoryRules",
    "Tutorials",
    "VFX",
    "Voices",
    "WeaponAnimationSetData",
    "ErrorDescriptions",
  ] as const;

  it("matches canonical section order", () => {
    expect(SECTIONS_ORDERED).toEqual([...EXPECTED_ORDER]);
  });

  it("has no duplicate sections", () => {
    const unique = new Set(SECTIONS_ORDERED);
    expect(unique.size).toBe(SECTIONS_ORDERED.length);
  });
});
