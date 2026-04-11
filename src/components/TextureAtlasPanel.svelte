<script lang="ts">
  import type { SectionResult, DiffEntry } from "../lib/types/index.js";
  import SectionPanel from "./SectionPanel.svelte";
  import { projectStore, sectionToTable } from "../lib/stores/projectStore.svelte.js";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";

  let {
    infoResult,
    uvResult,
    globalFilter = "",
  }: {
    infoResult: SectionResult;
    uvResult: SectionResult;
    globalFilter?: string;
  } = $props();

  // ── Staging data for atlas info entries ──
  let infoTable = $derived(sectionToTable(infoResult.section, undefined, "TextureAtlasInfo"));

  $effect(() => {
    const t = infoTable;
    if (!projectStore.isSectionLoaded(t)) {
      projectStore.loadSection(t).catch(err => {
        console.warn(`[TextureAtlasPanel] Failed to load table ${t}:`, err);
      });
    }
  });

  // ── Group TextureAtlasInfo entries by node type ──
  let pathEntry = $derived(infoResult.entries.find((e: DiffEntry) => e.node_id === "TextureAtlasPath") ?? null);
  let textureSizeEntry = $derived(infoResult.entries.find((e: DiffEntry) => e.node_id === "TextureAtlasTextureSize") ?? null);
  let iconSizeEntry = $derived(infoResult.entries.find((e: DiffEntry) => e.node_id === "TextureAtlasIconSize") ?? null);

  let uvEntries = $derived(uvResult.entries);
  let uvCount = $derived(uvEntries.length);

  function attr(entry: DiffEntry | null, key: string): string {
    return entry?.raw_attributes?.[key] ?? "";
  }

  const inputClass = "form-input w-full bg-[var(--th-bg-800)] border border-[var(--th-border-600)] rounded px-2 py-1.5 text-xs text-[var(--th-text-100)] focus:border-[var(--th-accent-500,#0ea5e9)]";
  const monoInputClass = `${inputClass} font-mono`;
</script>

