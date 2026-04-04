<script lang="ts">
  import X from "@lucide/svelte/icons/x";
  import AlertTriangle from "@lucide/svelte/icons/alert-triangle";
  import { m } from "../../paraglide/messages.js";

  let {
    validationErrors,
    isEdit = false,
    onsubmit,
    onclose,
  }: {
    validationErrors: { key: string; message: string; severity: string }[];
    isEdit: boolean;
    onsubmit: () => void;
    onclose: () => void;
  } = $props();
</script>

{#if validationErrors.length > 0}
  <div class="border-t border-zinc-700 pt-2 space-y-0.5" role="alert" aria-live="assertive">
    {#each validationErrors as err}
      <p class="text-xs {err.severity === 'error' ? 'text-red-400' : 'text-amber-400'}">
        {#if err.severity === 'error'}<X size={12} class="inline -mt-0.5" />{:else}<AlertTriangle size={12} class="inline -mt-0.5" />{/if} {err.message}
      </p>
    {/each}
  </div>
{/if}

<div class="flex justify-end gap-2 border-t border-zinc-700 pt-2">
  <button
    class="px-3 py-1 text-xs rounded bg-[var(--th-bg-700)] text-[var(--th-text-300)] hover:bg-[var(--th-bg-600)] hover:text-[var(--th-text-100)] transition-colors"
    onclick={onclose}
  >
    {m.common_cancel()}
  </button>
  <button
    class="px-3 py-1 text-xs rounded bg-sky-600 text-white hover:bg-sky-500"
    onclick={onsubmit}
  >
    {isEdit ? m.common_save() : m.form_footer_add()}
  </button>
</div>
