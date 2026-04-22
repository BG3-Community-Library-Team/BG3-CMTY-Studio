/**
 * Form layout definitions for ManualEntryForm.
 *
 * Controls how fields and booleans are positioned per section:
 * identity extras (below UUID/Label, above HR), subsections with
 * grouped rows, field–boolean pairings, and header-level toggles.
 */

import type { FieldGate } from './statFieldMetadata.js';

// ──────────────── Types ────────────────

export interface LayoutField {
  /** Key in the fields or booleans array */
  key: string;
  /** Whether this is a field, boolean, or empty spacer grid cell */
  type: 'field' | 'boolean' | 'spacer';
  /** Override the display label */
  label?: string;
  /** Show a "Generate random UUID" button beside the label */
  generateUuid?: boolean;
  /** Render as textarea instead of single-line input */
  textarea?: boolean;
  /** Render with a color picker (for UIColor fields). Value stored as #AARRGGBB (BG3 format). */
  colorField?: boolean;
}

export interface LayoutRow {
  /** Fields/booleans to render in this row. Row width is split equally. */
  items: LayoutField[];
  /** Use flex-wrap instead of rigid grid — items wrap to next line on narrow screens */
  wrap?: boolean;
  /** CSS max-width per item when wrap is enabled (e.g. '50%') */
  maxItemWidth?: string;
  /** Custom CSS grid-template-columns (overrides the equal-columns default) */
  gridTemplate?: string;
}

/**
 * A collapsible card rendered inside a subsection tab pane.
 * Multiple non-fullRow cards are laid out side-by-side in a flex row.
 */
export interface LayoutInnerCard {
  /** Card heading text */
  title: string;
  /** CSS flex-basis / width value for side-by-side layout (e.g. '60%', '40%').
   *  Omit for equal flex distribution. */
  width?: string;
  rows: LayoutRow[];
  /** Start collapsed */
  collapsed?: boolean;
  /** Render in its own row below the side-by-side card group (full width) */
  fullRow?: boolean;
  /** Column placement for multi-column stacked card layouts (1 = left, 2 = right) */
  col?: 1 | 2;
  /**
   * Render fields as independent vertical column stacks (no cross-row alignment).
   * Each inner array is one column's fields. When set, `rows` is empty and ignored.
   */
  columnGroups?: LayoutField[][];
  /** Override nav label (used to combine paired side-by-side cards into one FormNav entry) */
  navRowLabel?: string;
  /**
   * Maximum number of columns when rendering rows in this card.
   * Overrides the default cap (2) for fullRow cards.
   */
  maxFieldColumns?: number;
  /**
   * Gate condition: hide this card when the condition is not met
   * (still shown if any field has a value, or showAllStatsFields is on).
   */
  showWhen?: FieldGate;
}

export interface LayoutSubsection {
  /** Section heading text (e.g., "Stats", "Spells") */
  title: string;
  /** Booleans rendered inline in the subsection header */
  headerBooleans?: string[];
  /** Display labels for headerBooleans (keyed by boolean key) */
  headerBooleanLabels?: Record<string, string>;
  rows: LayoutRow[];
  /** String type keys to render inside this subsection (e.g., ["Boosts", "PassivesAdded"]) */
  stringKeys?: string[];
  /** Tag type keys to render inside this subsection (e.g., ["Tags"]) */
  tagKeys?: string[];
  /**
   * Boolean toggles rendered adjacent to a specific string type field.
   * Maps string type key → { boolKey, label }.
   */
  stringAdjacentBooleans?: Record<string, { boolKey: string; label: string }>;
  /**
   * Inline child groups rendered within this subsection (after rows and strings).
   * Same shape as FormLayout.childGroups but rendered inside the subsection body.
   */
  inlineChildGroups?: { title: string; types: string[]; inline?: boolean; columns?: number }[];
  /**
   * Maximum number of grid columns for rows in this subsection.
   * Forces single-item rows to span only `maxFieldColumns` (e.g., half width when set to 2).
   */
  maxFieldColumns?: number;
  /**
   * Custom component name. When set, ManualEntryForm renders the named component
   * instead of the standard rows/strings/children pattern. Only whitelisted names allowed.
   */
  component?: string;
  /** Start collapsed (closed) instead of open */
  collapsed?: boolean;
  /**
   * Collapsible inner cards rendered inside this subsection's tab pane.
   * Non-fullRow cards are laid out side-by-side; fullRow cards get their own row below.
   * When set, `rows` is typically empty (fields live in the cards).
   */
  innerCards?: LayoutInnerCard[];
  /**
   * Field keys rendered as a combined FlagGroupBadges component instead of individual rows.
   * These fields are excluded from normal row layout.
   */
  flagGroupKeys?: string[];
  /**
   * Boolean field keys rendered as toggleable badges inside the FlagGroupBadges component.
   * Uses fieldBoolToggle metadata for on/off values.
   */
  boolFlagKeys?: string[];
}

