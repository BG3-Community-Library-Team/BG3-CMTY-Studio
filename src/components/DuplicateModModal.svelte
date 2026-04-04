<script lang="ts">
  import { focusTrap } from "../lib/utils/focusTrap.js";
  import AlertTriangle from "@lucide/svelte/icons/alert-triangle";
  import type { ModMetaInfo } from "../lib/utils/tauri.js";
  import { m } from "../paraglide/messages.js";

  let {
    existingMeta,
    existingPath,
    newMeta,
    newPath,
    onreplace,
    onkeepboth,
    oncancel,
  }: {
    existingMeta: ModMetaInfo | null;
    existingPath: string;
    newMeta: ModMetaInfo | null;
    newPath: string;
    onreplace: () => void;
    onkeepboth: () => void;
    oncancel: () => void;
  } = $props();

  /** Which info box is selected: "existing" keeps existing, "new" replaces with new */
  let selected = $state<"existing" | "new">("new");

  function shortPath(p: string): string {
    return p.split(/[\\/]/).pop() ?? p;
  }

  function handleUseSelected(): void {
    if (selected === "new") onreplace();
    else oncancel(); // Keep existing = cancel the import of the new one
  }

  function handleBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) oncancel();
  }
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') oncancel(); }} />

<div
  class="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--th-modal-backdrop)]"
  role="presentation"
  onclick={handleBackdropClick}
>
  <div
    class="modal-panel bg-[var(--th-bg-900)] border border-[var(--th-border-700)] rounded-lg shadow-2xl w-[32rem] max-h-[80vh] overflow-y-auto scrollbar-thin p-5"
    role="dialog"
    aria-modal="true"
    aria-label={m.duplicate_mod_title()}
    aria-describedby="dup-mod-desc"
    use:focusTrap
  >
    <h2 class="text-sm font-bold text-amber-400 mb-3 flex items-center gap-2">
      <AlertTriangle size={16} /> {m.duplicate_mod_title()}
    </h2>

    <p id="dup-mod-desc" class="text-xs text-[var(--th-text-400)] mb-4">
      {existingMeta && newMeta && existingMeta.uuid === newMeta.uuid ? m.duplicate_mod_description_uuid() : m.duplicate_mod_description_name()}
    </p>

    <div class="grid grid-cols-2 gap-3 mb-4">
      <!-- Existing mod (selectable) -->
      <button
        type="button"
        class="rounded border-2 p-3 space-y-1.5 text-left cursor-pointer transition-all
               {selected === 'existing'
                 ? 'bg-[var(--th-bg-800)] border-sky-500 ring-1 ring-sky-500/30'
                 : 'bg-[var(--th-bg-800)] border-[var(--th-border-700)] opacity-60 hover:opacity-80'}"
        onclick={() => selected = "existing"}
        aria-pressed={selected === "existing"}
      >
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full border-2 shrink-0 {selected === 'existing' ? 'border-sky-500 bg-sky-500' : 'border-[var(--th-border-700)]'}"></span>
          <h3 class="text-xs font-semibold text-[var(--th-text-400)] uppercase tracking-wider">{m.duplicate_mod_existing()}</h3>
        </div>
        <div class="text-xs text-[var(--th-text-200)] font-medium truncate">{existingMeta?.name || shortPath(existingPath)}</div>
        {#if existingMeta?.version}
          <div class="text-xs text-[var(--th-text-400)]">{m.duplicate_mod_version()} <span class="text-[var(--th-text-300)]">{existingMeta.version}</span></div>
        {/if}
        {#if existingMeta?.author}
          <div class="text-xs text-[var(--th-text-400)]">{m.duplicate_mod_author()} <span class="text-[var(--th-text-300)]">{existingMeta.author}</span></div>
        {/if}
        {#if existingMeta?.uuid}
          <div class="text-xs text-[var(--th-text-500)] font-mono truncate" title={existingMeta.uuid}>{existingMeta.uuid}</div>
        {/if}
        <div class="text-xs text-[var(--th-text-500)] truncate" title={existingPath}>{existingPath}</div>
      </button>

      <!-- New mod (selectable) -->
      <button
        type="button"
        class="rounded border-2 p-3 space-y-1.5 text-left cursor-pointer transition-all
               {selected === 'new'
                 ? 'bg-[var(--th-bg-800)] border-sky-500 ring-1 ring-sky-500/30'
                 : 'bg-[var(--th-bg-800)] border-[var(--th-border-700)] opacity-60 hover:opacity-80'}"
        onclick={() => selected = "new"}
        aria-pressed={selected === "new"}
      >
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full border-2 shrink-0 {selected === 'new' ? 'border-sky-500 bg-sky-500' : 'border-[var(--th-border-700)]'}"></span>
          <h3 class="text-xs font-semibold text-sky-400 uppercase tracking-wider">{m.duplicate_mod_new()}</h3>
        </div>
        <div class="text-xs text-[var(--th-text-200)] font-medium truncate">{newMeta?.name || shortPath(newPath)}</div>
        {#if newMeta?.version}
          <div class="text-xs text-[var(--th-text-400)]">{m.duplicate_mod_version()} <span class="text-[var(--th-text-300)]">{newMeta.version}</span></div>
        {/if}
        {#if newMeta?.author}
          <div class="text-xs text-[var(--th-text-400)]">{m.duplicate_mod_author()} <span class="text-[var(--th-text-300)]">{newMeta.author}</span></div>
        {/if}
        {#if newMeta?.uuid}
          <div class="text-xs text-[var(--th-text-500)] font-mono truncate" title={newMeta.uuid}>{newMeta.uuid}</div>
        {/if}
        <div class="text-xs text-[var(--th-text-500)] truncate" title={newPath}>{newPath}</div>
      </button>
    </div>

    <div class="flex justify-end gap-2 pt-2 border-t border-[var(--th-border-700)]">
      <button
        class="px-3 py-1.5 rounded text-xs font-medium bg-[var(--th-bg-700)] text-[var(--th-text-300)] hover:opacity-80 transition-colors"
        onclick={oncancel}
      >
        {m.common_cancel()}
      </button>
      <button
        class="px-3 py-1.5 rounded text-xs font-medium bg-[var(--th-bg-700)] text-[var(--th-text-300)] hover:opacity-80 transition-colors"
        onclick={onkeepboth}
      >
        {m.duplicate_mod_keep_both()}
      </button>
      <button
        class="px-3 py-1.5 rounded text-xs font-medium bg-[var(--th-bg-sky-600)] text-white hover:opacity-90 transition-colors"
        onclick={handleUseSelected}
      >
        {m.duplicate_mod_use_selected()}
      </button>
    </div>
  </div>
</div>
