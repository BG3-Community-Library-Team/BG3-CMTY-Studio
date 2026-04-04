<script lang="ts">
  /**
   * Shared wrapper for fieldset sub-components.
   * Provides: {#each} loop, per-item remove button, add button, empty state.
   * Caller provides: per-item content via snippet.
   */
  import X from "@lucide/svelte/icons/x";

  interface Props {
    items: any[];
    label: string;
    allUsed?: boolean;
    hideRemoveButton?: boolean;
    onadd: () => void;
    onremove: (index: number) => void;
    children: import('svelte').Snippet<[any, number]>;
    emptyMessage?: string;
    /** Extra CSS class for each row (e.g. "items-start" vs "items-center") */
    rowClass?: string;
    /** Add button text override (default: "+ Add {label}") */
    addLabel?: string;
    /** Whether to always show the add button even when items exist */
    alwaysShowAdd?: boolean;
    /** Header snippet rendered before the loop (e.g. static description text) */
    header?: import('svelte').Snippet;
  }

  let {
    items,
    label,
    allUsed = false,
    hideRemoveButton = false,
    onadd,
    onremove,
    children,
    emptyMessage,
    rowClass = "items-center",
    addLabel,
    alwaysShowAdd = false,
    header,
  }: Props = $props();
</script>

<fieldset class="space-y-1">
  {#if header}
    {@render header()}
  {/if}
  {#if items.length === 0}
    <div class="flex flex-col items-center justify-center py-4 border border-dashed border-[var(--th-border-700)] rounded">
      <p class="text-xs text-[var(--th-text-500)] mb-2">{emptyMessage ?? `No ${label} added`}</p>
      <button type="button" class="text-xs text-sky-400 hover:text-sky-300" onclick={onadd}>
        {addLabel ?? `+ Add ${label}`}
      </button>
    </div>
  {:else}
    {#each items as item, i}
      <div class="fieldset-row flex gap-2 {rowClass}">
        {@render children(item, i)}
        {#if !hideRemoveButton}
          <button
            type="button"
            class="text-xs text-red-400 hover:text-red-300 shrink-0 px-1.5 min-w-6 min-h-6 inline-flex items-center justify-center"
            onclick={() => onremove(i)}
            aria-label="Remove {label} {i + 1}"
          >
            <X size={14} />
          </button>
        {/if}
      </div>
    {/each}
    {#if !allUsed || alwaysShowAdd}
      <button type="button" class="text-xs text-sky-400 hover:text-sky-300" onclick={onadd}>
        {addLabel ?? `+ Add ${label}`}
      </button>
    {/if}
  {/if}
</fieldset>

<style>
  .fieldset-row {
    padding: 0.375rem 0.5rem;
    border-radius: 0.25rem;
  }
  .fieldset-row:nth-child(even) {
    background: var(--th-bg-950, #09090b);
  }
</style>
