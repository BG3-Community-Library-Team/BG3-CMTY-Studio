<script lang="ts">
  import type { SectionResult, DiffEntry } from "../lib/types/index.js";
  import TexturePreview from "./TexturePreview.svelte";
  import FormSectionCard from "./manual-entry/FormSectionCard.svelte";
  import FormNav from "./manual-entry/FormNav.svelte";
  import SingleSelectCombobox from "./SingleSelectCombobox.svelte";
  import { projectStore, sectionToTable } from "../lib/stores/projectStore.svelte.js";
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import { uiStore } from "../lib/stores/uiStore.svelte.js";
  import { m } from "../paraglide/messages.js";
  import { invoke } from "@tauri-apps/api/core";
  import { open as dialogOpen } from "@tauri-apps/plugin-dialog";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import AlertTriangle from "@lucide/svelte/icons/alert-triangle";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import ChevronUp from "@lucide/svelte/icons/chevron-up";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import FileImage from "@lucide/svelte/icons/file-image";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";

  let {
    infoResult,
    uvResult,
    initialSourceFile = undefined,
  }: {
    infoResult: SectionResult;
    uvResult: SectionResult;
    initialSourceFile?: string;
  } = $props();

  // ── Project directory for DDS commands ──
  let projectDir = $derived(modStore.projectPath || modStore.selectedModPath);

  // ── Staging data ──
  let infoTable = $derived(sectionToTable(infoResult.section, undefined, "TextureAtlasInfo"));

  $effect(() => {
    const t = infoTable;
    if (!projectStore.isSectionLoaded(t)) {
      projectStore.loadSection(t).catch(err => {
        console.warn(`[TextureAtlasPanel] Failed to load table ${t}:`, err);
      });
    }
  });

  // ── File-based entry grouping ──
  interface AtlasFileEntry {
    sourceFile: string;
    fileName: string;
    pathEntry: DiffEntry | null;
    textureSizeEntry: DiffEntry | null;
    iconSizeEntry: DiffEntry | null;
    uvEntries: DiffEntry[];
    atlasPath: string;
    atlasWidth: string;
    atlasHeight: string;
    iconCount: number;
  }

  let atlasFileEntries = $derived.by((): AtlasFileEntry[] => {
    // Merge entries from BOTH results by source_file — a single GUI .lsx file
    // is routed to only one section (TextureAtlasInfo or IconUVList) depending
    // on filename, but physically contains both regions.
    const byFile = new Map<string, DiffEntry[]>();
    for (const e of [...infoResult.entries, ...uvResult.entries]) {
      const file = e.source_file || "__unknown__";
      if (!byFile.has(file)) byFile.set(file, []);
      byFile.get(file)!.push(e);
    }
    const entries: AtlasFileEntry[] = [];
    for (const [file, allEntries] of byFile) {
      const pathEntry = allEntries.find(e => e.node_id === "TextureAtlasPath") ?? null;
      const textureSizeEntry = allEntries.find(e => e.node_id === "TextureAtlasTextureSize") ?? null;
      const iconSizeEntry = allEntries.find(e => e.node_id === "TextureAtlasIconSize") ?? null;
      const uvEntries = allEntries.filter(e => e.node_id === "IconUV");
      const parts = file.replace(/\\/g, "/").split("/");
      entries.push({
        sourceFile: file,
        fileName: parts[parts.length - 1] || file,
        pathEntry, textureSizeEntry, iconSizeEntry, uvEntries,
        atlasPath: pathEntry?.raw_attributes?.["Path"] ?? "",
        atlasWidth: textureSizeEntry?.raw_attributes?.["Width"] ?? "",
        atlasHeight: textureSizeEntry?.raw_attributes?.["Height"] ?? "",
        iconCount: uvEntries.length,
      });
    }
    return entries;
  });

  // ── Mod folder prefix for resolving Assets/ paths to actual file paths ──
  // Derives the relative path from projectDir to the mod's Public folder.
  let modPublicRelDir = $derived.by(() => {
    const folder = modStore.scanResult?.mod_meta?.folder;
    const pp = modStore.projectPath;
    const mp = modStore.selectedModPath;
    if (!folder) return "";
    if (pp && mp) {
      const modRel = mp.replace(/\\/g, "/").slice(pp.replace(/\\/g, "/").length).replace(/^\/+/, "");
      return modRel ? `${modRel}/Public/${folder}` : `Public/${folder}`;
    }
    return `Public/${folder}`;
  });

  /** Resolve an LSX Assets/... path to a path relative to projectDir. */
  function resolveAssetPath(assetPath: string): string {
    if (!assetPath || !modPublicRelDir) return assetPath;
    // If it already includes a full path segment, don't double-prepend
    if (assetPath.includes("/Public/") || assetPath.startsWith("Mods/")) return assetPath;
    return `${modPublicRelDir}/${assetPath}`;
  }

  // ── Inline editing state — track which entry is expanded ──
  let editingFile = $state<string | null>(null);
  let editingEntry = $derived(atlasFileEntries.find(e => e.sourceFile === editingFile) ?? null);

  /** Match a source_file against an initialSourceFile (may have different prefixes). */
  function sourceFileMatches(sourceFile: string, target: string): boolean {
    if (sourceFile === target) return true;
    // Normalize both to forward slashes for comparison
    const a = sourceFile.replace(/\\/g, "/");
    const b = target.replace(/\\/g, "/");
    if (a === b) return true;
    // Check suffix match: either may have extra path prefix
    if (a.endsWith(b) || b.endsWith(a)) return true;
    // Last resort: filename match
    const aName = a.split("/").pop() ?? "";
    const bName = b.split("/").pop() ?? "";
    return aName === bName && aName !== "";
  }

  /** Entries filtered to the specific file when opened from File Tree. */
  let displayEntries = $derived.by(() => {
    if (!initialSourceFile) return atlasFileEntries;
    const match = atlasFileEntries.find(e => sourceFileMatches(e.sourceFile, initialSourceFile!));
    return match ? [match] : atlasFileEntries;
  });

  // Auto-expand when there's an initialSourceFile or single entry
  let hasAutoSelected = $state(false);
  $effect(() => {
    if (hasAutoSelected) return;
    if (initialSourceFile) {
      const match = atlasFileEntries.find(e => sourceFileMatches(e.sourceFile, initialSourceFile!));
      if (match) { editingFile = match.sourceFile; hasAutoSelected = true; return; }
    }
    if (atlasFileEntries.length === 1) {
      editingFile = atlasFileEntries[0].sourceFile;
      hasAutoSelected = true;
    }
  });

  function toggleEntry(file: string) {
    editingFile = editingFile === file ? null : file;
  }

  // ── SectionPanel expansion state (persisted) ──
  let expandKey = "TextureAtlas";
  let expanded = $derived(uiStore.expandedSections[expandKey] ?? true);
  function setExpanded(value: boolean) {
    uiStore.expandedSections = { ...uiStore.expandedSections, [expandKey]: value };
  }

  function attr(entry: DiffEntry | null, key: string): string {
    return entry?.raw_attributes?.[key] ?? "";
  }

  // ── Form state (bound to editingEntry) ──
  let pathValue = $state("");
  let uuidValue = $state("");
  let labelValue = $state("");
  let atlasWidthVal = $state("");
  let atlasHeightVal = $state("");
  let iconWidthVal = $state("");
  let iconHeightVal = $state("");
  let pathDragOver = $state(false);

  // Track which entry the form state was loaded from so we can re-populate on switch
  let formLoadedFor = $state<string | null>(null);

  $effect(() => {
    const entry = editingEntry;
    const file = editingFile;
    if (!entry || file === formLoadedFor) return;
    pathValue = attr(entry.pathEntry, "Path");
    uuidValue = attr(entry.pathEntry, "UUID");
    labelValue = entry.pathEntry?.display_name || entry.pathEntry?.uuid || "";
    atlasWidthVal = attr(entry.textureSizeEntry, "Width");
    atlasHeightVal = attr(entry.textureSizeEntry, "Height");
    iconWidthVal = attr(entry.iconSizeEntry, "Width");
    iconHeightVal = attr(entry.iconSizeEntry, "Height");
    formLoadedFor = file;
  });

  // Reset formLoadedFor when entry is collapsed
  $effect(() => {
    if (!editingFile) formLoadedFor = null;
  });

  // ── Capacity ──
  let capacityCols = $derived(Number(iconWidthVal) > 0 ? Math.floor(Number(atlasWidthVal) / Number(iconWidthVal)) : 0);
  let capacityRows = $derived(Number(iconHeightVal) > 0 ? Math.floor(Number(atlasHeightVal) / Number(iconHeightVal)) : 0);
  let capacityTotal = $derived(capacityCols * capacityRows);

  // ── Validation ──
  let nonCleanDivision = $derived.by(() => {
    const aw = Number(atlasWidthVal), ah = Number(atlasHeightVal);
    const iw = Number(iconWidthVal), ih = Number(iconHeightVal);
    if (iw <= 0 || ih <= 0 || aw <= 0 || ah <= 0) return false;
    return (aw % iw !== 0) || (ah % ih !== 0);
  });

  let ddsWidth: number | null = $state(null);
  let ddsHeight: number | null = $state(null);

  $effect(() => {
    const path = pathValue;
    const dir = projectDir;
    if (!path || !path.toLowerCase().endsWith(".dds") || !dir) {
      ddsWidth = null; ddsHeight = null; return;
    }
    const resolvedPath = resolveAssetPath(path);
    invoke<[number, number]>("cmd_get_dds_dimensions", { path: resolvedPath, projectDir: dir })
      .then(([w, h]) => { ddsWidth = w; ddsHeight = h; })
      .catch(() => { ddsWidth = null; ddsHeight = null; });
  });

  let dimensionMismatch = $derived.by(() => {
    if (ddsWidth === null || ddsHeight === null) return false;
    return Number(atlasWidthVal) !== ddsWidth || Number(atlasHeightVal) !== ddsHeight;
  });

  // ── Atlas PNG for icon UV crop previews ──
  let atlasPng = $state("");
  let atlasPngLoadedFor = $state("");

  $effect(() => {
    const path = pathValue;
    const dir = projectDir;
    if (!path || !dir) { atlasPng = ""; atlasPngLoadedFor = ""; return; }
    const resolvedPath = resolveAssetPath(path);
    // Avoid reloading if path hasn't changed
    if (resolvedPath === atlasPngLoadedFor) return;
    invoke<string>("cmd_convert_dds_to_png", { path: resolvedPath, projectDir: dir })
      .then(data => { atlasPng = data; atlasPngLoadedFor = resolvedPath; })
      .catch(() => { atlasPng = ""; atlasPngLoadedFor = ""; });
  });

  // ── Path combobox: list .dds files from mod's texture folder ──
  let ddsFileList: string[] = $state([]);

  $effect(() => {
    const dir = projectDir;
    if (!dir || !modPublicRelDir) { ddsFileList = []; return; }
    const iconsDir = `${dir}/${modPublicRelDir}/Assets/Textures/Icons`;
    invoke<string[]>("cmd_list_files_by_ext", { dirPath: iconsDir, ext: "dds" })
      .then(files => {
        ddsFileList = files.map(f => {
          const normalized = f.replace(/\\/g, "/");
          const idx = normalized.indexOf("Assets/Textures/Icons/");
          return idx >= 0 ? normalized.slice(idx) : normalized;
        });
      })
      .catch(() => { ddsFileList = []; });
  });

  let pathOptions = $derived(ddsFileList.map(f => ({ value: f, label: f.split("/").pop() ?? f })));

  async function browseDdsFile() {
    const selected = await dialogOpen({
      multiple: false,
      filters: [{ name: "DDS Textures", extensions: ["dds"] }],
    });
    if (selected && typeof selected === "string") pathValue = selected;
  }

  function handlePathDrop(e: DragEvent) {
    e.preventDefault();
    pathDragOver = false;
    const files = e.dataTransfer?.files;
    if (!files?.length) return;
    if (!files[0].name.toLowerCase().endsWith(".dds")) return;
    pathValue = files[0].name;
  }

  function handlePathDragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    pathDragOver = true;
  }

  function handlePathDragLeave() { pathDragOver = false; }

  // ── Icon UVs ──
  interface IconUVLocal {
    id: string;
    mapKey: string;
    u1: string; u2: string; v1: string; v2: string;
    open: boolean;
  }

  let iconUVs: IconUVLocal[] = $state([]);

  $effect(() => {
    const entries = editingEntry?.uvEntries ?? [];
    iconUVs = entries.map((entry, i) => ({
      // MapKey is unique per icon; synthetic __node_*__ UUIDs are shared across all IconUV entries
      id: entry.raw_attributes?.["MapKey"] || (entry.uuid?.startsWith("__node_") ? `uv-${i}` : entry.uuid) || `uv-${i}`,
      mapKey: attr(entry, "MapKey"),
      u1: attr(entry, "U1"), u2: attr(entry, "U2"),
      v1: attr(entry, "V1"), v2: attr(entry, "V2"),
      open: false,
    }));
  });

  let capacityExceeded = $derived(capacityTotal > 0 && iconUVs.length > capacityTotal);
  let atCapacity = $derived(capacityTotal > 0 && iconUVs.length >= capacityTotal);

  function addIconUV() {
    iconUVs.push({ id: crypto.randomUUID(), mapKey: "", u1: "0", u2: "0", v1: "0", v2: "0", open: true });
  }

  function removeIconUV(index: number) {
    iconUVs.splice(index, 1);
  }

  // ── FormNav sections ──
  let formNavSections = $derived.by(() => {
    const uvChildren = iconUVs.map((uv, i) => ({
      id: `icon-uv-${uv.id}`,
      label: uv.mapKey || `#${i + 1}`,
    }));
    return [
      { id: "atlas-info", label: m.texture_atlas_info() },
      { id: "icon-uvs", label: m.texture_atlas_icon_uvs(), children: uvChildren },
    ];
  });

  let formContainerEl: HTMLDivElement | undefined = $state(undefined);

  const inputClass = "form-input w-full bg-[var(--th-bg-800)] border border-[var(--th-border-600,var(--th-bg-600))] rounded px-2 py-1.5 text-xs text-[var(--th-text-100)] focus:border-[var(--th-accent-500,#0ea5e9)] focus:outline-none focus:ring-1 focus:ring-[var(--th-accent-500,#0ea5e9)]";
  const monoInputClass = `${inputClass} font-mono`;
