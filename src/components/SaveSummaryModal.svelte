<!--
  SaveSummaryModal: Shows the results of a save or dry-run operation.
  Displays file reports grouped by action (created, updated, deleted)
  with handler, path, entry count details, plus an errors section.
-->
<script lang="ts">
  import { focusTrap } from "../lib/utils/focusTrap.js";
  import { m } from "../paraglide/messages.js";
  import type { SaveProjectResult } from "../lib/tauri/save.js";
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import CircleDot from "@lucide/svelte/icons/circle-dot";
  import CircleX from "@lucide/svelte/icons/circle-x";
  import AlertTriangle from "@lucide/svelte/icons/alert-triangle";

  let {
    result,
    onclose,
  }: {
    result: SaveProjectResult;
    onclose: () => void;
  } = $props();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") { e.preventDefault(); onclose(); }
  }

  function shortPath(p: string): string {
    const parts = p.split(/[\\/]/);
    return parts.length > 2 ? parts.slice(-2).join("/") : parts.pop() ?? p;
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-[var(--th-modal-backdrop)]"
  role="presentation"
>
  <div class="absolute inset-0" onclick={onclose} role="presentation"></div>
  <div
    class="modal-panel relative z-10 bg-[var(--th-bg-900)] border border-[var(--th-border-700)] rounded-lg shadow-2xl w-[520px] max-h-[80vh] flex flex-col"
    role="dialog"
    aria-modal="true"
    aria-labelledby="save-summary-title"
    use:focusTrap
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-5 py-3 border-b border-[var(--th-border-700)]">
      <h2 id="save-summary-title" class="text-base font-bold text-[var(--th-text-100)]">
        {m.save_summary_title()}
      </h2>
      <button
        class="text-[var(--th-text-400)] hover:text-[var(--th-text-200)] text-lg leading-none p-2 rounded"
        onclick={onclose}
        aria-label={m.common_close()}
      >&times;</button>
    </div>

    <!-- Body -->
    <div class="px-5 py-4 overflow-y-auto space-y-4 scrollbar-thin">
      <!-- Errors -->
      {#if result.errors.length > 0}
        <div class="rounded border border-red-700/60 bg-red-900/20 p-3">
          <h3 class="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
            <AlertTriangle size={14} />
            {m.save_summary_errors({ count: result.errors.length })}
          </h3>
          {#each result.errors as error}
            <p class="text-xs text-red-300 py-0.5">{error}</p>
          {/each}
        </div>
      {/if}

      <!-- Created files -->
      {#if result.files_created.length > 0}
        <div>
          <h3 class="text-sm font-semibold text-[var(--th-diff-added)] mb-1.5 flex items-center gap-2">
            <CircleCheck size={14} />
            {m.save_summary_created({ count: result.files_created.length })}
          </h3>
          {#each result.files_created as file}
            <div class="flex items-center gap-2 px-3 py-1 text-xs">
              <span class="text-[var(--th-text-400)] w-24 shrink-0 truncate">{file.handler}</span>
              <span class="text-[var(--th-text-200)] truncate flex-1" title={file.path}>{shortPath(file.path)}</span>
              <span class="text-[var(--th-text-500)] shrink-0">{m.save_summary_entries_label({ count: file.entry_count })}</span>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Updated files -->
      {#if result.files_updated.length > 0}
        <div>
          <h3 class="text-sm font-semibold text-sky-400 mb-1.5 flex items-center gap-2">
            <CircleDot size={14} />
            {m.save_summary_updated({ count: result.files_updated.length })}
          </h3>
          {#each result.files_updated as file}
            <div class="flex items-center gap-2 px-3 py-1 text-xs">
              <span class="text-[var(--th-text-400)] w-24 shrink-0 truncate">{file.handler}</span>
              <span class="text-[var(--th-text-200)] truncate flex-1" title={file.path}>{shortPath(file.path)}</span>
              <span class="text-[var(--th-text-500)] shrink-0">{m.save_summary_entries_label({ count: file.entry_count })}</span>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Deleted files -->
      {#if result.files_deleted.length > 0}
        <div>
          <h3 class="text-sm font-semibold text-[var(--th-diff-removed)] mb-1.5 flex items-center gap-2">
            <CircleX size={14} />
            {m.save_summary_deleted({ count: result.files_deleted.length })}
          </h3>
          {#each result.files_deleted as file}
            <div class="flex items-center gap-2 px-3 py-1 text-xs">
              <span class="text-[var(--th-text-400)] w-24 shrink-0 truncate">{file.handler}</span>
              <span class="text-[var(--th-text-200)] truncate flex-1" title={file.path}>{shortPath(file.path)}</span>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Summary stats -->
      <div class="border-t border-[var(--th-border-700)] pt-3 space-y-1 text-xs text-[var(--th-text-400)]">
        <p>{m.save_summary_unchanged({ count: result.files_unchanged })}</p>
        <p>{m.save_summary_total_entries({ count: result.total_entries })}</p>
      </div>

      <!-- Dry-run notice -->
      {#if result.dry_run}
        <div class="rounded bg-amber-900/20 border border-amber-700/40 px-3 py-2 text-xs text-amber-300">
          {m.save_summary_dry_run_notice()}
        </div>
      {/if}
    </div>

    <!-- Footer -->
    <div class="flex justify-end px-5 py-3 border-t border-[var(--th-border-700)]">
      <button
        class="px-4 py-1.5 rounded text-sm font-medium bg-[var(--th-bg-700)] text-[var(--th-text-200)] hover:bg-[var(--th-bg-600)] transition-colors"
        onclick={onclose}
      >
        {m.common_close()}
      </button>
    </div>
  </div>
</div>
