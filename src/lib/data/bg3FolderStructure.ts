/**
 * Canonical BG3 mod folder structure.
 * Defines the standard folder hierarchy that a BG3 mod can contain,
 * along with metadata about what each folder holds.
 *
 * This data powers the FileExplorer tree view — showing all standard folders
 * (even empty ones) so users can click to create new files.
 *
 * "Group" nodes are virtual folders that combine related sections/files
 * (e.g., Action Resources + Action Resource Groups, Lists subtypes + ColorDefinitions).
 */

export interface FolderNode {
  /** Folder name (leaf component of the path) */
  name: string;
  /** Human-readable label for display */
  label: string;
  /** LSX node type(s) commonly found in this folder */
  nodeTypes?: string[];
  /** Whether this folder maps to a CF section */
  Section?: string;
  /** The LSX region ID used in files for this folder */
  regionId?: string;
  /** Child folders */
  children?: FolderNode[];
  /** Default filename if a single file is conventional */
  defaultFile?: string;
  /** If true, this is a virtual grouping folder (not a real filesystem folder) */
  isGroup?: boolean;
  /** CF sections to show when opening this group as a tab */
  groupSections?: string[];
  /** Stats file type (for Stats/Generated/Data/ leaves) */
  statsFile?: string;
  /** Filter to apply when viewing entries: { field, value } matches raw_attributes or node_id */
  entryFilter?: { field: string; value: string };
}

// ─── Stats Data Children ─────────────────────────────────────────────────

