// ── IPC Error Types ──

/** Error kinds returned by backend IPC commands. */
export type ErrorKind =
  | "NotFound"
  | "InvalidInput"
  | "IoError"
  | "ParseError"
  | "CacheError"
  | "SecurityViolation"
  | "TaskPanicked"
  | "Timeout"
  | "Internal";

/** Structured error returned by backend IPC commands. */
export interface AppError {
  kind: ErrorKind;
  message: string;
}

/** Type guard: checks if an unknown error is a structured AppError from the backend. */
export function isAppError(err: unknown): err is AppError {
  return (
    typeof err === "object" &&
    err !== null &&
    "kind" in err &&
    "message" in err &&
    typeof (err as AppError).message === "string"
  );
}

/** Extract a human-readable message from any error (structured AppError or plain string). */
export function getErrorMessage(err: unknown): string {
  if (isAppError(err)) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}

// ── Data Types ──

export interface LsxAttribute {
  attr_type: string;
  value: string;
}

export interface LsxChildGroup {
  group_id: string;
  entries: LsxChildEntry[];
}

export interface LsxChildEntry {
  node_id: string;
  object_guid: string;
}

export interface MetaDependency {
  uuid: string;
  name: string;
  folder: string;
  md5: string;
  version64: string;
}

export interface ModMeta {
  uuid: string;
  folder: string;
  name: string;
  author: string;
  version?: string;
  version64: string;
  description: string;
  md5: string;
  mod_type: string;
  tags: string;
  num_players: string;
  gm_template: string;
  char_creation_level: string;
  lobby_level: string;
  menu_level: string;
  startup_level: string;
  photo_booth: string;
  main_menu_bg_video: string;
  publish_version: string;
  target_mode: string;
  dependencies: MetaDependency[];
}

export type { Section } from "./generated/Section.js";
export type { SectionInfo } from "./generated/SectionInfo.js";
export type { ChildTableInfo } from "./generated/ChildTableInfo.js";
import type { Section } from "./generated/Section.js";

/** All sections in canonical order (CF-eligible first, then extended). */
export const SECTIONS_ORDERED: Section[] = [
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
  // Additional LSX data sections
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
  "TextureAtlasInfo",
  "IconUVList",
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
  "ProgressionDescriptions",
  "CompanionPresets",
  "SpellLists",
  "SkillLists",
  "PassiveLists",
  "EquipmentLists",
  "AbilityLists",
  "ExperienceRewards",
  "GoldValues",
  "DeathEffects",
  "SpeakerGroups",
  "Gossips",
];

/**
 * Core sections extracted during initial vanilla unpack.
 * These provide the data needed for CF-eligible config generation and combobox population.
 */
export const CORE_SECTIONS: Section[] = [
  "ActionResources",
  "ActionResourceGroups",
  "Backgrounds",
  "BackgroundGoals",
  "CharacterCreation",
  "CharacterCreationPresets",
  "ClassDescriptions",
  "ColorDefinitions",
  "FeatDescriptions",
  "Feats",
  "Gods",
  "Lists",
  "Origins",
  "Progressions",
  "Races",
  "RootTemplates",
  "Spells",
  "Tags",
  "Visuals",
  "Voices",
];

/** Check if a section is part of the core extraction set. */
export function isCoreSection(section: Section): boolean {
  return (CORE_SECTIONS as string[]).includes(section);
}

/** Only CF-eligible sections (the original 11). Retained for backward compat; will be removed. */
export const CF_ELIGIBLE_SECTIONS: Section[] = [];

/** @deprecated CF-eligible functionality is out of scope — always returns false. */
export function isCfEligible(_section: Section): boolean {
  return false;
}

/** Display name overrides for section keys that don't humanize cleanly. */
const DISPLAY_NAME_OVERRIDES: Record<string, string> = {
  BackgroundGoals: "Background Goals",
  ActionResources: "Action Resources",
  ActionResourceGroups: "Action Resource Groups",
  ClassDescriptions: "Class Descriptions",
  CharacterCreation: "Character Creation",
  CharacterCreationPresets: "Character Creation Presets",
  ColorDefinitions: "Color Definitions",
  FeatDescriptions: "Feat Descriptions",
  AnimationOverrides: "Animation Overrides",
  CinematicArenaFrequencyGroups: "Cinematic Arena Groups",
  CombatCameraGroups: "Combat Camera Groups",
  CustomDice: "Custom Dice",
  DefaultValues: "Default Values",
  DifficultyClasses: "Difficulty Classes",
  EquipmentTypes: "Equipment Types",
  FixedHotBarSlots: "Fixed Hotbar Slots",
  ItemThrowParams: "Item Throw Params",
  LimbsMapping: "Limbs Mapping",
  MultiEffectInfos: "Multi-Effect Infos",
  ProjectileDefaults: "Projectile Defaults",
  RandomCasts: "Random Casts",
  RootTemplates: "Root Templates",
  SpellMetadata: "Spell Metadata",
  StatusMetadata: "Status Metadata",
  TooltipExtras: "Tooltip Extras",
  TrajectoryRules: "Trajectory Rules",
  WeaponAnimationSetData: "Weapon Animation Sets",
  ErrorDescriptions: "Error Descriptions",
  ProgressionDescriptions: "Progression Descriptions",
  CompanionPresets: "Companion Presets",
  SpellLists: "Spell Lists",
  SkillLists: "Skill Lists",
  PassiveLists: "Passive Lists",
  EquipmentLists: "Equipment Lists",
  AbilityLists: "Ability Lists",
  ExperienceRewards: "Experience Rewards",
  GoldValues: "Gold Values",
  DeathEffects: "Death Effects",
  SpeakerGroups: "Speaker Groups",
  ProgressionTables: "Progression Tables",
  VoiceTables: "Voice Tables",
  TextureAtlasInfo: "Texture Atlas",
};

