<script lang="ts">
  import { m } from "../../../paraglide/messages.js";
  import { modioAddMedia, modioDeleteMedia } from "../../../lib/tauri/modio.js";
  import { toastStore } from "../../../lib/stores/toastStore.svelte.js";
  import { getPrefersReducedMotion } from "../../../lib/stores/motion.svelte.js";
  import { open as dialogOpen } from "@tauri-apps/plugin-dialog";
  import Loader2 from "@lucide/svelte/icons/loader-2";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";

  let { modId, gameId }: { modId: number; gameId: number } = $props();

  let images: { filename: string; url: string; isLogo?: boolean }[] = $state([]);
  let isLoading = $state(false);
  let isAdding = $state(false);
  let deletingFilename: string | null = $state(null);

  async function handleAddImage() {
    const selected = await dialogOpen({
      multiple: false,
      filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "gif", "webp"] }],
    });
    if (!selected) return;
    const path = typeof selected === "string" ? selected : selected;
    isAdding = true;
    try {
      await modioAddMedia({ mod_id: modId, image_paths: [path] });
      toastStore.success(m.modio_add_image());
    } catch {
      toastStore.error(m.modio_error_save_failed());
    } finally {
      isAdding = false;
    }
  }

  async function handleDeleteImage(filename: string) {
    deletingFilename = filename;
  }

  async function confirmDelete() {
    if (!deletingFilename) return;
    const filename = deletingFilename;
    deletingFilename = null;
    try {
      await modioDeleteMedia(modId, [filename]);
      images = images.filter((img) => img.filename !== filename);
    } catch {
      toastStore.error(m.modio_error_save_failed());
    }
  }
</script>

<div class="px-3 pb-3">
  <div class="flex items-center justify-between mb-2">
    <button
      type="button"
      class="flex items-center gap-1 rounded border border-[var(--th-border-600)] bg-[var(--th-bg-800)] px-2 py-1 text-[10px] font-medium text-[var(--th-text-300)] hover:bg-[var(--th-bg-700)]"
      onclick={handleAddImage}
      disabled={isAdding}
    >
      {#if isAdding}
        <Loader2 size={12} class={getPrefersReducedMotion() ? '' : 'animate-spin'} />
      {:else}
        <Plus size={12} />
      {/if}
      {m.modio_add_image()}
    </button>
  </div>

  {#if images.length === 0}
    <p class="py-3 text-center text-[10px] text-[var(--th-text-500)]">
      {m.modio_media_empty()}
    </p>
  {:else}
    <div class="grid grid-cols-3 gap-1.5">
      {#each images as img, i (img.filename)}
        <div class="group relative aspect-video rounded overflow-hidden bg-[var(--th-bg-700)]">
          <img src={img.url} alt={img.filename} loading="lazy" class="h-full w-full object-cover" />
          {#if img.isLogo}
            <span class="absolute top-0.5 left-0.5 rounded bg-[var(--th-accent,#0ea5e9)] px-1 py-0.5 text-[8px] font-bold text-white">
              {m.modio_media_logo()}
            </span>
          {/if}
          <button
            type="button"
            class="absolute top-0.5 right-0.5 rounded bg-[var(--th-bg-900)]/80 p-0.5 text-[var(--th-text-400)] opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-red-400 transition-opacity"
            onclick={() => handleDeleteImage(img.filename)}
            aria-label={m.modio_media_delete({ index: String(i + 1) })}
          >
            <Trash2 size={10} />
          </button>
        </div>
      {/each}
    </div>
  {/if}

  {#if deletingFilename != null}
    <div class="mt-2 flex items-center gap-2 rounded border border-red-500/30 bg-[var(--th-bg-800)] px-2 py-1.5 text-[10px]">
      <span class="text-[var(--th-text-300)]">{m.modio_delete_image_confirm()}</span>
      <button
        type="button"
        class="rounded bg-red-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-red-500"
        onclick={confirmDelete}
      >
        {m.common_yes()}
      </button>
      <button
        type="button"
        class="rounded border border-[var(--th-border-600)] px-2 py-0.5 text-[10px] text-[var(--th-text-400)] hover:text-[var(--th-text-300)]"
        onclick={() => { deletingFilename = null; }}
      >
        {m.common_cancel()}
      </button>
    </div>
  {/if}
</div>
