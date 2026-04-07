<script lang="ts">
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import { readModFile } from "../lib/utils/tauri.js";
  import { highlightLine } from "../lib/utils/syntaxHighlight.js";
  import VirtualList from "./VirtualList.svelte";
  import FileCode from "@lucide/svelte/icons/file-code";
  import AlertCircle from "@lucide/svelte/icons/alert-circle";
  import Loader2 from "@lucide/svelte/icons/loader-2";
  import Copy from "@lucide/svelte/icons/copy";
  import Check from "@lucide/svelte/icons/check";
  import { m } from "../paraglide/messages.js";

  interface Props {
    filePath: string;
  }

  let { filePath }: Props = $props();

  let content: string | null = $state(null);
  let error: string | null = $state(null);
  let isLoading = $state(false);

  let extension = $derived(filePath.split(".").pop()?.toLowerCase() ?? "");
  let fileName = $derived(filePath.split("/").pop() ?? filePath);
  let lines = $derived.by(() => {
    if (content == null) return [] as string[];
    return content.split("\n");
  });
  let lineNumWidth = $derived(Math.max(3, String(lines.length).length));

  let copied = $state(false);
  async function copyAll() {
    if (!content) return;
    await navigator.clipboard.writeText(content);
    copied = true;
    setTimeout(() => { copied = false; }, 1500);
  }

  // Load file content when filePath changes
  $effect(() => {
    const path = filePath;
    const modPath = modStore.selectedModPath;
    if (!path || !modPath) return;

    isLoading = true;
    error = null;
    content = null;

    readModFile(modPath, path).then(text => {
      content = text;
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
    {#if content != null}
      <button
        class="ml-auto text-[10px] px-1.5 py-0.5 rounded text-[var(--th-text-400)] hover:text-[var(--th-text-200)] hover:bg-[var(--th-bg-700)] transition-colors flex items-center gap-1"
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
      <VirtualList items={lines} itemHeight={16} threshold={200} role="none">
        {#snippet children({ item: line, index: i })}
          <div class="preview-line"><span class="line-number">{String(i + 1).padStart(lineNumWidth, " ")}</span>  {@html highlightLine(line, extension)}</div>
        {/snippet}
      </VirtualList>
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
    font-family: "Cascadia Code", "Fira Code", "JetBrains Mono", monospace;
    font-size: 12px;
    line-height: 16px;
    color: var(--th-text-300);
    tab-size: 2;
    white-space: pre;
    padding: 0.75rem 1rem;
  }

  .file-preview-content :global(.preview-line) {
    height: 16px;
    overflow: hidden;
  }

  .file-preview-content :global(.line-number) {
    display: inline-block;
    color: var(--th-text-700, #444);
    user-select: none;
    text-align: right;
    min-width: 2.5em;
  }

  /* Syntax highlighting tokens — reuse same classes as EditorTabs */
  .file-preview-content :global(.hl-key) { color: #7dcfff; }
  .file-preview-content :global(.hl-string) { color: #a9dc76; }
  .file-preview-content :global(.hl-comment) { color: #6a6a7a; font-style: italic; }
  .file-preview-content :global(.hl-bool) { color: #ff9e64; }
  .file-preview-content :global(.hl-num) { color: #ff9e64; }
  .file-preview-content :global(.hl-punct) { color: #89929b; }
  .file-preview-content :global(.hl-keyword) { color: #bb9af7; }
  .file-preview-content :global(.hl-attr) { color: #7dcfff; }

  /* Markdown-specific */
  .file-preview-content :global(.hl-md-heading) { color: #7dcfff; font-weight: 600; }
  .file-preview-content :global(.hl-md-bold) { color: var(--th-text-100); font-weight: 600; }
  .file-preview-content :global(.hl-md-italic) { color: var(--th-text-200); font-style: italic; }
  .file-preview-content :global(.hl-md-code) { color: #a9dc76; background: rgba(255,255,255,0.04); padding: 1px 3px; border-radius: 2px; }
  .file-preview-content :global(.hl-md-link) { color: #7aa2f7; text-decoration: underline; }
</style>
