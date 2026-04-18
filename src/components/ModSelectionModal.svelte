<script lang="ts">
  import { m } from "../paraglide/messages.js";
  import { modSelectionService } from "../lib/services/modSelectionService.svelte.js";
  import { focusTrap } from "../lib/utils/focusTrap.js";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import X from "@lucide/svelte/icons/x";
  import User from "@lucide/svelte/icons/user";
  import GitBranch from "@lucide/svelte/icons/git-branch";
  import NexusModsIcon from "./icons/NexusModsIcon.svelte";
  import ModioIcon from "./icons/modioIcon.svelte";
  import type { DetectedMod } from "../lib/types/modSelection.js";

  function handleSelect(mod: DetectedMod) {
    modSelectionService.select(mod);
  }

  function handleCancel() {
    modSelectionService.cancel();
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) handleCancel();
  }

  function relativePath(mod: DetectedMod): string {
    // Show just the mod_folder as the relative path indicator
    return mod.mod_folder;
  }
</script>

<svelte:window onkeydown={(e) => { if (modSelectionService.isOpen && e.key === "Escape") handleCancel(); }} />

{#if modSelectionService.isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="fixed inset-0 bg-[var(--th-modal-backdrop)] z-[60] flex items-center justify-center p-4"
    role="presentation"
    onclick={handleBackdropClick}
  >
    <div
      class="bg-[var(--th-bg-900)] border border-[var(--th-border-700)] rounded-lg shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mod-select-title"
      aria-describedby="mod-select-desc"
      use:focusTrap
    >
      <!-- Header -->
      <div class="px-5 py-4 border-b border-[var(--th-border-700)] flex items-center gap-3">
        <FolderOpen size={18} class="text-sky-400" />
        <h2 id="mod-select-title" class="text-sm font-bold text-[var(--th-text-100)]">{m.mod_select_title()}</h2>
        <button
          class="ml-auto p-2 rounded hover:bg-[var(--th-bg-600)] transition-colors"
          onclick={handleCancel}
          aria-label={m.common_close()}
        >
          <X size={14} class="text-[var(--th-text-500)]" />
        </button>
      </div>

      <!-- Description -->
      <p id="mod-select-desc" class="px-5 pt-3 pb-2 text-xs text-[var(--th-text-400)]">
        {m.mod_select_description()}
      </p>

      <!-- Mod list -->
      <div class="flex-1 overflow-y-auto px-5 pb-4 space-y-2 scrollbar-thin">
        {#each modSelectionService.mods as mod (mod.mod_uuid)}
          <button
            type="button"
            class="w-full text-left rounded border border-[var(--th-border-700)] bg-[var(--th-bg-800)] p-3 space-y-1.5
                   hover:border-sky-500/50 hover:bg-[var(--th-bg-700)] transition-colors cursor-pointer
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            onclick={() => handleSelect(mod)}
          >
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-[var(--th-text-100)] truncate">{mod.mod_name}</span>
              {#if mod.has_git}
                <GitBranch size={12} class="text-[var(--th-text-500)] shrink-0" title="Git repository" />
              {/if}
              {#if mod.has_nexus}
                <NexusModsIcon size={12} class="text-amber-400 shrink-0" />
              {/if}
              {#if mod.has_modio}
                <ModioIcon size={12} class="text-sky-400 shrink-0" />
              {/if}
            </div>

            {#if mod.author}
              <div class="flex items-center gap-1.5 text-xs text-[var(--th-text-400)]">
                <User size={11} class="shrink-0" />
                <span>{m.mod_select_author({ author: mod.author })}</span>
              </div>
            {/if}

            <div class="flex items-center gap-1.5 text-xs text-[var(--th-text-500)]">
              <FolderOpen size={11} class="shrink-0" />
              <span class="truncate" title={mod.mod_path}>{m.mod_select_path({ path: relativePath(mod) })}</span>
            </div>
          </button>
        {/each}
      </div>

      <!-- Footer -->
      <div class="px-5 py-3 border-t border-[var(--th-border-700)] flex justify-end">
        <button
          class="px-4 py-1.5 text-xs rounded bg-[var(--th-bg-700)] text-[var(--th-text-200)] hover:bg-[var(--th-bg-600)] transition-colors"
          onclick={handleCancel}
        >{m.common_cancel()}</button>
      </div>
    </div>
  </div>
{/if}
