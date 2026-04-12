import type { CompletionPlugin, CompletionContext, CompletionItem } from './completionTypes.js';

const STRUCTURE_KEYWORDS: CompletionItem[] = [
  { label: 'new', insertText: 'new', detail: 'New entry', kind: 'keyword' },
  { label: 'entry', insertText: 'entry', detail: 'Entry declaration', kind: 'keyword' },
  { label: 'equipment', insertText: 'equipment', detail: 'Equipment declaration', kind: 'keyword' },
  { label: 'type', insertText: 'type', detail: 'Type declaration', kind: 'keyword' },
  { label: 'using', insertText: 'using', detail: 'Inherit from entry', kind: 'keyword' },
  { label: 'data', insertText: 'data', detail: 'Data field', kind: 'keyword' },
];

const ENTRY_TYPES: CompletionItem[] = [
  { label: 'SpellData', insertText: 'SpellData', detail: 'Entry type', kind: 'keyword' },
  { label: 'StatusData', insertText: 'StatusData', detail: 'Entry type', kind: 'keyword' },
  { label: 'PassiveData', insertText: 'PassiveData', detail: 'Entry type', kind: 'keyword' },
  { label: 'Armor', insertText: 'Armor', detail: 'Entry type', kind: 'keyword' },
  { label: 'Weapon', insertText: 'Weapon', detail: 'Entry type', kind: 'keyword' },
  { label: 'Object', insertText: 'Object', detail: 'Entry type', kind: 'keyword' },
  { label: 'Character', insertText: 'Character', detail: 'Entry type', kind: 'keyword' },
  { label: 'CriticalHitTypeData', insertText: 'CriticalHitTypeData', detail: 'Entry type', kind: 'keyword' },
  { label: 'InterruptData', insertText: 'InterruptData', detail: 'Entry type', kind: 'keyword' },
  { label: 'SpellMetaConditionData', insertText: 'SpellMetaConditionData', detail: 'Entry type', kind: 'keyword' },
];

const DATA_FIELDS: CompletionItem[] = [
  { label: 'DisplayName', insertText: 'DisplayName', detail: 'Stats field', kind: 'property' },
  { label: 'Description', insertText: 'Description', detail: 'Stats field', kind: 'property' },
  { label: 'Icon', insertText: 'Icon', detail: 'Stats field', kind: 'property' },
  { label: 'Level', insertText: 'Level', detail: 'Stats field', kind: 'property' },
  { label: 'SpellType', insertText: 'SpellType', detail: 'Stats field', kind: 'property' },
  { label: 'Damage', insertText: 'Damage', detail: 'Stats field', kind: 'property' },
  { label: 'DamageType', insertText: 'DamageType', detail: 'Stats field', kind: 'property' },
  { label: 'SpellProperties', insertText: 'SpellProperties', detail: 'Stats field', kind: 'property' },
  { label: 'SpellFlags', insertText: 'SpellFlags', detail: 'Stats field', kind: 'property' },
  { label: 'Requirements', insertText: 'Requirements', detail: 'Stats field', kind: 'property' },
  { label: 'Boosts', insertText: 'Boosts', detail: 'Stats field', kind: 'property' },
  { label: 'PassivesOnEquip', insertText: 'PassivesOnEquip', detail: 'Stats field', kind: 'property' },
  { label: 'StatusType', insertText: 'StatusType', detail: 'Stats field', kind: 'property' },
  { label: 'StackId', insertText: 'StackId', detail: 'Stats field', kind: 'property' },
  { label: 'StackType', insertText: 'StackType', detail: 'Stats field', kind: 'property' },
  { label: 'StatusGroups', insertText: 'StatusGroups', detail: 'Stats field', kind: 'property' },
  { label: 'ArmorClass', insertText: 'ArmorClass', detail: 'Stats field', kind: 'property' },
  { label: 'ArmorType', insertText: 'ArmorType', detail: 'Stats field', kind: 'property' },
  { label: 'Slot', insertText: 'Slot', detail: 'Stats field', kind: 'property' },
  { label: 'Proficiency Group', insertText: 'Proficiency Group', detail: 'Stats field', kind: 'property' },
  { label: 'DescriptionParams', insertText: 'DescriptionParams', detail: 'Stats field', kind: 'property' },
  { label: 'ExtraDescription', insertText: 'ExtraDescription', detail: 'Stats field', kind: 'property' },
  { label: 'TooltipDamageList', insertText: 'TooltipDamageList', detail: 'Stats field', kind: 'property' },
  { label: 'TooltipStatusApply', insertText: 'TooltipStatusApply', detail: 'Stats field', kind: 'property' },
  { label: 'SpellSchool', insertText: 'SpellSchool', detail: 'Stats field', kind: 'property' },
  { label: 'CooldownType', insertText: 'CooldownType', detail: 'Stats field', kind: 'property' },
  { label: 'Cooldown', insertText: 'Cooldown', detail: 'Stats field', kind: 'property' },
  { label: 'UseCosts', insertText: 'UseCosts', detail: 'Stats field', kind: 'property' },
  { label: 'SpellContainerID', insertText: 'SpellContainerID', detail: 'Stats field', kind: 'property' },
  { label: 'RootSpellID', insertText: 'RootSpellID', detail: 'Stats field', kind: 'property' },
  { label: 'SpellActionType', insertText: 'SpellActionType', detail: 'Stats field', kind: 'property' },
];

