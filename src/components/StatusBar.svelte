<!--
  PF-020: Application Status Bar
  Fixed 28px bar at the bottom with 3 clusters: Left (mod info, entry count),
  Center (operation status), Right (theme selector, format, version).
  Also acts as a secondary drag region: drag to move, double-click to maximize.
-->
<script lang="ts">
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import { projectStore } from "../lib/stores/projectStore.svelte.js";
  import { settingsStore } from "../lib/stores/settingsStore.svelte.js";
  import { dataOperationStore } from "../lib/stores/dataOperationStore.svelte.js";
  import { modImportService } from "../lib/services/modImportService.svelte.js";
  import { THEME_OPTIONS } from "../lib/themes/themeManager.js";
  import { toastStore } from "../lib/stores/toastStore.svelte.js";
  import { m } from "../paraglide/messages.js";
  import ChevronUp from "@lucide/svelte/icons/chevron-up";
  import Bell from "@lucide/svelte/icons/bell";
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import { APP_VERSION } from "../lib/version.js";
  import NotificationHistory from "./NotificationHistory.svelte";
  import ValidationSummaryModal from "./ValidationSummaryModal.svelte";

  /** Operation status message with auto-clear */
  let operationStatus = $state("");
  let operationTimer: ReturnType<typeof setTimeout> | undefined;

  export function setStatus(message: string, durationMs = 8000): void {
    operationStatus = message;
    clearTimeout(operationTimer);
    if (durationMs > 0) {
      operationTimer = setTimeout(() => { operationStatus = ""; }, durationMs);
    }
  }

  // Auto-clear timers for dataOperationStore success/error
  let opSuccessClearTimer: ReturnType<typeof setTimeout> | undefined;
  let opErrorClearTimer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    if (dataOperationStore.lastSuccess && !dataOperationStore.isRunning) {
      clearTimeout(opSuccessClearTimer);
      opSuccessClearTimer = setTimeout(() => {
        dataOperationStore.resetVisibleState();
      }, 5000);
    }
  });

  $effect(() => {
    if (dataOperationStore.lastError && !dataOperationStore.isRunning) {
      clearTimeout(opErrorClearTimer);
      opErrorClearTimer = setTimeout(() => {
        dataOperationStore.resetVisibleState();
      }, 8000);
    }
  });

  /** Derived center-area display: DB operations take priority over generic operationStatus */
  let centerDisplay = $derived.by(() => {
    if (dataOperationStore.isRunning) {
      return { kind: "running" as const, text: dataOperationStore.phase };
    }
    // Show mod import/ingestion activity
    const importEntries = Object.entries(modImportService.modImportStatus);
    if (importEntries.length > 0) {
      const [path, status] = importEntries[0];
      const modName = path.split(/[\\/]/).pop()?.replace(/\.pak$/i, "") ?? "mod";
      return { kind: "importing" as const, text: `${status} ${modName}…` };
    }
    if (dataOperationStore.lastError) {
      return { kind: "error" as const, text: dataOperationStore.lastError.message };
    }
    if (dataOperationStore.lastSuccess) {
      return { kind: "success" as const, text: dataOperationStore.lastSuccess.message };
    }
    if (operationStatus) {
      return { kind: "status" as const, text: operationStatus };
    }
    return null;
  });

  let themeDropupOpen = $state(false);
  let notificationOpen = $state(false);
  let validationModalOpen = $state(false);
  let currentThemeLabel = $derived(
    THEME_OPTIONS.find(o => o.id === settingsStore.theme)?.label ?? settingsStore.theme
  );
  // TODO: Wire validation summary from projectStore when validation engine is migrated
  const validationSummary = { errorCount: 0, warningCount: 0, errors: [] as any[], warnings: [] as any[] };
  let modName = $derived(modStore.scanResult?.mod_meta?.name ?? "");
  let modVersion = $derived.by(() => {
    const v64 = modStore.scanResult?.mod_meta?.version64;
    if (!v64) return "";
    try {
      const n = BigInt(v64);
      const major = Number((n >> 55n) & 0xFFn);
      const minor = Number((n >> 47n) & 0xFFn);
      const revision = Number((n >> 31n) & 0xFFFFn);
      const build = Number(n & 0x7FFFFFFFn);
      return `${major}.${minor}.${revision}.${build}`;
    } catch { return ""; }
  });
  let totalEntries = $derived(modStore.totalEntries);
  let selectedCount = $derived(
    projectStore.sections.reduce((sum, s) => sum + s.active_rows, 0)
  );
  let manualCount = $derived(
    projectStore.sections.reduce((sum, s) => sum + s.new_rows, 0)
  );

  // Lazy Tauri window API for drag + double-click-to-maximize
  let tauriWindow: any = null;
  async function getTauriWindow() {
    if (tauriWindow) return tauriWindow;
    try {
      const mod = await import("@tauri-apps/api/window");
      tauriWindow = mod.getCurrentWindow();
      return tauriWindow;
    } catch { return null; }
  }

  /** Drag to move window; double-click to toggle maximize.
   *  Skip if the event originates from an interactive element (button, select, input, etc.)
   *  Also skip if a dropup/popup is currently open. */
  async function handleBarMousedown(e: MouseEvent) {
    if (e.buttons !== 1) return;
    // Don't hijack clicks on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button, select, input, [role="listbox"], [role="option"], a')) return;
    // Don't start drag if the theme dropup backdrop is open (click should close it)
    if (themeDropupOpen || notificationOpen) return;
    if (e.detail === 2) {
      const win = await getTauriWindow();
      if (win) {
        const max = await win.isMaximized();
        if (max) await win.unmaximize(); else await win.maximize();
      }
    } else {
      const win = await getTauriWindow();
      await win?.startDragging();
    }
  }
