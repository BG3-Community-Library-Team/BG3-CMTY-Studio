<script lang="ts">
  import type { SectionResult, DiffEntry } from "../lib/types/index.js";
  import SectionPanel from "./SectionPanel.svelte";
  import { projectStore, sectionToTable } from "../lib/stores/projectStore.svelte.js";
  import { m } from "../paraglide/messages.js";
  import { invoke } from "@tauri-apps/api/core";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import AlertTriangle from "@lucide/svelte/icons/alert-triangle";

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

  function attr(entry: DiffEntry | null, key: string): string {
    return entry?.raw_attributes?.[key] ?? "";
  }

  // ── Local editable state for Atlas Info fields ──
  let pathValue: string = $state("");
  let uuidValue: string = $state("");
  let labelValue: string = $state("");
  let atlasWidth: string = $state("");
  let atlasHeight: string = $state("");
  let iconWidth: string = $state("");
  let iconHeight: string = $state("");

  // Initialize local state from entry data
  $effect(() => {
    if (pathEntry) {
      pathValue = attr(pathEntry, "Path");
      uuidValue = attr(pathEntry, "UUID");
      labelValue = pathEntry.display_name || pathEntry.uuid || "";
    }
  });
  $effect(() => {
    if (textureSizeEntry) {
      atlasWidth = attr(textureSizeEntry, "Width");
      atlasHeight = attr(textureSizeEntry, "Height");
    }
  });
  $effect(() => {
    if (iconSizeEntry) {
      iconWidth = attr(iconSizeEntry, "Width");
      iconHeight = attr(iconSizeEntry, "Height");
    }
  });

  // ── Capacity calculation ──
  let capacityCols = $derived(Number(iconWidth) > 0 ? Math.floor(Number(atlasWidth) / Number(iconWidth)) : 0);
  let capacityRows = $derived(Number(iconHeight) > 0 ? Math.floor(Number(atlasHeight) / Number(iconHeight)) : 0);
  let capacityTotal = $derived(capacityCols * capacityRows);

  // ── Validation warnings ──
  let nonCleanDivision = $derived.by(() => {
    const aw = Number(atlasWidth);
    const ah = Number(atlasHeight);
    const iw = Number(iconWidth);
    const ih = Number(iconHeight);
    if (iw <= 0 || ih <= 0 || aw <= 0 || ah <= 0) return false;
    return (aw % iw !== 0) || (ah % ih !== 0);
  });

  // ── DDS dimension mismatch detection ──
  let ddsWidth: number | null = $state(null);
  let ddsHeight: number | null = $state(null);

  $effect(() => {
    const path = pathValue;
    if (!path || !path.toLowerCase().endsWith(".dds")) {
      ddsWidth = null;
      ddsHeight = null;
      return;
    }
    invoke<[number, number]>("cmd_get_dds_dimensions", { path, projectDir: "" })
      .then(([w, h]) => { ddsWidth = w; ddsHeight = h; })
      .catch(() => { ddsWidth = null; ddsHeight = null; });
  });

  let dimensionMismatch = $derived.by(() => {
    if (ddsWidth === null || ddsHeight === null) return false;
    return Number(atlasWidth) !== ddsWidth || Number(atlasHeight) !== ddsHeight;
  });

  // ── Local editable state for Icon UVs ──
  interface IconUVLocal {
    id: string;
    mapKey: string;
    u1: string;
    u2: string;
    v1: string;
    v2: string;
  }

  let iconUVs: IconUVLocal[] = $state([]);

  $effect(() => {
    iconUVs = uvEntries.map((entry, i) => ({
      id: entry.uuid || entry.raw_attributes?.["MapKey"] || String(i),
      mapKey: attr(entry, "MapKey"),
      u1: attr(entry, "U1"),
      u2: attr(entry, "U2"),
      v1: attr(entry, "V1"),
      v2: attr(entry, "V2"),
    }));
  });

  let capacityExceeded = $derived(capacityTotal > 0 && iconUVs.length > capacityTotal);
  let atCapacity = $derived(capacityTotal > 0 && iconUVs.length >= capacityTotal);

  function addIconUV() {
    iconUVs.push({
      id: crypto.randomUUID(),
      mapKey: "",
      u1: "0",
      u2: "0",
      v1: "0",
      v2: "0",
    });
  }

  function removeIconUV(index: number) {
    iconUVs.splice(index, 1);
  }

  const inputClass = "form-input w-full bg-[var(--th-bg-800)] border border-[var(--th-border-600)] rounded px-2 py-1.5 text-xs text-[var(--th-text-100)] focus:border-[var(--th-accent-500,#0ea5e9)] focus:outline-none focus:ring-1 focus:ring-[var(--th-accent-500,#0ea5e9)]";
  const monoInputClass = `${inputClass} font-mono`;
