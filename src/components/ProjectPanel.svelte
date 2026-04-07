<script lang="ts">
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import { toastStore } from "../lib/stores/toastStore.svelte.js";
  import { uiStore } from "../lib/stores/uiStore.svelte.js";
  import { dirSize, fileExists } from "../lib/tauri/mod-management.js";
  import { convertFileSrc } from "@tauri-apps/api/core";
  import { open as dialogOpen } from "@tauri-apps/plugin-dialog";
  import { open as shellOpen } from "@tauri-apps/plugin-shell";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronUp from "@lucide/svelte/icons/chevron-up";
  import ShieldCheck from "@lucide/svelte/icons/shield-check";
  import PackageIcon from "@lucide/svelte/icons/package";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import FlaskConical from "@lucide/svelte/icons/flask-conical";
  import FolderPlus from "@lucide/svelte/icons/folder-plus";
  import { packageMod } from "../lib/tauri/packaging.js";

  let showPackagingDrawer = $state(false);
  let outputPath = $state("");
  let compression = $state("LZ4");
  let compressionLevel = $state<"fast" | "default" | "max">("default");
  let priority = $state(40);

  const compressionOptions = ["None", "LZ4", "Zlib"];

  let meta = $derived(modStore.scanResult?.mod_meta ?? null);
  let folderSize: number | null = $state(null);
  let thumbnailUrl = $state<string | null>(null);

  let thumbnailPath = $derived.by(() => {
    const modPath = modStore.selectedModPath;
    const folder = meta?.folder;
    if (!modPath || !folder) return null;
    return `${modPath}/Mods/${folder}/mod_publish_logo.png`;
  });

  $effect(() => {
    const path = thumbnailPath;
    if (!path) { thumbnailUrl = null; return; }
    fileExists(path).then(exists => {
      thumbnailUrl = exists ? convertFileSrc(path) + `?t=${Date.now()}` : null;
    }).catch(() => { thumbnailUrl = null; });
  });

  $effect(() => {
    const path = modStore.selectedModPath;
    if (!path) { folderSize = null; return; }
    dirSize(path).then(sz => { folderSize = sz; }).catch(() => { folderSize = null; });
  });

  $effect(() => {
    const modPath = modStore.selectedModPath;
    if (modPath) {
      const parts = modPath.replace(/\\/g, "/").split("/");
      parts.pop();
      outputPath = parts.join("/");
    }
  });

  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  let versionString = $derived.by(() => {
    if (!meta?.version64) return "";
    try {
      const n = BigInt(meta.version64);
      const major = Number((n >> 55n) & 0xFFn);
      const minor = Number((n >> 47n) & 0xFFn);
      const revision = Number((n >> 31n) & 0xFFFFn);
      const build = Number(n & 0x7FFFFFFFn);
      return `v${major}.${minor}.${revision}.${build}`;
    } catch {
      return "";
    }
  });

  function handleValidate() {
    toastStore.info("Coming Soon", "Mod validation will be available in Sprint 55/56");
  }

  async function handlePackageMod() {
    if (!modStore.selectedModPath) return;
    const modName = meta?.name || "mod";
    try {
      toastStore.info("Packaging...", `Building ${modName}.pak`);
      const result = await packageMod({
        modPath: modStore.selectedModPath,
        outputPath: outputPath || modStore.selectedModPath.replace(/[\/\\][^\/\\]*$/, ""),
        priority: priority,
        compression: compression.toLowerCase() as "none" | "zlib" | "lz4",
        compressionLevel: compressionLevel,
      });
      toastStore.success("Package Complete", `Created ${result.output_path} (${result.file_count} files, ${formatBytes(result.total_bytes)})`);
    } catch (err) {
      toastStore.error("Packaging Failed", String(err));
    }
  }

  function togglePackagingDrawer() {
    showPackagingDrawer = !showPackagingDrawer;
  }

  async function handleOpenProjectFolder() {
    if (!modStore.selectedModPath) return;
    try {
      await shellOpen(modStore.selectedModPath);
    } catch (err) {
      toastStore.error("Failed to open folder", String(err));
    }
  }

  function handleTestMod() {
    toastStore.info("Coming Soon", "Mod testing will be available in Sprint 55/56");
  }

  async function handleBrowseOutputPath() {
    const selected = await dialogOpen({
      directory: true,
      title: "Select output folder",
    });
    if (selected) {
      outputPath = selected as string;
    }
  }

  function handleOpenProject() {
    uiStore.activeView = "loaded-data";
  }
