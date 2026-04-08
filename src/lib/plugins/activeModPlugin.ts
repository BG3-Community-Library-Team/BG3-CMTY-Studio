import type { CompletionPlugin, CompletionContext, CompletionItem } from './completionTypes.js';

let cachedSymbols: CompletionItem[] = [];
let lastParsedContent = '';

/**
 * Parse Lua source code to extract function names, global variable assignments,
 * and table field definitions (e.g., CL.ID = 3487).
 * This is a lightweight regex-based parser, not a full AST parser.
 */
function parseLuaSymbols(sourceFiles: Map<string, string>): CompletionItem[] {
  const symbols: CompletionItem[] = [];
  const seen = new Set<string>();

  for (const [filePath, content] of sourceFiles) {
    const fileName = filePath.split('/').pop() ?? filePath;

    // Match function declarations: function Name(...) or local function Name(...)
    const funcRegex = /(?:local\s+)?function\s+([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*\(/g;
    let match;
    while ((match = funcRegex.exec(content)) !== null) {
      const name = match[1];
      if (!seen.has(name)) {
        seen.add(name);
        symbols.push({
          label: name,
          insertText: `${name}()`,
          detail: `Function in ${fileName}`,
          kind: 'function',
          sortOrder: 50,
        });
      }
    }

    // Match global-like assignments: Name = ... (at start of line, not local)
    const globalRegex = /^([A-Z]\w*)\s*=/gm;
    while ((match = globalRegex.exec(content)) !== null) {
      const name = match[1];
      if (!seen.has(name) && name !== 'ModuleUUID' && name !== 'Mods') {
        seen.add(name);
        symbols.push({
          label: name,
          insertText: name,
          detail: `Global in ${fileName}`,
          kind: 'variable',
          sortOrder: 60,
        });
      }
    }

    // Match table field assignments: Table.Field = ... or Table.Field.Sub = ...
    const fieldRegex = /^\s*([A-Za-z_]\w*\.[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*=/gm;
    while ((match = fieldRegex.exec(content)) !== null) {
      const name = match[1];
      if (!seen.has(name)) {
        seen.add(name);
        symbols.push({
          label: name,
          insertText: name,
          detail: `Field in ${fileName}`,
          kind: 'property',
          sortOrder: 55,
        });
      }
    }

    // Match table initializations: Name = {} (track table names for dot-completion)
    const tableRegex = /^(?:local\s+)?([A-Za-z_]\w*)\s*=\s*\{/gm;
    while ((match = tableRegex.exec(content)) !== null) {
      const name = match[1];
      if (!seen.has(name)) {
        seen.add(name);
        symbols.push({
          label: name,
          insertText: name,
          detail: `Table in ${fileName}`,
          kind: 'module',
          sortOrder: 45,
        });
      }
    }
  }

  return symbols;
}

/** Update cached symbols from the current mod's script files */
export function updateModSymbols(scriptFiles: Map<string, string>): void {
  const contentHash = Array.from(scriptFiles.values()).join('\n').slice(0, 1000);
  if (contentHash === lastParsedContent) return;
  lastParsedContent = contentHash;
  cachedSymbols = parseLuaSymbols(scriptFiles);
}

/** Clear cached symbols (e.g., when switching mods) */
export function clearModSymbols(): void {
  cachedSymbols = [];
  lastParsedContent = '';
}

function filterByPrefix(items: CompletionItem[], prefix: string): CompletionItem[] {
  const lower = prefix.toLowerCase();
  return items.filter(item => item.label.toLowerCase().startsWith(lower));
}

/**
 * Parse inline symbols from the current document text.
 * This provides completions for the CURRENT file being edited,
 * even before symbols are cached from the full mod scan.
 */
function parseInlineSymbols(fullText: string): CompletionItem[] {
  if (!fullText) return [];
  const symbols: CompletionItem[] = [];
  const seen = new Set<string>();
  const inline = new Map<string, string>();
  inline.set('_current_', fullText);
  for (const item of parseLuaSymbols(inline)) {
    if (!seen.has(item.label)) {
      seen.add(item.label);
      item.detail = item.detail.replace('_current_', 'this file');
      item.sortOrder = (item.sortOrder ?? 100) - 10; // Boost current-file results
      symbols.push(item);
    }
  }
  return symbols;
}

export const activeModPlugin: CompletionPlugin = {
  id: 'active-mod',
  name: 'Active Mod Symbols',
  languages: ['lua'],
  priority: 75,
  getCompletions(ctx: CompletionContext): CompletionItem[] {
    const prefix = ctx.typedPrefix;
    if (!prefix || prefix.length < 2) return [];
    // Don't interfere with Ext./Osi. completions
    if (prefix.startsWith('Ext.') || prefix.startsWith('Osi.')) return [];

    // Merge cached mod-wide symbols with inline symbols from current document
    const inlineItems = parseInlineSymbols(ctx.fullText);
    const inlineLabels = new Set(inlineItems.map(i => i.label));
    const combined = [
      ...inlineItems,
      ...cachedSymbols.filter(s => !inlineLabels.has(s.label)),
    ];
    return filterByPrefix(combined, prefix);
  },
};
