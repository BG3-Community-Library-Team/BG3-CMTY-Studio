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

export const DAMAGE_TYPES = 'static:Bludgeoning,Piercing,Slashing,Fire,Cold,Lightning,Thunder,Poison,Acid,Necrotic,Radiant,Psychic,Force,None';
export const COOLDOWN_VALUES = 'static:None,OncePerTurn,OncePerCombat,OncePerShortRest,OncePerLongRest';
export const INVENTORY_TAB_VALUES = 'static:Equipment,Consumable,Scroll,Food,Key,Misc,Hidden';

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
      ContainerSpells: "multiStatType:SpellData",
      SpellFlags: "multiStatic:IsAttack,IsMelee,IsHarmful,CanDualWield,HasSomaticComponent,HasVerbalComponent,IsLinkedSpellContainer,Temporary,IsConcentration,IsDefaultWeaponAction,AddFallDamageOnLand,ConcentrationIgnoresResting,IgnoreVisionBlock,Stealth,IgnoreSilence,ImmediateCast,RangeIgnoreVerticalThreshold",
      SpellType: 'static:Zone,Projectile,Target,Rush,Shout,Teleportation,Throw,ProjectileStrike,Wall',
      SpellSchool: 'static:Evocation,Abjuration,Necromancy,Divination,Enchantment,Illusion,Conjuration,Transmutation,None',
      VerbalIntent: 'static:Damage,Heal,Buff,Debuff,Control,Utility,None',
      SpellAnimationIntentType: 'static:Aggressive,Passive,Bonus',
      DamageType: DAMAGE_TYPES,
      Cooldown: COOLDOWN_VALUES,
      CooldownType: 'static:GroupCooldown,IndividualCooldown,None',
      HitAnimationType: 'static:PhysicalDamage,MagicalDamage_External,MagicalDamage_Internal,None',
      Sheathing: 'static:Melee,Ranged,None',
      SpellActionType: 'static:None,Bonus,Reaction,Main',
      PreviewCursor: 'static:Cast,Melee,Ranged,Throw,Cone,AOE',
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
      Properties: "multiStatic:IsHidden,Highlighted,OncePerTurn,ForceShowInCC,IsToggled,ToggledDefaultAddToHotbar,ToggleForParty",
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
      StatusPropertyFlags: "multiStatic:DisableOverhead,DisableCombatlog,DisablePortraitIndicator,ForceOverhead,IgnoreResting,DisableImmunityNarration,InitiateCombat,BringIntoCombat,IsChanneled",
      StatusGroups: "multiStatic:SG_Condition,SG_RemoveOnRespec,SG_WeaponCoating,SG_Drunk,SG_Blinded,SG_Charmed,SG_Frightened,SG_Poisoned,SG_Restrained,SG_Stunned,SG_Unconscious,SG_Invisible,SG_Petrified,SG_Paralyzed,SG_Prone,SG_Exhausted,SG_Incapacitated,SG_Silenced,SG_Sleeping,SG_Confused,SG_Madness,SG_Rage",
      StatusType: 'static:BOOST,EFFECT,HEAL,INVISIBLE,POLYMORPHED,DOWNED,FEAR,INCAPACITATED,DEACTIVATED,SNEAKING',
      StackType: 'static:Stack,Overwrite,Extend',
      TickType: 'static:StartTurn,EndTurn,None',
      FormatColor: 'static:White,Orange,Red,Green,Blue,Purple,Yellow',
      StillAnimationType: 'static:Dazed,Idle,Prone,Sleeping,Sitting,None',
      StillAnimationPriority: 'static:Low,Medium,High',
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
      'Proficiency Group': "multiStatic:LightArmor,MediumArmor,HeavyArmor,Shields,SimpleWeapons,MartialWeapons,Daggers,Shortswords,Longswords,Greatswords,Handaxes,Battleaxes,Greataxes,Maces,Warhammers,Mauls,Clubs,Quarterstaffs,Spears,Halberds,Pikes,Glaives,Scimitars,Rapiers,Flails,Morningstars,WarPicks,Tridents,Javelins,LightCrossbows,HeavyCrossbows,Shortbows,Longbows,HandCrossbows,Slings,Darts",
      PersonalStatusImmunities: "multiStatType:StatusData",
      ArmorType: 'static:None,Padded,Leather,StuddedLeather,Hide,ChainShirt,ScaleMail,Breastplate,HalfPlate,RingMail,ChainMail,Splint,Plate',
      Slot: 'static:Breast,Gloves,Boots,Helmet,Amulet,Ring,Cloak,MeleeMainWeapon,MeleeOffHandWeapon,RangedMainWeapon,RangedOffHandWeapon,MusicalInstrument,Underwear,VanityBody,VanityBoots,Overhead',
      'Armor Class Ability': 'valueList:Ability',
      Shield: 'static:Yes,No',
      InventoryTab: INVENTORY_TAB_VALUES,
      RootTemplate: 'section:RootTemplates',
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
      'Damage Type': DAMAGE_TYPES,
      Slot: 'static:Melee Main Weapon,Ranged Main Weapon,Melee Offhand Weapon,Ranged Offhand Weapon',
      'Weapon Group': 'static:SimpleMeleeWeapon,MartialMeleeWeapon,SimpleRangedWeapon,MartialRangedWeapon',
      'Weapon Properties': "multiStatic:Finesse,Light,Thrown,Heavy,Reach,Versatile,Melee,Dippable,Ammunition,Twohanded,Refundable,NoDualWield,Magical",
      'Proficiency Group': "multiStatic:LightArmor,MediumArmor,HeavyArmor,Shields,SimpleWeapons,MartialWeapons,Daggers,Shortswords,Longswords,Greatswords,Handaxes,Battleaxes,Greataxes,Maces,Warhammers,Mauls,Clubs,Quarterstaffs,Spears,Halberds,Pikes,Glaives,Scimitars,Rapiers,Flails,Morningstars,WarPicks,Tridents,Javelins,LightCrossbows,HeavyCrossbows,Shortbows,Longbows,HandCrossbows,Slings,Darts",
      PersonalStatusImmunities: "multiStatType:StatusData",
      InventoryTab: INVENTORY_TAB_VALUES,
      RootTemplate: 'section:RootTemplates',
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
      InterruptContext: 'static:OnSpellCast,OnPostRoll,OnAttack,OnDamaged,OnAfterAttack,OnHeal,OnStatusApply,OnStatusRemove,OnMoveStart,OnMoveEnd',
      InterruptContextScope: 'static:Self,Nearby,Global',
      InterruptDefaultValue: 'static:Ask,Enabled,Disabled',
      Container: 'static:YesNoDecision,Choice,None',
    },
    fieldGating: {},
    defaults: {},
  },
};
