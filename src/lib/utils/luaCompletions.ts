import { completionRegistry, type CompletionItem } from '../plugins/index.js';

/** Extract the identifier chain at the end of a line of text */
export function extractPrefix(lineText: string): string {
  const match = lineText.match(/((?:Ext|Osi|table|string|math|Mods)\.\w*(?:\.\w*)*|[A-Za-z_]\w*(?:\.\w*)*)$/);
  return match ? match[0] : '';
}

/** Check if the cursor position is inside a Lua comment */
function isInsideComment(lineText: string): boolean {
  // Full-line comment
  if (/^\s*--/.test(lineText)) return true;
  // Cursor is after an inline comment marker (-- not inside a string)
  // Simple heuristic: find last "--" that's not inside a string literal
  let inString: string | null = null;
  for (let i = 0; i < lineText.length - 1; i++) {
    const ch = lineText[i];
    if (inString) {
      if (ch === '\\') { i++; continue; }
      if (ch === inString) { inString = null; }
    } else {
      if (ch === '"' || ch === "'") { inString = ch; }
      else if (ch === '-' && lineText[i + 1] === '-') return true;
    }
  }
  return false;
}

/** Get completions for the given line text. Delegates to the plugin registry. */
export function getCompletions(lineText: string, fullText?: string, language = 'lua'): CompletionItem[] {
  // Don't provide completions inside comments
  if (language === 'lua' && isInsideComment(lineText)) return [];

  const typedPrefix = extractPrefix(lineText);
  if (!typedPrefix) return [];

  return completionRegistry.getCompletions({
    lineTextBeforeCursor: lineText,
    fullText: fullText ?? '',
    language,
    cursorOffset: lineText.length,
    typedPrefix,
  });
}

// Re-export types for consumers
export type { CompletionItem } from '../plugins/completionTypes.js';
