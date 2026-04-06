<script lang="ts">
  import { open } from "@tauri-apps/plugin-dialog";
  import { settingsStore } from "../../lib/stores/settingsStore.svelte.js";
  import { modStore } from "../../lib/stores/modStore.svelte.js";
  import { modImportService, type DuplicatePromptFn } from "../../lib/services/modImportService.svelte.js";
  import { dataOperationStore } from "../../lib/stores/dataOperationStore.svelte.js";
  import { toastStore } from "../../lib/stores/toastStore.svelte.js";
  import {
    populateVanillaDbs,
    getDbStatus,
    getDbPaths,
    resetReferenceDbs,
    detectGameDataPath,
    validateGameDataPath,
    openPath,
    populateModsDb,
    removeModFromModsDb,
  } from "../../lib/utils/tauri.js";
  import type { DbFileStatus } from "../../lib/utils/tauri.js";
  import { scanAndImport } from "../../lib/services/scanService.js";
  import Folder from "@lucide/svelte/icons/folder";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import Package from "@lucide/svelte/icons/package";
  import Search from "@lucide/svelte/icons/search";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import Check from "@lucide/svelte/icons/check";
  import X from "@lucide/svelte/icons/x";
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import { m } from "../../paraglide/messages.js";

  let {
    onback,
    onclose,
    showDuplicatePrompt,
    onwarnings,
    sidebar = false,
  }: {
    onback: () => void;
    onclose: () => void;
    showDuplicatePrompt: DuplicatePromptFn;
    onwarnings: (messages: string[]) => void;
    sidebar?: boolean;
  } = $props();

  // ── Local UI state ─────────────────────────────────────────────────
  let dbSizeDisplay = $state("");
  let modsDbSizeDisplay = $state("");
  let elapsedSecs = $state(0);
  let elapsedTimer: ReturnType<typeof setInterval> | null = null;

  function formatElapsed(secs: number): string {
    const min = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(min).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
  }

  function startElapsedTimer() {
    elapsedSecs = 0;
    elapsedTimer = setInterval(() => { elapsedSecs++; }, 1000);
  }
  function stopElapsedTimer() {
    if (elapsedTimer) { clearInterval(elapsedTimer); elapsedTimer = null; }
  }

  // ── Effects ────────────────────────────────────────────────────────

  // Load DB size on mount
  $effect(() => {
    refreshDbSize();
  });

  // Validate Game Data path
  $effect(() => {
    const gp = settingsStore.gameDataPath;
    if (gp) {
      (async () => {
        try {
          modImportService.gameDataValid = await validateGameDataPath(gp);
        } catch (e) {
          console.warn("Game data path validation failed:", e);
          modImportService.gameDataValid = false;
        }
      })();
    } else {
      modImportService.gameDataValid = null;
    }
  });

  // ── Helpers ────────────────────────────────────────────────────────

  /** Generic file/directory picker — wraps the Tauri open() dialog. */
  async function pickPath(
    opts: Parameters<typeof open>[0],
    handler: (path: string) => void | Promise<void>,
  ): Promise<void> {
    try {
      const selected = await open(opts);
      if (selected != null) {
        const p = Array.isArray(selected) ? selected[0] : String(selected);
        await handler(p);
      }
    } catch (e) {
      console.error("Dialog error:", e);
    }
  }

  async function refreshDbSize() {
    try {
      const statuses: DbFileStatus[] = await getDbStatus();
      const totalBytes = statuses.reduce((sum, s) => sum + (s.exists ? s.size_bytes : 0), 0);
      dbSizeDisplay = totalBytes > 0 ? formatBytes(totalBytes) : "";
      const modsEntry = statuses.find(s => s.name.includes("mods"));
      modsDbSizeDisplay = modsEntry && modsEntry.exists && modsEntry.size_bytes > 0 ? formatBytes(modsEntry.size_bytes) : "";
    } catch {
      dbSizeDisplay = "";
      modsDbSizeDisplay = "";
    }
  }

  // ── Path pickers ───────────────────────────────────────────────────

  async function pickGameDataPath() {
    await pickPath(
      { directory: true, title: m.loaded_data_select_install_title() },
      async (p) => { settingsStore.setGameDataPath(p); modImportService.gameDataValid = await validateGameDataPath(p); },
    );
  }

  async function pickAdditionalMod() {
    await pickPath({ directory: true, title: m.loaded_data_select_mod_folder() }, (p) => modImportService.addModPath(p, showDuplicatePrompt));
  }

  async function pickAdditionalModPak() {
    await pickPath(
      { directory: false, title: m.loaded_data_select_mod_pak(), filters: [{ name: m.loaded_data_pak_filter(), extensions: ["pak"] }] },
      (p) => modImportService.addModPath(p, showDuplicatePrompt),
    );
  }

  // ── Populate / Reset ───────────────────────────────────────────────

  async function handlePopulate() {
    if (!settingsStore.gameDataPath) return;
    dataOperationStore.startOperation("populate");
    startElapsedTimer();
    try {
      const result = await populateVanillaDbs(settingsStore.gameDataPath);
      stopElapsedTimer();
      if (dataOperationStore.isCancelled) return;
      let msg = m.loaded_data_populate_complete({ paks_extracted: result.paks_extracted, files_kept: result.files_kept });
      if (result.errors.length > 0) {
        msg = `${msg}${m.loaded_data_populate_warnings({ errors_count: result.errors.length })}` as typeof msg;
        onwarnings(result.errors);
      }
      dataOperationStore.completeOperation(msg);
      toastStore.success(m.loaded_data_populate_complete_title(), msg);
      refreshDbSize();
    } catch (e: unknown) {
      stopElapsedTimer();
      const msg = typeof e === "string" ? e : (e as Error)?.message ?? "Unknown error";
      dataOperationStore.failOperation(msg);
      toastStore.error(m.loaded_data_populate_failed_title(), msg);
    }
  }

  async function handleReset() {
    if (!confirm(m.loaded_data_populate_confirm())) return;
    dataOperationStore.startOperation("reset");
    startElapsedTimer();
    try {
      await resetReferenceDbs();
      stopElapsedTimer();
      dataOperationStore.completeOperation(m.loaded_data_reset_complete());
      toastStore.success(m.loaded_data_reset_complete_title(), m.loaded_data_reset_complete());
      refreshDbSize();
    } catch (e: unknown) {
      stopElapsedTimer();
      const msg = typeof e === "string" ? e : (e as Error)?.message ?? "Unknown error";
      dataOperationStore.failOperation(msg);
      toastStore.error(m.loaded_data_reset_failed_title(), msg);
    }
  }

  function handleClearAllMods() {
    modImportService.clearAll();
    refreshDbSize();
  }

  async function handleRefreshMod(modPath: string) {
    const modName = modPath.split(/[\\/]/).pop()?.replace(/\.pak$/i, "") ?? "mod";
    try {
      const dbPaths = await getDbPaths();
      await removeModFromModsDb(modName, dbPaths.mods);
      await populateModsDb(modPath, modName, dbPaths.mods, false);
      refreshDbSize();
    } catch (e) {
      console.warn("[ref_mods] Failed to refresh mod:", modName, e);
    }
  }