export interface FormLayout {
  /**
   * Extra rows rendered below UUID/Entry Label, above the horizontal rule.
   * Typically DisplayName + Description.
   */
  identityExtras?: LayoutRow[];
  /** Boolean keys rendered in the Add/Edit Entry header bar */
  headerBooleans?: string[];
  /** Suppress the default horizontal rule after identity fields */
  noDefaultHr?: boolean;
  /** Named subsections with their own headers */
  subsections?: LayoutSubsection[];
  /** Rows rendered in the main body (no subsection heading) */
  rows?: LayoutRow[];
  /**
   * Group child types into named collapsible sections instead of a single
   * "Children" accordion. Each group renders its own `<details>` with the
   * children filtered to the specified types.
   */
  childGroups?: { title: string; types: string[]; inline?: boolean; colorGrid?: boolean; noBorder?: boolean }[];
  /**
   * Keys that the layout system handles. Any field/boolean NOT listed here
   * falls through to the legacy fieldset rendering.
   */
  handledFieldKeys?: string[];
  handledBooleanKeys?: string[];
  /**
   * Boolean keys to render as a stacked column beside the rows area.
   * Creates a 2-column layout: rows on the left, booleans on the right.
   */
  sideColumnBooleans?: string[];
  /**
   * Maximum number of grid columns a row can use when it has fewer items
   * than the column count. E.g. `maxFieldColumns: 2` means a single-field
   * row only spans 2 columns (half width) even in a 4-column grid.
   */
  maxFieldColumns?: number;
  /**
   * When true, remove (red X) buttons are hidden on fieldsets
   * (strings, tags, children). For sections where only one entry
   * per type is expected and removal is confusing.
   */
  noRemoveButtons?: boolean;
  /**
   * Per-node-type layout overrides. Keys are node_id values.
   * When a node type is selected, this layout replaces the base layout.
   */
  nodeTypeLayouts?: Record<string, FormLayout>;
}

// Helper to quickly define a field item
const f = (key: string, opts?: Partial<LayoutField>): LayoutField => ({ key, type: 'field', ...opts });
const b = (key: string, opts?: Partial<LayoutField>): LayoutField => ({ key, type: 'boolean', ...opts });

// ──────────────── Section Layouts ────────────────

const ACTION_RESOURCES: FormLayout = {
  identityExtras: [
    { items: [f('DisplayName', { label: 'Display Name' }), f('Description')] },
  ],
  rows: [
    { items: [f('Name'), f('MaxLevel')] },
    { items: [f('ReplenishType'), f('MaxValue')] },
    { items: [f('DiceType')] },
  ],
  maxFieldColumns: 2,
  sideColumnBooleans: ['IsSpellResource', 'PartyActionResource', 'ShowOnActionResourcePanel', 'UpdatesSpellPowerLevel'],
  handledFieldKeys: ['Name', 'MaxLevel', 'ReplenishType', 'MaxValue', 'DiceType', 'DisplayName', 'Description'],
  handledBooleanKeys: ['IsHidden', 'IsSpellResource', 'PartyActionResource', 'ShowOnActionResourcePanel', 'UpdatesSpellPowerLevel'],
};

const BACKGROUND_GOALS: FormLayout = {
  identityExtras: [
    { items: [f('BackgroundUuid', { label: 'Background UUID' })] },
  ],
  rows: [
    { items: [f('ExperienceReward', { label: 'Experience Reward' }), f('InspirationPoints', { label: 'Inspiration Points' }), f('RewardLevel', { label: 'Reward Level' })] },
  ],
  handledFieldKeys: ['BackgroundUuid', 'ExperienceReward', 'InspirationPoints', 'RewardLevel'],
};

const BACKGROUNDS: FormLayout = {
  noDefaultHr: true,
  identityExtras: [
    { items: [f('DisplayName', { label: 'Display Name' }), f('Description')] },
  ],
  noRemoveButtons: true,
  handledFieldKeys: ['DisplayName', 'Description'],
  handledBooleanKeys: ['Hidden'],
  subsections: [
    {
      title: 'Attributes',
      rows: [],
      stringKeys: ['Passives'],
      tagKeys: ['Tags'],
    },
  ],
};

