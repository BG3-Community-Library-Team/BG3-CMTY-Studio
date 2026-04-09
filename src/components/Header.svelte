<script lang="ts">
  import { open } from "@tauri-apps/plugin-dialog";
  import Info from "@lucide/svelte/icons/info";
  import FileText from "@lucide/svelte/icons/file-text";
  import { m } from "../paraglide/messages.js";
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import { settingsStore } from "../lib/stores/settingsStore.svelte.js";
  import { uiStore } from "../lib/stores/uiStore.svelte.js";
  import { openProject } from "../lib/services/scanService.js";
  import ExistingConfigModal from "./ExistingConfigModal.svelte";
  import type { SectionResult } from "../lib/types/index.js";

  let showConfigModal = $state(false);

  // Bind to the shared store so pickAndScan (HamburgerMenu) also populates this field
  let modPath = $derived(modStore.selectedModPath);
  function setModPath(v: string) { modStore.selectedModPath = v; }

  // Restore last project path from settings on mount (one-time)
  $effect(() => {
    if (!modStore.selectedModPath && settingsStore.lastProjectPath) {
      // Restore last project path — openProject will detect mods within it
      modStore.projectPath = settingsStore.lastProjectPath;
      modStore.selectedModPath = settingsStore.lastProjectPath;
    }
    // Run once
    return undefined;
  });

  async function pickModFolder(): Promise<void> {
    try {
      const selected = await open({ directory: true, title: m.header_select_mod_folder() });
      if (selected != null) {
        setModPath(Array.isArray(selected) ? selected[0] : String(selected));
      }
    } catch (e) {
      console.error("Dialog error:", e);
    }
  }

  async function handleScan(): Promise<void> {
    if (!modPath) return;
    // Persist the project path for next session
    const projectPath = modStore.projectPath || modPath;
    settingsStore.lastProjectPath = projectPath;
    settingsStore.persist();
    try {
      await openProject(modPath);
    } catch (e) {
      console.error("[handleScan] openProject failed:", e);
      const msg = typeof e === "string"
        ? e
        : e instanceof Error
          ? e.message
          : e != null && typeof e === "object" && "message" in e
            ? String((e as Record<string, unknown>).message)
            : "Failed to open project";
      modStore.error = msg;
    }
  }
</script>

{#if modStore.error}
  <div class="px-4 py-2 bg-[var(--th-bg-red-900-50)] border-b border-[var(--th-border-red-700)] text-[var(--th-text-red-300)] text-sm">
    {modStore.error}
  </div>
{/if}

<!-- IA-01: Inline prerequisite banner when vanilla data path is not set and mod is loaded -->
{#if !settingsStore.gameDataPath && modStore.scanResult}
  <div class="flex items-center gap-2 px-4 py-2 bg-[var(--th-warn-bg,rgba(120,53,15,0.3))] border-b border-[var(--th-warn-border,rgba(180,83,9,0.5))] text-[var(--th-warn-text,#fcd34d)] text-xs">
    <Info class="w-4 h-4 shrink-0" aria-hidden="true" />
    <span class="flex-1">{m.header_vanilla_not_configured()}</span>
    <button
      class="text-[var(--th-warn-link,#fde68a)] hover:text-[var(--th-text-100)] underline underline-offset-2 cursor-pointer whitespace-nowrap font-medium"
      onclick={() => uiStore.toggleSidebar("loaded-data")}
    >
      {m.header_configure_now()}
    </button>
  </div>
{/if}

<!-- Action bar — mod scanning & selection (replaces old Header + info bar) -->
<div class="action-bar flex items-center gap-2 px-3 py-1.5 bg-[var(--th-bg-800-50)] border-b border-[var(--th-border-700)] text-xs" data-tauri-drag-region>
  <!-- Mod folder input + Browse + Scan -->
  <label class="flex items-center gap-1.5 flex-1 min-w-0 text-[var(--th-text-400)]">
    {m.header_mod_label()}
    <input
      type="text"
      class="flex-1 min-w-0 bg-[var(--th-input-bg)] border border-[var(--th-input-border)] rounded px-2 py-1 text-sm
             text-[var(--th-input-text)] placeholder-[var(--th-input-placeholder)] focus:border-sky-500"
      placeholder={m.header_mod_placeholder()}
      value={modPath}
      oninput={(e) => setModPath((e.target as HTMLInputElement).value)}
    />
  </label>
  <button
    class="px-2 py-1 text-xs rounded bg-[var(--th-bg-700)] text-[var(--th-text-300)] hover:bg-[var(--th-bg-800)] whitespace-nowrap"
    onclick={pickModFolder}
  >
    {m.common_browse()}
  </button>
  <button
    class="px-3 py-1 rounded bg-[var(--th-bg-sky-600)] text-white text-xs font-medium
           hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed
           transition-colors whitespace-nowrap"
    onclick={handleScan}
    disabled={modStore.isScanning || !modPath}
  >
    {modStore.isScanning ? m.header_scan_scanning() : m.header_scan_ready()}
  </button>

  <!-- Separator + context links when scan result exists -->
  {#if modStore.scanResult}
    <div class="w-px h-4 bg-[var(--th-border-600)]"></div>
    {#if modStore.scanResult?.existing_config_path != null}
      <button
        class="text-[var(--th-text-sky-400)] hover:text-[var(--th-text-sky-300)] cursor-pointer whitespace-nowrap"
        onclick={() => showConfigModal = true}
        title={m.header_view_config_title()}
      ><FileText class="w-3.5 h-3.5 inline -mt-0.5" /> {m.header_view_config_label()}</button>
    {/if}
  {/if}
</div>

{#if showConfigModal}
  <ExistingConfigModal onclose={() => showConfigModal = false} />
{/if}
