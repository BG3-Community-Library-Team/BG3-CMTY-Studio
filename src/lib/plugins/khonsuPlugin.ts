import type { CompletionPlugin, CompletionContext, CompletionItem } from './completionTypes.js';

const CONDITION_FUNCTIONS: CompletionItem[] = [
  { label: 'ConditionResult', insertText: 'ConditionResult()', detail: 'Condition function', kind: 'function' },
  { label: 'HasPassive', insertText: 'HasPassive()', detail: 'Condition function', kind: 'function' },
  { label: 'HasStatus', insertText: 'HasStatus()', detail: 'Condition function', kind: 'function' },
  { label: 'HasAppliedStatus', insertText: 'HasAppliedStatus()', detail: 'Condition function', kind: 'function' },
  { label: 'HasSpell', insertText: 'HasSpell()', detail: 'Condition function', kind: 'function' },
  { label: 'IsClass', insertText: 'IsClass()', detail: 'Condition function', kind: 'function' },
  { label: 'HasFlag', insertText: 'HasFlag()', detail: 'Condition function', kind: 'function' },
  { label: 'Tagged', insertText: 'Tagged()', detail: 'Condition function', kind: 'function' },
  { label: 'GetDistanceTo', insertText: 'GetDistanceTo()', detail: 'Condition function', kind: 'function' },
  { label: 'WieldingWeapon', insertText: 'WieldingWeapon()', detail: 'Condition function', kind: 'function' },
  { label: 'SpellId', insertText: 'SpellId()', detail: 'Condition function', kind: 'function' },
  { label: 'IsSpellOfSchool', insertText: 'IsSpellOfSchool()', detail: 'Condition function', kind: 'function' },
  { label: 'HasSpellFlag', insertText: 'HasSpellFlag()', detail: 'Condition function', kind: 'function' },
  { label: 'HasUseCosts', insertText: 'HasUseCosts()', detail: 'Condition function', kind: 'function' },
  { label: 'HasFunctor', insertText: 'HasFunctor()', detail: 'Condition function', kind: 'function' },
  { label: 'Distance', insertText: 'Distance()', detail: 'Condition function', kind: 'function' },
  { label: 'Self', insertText: 'Self()', detail: 'Condition function', kind: 'function' },
  { label: 'Ally', insertText: 'Ally()', detail: 'Condition function', kind: 'function' },
  { label: 'Enemy', insertText: 'Enemy()', detail: 'Condition function', kind: 'function' },
  { label: 'Character', insertText: 'Character()', detail: 'Condition function', kind: 'function' },
  { label: 'Item', insertText: 'Item()', detail: 'Condition function', kind: 'function' },
  { label: 'Dead', insertText: 'Dead()', detail: 'Condition function', kind: 'function' },
  { label: 'HasActionResource', insertText: 'HasActionResource()', detail: 'Condition function', kind: 'function' },
  { label: 'GetLevel', insertText: 'GetLevel()', detail: 'Condition function', kind: 'function' },
  { label: 'GetBaseAbility', insertText: 'GetBaseAbility()', detail: 'Condition function', kind: 'function' },
  { label: 'StatusGetDescriptionParam', insertText: 'StatusGetDescriptionParam()', detail: 'Condition function', kind: 'function' },
  { label: 'HasProficiency', insertText: 'HasProficiency()', detail: 'Condition function', kind: 'function' },
  { label: 'GetAbilityModifier', insertText: 'GetAbilityModifier()', detail: 'Condition function', kind: 'function' },
  { label: 'GetProficiencyBonus', insertText: 'GetProficiencyBonus()', detail: 'Condition function', kind: 'function' },
  { label: 'IsInCombat', insertText: 'IsInCombat()', detail: 'Condition function', kind: 'function' },
  { label: 'HasAnyStatus', insertText: 'HasAnyStatus()', detail: 'Condition function', kind: 'function' },
];

const CONTEXT_ACCESSORS: CompletionItem[] = [
  { label: 'context.Source', insertText: 'context.Source', detail: 'Context', kind: 'property' },
  { label: 'context.Target', insertText: 'context.Target', detail: 'Context', kind: 'property' },
  { label: 'context.HitDescription', insertText: 'context.HitDescription', detail: 'Context', kind: 'property' },
];