/** Stats file nodes — defined before core folders so _Stats group can reference them. */
const STATS_DATA_CHILDREN: FolderNode[] = [
  {
    name: "_Spells",
    label: "Spells",
    isGroup: true,
    groupSections: ["Spells"],
    Section: "Spells",
    entryFilter: { field: "node_id", value: "SpellData" },
    children: [
      { name: "Spell_Projectile", label: "Projectile", statsFile: "Spell_Projectile.txt", Section: "Spells", entryFilter: { field: "node_id", value: "SpellData" } },
      { name: "Spell_ProjectileStrike", label: "Projectile Strike", statsFile: "Spell_ProjectileStrike.txt", Section: "Spells", entryFilter: { field: "node_id", value: "SpellData" } },
      { name: "Spell_Rush", label: "Rush", statsFile: "Spell_Rush.txt", Section: "Spells", entryFilter: { field: "node_id", value: "SpellData" } },
      { name: "Spell_Shout", label: "Shout", statsFile: "Spell_Shout.txt", Section: "Spells", entryFilter: { field: "node_id", value: "SpellData" } },
      { name: "Spell_Target", label: "Target", statsFile: "Spell_Target.txt", Section: "Spells", entryFilter: { field: "node_id", value: "SpellData" } },
      { name: "Spell_Teleportation", label: "Teleportation", statsFile: "Spell_Teleportation.txt", Section: "Spells", entryFilter: { field: "node_id", value: "SpellData" } },
      { name: "Spell_Throw", label: "Throw", statsFile: "Spell_Throw.txt", Section: "Spells", entryFilter: { field: "node_id", value: "SpellData" } },
      { name: "Spell_Zone", label: "Zone", statsFile: "Spell_Zone.txt", Section: "Spells", entryFilter: { field: "node_id", value: "SpellData" } },
      { name: "Interrupt", label: "Interrupts", statsFile: "Interrupt.txt", Section: "Spells", entryFilter: { field: "node_id", value: "InterruptData" } },
    ],
  },
  {
    name: "_Statuses",
    label: "Statuses",
    isGroup: true,
    groupSections: ["Spells"],
    Section: "Spells",
    entryFilter: { field: "node_id", value: "StatusData" },
    children: [
      { name: "Status_BOOST", label: "Boost", statsFile: "Status_BOOST.txt", Section: "Spells", entryFilter: { field: "node_id", value: "StatusData" } },
      { name: "Status_DEACTIVATED", label: "Deactivated", statsFile: "Status_DEACTIVATED.txt", Section: "Spells", entryFilter: { field: "node_id", value: "StatusData" } },
      { name: "Status_DOWNED", label: "Downed", statsFile: "Status_DOWNED.txt", Section: "Spells", entryFilter: { field: "node_id", value: "StatusData" } },
      { name: "Status_EFFECT", label: "Effect", statsFile: "Status_EFFECT.txt", Section: "Spells", entryFilter: { field: "node_id", value: "StatusData" } },
      { name: "Status_FEAR", label: "Fear", statsFile: "Status_FEAR.txt", Section: "Spells", entryFilter: { field: "node_id", value: "StatusData" } },
      { name: "Status_HEAL", label: "Heal", statsFile: "Status_HEAL.txt", Section: "Spells", entryFilter: { field: "node_id", value: "StatusData" } },
      { name: "Status_INCAPACITATED", label: "Incapacitated", statsFile: "Status_INCAPACITATED.txt", Section: "Spells", entryFilter: { field: "node_id", value: "StatusData" } },
      { name: "Status_INVISIBLE", label: "Invisible", statsFile: "Status_INVISIBLE.txt", Section: "Spells", entryFilter: { field: "node_id", value: "StatusData" } },
      { name: "Status_KNOCKED_DOWN", label: "Knocked Down", statsFile: "Status_KNOCKED_DOWN.txt", Section: "Spells", entryFilter: { field: "node_id", value: "StatusData" } },
      { name: "Status_POLYMORPHED", label: "Polymorphed", statsFile: "Status_POLYMORPHED.txt", Section: "Spells", entryFilter: { field: "node_id", value: "StatusData" } },
      { name: "Status_SNEAKING", label: "Sneaking", statsFile: "Status_SNEAKING.txt", Section: "Spells", entryFilter: { field: "node_id", value: "StatusData" } },
    ],
  },
  { name: "Passive", label: "Passives", statsFile: "Passive.txt", Section: "Spells", entryFilter: { field: "node_id", value: "PassiveData" } },
  { name: "Armor", label: "Armor", statsFile: "Armor.txt", Section: "Spells", entryFilter: { field: "node_id", value: "Armor" } },
  { name: "Weapon", label: "Weapons", statsFile: "Weapon.txt", Section: "Spells", entryFilter: { field: "node_id", value: "Weapon" } },
  { name: "Object", label: "Objects", statsFile: "Object.txt", Section: "Spells", entryFilter: { field: "node_id", value: "Object" } },
  { name: "Character", label: "Characters", statsFile: "Character.txt", Section: "Spells", entryFilter: { field: "node_id", value: "Character" } },
  {
    name: "_StatsOther",
    label: "Other Stats",
    isGroup: true,
    children: [
      { name: "BloodTypes", label: "Blood Types", statsFile: "BloodTypes.txt", Section: "Spells", entryFilter: { field: "node_id", value: "BloodTypes" } },
      { name: "CriticalHitTypes", label: "Critical Hit Types", statsFile: "CriticalHitTypes.txt", Section: "Spells", entryFilter: { field: "node_id", value: "CriticalHitTypeData" } },
      { name: "ItemColor", label: "Item Colors", statsFile: "ItemColor.txt", Section: "Spells", entryFilter: { field: "node_id", value: "ItemColor" } },
      { name: "ItemProgressionNames", label: "Item Progression Names", statsFile: "ItemProgressionNames.txt", Section: "Spells", entryFilter: { field: "node_id", value: "ItemProgressionNames" } },
      { name: "ItemProgressionVisuals", label: "Item Progression Visuals", statsFile: "ItemProgressionVisuals.txt", Section: "Spells", entryFilter: { field: "node_id", value: "ItemProgressionVisuals" } },
      { name: "XPData", label: "XP Data", statsFile: "XPData.txt", Section: "Spells", entryFilter: { field: "node_id", value: "XPData" } },
    ],
  },
];

// ─── Core Modding Folders (grouped) ──────────────────────────────────────

/**
// ─── Content Bank Regions ────────────────────────────────────────────────

/**
 * All known LSX region IDs found in Content bank files.
 * Each region maps to a separate staging DB table with node_id "Resource".
 * Mirrors the bank types discovered in UnpackedData/Vanilla/Shared/Public/Shared/Content/.
 */
const CONTENT_BANK_REGIONS = [
  "AnimationBank",
  "AnimationBlueprintBank",
  "AnimationSetBank",
  "AtmosphereBank",
  "BlendSpaceBank",
  "ClothColliderBank",
  "ColorListBank",
  "DialogBank",
  "DiffusionProfileBank",
  "EffectBank",
  "FCurveBank",
  "IKRigBank",
  "LightCookieBank",
  "LightingBank",
  "MaterialBank",
  "MaterialPresetBank",
  "MeshProxyBank",
  "PhysicsBank",
  "ScriptBank",
  "SkeletonBank",
  "SoundBank",
  "SplineSetBank",
  "TerrainBrushBank",
  "TextureBank",
  "TileSetBank",
  "TimelineBank",
  "TimelineSceneBank",
  "VirtualTextureBank",
] as const;