</script>

<div class="py-2 flex-1 min-h-0 flex flex-col overflow-hidden">
  {#if !sidebar}
  <button
    class="flex items-center gap-2 px-4 py-2 text-xs text-[var(--th-text-400)] hover:text-[var(--th-text-200)] transition-colors"
    onclick={onback}
  >
    <ChevronLeft size={12} strokeWidth={2} />
    {m.common_back()}
  </button>
  {/if}

  <h3 class="px-4 py-2 text-xs font-bold text-[var(--th-text-400)] uppercase tracking-wider">{m.loaded_data_heading()}</h3>

  <div class="px-4 space-y-3 flex-1 min-h-0 flex flex-col">
    <!-- Installation Folder path -->
    <fieldset class="space-y-1">
      <div class="flex flex-wrap items-center gap-x-2">
        <label class="text-xs text-[var(--th-text-400)]" for="game-data-path">{m.loaded_data_install_folder()}</label>
        {#if !settingsStore.gameDataPath}
          <button
            class="text-xs text-sky-400 hover:text-sky-300 cursor-pointer ml-auto"
            onclick={async () => {
              try {
                const detected = await detectGameDataPath();
                if (detected) {
                  settingsStore.setGameDataPath(detected);
                  modImportService.gameDataValid = await validateGameDataPath(detected);
                }
              } catch (e) { console.warn("Auto-detect failed:", e); }
            }}
            title={m.loaded_data_auto_detect_tooltip()}
          >{m.loaded_data_auto_detect()}</button>
        {:else if modImportService.gameDataValid === true}
          <span class="text-xs text-emerald-400 ml-auto flex items-center gap-1"><Check size={12} /> {m.loaded_data_path_found()}</span>
        {:else if modImportService.gameDataValid === false}
          <span class="text-xs text-red-400 ml-auto flex items-center gap-1"><X size={12} /> {m.loaded_data_path_not_found()}</span>
        {/if}
      </div>
      <div class="flex flex-wrap items-center gap-1.5">
        <input
          id="game-data-path"
          type="text"
          class="form-input flex-1 min-w-[140px] bg-[var(--th-bg-900)] border border-[var(--th-border-600)] rounded px-2 py-1 text-xs
                 text-[var(--th-text-200)] placeholder-[var(--th-text-500)] focus:border-sky-500"
          placeholder={m.loaded_data_path_placeholder()}
          value={settingsStore.gameDataPath}
          oninput={(e: Event) => {
            const val = (e.target as HTMLInputElement).value;
            settingsStore.setGameDataPath(val);
          }}
        />
        <button
          class="browse-btn flex items-center gap-1 px-2 py-1 text-xs rounded bg-[var(--th-bg-700)] text-[var(--th-text-300)] hover:bg-[var(--th-bg-600)] shrink-0"
          onclick={pickGameDataPath}
        >
          <Folder size={12} strokeWidth={2} />
          {m.common_browse()}
        </button>
        {#if settingsStore.gameDataPath}
          <button
            class="flex items-center px-1.5 py-1 text-xs rounded bg-[var(--th-bg-700)] text-[var(--th-text-400)] hover:bg-[var(--th-bg-600)] hover:text-[var(--th-text-200)] shrink-0"
            onclick={() => openPath(settingsStore.gameDataPath)}
            title={m.loaded_data_open_install_folder()}
            aria-label={m.loaded_data_open_install_folder()}
          >
            <ExternalLink size={12} strokeWidth={2} />
          </button>
        {/if}
      </div>
    </fieldset>

    <!-- Action buttons: Populate (75%) + Reset (25%) -->
    <div class="flex gap-2">
      <button
        class="flex-[3] flex items-center justify-center gap-2 px-3 py-2 rounded text-xs font-bold
               bg-sky-600 text-white hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        onclick={handlePopulate}
        disabled={!modImportService.gameDataValid || dataOperationStore.isRunning}
      >
        {m.loaded_data_populate()}
      </button>
      <button
        class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded text-xs font-bold
               bg-red-700 text-white hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        onclick={handleReset}
        disabled={dataOperationStore.isRunning}
      >
        {m.loaded_data_reset_db()}
      </button>
    </div>

    <!-- Live progress indicator -->
    {#if dataOperationStore.isRunning}
      <div class="space-y-1.5">
        <div class="flex items-center gap-2">
          <LoaderCircle size={14} strokeWidth={2} class="animate-spin text-sky-400" />
          <span class="text-xs text-sky-300">
            {#if dataOperationStore.phase}
              {dataOperationStore.phase}
            {:else if dataOperationStore.operationType === "populate"}
              {m.loaded_data_populating()}
            {:else}
              {m.loaded_data_resetting()}
            {/if}
          </span>
          <span class="text-xs text-[var(--th-text-500)] ml-auto">{formatElapsed(elapsedSecs)}</span>
        </div>
        {#if dataOperationStore.detail}
          <p class="text-xs text-[var(--th-text-500)] truncate">{dataOperationStore.detail}</p>
        {/if}
        {#if dataOperationStore.smoothPercent > 0}
          <div class="w-full h-1 rounded-full bg-[var(--th-bg-700)] overflow-hidden">
            <div class="h-full bg-sky-400 rounded-full" style="width: {dataOperationStore.smoothPercent}%"></div>
          </div>
        {:else}
          <div class="w-full h-1 rounded-full bg-[var(--th-bg-700)] overflow-hidden">
            <div class="h-full w-1/3 bg-sky-400 rounded-full animate-[indeterminate_1.4s_ease-in-out_infinite]"></div>
          </div>
        {/if}
        <div class="text-center">
          <button
            class="text-xs text-[var(--th-text-500)] hover:text-[var(--th-text-300)] hover:underline"
            onclick={() => { stopElapsedTimer(); dataOperationStore.cancelOperation(); }}
                    >{m.common_cancel()}</button>
        </div>
      </div>
    {/if}

    <!-- Success banner -->
    {#if dataOperationStore.lastSuccess}
      <div class="flex items-start gap-2 px-2.5 py-2 rounded bg-emerald-900/30 border border-emerald-700/40">
        <Check size={14} strokeWidth={2} class="text-emerald-400 shrink-0 mt-0.5" />
        <p class="text-xs text-emerald-300 flex-1">{dataOperationStore.lastSuccess.message}</p>
        <button
          class="text-xs text-emerald-500 hover:text-emerald-300 shrink-0"
          onclick={() => dataOperationStore.resetVisibleState()}
        ><X size={12} /></button>
      </div>
    {/if}

    <!-- Error banner -->
    {#if dataOperationStore.lastError}
      <div class="flex items-start gap-2 px-2.5 py-2 rounded bg-red-900/30 border border-red-700/40">
        <X size={14} strokeWidth={2} class="text-red-400 shrink-0 mt-0.5" />
        <p class="text-xs text-red-300 flex-1">{dataOperationStore.lastError.message}</p>
        <button
          class="text-xs text-red-500 hover:text-red-300 shrink-0"
          onclick={() => dataOperationStore.resetVisibleState()}
        ><X size={12} /></button>
      </div>
    {/if}

    <!-- DB size display -->
    {#if dbSizeDisplay}
      <p class="text-xs text-center text-[var(--th-text-500)]">{m.loaded_data_db_size()} <strong class="text-[var(--th-text-300)]">{dbSizeDisplay}</strong></p>
    {/if}

    <div class="border-t border-[var(--th-border-700)] pt-3">
      <div class="flex items-center justify-between">
        <h4 class="text-xs font-bold text-[var(--th-text-400)] uppercase tracking-wider">{m.loaded_data_additional_mods()}</h4>
        <div class="flex items-center gap-2">
          {#if modsDbSizeDisplay}
            <span class="text-xs text-[var(--th-text-500)]">{modsDbSizeDisplay}</span>
          {/if}
          {#if modStore.additionalModPaths.length > 0}
            <button
              class="text-xs text-red-400/70 hover:text-red-300 cursor-pointer"
              onclick={handleClearAllMods}
              title="Clear all additional mods"
            >{m.loaded_data_clear_all()}</button>
          {/if}
        </div>
      </div>
      <p class="text-xs text-[var(--th-text-500)] mt-1">
        {m.loaded_data_additional_mods_desc()}
      </p>
    </div>

    <!-- Additional mod fields -->
    <div class="flex-1 min-h-0 overflow-y-auto scrollbar-thin space-y-2">
    {#each modImportService.allAdditionalModPaths as modPath, i}
      <div class="flex items-start gap-1.5">
        <div class="flex-1 min-w-0">
          {#if modImportService.additionalModMeta[modPath]}
            <div class="text-xs text-[var(--th-text-200)] truncate" title={modImportService.additionalModMeta[modPath].name}>
              <span class="font-medium">{modImportService.additionalModMeta[modPath].name}</span>
            </div>
            {#if modImportService.additionalModMeta[modPath].version || modImportService.additionalModMeta[modPath].author}
              <div class="text-xs text-[var(--th-text-400)] truncate">
                {#if modImportService.additionalModMeta[modPath].version}
                  <span>v{modImportService.additionalModMeta[modPath].version}</span>
                {/if}
                {#if modImportService.additionalModMeta[modPath].author}
                  <span class="text-[var(--th-text-500)]">{modImportService.additionalModMeta[modPath].version ? ' · ' : ''}by {modImportService.additionalModMeta[modPath].author}</span>
                {/if}
              </div>
            {/if}
          {:else}
            <div class="text-xs text-[var(--th-text-200)] truncate" title={modPath}>
              {modPath.split(/[\\/]/).pop() ?? `Mod ${i + 1}`}
            </div>
          {/if}
          <!-- Directory display -->
          <div class="text-xs text-[var(--th-text-500)] truncate" title={modPath}>
            {modPath}
          </div>
        </div>
        <!-- Status indicators -->
        {#if modImportService.modImportStatus[modPath] === "Scanning"}
          <span class="text-xs text-sky-400 animate-pulse shrink-0" role="status" aria-live="polite">{m.loaded_data_scanning()}</span>
        {:else if modImportService.modImportStatus[modPath] === "Ingesting"}
          <span class="text-xs text-amber-400 animate-pulse shrink-0" role="status" aria-live="polite">{m.loaded_data_ingesting()}</span>
        {:else if modImportService.pendingModPaths.includes(modPath)}
          <span class="text-xs text-sky-400 animate-pulse shrink-0" role="status" aria-live="polite">Loading…</span>
        {/if}
        <!-- Action buttons -->
        <div class="flex flex-col items-end shrink-0">
        <div class="flex items-center gap-0.5">
          <!-- Set as primary (scan) button — folder mods only -->
          {#if !modPath.endsWith(".pak") && !modImportService.pendingModPaths.includes(modPath) && !modImportService.modImportStatus[modPath]}
            <button
              class="text-xs text-sky-400 hover:text-sky-300 px-1 py-1 rounded hover:bg-[var(--th-bg-700)]"
              onclick={async () => {
                const { scanPath, extraPaths } = modImportService.setAsPrimary(modPath);
                onclose();
                await scanAndImport(scanPath, extraPaths);
              }}
              title={m.loaded_data_set_primary()}
              aria-label="Set {modImportService.additionalModMeta[modPath]?.name ?? modPath.split(/[\\/]/).pop()} as primary"
            >
              <Search size={12} strokeWidth={2} />
            </button>
          {/if}
          <!-- Open folder button — folder mods only -->
          {#if !modPath.endsWith(".pak")}
              <button
                class="text-xs text-[var(--th-text-400)] hover:text-[var(--th-text-200)] px-1 py-1 rounded hover:bg-[var(--th-bg-700)]"
                onclick={() => openPath(modPath)}
                title={m.loaded_data_open_mod_folder()}
                aria-label="Open folder for {modImportService.additionalModMeta[modPath]?.name ?? modPath.split(/[\\/]/).pop()}"
              >
                <ExternalLink size={12} strokeWidth={2} />
              </button>
            {/if}
          <!-- Refresh button (re-ingest into ref_mods) -->
          {#if !modImportService.pendingModPaths.includes(modPath) && !modImportService.modImportStatus[modPath]}
            <button
              class="text-xs text-[var(--th-text-400)] hover:text-[var(--th-text-200)] px-1 py-1 rounded hover:bg-[var(--th-bg-700)]"
              onclick={() => handleRefreshMod(modPath)}
              title={m.loaded_data_refresh_mod()}
              aria-label="Refresh {modImportService.additionalModMeta[modPath]?.name ?? modPath.split(/[\\/]/).pop()}"
            >
              <RefreshCw size={12} strokeWidth={2} />
            </button>
          {/if}
          <!-- Remove button -->
          <button
            class="text-xs text-red-400 hover:text-red-300 px-1 py-1 rounded hover:bg-[var(--th-bg-700)]"
            onclick={() => { modImportService.removeAdditionalMod(i); refreshDbSize(); }}
            title={m.loaded_data_remove_mod()}
            aria-label="Remove mod {modPath.split(/[\\/]/).pop()}"
          ><X size={12} /></button>
        </div>
        </div>
      </div>
    {/each}
    </div>

    <div class="flex flex-wrap gap-2 shrink-0 pt-2">
      <button
        class="text-xs text-sky-400 hover:text-sky-300 font-medium py-1 cursor-pointer"
        onclick={pickAdditionalMod}
      >{m.loaded_data_add_folder()}</button>
      <button
        class="text-xs text-sky-400 hover:text-sky-300 font-medium py-1 cursor-pointer"
        onclick={pickAdditionalModPak}
      >{m.loaded_data_add_pak()}</button>
      <button
        class="text-xs text-amber-400 hover:text-amber-300 font-medium py-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        onclick={() => modImportService.importFromLoadOrder(showDuplicatePrompt)}
        disabled={modImportService.isImportingLoadOrder}
        title={m.loaded_data_import_tooltip()}
      >{#if modImportService.isImportingLoadOrder}{m.loaded_data_importing()}{:else}<Package size={14} strokeWidth={2} class="inline -mt-0.5" /> {m.loaded_data_import_load_order()}{/if}</button>
    </div>
    {#if modImportService.loadOrderStatus}
      <div class="text-xs text-[var(--th-text-400)] mt-1">{modImportService.loadOrderStatus}</div>
    {/if}
  </div>
</div>
