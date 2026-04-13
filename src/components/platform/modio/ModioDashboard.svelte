<!--
  ModioDashboard — User's mod list from mod.io with filtering, sorting, and quick actions.
-->
<script lang="ts">
  import { m } from "../../../paraglide/messages.js";
  import { modioGetMyMods, type ModioModSummary } from "../../../lib/tauri/modio.js";
  import { settingsStore } from "../../../lib/stores/settingsStore.svelte.js";
  import Search from "@lucide/svelte/icons/search";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import Upload from "@lucide/svelte/icons/upload";
  import ArrowUpDown from "@lucide/svelte/icons/arrow-up-down";
  import Plus from "@lucide/svelte/icons/plus";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import AlertCircle from "@lucide/svelte/icons/alert-circle";

  interface ModSummary extends ModioModSummary {
    profile_url: string;
  }

  type SortKey = "date" | "downloads" | "status";

  let mods: ModSummary[] = $state([]);
  let loading = $state(false);
  let error = $state("");
  let filterText = $state("");
  let sortBy: SortKey = $state("date");

  let filteredMods = $derived.by(() => {
    let result = mods;
    if (filterText.trim()) {
      const q = filterText.trim().toLowerCase();
      result = result.filter((mod) => mod.name.toLowerCase().includes(q));
    }
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "downloads": return b.stats.downloads_total - a.stats.downloads_total;
        case "status": return a.status - b.status;
        case "date":
        default: return b.date_updated - a.date_updated;
      }
    });
    return result;
  });

  $effect(() => {
    loadMods();
  });

  async function loadMods() {
    loading = true;
    error = "";
    try {
      const gameId = Number(settingsStore.modioGameId || "629");
      mods = await modioGetMyMods(gameId) as ModSummary[];
    } catch (e: unknown) {
      error = String(e);
      mods = [];
    } finally {
      loading = false;
    }
  }

  function statusLabel(status: number): string {
    switch (status) {
      case 0: return m.modio_dashboard_status_not_accepted();
      case 1: return m.modio_dashboard_status_accepted();
      case 3: return m.modio_dashboard_status_hidden();
      default: return m.modio_dashboard_status_public();
    }
  }

  function statusColor(status: number): string {
    switch (status) {
      case 0: return "var(--th-text-amber-400, #fbbf24)";
      case 1: return "var(--th-success, #10b981)";
      case 3: return "var(--th-text-500)";
      default: return "var(--th-accent, #0ea5e9)";
    }
  }

  function formatDate(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function formatNumber(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  }
</script>

<div class="space-y-3">
  <div class="flex items-center justify-between">
    <h3 class="text-sm font-semibold text-[var(--th-text-200)]">{m.modio_dashboard_title()}</h3>
    <div class="flex items-center gap-2">
      <button
        class="p-1.5 rounded hover:bg-[var(--th-bg-600)] text-[var(--th-text-400)] transition-colors"
        onclick={loadMods}
        aria-label="Refresh"
        disabled={loading}
      >
        <RefreshCw size={14} class={loading ? "upload-spin" : ""} />
      </button>
      <button
        class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded bg-[var(--th-bg-700)] text-[var(--th-text-500)] cursor-not-allowed opacity-50"
        disabled
        title={m.modio_dashboard_create_new_hint()}
      >
        <Plus size={12} />
        {m.modio_dashboard_create_new()}
      </button>
    </div>
  </div>

  <!-- Filter + Sort -->
  <div class="flex items-center gap-2">
    <div class="relative flex-1">
      <Search size={12} class="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--th-text-500)]" />
      <input
        type="text"
        class="w-full form-input bg-[var(--th-bg-800)] border border-[var(--th-border-600)] text-[var(--th-text-200)] rounded pl-7 pr-2 py-1.5 text-xs focus:border-[var(--th-accent-500,#0ea5e9)]"
        placeholder={m.modio_dashboard_filter_placeholder()}
        bind:value={filterText}
      />
    </div>
    <div class="flex items-center gap-1">
      <ArrowUpDown size={12} class="text-[var(--th-text-500)]" />
      <select
        class="form-input bg-[var(--th-bg-800)] border border-[var(--th-border-600)] text-[var(--th-text-200)] rounded px-2 py-1.5 text-xs focus:border-[var(--th-accent-500,#0ea5e9)]"
        bind:value={sortBy}
      >
        <option value="date">{m.modio_dashboard_sort_date()}</option>
        <option value="downloads">{m.modio_dashboard_sort_downloads()}</option>
        <option value="status">{m.modio_dashboard_sort_status()}</option>
      </select>
    </div>
  </div>

  <!-- Loading -->
  {#if loading}
    <div class="flex items-center justify-center py-8">
      <p class="text-xs text-[var(--th-text-500)]">{m.modio_dashboard_loading()}</p>
    </div>

  <!-- Error -->
  {:else if error}
    <div class="flex flex-col items-center justify-center py-8 gap-2">
      <AlertCircle size={20} class="text-[var(--th-error,#ef4444)]" />
      <p class="text-xs text-red-400">{m.modio_dashboard_error()}</p>
      <button
        class="px-3 py-1.5 text-xs rounded bg-[var(--th-bg-700)] hover:bg-[var(--th-bg-600)] text-[var(--th-text-300)] transition-colors"
        onclick={loadMods}
      >{m.modio_dashboard_retry()}</button>
    </div>

  <!-- Empty state -->
  {:else if filteredMods.length === 0}
    <div class="flex items-center justify-center py-8">
      <p class="text-xs text-[var(--th-text-500)]">{m.modio_dashboard_empty()}</p>
    </div>

  <!-- Mod list -->
  {:else}
    <div class="space-y-2">
      {#each filteredMods as mod (mod.id)}
        <div class="flex items-center gap-3 p-3 bg-[var(--th-bg-850,var(--th-bg-800))] rounded border border-[var(--th-border-700)] hover:border-[var(--th-border-600)] transition-colors">
          <!-- Thumbnail -->
          {#if mod.logo_url}
            <img
              src={mod.logo_url}
              alt=""
              class="w-10 h-10 rounded object-cover flex-shrink-0"
              loading="lazy"
            />
          {:else}
            <div class="w-10 h-10 rounded bg-[var(--th-bg-700)] flex-shrink-0"></div>
          {/if}

          <!-- Info -->
          <div class="flex-1 min-w-0">
            <p class="text-xs font-medium text-[var(--th-text-200)] truncate">{mod.name}</p>
            <div class="flex items-center gap-3 mt-0.5">
              <span
                class="text-[10px] font-medium px-1.5 py-0.5 rounded"
                style="color: {statusColor(mod.status)}; background: color-mix(in srgb, {statusColor(mod.status)} 15%, transparent)"
              >{statusLabel(mod.status)}</span>
              <span class="text-[10px] text-[var(--th-text-500)]">{formatDate(mod.date_updated)}</span>
            </div>
          </div>

          <!-- Stats -->
          <div class="flex flex-col items-end gap-0.5 flex-shrink-0">
            <span class="text-[10px] text-[var(--th-text-500)]" title={m.modio_dashboard_downloads()}>
              ↓ {formatNumber(mod.stats.downloads_total)}
            </span>
            <span class="text-[10px] text-[var(--th-text-500)]" title={m.modio_dashboard_subscribers()}>
              ♥ {formatNumber(mod.stats.subscribers_total)}
            </span>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-1 flex-shrink-0">
            <button
              class="p-1.5 rounded hover:bg-[var(--th-bg-600)] text-[var(--th-text-400)] transition-colors"
              title={m.modio_dashboard_upload()}
              aria-label="{m.modio_dashboard_upload()} {mod.name}"
            >
              <Upload size={14} />
            </button>
            <a
              href={mod.profile_url}
              target="_blank"
              rel="noopener noreferrer"
              class="p-1.5 rounded hover:bg-[var(--th-bg-600)] text-[var(--th-text-400)] transition-colors inline-flex"
              title={m.modio_dashboard_view()}
              aria-label="{m.modio_dashboard_view()} {mod.name}"
            >
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  @keyframes upload-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  :global(.upload-spin) {
    animation: upload-spin 1s linear infinite;
  }
  @media (prefers-reduced-motion: reduce) {
    :global(.upload-spin) {
      animation: none;
    }
  }
</style>
