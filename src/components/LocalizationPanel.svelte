<script lang="ts">
  import { configStore, type LocaFileEntry, type LocaValue } from "../lib/stores/configStore.svelte.js";
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import { getModLocalization, type LocaEntry } from "../lib/utils/tauri.js";
  import { m } from "../paraglide/messages.js";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import FileText from "@lucide/svelte/icons/file-text";
  import X from "@lucide/svelte/icons/x";
  import { generateUuid } from "../lib/utils/uuid.js";

  /** Generate a BG3-style contentuid: 'h' prefix, all hyphens replaced with 'g'. */
  function generateContentUid(): string {
    return "h" + generateUuid().replace(/-/g, "g");
  }

  function addFileEntry() {
    configStore.locaEntries = [
      ...configStore.locaEntries,
      { id: generateUuid(), label: "", values: [{ id: generateUuid(), contentuid: generateContentUid(), version: 1, text: "" }] },
    ];
  }

  function removeFileEntry(entryId: string) {
    configStore.locaEntries = configStore.locaEntries.filter(e => e.id !== entryId);
  }

  function addValue(entryId: string) {
    const entry = configStore.locaEntries.find(e => e.id === entryId);
    if (entry) entry.values = [...entry.values, { id: generateUuid(), contentuid: generateContentUid(), version: 1, text: "" }];
  }

  function removeValue(entryId: string, valId: string) {
    const entry = configStore.locaEntries.find(e => e.id === entryId);
    if (entry) entry.values = entry.values.filter(v => v.id !== valId);
  }

  function shuffleContentUid(entryId: string, valId: string) {
    const entry = configStore.locaEntries.find(e => e.id === entryId);
    if (!entry) return;
    const val = entry.values.find(v => v.id === valId);
    if (val) val.contentuid = generateContentUid();
  }

  /** Format a Date as MM/DD/YYYY HH:mm */
  function formatDate(d: Date): string {
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${mm}/${dd}/${yyyy} ${hh}:${min}`;
  }

  /** Generate the XML string for a localization file entry. */
  function generateXml(entry: LocaFileEntry): string {
    const date = formatDate(new Date());
    const lines = entry.values.map(v => {
      const escaped = v.text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
      return `  <content contentuid="${v.contentuid}" version="${v.version}">${escaped}</content>`;
    });
    return `<?xml version="1.0" encoding="utf-8"?>\n<contentList date="${date}">\n${lines.join("\n")}\n</contentList>`;
  }

  // Expand/collapse state per file entry
  let expandedEntries: Record<string, boolean> = $state({});
  function toggleEntry(id: string) { expandedEntries[id] = !expandedEntries[id]; }

  // ── Existing localization (read-only) from imported mod ──
  let existingEntries: LocaEntry[] = $state([]);
  let existingLoading = $state(false);

  $effect(() => {
    const modPath = modStore.selectedModPath;
    if (!modPath) { existingEntries = []; return; }
    existingLoading = true;
    getModLocalization(modPath)
      .then(result => existingEntries = result.entries)
      .catch(() => existingEntries = [])
      .finally(() => existingLoading = false);
  });
</script>

<div class="loca-panel">
  <div class="loca-header">
    <h2 class="text-sm font-semibold text-[var(--th-text-100)]">
      {m.localization_title()}
      {#if configStore.locaEntries.length > 0}
        <span class="text-xs font-normal text-[var(--th-text-500)]">{configStore.locaEntries.length !== 1 ? m.localization_title_count({ count: configStore.locaEntries.length }) : m.localization_title_count_singular({ count: configStore.locaEntries.length })}</span>
      {/if}
    </h2>
    <button
      class="px-2 py-1 text-xs rounded bg-[var(--th-accent-500)] text-white hover:opacity-90 flex items-center gap-1"
      onclick={addFileEntry}
    >
      <Plus size={12} /> {m.localization_add_file()}
    </button>
  </div>

  <div class="loca-body">
    {#if configStore.locaEntries.length === 0 && existingEntries.length === 0 && !existingLoading}
      <div class="empty-state">
        <FileText size={32} class="text-[var(--th-text-600)] opacity-30" />
        <p class="text-xs text-[var(--th-text-500)] mt-2">{m.localization_empty_heading()}</p>
        <p class="text-[10px] text-[var(--th-text-600)] mt-1">{m.localization_empty_instruction()}</p>
      </div>
    {/if}

    <!-- Authored entries -->
    {#each configStore.locaEntries as entry (entry.id)}
      {@const isExpanded = expandedEntries[entry.id] !== false}
      <div class="file-card">
        <div class="file-card-header">
          <button class="flex items-center gap-1 flex-1 min-w-0 text-left" onclick={() => toggleEntry(entry.id)}>
            <ChevronRight size={14} class="shrink-0 transition-transform duration-150 {isExpanded ? 'rotate-90' : ''}" />
            <span class="ext-badge" style="background: #f97316">{m.localization_extension_badge()}</span>
            <input
              type="text"
              class="form-input flex-1 h-6 text-xs font-medium"
              placeholder={m.localization_filename_placeholder()}
              bind:value={entry.label}
              onclick={(e) => e.stopPropagation()}
              onkeydown={(e) => e.stopPropagation()}
            />
            <span class="text-[10px] text-[var(--th-text-600)]">{entry.values.length !== 1 ? m.localization_value_count({ count: entry.values.length }) : m.localization_value_count_singular({ count: entry.values.length })}</span>
          </button>
          <button class="p-1.5 rounded text-red-400 hover:text-red-300 hover:bg-[var(--th-bg-700)]" onclick={() => removeFileEntry(entry.id)} aria-label={m.localization_remove_file()} title={m.localization_remove_file_title()}>
            <Trash2 size={12} />
          </button>
        </div>

        {#if isExpanded}
          <div class="file-card-body">
            {#each entry.values as val (val.id)}
              <div class="value-row">
                <div class="flex items-center gap-1.5 mb-1">
                  <label for="loc-cuid-{entry.id}-{val.id}" class="flex flex-col gap-0.5 flex-1 min-w-0">
                    <span class="text-[10px] text-[var(--th-text-500)]">{m.localization_contentuid_label()}</span>
                    <div class="flex items-center gap-1">
                      <input
                        id="loc-cuid-{entry.id}-{val.id}"
                        type="text"
                        class="form-input flex-1 h-6 text-[10px] font-mono"
                        bind:value={val.contentuid}
                        readonly
                      />
                      <button
                        class="p-1.5 rounded text-[var(--th-text-500)] hover:text-[var(--th-accent-500)] hover:bg-[var(--th-bg-700)]"
                        onclick={() => shuffleContentUid(entry.id, val.id)}
                        aria-label={m.localization_shuffle_aria()}
                        title={m.localization_shuffle_title()}
                      >
                        <RefreshCw size={12} />
                      </button>
                    </div>
                  </label>
                  <label for="loc-ver-{entry.id}-{val.id}" class="flex flex-col gap-0.5 w-16 shrink-0">
                    <span class="text-[10px] text-[var(--th-text-500)]">{m.localization_version_label()}</span>
                    <input
                      id="loc-ver-{entry.id}-{val.id}"
                      type="number"
                      class="form-input h-6 text-xs text-center"
                      bind:value={val.version}
                      min="0"
                    />
                  </label>
                  <button class="self-end p-1.5 rounded text-red-400 hover:text-red-300" onclick={() => removeValue(entry.id, val.id)} aria-label={m.localization_remove_value_aria()} title={m.localization_remove_value_title()}>
                    <X size={12} />
                  </button>
                </div>
                <label for="loc-text-{entry.id}-{val.id}" class="flex flex-col gap-0.5">
                  <span class="text-[10px] text-[var(--th-text-500)]">{m.localization_locale_text_label()}</span>
                  <textarea
                    id="loc-text-{entry.id}-{val.id}"
                    class="form-input text-xs w-full"
                    rows="2"
                    placeholder={m.localization_locale_text_placeholder()}
                    bind:value={val.text}
                  ></textarea>
                </label>
              </div>
            {/each}
            <button
              class="text-xs text-sky-400 hover:text-sky-300 mt-1"
              onclick={() => addValue(entry.id)}
            >{m.localization_add_value()}</button>
          </div>
        {/if}
      </div>
    {/each}

    <!-- Existing mod localization (read-only) -->
    {#if existingEntries.length > 0}
      <div class="existing-section">
        <h3 class="text-[10px] font-semibold uppercase tracking-wider text-[var(--th-text-600)] px-3 py-2">
          {m.localization_existing_section_title({ count: existingEntries.length })}
        </h3>
        <div class="loca-table-wrapper">
          <table class="loca-table">
            <thead>
              <tr>
                <th class="handle-col">{m.localization_table_handle()}</th>
                <th>{m.localization_table_text()}</th>
              </tr>
            </thead>
            <tbody>
              {#each existingEntries as e (e.handle)}
                <tr>
                  <td class="handle-col">
                    <code class="text-[10px] text-violet-400 select-all">{e.handle}</code>
                  </td>
                  <td class="text-xs text-[var(--th-text-200)]">{e.text}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .loca-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }
  .loca-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--th-border-700);
    gap: 1rem;
    flex-shrink: 0;
  }
  .loca-body {
    flex: 1;
    overflow: auto;
    padding: 0.5rem;
  }
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
  }
  .file-card {
    border: 1px solid var(--th-border-700);
    border-radius: 0.375rem;
    margin-bottom: 0.5rem;
    background: var(--th-bg-800);
  }
  .file-card-header {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.5rem;
    background: var(--th-bg-900);
    border-radius: 0.375rem 0.375rem 0 0;
  }
  .file-card-body {
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .value-row {
    padding: 0.375rem;
    border: 1px solid var(--th-border-800, rgba(255,255,255,0.06));
    border-radius: 0.25rem;
    background: var(--th-bg-900);
  }
  .ext-badge {
    font-size: 9px;
    padding: 0 4px;
    border-radius: 3px;
    color: white;
    font-weight: 600;
    line-height: 14px;
    flex-shrink: 0;
    opacity: 0.7;
  }
  .form-input {
    box-sizing: border-box;
    background-color: var(--th-input-bg);
    border: 1px solid var(--th-input-border);
    border-radius: 0.25rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.8125rem;
    color: var(--th-input-text);
  }
  .form-input:focus {
    outline: none;
    border-color: rgb(14 165 233);
  }
  .existing-section {
    margin-top: 0.75rem;
    border-top: 1px solid var(--th-border-700);
    padding-top: 0.5rem;
  }
  .loca-table-wrapper {
    overflow: auto;
    max-height: 300px;
    padding: 0 0.25rem;
  }
  .loca-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.75rem;
  }
  .loca-table th {
    position: sticky;
    top: 0;
    background: var(--th-bg-900);
    text-align: left;
    padding: 0.375rem 0.5rem;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--th-text-500);
    border-bottom: 1px solid var(--th-border-700);
    z-index: 1;
  }
  .loca-table td {
    padding: 0.25rem 0.5rem;
    border-bottom: 1px solid var(--th-border-800, rgba(255,255,255,0.05));
    vertical-align: top;
  }
  .loca-table tbody tr:hover {
    background: var(--th-bg-800);
  }
  .handle-col {
    width: 22rem;
    min-width: 18rem;
    max-width: 26rem;
    word-break: break-all;
  }
</style>
