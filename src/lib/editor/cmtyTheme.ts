/**
 * CM6 theme factory — maps CMTY Studio CSS custom properties to CodeMirror 6
 * visual styling. Two parts: base theme (editor chrome) and highlight style
 * (syntax token colors).
 *
 * Uses CSS `var()` references so theme switching is instant (no editor
 * recreation needed — CM6 reads the variables at paint time).
 */
import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";

/** Editor chrome: background, caret, selection, gutters, tooltips. */
export function cmtyBaseTheme(): Extension {
  return EditorView.theme({
    "&": {
      backgroundColor: "var(--th-edit-pre-bg)",
      color: "var(--th-edit-pre-color)",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "var(--th-edit-caret)",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "var(--th-edit-selection)",
    },
    ".cm-panels": {
      backgroundColor: "var(--th-bg-800)",
      color: "var(--th-text-200)",
    },
    ".cm-panels.cm-panels-top": {
      borderBottom: "1px solid var(--th-border-700)",
    },
    ".cm-panels.cm-panels-bottom": {
      borderTop: "1px solid var(--th-border-700)",
    },
    ".cm-searchMatch": {
      backgroundColor: "rgba(255, 215, 0, 0.25)",
      outline: "1px solid rgba(255, 215, 0, 0.4)",
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: "rgba(255, 215, 0, 0.45)",
    },
    ".cm-gutters": {
      backgroundColor: "var(--th-bg-900)",
      color: "var(--th-text-600)",
      borderRight: "1px solid var(--th-border-700)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "var(--th-bg-800)",
      color: "var(--th-text-400)",
    },
    ".cm-activeLine": {
      backgroundColor: "var(--th-bg-800, transparent)",
    },
    ".cm-foldPlaceholder": {
      backgroundColor: "transparent",
      border: "none",
      color: "var(--th-text-500)",
    },
    ".cm-tooltip": {
      backgroundColor: "var(--th-bg-800)",
      border: "1px solid var(--th-border-700)",
      color: "var(--th-text-200)",
    },
    ".cm-tooltip .cm-tooltip-arrow:before": {
      borderTopColor: "transparent",
      borderBottomColor: "transparent",
    },
    ".cm-tooltip .cm-tooltip-arrow:after": {
      borderTopColor: "var(--th-bg-800)",
      borderBottomColor: "var(--th-bg-800)",
    },
    ".cm-tooltip-autocomplete": {
      "& > ul > li[aria-selected]": {
        backgroundColor: "var(--th-bg-700)",
        color: "var(--th-text-100)",
      },
    },
    // Search/replace panel input styling
    ".cm-panel.cm-search input, .cm-panel.cm-search button": {
      color: "var(--th-input-text)",
    },
    ".cm-panel.cm-search input": {
      backgroundColor: "var(--th-input-bg)",
      border: "1px solid var(--th-input-border)",
      borderRadius: "3px",
      padding: "2px 6px",
    },
    ".cm-panel.cm-search button": {
      backgroundColor: "var(--th-bg-700)",
      border: "1px solid var(--th-border-700)",
      borderRadius: "3px",
      cursor: "pointer",
    },
    ".cm-panel.cm-search button:hover": {
      backgroundColor: "var(--th-bg-600, var(--th-bg-700))",
    },
    ".cm-panel.cm-search label": {
      color: "var(--th-text-400)",
    },
  });
}

/** Syntax token colors — references CMTY CSS variables with safe fallbacks. */
export function cmtyHighlightStyle(): Extension {
  return syntaxHighlighting(
    HighlightStyle.define([
      { tag: tags.keyword, color: "var(--th-syntax-keyword, var(--th-text-violet-400, #a78bfa))" },
      { tag: tags.name, color: "var(--th-syntax-key, var(--th-text-sky-400, #38bdf8))" },
      { tag: tags.definition(tags.variableName), color: "var(--th-text-sky-300, #7dd3fc)" },
      { tag: tags.function(tags.variableName), color: "var(--th-text-indigo-400, #818cf8)" },
      { tag: tags.string, color: "var(--th-syntax-string, var(--th-text-emerald-400, #34d399))" },
      { tag: tags.comment, color: "var(--th-syntax-comment, var(--th-text-600, #52525b))", fontStyle: "italic" },
      { tag: tags.number, color: "var(--th-syntax-num, var(--th-text-amber-400, #fbbf24))" },
      { tag: tags.bool, color: "var(--th-syntax-bool, var(--th-text-amber-400, #fbbf24))" },
      { tag: tags.punctuation, color: "var(--th-syntax-punct, var(--th-text-500, #71717a))" },
      { tag: tags.attributeName, color: "var(--th-syntax-key, var(--th-text-sky-400, #38bdf8))" },
      { tag: tags.attributeValue, color: "var(--th-syntax-string, var(--th-text-emerald-400, #34d399))" },
      { tag: tags.typeName, color: "var(--th-text-amber-400, #fbbf24)" },
      { tag: tags.tagName, color: "var(--th-syntax-keyword, var(--th-text-violet-400, #a78bfa))" },
      { tag: tags.invalid, color: "var(--th-text-red-400, #f87171)" },
      { tag: tags.operator, color: "var(--th-text-400, #a1a1aa)" },
      { tag: tags.meta, color: "var(--th-text-500, #71717a)" },
      { tag: tags.regexp, color: "var(--th-text-red-300, #fca5a5)" },
      { tag: tags.variableName, color: "var(--th-text-300, #d4d4d8)" },
      { tag: tags.propertyName, color: "var(--th-syntax-key, var(--th-text-sky-400, #38bdf8))" },
      { tag: tags.self, color: "var(--th-syntax-keyword, var(--th-text-violet-400, #a78bfa))" },
    ]),
  );
}

/** Combined theme extension: base chrome + syntax highlighting. */
export function cmtyTheme(): Extension {
  return [cmtyBaseTheme(), cmtyHighlightStyle()];
}
