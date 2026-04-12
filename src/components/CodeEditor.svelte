<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { EditorState, Compartment, type Extension } from "@codemirror/state";
  import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, drawSelection, dropCursor, highlightActiveLine } from "@codemirror/view";
  import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
  import { foldGutter, foldKeymap, indentOnInput, bracketMatching, syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
  import { closeBrackets, closeBracketsKeymap, autocompletion, snippet, type CompletionContext as CM6CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
  import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
  import { lintGutter } from "@codemirror/lint";
  import { cmtyTheme } from "../lib/editor/cmtyTheme.js";
  import { getLanguageExtension } from "../lib/editor/languages.js";
  import { bg3Linter } from "../lib/editor/lintBridge.js";
  import { completionRegistry } from "../lib/plugins/index.js";
  import { extractPrefix } from "../lib/utils/luaCompletions.js";
  import type { ScriptLanguage } from "../lib/editor/types.js";

  interface Props {
    content: string;
    language: ScriptLanguage | string;
    filePath?: string;
    projectPath?: string;
    readonly?: boolean;
    onchange?: (content: string) => void;
    onsave?: () => void;
    extensions?: Extension[];
    class?: string;
  }

  let {
    content,
    language,
    filePath,
    projectPath,
    readonly = false,
    onchange,
    onsave,
    extensions: extraExtensions = [],
    class: className = "",
  }: Props = $props();

  let containerEl: HTMLDivElement | undefined = $state(undefined);
  let view: EditorView | undefined = $state(undefined);

  // Compartments for dynamic reconfiguration
  const languageCompartment = new Compartment();
  const readonlyCompartment = new Compartment();
  const lintCompartment = new Compartment();
  const extraCompartment = new Compartment();

  /** Bridge CMTY CompletionRegistry into CM6 autocompletion. */
  function cmtyCompletionSource(ctx: CM6CompletionContext): CompletionResult | null {
    const line = ctx.state.doc.lineAt(ctx.pos);
    const lineTextBefore = ctx.state.sliceDoc(line.from, ctx.pos);

    const typedPrefix = extractPrefix(lineTextBefore);
    if (!typedPrefix && !ctx.explicit) return null;

    const items = completionRegistry.getCompletions({
      lineTextBeforeCursor: lineTextBefore,
      fullText: ctx.state.doc.toString(),
      language: language,
      cursorOffset: ctx.pos,
      typedPrefix: typedPrefix || "",
    });

    if (items.length === 0) return null;

    const from = ctx.pos - (typedPrefix?.length ?? 0);

    return {
      from,
      options: items.map((item) => ({
        label: item.label,
        apply: item.kind === 'snippet' ? snippet(item.insertText) : item.insertText,
        detail: item.detail,
        type: item.kind,
        boost: item.sortOrder != null ? 100 - item.sortOrder : 0,
      })),
    };
  }

  /** Build the full set of extensions for the editor state. */
  function buildExtensions(): Extension[] {
    return [
      lineNumbers(),
      highlightActiveLineGutter(),
      history(),
      foldGutter(),
      drawSelection(),
      dropCursor(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      autocompletion({ override: [cmtyCompletionSource] }),
      lintGutter(),
      lintCompartment.of(filePath ? bg3Linter(filePath, language, projectPath) : []),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        indentWithTab,
        {
          key: "Mod-s",
          run: () => {
            onsave?.();
            return true;
          },
        },
      ]),
      cmtyTheme(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      languageCompartment.of(getLanguageExtension(language)),
      readonlyCompartment.of(EditorState.readOnly.of(readonly)),
      extraCompartment.of(extraExtensions),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onchange?.(update.state.doc.toString());
        }
      }),
    ];
  }

  onMount(() => {
    if (!containerEl) return;

    const state = EditorState.create({
      doc: content,
      extensions: buildExtensions(),
    });

    view = new EditorView({ state, parent: containerEl });
  });

  onDestroy(() => {
    view?.destroy();
    view = undefined;
  });

  // Watch language changes → reconfigure
  $effect(() => {
    const lang = language; // track
    if (!view) return;
    view.dispatch({
      effects: languageCompartment.reconfigure(getLanguageExtension(lang)),
    });
  });

  // Watch readonly changes → reconfigure
  $effect(() => {
    const ro = readonly; // track
    if (!view) return;
    view.dispatch({
      effects: readonlyCompartment.reconfigure(EditorState.readOnly.of(ro)),
    });
  });

  // Watch filePath/language changes → reconfigure linter
  $effect(() => {
    const fp = filePath;
    const lang = language;
    const pp = projectPath;
    if (!view) return;
    view.dispatch({
      effects: lintCompartment.reconfigure(fp ? bg3Linter(fp, lang, pp) : []),
    });
  });

  // Watch content prop changes → update document if changed externally
  $effect(() => {
    const newContent = content;
    if (!view) return;
    const currentContent = view.state.doc.toString();
    if (newContent !== currentContent) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: newContent },
      });
    }
  });

  /** Public API: get the current document text. */
  export function getContent(): string {
    return view?.state.doc.toString() ?? content;
  }

  /** Public API: replace entire document content. */
  export function setContent(text: string): void {
    if (!view) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: text },
    });
  }

  /** Public API: focus the editor. */
  export function focus(): void {
    view?.focus();
  }

  /** Public API: access the underlying EditorView. */
  export function getView(): EditorView | undefined {
    return view;
  }
</script>

<div
  bind:this={containerEl}
  class="code-editor {className}"
  role="textbox"
  aria-multiline="true"
  aria-label="Code editor"
></div>

<style>
  .code-editor {
    height: 100%;
    overflow: hidden;
    font-family: "Cascadia Code", "Fira Code", "JetBrains Mono", monospace;
    font-size: 12px;
  }

  .code-editor :global(.cm-editor) {
    height: 100%;
  }

  .code-editor :global(.cm-scroller) {
    overflow: auto;
    font-family: inherit;
    font-size: inherit;
    line-height: 1.4;
  }

  .code-editor :global(.cm-focused) {
    outline: none;
  }

  .code-editor :global(.cm-gutters) {
    font-size: 11px;
  }
</style>
