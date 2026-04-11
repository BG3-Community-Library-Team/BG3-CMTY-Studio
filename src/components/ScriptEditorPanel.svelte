<script lang="ts">
  import { highlightLine } from "../lib/utils/syntaxHighlight.js";
  import type { ScriptLanguage } from "../lib/utils/syntaxHighlight.js";
  import { getCompletions, extractPrefix, type CompletionItem } from "../lib/utils/luaCompletions.js";
  import { scriptRead, scriptWrite } from "../lib/tauri/scripts.js";
  import { inferAllSectionsFromLsxContent } from "../lib/utils/lsxRegionParser.js";
  import { modStore } from "../lib/stores/modStore.svelte.js";
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
    hideHeader?: boolean;
    tabId?: string;
  }

  let { filePath, language, readonly = false, hideHeader = false, tabId }: Props = $props();

  let content: string = $state("");
  let originalContent: string = $state("");
  let isLoading = $state(true);
  let error: string | null = $state(null);
  let isDirty = $state(false);

  let textareaEl: HTMLTextAreaElement | undefined = $state(undefined);
  let preEl: HTMLPreElement | undefined = $state(undefined);
  let gutterEl: HTMLDivElement | undefined = $state(undefined);

  // Autocomplete state
  let suggestions: CompletionItem[] = $state([]);
  let selectedSuggestion = $state(0);
  let showSuggestions = $state(false);
  let suggestionX = $state(0);
  let suggestionY = $state(0);

  // Minimap state
  let minimapCanvas: HTMLCanvasElement | null = $state(null);
  let minimapVisible = $state(true);
  let minimapViewportTop = $state(0);
  let minimapViewportHeight = $state(0);
  let minimapDragging = $state(false);

  // Breadcrumb dropdown state
  let bcDropdownIdx: number | null = $state(null);
  let bcDropdownItems: { name: string; isDir: boolean; fullPath: string }[] = $state([]);
  let bcDropdownPos = $state({ top: 0, left: 0 });

  function toggleBreadcrumbDropdown(idx: number, e: MouseEvent) {
    if (bcDropdownIdx === idx) { bcDropdownIdx = null; return; }
    const btn = e.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    bcDropdownPos = { top: rect.bottom + 2, left: rect.left };
    const parentPath = breadcrumbs.slice(0, idx).join('/');
    const prefix = parentPath ? parentPath + '/' : '';
    const items = new Map<string, { isDir: boolean; fullPath: string }>();
    for (const f of modStore.modFiles) {
      if (!f.rel_path.startsWith(prefix)) continue;
      const rest = f.rel_path.slice(prefix.length);
      const slashIdx = rest.indexOf('/');
      if (slashIdx === -1) {
        items.set(rest, { isDir: false, fullPath: f.rel_path });
      } else {
        const dirName = rest.slice(0, slashIdx);
        if (!items.has(dirName)) items.set(dirName, { isDir: true, fullPath: prefix + dirName });
      }
    }
    bcDropdownItems = [...items.entries()]
      .map(([name, info]) => ({ name, ...info }))
      .filter(item => !item.isDir)
      .sort((a, b) => a.name.localeCompare(b.name));
    bcDropdownIdx = idx;
  }

  // Close breadcrumb dropdown on outside click
  function handleGlobalClick(e: MouseEvent) {
    if (bcDropdownIdx === null) return;
    const t = e.target as HTMLElement;
    if (!t.closest('.bc-dropdown') && !t.closest('.breadcrumb-segment')) {
      bcDropdownIdx = null;
    }
  }

  function handleBcDropdownKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      bcDropdownIdx = null;
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role="menuitem"]');
      if (items.length === 0) return;
      const current = Array.from(items).indexOf(document.activeElement as HTMLElement);
      let next: number;
      if (e.key === 'ArrowDown') {
        next = current < items.length - 1 ? current + 1 : 0;
      } else {
        next = current > 0 ? current - 1 : items.length - 1;
      }
      items[next]?.focus();
    }
    if (e.key === 'Home') {
      e.preventDefault();
      const first = (e.currentTarget as HTMLElement).querySelector<HTMLElement>('[role="menuitem"]');
      first?.focus();
    }
    if (e.key === 'End') {
      e.preventDefault();
      const items = (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role="menuitem"]');
      items[items.length - 1]?.focus();
    }
  }

  // Auto-focus first dropdown item when breadcrumb dropdown opens
  $effect(() => {
    if (bcDropdownIdx !== null) {
      requestAnimationFrame(() => {
        const first = document.querySelector('.bc-dropdown [role="menuitem"]') as HTMLElement;
        first?.focus();
      });
    }
  });

  async function bcDropdownSelect(item: { name: string; isDir: boolean; fullPath: string }) {
    bcDropdownIdx = null;
    if (item.isDir) {
      uiStore.expandedNodes[`modfile:${item.fullPath}`] = true;
      return;
    }

    const ext = item.name.split('.').pop()?.toLowerCase() ?? '';

    if (ext === 'lsx' || ext === 'lsefx') {
      // Infer category from folder path
      const segments = item.fullPath.split('/').filter(Boolean);
      let category = segments.length >= 2 ? segments[segments.length - 2] : '';
      let allSections: string[] = [];
      const modPath = modStore.projectPath || modStore.selectedModPath;
      if (modPath) {
        try {
          const fileContent = await scriptRead(modPath, item.fullPath);
          if (fileContent) {
            allSections = inferAllSectionsFromLsxContent(fileContent);
            if (allSections.length > 0) category = allSections[0];
          }
        } catch {
          // Fall back to folder-based inference silently
        }
      }
      uiStore.openTab({
        id: `lsx:${item.fullPath}`,
        label: item.name,
        type: 'lsx-file',
        filePath: item.fullPath,
        category,
        groupSections: allSections.length > 1 ? allSections : undefined,
        icon: '📄',
        preview: true,
      });
    } else if (ext === 'xml') {
      uiStore.openTab({ id: `file:${item.fullPath}`, label: item.name, type: 'file-preview', filePath: item.fullPath, icon: '📄', preview: true });
    } else {
      uiStore.openScriptTab(item.fullPath);
    }
  }

  // Derived
  let breadcrumbs = $derived(filePath.split('/').filter(Boolean));
  let lines = $derived(content.split("\n"));
  let lineCount = $derived(lines.length);
  let lineNumWidth = $derived(Math.max(3, String(lineCount).length));

  // Load file content
  $effect(() => {
    const path = filePath;
    const basePath = modStore.projectPath || modStore.selectedModPath;
    if (!path || !basePath) {
      error = "No mod folder selected";
      isLoading = false;
      return;
    }
    isLoading = true;
    error = null;
    scriptRead(basePath, path).then(text => {
      // Normalize line endings: CRLF → LF, stray CR → LF
      const normalized = (text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      content = normalized;
      originalContent = normalized;
      isDirty = false;
      isLoading = false;
    }).catch(err => {
      error = String(err?.message ?? err);
      isLoading = false;
    });
  });

  // Minimap rendering
  /** Convert a hex color (e.g. #7dcfff) to an rgba() string with the given alpha */
  function hexToRgba(hex: string, alpha: number): string {
    if (!hex || !hex.startsWith('#')) return `rgba(200, 200, 220, ${alpha})`;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function renderMinimap() {
    if (!minimapCanvas || !content) return;
    const ctx = minimapCanvas.getContext('2d');
    if (!ctx) return;

    const minimapLines = content.split('\n');
    const charWidth = 1.2;
    const lineHeight = 3;
    const width = 80;
    const height = Math.max(minimapLines.length * lineHeight, minimapCanvas.clientHeight);

    minimapCanvas.width = width;
    minimapCanvas.height = height;

    ctx.clearRect(0, 0, width, height);

    // Derive minimap colors from theme CSS variables
    const cs = minimapCanvas.parentElement ? getComputedStyle(minimapCanvas.parentElement) : null;
    const minimapCommentColor = cs ? hexToRgba(cs.getPropertyValue('--th-syntax-comment').trim() || cs.getPropertyValue('--th-text-600').trim(), 0.6) : 'rgba(106, 106, 122, 0.6)';
    const minimapBracketColor = cs ? hexToRgba(cs.getPropertyValue('--th-syntax-key').trim() || cs.getPropertyValue('--th-text-sky-400').trim(), 0.5) : 'rgba(125, 207, 255, 0.5)';
    const minimapStringColor = cs ? hexToRgba(cs.getPropertyValue('--th-syntax-string').trim() || cs.getPropertyValue('--th-text-emerald-400').trim(), 0.5) : 'rgba(169, 220, 118, 0.5)';
    const minimapDefaultColor = cs ? hexToRgba(cs.getPropertyValue('--th-text-400').trim() || '#c8c8dc', 0.35) : 'rgba(200, 200, 220, 0.35)';

    for (let i = 0; i < minimapLines.length; i++) {
      const line = minimapLines[i];
      const y = i * lineHeight;

      for (let j = 0; j < Math.min(line.length, Math.floor(width / charWidth)); j++) {
        const char = line[j];
        if (char === ' ' || char === '\t') continue;

        let color: string;
        if (line.trimStart().startsWith('--')) {
          color = minimapCommentColor;
        } else if (/[{}()\[\]]/.test(char)) {
          color = minimapBracketColor;
        } else if (/["']/.test(char)) {
          color = minimapStringColor;
        } else {
          color = minimapDefaultColor;
        }

        ctx.fillStyle = color;
        ctx.fillRect(j * charWidth, y, charWidth, lineHeight - 0.5);
      }
    }
  }

  function updateMinimapViewport() {
    if (!textareaEl || !minimapCanvas) return;
    const editorLineHeight = 16;
    const minimapLineHeight = 3;
    const visibleLines = Math.floor(textareaEl.clientHeight / editorLineHeight);
    const scrollLine = Math.floor(textareaEl.scrollTop / editorLineHeight);

    minimapViewportTop = scrollLine * minimapLineHeight;
    minimapViewportHeight = visibleLines * minimapLineHeight;
  }

  function scrollMinimapToY(clientY: number) {
    if (!minimapCanvas || !textareaEl) return;
    const rect = minimapCanvas.getBoundingClientRect();
    const y = clientY - rect.top;
    const minimapLineHeight = 3;
    const editorLineHeight = 16;
    const clickedLine = Math.floor(y / minimapLineHeight);
    // Center viewport on clicked line
    const visibleLines = Math.floor(textareaEl.clientHeight / editorLineHeight);
    textareaEl.scrollTop = (clickedLine - visibleLines / 2) * editorLineHeight;
    syncScroll();
  }

  function handleMinimapPointerDown(e: PointerEvent) {
    if (!minimapCanvas) return;
    minimapDragging = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    scrollMinimapToY(e.clientY);
  }

  function handleMinimapPointerMove(e: PointerEvent) {
    if (!minimapDragging) return;
    scrollMinimapToY(e.clientY);
  }

  function handleMinimapPointerUp(e: PointerEvent) {
    if (!minimapDragging) return;
    minimapDragging = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  }

  $effect(() => {
    if (content && minimapCanvas) {
      renderMinimap();
    }
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
    updateMinimapViewport();
  }

  // Handle input
  function handleInput() {
    if (textareaEl) {
      content = textareaEl.value;
      if (!isDirty && content !== originalContent) {
        isDirty = true;
        const tab = uiStore.openTabs.find(t => t.id === (tabId || `script:${filePath}`));
        if (tab) tab.dirty = true;
      }
      updateSuggestions();
    }
  }

  function updateSuggestions() {
    if (!textareaEl || language !== "lua") {
      suggestions = [];
      showSuggestions = false;
      return;
    }
    const pos = textareaEl.selectionStart;
    const textBefore = content.slice(0, pos);
    const lineStart = textBefore.lastIndexOf("\n") + 1;
    const lineText = textBefore.slice(lineStart);

    const matches = getCompletions(lineText, content, language);
    if (matches.length > 0) {
      suggestions = matches;
      selectedSuggestion = 0;
      showSuggestions = true;
      updateSuggestionPosition();
    } else {
      showSuggestions = false;
    }
  }

  function updateSuggestionPosition() {
    if (!textareaEl) return;
    const pos = textareaEl.selectionStart;
    const textBefore = content.slice(0, pos);
    const linesBefore = textBefore.split("\n");
    const lineNum = linesBefore.length;
    const colNum = linesBefore[linesBefore.length - 1].length;

    const lineHeight = 16;
    const charWidth = 7.2;

    const rect = textareaEl.getBoundingClientRect();
    suggestionX = rect.left + colNum * charWidth - textareaEl.scrollLeft;
    suggestionY = rect.top + lineNum * lineHeight - textareaEl.scrollTop + lineHeight;
  }

  function acceptSuggestion(comp: CompletionItem) {
    if (!textareaEl) return;
    const pos = textareaEl.selectionStart;
    const textBefore = content.slice(0, pos);
    const lineStart = textBefore.lastIndexOf("\n") + 1;
    const lineText = textBefore.slice(lineStart);

    const prefix = extractPrefix(lineText);
    const replaceStart = lineStart + (prefix ? lineText.length - prefix.length : lineText.length);

    content = content.slice(0, replaceStart) + comp.insertText + content.slice(pos);
    textareaEl.value = content;
    const newPos = replaceStart + comp.insertText.length;
    textareaEl.selectionStart = textareaEl.selectionEnd = newPos;
    showSuggestions = false;
    handleInput();
  }

  // Handle keydown for Tab, Shift+Tab, Enter (auto-indent), Ctrl+S
  function handleKeydown(e: KeyboardEvent) {
    if (!textareaEl) return;

    // Autocomplete keyboard nav
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedSuggestion = Math.min(selectedSuggestion + 1, suggestions.length - 1);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedSuggestion = Math.max(selectedSuggestion - 1, 0);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const idx = Math.min(selectedSuggestion, suggestions.length - 1);
        if (idx >= 0) acceptSuggestion(suggestions[idx]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        showSuggestions = false;
        return;
      }
    }

    // Ctrl+S → save
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      save();
      return;
    }

    // Ctrl+R → block browser refresh while editing
    if ((e.ctrlKey || e.metaKey) && e.key === "r") {
      e.preventDefault();
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

  // Save to disk
  export async function save() {
    if (readonly) return;
    const basePath = modStore.projectPath || modStore.selectedModPath;
    if (!basePath) return;
    try {
      await scriptWrite(basePath, filePath, content);
      originalContent = content;
      isDirty = false;
      const tab = uiStore.openTabs.find(t => t.id === (tabId || `script:${filePath}`));
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

<svelte:window onclick={handleGlobalClick} />
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
    {#if !hideHeader}
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
    {/if}
    <div class="breadcrumb-bar" role="toolbar" aria-label="File path" tabindex="-1" onclick={(e) => { if (!(e.target as HTMLElement).closest('.bc-dropdown')) bcDropdownIdx = null; }} onkeydown={(e) => { if (e.key === 'Escape') bcDropdownIdx = null; }}>
      {#each breadcrumbs as segment, i}
        {#if i > 0}
          <span class="breadcrumb-sep">/</span>
        {/if}
        <span class="bc-segment-wrap">
          <button
            class="breadcrumb-segment"
            class:breadcrumb-active={i === breadcrumbs.length - 1}
            aria-haspopup="menu"
            aria-expanded={bcDropdownIdx === i}
            onclick={(e) => { e.stopPropagation(); toggleBreadcrumbDropdown(i, e); }}
          >
            {segment}
          </button>
        </span>
      {/each}
    </div>
    {#if bcDropdownIdx !== null}
      <div class="bc-dropdown" role="menu" tabindex="-1" style="top:{bcDropdownPos.top}px;left:{bcDropdownPos.left}px"
        onclick={(e) => e.stopPropagation()}
        onkeydown={handleBcDropdownKeydown}>
        {#each bcDropdownItems as item}
          <button class="bc-dropdown-item" class:bc-dropdown-dir={item.isDir} role="menuitem" onclick={() => bcDropdownSelect(item)}>
            {item.name}{item.isDir ? '/' : ''}
          </button>
        {/each}
        {#if bcDropdownItems.length === 0}
          <span class="bc-dropdown-empty">No items</span>
        {/if}
      </div>
    {/if}
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
          id="script-textarea"
          class="editor-textarea"
          value={content}
          oninput={handleInput}
          onkeydown={handleKeydown}
          onscroll={syncScroll}
          onblur={() => { setTimeout(() => { showSuggestions = false; }, 150); }}
          readonly={readonly}
          spellcheck={false}
          autocomplete="off"
          aria-label={m.script_editor_textarea_label()}
        ></textarea>
      </div>
      {#if minimapVisible}
        <div
          class="minimap-container"
          role="scrollbar"
          tabindex="-1"
          aria-label="Code minimap"
          aria-controls="script-textarea"
          aria-valuenow={Math.round(minimapViewportTop)}
          onpointerdown={handleMinimapPointerDown}
          onpointermove={handleMinimapPointerMove}
          onpointerup={handleMinimapPointerUp}
        >
          <canvas
            bind:this={minimapCanvas}
            class="minimap-canvas"
          ></canvas>
          <div
            class="minimap-viewport"
            class:minimap-viewport-dragging={minimapDragging}
            style="top: {minimapViewportTop}px; height: {minimapViewportHeight}px;"
          ></div>
        </div>
      {/if}
    </div>
  {/if}

  {#if showSuggestions && suggestions.length > 0}
    <div
      class="autocomplete-dropdown"
      style="left: {suggestionX}px; top: {suggestionY}px"
      role="listbox"
    >
      {#each suggestions as suggestion, i}
        <button
          class="autocomplete-item"
          class:selected={i === selectedSuggestion}
          onclick={() => acceptSuggestion(suggestion)}
          onmouseenter={() => { selectedSuggestion = i; }}
          role="option"
          aria-selected={i === selectedSuggestion}
        >
          <span class="completion-icon">{suggestion.kind === 'function' ? 'ƒ' : suggestion.kind === 'module' ? '□' : suggestion.kind === 'keyword' ? '⌘' : suggestion.kind === 'snippet' ? '{}' : suggestion.kind === 'variable' ? 'x' : '●'}</span>
          <span class="completion-label">{suggestion.label}</span>
          <span class="completion-detail">{suggestion.detail}</span>
        </button>
      {/each}
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

  /* Syntax highlighting tokens — theme-aware via CSS variables */
  .script-editor-panel :global(.hl-key) { color: var(--th-syntax-key, var(--th-text-sky-400, #7dcfff)); }
  .script-editor-panel :global(.hl-string) { color: var(--th-syntax-string, var(--th-text-emerald-400, #a9dc76)); }
  .script-editor-panel :global(.hl-comment) { color: var(--th-syntax-comment, var(--th-text-600, #6a6a7a)); font-style: italic; }
  .script-editor-panel :global(.hl-bool) { color: var(--th-syntax-num, var(--th-text-amber-400, #ff9e64)); }
  .script-editor-panel :global(.hl-num) { color: var(--th-syntax-num, var(--th-text-amber-400, #ff9e64)); }
  .script-editor-panel :global(.hl-punct) { color: var(--th-syntax-punct, var(--th-text-500, #89929b)); }
  .script-editor-panel :global(.hl-keyword) { color: var(--th-syntax-keyword, var(--th-text-violet-400, #bb9af7)); }
  .script-editor-panel :global(.hl-attr) { color: var(--th-syntax-key, var(--th-text-sky-400, #7dcfff)); }

  /* Autocomplete dropdown */
  .autocomplete-dropdown {
    position: fixed;
    z-index: 100;
    background: var(--th-bg-800);
    border: 1px solid var(--th-border-subtle, var(--th-bg-600));
    border-radius: 4px;
    max-height: 200px;
    overflow-y: auto;
    min-width: 280px;
    max-width: 480px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .autocomplete-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    font-size: 12px;
    cursor: pointer;
    border: none;
    background: transparent;
    color: var(--th-text-primary, var(--th-text-200));
    width: 100%;
    text-align: left;
  }

  .autocomplete-item.selected {
    background: var(--th-accent-500);
    color: white;
  }

  .autocomplete-item:hover {
    background: var(--th-bg-700);
  }

  .autocomplete-item.selected:hover {
    background: var(--th-accent-500);
  }

  .completion-icon {
    width: 16px;
    text-align: center;
    font-size: 11px;
    color: var(--th-accent-400);
    flex-shrink: 0;
  }

  .completion-label {
    font-family: var(--font-mono, monospace);
    white-space: nowrap;
  }

  .completion-detail {
    margin-left: auto;
    font-size: 10px;
    color: var(--th-text-500);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 180px;
  }

  /* Breadcrumb bar */
  .breadcrumb-bar {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 2px 12px;
    background: var(--th-bg-850, var(--th-bg-800));
    border-bottom: 1px solid var(--th-border-subtle, var(--th-bg-700));
    font-size: 11px;
    overflow-x: auto;
    flex-shrink: 0;
    min-height: 22px;
  }

  .breadcrumb-segment {
    background: none;
    border: none;
    color: var(--th-text-400);
    cursor: pointer;
    padding: 1px 3px;
    border-radius: 3px;
    font-size: 11px;
    white-space: nowrap;
  }

  .breadcrumb-segment:hover {
    background: var(--th-bg-600);
    color: var(--th-text-200);
  }

  .breadcrumb-active {
    color: var(--th-text-200);
    font-weight: 500;
  }

  .breadcrumb-sep {
    color: var(--th-text-600);
    font-size: 10px;
  }

  .bc-segment-wrap {
    position: relative;
  }

  .bc-dropdown {
    position: fixed;
    z-index: 9999;
    min-width: 160px;
    max-height: 240px;
    overflow-y: auto;
    background: var(--th-bg-700);
    border: 1px solid var(--th-border-700);
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    padding: 2px 0;
  }

  .bc-dropdown-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: 3px 10px;
    font-size: 11px;
    background: none;
    border: none;
    color: var(--th-text-300);
    cursor: pointer;
    white-space: nowrap;
  }

  .bc-dropdown-item:hover {
    background: var(--th-accent-700, var(--th-bg-600));
    color: var(--th-text-100);
  }

  .bc-dropdown-dir {
    color: var(--th-text-sky-400, var(--th-text-200));
  }

  .bc-dropdown-empty {
    display: block;
    padding: 4px 10px;
    font-size: 11px;
    color: var(--th-text-600);
    font-style: italic;
  }

  /* Minimap */
  .minimap-container {
    position: relative;
    width: 80px;
    flex-shrink: 0;
    overflow: hidden;
    background: color-mix(in srgb, var(--th-bg-950, var(--th-bg-900)) 90%, black);
    border-left: 1px solid var(--th-border-subtle, var(--th-bg-700));
  }

  .minimap-canvas {
    display: block;
    width: 80px;
    cursor: pointer;
  }

  .minimap-viewport {
    position: absolute;
    left: 0;
    right: 0;
    background: color-mix(in srgb, var(--th-accent-500, #38bdf8) 18%, transparent);
    border: 1px solid color-mix(in srgb, var(--th-accent-500, #38bdf8) 30%, transparent);
    border-radius: 2px;
    pointer-events: none;
    transition: background 0.15s, border-color 0.15s;
  }

  .minimap-container:hover .minimap-viewport {
    background: color-mix(in srgb, var(--th-accent-500, #38bdf8) 26%, transparent);
    border-color: color-mix(in srgb, var(--th-accent-500, #38bdf8) 40%, transparent);
  }

  .minimap-viewport-dragging {
    background: color-mix(in srgb, var(--th-accent-500, #38bdf8) 32%, transparent) !important;
    border-color: color-mix(in srgb, var(--th-accent-500, #38bdf8) 50%, transparent) !important;
  }
</style>
