<script lang="ts">
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import { toastStore } from "../lib/stores/toastStore.svelte.js";
  import { findReadme, readTextFile, writeTextFile } from "../lib/tauri/readme.js";
  import { getErrorMessage } from "../lib/types/index.js";
  import { onMount } from "svelte";
  import Eye from "@lucide/svelte/icons/eye";
  import EyeOff from "@lucide/svelte/icons/eye-off";
  import Save from "@lucide/svelte/icons/save";
  // FileDown removed — BBCode uses ClipboardCopy since it copies to clipboard
  import FileText from "@lucide/svelte/icons/file-text";
  import ClipboardCopy from "@lucide/svelte/icons/clipboard-copy";
  import { markdownToBBCode } from "../lib/utils/bbcodeConverter.js";
  import { markdownToPlainText } from "../lib/utils/markdownToPlainText.js";


  let content = $state("");
  let previewMode = $state(false);
  let isSaving = $state(false);
  let loaded = $state(false);

  /** Resolved path to the README file (found on disk, or default for new). */
  let readmePath = $state("");

  function buildTemplate(): string {
    const meta = modStore.scanResult?.mod_meta;
    const name = meta?.name ?? "My Mod";
    const version = meta?.version ?? "1.0.0.0";
    const description = meta?.description ?? "";

    return `# ${name}
_v${version}_

## About
${description}

(Insert details about your mod here)

## Installation
Add installation instructions here. Example:

### BG3 Mod Manager
1. Download the latest release and drag it onto BG3 Mod Manager
2. Move ${name} from the right pane to the left pane
3. Hit "Save Load Order to File" and "Export Load Order"

## Changelog
**v${version}**
- Initial release
`;
  }

  onMount(async () => {
    const modPath = modStore.selectedModPath;
    if (!modPath) {
      content = buildTemplate();
      loaded = true;
      return;
    }

    // Search parent directory (project root) and mod folder for existing readme
    const foundPath = await findReadme(modPath);
    if (foundPath) {
      readmePath = foundPath;
      const existing = await readTextFile(foundPath);
      content = existing ?? buildTemplate();
    } else {
      // Default: save new README to parent directory (project root)
      const parent = modPath.replace(/[\\/][^\\/]+$/, "");
      readmePath = parent !== modPath ? `${parent}/README.md` : `${modPath}/README.md`;
      content = buildTemplate();
    }
    loaded = true;
  });

  async function handleSave() {
    if (!readmePath) {
      toastStore.error("Cannot save", "No mod folder selected");
      return;
    }
    isSaving = true;
    try {
      await writeTextFile(readmePath, content);
      toastStore.success("README saved", readmePath);
    } catch (e: unknown) {
      toastStore.error("Save failed", getErrorMessage(e));
    } finally {
      isSaving = false;
    }
  }

  async function handleExportTxt() {
    if (!readmePath) {
      toastStore.error("Cannot export", "No README path resolved");
      return;
    }
    try {
      const plainText = markdownToPlainText(content);
      const txtPath = readmePath.replace(/\.[^.]+$/, ".txt");
      await writeTextFile(txtPath, plainText);
      toastStore.success("Exported to " + txtPath);
    } catch (e: unknown) {
      toastStore.error("Export failed", getErrorMessage(e));
    }
  }

  /** Basic markdown → HTML renderer. Strips <script> tags for safety. */
  function renderMarkdown(md: string): string {
    // Normalize Windows line endings
    let html = md.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    // Collect fenced code blocks before line splitting so inner
    // newlines don't get re-processed as markdown.
    const codeBlocks: string[] = [];
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => {
      const escaped = escapeHtml(code.trimEnd());
      const idx = codeBlocks.length;
      codeBlocks.push(`<pre class="md-pre"><code>${escaped}</code></pre>`);
      return `\x00CODEBLOCK${idx}\x00`;
    });

    // Split into lines for block-level processing
    const lines = html.split("\n");
    const out: string[] = [];
    let inList = false;

    for (const line of lines) {
      // Restore code block placeholders
      const cbMatch = line.match(/^\x00CODEBLOCK(\d+)\x00$/);
      if (cbMatch) {
        if (inList) { out.push("</ul>"); inList = false; }
        out.push(codeBlocks[Number(cbMatch[1])]);
        continue;
      }

      // Headers
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headerMatch) {
        if (inList) { out.push("</ul>"); inList = false; }
        const level = headerMatch[1].length;
        out.push(`<h${level} class="md-h${level}">${processInline(headerMatch[2])}</h${level}>`);
        continue;
      }

      // List items
      if (/^[-*]\s+/.test(line)) {
        if (!inList) { out.push('<ul class="md-ul">'); inList = true; }
        out.push(`<li>${processInline(line.replace(/^[-*]\s+/, ""))}</li>`);
        continue;
      }

      // Numbered list items
      if (/^\d+\.\s+/.test(line)) {
        if (inList) { out.push("</ul>"); inList = false; }
        out.push(`<p class="md-li-num">${processInline(line)}</p>`);
        continue;
      }

      // Empty line
      if (line.trim() === "") {
        if (inList) { out.push("</ul>"); inList = false; }
        out.push("<br/>");
        continue;
      }

      // Paragraph
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<p>${processInline(line)}</p>`);
    }

    if (inList) out.push("</ul>");

    let result = out.join("\n");
    // Strip script tags for safety
    result = result.replace(/<script[\s\S]*?<\/script>/gi, "");
    return result;
  }

  function processInline(text: string): string {
    let s = escapeHtml(text);
    // Inline code
    s = s.replace(/`([^`]+)`/g, '<code class="md-code">$1</code>');
    // Bold
    s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    // Italic (underscore)
    s = s.replace(/(?<!\w)_(.+?)_(?!\w)/g, "<em>$1</em>");
    // Images (must come before links)
    s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="md-img" />');
    // Links
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="md-link">$1</a>');
    return s;
  }

  function escapeHtml(s: string): string {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  let previewHtml = $derived(renderMarkdown(content));
</script>

<div class="readme-editor">
  <!-- Toolbar -->
  <div class="readme-toolbar">
    <span class="readme-title">README.md</span>
    <div class="readme-actions">
      <button
        class="readme-btn"
        onclick={() => previewMode = !previewMode}
        title={previewMode ? "Edit" : "Preview"}
      >
        {#if previewMode}
          <EyeOff size={14} />
        {:else}
          <Eye size={14} />
        {/if}
        <span>{previewMode ? "Edit" : "Preview"}</span>
      </button>
      <button
        class="readme-btn readme-btn-primary"
        onclick={handleSave}
        disabled={isSaving || !readmePath}
        title="Save README.md"
      >
        <Save size={14} />
        <span>{isSaving ? "Saving…" : "Save"}</span>
      </button>
      <button
        class="readme-btn"
        onclick={handleExportTxt}
        title="Export as .txt"
      >
        <FileText size={14} />
        <span>.txt</span>
      </button>

      <button
        class="readme-btn"
        onclick={async () => {
          const bbcode = markdownToBBCode(content);
          await navigator.clipboard.writeText(bbcode);
          toastStore.success("Copied BBCode to clipboard");
        }}
        title="Convert to BBCode and copy to clipboard"
      >
        <ClipboardCopy size={14} />
        <span>BBCode</span>
      </button>
    </div>
  </div>

  <!-- Content area -->
  <div class="readme-content">
    {#if !loaded}
      <div class="readme-loading">Loading…</div>
    {:else if previewMode}
      <div class="readme-preview" data-selectable="true">
        {@html previewHtml}
      </div>
    {:else}
      <textarea
        class="readme-textarea"
        bind:value={content}
        placeholder="Write your README here…"
        spellcheck="true"
      ></textarea>
    {/if}
  </div>
</div>

<style>
  .readme-editor {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .readme-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    border-bottom: 1px solid var(--th-border-700);
    background: var(--th-bg-800);
    flex-shrink: 0;
  }

  .readme-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--th-text-200);
    font-family: monospace;
  }

  .readme-actions {
    display: flex;
    gap: 6px;
  }

  .readme-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    font-size: 11px;
    border-radius: 4px;
    border: 1px solid var(--th-border-700);
    background: var(--th-bg-700);
    color: var(--th-text-300);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .readme-btn:hover:not(:disabled) {
    background: var(--th-bg-600);
    color: var(--th-text-100);
  }

  .readme-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .readme-btn-primary {
    background: var(--th-accent-700, #0369a1);
    border-color: var(--th-accent-600, #0284c7);
    color: #fff;
  }

  .readme-btn-primary:hover:not(:disabled) {
    background: var(--th-accent-600, #0284c7);
  }

  .readme-content {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  .readme-textarea {
    width: 100%;
    height: 100%;
    resize: none;
    border: none;
    outline: none;
    padding: 16px 20px;
    font-family: "Cascadia Code", "Fira Code", "JetBrains Mono", "Consolas", monospace;
    font-size: 13px;
    line-height: 1.6;
    background: var(--th-bg-900);
    color: var(--th-text-200);
    tab-size: 2;
  }

  .readme-textarea::placeholder {
    color: var(--th-text-600);
  }

  .readme-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--th-text-500);
    font-size: 13px;
  }

  .readme-preview {
    padding: 20px 24px;
    max-width: 800px;
    color: var(--th-text-200);
    line-height: 1.7;
    font-size: 14px;
  }

  .readme-preview :global(.md-h1) { font-size: 1.8em; font-weight: 700; margin: 0.6em 0 0.3em; color: var(--th-text-100); border-bottom: 1px solid var(--th-border-700); padding-bottom: 0.2em; }
  .readme-preview :global(.md-h2) { font-size: 1.4em; font-weight: 600; margin: 0.5em 0 0.2em; color: var(--th-text-100); }
  .readme-preview :global(.md-h3) { font-size: 1.15em; font-weight: 600; margin: 0.4em 0 0.2em; color: var(--th-text-200); }
  .readme-preview :global(.md-h4) { font-size: 1em; font-weight: 600; margin: 0.3em 0 0.15em; color: var(--th-text-200); }
  .readme-preview :global(p) { margin: 0.15em 0; }
  .readme-preview :global(strong) { font-weight: 600; color: var(--th-text-100); }
  .readme-preview :global(em) { font-style: italic; }
  .readme-preview :global(.md-ul) { padding-left: 1.5em; margin: 0.3em 0; }
  .readme-preview :global(li) { margin: 0.15em 0; }
  .readme-preview :global(.md-li-num) { padding-left: 1.5em; margin: 0.1em 0; }
  .readme-preview :global(.md-code) { background: var(--th-bg-700); padding: 1px 5px; border-radius: 3px; font-family: monospace; font-size: 0.9em; }
  .readme-preview :global(.md-pre) { background: var(--th-bg-800); border: 1px solid var(--th-border-700); border-radius: 6px; padding: 12px 16px; overflow-x: auto; margin: 0.5em 0; }
  .readme-preview :global(.md-pre code) { font-family: monospace; font-size: 13px; color: var(--th-text-300); }
  .readme-preview :global(.md-link) { color: var(--th-accent-400, #38bdf8); text-decoration: underline; }
  .readme-preview :global(.md-img) { max-width: 100%; height: auto; border-radius: 6px; margin: 0.5em 0; }
  .readme-preview :global(br) { display: block; margin: 0.3em 0; content: ""; }
</style>