/**
 * Get human-readable display name for any section key.
 * Uses overrides for special cases; falls back to CamelCase → "Camel Case" humanization.
 */
export function getSectionDisplayName(section: string): string {
  const override = DISPLAY_NAME_OVERRIDES[section];
  if (override) return override;
  // Humanize CamelCase: insert space before each uppercase letter preceded by lowercase
  return section
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
}

/**
 * Legacy lookup object — proxied to getSectionDisplayName for backward compatibility.
 * Components that index `SECTION_DISPLAY_NAMES[section]` continue to work.
 */
export const SECTION_DISPLAY_NAMES: Record<string, string> = new Proxy(
  {} as Record<string, string>,
  { get: (_target, prop) => (typeof prop === "string" ? getSectionDisplayName(prop) : undefined) },
);

export type ChangeType =
  | "StringAdded"
  | "StringRemoved"
  | "SelectorAdded"
  | "SelectorRemoved"
  | "BooleanChanged"
  | "FieldChanged"
  | "ChildAdded"
  | "ChildRemoved"
  | "SpellFieldChanged"
  | "EntireEntryNew";

export type EntryKind = "Modified" | "New" | "Vanilla";

export interface Change {
  change_type: ChangeType;
  field: string;
  added_values: string[];
  removed_values: string[];
  vanilla_value: string | null;
  mod_value: string | null;
}

export interface DiffEntry {
  uuid: string;
  display_name: string;
  source_file: string;
  entry_kind: EntryKind;
  changes: Change[];
  /** The LSX node_id for this entry (e.g. "SpellList", "PassiveList", "Progression"). */
  node_id: string;
  /** The LSX region ID this entry belongs to (e.g. "AnimationBank", "GameplayVFXs"). */
  region_id: string;
  /** Raw attributes from the mod's LSX entry (key → value). */
  raw_attributes: Record<string, string>;
  /** LSX attribute types for each raw_attribute key (key → type string, e.g. "FixedString", "guid"). */
  raw_attribute_types: Record<string, string>;
  /** Raw children groups from the mod's LSX entry (group_id → list of object GUIDs). */
  raw_children: Record<string, string[]>;
  /** True if this entry was commented out in the source .lsx file. */
  commented?: boolean;
}

export interface SectionResult {
  section: Section;
  entries: DiffEntry[];
}

export interface ScanResult {
  mod_meta: ModMeta;
  sections: SectionResult[];
  existing_config_path: string | null;
}

export interface SelectedEntry {
  section: Section;
  uuid: string;
  display_name: string;
  changes: Change[];
  manual: boolean;
  /** For Lists entries: the actual list type (e.g. "SpellList", "PassiveList"). */
  list_type?: string;
  /** Raw attributes for EntireEntryNew entries (from LSX scan). */
  raw_attributes?: Record<string, string>;
  /** Raw children groups for EntireEntryNew entries. */
  raw_children?: Record<string, string[]>;
  /** LSX attribute types for each raw_attribute key (e.g. "guid", "FixedString"). */
  raw_attribute_types?: Record<string, string>;
  /** The staging DB table name (e.g. "lsx__RootTemplates", "stats__Armor"). */
  table_name?: string;
}

/** Lightweight vanilla entry info for combobox population. */
export interface VanillaEntryInfo {
  uuid: string;
  display_name: string;
  /** The LSX node_id, e.g. "SpellList", "ActionResourceDefinition". */
  node_id: string;
  /** Optional CSS hex color string (e.g. "#RRGGBBAA") for color swatch display. */
  color?: string;
  /** Optional parent GUID (e.g. ParentGuid for Race entries). */
  parent_guid?: string;
  /** Loca handle from a Text (TranslatedString) attribute (e.g. TooltipExtraTexts, TooltipUpcastDescriptions). */
  text_handle?: string;
}

export type OutputFormat = "Yaml" | "Json";

export interface SerializeOptions {
  format: OutputFormat;
  use_anchors: boolean;
  include_comments: boolean;
}

export interface AnchorGroup {
  anchor_name: string;
  shared_changes: Change[];
  entry_uuids: string[];
  lines_saved: number;
}

export interface ManualEntry {
  section: string;
  fields: Record<string, string>;
  /** True if this entry was imported from an existing config file (not manually created). */
  imported?: boolean;
  /** Optional YAML comment line above this entry (only emitted when entry comments are enabled). */
  comment?: string;
}

export interface EditOverride {
  /** section::entryId key */
  key: string;
  section: string;
  entryId: string;
  field: string;
  value: string;
}

/** A single <content> line inside a localization XML file. */
export interface LocaValue {
  id: string;
  contentuid: string;
  version: number;
  text: string;
}

/** A localization file entry — label becomes the XML filename. */
export interface LocaFileEntry {
  id: string;
  label: string;
  values: LocaValue[];
}

export * from "./entryRow.js";