</script>

<footer
  class="status-bar border-t border-[var(--th-border-700)]
         bg-[var(--th-bg-900)] select-none shrink-0"
  aria-label={m.status_bar_aria()}
>
  <div
    class="flex items-center h-7 px-3 text-xs text-[var(--th-text-500)] gap-2"
    role="presentation"
    onmousedown={handleBarMousedown}
  >
  <!-- Left cluster: spinner when running, else mod info -->
  {#if centerDisplay?.kind === "running"}
  <div class="flex items-center gap-3 min-w-0 whitespace-nowrap">
    <span class="inline-flex items-center gap-1.5 text-sky-400">
      <LoaderCircle class="w-3.5 h-3.5 animate-spin" />
      <span class="truncate">{centerDisplay.text}</span>
    </span>
    {#if dataOperationStore.detail}
      <span class="text-[var(--th-text-500)] truncate text-xs">{dataOperationStore.detail}</span>
    {/if}
  </div>
  {:else}
  <div class="flex items-center gap-3 min-w-0 whitespace-nowrap">
    {#if modName}
      <span class="truncate max-w-[200px]" title={modName}>
        <span class="text-[var(--th-text-400)]">{m.status_bar_mod_label()}</span>
        <span class="text-[var(--th-text-300)]">{modName}</span>
        {#if modVersion}
          <span class="text-[var(--th-text-500)] ml-1">v{modVersion}</span>
        {/if}
      </span>
      <span class="text-[var(--th-border-600)]">│</span>
      <span>
        {m.status_bar_entries({ selected: selectedCount, total: totalEntries })}
        {#if manualCount > 0}
          <button
            class="text-[var(--th-text-violet-400)] hover:text-[var(--th-text-violet-300)] cursor-pointer transition-colors"
            onclick={() => {
              // Try scrolling to first visible manual entry
              const first = document.querySelector('[data-manual-entry]');
              if (first) {
                first.scrollIntoView({ behavior: 'smooth', block: 'center' });
              } else {
                // Manual entries exist but aren't visible (might be on another page or collapsed section).
                // Find the section panel which might contain them and scroll there instead.
                const sectionPanel = document.querySelector('[data-section-panel]');
                sectionPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }}
            title={m.status_bar_jump_manual()}
            type="button"
          >{m.status_bar_manual({ count: manualCount })}</button>
        {/if}
      </span>
      {#if validationSummary.errorCount > 0 || validationSummary.warningCount > 0}
        <span class="text-[var(--th-border-600)]">│</span>
        <button
          class="hover:text-[var(--th-text-300)] transition-colors cursor-pointer"
          onclick={() => validationModalOpen = true}
          type="button"
        >
          {#if validationSummary.errorCount > 0}
            <span class="text-red-400">{validationSummary.errorCount === 1 ? m.status_bar_errors_one() : m.status_bar_errors({ count: validationSummary.errorCount })}</span>
          {/if}
          {#if validationSummary.errorCount > 0 && validationSummary.warningCount > 0}
            <span class="text-[var(--th-text-500)]"> · </span>
          {/if}
          {#if validationSummary.warningCount > 0}
            <span class="text-amber-400">{validationSummary.warningCount === 1 ? m.status_bar_warnings_one() : m.status_bar_warnings({ count: validationSummary.warningCount })}</span>
          {/if}
        </button>
      {/if}
    {:else}
      <span class="text-[var(--th-text-600)]">{m.status_bar_no_mod()}</span>
    {/if}
  </div>
  {/if}

  <!-- Center cluster: operation status (non-running states only; running state moved to right) -->
  <div class="flex-1 text-center truncate flex items-center justify-center gap-2" aria-live="polite">
    {#if centerDisplay?.kind === "running"}
      <!-- Running state is rendered in the right cluster -->
    {:else if centerDisplay?.kind === "importing"}
      <span class="text-[var(--th-border-600)]">│</span>
      <span class="inline-flex items-center gap-1.5 text-amber-400">
        <LoaderCircle class="w-3.5 h-3.5 animate-spin" />
        <span class="truncate">{centerDisplay.text}</span>
      </span>
    {:else if centerDisplay?.kind === "error"}
      <span class="text-red-400 truncate">{centerDisplay.text}</span>
    {:else if centerDisplay?.kind === "success"}
      <span class="text-emerald-400 truncate">{centerDisplay.text}</span>
    {:else if centerDisplay?.kind === "status"}
      <span class="text-[var(--th-text-400)]">{centerDisplay.text}</span>
    {/if}
  </div>

  <!-- Right cluster: theme selector + version + notifications -->
  <div class="flex items-center gap-3 flex-1 justify-end">
    <!-- Custom dropup theme selector -->
    <div class="relative">
      <button
        class="text-xs bg-[var(--th-input-bg)] border border-[var(--th-input-border)] text-[var(--th-input-text)]
               rounded px-1.5 py-0.5 focus:border-sky-500 cursor-pointer hover:bg-[var(--th-bg-800)]
               transition-colors flex items-center gap-1"
        onclick={() => themeDropupOpen = !themeDropupOpen}
        title={m.status_bar_theme_title()}
        type="button"
      >
        {currentThemeLabel}
        <ChevronUp class="w-2.5 h-2.5 shrink-0" />
      </button>
      {#if themeDropupOpen}
        <div
          class="fixed inset-0 z-[90]"
          role="presentation"
          onclick={() => themeDropupOpen = false}
          onkeydown={(e) => e.key === 'Escape' && (themeDropupOpen = false)}
        ></div>
        <div class="absolute bottom-full left-0 mb-1 min-w-[130px] bg-[var(--th-sidebar-bg,var(--th-bg-900))] border border-[var(--th-border-600)]
                    rounded-md shadow-xl z-[91] py-0.5 max-h-[240px] overflow-y-auto scrollbar-thin"
             role="listbox"
             aria-label={m.status_bar_theme_aria()}
        >
          {#each THEME_OPTIONS as opt (opt.id)}
            <button
              class="w-full text-left px-2.5 py-1 text-xs transition-colors
                     {opt.id === settingsStore.theme
                       ? 'bg-[var(--th-bg-sky-700-60)] text-[var(--th-text-100)] font-medium'
                       : 'text-[var(--th-text-300)] hover:bg-[var(--th-bg-800)]'}"
              onclick={() => { settingsStore.setTheme(opt.id as any); themeDropupOpen = false; }}
              role="option"
              aria-selected={opt.id === settingsStore.theme}
              type="button"
            >{opt.label}</button>
          {/each}
        </div>
      {/if}
    </div>
    <span class="text-[var(--th-border-600)]">│</span>
    <span>v{APP_VERSION}</span>
    <span class="text-[var(--th-border-600)]">│</span>
    <!-- Notification bell (far right) -->
    <div class="relative">
      <button
        class="cursor-pointer hover:text-[var(--th-text-300)] transition-colors relative"
        onclick={() => notificationOpen = !notificationOpen}
        aria-label={m.status_bar_notification_aria()}
        type="button"
      >
        <Bell class="w-3.5 h-3.5" />
        {#if toastStore.unreadCount > 0}
          <span class="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] flex items-center justify-center
                       bg-sky-500 text-white text-[9px] font-bold rounded-full leading-none px-0.5">
            {toastStore.unreadCount > 9 ? "9+" : toastStore.unreadCount}
          </span>
        {/if}
      </button>
      {#if notificationOpen}
        <NotificationHistory onclose={() => notificationOpen = false} />
      {/if}
    </div>
  </div>
  </div>
</footer>

{#if validationModalOpen}
  <ValidationSummaryModal onclose={() => validationModalOpen = false} />
{/if}
