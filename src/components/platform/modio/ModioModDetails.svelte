<script lang="ts">
  import { m } from "../../../paraglide/messages.js";
  import { modioEditMod } from "../../../lib/tauri/modio.js";
  import { modioStore } from "../../../lib/stores/modioStore.svelte.js";
  import { toastStore } from "../../../lib/stores/toastStore.svelte.js";
  import Save from "@lucide/svelte/icons/save";
  import Loader2 from "@lucide/svelte/icons/loader-2";
  import { getPrefersReducedMotion } from "../../../lib/stores/motion.svelte.js";

  let { modId, gameId }: { modId: number; gameId: number } = $props();

  // Find current mod data from store
  let currentMod = $derived(modioStore.userMods.find(mod => mod.id === modId));

  let name = $state("");
  let summary = $state("");
  let homepageUrl = $state("");
  let isSaving = $state(false);
  let initialized = $state(false);

  // Initialize form from store data
  $effect(() => {
    if (currentMod && !initialized) {
      name = currentMod.name ?? "";
      summary = currentMod.summary ?? "";
      homepageUrl = "";
      initialized = true;
    }
  });

  // Reset if modId changes
  $effect(() => {
    if (modId) {
      initialized = false;
    }
  });

  let summaryLength = $derived(summary.length);
  let nameValid = $derived(name.trim().length > 0);
  let summaryValid = $derived(summary.length <= 250);
  let canSave = $derived(nameValid && summaryValid && !isSaving);

  async function handleSave() {
    if (!canSave) return;
    isSaving = true;
    try {
      await modioEditMod({
        mod_id: modId,
        name: name.trim(),
        summary: summary.trim(),
        homepage_url: homepageUrl.trim() || undefined,
      });
      toastStore.success(m.modio_file_save());
      await modioStore.loadUserMods();
    } catch (e) {
      toastStore.error(m.modio_error_save_failed());
    } finally {
      isSaving = false;
    }
  }
</script>

<div class="flex flex-col gap-2.5 px-3 pb-3">
  <!-- Name -->
  <div>
    <label for="modio-mod-name" class="mb-0.5 block text-[10px] font-medium text-[var(--th-text-500)]">
      {m.modio_mod_name_label()}
    </label>
    <input
      id="modio-mod-name"
      type="text"
      class="w-full rounded border border-[var(--th-input-border,var(--th-bg-700))] bg-[var(--th-input-bg,var(--th-bg-800))] px-2 py-1 text-xs text-[var(--th-text-200)] focus:border-[var(--th-accent,#0ea5e9)] focus:outline-none"
      bind:value={name}
      required
      aria-invalid={!nameValid && name.length > 0 ? "true" : undefined}
      aria-describedby={!nameValid && name.length > 0 ? "modio-mod-name-error" : undefined}
    />
    {#if !nameValid && name.length > 0}
      <p id="modio-mod-name-error" class="mt-0.5 text-[9px] text-[var(--th-error,#ef4444)]" aria-live="assertive">Name is required</p>
    {/if}
  </div>

  <!-- Summary with char count -->
  <div>
    <label for="modio-mod-summary" class="mb-0.5 flex items-baseline justify-between text-[10px] font-medium text-[var(--th-text-500)]">
      <span>{m.modio_mod_summary_label()}</span>
      <span class="text-[9px]" class:text-[var(--th-error,#ef4444)]={summaryLength > 250}>
        {m.modio_mod_summary_chars({ count: String(summaryLength) })}
      </span>
    </label>
    <textarea
      id="modio-mod-summary"
      class="w-full resize-none rounded border border-[var(--th-input-border,var(--th-bg-700))] bg-[var(--th-input-bg,var(--th-bg-800))] px-2 py-1 text-xs text-[var(--th-text-200)] focus:border-[var(--th-accent,#0ea5e9)] focus:outline-none"
      maxlength={250}
      rows={3}
      bind:value={summary}
    ></textarea>
  </div>

  <!-- Homepage URL -->
  <div>
    <label for="modio-mod-homepage" class="mb-0.5 block text-[10px] font-medium text-[var(--th-text-500)]">
      {m.modio_mod_homepage_label()}
    </label>
    <input
      id="modio-mod-homepage"
      type="url"
      class="w-full rounded border border-[var(--th-input-border,var(--th-bg-700))] bg-[var(--th-input-bg,var(--th-bg-800))] px-2 py-1 text-xs text-[var(--th-text-200)] placeholder:text-[var(--th-text-500)] focus:border-[var(--th-accent,#0ea5e9)] focus:outline-none"
      placeholder="https://..."
      bind:value={homepageUrl}
    />
  </div>

  <!-- Save button -->
  <button
    type="button"
    class="flex items-center justify-center gap-1.5 self-end rounded bg-[var(--th-accent,#0ea5e9)] px-3 py-1.5 text-xs font-medium text-white hover:brightness-110 disabled:opacity-50"
    onclick={handleSave}
    disabled={!canSave}
  >
    {#if isSaving}
      <Loader2 size={14} class={getPrefersReducedMotion() ? '' : 'animate-spin'} aria-hidden="true" />
    {:else}
      <Save size={14} aria-hidden="true" />
    {/if}
    {m.modio_mod_save_details()}
  </button>
</div>
