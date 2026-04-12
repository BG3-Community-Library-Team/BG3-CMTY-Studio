<script lang="ts">
  import type { ScriptLanguage } from "../lib/editor/types.js";
  import { scriptRead, scriptWrite } from "../lib/tauri/scripts.js";
  import { inferAllSectionsFromLsxContent } from "../lib/utils/lsxRegionParser.js";
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import { toastStore } from "../lib/stores/toastStore.svelte.js";
  import { uiStore } from "../lib/stores/uiStore.svelte.js";
  import CodeEditor from "./CodeEditor.svelte";
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

  let editorRef: CodeEditor | undefined = $state(undefined);

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
  let lineCount = $derived(content.split("\n").length);

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

  // Handle content changes from the CodeEditor
  function handleChange(newContent: string) {
    content = newContent;
    if (!isDirty && content !== originalContent) {
      isDirty = true;
      const tab = uiStore.openTabs.find(t => t.id === (tabId || `script:${filePath}`));
      if (tab) tab.dirty = true;
    }
  }

  // Save to disk
  export async function save() {
    if (readonly) return;
    const basePath = modStore.projectPath || modStore.selectedModPath;
    if (!basePath) return;
    // Grab latest content from editor
    if (editorRef) content = editorRef.getContent();
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
      <CodeEditor
        bind:this={editorRef}
        {content}
        {language}
        {readonly}
        onchange={handleChange}
        onsave={save}
      />
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
    flex: 1;
    min-height: 0;
    overflow: hidden;
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
</style>