<div class="atlas-panel">
  <!-- ── Basic Data subsection ── -->
  <fieldset class="atlas-section">
    <legend class="atlas-section-header">Basic Data</legend>
    <div class="atlas-form-grid">
      {#if pathEntry}
        <label class="atlas-field">
          <span class="atlas-label">Path</span>
          <input type="text" class={inputClass} value={attr(pathEntry, "Path")} readonly />
        </label>
        <label class="atlas-field">
          <span class="atlas-label">UUID</span>
          <input type="text" class={monoInputClass} value={attr(pathEntry, "UUID")} readonly />
        </label>
        <label class="atlas-field">
          <span class="atlas-label">Entry Label</span>
          <input type="text" class={inputClass} value={pathEntry.display_name || pathEntry.uuid || ""} readonly />
        </label>
      {:else}
        <p class="atlas-empty">No TextureAtlasPath entry found.</p>
      {/if}

      {#if textureSizeEntry}
        <label class="atlas-field">
          <span class="atlas-label">Atlas Width</span>
          <input type="number" class={monoInputClass} value={attr(textureSizeEntry, "Width")} readonly />
        </label>
        <label class="atlas-field">
          <span class="atlas-label">Atlas Height</span>
          <input type="number" class={monoInputClass} value={attr(textureSizeEntry, "Height")} readonly />
        </label>
      {:else}
        <p class="atlas-empty">No TextureAtlasTextureSize entry found.</p>
      {/if}

      {#if iconSizeEntry}
        <label class="atlas-field">
          <span class="atlas-label">Icon Width</span>
          <input type="number" class={monoInputClass} value={attr(iconSizeEntry, "Width")} readonly />
        </label>
        <label class="atlas-field">
          <span class="atlas-label">Icon Height</span>
          <input type="number" class={monoInputClass} value={attr(iconSizeEntry, "Height")} readonly />
        </label>
      {:else}
        <p class="atlas-empty">No TextureAtlasIconSize entry found.</p>
      {/if}
    </div>
  </fieldset>

  <!-- ── Icons subsection ── -->
  <fieldset class="atlas-section">
    <legend class="atlas-section-header">Icons <span class="atlas-count">({uvCount})</span></legend>
    {#if uvCount > 0}
      <div class="atlas-icons-list">
        {#each uvEntries as entry, i (entry.uuid || entry.raw_attributes?.["MapKey"] || i)}
          <div class="atlas-icon-card">
            <div class="atlas-icon-card-header">
              <span class="atlas-icon-index">#{i + 1}</span>
              <span class="atlas-icon-mapkey-preview" title={attr(entry, "MapKey")}>{attr(entry, "MapKey") || "Unnamed"}</span>
            </div>
            <div class="atlas-icon-fields">
              <label class="atlas-field">
                <span class="atlas-label">MapKey</span>
                <input type="text" class={inputClass} value={attr(entry, "MapKey")} readonly />
              </label>
              <div class="atlas-uv-grid">
                <label class="atlas-field">
                  <span class="atlas-label">U1</span>
                  <input type="text" class={monoInputClass} value={attr(entry, "U1")} readonly />
                </label>
                <label class="atlas-field">
                  <span class="atlas-label">U2</span>
                  <input type="text" class={monoInputClass} value={attr(entry, "U2")} readonly />
                </label>
                <label class="atlas-field">
                  <span class="atlas-label">V1</span>
                  <input type="text" class={monoInputClass} value={attr(entry, "V1")} readonly />
                </label>
                <label class="atlas-field">
                  <span class="atlas-label">V2</span>
                  <input type="text" class={monoInputClass} value={attr(entry, "V2")} readonly />
                </label>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <p class="atlas-empty">No icon UV entries found.</p>
    {/if}
  </fieldset>

  <!-- ── Full section panels for editing (collapsed by default) ── -->
  <details class="atlas-details">
    <summary class="atlas-details-summary">Advanced: Full Section Panels</summary>
    <div class="atlas-details-content">
      <SectionPanel
        sectionResult={infoResult}
        {globalFilter}
        displayLabel="TextureAtlasInfo"
        regionId="TextureAtlasInfo"
      />
      <div class="atlas-child-section">
        <SectionPanel
          sectionResult={uvResult}
          {globalFilter}
          displayLabel="Icon UV List ({uvCount})"
          regionId="IconUVList"
        />
      </div>
    </div>
  </details>
</div>

<style>
  .atlas-panel {
    padding: 1rem 1rem 1rem 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow-y: auto;
  }

  .atlas-section {
    background: var(--th-bg-900);
    border: 1px solid var(--th-border-800);
    border-radius: 6px;
    padding: 0.75rem;
  }

  .atlas-section-header {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--th-text-400);
    padding: 0 4px;
  }

  .atlas-count {
    font-weight: 400;
    color: var(--th-text-500);
  }

  .atlas-form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .atlas-form-grid .atlas-field:first-child {
    grid-column: 1 / -1;
  }

  .atlas-field {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .atlas-label {
    font-size: 11px;
    color: var(--th-text-400);
    white-space: nowrap;
  }

  .atlas-empty {
    font-size: 11px;
    color: var(--th-text-600);
    font-style: italic;
    margin: 0;
    grid-column: 1 / -1;
  }

  /* ── Icons list ── */
  .atlas-icons-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .atlas-icon-card {
    background: var(--th-bg-800);
    border: 1px solid var(--th-border-700);
    border-radius: 6px;
    padding: 8px;
  }

  .atlas-icon-card-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--th-border-800);
  }

  .atlas-icon-index {
    font-size: 10px;
    font-weight: 600;
    color: var(--th-text-500);
    min-width: 20px;
  }

  .atlas-icon-mapkey-preview {
    font-size: 11px;
    font-weight: 500;
    color: var(--th-text-300);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .atlas-icon-fields {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .atlas-uv-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 6px;
  }

  /* ── Advanced details ── */
  .atlas-details {
    border: 1px solid var(--th-border-800);
    border-radius: 6px;
  }

  .atlas-details-summary {
    font-size: 11px;
    color: var(--th-text-500);
    cursor: pointer;
    padding: 6px 10px;
    user-select: none;
  }

  .atlas-details-summary:hover {
    color: var(--th-text-300);
  }

  .atlas-details-content {
    padding: 0.5rem;
    border-top: 1px solid var(--th-border-800);
  }

  .atlas-child-section {
    margin-left: 1rem;
    border-left: 2px solid var(--th-border-700);
    padding-left: 0.5rem;
  }
</style>
