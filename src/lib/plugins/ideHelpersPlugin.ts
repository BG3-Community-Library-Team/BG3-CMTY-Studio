/**
 * IDE Helpers Plugin — provides completions from a user-specified Lua helpers file.
 * Reads the file content from disk when the path changes and caches parsed symbols.
 */
import type { CompletionPlugin, CompletionContext, CompletionItem } from './completionTypes.js';
import { readTextFile, listFilesByExt } from '../tauri/readme.js';

let cachedPath = '';
let cachedSymbols: CompletionItem[] = [];
let loading = false;

/**
 * Parse the IDE helpers file for function declarations, global assignments,
 * and table field definitions — same regex approach as activeModPlugin.
 */
function parseHelperSymbols(content: string): CompletionItem[] {
  const symbols: CompletionItem[] = [];
  const seen = new Set<string>();

  // Function declarations
  const funcRegex = /(?:local\s+)?function\s+([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*\(/g;
  let match;
  while ((match = funcRegex.exec(content)) !== null) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      symbols.push({
        label: name,
        insertText: `${name}()`,
        detail: 'IDE Helper function',
        kind: 'function',
        sortOrder: 40,
      });
    }
  }

  // Global assignments
  const globalRegex = /^([A-Z]\w*)\s*=/gm;
  while ((match = globalRegex.exec(content)) !== null) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      symbols.push({
        label: name,
        insertText: name,
        detail: 'IDE Helper global',
        kind: 'variable',
        sortOrder: 42,
      });
    }
  }

  // Table field assignments: Table.Field = ...
  const fieldRegex = /^\s*([A-Za-z_]\w*\.[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*=/gm;
  while ((match = fieldRegex.exec(content)) !== null) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      symbols.push({
        label: name,
        insertText: name,
        detail: 'IDE Helper field',
        kind: 'property',
        sortOrder: 41,
      });
    }
  }

  // Table initializations
  const tableRegex = /^(?:local\s+)?([A-Za-z_]\w*)\s*=\s*\{/gm;
  while ((match = tableRegex.exec(content)) !== null) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      symbols.push({
        label: name,
        insertText: name,
        detail: 'IDE Helper table',
        kind: 'module',
        sortOrder: 38,
      });
    }
  }

  return symbols;
}

/** Load (or reload) helpers from a folder containing .lua files. */
export async function loadIdeHelpers(path: string): Promise<void> {
  if (!path) {
    cachedPath = '';
    cachedSymbols = [];
    return;
  }
  if (path === cachedPath && cachedSymbols.length > 0) return;
  if (loading) return;

  loading = true;
  try {
    const luaFiles = await listFilesByExt(path, 'lua');
    const allSymbols: CompletionItem[] = [];
    for (const filePath of luaFiles) {
      const content = await readTextFile(filePath);
      if (content) {
        allSymbols.push(...parseHelperSymbols(content));
      }
    }
    cachedSymbols = allSymbols;
    cachedPath = path;
  } catch (e) {
    console.warn('[IDE Helpers] Failed to load helpers folder:', e);
    cachedSymbols = [];
  } finally {
    loading = false;
  }
}

/** Force refresh of the helpers folder (e.g. when the user changes the path). */
export async function reloadIdeHelpers(path: string): Promise<void> {
  cachedPath = '';
  cachedSymbols = [];
  await loadIdeHelpers(path);
}

function filterByPrefix(items: CompletionItem[], prefix: string): CompletionItem[] {
  const lower = prefix.toLowerCase();
  const dotIdx = prefix.lastIndexOf('.');
  if (dotIdx >= 0) {
    const tablePart = prefix.slice(0, dotIdx);
    const fieldPart = prefix.slice(dotIdx + 1).toLowerCase();
    return items.filter(item => {
      const itemDotIdx = item.label.lastIndexOf('.');
      if (itemDotIdx < 0) return false;
      const itemTable = item.label.slice(0, itemDotIdx);
      const itemField = item.label.slice(itemDotIdx + 1);
      return itemTable.toLowerCase() === tablePart.toLowerCase() &&
             itemField.toLowerCase().startsWith(fieldPart);
    });
  }
  return items.filter(item => item.label.toLowerCase().startsWith(lower));
}

export const ideHelpersPlugin: CompletionPlugin = {
  id: 'ide-helpers',
  name: 'IDE Helpers',
  languages: ['lua'],
  priority: 60,
  getCompletions(ctx: CompletionContext): CompletionItem[] {
    const prefix = ctx.typedPrefix;
    if (!prefix || prefix.length < 2) return [];
    if (prefix.startsWith('Ext.') || prefix.startsWith('Osi.')) return [];
    return filterByPrefix(cachedSymbols, prefix);
  },
};
