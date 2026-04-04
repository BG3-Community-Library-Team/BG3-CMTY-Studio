<!--
  PaginationControls: Reusable pagination bar for any paginated list.
  Integrated into the section toolbar row — subtle, compact styling.
  Default page size: 15, with options 5/10/15/25/50/100.
-->
<script lang="ts">
  import ChevronsLeft from "@lucide/svelte/icons/chevrons-left";
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import ChevronsRight from "@lucide/svelte/icons/chevrons-right";
  import { m } from "../paraglide/messages.js";

  let {
    currentPage = $bindable(0),
    totalPages,
    totalItems,
    pageSize = $bindable(15),
    pageSizeOptions = [5, 10, 15, 25, 50, 100],
  }: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    pageSize: number;
    pageSizeOptions?: number[];
  } = $props();
</script>

{#if totalPages > 1}
  <div class="flex items-center gap-1.5 text-xs text-[var(--th-text-400)]">
    <!-- Page size + count on the left -->
    <select
      class="bg-[var(--th-bg-700)] border border-[var(--th-border-700)] rounded text-xs text-[var(--th-text-400)]
             cursor-pointer px-1 py-0.5"
      value={pageSize}
      onchange={(e) => { pageSize = Number((e.target as HTMLSelectElement).value); currentPage = 0; }}
      aria-label={m.pagination_page_size_aria()}
    >
      {#each pageSizeOptions as size (size)}
        <option value={size} selected={size === pageSize}>{m.pagination_size_display({ size })}</option>
      {/each}
    </select>
    <span class="text-[var(--th-text-600)]">({totalItems})</span>

    <!-- Nav buttons on the right -->
    <button
      class="px-2 py-1 rounded bg-[var(--th-bg-700)] border border-[var(--th-border-700)] hover:bg-[var(--th-bg-800)] hover:text-[var(--th-text-200)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center"
      disabled={currentPage === 0}
      onclick={() => currentPage = 0}
      aria-label={m.pagination_first_aria()}
    ><ChevronsLeft size={14} strokeWidth={2} /></button>
    <button
      class="px-2 py-1 rounded bg-[var(--th-bg-700)] border border-[var(--th-border-700)] hover:bg-[var(--th-bg-800)] hover:text-[var(--th-text-200)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center"
      disabled={currentPage === 0}
      onclick={() => currentPage = Math.max(0, currentPage - 1)}
      aria-label={m.pagination_prev_aria()}
    ><ChevronLeft size={14} strokeWidth={2} /></button>
    <span class="tabular-nums px-2 py-0.5 bg-[var(--th-bg-800)] rounded text-[var(--th-text-300)]">
      {currentPage + 1}/{totalPages}
    </span>
    <button
      class="px-2 py-1 rounded bg-[var(--th-bg-700)] border border-[var(--th-border-700)] hover:bg-[var(--th-bg-800)] hover:text-[var(--th-text-200)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center"
      disabled={currentPage >= totalPages - 1}
      onclick={() => currentPage = Math.min(totalPages - 1, currentPage + 1)}
      aria-label={m.pagination_next_aria()}
    ><ChevronRight size={14} strokeWidth={2} /></button>
    <button
      class="px-2 py-1 rounded bg-[var(--th-bg-700)] border border-[var(--th-border-700)] hover:bg-[var(--th-bg-800)] hover:text-[var(--th-text-200)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center"
      disabled={currentPage >= totalPages - 1}
      onclick={() => currentPage = totalPages - 1}
      aria-label={m.pagination_last_aria()}
    ><ChevronsRight size={14} strokeWidth={2} /></button>
  </div>
{/if}
