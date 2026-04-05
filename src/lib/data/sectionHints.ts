export interface SectionHints {
  /** Friendly display name for the section */
  displayName?: string;
  /** Semantic group (e.g. "Character Creation", "Gameplay") */
  group?: string;
  /** Attribute names that are GUID references to other sections */
  guidReferences?: Record<string, string>;
  /** Attributes to hide from the form */
  hiddenFields?: string[];
  /** Preferred attribute ordering (listed attrs shown first) */
  fieldOrder?: string[];
  /** Group attributes into named subsections */
  fieldGroups?: Record<string, string[]>;
}

export const SECTION_HINTS: Partial<Record<string, SectionHints>> = {
  CharacterCreationPresets: {
    displayName: "Character Creation Presets",
    group: "Character Creation",
    guidReferences: {
      RaceUUID: "section:Races",
      SubRaceUUID: "section:Races",
      DefaultsTemplate: "folder:RootTemplates",
      RootTemplate: "folder:RootTemplates",
      VOLinesTableUUID: "voiceTable:",
    },
    fieldOrder: ["RaceUUID", "SubRaceUUID", "DefaultsTemplate", "RootTemplate", "VOLinesTableUUID"],
    hiddenFields: ["MapKey", "UUID"],
  },
  CompanionPresets: {
    displayName: "Companion Presets",
    group: "Character Creation",
    guidReferences: {
      RaceUUID: "section:Races",
      SubRaceUUID: "section:Races",
      VOLinesTableUUID: "voiceTable:",
      VoiceTableUUID: "voiceTable:",
      RootTemplate: "folder:RootTemplates",
    },
    fieldOrder: ["DisplayName", "RaceUUID", "SubRaceUUID", "RootTemplate", "VoiceTableUUID"],
    hiddenFields: ["MapKey", "UUID"],
  },
  Voices: {
    displayName: "Voices",
    group: "Audio",
    guidReferences: {
      SpeakerUUID: "section:Origins",
      TableUUID: "voiceTable:",
    },
    fieldOrder: ["DisplayName", "SpeakerUUID", "TableUUID", "BodyType"],
    hiddenFields: ["MapKey", "UUID"],
  },
  Feats: {
    displayName: "Feats",
    group: "Gameplay",
    fieldOrder: ["Requirements"],
    hiddenFields: ["MapKey", "UUID"],
  },
  FeatDescriptions: {
    displayName: "Feat Descriptions",
    group: "Gameplay",
    guidReferences: {
      FeatId: "section:Feats",
    },
    fieldOrder: ["DisplayName", "Description", "FeatId", "ExactMatch"],
    hiddenFields: ["MapKey", "UUID"],
  },
  ColorDefinitions: {
    displayName: "Color Definitions",
    group: "Visuals",
    fieldOrder: ["DisplayName", "UIColor"],
    fieldGroups: {
      "Color Values": ["Color1", "Color2", "Color3", "Color4"],
      "RGB Overrides": [
        "Color1R", "Color1G", "Color1B",
        "Color2R", "Color2G", "Color2B",
        "Color3R", "Color3G", "Color3B",
        "Color4R", "Color4G", "Color4B",
      ],
    },
    hiddenFields: ["MapKey", "UUID"],
  },
  CharacterCreationAppearanceVisuals: {
    displayName: "CC Appearance Visuals",
    group: "Character Creation",
    guidReferences: {
      RaceUUID: "section:Races",
      VisualResource: "folder:RootTemplates",
    },
    fieldOrder: ["DisplayName", "RaceUUID", "BodyType", "BodyShape", "SlotName", "VisualResource"],
    hiddenFields: ["MapKey", "UUID"],
  },
  CharacterCreationSharedVisuals: {
    displayName: "CC Shared Visuals",
    group: "Character Creation",
    guidReferences: {
      RaceUUID: "section:Races",
    },
    fieldOrder: ["DisplayName", "RaceUUID", "BodyType", "BodyShape", "SlotName", "VisualResource"],
    hiddenFields: ["MapKey", "UUID"],
  },
  CharacterCreationAccessorySets: {
    displayName: "CC Accessory Sets",
    group: "Character Creation",
    guidReferences: {
      CharacterUUID: "section:Origins",
      VisualUUID: "folder:RootTemplates",
      RaceUUID: "section:Races",
    },
    fieldOrder: ["DisplayName", "CharacterUUID", "VisualUUID", "SlotName", "RaceUUID"],
    hiddenFields: ["MapKey", "UUID"],
  },
  CharacterCreationEyeColors: {
    displayName: "CC Eye Colors",
    group: "Character Creation",
    guidReferences: {
      SkinColorUUID: "section:CharacterCreationSkinColors",
    },
    fieldOrder: ["DisplayName", "UIColor", "SkinColorUUID"],
    hiddenFields: ["MapKey", "UUID"],
  },
  CharacterCreationSkinColors: {
    displayName: "CC Skin Colors",
    group: "Character Creation",
    fieldOrder: ["DisplayName", "UIColor"],
    hiddenFields: ["MapKey", "UUID"],
  },
  CharacterCreationHairColors: {
    displayName: "CC Hair Colors",
    group: "Character Creation",
    fieldOrder: ["DisplayName", "UIColor"],
    hiddenFields: ["MapKey", "UUID"],
  },
  CharacterCreationMakeupPresets: {
    displayName: "CC Makeup Presets",
    group: "Character Creation",
    guidReferences: {
      RaceUUID: "section:Races",
    },
    fieldOrder: ["DisplayName", "RaceUUID", "UIColor"],
    hiddenFields: ["MapKey", "UUID"],
  },
};
