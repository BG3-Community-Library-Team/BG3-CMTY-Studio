<!-- ModioFileVersions — Lists mod file history with download link and changelog toggle. -->
<script lang="ts">
  import { m } from "../../../paraglide/messages.js";
  import {
    modioListFiles,
    type ModioFileEntry,
  } from "../../../lib/tauri/modio.js";
  import Loader2 from "@lucide/svelte/icons/loader-2";
  import Download from "@lucide/svelte/icons/download";
  import FileText from "@lucide/svelte/icons/file-text";
  import { open as shellOpen } from "@tauri-apps/plugin-shell";
  import { getPrefersReducedMotion } from "../../../lib/stores/motion.svelte.js";

  let { modId, gameId, modUrl = "", fileCount = $bindable(0) }: { modId: number; gameId: number; modUrl?: string | null; fileCount?: number } = $props();

  // ── State ──
  let files: ModioFileEntry[] = $state([]);
  let isLoading = $state(false);
  let expandedChangelogs: Set<number> = $state(new Set());
  let currentPage = $state(1);
  const PAGE_SIZE = 10;

  // ── Derived ──
  let needsPagination = $derived(files.length > 20);
  let totalPages = $derived(needsPagination ? Math.ceil(files.length / PAGE_SIZE) : 1);
  let paginatedFiles = $derived(
    needsPagination
      ? files.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
      : files,
  );

  // ── Fetch on mount / modId change ──
  $effect(() => {
    if (modId) {
      loadFiles();
    }
  });

  async function loadFiles() {
    isLoading = true;
    try {
      const raw = await modioListFiles(modId);
      // Sort newest first by date_added
      files = raw.sort((a, b) => b.date_added - a.date_added);
      fileCount = files.length;
      // Reset pagination when list changes
      if (currentPage > Math.ceil(files.length / PAGE_SIZE)) {
        currentPage = 1;
      }
    } catch (e) {
      console.warn("[ModioFileVersions] Failed to load files:", e);
    } finally {
      isLoading = false;
    }
  }

  // ── Helpers ──
  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDate(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function toggleChangelog(fileId: number) {
    const next = new Set(expandedChangelogs);
    if (next.has(fileId)) next.delete(fileId);
    else next.add(fileId);
    expandedChangelogs = next;
  }

  function openFilesTab() {
    if (modUrl) shellOpen(modUrl + "#files");
  }

  // ── Pagination ──
  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      currentPage = page;
    }
  }

  // ── Public refresh ──
  export function refresh() {
    loadFiles();
  }
</script>

<div class="px-3 pb-3 pt-2">
  {#if isLoading}
    <div class="flex items-center justify-center py-4">
      <Loader2
        size={16}
        class={getPrefersReducedMotion() ? "text-[var(--th-text-500)]" : "animate-spin text-[var(--th-text-500)]"}
      />
    </div>
  {:else if files.length === 0}
    <p class="py-3 text-center text-[10px] text-[var(--th-text-500)]">
      {m.modio_file_no_versions()}
    </p>
  {:else}
    <ul role="list" class="flex flex-col gap-1">
      {#each paginatedFiles as file (file.id)}
        <li
          role="listitem"
          class="rounded border border-[var(--th-border-700)] bg-[var(--th-bg-800)] px-2 py-1.5 text-[10px]"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="flex min-w-0 flex-col gap-0.5">
              <div class="flex items-center gap-1.5">
                <span class="truncate font-medium text-[var(--th-text-200)]">
                  {file.version ?? file.filename}
                </span>
                {#if file.virus_status === 1}
                  <span
                    class="inline-flex shrink-0 rounded-sm bg-[color-mix(in_srgb,var(--th-success,#10b981)_20%,transparent)] px-1 py-px text-[8px] font-semibold text-[var(--th-success,#10b981)]"
                  >
                    {m.modio_file_active_badge()}
                  </span>
                {/if}
              </div>
              <span class="truncate text-[var(--th-text-500)]">
                {formatFileSize(file.filesize)} · {formatDate(file.date_added)}
              </span>
            </div>

            <div class="flex shrink-0 items-center gap-0.5">
              {#if file.changelog}
                <button
                  onclick={() => toggleChangelog(file.id)}
                  aria-label="Toggle changelog"
                  class="rounded p-0.5 text-[var(--th-text-500)] hover:bg-[var(--th-bg-700)] hover:text-[var(--th-text-200)]"
                  class:text-[var(--th-accent,#0ea5e9)]={expandedChangelogs.has(file.id)}
                >
                  <FileText size={11} />
                </button>
              {/if}
              {#if modUrl}
                <button
                  onclick={openFilesTab}
                  aria-label="Download on mod.io"
                  class="rounded p-0.5 text-[var(--th-text-500)] hover:bg-[var(--th-bg-700)] hover:text-[var(--th-text-200)]"
                >
                  <Download size={11} />
                </button>
              {/if}
            </div>
          </div>

          {#if expandedChangelogs.has(file.id) && file.changelog}
            <div class="mt-1 rounded bg-[var(--th-bg-700)] px-2 py-1 text-[9px] text-[var(--th-text-300)] whitespace-pre-wrap">
              {file.changelog}
            </div>
          {/if}
        </li>
      {/each}
    </ul>

    <!-- Pagination -->
    {#if needsPagination}
      <div class="mt-2 flex items-center justify-center gap-1">
        <button
          onclick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label={m.pagination_prev_aria()}
          class="rounded border border-[var(--th-border-700)] px-1.5 py-0.5 text-[9px] text-[var(--th-text-300)] hover:bg-[var(--th-bg-700)] disabled:opacity-30"
        >
          ‹
        </button>
        {#each Array.from({ length: totalPages }, (_, i) => i + 1) as page}
          <button
            onclick={() => goToPage(page)}
            class="rounded px-1.5 py-0.5 text-[9px] {page === currentPage
              ? 'bg-[var(--th-accent,#0ea5e9)] font-medium text-white'
              : 'text-[var(--th-text-300)] hover:bg-[var(--th-bg-700)]'}"
          >
            {page}
          </button>
        {/each}
        <button
          onclick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label={m.pagination_next_aria()}
          class="rounded border border-[var(--th-border-700)] px-1.5 py-0.5 text-[9px] text-[var(--th-text-300)] hover:bg-[var(--th-bg-700)] disabled:opacity-30"
        >
          ›
        </button>
      </div>
    {/if}
  {/if}
</div>
