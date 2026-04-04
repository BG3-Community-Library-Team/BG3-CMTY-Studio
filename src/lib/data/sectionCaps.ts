/**
 * Section capability definitions for ManualEntryForm.
 *
 * Defines which UI features (booleans, fields, selectors, strings, children,
 * tags, subclasses, etc.) are available for each CF section, along with
 * allowed keys, field types, and combobox descriptors.
 */

/** Type for the section capabilities configuration object. */
export interface SectionCapabilities {
  hasBooleans?: boolean;
  hasFields?: boolean;
  hasSelectors?: boolean;
  hasStrings?: boolean;
  hasChildren?: boolean;
  hasTags?: boolean;
  hasSubclasses?: boolean;
  isList?: boolean;
  isSpell?: boolean;
  isARG?: boolean;
  hasBlacklist?: boolean;
  booleanKeys?: string[];
  stringTypes?: string[];
  childTypes?: string[];
  fieldKeys?: string[];
  /** Expected data types for field keys (string, int, bool) */
  fieldTypes?: Record<string, string>;
  /**
   * Fields whose value should come from a combobox.
   * Maps field key → data source descriptor:
   *   - "section:Races" → vanilla Race entries
   *   - "section:Backgrounds" → vanilla Background entries
   *   - "section:Gods" → vanilla God entries
   *   - "section:ClassDescriptions" → vanilla ClassDescription entries
   *   - "valueList:Ability" → from ValueLists.txt "Ability" key
   *   - "valueList:Skill" → from ValueLists.txt "Skill" key
   *   - "static:val1,val2,val3" → static list of values
   */
  fieldCombobox?: Record<string, string>;
  /** Allowed tag type options for this section */
  tagTypes?: string[];
  /**
   * Available LSX node types for sections with multiple entry types.
   * Each entry maps node_id → human-readable label.
   * When defined, ManualEntryForm shows a type selector dropdown.
   */
  nodeTypes?: Record<string, string>;
  /**
   * Per-node-type capability overrides. Keys are node_id values.
   * When a node type is selected, its overrides are merged onto the base caps.
   */
  nodeTypeCaps?: Record<string, Partial<SectionCapabilities>>;
}