/** Generate FolderNode children for Content bank regions. */
const CONTENT_BANK_CHILDREN: FolderNode[] = CONTENT_BANK_REGIONS.map(region => ({
  name: region,
  label: region.replace(/Bank$/, "").replace(/([A-Z])/g, " $1").trim(),
  Section: "Content",
  regionId: region,
  entryFilter: { field: "region_id", value: region },
}));

// ─── Core Folders ────────────────────────────────────────────────────────

/**
 * Primary folders that modders work with most frequently.
 * Related sections are combined into virtual group folders.
 */
export const BG3_CORE_FOLDERS: FolderNode[] = [
  {
    name: "_ActionResources",
    label: "Action Resources",
    isGroup: true,
    groupSections: ["ActionResources", "ActionResourceGroups"],
    children: [
      {
        name: "ActionResourceDefinitions",
        label: "Action Resource Definitions",
        nodeTypes: ["ActionResourceDefinition"],
        Section: "ActionResources",
        regionId: "ActionResourceDefinitions",
        defaultFile: "ActionResourceDefinitions.lsx",
      },
      {
        name: "ActionResourceGroupDefinitions",
        label: "Action Resource Groups",
        nodeTypes: ["ActionResourceGroup"],
        Section: "ActionResourceGroups",
        regionId: "ActionResourceGroupDefinitions",
        defaultFile: "ActionResourceGroupDefinitions.lsx",
      },
    ],
  },
  {
    name: "Backgrounds",
    label: "Backgrounds",
    nodeTypes: ["Background"],
    Section: "Backgrounds",
    regionId: "Backgrounds",
    defaultFile: "Backgrounds.lsx",
  },
  {
    name: "_CharacterCreation",
    label: "Character Creation",
    isGroup: true,
    children: [
      {
        name: "CC_AccessorySet",
        label: "Accessory Sets",
        Section: "CharacterCreation",
        entryFilter: { field: "node_id", value: "CharacterCreationAccessorySet" },
      },
      {
        name: "CC_AppearanceMaterial",
        label: "Appearance Materials",
        Section: "CharacterCreation",
        entryFilter: { field: "node_id", value: "CharacterCreationAppearanceMaterial" },
      },
      {
        name: "CC_AppearanceVisual",
        label: "Appearance Visuals",
        Section: "CharacterCreation",
        entryFilter: { field: "node_id", value: "CharacterCreationAppearanceVisual" },
      },
      {
        name: "CC_IconSettings",
        label: "Icon Settings",
        Section: "CharacterCreation",
        entryFilter: { field: "node_id", value: "CharacterCreationIconSettings" },
      },
      {
        name: "CC_MaterialOverride",
        label: "Material Overrides",
        Section: "CharacterCreation",
        entryFilter: { field: "node_id", value: "CharacterCreationMaterialOverride" },
      },
      {
        name: "CC_PassiveAppearance",
        label: "Passive Appearances",
        Section: "CharacterCreation",
        entryFilter: { field: "node_id", value: "CharacterCreationPassiveAppearance" },
      },
      {
        name: "CC_SharedVisual",
        label: "Shared Visuals",
        Section: "CharacterCreation",
        entryFilter: { field: "node_id", value: "CharacterCreationSharedVisual" },
      },
      {
        name: "CCPresets_Preset",
        label: "Presets",
        Section: "CharacterCreationPresets",
        entryFilter: { field: "node_id", value: "CharacterCreationPreset" },
      },
      {
        name: "CCPresets_AccessorySet",
        label: "Preset Accessory Sets",
        Section: "CharacterCreationPresets",
        entryFilter: { field: "node_id", value: "CharacterCreationAccessorySet" },
      },
      {
        name: "CompanionPresets",
        label: "Companion Presets",
        nodeTypes: ["CompanionPreset"],
        Section: "CompanionPresets",
        regionId: "CompanionPresets",
        defaultFile: "CompanionPresets.lsx",
      },
    ],
  },
  {
    name: "_Classes",
    label: "Classes",
    isGroup: true,
    groupSections: ["ClassDescriptions", "Progressions", "ProgressionDescriptions"],
    children: [
      {
        name: "ClassDescriptions",
        label: "Class Descriptions",
        nodeTypes: ["ClassDescription"],
        Section: "ClassDescriptions",
        regionId: "ClassDescriptions",
        defaultFile: "ClassDescriptions.lsx",
      },
      {
        name: "Progressions_Class",
        label: "Class Progressions",
        nodeTypes: ["Progression"],
        Section: "Progressions",
        regionId: "Progressions",
        defaultFile: "Progressions.lsx",
        entryFilter: { field: "ProgressionType", value: "0" },
      },
      {
        name: "Progressions_Subclass",
        label: "Subclass Progressions",
        nodeTypes: ["Progression"],
        Section: "Progressions",
        regionId: "Progressions",
        entryFilter: { field: "ProgressionType", value: "1" },
      },
      {
        name: "ProgressionDescriptions",
        label: "Progression Descriptions",
        nodeTypes: ["ProgressionDescription"],
        Section: "ProgressionDescriptions",
        regionId: "ProgressionDescriptions",
        defaultFile: "ProgressionDescriptions.lsx",
      },
    ],
  },
  {
    name: "_Feats",
    label: "Feats",
    isGroup: true,
    groupSections: ["Feats"],
    children: [
      {
        name: "Feats",
        label: "Feats",
        nodeTypes: ["Feat"],
        Section: "Feats",
        regionId: "Feats",
        defaultFile: "Feats.lsx",
      },
      {
        name: "FeatDescriptions",
        label: "Feat Descriptions",
        nodeTypes: ["FeatDescription"],
        Section: "FeatDescriptions",
        regionId: "FeatDescriptions",
        defaultFile: "FeatDescriptions.lsx",
      },
    ],
  },
  {
    name: "Gods",
    label: "Gods",
    nodeTypes: ["God"],
    Section: "Gods",
    regionId: "Gods",
    defaultFile: "Gods.lsx",
  },
  {
    name: "_Lists",
    label: "Lists",
    isGroup: true,
    groupSections: ["Lists", "SpellLists", "SkillLists", "PassiveLists", "EquipmentLists", "AbilityLists"],
    children: [
      {
        name: "Lists_Spell",
        label: "Spell Lists",
        nodeTypes: ["SpellList"],
        Section: "Lists",
        regionId: "Lists",
        defaultFile: "Lists.lsx",
        entryFilter: { field: "node_id", value: "SpellList" },
      },
      {
        name: "Lists_Passive",
        label: "Passive Lists",
        nodeTypes: ["PassiveList"],
        Section: "Lists",
        regionId: "Lists",
        entryFilter: { field: "node_id", value: "PassiveList" },
      },
      {
        name: "Lists_Skill",
        label: "Skill Lists",
        nodeTypes: ["SkillList"],
        Section: "Lists",
        regionId: "Lists",
        entryFilter: { field: "node_id", value: "SkillList" },
      },
      {
        name: "Lists_Ability",
        label: "Ability Lists",
        nodeTypes: ["AbilityList"],
        Section: "Lists",
        regionId: "Lists",
        entryFilter: { field: "node_id", value: "AbilityList" },
      },
      {
        name: "Lists_Equipment",
        label: "Equipment Lists",
        nodeTypes: ["EquipmentList"],
        Section: "Lists",
        regionId: "Lists",
        entryFilter: { field: "node_id", value: "EquipmentList" },
      },
      {
        name: "AvatarContainerTemplates",
        label: "Avatar Container Templates",
        Section: "AvatarContainerTemplates",
        regionId: "AvatarContainerTemplates",
      },
      {
        name: "CampChestTemplates",
        label: "Camp Chest Templates",
        Section: "CampChestTemplates",
        regionId: "CampChestTemplates",
      },
    ],
  },
  {
    name: "_Origins",
    label: "Origins",
    isGroup: true,
    groupSections: ["Origins", "OriginIntroEntities"],
    children: [
      {
        name: "Origins_Companions",
        label: "Companions",
        nodeTypes: ["Origin"],
        Section: "Origins",
        regionId: "Origins",
        defaultFile: "Origins.lsx",
        entryFilter: { field: "IsHenchman", value: "false" },
      },
      {
        name: "Origins_Hirelings",
        label: "Hirelings",
        nodeTypes: ["Origin"],
        Section: "Origins",
        regionId: "Origins",
        entryFilter: { field: "IsHenchman", value: "true" },
      },
      {
        name: "OriginIntroEntities",
        label: "Intro Entities",
        Section: "OriginIntroEntities",
        regionId: "OriginIntroEntities",
      },
    ],
  },
  {
    name: "_Races",
    label: "Races",
    isGroup: true,
    groupSections: ["Races", "Progressions"],
    children: [
      {
        name: "Races",
        label: "Races",
        nodeTypes: ["Race"],
        Section: "Races",
        regionId: "Races",
        defaultFile: "Races.lsx",
      },
      {
        name: "Progressions_Race",
        label: "Race Progressions",
        nodeTypes: ["Progression"],
        Section: "Progressions",
        regionId: "Progressions",
        entryFilter: { field: "ProgressionType", value: "2" },
      },
    ],
  },
  {
    name: "_TagsFlags",
    label: "Tags / Flags",
    isGroup: true,
    groupSections: ["Tags", "Flags", "FlagSoundStates"],
    children: [
      {
        name: "Tags",
        label: "Tags",
        nodeTypes: ["Tag"],
        Section: "Tags",
        regionId: "Tags",
      },
      {
        name: "Flags",
        label: "Flags",
        Section: "Flags",
        regionId: "Flags",
      },
      {
        name: "FlagSoundStates",
        label: "Flag Sound States",
        Section: "FlagSoundStates",
        regionId: "FlagSoundStates",
      },
    ],
  },
  {
    name: "_Colors",
    label: "Colors",
    isGroup: true,
    children: [
      {
        name: "CCPresets_EyeColor",
        label: "Eye Colors",
        Section: "CharacterCreationPresets",
        entryFilter: { field: "node_id", value: "CharacterCreationEyeColor" },
      },
      {
        name: "CCPresets_SkinColor",
        label: "Skin Colors",
        Section: "CharacterCreationPresets",
        entryFilter: { field: "node_id", value: "CharacterCreationSkinColor" },
      },
      {
        name: "CCPresets_HairColor",
        label: "Hair Colors",
        Section: "CharacterCreationPresets",
        entryFilter: { field: "node_id", value: "CharacterCreationHairColor" },
      },
      {
        name: "ColorDefinitions",
        label: "Color Definitions",
        nodeTypes: ["ColorDefinition"],
        Section: "ColorDefinitions",
        regionId: "ColorDefinitions",
        defaultFile: "ColorDefinitions.lsx",
      },
      {
        name: "GameColors",
        label: "Game Colors",
        Section: "Color",
        regionId: "Color",
      },
    ],
  },
  {
    name: "_Content",
    label: "Content",
    isGroup: true,
    groupSections: ["Content", "Visuals"],
    children: [
      { name: "CharacterVisualBank", label: "Character Visuals", Section: "Visuals", regionId: "CharacterVisualBank", entryFilter: { field: "region_id", value: "CharacterVisualBank" } },
      { name: "VisualBank", label: "Visuals", Section: "Visuals", regionId: "VisualBank", entryFilter: { field: "region_id", value: "VisualBank" } },
      ...CONTENT_BANK_CHILDREN,
    ],
  },
  {
    name: "_VFX",
    label: "VFX",
    isGroup: true,
    groupSections: ["VFX", "DeathEffects"],
    children: [
      { name: "VFX", label: "Gameplay VFX", Section: "VFX", regionId: "GameplayVFXs", entryFilter: { field: "node_id", value: "VFX" } },
      { name: "PassivesVFX", label: "Passives VFX", Section: "VFX", regionId: "PassivesVFX", entryFilter: { field: "node_id", value: "Passives" } },
      { name: "ManagedStatusVFX", label: "Managed Status VFX", Section: "VFX", regionId: "ManagedStatusVFX", entryFilter: { field: "node_id", value: "ManagedStatusVFX" } },
      { name: "DeathEffects", label: "Death Effects", Section: "DeathEffects", regionId: "DeathEffects" },
    ],
  },
  {
    name: "RootTemplates",
    label: "Root Templates",
    nodeTypes: ["GameObjects"],
    Section: "RootTemplates",
    regionId: "Templates",
  },
  {
    name: "_Stats",
    label: "Stats",
    isGroup: true,
    groupSections: ["Spells"],
    children: STATS_DATA_CHILDREN,
  },
];

