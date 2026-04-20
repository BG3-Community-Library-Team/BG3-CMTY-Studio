/**
 * Completion plugin for inline stats expression fields (functors, boosts,
 * conditions, rolls, display parameters). Provides context-aware autocompletion based
 * on the expression type of the field being edited.
 *
 * Responds to virtual language IDs: expr:condition, expr:effect, expr:roll,
 * expr:display — set by InlineCodeEditor based on the field's
 * ExpressionType metadata.
 */
import type { CompletionPlugin, CompletionContext, CompletionItem } from './completionTypes.js';
import { CONDITION_FUNCTIONS } from '../data/conditionFunctions.js';
import { getModKhonsuFunctions } from '../services/khnFunctionDiscovery.js';
import {
  STATS_FUNCTORS,
  STATS_BOOSTS,
  TARGETING_KEYWORDS,
  ROLL_FUNCTIONS,
  DAMAGE_TYPE_ENUM,
  ATTACK_TYPE_ENUM,
  ABILITY_ENUM,
  CONDITION_OPERATORS,
  FUNCTOR_WRAPPER,
} from '../data/statsExpressionCatalog.js';
import type { StatsExpressionDef } from '../data/statsExpressionCatalog.js';

// ─── Helpers ───────────────────────────────────────────────────

function fnItem(def: StatsExpressionDef, detail: string, sortOrder = 10): CompletionItem {
  return {
    label: def.name,
    insertText: `${def.name}()`,
    detail: `${detail} — ${def.description}`,
    kind: 'function',
    sortOrder,
  };
}

function kwItem(def: StatsExpressionDef, detail: string, sortOrder = 50): CompletionItem {
  return {
    label: def.name,
    insertText: def.name,
    detail: `${detail} — ${def.description}`,
    kind: 'keyword',
    sortOrder,
  };
}

function valItem(def: StatsExpressionDef, detail: string, sortOrder = 40): CompletionItem {
  return {
    label: def.name,
    insertText: def.name,
    detail: `${detail} — ${def.description}`,
    kind: 'variable',
    sortOrder,
  };
}

// ─── Condition completions ─────────────────────────────────────

const CONDITION_ITEMS: CompletionItem[] = [
  ...CONDITION_FUNCTIONS.map(fn => ({
    label: fn.name,
    insertText: `${fn.name}()`,
    detail: `Condition — ${fn.description}`,
    kind: 'function' as const,
    sortOrder: 10,
  })),
  ...CONDITION_OPERATORS.map(op => kwItem(op, 'Operator', 60)),
  { label: 'context.Source', insertText: 'context.Source', detail: 'Context — The caster/source entity', kind: 'property', sortOrder: 20 },
  { label: 'context.Target', insertText: 'context.Target', detail: 'Context — The targeted entity', kind: 'property', sortOrder: 20 },
  { label: 'context.HitDescription', insertText: 'context.HitDescription', detail: 'Context — Hit description data', kind: 'property', sortOrder: 20 },
];

const HIT_DESCRIPTION_ITEMS: CompletionItem[] = [
  { label: 'IsCriticalHit', insertText: 'IsCriticalHit', detail: 'HitDescription — Whether hit is critical', kind: 'property', sortOrder: 20 },
  { label: 'DamageType', insertText: 'DamageType', detail: 'HitDescription — Damage type of hit', kind: 'property', sortOrder: 20 },
  { label: 'TotalDamage', insertText: 'TotalDamage', detail: 'HitDescription — Total damage dealt', kind: 'property', sortOrder: 20 },
  { label: 'AttackType', insertText: 'AttackType', detail: 'HitDescription — Type of attack', kind: 'property', sortOrder: 20 },
  { label: 'DeathType', insertText: 'DeathType', detail: 'HitDescription — Type of death', kind: 'property', sortOrder: 20 },
];

// ─── Effect completions ────────────────────────────────────────

