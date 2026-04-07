<script lang="ts">
  import { highlightLine } from "../lib/utils/syntaxHighlight.js";
  import type { ScriptLanguage } from "../lib/utils/syntaxHighlight.js";
  import { scriptRead, scriptWrite } from "../lib/tauri/scripts.js";
  import { projectStore } from "../lib/stores/projectStore.svelte.js";
  import { toastStore } from "../lib/stores/toastStore.svelte.js";
  import { uiStore } from "../lib/stores/uiStore.svelte.js";
  import Loader2 from "@lucide/svelte/icons/loader-2";
  import AlertCircle from "@lucide/svelte/icons/alert-circle";
  import Save from "@lucide/svelte/icons/save";
  import { m } from "../paraglide/messages.js";

  interface Props {
    filePath: string;
    language: ScriptLanguage;
    readonly?: boolean;
  }

  let { filePath, language, readonly = false }: Props = $props();

  let content: string = $state("");
  let originalContent: string = $state("");
  let isLoading = $state(true);
  let error: string | null = $state(null);
  let isDirty = $state(false);

  let textareaEl: HTMLTextAreaElement | undefined = $state(undefined);
  let preEl: HTMLPreElement | undefined = $state(undefined);
  let gutterEl: HTMLDivElement | undefined = $state(undefined);

  // Derived
  let lines = $derived(content.split("\n"));
  let lineCount = $derived(lines.length);
  let lineNumWidth = $derived(Math.max(3, String(lineCount).length));

  // Load file content
  $effect(() => {
    const path = filePath;
    const dbPath = projectStore.stagingDbPath;
    if (!path || !dbPath) {
      error = "No staging database available";
      isLoading = false;
      return;
    }
    isLoading = true;
    error = null;
    scriptRead(dbPath, path).then(text => {
      content = text ?? "";
      originalContent = text ?? "";
      isDirty = false;
      isLoading = false;
    }).catch(err => {
      error = String(err?.message ?? err);
      isLoading = false;
    });
  });

  // Sync scroll between textarea and overlay
  function syncScroll() {
    if (textareaEl && preEl) {
      preEl.scrollTop = textareaEl.scrollTop;
      preEl.scrollLeft = textareaEl.scrollLeft;
    }
    if (textareaEl && gutterEl) {
      gutterEl.scrollTop = textareaEl.scrollTop;
    }
  }

  // Handle input
  function handleInput() {
    if (textareaEl) {
      content = textareaEl.value;
      if (!isDirty && content !== originalContent) {
        isDirty = true;
        const tab = uiStore.openTabs.find(t => t.id === `script:${filePath}`);
        if (tab) tab.dirty = true;
      }
    }
  }

  // Handle keydown for Tab, Shift+Tab, Enter (auto-indent), Ctrl+S
  function handleKeydown(e: KeyboardEvent) {
    if (!textareaEl) return;

    // Ctrl+S → save
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      save();
      return;
    }

    // Escape → blur
    if (e.key === "Escape") {
      textareaEl.blur();
      return;
    }

    // Tab → insert tab/spaces
    if (e.key === "Tab" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      const start = textareaEl.selectionStart;
      const end = textareaEl.selectionEnd;

      if (e.shiftKey) {
        // Shift+Tab → dedent current line
        const lineStart = content.lastIndexOf("\n", start - 1) + 1;
        const lineText = content.slice(lineStart, end);
        if (lineText.startsWith("\t")) {
          content = content.slice(0, lineStart) + lineText.slice(1) + content.slice(end);
          textareaEl.value = content;
          textareaEl.selectionStart = Math.max(lineStart, start - 1);
          textareaEl.selectionEnd = Math.max(lineStart, end - 1);
        } else if (lineText.startsWith("  ")) {
          content = content.slice(0, lineStart) + lineText.slice(2) + content.slice(end);
          textareaEl.value = content;
          textareaEl.selectionStart = Math.max(lineStart, start - 2);
          textareaEl.selectionEnd = Math.max(lineStart, end - 2);
        }
      } else {
        // Tab → insert tab character
        content = content.slice(0, start) + "\t" + content.slice(end);
        textareaEl.value = content;
        textareaEl.selectionStart = textareaEl.selectionEnd = start + 1;
      }
      handleInput();
      return;
    }

    // Enter → auto-indent
    if (e.key === "Enter") {
      e.preventDefault();
      const start = textareaEl.selectionStart;
      const lineStart = content.lastIndexOf("\n", start - 1) + 1;
      const currentLine = content.slice(lineStart, start);
      const indent = currentLine.match(/^(\s*)/)?.[1] ?? "";
      const insertion = "\n" + indent;
      content = content.slice(0, start) + insertion + content.slice(textareaEl.selectionEnd);
      textareaEl.value = content;
      textareaEl.selectionStart = textareaEl.selectionEnd = start + insertion.length;
      handleInput();
      return;
    }
  }

  // Save to staging DB
  async function save() {
    if (readonly) return;
    const dbPath = projectStore.stagingDbPath;
    if (!dbPath) return;
    try {
      await scriptWrite(dbPath, filePath, content);
      originalContent = content;
      isDirty = false;
      const tab = uiStore.openTabs.find(t => t.id === `script:${filePath}`);
      if (tab) tab.dirty = false;
      toastStore.success(m.script_editor_saved_title(), m.script_editor_saved_message());
    } catch (err) {
      toastStore.error(m.script_editor_save_failed_title(), String(err));
    }
  }

  // Generate highlighted HTML for the overlay
  let highlightedHtml = $derived.by(() => {
    return lines.map(line => highlightLine(line, language)).join("\n");
  });
