import type { CompletionPlugin, CompletionContext, CompletionItem } from './completionTypes.js';

let cachedSymbols: CompletionItem[] = [];
let lastParsedContent = '';

/**
 * Parse Lua source code to extract function names and global variable assignments.
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
    return filterByPrefix(cachedSymbols, prefix);
  },
};