const CLASS_DESCRIPTIONS: FormLayout = {
  identityExtras: [
    { items: [f('ParentGuid', { label: 'Parent Class' }), f('Name')] },
    { items: [f('DisplayName', { label: 'Display Name' }), f('Description')] },
  ],
  noRemoveButtons: true,
  subsections: [
    {
      title: 'Stats',
      rows: [
        { items: [f('BaseHp'), f('HpPerLevel')] },
        { items: [f('PrimaryAbility'), f('CharacterEquipment', { label: 'Equipment' })] },
        { items: [f('ProgressionTableUUID', { label: 'Progression Table', generateUuid: true })] },
      ],
    },
    {
      title: 'Spells',
      rows: [
        { items: [f('SpellCastingAbility'), f('LearningStrategy')] },
        { items: [f('MulticlassSpellcasterModifier', { label: 'Multiclass Modifier' }), f('SpellList')] },
        { items: [b('CanLearnSpells'), b('MustPrepareSpells'), b('IsDefaultForUseSpellAction', { label: 'Default Spell Action' })] },
      ],
    },
    {
      title: 'Other',
      rows: [
        { items: [f('AnimationSetPriority'), f('SoundClassType')] },
        { items: [f('CharacterCreationPose'), f('VoiceTableUUID', { label: 'Voice Table' })] },
        { items: [b('HasGod')] },
      ],
    },
    {
      title: 'Hotbar',
      rows: [
        { items: [f('ClassHotbarColumns'), f('CommonHotbarColumns'), f('ItemsHotbarColumns')] },
      ],
    },
  ],
  handledFieldKeys: [
    'ParentGuid', 'Name', 'DisplayName', 'Description',
    'BaseHp', 'HpPerLevel', 'PrimaryAbility', 'CharacterEquipment',
    'ProgressionTableUUID', 'SpellCastingAbility', 'LearningStrategy',
    'MulticlassSpellcasterModifier', 'SpellList',
    'AnimationSetPriority', 'SoundClassType', 'CharacterCreationPose', 'VoiceTableUUID',
    'ClassHotbarColumns', 'CommonHotbarColumns', 'ItemsHotbarColumns',
  ],
  handledBooleanKeys: ['CanLearnSpells', 'MustPrepareSpells', 'HasGod', 'IsDefaultForUseSpellAction'],
};

const GODS: FormLayout = {
  noDefaultHr: true,
  identityExtras: [
    { items: [f('DisplayName', { label: 'Display Name' }), f('Description')] },
  ],
  rows: [
    { items: [f('Name')] },
  ],
  maxFieldColumns: 2,
  noRemoveButtons: true,
  childGroups: [
    { title: 'Tags', types: ['Tags'], inline: true, noBorder: true },
  ],
  handledFieldKeys: ['DisplayName', 'Description', 'Name'],
};

const ORIGINS: FormLayout = {
  identityExtras: [
    { items: [f('DisplayName', { label: 'Display Name' }), f('Description')] },
  ],
  headerBooleans: ['AvailableInCharacterCreation'],
  subsections: [
    {
      title: 'Body',
      headerBooleans: ['LockBody', 'AppearanceLocked'],
      maxFieldColumns: 2,
      rows: [
        { items: [f('BodyShape'), f('BodyType')] },
        { items: [f('Identity')] },
        { items: [f('DefaultsTemplate'), f('GlobalTemplate')] },
      ],
    },
    {
      title: 'Race',
      headerBooleans: ['LockRace'],
      rows: [
        { items: [f('RaceUUID', { label: 'Race' }), f('SubRaceUUID', { label: 'Sub-Race' })] },
      ],
    },
    {
      title: 'Class',
      headerBooleans: ['LockClass'],
      rows: [
        { items: [f('ClassUUID', { label: 'Class' }), f('ClassEquipmentOverride', { label: 'Equipment Override' })] },
        { items: [f('GodUUID', { label: 'God' }), f('Background UUID', { label: 'Background' })] },
      ],
    },
    {
      title: 'CC Camera',
      rows: [
        { items: [f('CloseUpA', { label: 'Closeup A' }), f('CloseUpB', { label: 'Closeup B' })] },
      ],
    },
    {
      title: 'Other',
      rows: [
        { items: [f('ExcludesOriginUUID', { label: 'Excludes Origin' }), f('IntroDialogUUID', { label: 'Intro Dialog' })] },
        { items: [f('VoiceTableUUID', { label: 'Voice Table' })] },
      ],
    },
  ],
  handledFieldKeys: [
    'DisplayName', 'Description',
    'BodyShape', 'BodyType', 'Identity', 'DefaultsTemplate', 'GlobalTemplate',
    'RaceUUID', 'SubRaceUUID',
    'ClassUUID', 'ClassEquipmentOverride', 'GodUUID', 'Background UUID',
    'CloseUpA', 'CloseUpB',
    'ExcludesOriginUUID', 'IntroDialogUUID', 'VoiceTableUUID',
  ],
  noRemoveButtons: true,
  handledBooleanKeys: ['AvailableInCharacterCreation', 'AppearanceLocked', 'IsHenchman', 'LockBody', 'LockRace', 'LockClass'],
};

