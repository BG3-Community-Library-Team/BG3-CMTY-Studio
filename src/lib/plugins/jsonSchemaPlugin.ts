import type { CompletionPlugin, CompletionContext, CompletionItem } from './completionTypes.js';

const SE_CONFIG_KEYS: CompletionItem[] = [
  { label: 'RequiredVersion', insertText: '"RequiredVersion"', detail: 'SE Config key', kind: 'property' },
  { label: 'ModTable', insertText: '"ModTable"', detail: 'SE Config key', kind: 'property' },
  { label: 'FeatureFlags', insertText: '"FeatureFlags"', detail: 'SE Config key', kind: 'property' },
  { label: 'Preload', insertText: '"Preload"', detail: 'SE Config key', kind: 'property' },
];

const SE_FEATURE_FLAGS: CompletionItem[] = [
  { label: 'Lua', insertText: '"Lua"', detail: 'FeatureFlag', kind: 'variable' },
  { label: 'Extender', insertText: '"Extender"', detail: 'FeatureFlag', kind: 'variable' },
  { label: 'Osiris', insertText: '"Osiris"', detail: 'FeatureFlag', kind: 'variable' },
  { label: 'OsirisExtensions', insertText: '"OsirisExtensions"', detail: 'FeatureFlag', kind: 'variable' },
];

const MCM_TOP_KEYS: CompletionItem[] = [
  { label: 'SchemaVersion', insertText: '"SchemaVersion"', detail: 'MCM key', kind: 'property' },
  { label: 'ModName', insertText: '"ModName"', detail: 'MCM key', kind: 'property' },
  { label: 'Tabs', insertText: '"Tabs"', detail: 'MCM key', kind: 'property' },
  { label: 'Sections', insertText: '"Sections"', detail: 'MCM key', kind: 'property' },
  { label: 'Settings', insertText: '"Settings"', detail: 'MCM key', kind: 'property' },
];

const MCM_WIDGET_TYPES: CompletionItem[] = [
  { label: 'checkbox', insertText: 'checkbox', detail: 'MCM widget', kind: 'keyword' },
  { label: 'int', insertText: 'int', detail: 'MCM widget', kind: 'keyword' },
  { label: 'float', insertText: 'float', detail: 'MCM widget', kind: 'keyword' },
  { label: 'text', insertText: 'text', detail: 'MCM widget', kind: 'keyword' },
  { label: 'enum', insertText: 'enum', detail: 'MCM widget', kind: 'keyword' },
  { label: 'radio', insertText: 'radio', detail: 'MCM widget', kind: 'keyword' },
  { label: 'slider_int', insertText: 'slider_int', detail: 'MCM widget', kind: 'keyword' },
  { label: 'slider_float', insertText: 'slider_float', detail: 'MCM widget', kind: 'keyword' },
  { label: 'drag_int', insertText: 'drag_int', detail: 'MCM widget', kind: 'keyword' },
  { label: 'drag_float', insertText: 'drag_float', detail: 'MCM widget', kind: 'keyword' },
  { label: 'list_v2', insertText: 'list_v2', detail: 'MCM widget', kind: 'keyword' },
  { label: 'color_picker', insertText: 'color_picker', detail: 'MCM widget', kind: 'keyword' },
  { label: 'color_edit', insertText: 'color_edit', detail: 'MCM widget', kind: 'keyword' },
  { label: 'keybinding_v2', insertText: 'keybinding_v2', detail: 'MCM widget', kind: 'keyword' },
  { label: 'event_button', insertText: 'event_button', detail: 'MCM widget', kind: 'keyword' },
];

const MCM_SETTING_KEYS: CompletionItem[] = [
  { label: 'Id', insertText: '"Id"', detail: 'MCM setting key', kind: 'property' },
  { label: 'Name', insertText: '"Name"', detail: 'MCM setting key', kind: 'property' },
  { label: 'Type', insertText: '"Type"', detail: 'MCM setting key', kind: 'property' },
  { label: 'Default', insertText: '"Default"', detail: 'MCM setting key', kind: 'property' },
  { label: 'Description', insertText: '"Description"', detail: 'MCM setting key', kind: 'property' },
  { label: 'Tooltip', insertText: '"Tooltip"', detail: 'MCM setting key', kind: 'property' },
  { label: 'Options', insertText: '"Options"', detail: 'MCM setting key', kind: 'property' },
];

type JsonMode = 'se-config' | 'mcm' | 'unknown';

function detectMode(fullText: string): JsonMode {
  if (fullText.includes('"RequiredVersion"') || fullText.includes('"ModTable"')) return 'se-config';
  if (fullText.includes('"SchemaVersion"') || fullText.includes('"Tabs"')) return 'mcm';
  return 'unknown';
}

function filterByPrefix(items: CompletionItem[], prefix: string): CompletionItem[] {
  const lower = prefix.toLowerCase();
  return items.filter(item => item.label.toLowerCase().startsWith(lower));
}

export const jsonSchemaPlugin: CompletionPlugin = {
  id: 'bg3-json-schema',
  name: 'BG3 JSON Schema',
  languages: ['json'],
  priority: 40,
  getCompletions(ctx: CompletionContext): CompletionItem[] {
    const prefix = ctx.typedPrefix;
    if (!prefix || prefix.length < 2) return [];

    const mode = detectMode(ctx.fullText);
    if (mode === 'unknown') return [];

    if (mode === 'se-config') {
      // Check if we're inside FeatureFlags array
      const line = ctx.lineTextBeforeCursor;
      if (line.includes('FeatureFlags') || /\[\s*"?[^"\]]*$/i.test(line)) {
        const flagResults = filterByPrefix(SE_FEATURE_FLAGS, prefix);
        if (flagResults.length > 0) return flagResults;
      }
      return filterByPrefix(SE_CONFIG_KEYS, prefix);
    }

    // MCM mode
    const line = ctx.lineTextBeforeCursor;
    // Check if we're in a Type value context
    if (/"Type"\s*:\s*"?[^"]*$/i.test(line)) {
      return filterByPrefix(MCM_WIDGET_TYPES, prefix);
    }
    // Offer setting-level keys and top-level keys
    const combined = [...MCM_TOP_KEYS, ...MCM_SETTING_KEYS];
    return filterByPrefix(combined, prefix);
  },
};