</script>

<div class="atlas-panel">
  <!-- ── Atlas Info + DDS Preview row ── -->
  <div class="atlas-top-row">
    <!-- ── Atlas Info section ── -->
    <fieldset class="atlas-section atlas-info-section">
      <legend class="atlas-section-header">{m.texture_atlas_info()}</legend>
      <div class="atlas-form-grid">
        {#if pathEntry}
          <label class="atlas-field atlas-field-full">
            <span class="atlas-label">{m.texture_atlas_path()}</span>
            <input type="text" class={inputClass} bind:value={pathValue} />
          </label>
          <label class="atlas-field">
            <span class="atlas-label">{m.texture_atlas_uuid()}</span>
            <input type="text" class={monoInputClass} bind:value={uuidValue} />
          </label>
          <label class="atlas-field">
            <span class="atlas-label">{m.texture_atlas_entry_label()}</span>
            <input type="text" class={inputClass} bind:value={labelValue} />
          </label>
        {:else}
          <p class="atlas-empty">{m.texture_atlas_no_path_entry()}</p>
        {/if}

        {#if textureSizeEntry}
          <label class="atlas-field">
            <span class="atlas-label">{m.texture_atlas_atlas_width()}</span>
            <input type="number" class={monoInputClass} bind:value={atlasWidth} min="0" />
          </label>
          <label class="atlas-field">
            <span class="atlas-label">{m.texture_atlas_icon_width()}</span>
            <input type="number" class={monoInputClass} bind:value={iconWidth} min="0" />
          </label>
        {:else}
          <p class="atlas-empty">{m.texture_atlas_no_texture_size()}</p>
        {/if}

        {#if iconSizeEntry}
          <label class="atlas-field">
            <span class="atlas-label">{m.texture_atlas_atlas_height()}</span>
            <input type="number" class={monoInputClass} bind:value={atlasHeight} min="0" />
          </label>
          <label class="atlas-field">
            <span class="atlas-label">{m.texture_atlas_icon_height()}</span>
            <input type="number" class={monoInputClass} bind:value={iconHeight} min="0" />
          </label>
        {:else}
          <p class="atlas-empty">{m.texture_atlas_no_icon_size()}</p>
        {/if}

        {#if textureSizeEntry && iconSizeEntry}
          <div class="atlas-capacity">
            <span class="atlas-label">{m.texture_atlas_capacity()}</span>
            <span class="atlas-capacity-value">
              {m.texture_atlas_capacity_formula({ cols: String(capacityCols), rows: String(capacityRows), total: String(capacityTotal) })}
            </span>
          </div>
          {#if nonCleanDivision}
            <div class="atlas-warning" role="alert">
              <AlertTriangle size={14} />
              {m.texture_atlas_warn_uneven_division({ w: atlasWidth, h: atlasHeight, iw: iconWidth, ih: iconHeight })}
            </div>
          {/if}
          {#if dimensionMismatch}
            <div class="atlas-warning" role="alert">
              <AlertTriangle size={14} />
              {m.texture_atlas_warn_dimension_mismatch({ w: atlasWidth, h: atlasHeight, dw: String(ddsWidth), dh: String(ddsHeight) })}
            </div>
          {/if}
        {/if}
      </div>
    </fieldset>

    <!-- ── DDS Preview placeholder ── -->
    <div class="atlas-dds-preview">
      <span class="atlas-dds-preview-label">{m.texture_atlas_dds_preview()}</span>
      {#if pathEntry}
        <span class="atlas-dds-preview-path" title={pathValue}>{pathValue}</span>
      {/if}
    </div>
  </div>

  <!-- ── Icon UVs section ── -->
  <fieldset class="atlas-section">
    <legend class="atlas-section-header">
      {m.texture_atlas_icon_uvs()}
      <span class="atlas-count">({m.texture_atlas_icon_count({ count: String(iconUVs.length), capacity: String(capacityTotal) })})</span>
    </legend>

    {#if capacityExceeded}
      <div class="atlas-warning" role="alert">
        <AlertTriangle size={14} />
        {m.texture_atlas_warn_capacity_exceeded({ count: String(iconUVs.length), capacity: String(capacityTotal) })}
      </div>
    {/if}

    <div class="atlas-uv-toolbar">
      <button type="button" class="atlas-add-btn" disabled={atCapacity} onclick={addIconUV}>
        <Plus size={14} />
        {m.texture_atlas_add_icon()}
      </button>
    </div>

    {#if iconUVs.length > 0}
      <div class="atlas-icons-list">
        {#each iconUVs as uv, i (uv.id)}
          <div class="atlas-icon-card">
            <div class="atlas-icon-card-header">
              <span class="atlas-icon-index">#{i + 1}</span>
              <label class="atlas-field atlas-icon-mapkey-field">
                <span class="atlas-label">{m.texture_atlas_mapkey()}</span>
                <input type="text" class={inputClass} bind:value={uv.mapKey} />
              </label>
              <button
                type="button"
                class="atlas-remove-btn"
                title={m.texture_atlas_remove_icon()}
                onclick={() => removeIconUV(i)}
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div class="atlas-uv-grid">
              <label class="atlas-field">
                <span class="atlas-label">U1</span>
                <input type="number" class={monoInputClass} bind:value={uv.u1} step="any" />
              </label>
              <label class="atlas-field">
                <span class="atlas-label">U2</span>
                <input type="number" class={monoInputClass} bind:value={uv.u2} step="any" />
              </label>
              <label class="atlas-field">
                <span class="atlas-label">V1</span>
                <input type="number" class={monoInputClass} bind:value={uv.v1} step="any" />
              </label>
              <label class="atlas-field">
                <span class="atlas-label">V2</span>
                <input type="number" class={monoInputClass} bind:value={uv.v2} step="any" />
              </label>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <p class="atlas-empty">{m.texture_atlas_no_icons()}</p>
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
          displayLabel="Icon UV List ({iconUVs.length})"
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

  .atlas-top-row {
    display: flex;
    gap: 1rem;
  }

  .atlas-info-section {
    flex: 1;
    min-width: 0;
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

  .atlas-field-full {
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

  .atlas-capacity {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 0 2px;
  }

  .atlas-capacity-value {
    font-size: 12px;
    font-weight: 600;
    font-family: monospace;
    color: var(--th-text-200);
  }

  /* ── DDS Preview placeholder ── */
  .atlas-dds-preview {
    width: 180px;
    min-height: 120px;
    flex-shrink: 0;
    background: var(--th-bg-900);
    border: 2px dashed var(--th-border-700);
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 12px;
  }

  .atlas-dds-preview-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--th-text-500);
  }

  .atlas-dds-preview-path {
    font-size: 10px;
    color: var(--th-text-600);
    word-break: break-all;
    text-align: center;
    max-width: 100%;
  }

  /* ── Icon UVs toolbar ── */
  .atlas-uv-toolbar {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 8px;
  }

  .atlas-add-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    color: var(--th-text-200);
    background: var(--th-bg-800);
    border: 1px solid var(--th-border-600);
    cursor: pointer;
    transition: background 0.15s;
  }

  .atlas-add-btn:hover {
    background: var(--th-bg-700, var(--th-bg-800));
    border-color: var(--th-accent-500, #0ea5e9);
  }

  .atlas-add-btn:focus-visible {
    outline: 2px solid var(--th-accent-500, #0ea5e9);
    outline-offset: 2px;
  }

  .atlas-add-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .atlas-warning {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border-radius: 4px;
    font-size: 11px;
    color: var(--th-text-warning, #f59e0b);
    background: rgba(245, 158, 11, 0.08);
    border: 1px solid rgba(245, 158, 11, 0.2);
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
    align-items: flex-end;
    gap: 6px;
    margin-bottom: 6px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--th-border-800);
  }

  .atlas-icon-index {
    font-size: 10px;
    font-weight: 600;
    color: var(--th-text-500);
    min-width: 24px;
    padding-bottom: 4px;
  }

  .atlas-icon-mapkey-field {
    flex: 1;
    min-width: 0;
  }

  .atlas-remove-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 4px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--th-text-500);
    cursor: pointer;
    flex-shrink: 0;
    transition: color 0.15s, background 0.15s;
  }

  .atlas-remove-btn:hover {
    color: var(--th-accent-danger, #ef4444);
    background: color-mix(in srgb, var(--th-accent-danger, #ef4444) 12%, transparent);
    border-color: var(--th-accent-danger, #ef4444);
  }

  .atlas-remove-btn:focus-visible {
    outline: 2px solid var(--th-accent-500, #0ea5e9);
    outline-offset: 2px;
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
