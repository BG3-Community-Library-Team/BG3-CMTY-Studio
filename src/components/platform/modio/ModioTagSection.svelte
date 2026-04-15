<script lang="ts">
  import { m } from "../../../paraglide/messages.js";
  import { modioGetGameTags, modioAddTags, modioRemoveTags, type TagOption } from "../../../lib/tauri/modio.js";
  import { toastStore } from "../../../lib/stores/toastStore.svelte.js";
  import { getPrefersReducedMotion } from "../../../lib/stores/motion.svelte.js";
  import Loader2 from "@lucide/svelte/icons/loader-2";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";

  let { modId, gameId }: { modId: number; gameId: number } = $props();

  let tagOptions: TagOption[] = $state([]);
  let activeTags: Set<string> = $state(new Set());
  let isLoading = $state(false);
  let isRefreshing = $state(false);

  $effect(() => {
    if (modId) {
      loadTags();
    }
  });

  async function loadTags() {
    isLoading = true;
    try {
      tagOptions = await modioGetGameTags();
    } catch {
      console.warn("[ModioTagSection] Failed to load tags");
    } finally {
      isLoading = false;
    }
  }

  async function handleToggleTag(tag: string) {
    const wasActive = activeTags.has(tag);
    try {
      if (wasActive) {
        activeTags.delete(tag);
        activeTags = new Set(activeTags);
        await modioRemoveTags(modId, [tag]);
      } else {
        activeTags.add(tag);
        activeTags = new Set(activeTags);
        await modioAddTags(modId, [tag]);
      }
    } catch {
      if (wasActive) {
        activeTags.add(tag);
      } else {
        activeTags.delete(tag);
      }
      activeTags = new Set(activeTags);
      toastStore.error(m.modio_error_save_failed());
    }
  }

  function handleCategoryKeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (!target || target.role !== "button" && target.tagName !== "BUTTON") return;
    const group = target.closest("[role='group']");
    if (!group) return;
    const buttons = Array.from(group.querySelectorAll<HTMLButtonElement>("button"));
    const idx = buttons.indexOf(target as HTMLButtonElement);
    if (idx === -1) return;

    let nextIdx = -1;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIdx = (idx + 1) % buttons.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIdx = (idx - 1 + buttons.length) % buttons.length;
    }
    if (nextIdx !== -1) {
      event.preventDefault();
      buttons[nextIdx].focus();
    }
  }
</script>

<div class="px-3 pb-3">
  {#if isLoading}
    <div class="flex items-center justify-center py-4">
      <Loader2 size={16} class="{getPrefersReducedMotion() ? '' : 'animate-spin'} text-[var(--th-text-500)]" />
    </div>
  {:else if tagOptions.length === 0}
    <p class="py-3 text-center text-[10px] text-[var(--th-text-500)]">
      {m.modio_tags_empty()}
    </p>
  {:else}
    <div class="flex flex-col gap-3">
      {#each tagOptions as category (category.name)}
        <div>
          <h4 class="mb-1 text-[10px] font-medium text-[var(--th-text-400)]">{category.name}</h4>
          <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
          <div class="flex flex-wrap gap-1" role="group" aria-label={category.name} onkeydown={handleCategoryKeydown}>
            {#each category.tags as tag (tag)}
              <button
                type="button"
                class="rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-[var(--th-accent,#0ea5e9)]"
                class:bg-[var(--th-accent,#0ea5e9)]={activeTags.has(tag)}
                class:text-white={activeTags.has(tag)}
                class:border-[var(--th-accent,#0ea5e9)]={activeTags.has(tag)}
                class:bg-transparent={!activeTags.has(tag)}
                class:text-[var(--th-text-300)]={!activeTags.has(tag)}
                class:border-[var(--th-border-600)]={!activeTags.has(tag)}
                onclick={() => handleToggleTag(tag)}
                aria-pressed={activeTags.has(tag)}
              >
                {tag}
              </button>
            {/each}
          </div>
        </div>
      {/each}

      <button
        type="button"
        class="flex items-center gap-1 self-end text-[9px] text-[var(--th-text-500)] hover:text-[var(--th-text-300)]"
        onclick={async () => { isRefreshing = true; await loadTags(); isRefreshing = false; }}
        disabled={isRefreshing}
      >
        <RefreshCw size={10} class={isRefreshing && !getPrefersReducedMotion() ? "animate-spin" : ""} />
        {m.modio_tags_refresh()}
      </button>
    </div>
  {/if}
</div>