const RACES: FormLayout = {
  identityExtras: [
    { items: [f('ParentGuid', { label: 'Parent Race' }), f('Name')] },
    { items: [f('DisplayName', { label: 'Display Name' }), f('Description')] },
  ],
  subsections: [
    {
      title: 'Race Details',
      rows: [
        { items: [f('RaceEquipment', { label: 'Equipment' }), f('DisplayTypeUUID', { label: 'Display Type' }), f('RaceSoundSwitch', { label: 'Sound Switch' })], wrap: true, maxItemWidth: '50%' },
      ],
      inlineChildGroups: [
        { title: 'Gods & Excluded Gods', types: ['Gods', 'ExcludedGods'], inline: true, columns: 2 },
        { title: 'Visuals', types: ['Visuals'], inline: true },
      ],
    },
    {
      title: 'Race Progressions',
      rows: [],
      component: 'RaceProgressionPanel',
      collapsed: true,
    },
  ],
  noRemoveButtons: true,
  childGroups: [
    { title: 'Colors', types: ['EyeColors', 'SkinColors', 'HairColors', 'TattooColors', 'MakeupColors', 'LipsMakeupColors', 'HairGrayingColors', 'HairHighlightColors', 'HornColors', 'HornTipColors'], colorGrid: true },
  ],
  handledFieldKeys: ['ParentGuid', 'Name', 'DisplayName', 'Description',
    'ProgressionTableUUID', 'RaceEquipment', 'DisplayTypeUUID', 'RaceSoundSwitch'],
};

const TAGS: FormLayout = {
  rows: [
    { items: [f('Description', { textarea: true }), f('Name')] },
    { items: [f('DisplayDescription', { label: 'Display Description' }), f('DisplayName', { label: 'Display Name' })] },
    { items: [f('Icon')] },
  ],
  handledFieldKeys: ['DisplayName', 'Name', 'DisplayDescription', 'Description', 'Icon'],
};

const FEAT_DESCRIPTIONS: FormLayout = {
  rows: [
    { items: [f('DisplayName', { label: 'Display Name' }), f('Description')] },
    { items: [f('FeatId', { label: 'Feat ID' }), f('ExactMatch', { label: 'Exact Match' })] },
  ],
  handledFieldKeys: ['DisplayName', 'Description', 'FeatId', 'ExactMatch'],
};

