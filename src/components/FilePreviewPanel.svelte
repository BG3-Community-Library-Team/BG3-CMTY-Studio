<script lang="ts">
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import { readModFile } from "../lib/utils/tauri.js";
  import { uiStore } from "../lib/stores/uiStore.svelte.js";
  import { scriptWrite } from "../lib/tauri/scripts.js";
  import { toastStore } from "../lib/stores/toastStore.svelte.js";
  import CodeEditor from "./CodeEditor.svelte";
  import FileCode from "@lucide/svelte/icons/file-code";
  import AlertCircle from "@lucide/svelte/icons/alert-circle";
  import Loader2 from "@lucide/svelte/icons/loader-2";
  import Copy from "@lucide/svelte/icons/copy";
  import Check from "@lucide/svelte/icons/check";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Save from "@lucide/svelte/icons/save";
  import { m } from "../paraglide/messages.js";

  interface Props {
    filePath: string;
  }

  let { filePath }: Props = $props();

  let content: string | null = $state(null);
  let originalContent: string | null = $state(null);
  let error: string | null = $state(null);
  let isLoading = $state(false);
  let editing = $state(false);

  let extension = $derived(filePath.split(".").pop()?.toLowerCase() ?? "");
  let fileName = $derived(filePath.split("/").pop() ?? filePath);
  let detectedLanguage = $derived(uiStore.detectScriptLanguage(filePath));
  let dirty = $derived(editing && content !== originalContent);

  // Sync dirty state to the EditorTab
  $effect(() => {
    const isDirty = dirty;
    const tab = uiStore.openTabs.find(t => t.filePath === filePath && t.type === "file-preview");
    if (tab && tab.dirty !== isDirty) tab.dirty = isDirty;
  });

  let copied = $state(false);
  async function copyAll() {
    if (!content) return;
    await navigator.clipboard.writeText(content);
    copied = true;
    setTimeout(() => { copied = false; }, 1500);
  }

  function handleChange(newContent: string) {
    content = newContent;
  }

  async function save() {
    if (!content) return;
    const basePath = modStore.projectPath || modStore.selectedModPath;
    if (!basePath) return;
    try {
      await scriptWrite(basePath, filePath, content);
      originalContent = content;
      toastStore.success(m.file_preview_save_success(), fileName);
    } catch (err) {
      toastStore.error(m.file_preview_save_failed(), String(err));
    }
  }

  function toggleEdit() {
    editing = !editing;
  }

  // Load file content when filePath changes
  $effect(() => {
    const path = filePath;
    const basePath = modStore.projectPath || modStore.selectedModPath;
    if (!path || !basePath) return;

    isLoading = true;
    error = null;
    content = null;
    originalContent = null;
    editing = false;

    readModFile(basePath, path).then(text => {
      content = text;
      originalContent = text;
    }).catch(err => {
      error = String(err?.message ?? err);
    }).finally(() => {
      isLoading = false;
    });
  });
</script>

<div class="file-preview-panel">
  <div class="file-preview-header">
    <FileCode size={14} class="text-[var(--th-accent-500)]" />
    <span class="text-xs font-medium text-[var(--th-text-200)] truncate">{fileName}</span>
    {#if dirty}
      <span class="text-[10px] text-amber-400 font-medium" title={m.file_preview_unsaved()}>●</span>
    {/if}
    {#if content != null}
      <div class="ml-auto flex items-center gap-1">
        {#if editing && dirty}
          <button
            class="text-[10px] px-1.5 py-0.5 rounded text-emerald-400 hover:text-emerald-300 hover:bg-[var(--th-bg-700)] transition-colors flex items-center gap-1"
            onclick={save}
            aria-label={m.common_save()}
          >
            <Save size={12} />
            {m.common_save()}
          </button>
        {/if}
        <button
          class="text-[10px] px-1.5 py-0.5 rounded transition-colors flex items-center gap-1"
          class:text-amber-400={editing}
          class:hover:text-amber-300={editing}
          class:text-[var(--th-text-400)]={!editing}
          class:hover:text-[var(--th-text-200)]={!editing}
          class:hover:bg-[var(--th-bg-700)]={true}
          onclick={toggleEdit}
          aria-label={m.file_preview_edit()}
          aria-pressed={editing}
        >
          <Pencil size={12} />
          {editing ? m.file_preview_editing() : m.file_preview_edit()}
        </button>
        <button
          class="text-[10px] px-1.5 py-0.5 rounded text-[var(--th-text-400)] hover:text-[var(--th-text-200)] hover:bg-[var(--th-bg-700)] transition-colors flex items-center gap-1"
          onclick={copyAll}
          aria-label={m.file_preview_copy_title()}
        >
          {#if copied}
            <Check size={12} />
            {m.common_copied()}
          {:else}
            <Copy size={12} />
            {m.common_copy()}
          {/if}
        </button>
      </div>
    {/if}
    {#if extension}
      <span class="text-[10px] text-[var(--th-text-500)] {content != null ? '' : 'ml-auto'}">{extension.toUpperCase()}</span>
    {/if}
  </div>

  {#if isLoading}
    <div class="file-preview-empty">
      <Loader2 size={24} class="text-[var(--th-text-600)] animate-spin" />
      <p class="text-xs text-[var(--th-text-500)] mt-2">{m.file_preview_loading()}</p>
    </div>
  {:else if error}
    <div class="file-preview-empty">
      <AlertCircle size={24} class="text-red-400" />
      <p class="text-xs text-red-300 mt-2">{m.file_preview_failed()}</p>
      <p class="text-[10px] text-[var(--th-text-600)] mt-1 max-w-[300px]">{error}</p>
    </div>
  {:else if content != null}
    <div class="file-preview-content">
      <CodeEditor
        content={content}
        language={detectedLanguage}
        readonly={!editing}
        onchange={handleChange}
        onsave={save}
      />
    </div>
  {/if}
</div>

<style>
  .file-preview-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .file-preview-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 16px;
    background: var(--th-bg-900);
    border-bottom: 1px solid var(--th-border-800);
    flex-shrink: 0;
  }

  .file-preview-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    padding: 2rem;
  }

  .file-preview-content {
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }
</style>
