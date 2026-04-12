/**
 * Indentation-based fold service for Lua and Lua-family languages.
 *
 * StreamLanguage (legacy modes) does not produce syntax tree fold nodes,
 * so foldGutter() has nothing to fold. This foldService uses keyword
 * matching to detect block boundaries: function…end, if…end, for…end,
 * while…end, do…end, repeat…until.
 */
import { foldService } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";

/** Block-opening keywords and their matching closers. */
const OPENERS = /^\s*(?:(?:local\s+)?function\b|if\b|for\b|while\b|do\b|repeat\b)/;
const CLOSERS = /^\s*(?:end|until)\b/;

/**
 * Walk forward from the opening line to find the matching block closer,
 * tracking nesting depth.
 */
function findBlockEnd(state: EditorState, startLine: number): number | null {
  let depth = 1;
  const totalLines = state.doc.lines;
  for (let i = startLine + 1; i <= totalLines; i++) {
    const lineText = state.doc.line(i).text;
    if (OPENERS.test(lineText)) depth++;
    if (CLOSERS.test(lineText)) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return null;
}

/**
 * CM6 fold service for Lua keyword blocks.
 * Returns a foldable range when the cursor line starts a block.
 */
export const luaFoldService = foldService.of((state, lineStart, _lineEnd) => {
  const line = state.doc.lineAt(lineStart);
  if (!OPENERS.test(line.text)) return null;

  const endLineNum = findBlockEnd(state, line.number);
  if (endLineNum == null) return null;

  const endLine = state.doc.line(endLineNum);
  // Fold from end of opening line to start of closing line
  return { from: line.to, to: endLine.from };
});
