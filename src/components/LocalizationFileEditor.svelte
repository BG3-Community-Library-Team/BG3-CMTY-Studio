<!--
  Localization contentList Form Editor — Structured form for editing .xml localization contentList files.
  Provides form-based editing of <content> entries with contentuid, version, and text.
  Includes a toggle to switch to raw XML editing via ScriptEditorPanel.
-->
<script lang="ts">
  import { scriptRead, scriptWrite } from "../lib/tauri/scripts.js";
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import { toastStore } from "../lib/stores/toastStore.svelte.js";
  import { uiStore } from "../lib/stores/uiStore.svelte.js";
  import ScriptEditorPanel from "./ScriptEditorPanel.svelte";
  import Loader2 from "@lucide/svelte/icons/loader-2";
  import AlertCircle from "@lucide/svelte/icons/alert-circle";
  import Save from "@lucide/svelte/icons/save";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import { m } from "../paraglide/messages.js";

  interface Props {
    filePath: string;
  }

  let { filePath }: Props = $props();

  // ── Types ──
  interface ContentEntry {
    id: string;
    contentuid: string;
    version: number;
    text: string;
  }

  // ── Form state ──
  let entries: ContentEntry[] = $state([]);
  let dateAttr = $state("");

  // ── UI state ──
  let isLoading = $state(true);
  let error: string | null = $state(null);
  let rawMode = $state(false);
  let rawContent = $state("");
  let parseError: string | null = $state(null);
  let confirmDeleteId: string | null = $state(null);

  // ── Validation: detect duplicate contentuid+version pairs ──
  let duplicates: Set<string> = $derived.by(() => {
    const seen = new Map<string, number>();
    const dupes = new Set<string>();
    for (const entry of entries) {
      const key = `${entry.contentuid}::${entry.version}`;
      const count = (seen.get(key) ?? 0) + 1;
      seen.set(key, count);
      if (count > 1) dupes.add(key);
    }
    return dupes;
  });

  // ── BG3 handle UID generation ──
  function generateBG3Handle(): string {
    return "h" + crypto.randomUUID().replaceAll("-", "g");
  }

  // ── Date formatting: MM/DD/YYYY HH:MM ──
  function formatDate(d: Date): string {
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${mm}/${dd}/${yyyy} ${hh}:${min}`;
  }

  // ── XML escaping ──
  function escapeXml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function unescapeXml(text: string): string {
    return text
      .replace(/&quot;/g, '"')
      .replace(/&gt;/g, ">")
      .replace(/&lt;/g, "<")
      .replace(/&amp;/g, "&");
  }

  // ── Parse contentList XML ──
  function parseContentListXml(xml: string): boolean {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, "text/xml");
      const parserError = doc.querySelector("parsererror");
      if (parserError) return false;

      const contentList = doc.querySelector("contentList");
      if (!contentList) return false;

      dateAttr = contentList.getAttribute("date") ?? formatDate(new Date());

      const contentNodes = contentList.querySelectorAll("content");
      const parsed: ContentEntry[] = [];
      for (const node of contentNodes) {
        const contentuid = node.getAttribute("contentuid") ?? "";
        const versionStr = node.getAttribute("version") ?? "1";
        const version = parseInt(versionStr, 10);
        const text = node.textContent ?? "";
        parsed.push({
          id: crypto.randomUUID(),
          contentuid,
          version: isNaN(version) ? 1 : version,
          text,
        });
      }
      entries = parsed;
      return true;
    } catch {
      return false;
    }
  }

  // ── Serialize entries to XML ──
  function entriesToXml(): string {
    const date = dateAttr || formatDate(new Date());
    const lines = entries.map(
      (e) =>
        `  <content contentuid="${escapeXml(e.contentuid)}" version="${e.version}">${escapeXml(e.text)}</content>`,
    );
    return `<?xml version="1.0" encoding="utf-8"?>\n<contentList date="${date}">\n${lines.join("\n")}\n</contentList>\n`;
  }

  // ── Load content on mount / filePath change ──
  $effect(() => {
    const path = filePath;
    const modPath = modStore.selectedModPath;
    if (!path || !modPath) {
      error = m.loca_editor_no_mod();
      isLoading = false;
      return;
    }
    isLoading = true;
    error = null;
    parseError = null;
    scriptRead(modPath, path)
      .then((text) => {
        if (text && text.trim()) {
          rawContent = text;
          if (!parseContentListXml(text)) {
            rawMode = true;
            parseError = m.loca_editor_invalid_xml();
          }
        } else {
          // New file — initialize with defaults
          dateAttr = formatDate(new Date());
          entries = [
            {
              id: crypto.randomUUID(),
              contentuid: generateBG3Handle(),
              version: 1,
              text: "",
            },
          ];
          rawContent = entriesToXml();
        }
        isLoading = false;
      })
      .catch((err) => {
        error = String(err?.message ?? err);
        isLoading = false;
      });
  });

  // ── Save to disk ──
  async function saveForm() {
    const modPath = modStore.selectedModPath;
    if (!modPath) return;
    if (duplicates.size > 0 && !rawMode) {
      toastStore.error(m.loca_editor_save_failed_title(), m.loca_editor_duplicate_error());
      return;
    }
    const xml = rawMode ? rawContent : entriesToXml();
    try {
      await scriptWrite(modPath, filePath, xml);
      rawContent = xml;
      const tab = uiStore.openTabs.find((t) => t.id === `script:${filePath}`);
      if (tab) tab.dirty = false;
      toastStore.success(m.loca_editor_saved_title(), m.loca_editor_saved_message());
    } catch (err) {
      toastStore.error(m.loca_editor_save_failed_title(), String(err));
    }
  }

  // ── Toggle between raw and form mode ──
  function toggleMode() {
    if (rawMode) {
      // raw → form: parse rawContent
      if (parseContentListXml(rawContent)) {
        parseError = null;
        rawMode = false;
      } else {
        parseError = m.loca_editor_invalid_xml();
      }
    } else {
      // form → raw: serialize entries
      rawContent = entriesToXml();
      parseError = null;
      rawMode = true;
    }
  }

  // ── Mark tab dirty ──
  function markDirty() {
    const tab = uiStore.openTabs.find((t) => t.id === `script:${filePath}`);
    if (tab && !tab.dirty) tab.dirty = true;
  }

  // ── Add entry ──
  function addEntry() {
    entries = [
      ...entries,
      {
        id: crypto.randomUUID(),
        contentuid: generateBG3Handle(),
        version: 1,
        text: "",
      },
    ];
    markDirty();
  }

  // ── Remove entry ──
  function removeEntry(id: string) {
    entries = entries.filter((e) => e.id !== id);
    confirmDeleteId = null;
    markDirty();
  }

  // ── Helpers to check duplicate state for a given entry ──
  function isDuplicate(entry: ContentEntry): boolean {
    return duplicates.has(`${entry.contentuid}::${entry.version}`);
  }
</script>

<div class="loca-file-editor">
  {#if isLoading}
    <div class="editor-empty">
      <Loader2 size={24} class="text-[var(--th-text-600)] animate-spin" />
      <p class="text-xs text-[var(--th-text-500)] mt-2">{m.common_loading()}</p>
    </div>
  {:else if error}
    <div class="editor-empty">
      <AlertCircle size={24} class="text-red-400" />
      <p class="text-xs text-red-300 mt-2">{m.loca_editor_load_failed()}</p>
      <p class="text-[10px] text-[var(--th-text-600)] mt-1 max-w-[300px]">{error}</p>
    </div>
  {:else}
    <!-- Header bar -->
    <div class="editor-header">
      <span class="text-xs font-medium text-[var(--th-text-200)] truncate"
        >{filePath.split("/").pop()}</span
      >
      <div class="ml-auto flex items-center gap-2">
        {#if parseError}
          <span class="text-[10px] text-amber-400 flex items-center gap-1">
            <AlertCircle size={12} />
            {parseError}
          </span>
        {/if}
        <div class="mode-pill" role="tablist" aria-label="View mode">
          <button
            class="mode-pill-option"
            class:active={!rawMode}
            onclick={() => { if (rawMode) toggleMode(); }}
            role="tab"
            aria-selected={!rawMode}
          >
            {m.loca_editor_form_mode()}
          </button>
          <button
            class="mode-pill-option"
            class:active={rawMode}
            onclick={() => { if (!rawMode) toggleMode(); }}
            role="tab"
            aria-selected={rawMode}
          >
            Raw XML
          </button>
        </div>
          <button class="save-btn" onclick={saveForm} aria-label={m.common_save()}>
            <Save size={12} />
            {m.common_save()}
          </button>
      </div>
    </div>

    {#if rawMode}
      <!-- Raw XML editing via ScriptEditorPanel -->
      <div class="flex-1 min-h-0">
        <ScriptEditorPanel {filePath} language="xml" />
      </div>
    {:else}
      <!-- Structured form -->
      <div class="form-body">
        <!-- Entry count + add button -->
        <div class="form-toolbar">
          <span class="text-xs text-[var(--th-text-400)]">
            {entries.length}
            {entries.length === 1
              ? m.loca_editor_entry_count_singular()
              : m.loca_editor_entry_count()}
          </span>
          <button
            class="add-btn"
            onclick={addEntry}
            aria-label={m.loca_editor_add_entry()}
          >
            <Plus size={12} />
            {m.loca_editor_add_entry()}
          </button>
        </div>

        {#if duplicates.size > 0}
          <div class="validation-banner" role="alert">
            <AlertCircle size={14} />
            <span>{m.loca_editor_duplicate_warning()}</span>
          </div>
        {/if}

        <!-- Entries table -->
        <div class="entries-table-wrapper" role="region" aria-label={m.loca_editor_entries_aria()}>
          <table class="entries-table" aria-label={m.loca_editor_entries_aria()}>
            <thead>
              <tr>
                <th class="uid-col">{m.localization_contentuid_label()}</th>
                <th class="ver-col">{m.localization_version_label()}</th>
                <th class="text-col">{m.loca_editor_text_col()}</th>
                <th class="action-col">
                  <span class="sr-only">{m.loca_editor_actions_col()}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {#each entries as entry (entry.id)}
                {@const hasDupe = isDuplicate(entry)}
                <tr class:duplicate-row={hasDupe}>
                  <td class="uid-col">
                    <input
                      type="text"
                      class="cell-input font-mono"
                      class:cell-invalid={hasDupe}
                      value={entry.contentuid}
                      oninput={(e) => {
                        entry.contentuid = e.currentTarget.value;
                        markDirty();
                      }}
                      aria-label="{m.localization_contentuid_label()} {entry.contentuid.slice(0, 8)}"
                      aria-invalid={hasDupe}
                    />
                  </td>
                  <td class="ver-col">
                    <input
                      type="number"
                      class="cell-input"
                      class:cell-invalid={hasDupe}
                      value={entry.version}
                      oninput={(e) => {
                        const v = parseInt(e.currentTarget.value, 10);
                        if (!isNaN(v) && v >= 0) {
                          entry.version = v;
                          markDirty();
                        }
                      }}
                      min="0"
                      step="1"
                      aria-label="{m.localization_version_label()} {entry.contentuid.slice(0, 8)}"
                      aria-invalid={hasDupe}
                    />
                  </td>
                  <td class="text-col">
                    <input
                      type="text"
                      class="cell-input"
                      value={entry.text}
                      oninput={(e) => {
                        entry.text = e.currentTarget.value;
                        markDirty();
                      }}
                      placeholder={m.localization_locale_text_placeholder()}
                      aria-label="{m.loca_editor_text_col()} {entry.contentuid.slice(0, 8)}"
                    />
                  </td>
                  <td class="action-col">
                    {#if confirmDeleteId === entry.id}
                      <div class="confirm-delete">
                        <button
                          class="confirm-yes"
                          onclick={() => removeEntry(entry.id)}
                          aria-label={m.loca_editor_confirm_delete()}
                        >
                          {m.loca_editor_confirm_yes()}
                        </button>
                        <button
                          class="confirm-no"
                          onclick={() => (confirmDeleteId = null)}
                          aria-label={m.loca_editor_cancel_delete()}
                        >
                          {m.loca_editor_confirm_no()}
                        </button>
                      </div>
                    {:else}
                      <button
                        class="delete-btn"
                        onclick={() => (confirmDeleteId = entry.id)}
                        aria-label={m.loca_editor_remove_entry()}
                        title={m.loca_editor_remove_entry()}
                      >
                        <Trash2 size={12} />
                      </button>
                    {/if}
                  </td>
                </tr>
                {#if hasDupe}
                  <tr class="dupe-hint-row" aria-hidden="true">
                    <td colspan="4">
                      <span class="text-[10px] text-red-400">{m.loca_editor_duplicate_hint()}</span>
                    </td>
                  </tr>
                {/if}
              {/each}

              {#if entries.length === 0}
                <tr>
                  <td colspan="4" class="empty-cell">
                    <span class="text-xs text-[var(--th-text-500)]">{m.loca_editor_no_entries()}</span>
                  </td>
                </tr>
              {/if}
            </tbody>
          </table>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .loca-file-editor {
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

  .mode-pill {
    display: inline-flex;
    border-radius: 9999px;
    border: 1px solid var(--th-border-700);
    background: var(--th-bg-800);
    overflow: hidden;
  }

  .mode-pill-option {
    font-size: 10px;
    padding: 2px 10px;
    border: none;
    background: transparent;
    color: var(--th-text-400);
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
    white-space: nowrap;
  }

  .mode-pill-option:hover {
    color: var(--th-text-200);
  }

  .mode-pill-option.active {
    background: var(--th-accent, #4a9eff);
    color: var(--th-text-on-accent, #fff);
  }

  .save-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 4px;
    color: var(--th-text-400);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
  }

  .save-btn:hover {
    color: var(--th-text-200);
    background: var(--th-bg-700);
  }

  .form-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .form-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .add-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    padding: 4px 10px;
    border-radius: 4px;
    color: white;
    background: var(--th-accent-500, #38bdf8);
    border: none;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .add-btn:hover {
    opacity: 0.85;
  }

  .validation-banner {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    padding: 6px 10px;
    border-radius: 4px;
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #f87171;
  }

  .entries-table-wrapper {
    overflow: auto;
    flex: 1;
    border: 1px solid var(--th-border-700);
    border-radius: 6px;
  }

  .entries-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }

  .entries-table thead {
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .entries-table th {
    background: var(--th-bg-900);
    text-align: left;
    padding: 6px 8px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--th-text-500);
    border-bottom: 1px solid var(--th-border-700);
  }

  .entries-table td {
    padding: 4px 6px;
    border-bottom: 1px solid var(--th-border-800, rgba(255, 255, 255, 0.05));
    vertical-align: middle;
  }

  .entries-table tbody tr:hover {
    background: var(--th-bg-800);
  }

  .uid-col {
    width: 40%;
    min-width: 200px;
  }

  .ver-col {
    width: 80px;
    min-width: 60px;
  }

  .text-col {
    width: auto;
  }

  .action-col {
    width: 72px;
    min-width: 72px;
    text-align: center;
  }

  .cell-input {
    box-sizing: border-box;
    width: 100%;
    padding: 4px 6px;
    font-size: 11px;
    border-radius: 3px;
    border: 1px solid var(--th-input-border, var(--th-border-700));
    background: var(--th-input-bg, var(--th-bg-800));
    color: var(--th-text-primary, var(--th-text-200));
    outline: none;
    transition: border-color 0.15s;
  }

  .cell-input:focus {
    border-color: var(--th-accent-500, #38bdf8);
  }

  .cell-input.cell-invalid {
    border-color: #f87171;
  }



  .delete-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    border-radius: 3px;
    color: var(--th-text-500);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
  }

  .delete-btn:hover {
    color: #f87171;
    background: var(--th-bg-700);
  }

  .confirm-delete {
    display: flex;
    gap: 4px;
    justify-content: center;
  }

  .confirm-yes {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 3px;
    color: white;
    background: #ef4444;
    border: none;
    cursor: pointer;
  }

  .confirm-yes:hover {
    background: #dc2626;
  }

  .confirm-no {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 3px;
    color: var(--th-text-400);
    background: var(--th-bg-700);
    border: none;
    cursor: pointer;
  }

  .confirm-no:hover {
    color: var(--th-text-200);
    background: var(--th-bg-600, var(--th-bg-700));
  }

  .duplicate-row td {
    background: rgba(239, 68, 68, 0.06);
  }

  .dupe-hint-row td {
    padding: 0 8px 4px;
    border-bottom: 1px solid var(--th-border-800, rgba(255, 255, 255, 0.05));
  }

  .empty-cell {
    text-align: center;
    padding: 24px 8px;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
