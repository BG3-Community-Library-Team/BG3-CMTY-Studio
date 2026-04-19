export interface StatFieldGroup {
  /** Group title displayed as section header */
  title: string;
  /** Ordered field keys in this group */
  fields: string[];
  /** Whether the group is collapsed by default */
  collapsed?: boolean;
}

export interface StatTypeMetadata {
  /** Ordered field groups for form layout */
  groups: StatFieldGroup[];
  /** Field → combobox descriptor overrides (merged with schema inference) */
  fieldCombobox: Record<string, string>;
  /** Field → gating condition (Sprint 4 — leave empty for now) */
  fieldGating: Record<string, unknown>;
  /** Field → default value on creation (Sprint 4 — leave empty for now) */
  defaults: Record<string, string>;
}

export const STAT_TYPE_METADATA: Record<string, StatTypeMetadata> = {
  SpellData: {
    groups: [
      {
        title: "Identity",
        fields: ["DisplayName", "Description", "ExtraDescription", "Icon", "DescriptionParams"],
      },
      {
        title: "Classification",
        fields: ["SpellType", "Level", "SpellSchool", "VerbalIntent", "SpellAnimationIntentType"],
      },
      {
        title: "Targeting",
        fields: [
          "TargetRadius",
          "AreaRadius",
          "TargetConditions",
          "TargetCeiling",
          "TargetFloor",
          "MaximumTargets",
          "PreviewCursor",
          "CycleConditions",
        ],
      },
      {
        title: "Mechanics",
        fields: [
          "SpellRoll",
          "SpellSuccess",
          "SpellFail",
          "SpellProperties",
          "Damage",
          "DamageType",
          "ToHitBonus",
        ],
      },
      {
        title: "Resources & Cooldowns",
        fields: [
          "UseCosts",
          "DualWieldingUseCosts",
          "Cooldown",
          "CooldownType",
          "MemoryCost",
          "SpellActionType",
        ],
      },
      {
        title: "Tooltips",
        fields: ["TooltipDamageList", "TooltipAttackSave", "TooltipStatusApply", "TooltipUseCosts"],
      },
      {
        title: "Containers & Links",
        fields: ["ContainerSpells", "SpellContainerID", "ConcentrationSpellID", "RootSpellID"],
      },
      {
        title: "Flags & Properties",
        fields: [
          "SpellFlags",
          "WeaponTypes",
          "Sheathing",
          "CastTextEvent",
          "AlternativeCastTextEvents",
        ],
      },
      {
        title: "Animation",
        fields: ["SpellAnimation", "DualWieldingSpellAnimation", "HitAnimationType"],
      },
      {
        title: "Audio",
        fields: ["PrepareSound", "PrepareLoopSound", "CastSound", "TargetSound"],
      },
      {
        title: "VFX",
        fields: ["CastEffect", "PrepareEffect", "HitEffect", "TargetEffect"],
      },
      {
        title: "Inheritance",
        fields: ["Using"],
      },
    ],
    fieldCombobox: {
      Using: "statType:SpellData",
      ConcentrationSpellID: "statType:SpellData",
      RootSpellID: "statType:SpellData",
      SpellContainerID: "statType:SpellData",
      ContainerSpells: "statType:SpellData",
    },
    fieldGating: {},
    defaults: {},
  },

  PassiveData: {
    groups: [
      {
        title: "Identity",
        fields: ["DisplayName", "Description", "ExtraDescription", "Icon", "DescriptionParams"],
      },
      {
        title: "Properties",
        fields: ["Properties"],
      },
      {
        title: "Effects",
        fields: ["Boosts", "BoostContext", "BoostConditions"],
      },
      {
        title: "Conditions",
        fields: ["Conditions"],
      },
      {
        title: "Triggered Effects",
        fields: ["StatsFunctorContext", "StatsFunctors"],
      },
      {
        title: "Toggle",
        fields: [
          "ToggleOnFunctors",
          "ToggleOffFunctors",
          "ToggleGroup",
          "ToggledDefaultAddToHotbar",
        ],
      },
      {
        title: "Tooltips",
        fields: ["TooltipUseCosts"],
      },
      {
        title: "Inheritance",
        fields: ["Using"],
      },
    ],
    fieldCombobox: {
      Using: "statType:PassiveData",
      ToggleGroup: "statType:PassiveData",
    },
    fieldGating: {},
    defaults: {},
  },

  StatusData: {
    groups: [
      {
        title: "Identity",
        fields: ["DisplayName", "Description", "Icon", "DescriptionParams"],
      },
      {
        title: "Classification",
        fields: ["StatusType", "FormatColor"],
      },
      {
        title: "Effects",
        fields: ["Boosts", "OnApplyFunctors", "OnRemoveFunctors", "TickFunctors"],
      },
      {
        title: "Stacking & Duration",
        fields: ["StackId", "StackType", "TickType", "RemoveEvents", "StatusPropertyFlags"],
      },
      {
        title: "Groups",
        fields: ["StatusGroups"],
      },
      {
        title: "Visuals",
        fields: [
          "StatusEffect",
          "StatusEffectOverride",
          "StillAnimationType",
          "StillAnimationPriority",
        ],
      },
      {
        title: "Audio",
        fields: ["SoundStart", "SoundStop", "SoundLoop", "SoundVocalStart"],
      },
      {
        title: "Inheritance",
        fields: ["Using"],
      },
    ],
    fieldCombobox: {
      Using: "statType:StatusData",
    },
    fieldGating: {},
    defaults: {},
  },

  Armor: {
    groups: [
      {
        title: "Identity",
        fields: ["RootTemplate"],
      },
      {
        title: "Base Stats",
        fields: [
          "ArmorClass",
          "ArmorType",
          "Armor Class Ability",
          "Ability Modifier Cap",
          "Shield",
        ],
      },
      {
        title: "Equipment",
        fields: ["Slot", "Proficiency Group", "Level"],
      },
      {
        title: "Effects",
        fields: ["Boosts", "PassivesOnEquip", "StatusOnEquip", "PersonalStatusImmunities"],
      },
      {
        title: "Economy",
        fields: ["Weight", "ValueLevel", "ValueScale", "ValueRounding", "ValueOverride"],
      },
      {
        title: "Inventory",
        fields: [
          "InventoryTab",
          "ComboCategory",
          "MinAmount",
          "MaxAmount",
          "Priority",
          "MinLevel",
          "MaxLevel",
          "ItemColor",
        ],
      },
      {
        title: "Inheritance",
        fields: ["Using"],
      },
    ],
    fieldCombobox: {
      Using: "statType:Armor",
    },
    fieldGating: {},
    defaults: {},
  },

  Weapon: {
    groups: [
      {
        title: "Identity",
        fields: ["RootTemplate"],
      },
      {
        title: "Damage",
        fields: ["Damage", "Damage Type", "DamageRange", "VersatileDamage"],
      },
      {
        title: "Classification",
        fields: ["Slot", "Weapon Group", "Proficiency Group", "Weapon Properties", "ItemGroup"],
      },
      {
        title: "Range",
        fields: ["WeaponRange"],
      },
      {
        title: "Equipment Effects",
        fields: [
          "BoostsOnEquipMainHand",
          "BoostsOnEquipOffHand",
          "PassivesMainHand",
          "PassivesOffHand",
        ],
      },
      {
        title: "Economy",
        fields: ["Weight", "ValueLevel", "ValueScale", "ItemColor"],
      },
      {
        title: "Inventory",
        fields: ["InventoryTab", "UseCosts"],
      },
      {
        title: "Immunities",
        fields: ["PersonalStatusImmunities"],
      },
      {
        title: "Inheritance",
        fields: ["Using"],
      },
    ],
    fieldCombobox: {
      Using: "statType:Weapon",
    },
    fieldGating: {},
    defaults: {},
  },

  InterruptData: {
    groups: [
      {
        title: "Identity",
        fields: ["DisplayName", "Description", "ExtraDescription", "Icon", "DescriptionParams"],
      },
      {
        title: "Trigger",
        fields: [
          "InterruptContext",
          "InterruptContextScope",
          "Conditions",
          "EnableCondition",
          "EnableContext",
        ],
      },
      {
        title: "Resolution",
        fields: ["Roll", "Success", "Failure"],
      },
      {
        title: "Resources",
        fields: ["Cost", "Stack"],
      },
      {
        title: "Behavior",
        fields: ["InterruptDefaultValue", "Container", "Properties"],
      },
      {
        title: "Inheritance",
        fields: ["Using"],
      },
    ],
    fieldCombobox: {
      Using: "statType:InterruptData",
    },
    fieldGating: {},
    defaults: {},
  },
};
