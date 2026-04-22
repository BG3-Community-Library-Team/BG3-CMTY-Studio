export interface StatFieldCardDef {
  /** Card heading text */
  title: string;
  /** Ordered field keys in this card */
  fields: string[];
  /** CSS flex-basis / width for side-by-side layout, e.g. '60%', '40%' */
  width?: string;
  /** Start collapsed */
  collapsed?: boolean;
  /** Full-width card below the side-by-side group */
  fullRow?: boolean;
  /** Number of fields per row in this card (default 1) */
  fieldsPerRow?: number;
  /** Column placement for multi-column stacked card layouts (1 = left, 2 = right) */
  col?: 1 | 2;
  /**
   * Custom row groupings within the card (overrides fieldsPerRow chunking).
   * Use null for an empty grid spacer cell.
   */
  customRows?: (string | null)[][];
  /**
   * CSS grid-template-columns for each customRow (parallel array).
   * Use undefined for equal columns on a specific row.
   */
  customRowTemplates?: Array<string | undefined>;
  /**
   * Maximum number of columns when rendering field rows in this card.
   * Overrides the default cap (2) used by fullRow cards.
   */
  maxFieldColumns?: number;
  /**
   * Gate condition: hide this card when the condition is not met
   * (still shown if any field in the card has a value, or showAllStatsFields is on).
   */
  showWhen?: FieldGate;
  /**
   * Render fields as independent vertical column stacks (no cross-row alignment).
   * Each inner array is one column's list of field keys.
   * When set, `customRows` and `fieldsPerRow` are ignored for layout.
   */
  columnGroups?: string[][];
  /** Override the card's label in the FormNav (used to combine paired cards into one nav entry) */
  navRowLabel?: string;
}

export interface StatFieldGroup {
  /** Group title displayed as section header */
  title: string;
  /** Ordered field keys in this group (used for gating / Other-Fields detection) */
  fields: string[];
  /** Whether the group is collapsed by default */
  collapsed?: boolean;
  /** Inner collapsible cards within this group's tab pane */
  innerCards?: StatFieldCardDef[];
  /**
   * Custom row groupings that override auto-chunking.
   * Each inner array is one row (field keys side-by-side). Use null for empty spacer cells.
   */
  customRows?: (string | null)[][];
  /**
   * CSS grid-template-columns for each customRow (parallel array).
   * Use undefined for equal columns on a specific row.
   */
  customRowTemplates?: Array<string | undefined>;
  /** Maximum number of grid columns for rows in this group */
  maxFieldColumns?: number;
  /**
   * Field keys rendered as a combined FlagGroupBadges component instead of individual rows.
   * These fields are excluded from normal row layout within this group.
   */
  flagGroupKeys?: string[];
  /**
   * Boolean field keys rendered as toggleable badges inside the FlagGroupBadges component.
   * These fields use standard get/setFieldValue but render as on/off flag badges
   * grouped under an "Other" category in the dropdown.
   */
  boolFlagKeys?: string[];
}

export type ExpressionType = 
  | 'roll'       // SpellRoll, Roll — dice roll expressions
  | 'effect'     // SpellSuccess, SpellFail, Boosts, OnApplyFunctors, etc.
  | 'condition'  // Conditions, TargetConditions, BoostConditions, etc.
  | 'cost'       // UseCosts, DualWieldingUseCosts
  | 'display';   // DescriptionParams, TooltipDamageList, etc.

export interface StatTypeMetadata {
  /** Ordered field groups for form layout */
  groups: StatFieldGroup[];
  /** Field → combobox descriptor overrides (merged with schema inference) */
  fieldCombobox: Record<string, string>;
  /** Field → expression type tag (for functor/expression fields only) */
  fieldExpressionType?: Record<string, ExpressionType>;
  /** Field → gating condition that controls visibility */
  fieldGating: Record<string, FieldGate>;
  /** Field → default value on creation (Sprint 4 — leave empty for now) */
  defaults: Record<string, string>;
  /**
   * Field → custom toggle on/off values (renders the field as a boolean toggle switch
   * but uses string values instead of true native booleans).
   */
  fieldBoolToggle?: Record<string, { offValue: string; onValue: string }>;
  /**
   * Field → source field key to copy from (adds a "Sync" button next to the field
   * that copies the source field's current value into this field).
   */
  fieldSyncMap?: Record<string, string>;
}