const EFFECT_ITEMS: CompletionItem[] = [
  ...STATS_FUNCTORS.map(f => fnItem(f, 'Functor', 10)),
  ...STATS_BOOSTS.map(b => fnItem(b, 'Boost', 15)),
  ...TARGETING_KEYWORDS.map(t => kwItem(t, 'Targeting', 20)),
  fnItem(FUNCTOR_WRAPPER, 'Wrapper', 20),
  ...DAMAGE_TYPE_ENUM.map(d => valItem(d, 'Damage Type', 50)),
  ...CONDITION_OPERATORS.map(op => kwItem(op, 'Operator', 60)),
];

// ─── Roll completions ──────────────────────────────────────────

const ROLL_ITEMS: CompletionItem[] = [
  ...ROLL_FUNCTIONS.map(f => fnItem(f, 'Roll', 10)),
  ...TARGETING_KEYWORDS.map(t => kwItem(t, 'Targeting', 20)),
  ...ATTACK_TYPE_ENUM.map(a => valItem(a, 'Attack Type', 30)),
  ...ABILITY_ENUM.map(a => valItem(a, 'Ability', 30)),
  fnItem(FUNCTOR_WRAPPER, 'Wrapper', 40),
  ...CONDITION_OPERATORS.map(op => kwItem(op, 'Operator', 60)),
];

// ─── Display completions ───────────────────────────────────────

const DISPLAY_ITEMS: CompletionItem[] = [
  ...STATS_FUNCTORS.map(f => fnItem(f, 'Functor', 10)),
  ...DAMAGE_TYPE_ENUM.map(d => valItem(d, 'Damage Type', 50)),
];

// ─── Language → items mapping ──────────────────────────────────

const ITEMS_BY_LANGUAGE: Record<string, CompletionItem[]> = {
  'expr:condition': CONDITION_ITEMS,
  'expr:effect': EFFECT_ITEMS,
  'expr:roll': ROLL_ITEMS,
  'expr:display': DISPLAY_ITEMS,
};

function filterByPrefix(items: CompletionItem[], prefix: string): CompletionItem[] {
  const lower = prefix.toLowerCase();
  return items.filter(item => item.label.toLowerCase().startsWith(lower));
}

export const statsExpressionPlugin: CompletionPlugin = {
  id: 'bg3-stats-expression',
  name: 'BG3 Stats Expression',
  languages: ['expr:condition', 'expr:effect', 'expr:roll', 'expr:display'],
  priority: 40,
  getCompletions(ctx: CompletionContext): CompletionItem[] {
    const prefix = ctx.typedPrefix;
    if (!prefix || prefix.length < 2) return [];

    const items = ITEMS_BY_LANGUAGE[ctx.language];
    if (!items) return [];

    // Append mod .khn functions dynamically — valid in condition fields directly
    // and in effect/roll fields via IF(condition) wrappers
    const modFns = getModKhonsuFunctions();
    const allItems = modFns.length > 0
      && (ctx.language === 'expr:condition' || ctx.language === 'expr:effect' || ctx.language === 'expr:roll')
      ? [...items, ...modFns]
      : items;

    // Special handling for condition context accessors
    if (ctx.language === 'expr:condition') {
      if (prefix.startsWith('context.HitDescription.')) {
        const sub = prefix.slice('context.HitDescription.'.length);
        return sub.length === 0 ? HIT_DESCRIPTION_ITEMS : filterByPrefix(HIT_DESCRIPTION_ITEMS, sub);
      }
      if (prefix.startsWith('context.')) {
        const contextItems = allItems.filter(i => i.label.startsWith('context.'));
        const sub = prefix.slice('context.'.length);
        return sub.length === 0 ? contextItems : filterByPrefix(contextItems, 'context.' + sub);
      }
    }

    return filterByPrefix(allItems, prefix);
  },
};

/** Counts exported for testing */
export const _CATALOG_COUNTS = {
  condition: CONDITION_ITEMS.length,
  effect: EFFECT_ITEMS.length,
  roll: ROLL_ITEMS.length,
  display: DISPLAY_ITEMS.length,
} as const;