// ─── Additional LSX Data Folders ─────────────────────────────────────────

/**
 * Every other LSX folder found in the vanilla game data (Public/Shared/).
 * These aren't CF-managed but exist in the game and mods can add to them.
 */
export const BG3_ADDITIONAL_FOLDERS: FolderNode[] = [
  {
    name: "_Animations",
    label: "Animations",
    isGroup: true,
    groupSections: ["Animation", "AnimationOverrides"],
    children: [
      { name: "Animation", label: "Animation", Section: "Animation", regionId: "Animation" },
      { name: "AnimationOverrides", label: "Animation Overrides", Section: "AnimationOverrides", regionId: "AnimationOverrides" },
    ],
  },
  {
    name: "_Calendar",
    label: "Calendar",
    isGroup: true,
    groupSections: ["Calendar", "DayRanges"],
    children: [
      { name: "Calendar", label: "Calendar", Section: "Calendar", regionId: "Calendar" },
      { name: "DayRanges", label: "Day Ranges", Section: "DayRanges", regionId: "DayRanges" },
    ],
  },
  { name: "CinematicArenaFrequencyGroups", label: "Cinematic Arena Groups", Section: "CinematicArenaFrequencyGroups", regionId: "CinematicArenaFrequencyGroups" },
  { name: "CombatCameraGroups", label: "Combat Camera Groups", Section: "CombatCameraGroups", regionId: "CombatCameraGroups" },
  { name: "Crime", label: "Crime", Section: "Crime", regionId: "Crime" },
  {
    name: "_CrowdCharacters",
    label: "Crowd Characters",
    isGroup: true,
    groupSections: ["CrowdCharacterClothsColors", "CrowdCharacterEyeColors", "CrowdCharacterMaterialPresets", "CrowdCharacterSkinColors", "CrowdCharacterTemplates"],
    children: [
      { name: "CrowdCharacterClothsColors", label: "Cloths Colors", Section: "CrowdCharacterClothsColors", regionId: "CrowdCharacterClothsColors" },
      { name: "CrowdCharacterEyeColors", label: "Eye Colors", Section: "CrowdCharacterEyeColors", regionId: "CrowdCharacterEyeColors" },
      { name: "CrowdCharacterMaterialPresets", label: "Material Presets", Section: "CrowdCharacterMaterialPresets", regionId: "CrowdCharacterMaterialPresets" },
      { name: "CrowdCharacterSkinColors", label: "Skin Colors", Section: "CrowdCharacterSkinColors", regionId: "CrowdCharacterSkinColors" },
      { name: "CrowdCharacterTemplates", label: "Templates", Section: "CrowdCharacterTemplates", regionId: "CrowdCharacterTemplates" },
    ],
  },
  { name: "CustomDice", label: "Custom Dice", Section: "CustomDice", regionId: "CustomDice" },
  { name: "DefaultValues", label: "Default Values", Section: "DefaultValues", regionId: "DefaultValues" },
  { name: "DifficultyClasses", label: "Difficulty Classes", Section: "DifficultyClasses", regionId: "DifficultyClasses" },
  { name: "Disturbances", label: "Disturbances", Section: "Disturbances", regionId: "DisturbanceProperties" },
  { name: "Encumbrance", label: "Encumbrance", Section: "Encumbrance", regionId: "WeightCategories" },
  {
    name: "_Emotes",
    label: "Emotes",
    isGroup: true,
    groupSections: ["EmoteAnimations", "EmoteCollections", "EmotePoses"],
    children: [
      { name: "EmoteAnimations", label: "Emote Animations", Section: "EmoteAnimations", regionId: "EmoteAnimations" },
      { name: "EmoteCollections", label: "Emote Collections", Section: "EmoteCollections", regionId: "EmoteCollections" },
      { name: "EmotePoses", label: "Emote Poses", Section: "EmotePoses", regionId: "EmotePoses" },
    ],
  },
  { name: "EquipmentTypes", label: "Equipment Types", Section: "EquipmentTypes", regionId: "EquipmentTypes" },
  {
    name: "_FaceExpressions",
    label: "Face Expressions",
    isGroup: true,
    groupSections: ["FaceExpressions", "FaceExpressionCollections"],
    children: [
      { name: "FaceExpressions", label: "Face Expressions", Section: "FaceExpressions", regionId: "FaceExpressions" },
      { name: "FaceExpressionCollections", label: "Collections", Section: "FaceExpressionCollections", regionId: "FaceExpressionCollections" },
    ],
  },
  {
    name: "_Factions",
    label: "Factions",
    isGroup: true,
    groupSections: ["Factions", "FactionManager"],
    children: [
      { name: "Factions", label: "Factions", Section: "Factions", regionId: "FactionContainer" },
      { name: "FactionManager", label: "Faction Manager", Section: "FactionManager", regionId: "FactionManager" },
    ],
  },

  { name: "FixedHotBarSlots", label: "Fixed Hotbar Slots", Section: "FixedHotBarSlots", regionId: "FixedHotBarSlots" },
  {
    name: "_TextureAtlas",
    label: "Icon Texture Atlases",
    isGroup: true,
    groupSections: ["TextureAtlasInfo", "IconUVList"],
    Section: "TextureAtlasInfo",
  },
  { name: "ItemThrowParams", label: "Item Throw Params", Section: "ItemThrowParams", regionId: "ItemThrowParams" },
  { name: "Levelmaps", label: "Level Maps", Section: "Levelmaps", regionId: "LevelMapValues" },
  { name: "LimbsMapping", label: "Limbs Mapping", Section: "LimbsMapping", regionId: "LimbsMapping" },
  { name: "MultiEffectInfos", label: "Multi-Effect Infos", Section: "MultiEffectInfos", regionId: "MultiEffectInfos" },
  { name: "ProjectileDefaults", label: "Projectile Defaults", Section: "ProjectileDefaults", regionId: "ProjectileDefaults" },
  { name: "RandomCasts", label: "Random Casts", Section: "RandomCasts", regionId: "RandomCasts" },
  {
    name: "_Ruleset",
    label: "Ruleset",
    isGroup: true,
    groupSections: ["Ruleset", "RulesetModifierOptions", "RulesetSelectionPresets"],
    children: [
      { name: "Ruleset", label: "Ruleset", Section: "Ruleset", regionId: "Rulesets" },
      { name: "RulesetModifierOptions", label: "Modifier Options", Section: "RulesetModifierOptions", regionId: "RulesetModifierOptions" },
      { name: "RulesetSelectionPresets", label: "Selection Presets", Section: "RulesetSelectionPresets", regionId: "RulesetSelectionPresets" },
    ],
  },
  {
    name: "_ScriptMaterial",
    label: "Script Material",
    isGroup: true,
    groupSections: ["ScriptMaterialOverrideParameters", "ScriptMaterialOverridePresets"],
    children: [
      { name: "ScriptMaterialOverrideParameters", label: "Override Parameters", Section: "ScriptMaterialOverrideParameters", regionId: "ScriptMaterialOverrideParameters" },
      { name: "ScriptMaterialOverridePresets", label: "Override Presets", Section: "ScriptMaterialOverridePresets", regionId: "ScriptMaterialOverridePresets" },
    ],
  },
  {
    name: "_Shapeshift",
    label: "Shapeshift",
    isGroup: true,
    groupSections: ["Shapeshift", "Rulebook"],
    children: [
      { name: "Shapeshift", label: "Shapeshift", Section: "Shapeshift", regionId: "Shapeshift" },
      { name: "Rulebook", label: "Rulebook", Section: "Rulebook", regionId: "Rulebook" },
    ],
  },
  {
    name: "_ShortNames",
    label: "Short Names",
    isGroup: true,
    groupSections: ["ShortNameCategories", "ShortNames"],
    children: [
      { name: "ShortNameCategories", label: "Categories", Section: "ShortNameCategories", regionId: "ShortNameCategories" },
      { name: "ShortNames", label: "Short Names", Section: "ShortNames", regionId: "ShortNames" },
    ],
  },
  {
    name: "_Sound",
    label: "Sound",
    isGroup: true,
    groupSections: ["Sound"],
    children: [
      { name: "Sound", label: "Sound Banks", Section: "Sound", regionId: "Sound" },
    ],
  },
  { name: "Spell", label: "Spell Metadata", Section: "SpellMetadata", regionId: "Spell" },
  { name: "Status", label: "Status Metadata", Section: "StatusMetadata", regionId: "Status" },
  { name: "Surface", label: "Surface", Section: "Surface", regionId: "Surface" },
  { name: "TooltipExtras", label: "Tooltip Extras", Section: "TooltipExtras", regionId: "TooltipExtraTexts" },
  { name: "TrajectoryRules", label: "Trajectory Rules", Section: "TrajectoryRules", regionId: "TrajectoryRules" },
  {
    name: "_Tutorials",
    label: "Tutorials",
    isGroup: true,
    groupSections: ["Tutorials", "TutorialEvents", "TutorialInputEvents", "UnifiedTutorials"],
    children: [
      { name: "Tutorials", label: "Tutorials", Section: "Tutorials", regionId: "Tutorials" },
      { name: "TutorialEvents", label: "Tutorial Events", Section: "TutorialEvents", regionId: "TutorialEvents" },
      { name: "TutorialInputEvents", label: "Tutorial Input Events", Section: "TutorialInputEvents", regionId: "TutorialInputEvents" },
      { name: "UnifiedTutorials", label: "Unified Tutorials", Section: "UnifiedTutorials", regionId: "UnifiedTutorials" },
    ],
  },
  { name: "Voices", label: "Voices", Section: "Voices", regionId: "Voices" },
  { name: "WeaponAnimationSetData", label: "Weapon Animation Sets", Section: "WeaponAnimationSetData", regionId: "WeaponAnimationSetData" },
  { name: "ErrorDescriptions", label: "Error Descriptions", Section: "ErrorDescriptions", regionId: "ConditionErrors" },
  { name: "ExperienceRewards", label: "Experience Rewards", Section: "ExperienceRewards", regionId: "ExperienceRewards" },
  { name: "GoldValues", label: "Gold Values", Section: "GoldValues", regionId: "GoldValues" },

  { name: "SpeakerGroups", label: "Speaker Groups", Section: "SpeakerGroups", regionId: "SpeakerGroups" },
  { name: "Gossips", label: "Gossips", Section: "Gossips", regionId: "Gossips" },
  {
    name: "_Controller",
    label: "Controller",
    isGroup: true,
    groupSections: ["LightbarHaptics", "LightbarSounds"],
    children: [
      { name: "LightbarHaptics", label: "Lightbar Haptics", Section: "LightbarHaptics", regionId: "LightbarHaptics" },
      { name: "LightbarSounds", label: "Lightbar Sounds", Section: "LightbarSounds", regionId: "LightbarSounds" },
    ],
  },
];