export interface FieldGate {
  /** Field whose value determines visibility */
  trigger: string;
  /** How to evaluate the trigger value */
  condition:
    | { type: 'equals'; value: string }
    | { type: 'includes'; value: string }
    | { type: 'notEmpty' }
    | { type: 'notEquals'; value: string }
    | { type: 'in'; values: string[] };
}

export function evaluateGate(gate: FieldGate, formData: Record<string, string>): boolean {
  const triggerValue = formData[gate.trigger] ?? '';
  switch (gate.condition.type) {
    case 'equals':
      return triggerValue === gate.condition.value;
    case 'notEquals':
      return triggerValue !== gate.condition.value;
    case 'includes':
      return triggerValue.split(';').includes(gate.condition.value);
    case 'notEmpty':
      return triggerValue.trim() !== '';
    case 'in':
      return gate.condition.values.includes(triggerValue);
  }
}

export const DAMAGE_TYPES = 'static:Bludgeoning,Piercing,Slashing,Fire,Cold,Lightning,Thunder,Poison,Acid,Necrotic,Radiant,Psychic,Force,None';
export const COOLDOWN_VALUES = 'static:None,OncePerTurn,OncePerCombat,OncePerShortRest,OncePerLongRest';
export const INVENTORY_TAB_VALUES = 'static:Equipment,Consumable,Scroll,Food,Key,Misc,Hidden';

export const CORE_STAT_TYPES = [
  "SpellData",
  "PassiveData",
  "StatusData",
  "Armor",
  "Weapon",
  "InterruptData",
] as const;

export type CoreStatType = (typeof CORE_STAT_TYPES)[number];