</script>

<div class="project-panel" role="region" aria-label="Project panel">
  <div class="panel-header">
    <span class="text-[10px] font-semibold tracking-widest uppercase text-[var(--th-text-500)]">Project</span>
  </div>

  {#if modStore.scanResult && meta}
    <!-- Mod Info -->
    <div class="mod-info">
      <div class="thumbnail-box" aria-label="Mod thumbnail">
        {#if thumbnailUrl}
          <img src={thumbnailUrl} alt="Mod thumbnail" class="thumbnail-img" />
        {:else}
          <span class="text-[10px] text-[var(--th-text-500)]">No Image</span>
        {/if}
      </div>

      <div class="mod-details">
        <div class="flex items-baseline gap-1.5">
          <span class="text-sm font-bold text-[var(--th-text-100)] truncate">{meta.name || "Unnamed Mod"}</span>
          {#if meta.author}
            <span class="text-[11px] text-[var(--th-text-500)] truncate shrink-0">{meta.author}</span>
          {/if}
        </div>
        <div class="flex items-baseline gap-1.5">
          {#if versionString}
            <span class="text-xs text-[var(--th-text-400)]">{versionString}</span>
          {/if}
          {#if folderSize !== null}
            <span class="text-[11px] text-[var(--th-text-500)]">{formatBytes(folderSize)}</span>
          {/if}
        </div>
        {#if meta.description}
          <div class="text-xs text-[var(--th-text-400)] mt-1 line-clamp-2">{meta.description}</div>
        {/if}
        {#if meta.tags}
          <div class="text-[11px] text-[var(--th-text-500)] mt-0.5">{meta.tags}</div>
        {/if}
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="action-list" role="list">
      <button class="action-item" onclick={handleValidate} aria-label="Validate mod files">
        <ShieldCheck size={16} />
        <span>Validate Mod Files</span>
      </button>

      <div class="action-item-group">
        <button class="action-item action-item-main" onclick={handlePackageMod} aria-label="Package mod">
          <PackageIcon size={16} />
          <span>Package Mod</span>
        </button>
        <button
          class="action-item-chevron"
          onclick={togglePackagingDrawer}
          aria-label={showPackagingDrawer ? "Hide packaging options" : "Show packaging options"}
          aria-expanded={showPackagingDrawer}
        >
          {#if showPackagingDrawer}
            <ChevronUp size={14} />
          {:else}
            <ChevronDown size={14} />
          {/if}
        </button>
      </div>

      <!-- Packaging Drawer -->
      {#if showPackagingDrawer}
        <div class="packaging-drawer" role="group" aria-label="Packaging options">
          <div class="drawer-header text-[10px] font-semibold tracking-widest uppercase text-[var(--th-text-500)]">
            Packaging Options
          </div>

          <label class="drawer-field">
            <span class="drawer-label">Output path</span>
            <div class="drawer-row">
              <input
                type="text"
                class="drawer-input"
                bind:value={outputPath}
                placeholder="Select output folder…"
                aria-label="Output path"
              />
              <button class="drawer-browse" onclick={handleBrowseOutputPath} aria-label="Browse for output folder">
                Browse
              </button>
            </div>
          </label>

          <label class="drawer-field">
            <span class="drawer-label">Compression</span>
            <select class="drawer-select" bind:value={compression} aria-label="Compression method">
              {#each compressionOptions as opt}
                <option value={opt}>{opt}</option>
              {/each}
            </select>
          </label>

          <div class="drawer-row">
            <label class="drawer-field" style="flex:1">
              <span class="drawer-label">Speed</span>
              <select class="drawer-select" bind:value={compressionLevel} aria-label="Compression speed">
                <option value="fast">Fast</option>
                <option value="default">Default</option>
                <option value="max">Max</option>
              </select>
            </label>

            <label class="drawer-field" style="flex:1">
              <span class="drawer-label">Priority</span>
              <input
                type="number"
                class="drawer-input"
                bind:value={priority}
                aria-label="Mod priority"
              />
            </label>
          </div>
        </div>
      {/if}

      <button class="action-item" onclick={handleOpenProjectFolder} aria-label="Open project folder">
        <FolderOpen size={16} />
        <span>Open Project Folder</span>
      </button>

      <button class="action-item" onclick={handleTestMod} aria-label="Test mod">
        <FlaskConical size={16} />
        <span>Test Mod</span>
      </button>
    </div>
  {:else}
    <!-- Empty state -->
    <div class="empty-state">
      <p class="text-sm text-[var(--th-text-400)]">No project loaded</p>
      <button class="open-project-btn" onclick={handleOpenProject} aria-label="Open project">
        <FolderPlus size={16} />
        <span>Open Project</span>
      </button>
    </div>
  {/if}
</div>

<style>
  .project-panel {
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    padding-bottom: 1rem;
  }

  .panel-header {
    display: flex;
    align-items: center;
    padding: 8px 12px 4px;
    user-select: none;
  }

  .mod-info {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    padding: 12px;
    gap: 10px;
    border-bottom: 1px solid var(--th-bg-700);
  }

  .thumbnail-box {
    width: 64px;
    height: 64px;
    border: 2px dashed var(--th-bg-600);
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--th-bg-800);
    flex-shrink: 0;
    overflow: hidden;
  }

  .thumbnail-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .mod-details {
    text-align: left;
    min-width: 0;
    flex: 1;
  }

  .action-list {
    padding: 8px 8px 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .action-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 4px;
    font-size: 13px;
    color: var(--th-text-300);
    background: transparent;
    border: none;
    cursor: pointer;
    width: 100%;
    text-align: left;
    transition: background 0.1s;
  }

  .action-item:hover {
    background: var(--th-bg-700);
  }

  .action-item-group {
    display: flex;
    align-items: stretch;
    border-radius: 4px;
  }

  .action-item-group:hover .action-item-main,
  .action-item-group:hover .action-item-chevron {
    background: var(--th-bg-700);
  }

  .action-item-main {
    flex: 1;
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  .action-item-chevron {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 6px;
    border: none;
    background: transparent;
    color: var(--th-text-400);
    cursor: pointer;
    border-top-right-radius: 4px;
    border-bottom-right-radius: 4px;
    transition: background 0.1s;
  }

  .action-item-chevron:hover {
    color: var(--th-text-200);
  }

  .packaging-drawer {
    margin: 4px 0;
    padding: 10px;
    border-radius: 6px;
    background: var(--th-bg-800);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .drawer-header {
    padding-bottom: 4px;
  }

  .drawer-field {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .drawer-label {
    font-size: 11px;
    color: var(--th-text-400);
  }

  .drawer-row {
    display: flex;
    gap: 4px;
  }

  .drawer-input {
    flex: 1;
    padding: 4px 6px;
    font-size: 12px;
    border: 1px solid var(--th-bg-600);
    border-radius: 4px;
    background: var(--th-bg-900);
    color: var(--th-text-200);
    min-width: 0;
  }

  .drawer-input:focus {
    outline: none;
    border-color: var(--th-accent-500, #3b82f6);
  }

  .drawer-select {
    padding: 4px 6px;
    font-size: 12px;
    border: 1px solid var(--th-bg-600);
    border-radius: 4px;
    background: var(--th-bg-900);
    color: var(--th-text-200);
  }

  .drawer-select:focus {
    outline: none;
    border-color: var(--th-accent-500, #3b82f6);
  }

  .drawer-browse {
    padding: 4px 8px;
    font-size: 11px;
    border: 1px solid var(--th-bg-600);
    border-radius: 4px;
    background: var(--th-bg-700);
    color: var(--th-text-300);
    cursor: pointer;
    white-space: nowrap;
  }

  .drawer-browse:hover {
    background: var(--th-accent-600, #2563eb);
    color: #fff;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 2rem 1rem;
    text-align: center;
  }

  .open-project-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    font-size: 13px;
    border: 1px solid var(--th-bg-600);
    border-radius: 4px;
    background: var(--th-bg-700);
    color: var(--th-text-200);
    cursor: pointer;
    transition: background 0.1s;
  }

  .open-project-btn:hover {
    background: var(--th-bg-600);
  }
</style>