</script>

<div class="script-editor-panel">
  {#if isLoading}
    <div class="editor-empty">
      <Loader2 size={24} class="text-[var(--th-text-600)] animate-spin" />
      <p class="text-xs text-[var(--th-text-500)] mt-2">{m.script_editor_loading()}</p>
    </div>
  {:else if error}
    <div class="editor-empty">
      <AlertCircle size={24} class="text-red-400" />
      <p class="text-xs text-red-300 mt-2">{m.script_editor_load_failed()}</p>
      <p class="text-[10px] text-[var(--th-text-600)] mt-1 max-w-[300px]">{error}</p>
    </div>
  {:else}
    <div class="editor-header">
      <span class="text-xs font-medium text-[var(--th-text-200)] truncate">{filePath.split("/").pop()}</span>
      <span class="text-[10px] text-[var(--th-text-500)] uppercase ml-2">{language}</span>
      {#if isDirty}
        <span class="text-[10px] text-amber-400 ml-2">{m.script_editor_unsaved()}</span>
      {/if}
      {#if !readonly}
        <button
          class="ml-auto text-[10px] px-1.5 py-0.5 rounded text-[var(--th-text-400)] hover:text-[var(--th-text-200)] hover:bg-[var(--th-bg-700)] transition-colors flex items-center gap-1"
          onclick={save}
          aria-label={m.script_editor_save_label()}
        >
          <Save size={12} />
          {m.common_save()}
        </button>
      {/if}
      <span class="text-[10px] text-[var(--th-text-600)] ml-2">{m.script_editor_line_count({ count: lineCount })}</span>
    </div>
    <div class="editor-body">
      <!-- Line numbers gutter -->
      <div class="editor-gutter" bind:this={gutterEl} aria-hidden="true">
        {#each lines as _, i}
          <div class="gutter-line">{String(i + 1).padStart(lineNumWidth, " ")}</div>
        {/each}
      </div>
      <!-- Code area -->
      <div class="editor-code-area">
        <!-- Syntax highlight overlay -->
        <pre class="editor-highlight" bind:this={preEl} aria-hidden="true">{@html highlightedHtml}</pre>
        <!-- Actual textarea -->
        <textarea
          bind:this={textareaEl}
          class="editor-textarea"
          value={content}
          oninput={handleInput}
          onkeydown={handleKeydown}
          onscroll={syncScroll}
          readonly={readonly}
          spellcheck={false}
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          aria-label={m.script_editor_textarea_label()}
        ></textarea>
      </div>
    </div>
  {/if}
</div>

<style>
  .script-editor-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .editor-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    padding: 2rem;
  }

  .editor-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 16px;
    background: var(--th-bg-900);
    border-bottom: 1px solid var(--th-border-800);
    flex-shrink: 0;
  }

  .editor-body {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    font-family: "Cascadia Code", "Fira Code", "JetBrains Mono", monospace;
    font-size: 12px;
    line-height: 16px;
  }

  .editor-gutter {
    flex-shrink: 0;
    padding: 0.75rem 0.5rem 0.75rem 1rem;
    background: var(--th-bg-900);
    border-right: 1px solid var(--th-border-800);
    color: var(--th-text-700, #444);
    user-select: none;
    text-align: right;
    overflow: hidden;
    white-space: pre;
  }

  .gutter-line {
    height: 16px;
    line-height: 16px;
  }

  .editor-code-area {
    flex: 1;
    position: relative;
    overflow: hidden;
  }

  .editor-highlight {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    margin: 0;
    padding: 0.75rem 1rem;
    color: var(--th-text-300);
    white-space: pre;
    overflow: hidden;
    pointer-events: none;
    tab-size: 4;
    word-wrap: normal;
    font: inherit;
  }

  .editor-textarea {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0.75rem 1rem;
    background: transparent;
    color: transparent;
    caret-color: var(--th-text-200);
    border: none;
    outline: none;
    resize: none;
    white-space: pre;
    overflow: auto;
    tab-size: 4;
    word-wrap: normal;
    font: inherit;
  }

  .editor-textarea:focus {
    outline: none;
  }

  .editor-textarea::selection {
    background: rgba(56, 189, 248, 0.2);
  }

  /* Syntax highlighting tokens — same as FilePreviewPanel */
  .script-editor-panel :global(.hl-key) { color: #7dcfff; }
  .script-editor-panel :global(.hl-string) { color: #a9dc76; }
  .script-editor-panel :global(.hl-comment) { color: #6a6a7a; font-style: italic; }
  .script-editor-panel :global(.hl-bool) { color: #ff9e64; }
  .script-editor-panel :global(.hl-num) { color: #ff9e64; }
  .script-editor-panel :global(.hl-punct) { color: #89929b; }
  .script-editor-panel :global(.hl-keyword) { color: #bb9af7; }
  .script-editor-panel :global(.hl-attr) { color: #7dcfff; }
</style>
