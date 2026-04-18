<!-- ModioFileVersions — Lists mod file versions with edit/delete support. -->
<script lang="ts">
  import { m } from "../../../paraglide/messages.js";
  import {
    modioListFiles,
    modioEditFile,
    modioDeleteFile,
    type ModioFileEntry,
  } from "../../../lib/tauri/modio.js";
  import { toastStore } from "../../../lib/stores/toastStore.svelte.js";
  import Loader2 from "@lucide/svelte/icons/loader-2";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Check from "@lucide/svelte/icons/check";
  import X from "@lucide/svelte/icons/x";
  import { getPrefersReducedMotion } from "../../../lib/stores/motion.svelte.js";

  let { modId, gameId, fileCount = $bindable(0) }: { modId: number; gameId: number; fileCount?: number } = $props();

  // ── State ──
  let files: ModioFileEntry[] = $state([]);
  let isLoading = $state(false);
  let editingFileId: number | null = $state(null);
  let editVersion = $state("");
  let editChangelog = $state("");
  let editActive = $state(false);
  let deletingFileId: number | null = $state(null);
  let currentPage = $state(1);
  let isSaving = $state(false);
  let isDeleting = $state(false);
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

  function versionLabel(file: ModioFileEntry): string {
    return file.version || file.filename;
  }

  // ── Edit flow ──
  function startEdit(file: ModioFileEntry) {
    editingFileId = file.id;
    editVersion = file.version ?? "";
    editChangelog = file.changelog ?? "";
    editActive = file.virus_status === 1; // virus_status 1 = active
  }

  function cancelEdit() {
    editingFileId = null;
  }

  async function saveEdit() {
    if (editingFileId == null) return;
    isSaving = true;
    try {
      await modioEditFile({
        mod_id: modId,
        file_id: editingFileId,
        version: editVersion,
        changelog: editChangelog,
        active: editActive,
      });
      editingFileId = null;
      await loadFiles();
    } catch (e) {
      console.warn("[ModioFileVersions] Failed to save:", e);
      toastStore.error(m.modio_error_save_failed());
    } finally {
      isSaving = false;
    }
  }

  // ── Delete flow ──
  function startDelete(fileId: number) {
    deletingFileId = fileId;
  }

  function cancelDelete() {
    deletingFileId = null;
  }

  async function confirmDelete() {
    if (deletingFileId == null) return;
    isDeleting = true;
    try {
      await modioDeleteFile(modId, deletingFileId);
      deletingFileId = null;
      await loadFiles();
    } catch (e) {
      console.warn("[ModioFileVersions] Failed to delete:", e);
      toastStore.error(m.modio_error_delete_failed());
    } finally {
      isDeleting = false;
    }
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

<div class="px-3 pb-3">
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
          {#if editingFileId === file.id}
            <!-- Edit mode -->
            <div class="mt-1 flex flex-col gap-1.5">
              <label class="flex flex-col gap-0.5">
                <span class="text-[9px] font-medium text-[var(--th-text-500)]">{m.modio_file_version_label()}</span>
                <input
                  type="text"
                  bind:value={editVersion}
                  class="rounded border border-[var(--th-border-700)] bg-[var(--th-bg-700)] px-1.5 py-0.5 text-[10px] text-[var(--th-text-200)] outline-none focus:border-[var(--th-accent,#0ea5e9)]"
                />
              </label>

              <label class="flex flex-col gap-0.5">
                <span class="text-[9px] font-medium text-[var(--th-text-500)]">{m.modio_file_changelog_label()}</span>
                <textarea
                  bind:value={editChangelog}
                  rows="4"
                  class="resize-y rounded border border-[var(--th-border-700)] bg-[var(--th-bg-700)] px-1.5 py-0.5 text-[10px] text-[var(--th-text-200)] outline-none focus:border-[var(--th-accent,#0ea5e9)]"
                ></textarea>
              </label>

              <label class="flex items-center gap-1.5 text-[9px] text-[var(--th-text-300)]">
                <input type="checkbox" bind:checked={editActive} class="accent-[var(--th-accent,#0ea5e9)]" />
                {m.modio_file_active_toggle()}
              </label>

              <div class="flex items-center gap-1">
                <button
                  onclick={saveEdit}
                  disabled={isSaving}
                  class="flex items-center gap-1 rounded bg-[var(--th-accent,#0ea5e9)] px-2 py-0.5 text-[9px] font-medium text-white hover:brightness-110 disabled:opacity-50"
                >
                  {#if isSaving}
                    <Loader2
                      size={10}
                      class={getPrefersReducedMotion() ? "" : "animate-spin"}
                    />
                  {:else}
                    <Check size={10} />
                  {/if}
                  {m.modio_file_save()}
                </button>
                <button
                  onclick={cancelEdit}
                  disabled={isSaving}
                  aria-label={m.common_cancel()}
                  class="flex items-center gap-1 rounded border border-[var(--th-border-700)] px-2 py-0.5 text-[9px] text-[var(--th-text-300)] hover:bg-[var(--th-bg-700)] disabled:opacity-50"
                >
                  <X size={10} aria-hidden="true" />
                </button>
              </div>
            </div>
          {:else if deletingFileId === file.id}
            <!-- Delete confirmation -->
            <div class="flex flex-col gap-1.5">
              <p class="text-[10px] text-[var(--th-text-300)]">
                {m.modio_delete_file_confirm({ version: versionLabel(file) })}
              </p>
              <div class="flex items-center gap-1">
                <button
                  onclick={confirmDelete}
                  disabled={isDeleting}
                  class="flex items-center gap-1 rounded bg-[var(--th-error,#ef4444)] px-2 py-0.5 text-[9px] font-medium text-white hover:brightness-110 disabled:opacity-50"
                >
                  {#if isDeleting}
                    <Loader2
                      size={10}
                      class={getPrefersReducedMotion() ? "" : "animate-spin"}
                    />
                  {:else}
                    <Trash2 size={10} />
                  {/if}
                  {m.modio_delete_file({ version: versionLabel(file) })}
                </button>
                <button
                  onclick={cancelDelete}
                  disabled={isDeleting}
                  aria-label={m.common_cancel()}
                  class="flex items-center gap-1 rounded border border-[var(--th-border-700)] px-2 py-0.5 text-[9px] text-[var(--th-text-300)] hover:bg-[var(--th-bg-700)] disabled:opacity-50"
                >
                  <X size={10} aria-hidden="true" />
                </button>
              </div>
            </div>
          {:else}
            <!-- Normal display -->
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
                <button
                  onclick={() => startEdit(file)}
                  aria-label={m.modio_edit_file({ version: versionLabel(file) })}
                  class="rounded p-0.5 text-[var(--th-text-500)] hover:bg-[var(--th-bg-700)] hover:text-[var(--th-text-200)]"
                >
                  <Pencil size={11} />
                </button>
                <button
                  onclick={() => startDelete(file.id)}
                  aria-label={m.modio_delete_file({ version: versionLabel(file) })}
                  class="rounded p-0.5 text-[var(--th-text-500)] hover:bg-[var(--th-bg-700)] hover:text-[var(--th-error,#ef4444)]"
                >
                  <Trash2 size={11} />
                </button>
              </div>
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