/** All Public/{ModFolder}/ folders — core groups first, then additional folders */
export const BG3_PUBLIC_FOLDERS: FolderNode[] = [
  ...BG3_CORE_FOLDERS,
  ...BG3_ADDITIONAL_FOLDERS,
];

// ─── Stats Folders ───────────────────────────────────────────────────────

/**
 * Stats files under Stats/Generated/Data/.
 * Grouped by category with granular file-level nodes.
 */
export const BG3_STATS_FOLDERS: FolderNode[] = [
  {
    name: "Data",
    label: "Stats Data",
    children: STATS_DATA_CHILDREN,
  },
];

// ─── Complete Mod Structure ──────────────────────────────────────────────

/**
 * The complete canonical mod structure tree.
 * {ModFolder} is a placeholder replaced at runtime with the mod's actual folder name.
 */
export const BG3_MOD_STRUCTURE: FolderNode = {
  name: "{ModFolder}",
  label: "{ModName}",
  children: [
    {
      name: "Public",
      label: "Public",
      children: [
        {
          name: "{ModFolder}",
          label: "{ModFolder}",
          children: BG3_PUBLIC_FOLDERS,
        },
      ],
    },
    {
      name: "Stats",
      label: "Stats",
      children: [
        {
          name: "Generated",
          label: "Generated",
          children: BG3_STATS_FOLDERS,
        },
      ],
    },
    {
      name: "Mods",
      label: "Mods",
      children: [
        {
          name: "{ModFolder}",
          label: "{ModFolder}",
          children: [
            {
              name: "meta.lsx",
              label: "meta.lsx",
              Section: "Meta",
              regionId: "Config",
              nodeTypes: ["ModuleInfo"],
              defaultFile: "meta.lsx",
            },
            {
              name: "ScriptExtender",
              label: "Script Extender",
            },
          ],
        },
      ],
    },
    {
      name: "Localization",
      label: "Localization",
      Section: "Localization",
    },
  ],
};

