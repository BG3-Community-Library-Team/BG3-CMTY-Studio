/** A single completion suggestion */
export interface CompletionItem {
  label: string;
  insertText: string;
  detail: string;
  kind: 'function' | 'property' | 'module' | 'keyword' | 'variable' | 'snippet';
  /** Optional: sort priority (lower = higher priority). Default 100. */
  sortOrder?: number;
  /** Optional: which plugin provided this completion */
  source?: string;
}

/** Context passed to completion providers */
export interface CompletionContext {
  /** Full text of the current line up to cursor */
  lineTextBeforeCursor: string;
  /** Full document text */
  fullText: string;
  /** Language of the file (lua, json, etc.) */
  language: string;
  /** Current cursor position (character offset) */
  cursorOffset: number;
  /** The identifier chain being typed (e.g., "Ext.Stats") */
  typedPrefix: string;
}

/** A completion provider plugin */
export interface CompletionPlugin {
  /** Unique plugin ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** Languages this plugin supports */
  languages: string[];
  /** Priority order (lower = runs first). Default 100. */
  priority?: number;
  /** Returns completion items for the given context */
  getCompletions(ctx: CompletionContext): CompletionItem[];
}
