import type { CompletionPlugin, CompletionContext, CompletionItem } from './completionTypes.js';

const FRAMEWORK_CONSTRUCTORS: CompletionItem[] = [
  { label: 'Config', insertText: 'Config()', detail: 'Constructor', kind: 'function' },
  { label: 'State', insertText: 'State()', detail: 'Constructor', kind: 'function' },
  { label: 'StateRef', insertText: 'StateRef()', detail: 'Constructor', kind: 'function' },
  { label: 'Action', insertText: 'Action()', detail: 'Constructor', kind: 'function' },
  { label: 'Selector', insertText: 'Selector()', detail: 'Constructor', kind: 'function' },
  { label: 'ImmediateSelector', insertText: 'ImmediateSelector()', detail: 'Constructor', kind: 'function' },
  { label: 'Sequence', insertText: 'Sequence()', detail: 'Constructor', kind: 'function' },
  { label: 'Parallel', insertText: 'Parallel()', detail: 'Constructor', kind: 'function' },
  { label: 'RandomSelector', insertText: 'RandomSelector()', detail: 'Constructor', kind: 'function' },
  { label: 'Proxy', insertText: 'Proxy()', detail: 'Constructor', kind: 'function' },
  { label: 'TriggerOutput', insertText: 'TriggerOutput()', detail: 'Constructor', kind: 'function' },
  { label: 'ExtSocket', insertText: 'ExtSocket()', detail: 'Constructor', kind: 'function' },
  { label: 'AnubisModule', insertText: 'AnubisModule()', detail: 'Constructor', kind: 'function' },
];

const GAME_NAMESPACE: CompletionItem[] = [
  { label: 'game.configs', insertText: 'game.configs', detail: 'Game namespace', kind: 'module' },
  { label: 'game.states', insertText: 'game.states', detail: 'Game namespace', kind: 'module' },
  { label: 'game.roots', insertText: 'game.roots', detail: 'Game namespace', kind: 'module' },
  { label: 'game.actions', insertText: 'game.actions', detail: 'Game namespace', kind: 'module' },
  { label: 'game.expressions', insertText: 'game.expressions', detail: 'Game namespace', kind: 'module' },
];

const EVENTS: CompletionItem[] = [
  { label: 'events.', insertText: 'events.', detail: 'Event', kind: 'property' },
  { label: 'socketEvents.', insertText: 'socketEvents.', detail: 'Event', kind: 'property' },
];

const EPARAM_TYPE: CompletionItem[] = [
  { label: 'EParamType.String', insertText: 'EParamType.String', detail: 'Param type', kind: 'variable' },
  { label: 'EParamType.Number', insertText: 'EParamType.Number', detail: 'Param type', kind: 'variable' },
  { label: 'EParamType.Bool', insertText: 'EParamType.Bool', detail: 'Param type', kind: 'variable' },
  { label: 'EParamType.Enum', insertText: 'EParamType.Enum', detail: 'Param type', kind: 'variable' },
  { label: 'EParamType.Object', insertText: 'EParamType.Object', detail: 'Param type', kind: 'variable' },
  { label: 'EParamType.Array', insertText: 'EParamType.Array', detail: 'Param type', kind: 'variable' },
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

const ALL_ITEMS = [...FRAMEWORK_CONSTRUCTORS, ...GAME_NAMESPACE, ...EVENTS, ...LUA_KEYWORDS];

function filterByPrefix(items: CompletionItem[], prefix: string): CompletionItem[] {
  const lower = prefix.toLowerCase();
  return items.filter(item => item.label.toLowerCase().startsWith(lower));
}

export const frameworkPlugin: CompletionPlugin = {
  id: 'bg3-framework',
  name: 'BG3 Anubis/Constellations',
  languages: ['anubis', 'constellations'],
  priority: 50,
  getCompletions(ctx: CompletionContext): CompletionItem[] {
    const prefix = ctx.typedPrefix;
    if (!prefix || prefix.length < 2) return [];

    // EParamType. — constellations only
    if (prefix.startsWith('EParamType.')) {
      if (ctx.language !== 'constellations') return [];
      const sub = prefix.slice('EParamType.'.length);
      return sub.length === 0 ? EPARAM_TYPE : filterByPrefix(EPARAM_TYPE, prefix);
    }

    // game. namespace
    if (prefix.startsWith('game.')) {
      return filterByPrefix(GAME_NAMESPACE, prefix);
    }

    // Include EParamType in general results for constellations
    const items = ctx.language === 'constellations'
      ? [...ALL_ITEMS, ...EPARAM_TYPE]
      : ALL_ITEMS;

    return filterByPrefix(items, prefix);
  },
};
