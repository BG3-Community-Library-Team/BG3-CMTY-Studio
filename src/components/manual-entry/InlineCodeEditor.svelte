<script lang="ts">
  /**
   * Lightweight CodeMirror 6 editor for inline expression fields in stats
   * forms. Provides syntax highlighting (condition fields use Khonsu) and
   * context-aware autocompletion via the completionRegistry.
   *
   * No line numbers, no minimap, no fold gutter, no linting — just the
   * essentials for compact inline editing of functor/condition expressions.
   */
  import { onMount, onDestroy } from "svelte";
  import { EditorState, type Extension } from "@codemirror/state";
  import { EditorView, keymap, drawSelection } from "@codemirror/view";
  import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
  import {
    closeBrackets,
    closeBracketsKeymap,
    autocompletion,
    type CompletionContext as CM6CompletionContext,
    type CompletionResult,
  } from "@codemirror/autocomplete";
  import { bracketMatching, syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
  import { cmtyTheme } from "../../lib/editor/cmtyTheme.js";
  import { khonsu } from "../../lib/editor/lang-khonsu/index.js";
  import { completionRegistry } from "../../lib/plugins/index.js";
  import type { ExpressionType } from "../../lib/data/statFieldMetadata.js";

  interface Props {
    value: string;
    expressionType: ExpressionType;
    onchange?: (value: string) => void;
  }

  let { value, expressionType, onchange }: Props = $props();

  let containerEl: HTMLDivElement | undefined = $state(undefined);
  let view: EditorView | undefined = $state(undefined);

  /** Map expression type → virtual language ID for completionRegistry dispatch. */
  const completionLang = $derived(`expr:${expressionType}`);

  /** Extract the identifier chain at cursor for prefix matching. */
  function extractExprPrefix(lineText: string): string {
    const match = lineText.match(/[A-Za-z_]\w*(?:\.\w*)*$/);
    return match ? match[0] : '';
  }

  /** Bridge completionRegistry into CM6 autocompletion. */
  function completionSource(ctx: CM6CompletionContext): CompletionResult | null {
    const line = ctx.state.doc.lineAt(ctx.pos);
    const lineTextBefore = ctx.state.sliceDoc(line.from, ctx.pos);
    const prefix = extractExprPrefix(lineTextBefore);

    if (!prefix && !ctx.explicit) return null;

    const items = completionRegistry.getCompletions({
      lineTextBeforeCursor: lineTextBefore,
      fullText: ctx.state.doc.toString(),
      language: completionLang,
      cursorOffset: ctx.pos,
      typedPrefix: prefix || "",
    });

    if (items.length === 0) return null;

    return {
      from: ctx.pos - (prefix?.length ?? 0),
      options: items.map(item => ({
        label: item.label,
        apply: item.insertText,
        detail: item.detail,
        type: item.kind,
        boost: item.sortOrder != null ? 100 - item.sortOrder : 0,
      })),
    };
  }

  /** CM6 language extension — condition fields get Khonsu, others plaintext. */
  function languageExtension(): Extension {
    return expressionType === 'condition' ? khonsu() : [];
  }

  /** Compact inline theme — overrides cmtyBaseTheme for form field context. */
  const inlineTheme = EditorView.theme({
    "&": {
      fontSize: "0.8125rem",
      fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
      minHeight: "4.5rem",
      maxHeight: "12rem",
      border: "1px solid var(--th-input-border)",
      borderRadius: "0.25rem",
    },
    "&.cm-focused": {
      outline: "none",
      borderColor: "rgb(14 165 233)",
    },
    ".cm-scroller": {
      overflow: "auto",
    },
    ".cm-content": {
      padding: "0.25rem 0.5rem",
    },
    ".cm-line": {
      padding: "0",
    },
    // Hide gutters (none enabled, but defensive)
    ".cm-gutters": {
      display: "none",
    },
    // Hide active line highlight for compact context
    ".cm-activeLine": {
      backgroundColor: "transparent",
    },
  });

  function buildExtensions(): Extension[] {
    return [
      history(),
      drawSelection(),
      bracketMatching(),
      closeBrackets(),
      EditorView.lineWrapping,
      autocompletion({ override: [completionSource] }),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...historyKeymap,
      ]),
      cmtyTheme(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      languageExtension(),
      inlineTheme,
      EditorView.updateListener.of(update => {
        if (update.docChanged) {
          onchange?.(update.state.doc.toString());
        }
      }),
    ];
  }

  onMount(() => {
    if (!containerEl) return;

    const state = EditorState.create({
      doc: value,
      extensions: buildExtensions(),
    });

    view = new EditorView({ state, parent: containerEl });
  });

  onDestroy(() => {
    view?.destroy();
    view = undefined;
  });

  // Sync external value changes into CM6 document
  $effect(() => {
    const newValue = value;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== newValue) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: newValue },
      });
    }
  });
</script>

<div class="inline-code-editor" bind:this={containerEl}></div>
