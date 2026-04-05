<!--
  ERR-006: Svelte 5 error boundary wrapper.
  Catches render errors in child components and shows a fallback UI
  with retry capability, preventing full-app crashes.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { toastStore } from "../lib/stores/toastStore.svelte.js";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import AlertTriangle from "@lucide/svelte/icons/alert-triangle";
  import { m } from "../paraglide/messages.js";

  let { name = "Component", children }: { name?: string; children: Snippet } = $props();

  function handleError(error: unknown) {
    console.error(`[ErrorBoundary:${name}]`, error);
    toastStore.error(m.app_unexpected_error(), `${name}: ${String(error)}`);
  }
</script>

<svelte:boundary onerror={handleError}>
  {@render children()}
  {#snippet failed(error, reset)}
    <div class="flex flex-col items-center justify-center gap-3 p-6 text-center h-full">
      <AlertTriangle size={24} class="text-amber-400" />
      <p class="text-sm text-[var(--th-text-300)]">
        {m.error_boundary_message({ name })}
      </p>
      <p class="text-xs text-[var(--th-text-500)] max-w-md break-all">{String(error)}</p>
      <button
        class="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-[var(--th-bg-700)] text-[var(--th-text-200)] hover:bg-[var(--th-bg-600)] transition-colors"
        onclick={reset}
      >
        <RefreshCw size={12} />
        {m.error_boundary_retry()}
      </button>
    </div>
  {/snippet}
</svelte:boundary>