const DAMAGE_TYPES: CompletionItem[] = [
  { label: 'Bludgeoning', insertText: 'Bludgeoning', detail: 'Enum value', kind: 'variable' },
  { label: 'Piercing', insertText: 'Piercing', detail: 'Enum value', kind: 'variable' },
  { label: 'Slashing', insertText: 'Slashing', detail: 'Enum value', kind: 'variable' },
  { label: 'Fire', insertText: 'Fire', detail: 'Enum value', kind: 'variable' },
  { label: 'Cold', insertText: 'Cold', detail: 'Enum value', kind: 'variable' },
  { label: 'Lightning', insertText: 'Lightning', detail: 'Enum value', kind: 'variable' },
  { label: 'Thunder', insertText: 'Thunder', detail: 'Enum value', kind: 'variable' },
  { label: 'Poison', insertText: 'Poison', detail: 'Enum value', kind: 'variable' },
  { label: 'Acid', insertText: 'Acid', detail: 'Enum value', kind: 'variable' },
  { label: 'Necrotic', insertText: 'Necrotic', detail: 'Enum value', kind: 'variable' },
  { label: 'Radiant', insertText: 'Radiant', detail: 'Enum value', kind: 'variable' },
  { label: 'Psychic', insertText: 'Psychic', detail: 'Enum value', kind: 'variable' },
  { label: 'Force', insertText: 'Force', detail: 'Enum value', kind: 'variable' },
];

const SPELL_TYPES: CompletionItem[] = [
  { label: 'Zone', insertText: 'Zone', detail: 'Enum value', kind: 'variable' },
  { label: 'Projectile', insertText: 'Projectile', detail: 'Enum value', kind: 'variable' },
  { label: 'Target', insertText: 'Target', detail: 'Enum value', kind: 'variable' },
  { label: 'Rush', insertText: 'Rush', detail: 'Enum value', kind: 'variable' },
  { label: 'Shout', insertText: 'Shout', detail: 'Enum value', kind: 'variable' },
  { label: 'Throw', insertText: 'Throw', detail: 'Enum value', kind: 'variable' },
  { label: 'Wall', insertText: 'Wall', detail: 'Enum value', kind: 'variable' },
  { label: 'Storm', insertText: 'Storm', detail: 'Enum value', kind: 'variable' },
];

const ALL_ENUM_VALUES = [...DAMAGE_TYPES, ...SPELL_TYPES];

function filterByPrefix(items: CompletionItem[], prefix: string): CompletionItem[] {
  const lower = prefix.toLowerCase();
  return items.filter(item => item.label.toLowerCase().startsWith(lower));
}

/**
 * Detect which context we're in based on line content:
 * - after `type "` → entry types
 * - after `data "` and before closing `"` → data fields
 * - on a data line past the field name (two `"` sections) → enum values
 */
function detectContext(line: string): 'type' | 'data-field' | 'data-value' | 'general' {
  const trimmed = line.trimStart();
  if (/^type\s+"[^"]*$/i.test(trimmed)) return 'type';
  if (/^(using|type)\s+"/.test(trimmed)) return 'type';
  if (/^data\s+"[^"]*$/i.test(trimmed)) return 'data-field';
  // data "FieldName" "... ← we're in the value portion
  if (/^data\s+"[^"]*"\s+"[^"]*$/i.test(trimmed)) return 'data-value';
  return 'general';
}

export const statsPlugin: CompletionPlugin = {
  id: 'bg3-stats',
  name: 'BG3 Stats',
  languages: ['stats'],
  priority: 50,
  getCompletions(ctx: CompletionContext): CompletionItem[] {
    const prefix = ctx.typedPrefix;
    if (!prefix || prefix.length < 2) return [];

    const context = detectContext(ctx.lineTextBeforeCursor);

    switch (context) {
      case 'type':
        return filterByPrefix(ENTRY_TYPES, prefix);
      case 'data-field':
        return filterByPrefix(DATA_FIELDS, prefix);
      case 'data-value': {
        // Try to figure out which field we're in to offer relevant enum values
        const fieldMatch = ctx.lineTextBeforeCursor.match(/^data\s+"([^"]+)"/i);
        const fieldName = fieldMatch?.[1]?.toLowerCase();
        if (fieldName === 'damagetype') return filterByPrefix(DAMAGE_TYPES, prefix);
        if (fieldName === 'spelltype') return filterByPrefix(SPELL_TYPES, prefix);
        return filterByPrefix(ALL_ENUM_VALUES, prefix);
      }
      default:
        return filterByPrefix(STRUCTURE_KEYWORDS, prefix);
    }
  },
};