const HIT_DESCRIPTION_FIELDS: CompletionItem[] = [
  { label: 'IsCriticalHit', insertText: 'IsCriticalHit', detail: 'HitDescription', kind: 'property' },
  { label: 'DamageType', insertText: 'DamageType', detail: 'HitDescription', kind: 'property' },
  { label: 'TotalDamage', insertText: 'TotalDamage', detail: 'HitDescription', kind: 'property' },
  { label: 'AttackType', insertText: 'AttackType', detail: 'HitDescription', kind: 'property' },
  { label: 'DeathType', insertText: 'DeathType', detail: 'HitDescription', kind: 'property' },
];

const LUA_KEYWORDS: CompletionItem[] = [
  { label: 'local', insertText: 'local ', detail: 'Local variable', kind: 'keyword', sortOrder: 200 },
  { label: 'function', insertText: 'function', detail: 'Function declaration', kind: 'keyword', sortOrder: 200 },
  { label: 'if', insertText: 'if', detail: 'Conditional', kind: 'keyword', sortOrder: 200 },
  { label: 'then', insertText: 'then', detail: 'Then clause', kind: 'keyword', sortOrder: 200 },
  { label: 'else', insertText: 'else', detail: 'Else clause', kind: 'keyword', sortOrder: 200 },
  { label: 'elseif', insertText: 'elseif', detail: 'Elseif clause', kind: 'keyword', sortOrder: 200 },
  { label: 'end', insertText: 'end', detail: 'End block', kind: 'keyword', sortOrder: 200 },
  { label: 'for', insertText: 'for', detail: 'For loop', kind: 'keyword', sortOrder: 200 },
  { label: 'while', insertText: 'while', detail: 'While loop', kind: 'keyword', sortOrder: 200 },
  { label: 'do', insertText: 'do', detail: 'Do block', kind: 'keyword', sortOrder: 200 },
  { label: 'repeat', insertText: 'repeat', detail: 'Repeat loop', kind: 'keyword', sortOrder: 200 },
  { label: 'until', insertText: 'until', detail: 'Until condition', kind: 'keyword', sortOrder: 200 },
  { label: 'return', insertText: 'return', detail: 'Return statement', kind: 'keyword', sortOrder: 200 },
  { label: 'break', insertText: 'break', detail: 'Break loop', kind: 'keyword', sortOrder: 200 },
  { label: 'nil', insertText: 'nil', detail: 'Nil value', kind: 'keyword', sortOrder: 200 },
  { label: 'true', insertText: 'true', detail: 'Boolean true', kind: 'keyword', sortOrder: 200 },
  { label: 'false', insertText: 'false', detail: 'Boolean false', kind: 'keyword', sortOrder: 200 },
  { label: 'and', insertText: 'and', detail: 'Logical AND', kind: 'keyword', sortOrder: 200 },
  { label: 'or', insertText: 'or', detail: 'Logical OR', kind: 'keyword', sortOrder: 200 },
  { label: 'not', insertText: 'not', detail: 'Logical NOT', kind: 'keyword', sortOrder: 200 },
  { label: 'in', insertText: 'in', detail: 'In iterator', kind: 'keyword', sortOrder: 200 },
];

const ALL_ITEMS = [...CONDITION_FUNCTIONS, ...CONTEXT_ACCESSORS, ...LUA_KEYWORDS];

function filterByPrefix(items: CompletionItem[], prefix: string): CompletionItem[] {
  const lower = prefix.toLowerCase();
  return items.filter(item => item.label.toLowerCase().startsWith(lower));
}

export const khonsuPlugin: CompletionPlugin = {
  id: 'bg3-khonsu',
  name: 'BG3 Khonsu',
  languages: ['khn'],
  priority: 50,
  getCompletions(ctx: CompletionContext): CompletionItem[] {
    const prefix = ctx.typedPrefix;
    if (!prefix || prefix.length < 2) return [];

    // HitDescription. fields
    if (prefix.startsWith('context.HitDescription.') || prefix.startsWith('HitDescription.')) {
      const sub = prefix.includes('HitDescription.')
        ? prefix.slice(prefix.indexOf('HitDescription.') + 'HitDescription.'.length)
        : '';
      return sub.length === 0 ? HIT_DESCRIPTION_FIELDS : filterByPrefix(HIT_DESCRIPTION_FIELDS, sub);
    }

    // context. accessors
    if (prefix.startsWith('context.')) {
      const sub = prefix.slice('context.'.length);
      return sub.length === 0 ? CONTEXT_ACCESSORS : filterByPrefix(CONTEXT_ACCESSORS, 'context.' + sub);
    }

    return filterByPrefix(ALL_ITEMS, prefix);
  },
};