</script>

<!-- SectionPanel-identical chrome -->
<section class="border border-[var(--th-border-700)] rounded-lg overflow-clip" data-section-panel>
  <!-- Header (sticky within scroll container) — matches SectionPanel exactly -->
  <button
    class="w-full flex items-center gap-3 px-4 py-3 bg-[var(--th-bg-850,#1a1a1e)] hover:bg-[var(--th-bg-850,#1a1a1e)]/80
           text-left transition-colors sticky top-0 z-[5] shadow-[0_2px_4px_rgba(0,0,0,.15)]
           rounded-t-lg {expanded ? '' : 'rounded-b-lg'}"
    onclick={() => setExpanded(!expanded)}
    aria-expanded={expanded}
  >
    <ChevronRight size={14} class="text-[var(--th-text-400)] transition-transform {expanded ? 'rotate-90' : ''}" />
    <span class="font-semibold text-[var(--th-text-100)]">{m.texture_atlas_list_title()}</span>
    <span class="ml-auto"></span>
    <span class="text-xs text-[var(--th-text-400)]">
      {displayEntries.length}
      {displayEntries.length === 1 ? "entry" : "entries"}
    </span>
  </button>

  {#if expanded}
    <div class="bg-[var(--th-bg-850,#18181b)] border-t border-[var(--th-border-700)] relative">
      <!-- Entry list — SectionPanel uses "space-y-1 p-2" -->
      <div class="space-y-1 p-2">
        {#if displayEntries.length > 0}
          {#each displayEntries as entry (entry.sourceFile)}
            {@const isEditing = editingFile === entry.sourceFile}
            <!-- Entry row — matches EntryRow visual pattern -->
            <div
              class="entry-row flex flex-col rounded border transition-colors border-violet-700/40 bg-violet-950/20"
              data-entry-id="TextureAtlas:{entry.sourceFile}"
            >
              {#if isEditing}
                <!-- Editing: persistent header + inline form -->
                <div class="flex items-center gap-2 px-3 py-1.5 border-b border-zinc-700/50">
                  <button
                    type="button"
                    class="shrink-0 p-0.5 rounded hover:bg-zinc-700/40 transition-colors cursor-pointer"
                    onclick={() => toggleEntry(entry.sourceFile)}
                    aria-label="Collapse"
                  >
                    <ChevronUp class="w-3.5 h-3.5 text-zinc-500" />
                  </button>
                  <span class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">NEW</span>
                  <FileImage size={14} class="shrink-0 text-[var(--th-text-400)]" />
                  <span class="flex-1 text-sm font-medium truncate">{entry.fileName}</span>
                  <span class="text-xs text-zinc-400">{entry.iconCount} icons</span>
                </div>

                <!-- Inline form content (like UnifiedForm in EntryRow) -->
                <div class="p-2" bind:this={formContainerEl}>
                  <div class="atlas-form-with-nav">
                    <FormNav sections={formNavSections} containerEl={formContainerEl} />

                    <div class="atlas-form-content">
                      <!-- ── Atlas Info ── -->
                      <FormSectionCard title={m.texture_atlas_info()} id="atlas-info" open={true}>
                        <div class="atlas-form-row">
                          <div class="atlas-form-left">
                            <div class="atlas-field atlas-field-full">
                              <span class="atlas-label">{m.texture_atlas_path()}</span>
                              <!-- svelte-ignore a11y_no_static_element_interactions -->
                              <div
                                class="atlas-path-row"
                                class:drag-over={pathDragOver}
                                ondrop={handlePathDrop}
                                ondragover={handlePathDragOver}
                                ondragleave={handlePathDragLeave}
                              >
                                <div class="atlas-path-combobox">
                                  <SingleSelectCombobox
                                    options={pathOptions}
                                    value={pathValue}
                                    placeholder="Assets/Textures/Icons/…"
                                    onchange={(v) => { pathValue = v; }}
                                  />
                                </div>
                                <button type="button" class="atlas-browse-btn" onclick={browseDdsFile}>{m.texture_atlas_browse()}</button>
                              </div>
                            </div>

                            <div class="atlas-form-grid">
                              <label class="atlas-field">
                                <span class="atlas-label">{m.texture_atlas_uuid()}</span>
                                <input type="text" class={monoInputClass} bind:value={uuidValue} />
                              </label>
                              <label class="atlas-field">
                                <span class="atlas-label">{m.texture_atlas_entry_label()}</span>
                                <input type="text" class={inputClass} bind:value={labelValue} />
                              </label>
                            </div>

                            <div class="atlas-form-grid">
                              <label class="atlas-field">
                                <span class="atlas-label">{m.texture_atlas_atlas_width()}</span>
                                <input type="number" class={monoInputClass} bind:value={atlasWidthVal} min="0" />
                              </label>
                              <label class="atlas-field">
                                <span class="atlas-label">{m.texture_atlas_icon_width()}</span>
                                <input type="number" class={monoInputClass} bind:value={iconWidthVal} min="0" />
                              </label>
                            </div>

                            <div class="atlas-form-grid">
                              <label class="atlas-field">
                                <span class="atlas-label">{m.texture_atlas_atlas_height()}</span>
                                <input type="number" class={monoInputClass} bind:value={atlasHeightVal} min="0" />
                              </label>
                              <label class="atlas-field">
                                <span class="atlas-label">{m.texture_atlas_icon_height()}</span>
                                <input type="number" class={monoInputClass} bind:value={iconHeightVal} min="0" />
                              </label>
                            </div>

                            {#if nonCleanDivision}
                              <div class="atlas-warning" role="alert">
                                <AlertTriangle size={14} />
                                {m.texture_atlas_warn_uneven_division({ w: atlasWidthVal, h: atlasHeightVal, iw: iconWidthVal, ih: iconHeightVal })}
                              </div>
                            {/if}
                            {#if dimensionMismatch}
                              <div class="atlas-warning" role="alert">
                                <AlertTriangle size={14} />
                                {m.texture_atlas_warn_dimension_mismatch({ w: atlasWidthVal, h: atlasHeightVal, dw: String(ddsWidth), dh: String(ddsHeight) })}
                              </div>
                            {/if}
                          </div>

                          <div class="atlas-dds-preview">
                            <TexturePreview
                              ddsPath={resolveAssetPath(pathValue)}
                              projectDir={projectDir}
                              onpathchange={(newPath) => { pathValue = newPath; }}
                            />
                          </div>
                        </div>
                      </FormSectionCard>

                      <!-- ── Icon UVs ── -->
                      <FormSectionCard
                        title={m.texture_atlas_icon_uvs()}
                        id="icon-uvs"
                        open={true}
                        badge={m.texture_atlas_icon_count({ count: String(iconUVs.length), capacity: String(capacityTotal) })}
                      >
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
                          <div class="atlas-icons-list" style:--atlas-bg={atlasPng ? `url(data:image/png;base64,${atlasPng})` : 'none'}>
                            {#each iconUVs as uv, i (uv.id)}
                              {@const u1 = parseFloat(uv.u1) || 0}
                              {@const v1 = parseFloat(uv.v1) || 0}
                              {@const u2 = parseFloat(uv.u2) || 0}
                              {@const v2 = parseFloat(uv.v2) || 0}
                              {@const dw = u2 - u1}
                              {@const dh = v2 - v1}
                              {@const hasRegion = dw > 0 && dh > 0 && atlasPng}
                              <details class="atlas-icon-card" id="icon-uv-{uv.id}" bind:open={uv.open}>
                                <summary class="atlas-icon-summary">
                                  <ChevronRight size={12} class="atlas-icon-chevron" />
                                  {#if hasRegion}
                                    <div
                                      class="uv-thumb uv-thumb-sm"
                                      style="background-size:{24/dw}px {24/dh}px;background-position:-{u1*24/dw}px -{v1*24/dh}px"
                                      aria-hidden="true"
                                    ></div>
                                  {/if}
                                  <span class="atlas-icon-index">#{i + 1}</span>
                                  <span class="atlas-icon-mapkey-label">{uv.mapKey || m.texture_atlas_unnamed()}</span>
                                  <button
                                    type="button"
                                    class="atlas-remove-btn"
                                    title={m.texture_atlas_remove_icon()}
                                    onclick={(e) => { e.stopPropagation(); removeIconUV(i); }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </summary>
                                <div class="atlas-icon-body">
                                  <div class="atlas-icon-body-row">
                                    <div class="atlas-icon-fields">
                                      <label class="atlas-field atlas-field-full">
                                        <span class="atlas-label">{m.texture_atlas_mapkey()}</span>
                                        <input type="text" class={inputClass} bind:value={uv.mapKey} />
                                      </label>
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
                                    {#if hasRegion}
                                      <div
                                        class="uv-thumb uv-thumb-lg"
                                        style="background-size:{64/dw}px {64/dh}px;background-position:-{u1*64/dw}px -{v1*64/dh}px"
                                        title="{uv.mapKey || `Icon #${i + 1}`}"
                                      ></div>
                                    {/if}
                                  </div>
                                </div>
                              </details>
                            {/each}
                          </div>
                        {:else}
                          <p class="atlas-empty">{m.texture_atlas_no_icons()}</p>
                        {/if}
                      </FormSectionCard>
                    </div>
                  </div>
                </div>
              {:else}
                <!-- Collapsed row — matches EntryRow collapsed pattern -->
                <div class="flex items-center gap-2 px-3 py-1.5 cursor-pointer"
                  onclick={() => toggleEntry(entry.sourceFile)}
                  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleEntry(entry.sourceFile); }}}
                  role="button"
                  tabindex={0}
                >
                  <button
                    type="button"
                    class="shrink-0 p-0.5 rounded hover:bg-zinc-700/40 transition-colors cursor-pointer"
                    aria-label="Expand {entry.fileName}"
                  >
                    <ChevronDown class="w-3.5 h-3.5 text-zinc-600" />
                  </button>
                  <span class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">NEW</span>
                  <FileImage size={14} class="shrink-0 text-[var(--th-text-400)]" />
                  <span class="flex-1 text-sm font-medium truncate">{entry.fileName}</span>
                  {#if entry.atlasPath}
                    <span class="text-[10px] font-mono text-[var(--th-text-500)] truncate max-w-[200px]">{entry.atlasPath}</span>
                  {/if}
                  {#if entry.atlasWidth && entry.atlasHeight}
                    <span class="text-[10px] font-mono text-[var(--th-text-400)]">{entry.atlasWidth}×{entry.atlasHeight}</span>
                  {/if}
                  <span class="text-[10px] text-[var(--th-text-400)]">{entry.iconCount} icons</span>
                </div>
              {/if}
            </div>
          {/each}
        {:else}
          <p class="text-xs text-[var(--th-text-500)] px-2 py-4 text-center">
            {m.texture_atlas_no_icons()}
          </p>
        {/if}
      </div>
    </div>
  {/if}
</section>

<style>
  /* ── Entry row hover — matches EntryRow.svelte ── */
  :global(.entry-row:hover) {
    background: color-mix(in srgb, var(--th-bg-700, #3f3f46) 40%, transparent);
  }

  /* ── Form within expanded entry row ── */
  .atlas-form-with-nav {
    display: flex;
    gap: 0.75rem;
  }

  .atlas-form-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  /* ── Atlas Info / form fields ── */
  .atlas-form-row {
    display: flex;
    gap: 1rem;
  }

  .atlas-form-left {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
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
  }

  /* ── Path: combobox + browse + drag-drop ── */
  .atlas-path-row {
    display: flex;
    gap: 6px;
    align-items: stretch;
    border-radius: 4px;
    transition: box-shadow 0.15s;
  }

  .atlas-path-row.drag-over {
    box-shadow: inset 0 0 0 2px var(--th-accent-500, #0ea5e9);
  }

  .atlas-path-combobox {
    flex: 1;
    min-width: 0;
  }

  .atlas-browse-btn {
    flex-shrink: 0;
    padding: 0 10px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    color: var(--th-text-200);
    background: var(--th-bg-800);
    border: 1px solid var(--th-border-600, var(--th-bg-600));
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }

  .atlas-browse-btn:hover {
    background: var(--th-bg-700, var(--th-bg-800));
    border-color: var(--th-accent-500, #0ea5e9);
  }

  .atlas-browse-btn:focus-visible {
    outline: 2px solid var(--th-accent-500, #0ea5e9);
    outline-offset: 2px;
  }

  .atlas-dds-preview {
    width: 200px;
    min-height: 140px;
    flex-shrink: 0;
  }

  /* ── Icon UVs toolbar ── */
  .atlas-uv-toolbar {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 6px;
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
    border: 1px solid var(--th-border-600, var(--th-bg-600));
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

  /* ── Collapsible Icon UV cards ── */
  .atlas-icons-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .atlas-icon-card {
    border: 1px solid var(--th-border-700, var(--th-bg-700));
    border-radius: 6px;
    overflow: hidden;
  }

  .atlas-icon-summary {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    background: var(--th-bg-800);
    cursor: pointer;
    user-select: none;
    font-size: 12px;
    color: var(--th-text-300);
    list-style: none;
  }

  .atlas-icon-summary::-webkit-details-marker {
    display: none;
  }

  .atlas-icon-card :global(.atlas-icon-chevron) {
    transition: transform 0.15s;
    flex-shrink: 0;
    color: var(--th-text-500);
  }

  .atlas-icon-card[open] :global(.atlas-icon-chevron) {
    transform: rotate(90deg);
  }

  .atlas-icon-summary:hover {
    color: var(--th-text-100);
    background: var(--th-bg-700, var(--th-bg-800));
  }

  .atlas-icon-index {
    font-size: 10px;
    font-weight: 600;
    color: var(--th-text-500);
    min-width: 22px;
  }

  .atlas-icon-mapkey-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: monospace;
    font-size: 11px;
    color: var(--th-text-200);
  }

  .atlas-icon-body {
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    border-top: 1px solid var(--th-border-800, var(--th-bg-700));
  }

  .atlas-icon-body-row {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }

  .atlas-icon-fields {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  /* ── UV crop preview thumbnails ── */
  .uv-thumb {
    background-image: var(--atlas-bg);
    background-repeat: no-repeat;
    border-radius: 3px;
    border: 1px solid var(--th-border-700);
    flex-shrink: 0;
    image-rendering: pixelated;
  }

  .uv-thumb-sm {
    width: 24px;
    height: 24px;
  }

  .uv-thumb-lg {
    width: 64px;
    height: 64px;
  }

  .atlas-remove-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
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
</style>
