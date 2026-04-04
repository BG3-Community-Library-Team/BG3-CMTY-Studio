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

// ─── Core Modding Folders (grouped) ──────────────────────────────────────

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
    name: "_Backgrounds",
    label: "Backgrounds",
    isGroup: true,
    groupSections: ["Backgrounds", "BackgroundGoals"],
    children: [
      {
        name: "Backgrounds",
        label: "Backgrounds",
        nodeTypes: ["Background"],
        Section: "Backgrounds",
        regionId: "Backgrounds",
        defaultFile: "Backgrounds.lsx",
      },
      {
        name: "BackgroundGoals",
        label: "Background Goals",
        nodeTypes: ["BackgroundGoal"],
        Section: "BackgroundGoals",
        regionId: "Goals",
        defaultFile: "BackgroundGoals.lsx",
      },
    ],
  },
  {
    name: "_CharacterCreation",
    label: "Character Creation",
    isGroup: true,
    children: [
      {
        name: "CharacterCreation",
        label: "Appearance & Colors",
        nodeTypes: [
          "CharacterCreationAccessorySet",
          "CharacterCreationAppearanceMaterial",
          "CharacterCreationAppearanceVisual",
          "CharacterCreationColor",
          "CharacterCreationEyeColor",
          "CharacterCreationHairColor",
          "CharacterCreationIconSettings",
          "CharacterCreationMaterialOverride",
          "CharacterCreationPassiveAppearance",
          "CharacterCreationSharedVisual",
          "CharacterCreationSkinColor",
        ],
        Section: "CharacterCreation",
        regionId: "CharacterCreation",
      },
      {
        name: "CCPresets_Preset",
        label: "Presets",
        Section: "CharacterCreationPresets",
        entryFilter: { field: "node_id", value: "CharacterCreationPreset" },
      },
      {
        name: "CCPresets_AccessorySet",
        label: "Accessory Sets",
        Section: "CharacterCreationPresets",
        entryFilter: { field: "node_id", value: "CharacterCreationAccessorySet" },
      },
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
    ],
  },
  {
    name: "_Classes",
    label: "Classes",
    isGroup: true,
    groupSections: ["ClassDescriptions", "Progressions"],
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
    label: "Lists & Colors",
    isGroup: true,
    groupSections: ["Lists"],
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
        name: "ColorDefinitions",
        label: "Color Definitions",
        nodeTypes: ["ColorDefinition"],
        Section: "ColorDefinitions",
        regionId: "ColorDefinitions",
        defaultFile: "ColorDefinitions.lsx",
      },
    ],
  },
  {
    name: "_Origins",
    label: "Origins",
    isGroup: true,
    groupSections: ["Origins"],
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
    name: "Tags",
    label: "Tags",
    nodeTypes: ["Tag"],
    Section: "Tags",
    regionId: "Tags",
  },
  {
    name: "Visuals",
    label: "Visuals",
    nodeTypes: ["Visual"],
    Section: "Visuals",
    regionId: "Visuals",
  },
  {
    name: "RootTemplates",
    label: "Root Templates",
    nodeTypes: ["GameObjects"],
    Section: "RootTemplates",
    regionId: "Templates",
  },
];

// ─── Additional LSX Data Folders ─────────────────────────────────────────

/**
 * Every other LSX folder found in the vanilla game data (Public/Shared/).
 * These aren't CF-managed but exist in the game and mods can add to them.
 */
