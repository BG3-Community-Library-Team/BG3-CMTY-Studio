import type { CompletionPlugin, CompletionContext, CompletionItem } from '../plugins/completionTypes.js';

export interface CustomSnippetFile {
  label: string;
  description?: string;
  language: string;
  body: string;
  keywords?: string[];
}

let loadedSnippets: CustomSnippetFile[] = [];

export function loadCustomSnippets(snippets: CustomSnippetFile[]): void {
  loadedSnippets = [...snippets];
}

export function clearCustomSnippets(): void {
  loadedSnippets = [];
}

export const customSnippetPlugin: CompletionPlugin = {
  id: 'custom-snippets',
  name: 'Custom Snippets',
  languages: ['*'],
  priority: 160,
  getCompletions(ctx: CompletionContext): CompletionItem[] {
    const prefix = ctx.typedPrefix;
    if (prefix.length < 2) return [];

    const lowerPrefix = prefix.toLowerCase();
    return loadedSnippets
      .filter((s) => {
        if (s.language !== ctx.language && s.language !== '*') return false;
        if (s.label.toLowerCase().startsWith(lowerPrefix)) return true;
        if (s.keywords) {
          return s.keywords.some((kw) => kw.toLowerCase().startsWith(lowerPrefix));
        }
        return false;
      })
      .map((s) => ({
        label: s.label,
        insertText: s.body,
        detail: s.description ?? '',
        kind: 'snippet' as const,
        sortOrder: 160,
        source: 'custom-snippets',
      }));
  },
};