export const STAT_TYPE_METADATA: Record<string, StatTypeMetadata> = {
  SpellData: {
    groups: [
      {
        title: "Localization",
        fields: [
          "DisplayName", "Icon", "Description", "ExtraDescription", "ShortDescription",
          "DescriptionParams", "ExtraDescriptionParams", "ShortDescriptionParams",
          "TooltipDamageList", "TooltipAttackSave", "TooltipStatusApply",
          "TooltipOnMiss", "TooltipOnSave", "TooltipPermanentWarnings",
          "TooltipSpellDCAbilities", "TooltipUpcastDescription", "TooltipUpcastDescriptionParams",
        ],
        innerCards: [
          {
            title: "Identity",
            fields: ["DisplayName", "Icon", "Description", "ExtraDescription", "ShortDescription"],
            width: "60%",
            navRowLabel: "Identity & Parameters",
          },
          {
            title: "Description Parameters",
            fields: ["DescriptionParams", "ExtraDescriptionParams", "ShortDescriptionParams"],
            width: "40%",
            navRowLabel: "Identity & Parameters",
          },
          {
            title: "Tooltips",
            fields: [
              "TooltipDamageList", "TooltipStatusApply",
              "TooltipUpcastDescriptionParams",
              "TooltipAttackSave", "TooltipSpellDCAbilities",
              "TooltipOnMiss", "TooltipOnSave",
              "TooltipPermanentWarnings", "TooltipUpcastDescription",
            ],
            fullRow: true,
            collapsed: false,
            columnGroups: [
              // Left: combobox/enum reference fields
              ["TooltipAttackSave", "TooltipSpellDCAbilities", "TooltipOnMiss", "TooltipOnSave", "TooltipPermanentWarnings", "TooltipUpcastDescription"],
              // Right: display expression fields
              ["TooltipDamageList", "TooltipStatusApply", "TooltipUpcastDescriptionParams"],
            ],
          },
        ],
      },
      {
        title: "Classification",
        fields: [
          "SpellType", "SpellSchool", "Level",
          "SpellActionType", "Cooldown", "PowerLevel",
          "MemoryCost",
          "SpellStyleGroup", "SpellCategory",
          "UseCosts", "TooltipUseCosts", "HitCosts", "DualWieldingUseCosts", "RitualCosts",
          "Requirements", "RequirementConditions", "RequirementEvents",
        ],
        innerCards: [
          {
            title: "Stats Data",
            fullRow: true,
            collapsed: false,
            fields: ["SpellType", "SpellSchool", "Level", "SpellActionType", "Cooldown", "PowerLevel", "SpellStyleGroup", "SpellCategory", "MemoryCost"],
            customRows: [
              ["SpellType", "SpellSchool", "Level"],
              ["SpellActionType", "Cooldown", "PowerLevel"],
              ["SpellStyleGroup", "SpellCategory", "MemoryCost"],
            ],
            customRowTemplates: [
              "1fr 1fr 8rem",
              "1fr 1fr 8rem",
              "1fr 1fr 8rem",
            ],
          },
          {
            title: "Costs",
            fullRow: true,
            collapsed: false,
            fields: ["UseCosts", "TooltipUseCosts", "RitualCosts", "HitCosts", "DualWieldingUseCosts"],
            customRows: [
              ["UseCosts", "TooltipUseCosts"],
              ["RitualCosts", "HitCosts"],
              ["DualWieldingUseCosts", null],
            ],
          },
          {
            title: "Requirements",
            fullRow: true,
            collapsed: false,
            fields: ["Requirements", "RequirementConditions", "RequirementEvents"],
            columnGroups: [
              // Left: field + event
              ["Requirements", "RequirementEvents"],
              // Right: condition expression
              ["RequirementConditions"],
            ],
          },
        ],
      },
      {
        title: "Targeting",
        fields: [
          "TargetRadius", "AreaRadius", "AmountOfTargets",
          "TargetCeiling", "TargetFloor", "MaximumTargets",
          "MaxDistance", "HitRadius", "MaximumTotalTargetHP", "PreviewCursor",
          "CastTargetHitDelay", "ExplodeRadius",
          "TargetConditions", "CycleConditions", "ForkingConditions",
          "ExtraProjectileTargetConditions",
          "AoEConditions", "OriginTargetConditions", "ThrowableTargetConditions",
          "MaxForkCount", "ForkLevels", "ForkChance",
          "Shape", "Base", "Range", "FrontOffset", "Angle",
          "Height", "ProjectileType", "ProjectileTerrainOffset", "ProjectileDelay",
          "ProjectileCount", "Trajectories", "StrikeCount", "TargetProjectiles",
          "ThrowOrigin", "ThrowableSpellProperties", "ThrowableSpellRoll", "ThrowableSpellSuccess",
        ],
        innerCards: [
          {
            title: "Targeting",
            col: 1,
            fields: ["TargetRadius", "AreaRadius", "AmountOfTargets", "TargetCeiling", "TargetFloor", "MaximumTargets", "MaxDistance", "HitRadius", "MaximumTotalTargetHP", "PreviewCursor", "CastTargetHitDelay", "ExplodeRadius"],
            fieldsPerRow: 2,
            navRowLabel: "Targeting & Conditions",
          },
          {
            title: "Forking",
            col: 1,
            fields: ["MaxForkCount", "ForkLevels", "ForkChance"],
            fieldsPerRow: 3,
            showWhen: { trigger: 'SpellType', condition: { type: 'equals', value: 'Projectile' } },
          },
          {
            title: "Conditions",
            col: 2,
            fields: ["TargetConditions", "CycleConditions", "ForkingConditions", "ExtraProjectileTargetConditions", "AoEConditions", "OriginTargetConditions", "ThrowableTargetConditions"],
            fieldsPerRow: 1,
            navRowLabel: "Targeting & Conditions",
          },
          {
            title: "Zone",
            fullRow: true,
            collapsed: false,
            fields: ["Shape", "Base", "Range", "FrontOffset", "Angle"],
            fieldsPerRow: 3,
            maxFieldColumns: 3,
            showWhen: { trigger: 'SpellType', condition: { type: 'equals', value: 'Zone' } },
          },
          {
            title: "Projectiles",
            fullRow: true,
            fields: ["Height", "Angle", "ProjectileType", "ProjectileTerrainOffset", "ProjectileDelay", "ProjectileCount", "Trajectories", "StrikeCount", "TargetProjectiles"],
            fieldsPerRow: 3,
            maxFieldColumns: 3,
            showWhen: { trigger: 'SpellType', condition: { type: 'in', values: ['Projectile', 'ProjectileStrike'] } },
          },
          {
            title: "Throwing",
            fullRow: true,
            collapsed: false,
            fields: ["ThrowOrigin", "ThrowableSpellProperties", "ThrowableSpellRoll", "ThrowableSpellSuccess"],
            fieldsPerRow: 3,
            maxFieldColumns: 3,
            showWhen: { trigger: 'SpellType', condition: { type: 'equals', value: 'Throw' } },
          },
        ],
      },
      {
        title: "Mechanics",
        fields: [
          "SpellRoll", "SpellSuccess", "SpellFail", "SpellProperties",
          "Damage", "DamageType", "Damage Range", "ToHitBonus", "DeathType", "HitExtension",
        ],
        innerCards: [
          {
            title: "Damage",
            fields: ["Damage", "DamageType", "Damage Range", "ToHitBonus", "DeathType", "HitExtension"],
            fieldsPerRow: 3,
          },
          {
            title: "Properties",
            fullRow: true,
            fields: ["SpellRoll", "SpellProperties", "SpellSuccess", "SpellFail"],
            customRows: [
              ["SpellRoll", "SpellProperties"],
              ["SpellSuccess", "SpellFail"],
            ],
          },
        ],
      },
      {
        title: "Containers & Links",
        fields: ["ContainerSpells", "SpellContainerID", "ConcentrationSpellID", "RootSpellID"],
        customRows: [
          ["ContainerSpells"],
          ["SpellContainerID", "RootSpellID"],
          ["ConcentrationSpellID"],
        ],
      },
      {
        title: "Flags & Properties",
        fields: [
          "SpellFlags", "AIFlags", "LineOfSightFlags", "CinematicArenaFlags",
          "WeaponTypes", "Sheathing", "CastTextEvent", "AlternativeCastTextEvents",
          "OnlyHit1Target", "StopAtFirstContact", "Autocast",
          "IgnoreTeleport", "TeleportSelf", "TeleportSurface",
          "PreviewStrikeHits", "Shuffle",
        ],
        flagGroupKeys: ["SpellFlags", "AIFlags", "LineOfSightFlags", "CinematicArenaFlags"],
        boolFlagKeys: ["OnlyHit1Target", "StopAtFirstContact", "Autocast", "IgnoreTeleport", "TeleportSelf", "TeleportSurface", "PreviewStrikeHits", "Shuffle"],
      },
      {
        title: "Animation",
        fields: ["SpellAnimation", "DualWieldingSpellAnimation", "HitAnimationType", "SpellAnimationIntentType", "SpellAnimationType"],
      },
      {
        title: "Audio",
        fields: ["PrepareSound", "PrepareLoopSound", "CastSound", "TargetSound", "VerbalIntent", "VocalComponentSound", "SpellSoundMagnitude", "InstrumentComponentCastSound", "InstrumentComponentLoopingSound", "InstrumentComponentImpactSound", "InstrumentComponentPrepareSound"],
      },
      {
        title: "VFX",
        fields: ["SpellEffect", "CastEffect", "PrepareEffect", "HitEffect", "TargetEffect", "PreviewEffect", "PositionEffect", "BeamEffect", "DisappearEffect", "ImpactEffect", "TargetGroundEffect", "TargetHitEffect"],
      },
      {
        title: "Surface",
        fields: ["SurfaceRadius", "SurfaceGrowInterval", "SurfaceGrowStep", "SurfaceLifetime", "SurfaceType"],
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
      AIFlags: "multiStatic:CanNotUse,IgnoreVisionBlock,LosBlockCheck,CannotTargetSelf,StandGroundRange",
      SpellType: 'static:Zone,Projectile,Target,Rush,Shout,Teleportation,Throw,ProjectileStrike,Wall',
      SpellSchool: 'static:Evocation,Abjuration,Necromancy,Divination,Enchantment,Illusion,Conjuration,Transmutation,None',
      SpellStyleGroup: 'static:,Class,Intent,Class_Intent',
      SpellCategory: 'valueList:SpellCategoryFlags',
      VerbalIntent: 'static:Damage,Heal,Buff,Debuff,Control,Utility,None',
      SpellAnimationIntentType: 'valueList:SpellAnimationIntentType',
      DamageType: DAMAGE_TYPES,
      Cooldown: 'valueList:CooldownType',
      HitAnimationType: 'static:PhysicalDamage,MagicalDamage_External,MagicalDamage_Internal,None',
      Sheathing: 'valueList:SpellSheathing',
      SpellActionType: 'static:None,Bonus,Reaction,Main',
      PreviewCursor: 'valueList:CursorMode',
      ExtraDescription: 'loca:',
      ShortDescription: 'loca:',
      Shape: 'static:,Cone,Square',
      TooltipSpellDCAbilities: 'multiStatic:Strength,Dexterity,Constitution,Intelligence,Wisdom,Charisma',
      TooltipAttackSave: 'multiStatic:,Strength,Dexterity,Constitution,Intelligence,Wisdom,Charisma,MeleeUnarmedAttack,RangedWeaponAttack,MeleeWeaponAttack,MeleeSpellAttack,RangedSpellAttack',
      TooltipOnMiss: 'section:TooltipExtras',
      TooltipOnSave: 'section:TooltipExtras',
      TooltipPermanentWarnings: 'section:TooltipExtras',
      TooltipUpcastDescription: 'section:TooltipUpcastDescriptions',
      Trajectories: 'multiSection:RootTemplates',
      LineOfSightFlags: 'multiStatic:HasBlocker,HasFog,MainCharacter,TargetUnder,SourceUnder,Cast',
      CinematicArenaFlags: 'multiStatic:ActivateCinematicArenaOnCast,DisableCinematicArenaOnCast',
      RequirementEvents: 'multiStatic:None,OnTurn,OnSpellCast,OnAttack,OnAttacked,OnApply,OnRemove,OnApplyAndTurn,OnDamage,OnEquip,OnUnequip,OnHeal,OnObscurityChanged,UNUSED1,OnSurfaceEnter,OnStatusApplied,OnStatusRemoved,OnMove,OnCombatEnded,OnRemovePerformanceRequest,OnLockpickingSucceeded,OnSourceDeath,OnSourceStatusApplied,OnFactionChanged,OnEntityPickUp,OnEntityDrop,OnEntityDrag,OnLockpickingFinished,OnDisarmingFinished',
      SpellAnimationType: 'valueList:SpellAnimationType',
      DeathType: 'valueList:Death Type',
      WeaponTypes: 'valueList:WeaponFlags',
    },
    fieldExpressionType: {
      SpellRoll: 'roll',
      SpellSuccess: 'effect',
      SpellFail: 'effect',
      SpellProperties: 'effect',
      TargetConditions: 'condition',
      CycleConditions: 'condition',
      ForkingConditions: 'condition',
      ExtraProjectileTargetConditions: 'condition',
      AoEConditions: 'condition',
      OriginTargetConditions: 'condition',
      ThrowableTargetConditions: 'condition',
      ThrowableSpellRoll: 'roll',
      ThrowableSpellProperties: 'effect',
      ThrowableSpellSuccess: 'effect',
      DescriptionParams: 'display',
      ExtraDescriptionParams: 'display',
      ShortDescriptionParams: 'display',
      TooltipDamageList: 'display',
      TooltipStatusApply: 'display',
      TooltipUpcastDescriptionParams: 'display',
      UseCosts: 'cost',
      DualWieldingUseCosts: 'cost',
      HitCosts: 'cost',
      RitualCosts: 'cost',
      TooltipUseCosts: 'cost',
      RequirementConditions: 'condition',
    },
    fieldBoolToggle: {
      OnlyHit1Target: { offValue: '0', onValue: '1' },
      StopAtFirstContact: { offValue: '0', onValue: '1' },
      Autocast: { offValue: 'No', onValue: 'Yes' },
      IgnoreTeleport: { offValue: 'No', onValue: 'Yes' },
      TeleportSelf: { offValue: 'No', onValue: 'Yes' },
      TeleportSurface: { offValue: 'No', onValue: 'Yes' },
      PreviewStrikeHits: { offValue: 'No', onValue: 'Yes' },
      Shuffle: { offValue: 'No', onValue: 'Yes' },
    },
    fieldSyncMap: {
      TooltipUseCosts: 'UseCosts',
      DualWieldingUseCosts: 'UseCosts',
    },
    fieldGating: {
      ProjectileCount: { trigger: 'SpellType', condition: { type: 'equals', value: 'Projectile' } },
      ProjectileDelay: { trigger: 'SpellType', condition: { type: 'equals', value: 'Projectile' } },
      ProjectileSpread: { trigger: 'SpellType', condition: { type: 'equals', value: 'Projectile' } },
      AreaRadius: { trigger: 'SpellType', condition: { type: 'equals', value: 'Zone' } },
      Duration: { trigger: 'SpellType', condition: { type: 'equals', value: 'Zone' } },
      TickFunctors: { trigger: 'SpellType', condition: { type: 'equals', value: 'Zone' } },
      ZoneLifetime: { trigger: 'SpellType', condition: { type: 'equals', value: 'Zone' } },
      RushDistance: { trigger: 'SpellType', condition: { type: 'equals', value: 'Rush' } },
      StopAtFirst: { trigger: 'SpellType', condition: { type: 'equals', value: 'Rush' } },
      TeleportSelf: { trigger: 'SpellType', condition: { type: 'equals', value: 'Teleportation' } },
      TeleportSurface: { trigger: 'SpellType', condition: { type: 'equals', value: 'Teleportation' } },
      IgnoreTeleport: { trigger: 'SpellType', condition: { type: 'equals', value: 'Teleportation' } },
      ThrowOrigin: { trigger: 'SpellType', condition: { type: 'equals', value: 'Throw' } },
      ThrowableSpellProperties: { trigger: 'SpellType', condition: { type: 'equals', value: 'Throw' } },
      ThrowableSpellRoll: { trigger: 'SpellType', condition: { type: 'equals', value: 'Throw' } },
      ThrowableSpellSuccess: { trigger: 'SpellType', condition: { type: 'equals', value: 'Throw' } },
      ForkingConditions: { trigger: 'SpellType', condition: { type: 'equals', value: 'Projectile' } },
      ExtraProjectileTargetConditions: { trigger: 'SpellType', condition: { type: 'in', values: ['Projectile', 'ProjectileStrike'] } },
      ThrowableTargetConditions: { trigger: 'SpellType', condition: { type: 'equals', value: 'Throw' } },
      ContainerSpells: { trigger: 'SpellFlags', condition: { type: 'includes', value: 'IsLinkedSpellContainer' } },
      ConcentrationSpellID: { trigger: 'SpellFlags', condition: { type: 'includes', value: 'IsConcentration' } },
      CooldownType: { trigger: 'Cooldown', condition: { type: 'notEquals', value: 'None' } },
    },
    defaults: { Level: '1' },
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
    fieldExpressionType: {
      Boosts: 'effect',
      BoostConditions: 'condition',
      Conditions: 'condition',
      StatsFunctors: 'effect',
      ToggleOnFunctors: 'effect',
      ToggleOffFunctors: 'effect',
    },
    fieldGating: {
      ToggleOnFunctors: { trigger: 'Properties', condition: { type: 'includes', value: 'IsToggled' } },
      ToggleOffFunctors: { trigger: 'Properties', condition: { type: 'includes', value: 'IsToggled' } },
      ToggleGroup: { trigger: 'Properties', condition: { type: 'includes', value: 'IsToggled' } },
      ToggledDefaultAddToHotbar: { trigger: 'Properties', condition: { type: 'includes', value: 'IsToggled' } },
      StatsFunctors: { trigger: 'StatsFunctorContext', condition: { type: 'notEmpty' } },
    },
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
          "Sheathing",
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
      Sheathing: 'valueList:StatusSheathing',
    },
    fieldExpressionType: {
      Boosts: 'effect',
      OnApplyFunctors: 'effect',
      OnRemoveFunctors: 'effect',
      TickFunctors: 'effect',
    },
    fieldGating: {
      Boosts: { trigger: 'StatusType', condition: { type: 'equals', value: 'BOOST' } },
      HealValue: { trigger: 'StatusType', condition: { type: 'equals', value: 'HEAL' } },
      HealStat: { trigger: 'StatusType', condition: { type: 'equals', value: 'HEAL' } },
      HealType: { trigger: 'StatusType', condition: { type: 'equals', value: 'HEAL' } },
      PolymorphResult: { trigger: 'StatusType', condition: { type: 'equals', value: 'POLYMORPHED' } },
      DisableInteractions: { trigger: 'StatusType', condition: { type: 'equals', value: 'POLYMORPHED' } },
      TickFunctors: { trigger: 'TickType', condition: { type: 'notEquals', value: 'None' } },
      StackPriority: { trigger: 'StackType', condition: { type: 'equals', value: 'Stack' } },
    },
    defaults: { StackType: 'Overwrite', TickType: 'None' },
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
    fieldExpressionType: {
      Boosts: 'effect',
    },
    fieldGating: {},
    defaults: { Shield: 'No' },
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
    fieldExpressionType: {
      BoostsOnEquipMainHand: 'effect',
      BoostsOnEquipOffHand: 'effect',
      UseCosts: 'cost',
    },
    fieldGating: {
      VersatileDamage: { trigger: 'Weapon Properties', condition: { type: 'includes', value: 'Versatile' } },
      Ammunition: { trigger: 'Weapon Properties', condition: { type: 'includes', value: 'Ammunition' } },
      ThrowRange: { trigger: 'Weapon Properties', condition: { type: 'includes', value: 'Thrown' } },
    },
    defaults: { UseCosts: 'ActionPoint:1' },
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
    fieldExpressionType: {
      Roll: 'roll',
      Success: 'effect',
      Failure: 'effect',
      Conditions: 'condition',
      EnableCondition: 'condition',
      Cost: 'cost',
    },
    fieldGating: {},
    defaults: {},
  },
};

export const COMMON_PARENTS = {
  SpellData: [
    '_BaseContainer',
    'Projectile_MainHandAttack',
    'Target_MainHandAttack',
    'Throw_MainHandThrow',
    'Shout_Dash',
  ],
  PassiveData: [],
  StatusData: [],
  Armor: [
    '_Body',
    '_Gloves',
    '_Boots',
    '_Helmet',
    '_Shield',
  ],
  Weapon: [
    '_BaseWeapon',
    '_OneHandedWeapon',
    '_TwoHandedWeapon',
  ],
  InterruptData: [],
} satisfies Record<CoreStatType, readonly string[]>;