export const BG3_ADDITIONAL_FOLDERS: FolderNode[] = [
  { name: "Animation", label: "Animation", Section: "Animation", regionId: "Animation" },
  { name: "AnimationOverrides", label: "Animation Overrides", Section: "AnimationOverrides", regionId: "AnimationOverrides" },
  { name: "Calendar", label: "Calendar", Section: "Calendar", regionId: "Calendar" },
  { name: "CinematicArenaFrequencyGroups", label: "Cinematic Arena Groups", Section: "CinematicArenaFrequencyGroups", regionId: "CinematicArenaFrequencyGroups" },
  { name: "CombatCameraGroups", label: "Combat Camera Groups", Section: "CombatCameraGroups", regionId: "CombatCameraGroups" },
  { name: "Content", label: "Content", Section: "Content", regionId: "Content" },
  { name: "CustomDice", label: "Custom Dice", Section: "CustomDice", regionId: "CustomDice" },
  { name: "DefaultValues", label: "Default Values", Section: "DefaultValues", regionId: "DefaultValues" },
  { name: "DifficultyClasses", label: "Difficulty Classes", Section: "DifficultyClasses", regionId: "DifficultyClasses" },
  { name: "Disturbances", label: "Disturbances", Section: "Disturbances", regionId: "Disturbances" },
  { name: "Encumbrance", label: "Encumbrance", Section: "Encumbrance", regionId: "Encumbrance" },
  { name: "EquipmentTypes", label: "Equipment Types", Section: "EquipmentTypes", regionId: "EquipmentTypes" },
  { name: "Factions", label: "Factions", Section: "Factions", regionId: "Factions" },
  { name: "Flags", label: "Flags", Section: "Flags", regionId: "Flags" },
  { name: "FixedHotBarSlots", label: "Fixed Hotbar Slots", Section: "FixedHotBarSlots", regionId: "FixedHotBarSlots" },
  { name: "GUI", label: "GUI", Section: "GUI", regionId: "GUI" },
  { name: "ItemThrowParams", label: "Item Throw Params", Section: "ItemThrowParams", regionId: "ItemThrowParams" },
  { name: "Levelmaps", label: "Level Maps", Section: "Levelmaps", regionId: "Levelmaps" },
  { name: "LimbsMapping", label: "Limbs Mapping", Section: "LimbsMapping", regionId: "LimbsMapping" },
  { name: "MultiEffectInfos", label: "Multi-Effect Infos", Section: "MultiEffectInfos", regionId: "MultiEffectInfos" },
  { name: "ProjectileDefaults", label: "Projectile Defaults", Section: "ProjectileDefaults", regionId: "ProjectileDefaults" },
  { name: "RandomCasts", label: "Random Casts", Section: "RandomCasts", regionId: "RandomCasts" },
  { name: "Ruleset", label: "Ruleset", Section: "Ruleset", regionId: "Ruleset" },
  { name: "Shapeshift", label: "Shapeshift", Section: "Shapeshift", regionId: "Shapeshift" },
  { name: "Sound", label: "Sound", Section: "Sound", regionId: "Sound" },
  { name: "Spell", label: "Spell Metadata", Section: "SpellMetadata", regionId: "Spell" },
  { name: "Status", label: "Status Metadata", Section: "StatusMetadata", regionId: "Status" },
  { name: "Surface", label: "Surface", Section: "Surface", regionId: "Surface" },
  { name: "TooltipExtras", label: "Tooltip Extras", Section: "TooltipExtras", regionId: "TooltipExtras" },
  { name: "TrajectoryRules", label: "Trajectory Rules", Section: "TrajectoryRules", regionId: "TrajectoryRules" },
  { name: "Tutorials", label: "Tutorials", Section: "Tutorials", regionId: "Tutorials" },
  { name: "VFX", label: "VFX", Section: "VFX", regionId: "VFX" },
  { name: "Voices", label: "Voices", Section: "Voices", regionId: "Voices" },
  { name: "WeaponAnimationSetData", label: "Weapon Animation Sets", Section: "WeaponAnimationSetData", regionId: "WeaponAnimationSetData" },
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
    children: [
      {
        name: "_Spells",
        label: "Spells",
        isGroup: true,
        Section: "Spells",
        children: [
          { name: "Spell_Projectile", label: "Projectile", statsFile: "Spell_Projectile.txt", Section: "Spells" },
          { name: "Spell_ProjectileStrike", label: "Projectile Strike", statsFile: "Spell_ProjectileStrike.txt", Section: "Spells" },
          { name: "Spell_Rush", label: "Rush", statsFile: "Spell_Rush.txt", Section: "Spells" },
          { name: "Spell_Shout", label: "Shout", statsFile: "Spell_Shout.txt", Section: "Spells" },
          { name: "Spell_Target", label: "Target", statsFile: "Spell_Target.txt", Section: "Spells" },
          { name: "Spell_Teleportation", label: "Teleportation", statsFile: "Spell_Teleportation.txt", Section: "Spells" },
          { name: "Spell_Throw", label: "Throw", statsFile: "Spell_Throw.txt", Section: "Spells" },
          { name: "Spell_Zone", label: "Zone", statsFile: "Spell_Zone.txt", Section: "Spells" },
        ],
      },
      {
        name: "_Statuses",
        label: "Statuses",
        isGroup: true,
        children: [
          { name: "Status_BOOST", label: "Boost", statsFile: "Status_BOOST.txt" },
          { name: "Status_DEACTIVATED", label: "Deactivated", statsFile: "Status_DEACTIVATED.txt" },
          { name: "Status_DOWNED", label: "Downed", statsFile: "Status_DOWNED.txt" },
          { name: "Status_EFFECT", label: "Effect", statsFile: "Status_EFFECT.txt" },
          { name: "Status_FEAR", label: "Fear", statsFile: "Status_FEAR.txt" },
          { name: "Status_HEAL", label: "Heal", statsFile: "Status_HEAL.txt" },
          { name: "Status_INCAPACITATED", label: "Incapacitated", statsFile: "Status_INCAPACITATED.txt" },
          { name: "Status_INVISIBLE", label: "Invisible", statsFile: "Status_INVISIBLE.txt" },
          { name: "Status_KNOCKED_DOWN", label: "Knocked Down", statsFile: "Status_KNOCKED_DOWN.txt" },
          { name: "Status_POLYMORPHED", label: "Polymorphed", statsFile: "Status_POLYMORPHED.txt" },
          { name: "Status_SNEAKING", label: "Sneaking", statsFile: "Status_SNEAKING.txt" },
        ],
      },
      { name: "Passive", label: "Passives", statsFile: "Passive.txt" },
      { name: "Interrupt", label: "Interrupts", statsFile: "Interrupt.txt" },
      { name: "Armor", label: "Armor", statsFile: "Armor.txt" },
      { name: "Weapon", label: "Weapons", statsFile: "Weapon.txt" },
      { name: "Object", label: "Objects", statsFile: "Object.txt" },
      { name: "Character", label: "Characters", statsFile: "Character.txt" },
      {
        name: "_StatsOther",
        label: "Other Stats",
        isGroup: true,
        children: [
          { name: "BloodTypes", label: "Blood Types", statsFile: "BloodTypes.txt" },
          { name: "CriticalHitTypes", label: "Critical Hit Types", statsFile: "CriticalHitTypes.txt" },
          { name: "ItemColor", label: "Item Colors", statsFile: "ItemColor.txt" },
          { name: "ItemProgressionNames", label: "Item Progression Names", statsFile: "ItemProgressionNames.txt" },
          { name: "ItemProgressionVisuals", label: "Item Progression Visuals", statsFile: "ItemProgressionVisuals.txt" },
          { name: "XPData", label: "XP Data", statsFile: "XPData.txt" },
        ],
      },
    ],
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
              children: [
                {
                  name: "CompatibilityFrameworkConfig",
                  label: "CF Config",
                },
              ],
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