const CC_PRESETS: FormLayout = {
  noDefaultHr: true,
  nodeTypeLayouts: {
    CharacterCreationPreset: {
      subsections: [
        {
          title: 'Body',
          rows: [
            { items: [b('BodyShape'), b('BodyType')] },
          ],
        },
        {
          title: 'Template',
          rows: [
            { items: [f('DefaultsTemplate', { label: 'Defaults Template' }), f('RootTemplate', { label: 'Root Template' })] },
          ],
        },
        {
          title: 'Race',
          rows: [
            { items: [f('RaceUUID', { label: 'Race' }), f('SubRaceUUID', { label: 'Sub-Race' })] },
          ],
        },
        {
          title: 'Other',
          rows: [
            { items: [f('VOLinesTableUUID', { label: 'VO Lines Table' })] },
          ],
        },
      ],
      handledFieldKeys: ['DefaultsTemplate', 'RootTemplate', 'RaceUUID', 'SubRaceUUID', 'VOLinesTableUUID'],
      handledBooleanKeys: ['BodyShape', 'BodyType'],
    },
    CharacterCreationAccessorySet: {
      identityExtras: [
        { items: [f('DisplayName', { label: 'Display Name' })] },
      ],
      rows: [
        { items: [f('CharacterUUID', { label: 'Character' }), f('VisualUUID', { label: 'Visual' })] },
        { items: [f('SlotName', { label: 'Slot Name' }), f('RaceUUID', { label: 'Race' })] },
      ],
      handledFieldKeys: ['DisplayName', 'CharacterUUID', 'VisualUUID', 'SlotName', 'RaceUUID'],
    },
    CharacterCreationEyeColor: {
      identityExtras: [
        { items: [f('DisplayName', { label: 'Display Name' })] },
      ],
      rows: [
        { items: [f('UIColor', { label: 'Color', colorField: true }), f('SkinColorUUID', { label: 'Skin Color' })] },
      ],
      handledFieldKeys: ['DisplayName', 'UIColor', 'SkinColorUUID'],
    },
    CharacterCreationSkinColor: {
      identityExtras: [
        { items: [f('DisplayName', { label: 'Display Name' })] },
      ],
      rows: [
        { items: [f('UIColor', { label: 'Color', colorField: true })] },
      ],
      handledFieldKeys: ['DisplayName', 'UIColor'],
    },
    CharacterCreationHairColor: {
      identityExtras: [
        { items: [f('DisplayName', { label: 'Display Name' })] },
      ],
      rows: [
        { items: [f('UIColor', { label: 'Color', colorField: true })] },
      ],
      handledFieldKeys: ['DisplayName', 'UIColor'],
    },
  },
};

const PROGRESSIONS: FormLayout = {
  identityExtras: [
    { items: [f('TableUUID', { label: 'Table UUID' }), f('Name'), f('Level')] },
  ],
  headerBooleans: ['IsMulticlass'],
  noRemoveButtons: true,
  subsections: [
    {
      title: 'Boosts',
      rows: [],
      stringKeys: ['Boosts', 'PassivesAdded', 'PassivesRemoved'],
      stringAdjacentBooleans: {
        Boosts: { boolKey: 'AllowImprovement', label: 'Grant Feat?' },
      },
    },
  ],
  childGroups: [
    { title: 'Subclasses', types: ['Subclasses'], inline: true },
  ],
  handledFieldKeys: ['TableUUID', 'Name', 'Level'],
  handledBooleanKeys: ['IsMulticlass', 'AllowImprovement'],
};

const FEATS: FormLayout = {
  headerBooleans: ['CanBeTakenMultipleTimes'],
  noRemoveButtons: true,
  rows: [
    { items: [f('Requirements')] },
  ],
  subsections: [
    {
      title: 'Boosts',
      rows: [],
      stringKeys: ['Boosts', 'PassivesAdded'],
      stringAdjacentBooleans: {
        Boosts: { boolKey: 'AllowImprovement', label: 'Grant Feat?' },
      },
    },
  ],
  handledFieldKeys: ['Requirements'],
  handledBooleanKeys: ['CanBeTakenMultipleTimes', 'AllowImprovement'],
};

const COLOR_DEFINITIONS: FormLayout = {
  rows: [
    { items: [f('DisplayName', { label: 'Display Name' }), f('UIColor', { label: 'Color', colorField: true })] },
  ],
  handledFieldKeys: ['DisplayName', 'UIColor'],
};

// ──────────────── Export Map ────────────────

// ──────────────── Simple LSX Sections ────────────────

const VOICES: FormLayout = {
  identityExtras: [
    { items: [f('DisplayName', { label: 'Display Name' })] },
  ],
  rows: [
    { items: [f('SpeakerUUID', { label: 'Speaker' }), f('TableUUID', { label: 'Voice Table' })] },
    { items: [f('BodyType', { label: 'Body Type' })] },
  ],
  maxFieldColumns: 2,
  noRemoveButtons: true,
  childGroups: [
    { title: 'Tags', types: ['Tags'], inline: true, noBorder: true },
  ],
  handledFieldKeys: ['DisplayName', 'SpeakerUUID', 'TableUUID', 'BodyType'],
};

const LEVELMAPS: FormLayout = {
  rows: [
    { items: [f('Name'), f('Level')] },
    { items: [f('Value'), f('DamageMin', { label: 'Damage Min' }), f('DamageMax', { label: 'Damage Max' })] },
  ],
  handledFieldKeys: ['Name', 'Level', 'Value', 'DamageMin', 'DamageMax'],
};

const EQUIPMENT_TYPES: FormLayout = {
  rows: [
    { items: [f('Name'), f('Slot')] },
  ],
  handledFieldKeys: ['Name', 'Slot'],
};

