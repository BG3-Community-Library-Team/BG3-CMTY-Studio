import { completionRegistry, type CompletionItem } from '../plugins/index.js';

/** Extract the identifier chain at the end of a line of text */
export function extractPrefix(lineText: string): string {
  const match = lineText.match(/((?:Ext|Osi|table|string|math|Mods)\.\w*(?:\.\w*)*|[A-Za-z_]\w*(?:\.\w*)*)$/);
  return match ? match[0] : '';
}

/** Get completions for the given line text. Delegates to the plugin registry. */
export function getCompletions(lineText: string, fullText?: string, language = 'lua'): CompletionItem[] {
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