export const SECTION_CAPS: Record<string, SectionCapabilities> = {
  Progressions: {
    hasFields: true,
    hasBooleans: true,
    hasSelectors: true,
    hasStrings: true,
    hasChildren: true,
    booleanKeys: ["AllowImprovement", "IsMulticlass"],
    fieldKeys: ["TableUUID", "Name", "Level"],
    fieldTypes: {
      TableUUID: "string (UUID)", Name: "string", Level: "int",
    },
    fieldCombobox: {
      TableUUID: "progressionTable:",
    },
    stringTypes: ["Boosts", "PassivesAdded", "PassivesRemoved"],
    childTypes: ["Subclasses"],
  },
  Feats: {
    hasFields: true,
    hasBooleans: true,
    hasSelectors: true,
    hasStrings: true,
    booleanKeys: ["AllowImprovement", "CanBeTakenMultipleTimes"],
    fieldKeys: ["Requirements"],
    fieldTypes: { Requirements: "string" },
    stringTypes: ["PassivesAdded", "Boosts"],
  },
  Races: {
    hasFields: true,
    hasChildren: true,
    fieldKeys: ["ParentGuid", "Name", "DisplayName", "Description",
      "ProgressionTableUUID", "RaceEquipment", "DisplayTypeUUID", "RaceSoundSwitch"],
    fieldTypes: {
      ParentGuid: "string (UUID)", Name: "string", DisplayName: "string", Description: "string",
      ProgressionTableUUID: "string (UUID)", RaceEquipment: "string",
      DisplayTypeUUID: "string (UUID)", RaceSoundSwitch: "string",
    },
    fieldCombobox: {
      ParentGuid: "section:Races",
      ProgressionTableUUID: "progressionTable:",
      RaceEquipment: "equipment:",
      DisplayTypeUUID: "section:Races",
      DisplayName: "loca:",
      Description: "loca:",
    },
    childTypes: [
      "EyeColors", "SkinColors", "HairColors", "TattooColors",
      "MakeupColors", "LipsMakeupColors", "HairGrayingColors",
      "HairHighlightColors", "HornColors", "HornTipColors",
      "Gods", "ExcludedGods", "Tags", "Visuals",
    ],
  },
  Origins: {
    hasFields: true,
    hasBooleans: true,
    hasStrings: true,
    hasTags: true,
    fieldKeys: [
      "DisplayName", "Description",
      "Background UUID", "BodyShape", "BodyType",
      "ClassEquipmentOverride", "ClassUUID", "CloseUpA", "CloseUpB",
      "DefaultsTemplate", "ExcludesOriginUUID", "GlobalTemplate", "GodUUID",
      "Identity", "IntroDialogUUID",
      "RaceUUID", "SubRaceUUID", "VoiceTableUUID",
    ],
    booleanKeys: ["AvailableInCharacterCreation", "AppearanceLocked", "IsHenchman", "LockBody", "LockClass", "LockRace"],
    fieldTypes: {
      DisplayName: "string", Description: "string",
      BodyShape: "int", BodyType: "int", Identity: "int",
      "Background UUID": "string (UUID)", ClassUUID: "string (UUID)",
      DefaultsTemplate: "string (UUID)", ExcludesOriginUUID: "string (UUID)",
      GlobalTemplate: "string (UUID)", GodUUID: "string (UUID)",
      IntroDialogUUID: "string (UUID)", RaceUUID: "string (UUID)",
      SubRaceUUID: "string (UUID)", VoiceTableUUID: "string (UUID)",
      ClassEquipmentOverride: "string", CloseUpA: "string", CloseUpB: "string",
    },
    fieldCombobox: {
      GodUUID: "section:Gods",
      RaceUUID: "section:Races",
      SubRaceUUID: "section:Races",
      "Background UUID": "section:Backgrounds",
      ClassUUID: "section:ClassDescriptions",
      ClassEquipmentOverride: "equipment:",
      ExcludesOriginUUID: "section:Origins",
      VoiceTableUUID: "voiceTable:",
      DisplayName: "loca:",
      Description: "loca:",
    },
    stringTypes: ["Passives"],
    tagTypes: ["ReallyTags", "AppearanceTags"],
  },
  Backgrounds: {
    hasFields: true,
    hasBooleans: true,
    hasStrings: true,
    hasTags: true,
    fieldKeys: ["DisplayName", "Description"],
    fieldTypes: { DisplayName: "string", Description: "string" },
    fieldCombobox: { DisplayName: "loca:", Description: "loca:" },
    booleanKeys: ["Hidden"],
    stringTypes: ["Passives"],
    tagTypes: ["Tags"],
  },
  BackgroundGoals: {
    hasFields: true,
    fieldKeys: ["BackgroundUuid", "ExperienceReward", "InspirationPoints", "RewardLevel"],
    fieldTypes: { BackgroundUuid: "string (UUID)", ExperienceReward: "int", InspirationPoints: "int", RewardLevel: "int" },
    fieldCombobox: {
      BackgroundUuid: "section:Backgrounds",
    },
  },
  ActionResources: {
    hasFields: true,
    hasBooleans: true,
    fieldKeys: ["DisplayName", "Description", "Name", "DiceType", "MaxLevel", "MaxValue", "ReplenishType"],
    fieldTypes: { DisplayName: "string", Description: "string", Name: "string", DiceType: "int", MaxLevel: "int", MaxValue: "int", ReplenishType: "string" },
    fieldCombobox: {
      ReplenishType: "static:Rest,Never,ShortRest,Turn",
      DisplayName: "loca:",
      Description: "loca:",
    },
    booleanKeys: ["IsHidden", "IsSpellResource", "PartyActionResource", "ShowOnActionResourcePanel", "UpdatesSpellPowerLevel"],
  },
  ActionResourceGroups: { isARG: true },
  ClassDescriptions: {
    hasBlacklist: true,
    hasFields: true,
    hasBooleans: true,
    hasTags: true,
    fieldKeys: [
      "DisplayName", "Description",
      "BaseHp", "HpPerLevel", "SpellCastingAbility", "PrimaryAbility",
      "ClassHotbarColumns", "CommonHotbarColumns", "ItemsHotbarColumns",
      "LearningStrategy", "MulticlassSpellcasterModifier", "AnimationSetPriority",
      "CharacterCreationPose", "CharacterEquipment", "SoundClassType",
      "ProgressionTableUUID", "SpellList", "ParentGuid", "Name", "VoiceTableUUID",
    ],
    fieldTypes: {
      DisplayName: "string", Description: "string",
      BaseHp: "int", HpPerLevel: "int",
      ClassHotbarColumns: "int", CommonHotbarColumns: "int", ItemsHotbarColumns: "int",
      AnimationSetPriority: "int",
      MulticlassSpellcasterModifier: "string",
      LearningStrategy: "string",
      SpellCastingAbility: "string", PrimaryAbility: "string",
      CharacterCreationPose: "string (UUID)",
      CharacterEquipment: "string", SoundClassType: "string", Name: "string",
      ProgressionTableUUID: "string (UUID)", SpellList: "string (UUID)",
      ParentGuid: "string (UUID)", VoiceTableUUID: "string (UUID)",
    },
    fieldCombobox: {
      SpellCastingAbility: "valueList:Ability",
      PrimaryAbility: "valueList:Ability",
      LearningStrategy: "static:0=AddChildren,1=Prepared,2=AllowCasterOnly,3=ArcaneGrimoire",
      CharacterEquipment: "equipment:",
      ParentGuid: "section:ClassDescriptions",
      ProgressionTableUUID: "progressionTable:",
      SpellList: "section:Lists:SpellList",
      VoiceTableUUID: "voiceTable:",
      DisplayName: "loca:",
      Description: "loca:",
    },
    booleanKeys: ["CanLearnSpells", "MustPrepareSpells", "HasGod", "IsDefaultForUseSpellAction"],
    tagTypes: ["Tags"],
  },
  Lists: { isList: true },
  Spells: { isSpell: true },
  Gods: {
    hasFields: true,
    hasChildren: true,
    fieldKeys: ["DisplayName", "Description", "Name"],
    fieldTypes: {
      DisplayName: "string",
      Description: "string",
      Name: "string",
    },
    fieldCombobox: {
      DisplayName: "loca:",
      Description: "loca:",
    },
    childTypes: ["Tags"],
  },
  Tags: {
    hasFields: true,
    fieldKeys: ["Name", "Description", "DisplayName", "DisplayDescription"],
    fieldTypes: {
      Name: "string",
      Description: "string",
      DisplayName: "string",
      DisplayDescription: "string",
    },
    fieldCombobox: {
      DisplayName: "loca:",
      DisplayDescription: "loca:",
    },
  },
  FeatDescriptions: {
    hasFields: true,
    fieldKeys: ["DisplayName", "Description", "ExactMatch", "FeatId"],
    fieldTypes: {
      DisplayName: "string",
      Description: "string",
      ExactMatch: "string",
      FeatId: "string (UUID)",
    },
    fieldCombobox: {
      FeatId: "section:Feats",
      DisplayName: "loca:",
      Description: "loca:",
    },
  },
  CharacterCreationPresets: {
    hasFields: true,
    fieldKeys: ["DisplayName"],
    fieldTypes: { DisplayName: "string" },
    fieldCombobox: { DisplayName: "loca:" },
    nodeTypes: {
      CharacterCreationPreset: "Preset",
      CharacterCreationAccessorySet: "Accessory Set",
      CharacterCreationEyeColor: "Eye Color",
      CharacterCreationSkinColor: "Skin Color",
      CharacterCreationHairColor: "Hair Color",
    },
    nodeTypeCaps: {
      CharacterCreationPreset: {
        hasBooleans: true,
        fieldKeys: [
          "RaceUUID", "SubRaceUUID", "DefaultsTemplate",
          "VOLinesTableUUID", "RootTemplate",
        ],
        fieldTypes: {
          RaceUUID: "string (UUID)", SubRaceUUID: "string (UUID)",
          DefaultsTemplate: "string (UUID)", VOLinesTableUUID: "string (UUID)",
          RootTemplate: "string (UUID)",
        },
        fieldCombobox: {
          RaceUUID: "section:Races",
          SubRaceUUID: "section:Races",
        },
        booleanKeys: ["BodyShape", "BodyType"],
      },
      CharacterCreationAccessorySet: {
        fieldKeys: [
          "DisplayName", "CharacterUUID", "VisualUUID", "SlotName", "RaceUUID",
        ],
        fieldTypes: {
          DisplayName: "string", CharacterUUID: "string (UUID)",
          VisualUUID: "string (UUID)", SlotName: "string",
          RaceUUID: "string (UUID)",
        },
        fieldCombobox: {
          DisplayName: "loca:",
          RaceUUID: "section:Races",
        },
      },
      CharacterCreationEyeColor: {
        fieldKeys: ["DisplayName", "UIColor", "SkinColorUUID"],
        fieldTypes: { DisplayName: "string", UIColor: "color", SkinColorUUID: "string (UUID)" },
        fieldCombobox: { DisplayName: "loca:" },
      },
      CharacterCreationSkinColor: {
        fieldKeys: ["DisplayName", "UIColor"],
        fieldTypes: { DisplayName: "string", UIColor: "color" },
        fieldCombobox: { DisplayName: "loca:" },
      },
      CharacterCreationHairColor: {
        fieldKeys: ["DisplayName", "UIColor"],
        fieldTypes: { DisplayName: "string", UIColor: "color" },
        fieldCombobox: { DisplayName: "loca:" },
      },
    },
  },
  CompanionPresets: {
    hasFields: true,
    fieldKeys: ["DisplayName"],
    fieldTypes: { DisplayName: "string" },
    fieldCombobox: { DisplayName: "loca:" },
    nodeTypes: {
      CompanionPreset: "Companion Preset",
    },
    nodeTypeCaps: {
      CompanionPreset: {
        hasBooleans: true,
        fieldKeys: [
          "RaceUUID", "SubRaceUUID", "VOLinesTableUUID",
          "VoiceTableUUID", "RootTemplate",
        ],
        fieldTypes: {
          RaceUUID: "string (UUID)", SubRaceUUID: "string (UUID)",
          VOLinesTableUUID: "string (UUID)", VoiceTableUUID: "string (UUID)",
          RootTemplate: "string (UUID)",
        },
        fieldCombobox: {
          RaceUUID: "section:Races",
          SubRaceUUID: "section:Races",
        },
        booleanKeys: ["BodyShape", "BodyType"],
      },
    },
  },
  Voices: {
    hasFields: true,
    hasChildren: true,
    fieldKeys: ["DisplayName", "SpeakerUUID", "TableUUID", "BodyType"],
    fieldTypes: {
      DisplayName: "string",
      SpeakerUUID: "string (UUID)",
      TableUUID: "string (UUID)",
      BodyType: "int",
    },
    fieldCombobox: {
      TableUUID: "voiceTable:",
    },
    childTypes: ["Tags"],
  },
  RootTemplates: {
    hasFields: true,
    hasBooleans: true,
    hasTags: true,
    hasChildren: true,
    fieldKeys: [
      "Name", "DisplayName", "Type", "Stats", "SpellSet", "Equipment",
      "Icon", "ParentTemplateId", "VisualTemplate", "PhysicsTemplate",
      "Race", "CharacterVisualResourceID", "LevelName",
      "DefaultBoosts", "DefaultPassives",
    ],
    fieldTypes: {
      Name: "string",
      DisplayName: "string",
      Type: "string",
      Stats: "string",
      SpellSet: "string",
      Equipment: "string",
      Icon: "string",
      ParentTemplateId: "string (UUID)",
      VisualTemplate: "string (UUID)",
      PhysicsTemplate: "string (UUID)",
      Race: "string (UUID)",
      CharacterVisualResourceID: "string (UUID)",
      LevelName: "string",
      DefaultBoosts: "string",
      DefaultPassives: "string",
    },
    fieldCombobox: {
      Race: "section:Races",
      Equipment: "equipment:",
      ParentTemplateId: "folder:RootTemplates",
    },
    booleanKeys: ["IsGlobal", "Flag", "IsEquipable"],
    childTypes: ["Tags", "InventoryList", "OnDeathActions"],
    tagTypes: ["Tags"],
  },
  ColorDefinitions: {
    hasFields: true,
    fieldKeys: ["DisplayName", "UIColor"],
    fieldTypes: { DisplayName: "string", UIColor: "color" },
    fieldCombobox: { DisplayName: "loca:" },
  },
  Levelmaps: {
    hasFields: true,
    fieldKeys: ["Name", "Level", "Value", "DamageMin", "DamageMax"],
    fieldTypes: {
      Name: "string", Level: "int", Value: "int",
      DamageMin: "int", DamageMax: "int",
    },
  },
  EquipmentTypes: {
    hasFields: true,
    fieldKeys: ["Name", "Slot"],
    fieldTypes: { Name: "string", Slot: "string" },
  },
  Shapeshift: {
    hasFields: true,
    fieldKeys: ["Name", "SourceType", "TargetType"],
    fieldTypes: { Name: "string", SourceType: "string", TargetType: "string" },
  },
};