const SHAPESHIFT: FormLayout = {
  rows: [
    { items: [f('Name')] },
    { items: [f('SourceType', { label: 'Source Type' }), f('TargetType', { label: 'Target Type' })] },
  ],
  handledFieldKeys: ['Name', 'SourceType', 'TargetType'],
};

const COMPANION_PRESETS: FormLayout = {
  identityExtras: [
    { items: [f('DisplayName', { label: 'Display Name' })] },
  ],
  handledFieldKeys: ['DisplayName'],
  nodeTypeLayouts: {
    CompanionPreset: {
      identityExtras: [
        { items: [f('DisplayName', { label: 'Display Name' })] },
      ],
      rows: [
        { items: [f('RaceUUID', { label: 'Race' }), f('SubRaceUUID', { label: 'Sub-Race' })] },
        { items: [f('VOLinesTableUUID', { label: 'VO Lines Table' }), f('VoiceTableUUID', { label: 'Voice Table' })] },
        { items: [f('RootTemplate', { label: 'Root Template' })] },
      ],
      sideColumnBooleans: ['BodyShape', 'BodyType'],
      handledFieldKeys: ['DisplayName', 'RaceUUID', 'SubRaceUUID', 'VOLinesTableUUID', 'VoiceTableUUID', 'RootTemplate'],
      handledBooleanKeys: ['BodyShape', 'BodyType'],
    },
  },
};

const ROOT_TEMPLATES: FormLayout = {
  identityExtras: [
    { items: [f('DisplayName', { label: 'Display Name' }), f('Name')] },
  ],
  subsections: [
    {
      title: 'General',
      rows: [
        { items: [f('Type'), f('Stats'), f('SpellSet', { label: 'Spell Set' })], wrap: true, maxItemWidth: '50%' },
        { items: [f('Equipment'), f('Icon')] },
        { items: [f('LevelName', { label: 'Level Name' })] },
      ],
    },
    {
      title: 'Templates & Visuals',
      rows: [
        { items: [f('ParentTemplateId', { label: 'Parent Template', generateUuid: false }), f('Race')] },
        { items: [f('VisualTemplate', { label: 'Visual Template' }), f('PhysicsTemplate', { label: 'Physics Template' })] },
        { items: [f('CharacterVisualResourceID', { label: 'Character Visual Resource' })] },
      ],
    },
    {
      title: 'Boosts & Passives',
      rows: [
        { items: [f('DefaultBoosts', { label: 'Default Boosts', textarea: true })] },
        { items: [f('DefaultPassives', { label: 'Default Passives', textarea: true })] },
      ],
    },
  ],
  sideColumnBooleans: ['IsGlobal', 'Flag', 'IsEquipable'],
  noRemoveButtons: true,
  childGroups: [
    { title: 'Tags', types: ['Tags'], inline: true },
    { title: 'Inventory', types: ['InventoryList'], inline: true },
    { title: 'On Death Actions', types: ['OnDeathActions'], inline: true },
  ],
  handledFieldKeys: [
    'DisplayName', 'Name', 'Type', 'Stats', 'SpellSet', 'Equipment', 'Icon',
    'ParentTemplateId', 'VisualTemplate', 'PhysicsTemplate', 'Race',
    'CharacterVisualResourceID', 'LevelName', 'DefaultBoosts', 'DefaultPassives',
  ],
  handledBooleanKeys: ['IsGlobal', 'Flag', 'IsEquipable'],
};

export const FORM_LAYOUTS: Record<string, FormLayout> = {
  ActionResources: ACTION_RESOURCES,
  BackgroundGoals: BACKGROUND_GOALS,
  Backgrounds: BACKGROUNDS,
  ClassDescriptions: CLASS_DESCRIPTIONS,
  ColorDefinitions: COLOR_DEFINITIONS,
  CompanionPresets: COMPANION_PRESETS,
  EquipmentTypes: EQUIPMENT_TYPES,
  Gods: GODS,
  Levelmaps: LEVELMAPS,
  Origins: ORIGINS,
  Progressions: PROGRESSIONS,
  Feats: FEATS,
  Races: RACES,
  RootTemplates: ROOT_TEMPLATES,
  Shapeshift: SHAPESHIFT,
  Tags: TAGS,
  FeatDescriptions: FEAT_DESCRIPTIONS,
  CharacterCreationPresets: CC_PRESETS,
  Voices: VOICES,
};