// ─── Lookup Helpers ──────────────────────────────────────────────────────

/**
 * Flat lookup: folder name → FolderNode metadata.
 * Used to quickly resolve a folder path to its node type and CF section info.
 */
export const FOLDER_NODE_MAP: Record<string, FolderNode> = (() => {
  const map: Record<string, FolderNode> = {};
  function walk(nodes: FolderNode[]): void {
    for (const n of nodes) {
      map[n.name] = n;
      if (n.children) walk(n.children);
    }
  }
  walk(BG3_PUBLIC_FOLDERS);
  walk(BG3_STATS_FOLDERS);
  return map;
})();

/**
 * Set of all section keys already represented in the static sidebar tree.
 * Used to identify DB regions that need dynamic discovery entries.
 */
export const STATIC_SIDEBAR_SECTIONS: ReadonlySet<string> = (() => {
  const sections = new Set<string>();
  function walk(nodes: FolderNode[]): void {
    for (const n of nodes) {
      if (n.Section) sections.add(n.Section);
      if (n.groupSections) for (const s of n.groupSections) sections.add(s);
      if (n.children) walk(n.children);
    }
  }
  walk(BG3_CORE_FOLDERS);
  walk(BG3_ADDITIONAL_FOLDERS);
  walk(BG3_STATS_FOLDERS);
  return sections;
})();

/**
 * Sections to exclude from the dynamic "discovered" pool.
 * Meta is internal-only (has a specialized form). Localization is handled separately.
 */
export const SECTIONS_EXCLUDED_FROM_DISCOVERY: ReadonlySet<string> = new Set([
  "Meta",
  "Localization",
  "BackgroundGoals",
]);

/**
 * Maps a CF section name to its corresponding BG3 folder node.
 */
export const CF_SECTION_TO_FOLDER: Record<string, FolderNode> = (() => {
  const map: Record<string, FolderNode> = {};
  for (const [, node] of Object.entries(FOLDER_NODE_MAP)) {
    if (node.Section && !map[node.Section]) {
      map[node.Section] = node;
    }
  }
  return map;
})();

/** Number of core modding folders (rendered before the "Additional Data" separator) */
export const CORE_FOLDER_COUNT = BG3_CORE_FOLDERS.length;
