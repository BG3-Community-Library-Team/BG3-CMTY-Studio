<script lang="ts">
  import { m } from "../../../paraglide/messages.js";
  import { modioAddMedia, modioDeleteMedia } from "../../../lib/tauri/modio.js";
  import type { ModioImage } from "../../../lib/tauri/modio.js";
  import { toastStore } from "../../../lib/stores/toastStore.svelte.js";
  import { getPrefersReducedMotion } from "../../../lib/stores/motion.svelte.js";
  import { open as dialogOpen } from "@tauri-apps/plugin-dialog";
  import Loader2 from "@lucide/svelte/icons/loader-2";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import X from "@lucide/svelte/icons/x";

  let {
    modId,
    gameId,
    mediaImages = [],
    onbrowse,
  }: {
    modId: number;
    gameId: number;
    mediaImages?: ModioImage[];
    onbrowse?: () => void;
  } = $props();

  let images = $derived(mediaImages.map((img) => ({
    filename: img.filename,
    url: img.thumb_320x180 || img.original,
    original: img.original,
  })));
  let isAdding = $state(false);
  let deletingFilename: string | null = $state(null);
  let isDragOver = $state(false);
  let previewImage: { url: string; filename: string } | null = $state(null);
  let dropTargetRef: HTMLButtonElement | null = $state(null);

  const VALID_IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

  // Tauri window-level drag-drop listener for file paths
  $effect(() => {
    let unlistenFn: (() => void) | null = null;
    import("@tauri-apps/api/webviewWindow").then(({ getCurrentWebviewWindow }) => {
      getCurrentWebviewWindow().onDragDropEvent((event) => {
        if (!dropTargetRef) return;
        const rect = dropTargetRef.getBoundingClientRect();
        const payload = event.payload;

        if (payload.type === "over") {
          const pos = payload.position;
          isDragOver = pos.x >= rect.left && pos.x <= rect.right && pos.y >= rect.top && pos.y <= rect.bottom;
        } else if (payload.type === "leave") {
          isDragOver = false;
        } else if (payload.type === "drop") {
          const wasOver = isDragOver;
          isDragOver = false;
          if (!wasOver) return;
          const paths = payload.paths.filter((p: string) => {
            const lower = p.toLowerCase();
            return VALID_IMAGE_EXTS.some(ext => lower.endsWith(ext));
          });
          if (paths.length > 0) {
            uploadFile(paths[0]);
          } else if (payload.paths.length > 0) {
            toastStore.error("Unsupported image format. Use JPG, PNG, GIF, or WebP.");
          }
        }
      }).then(fn => { unlistenFn = fn; });
    });
    return () => { unlistenFn?.(); };
  });

  export async function browseAndAdd() {
    const selected = await dialogOpen({
      multiple: false,
      filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "gif", "webp"] }],
    });
    if (!selected) return;
    await uploadFile(selected as string);
  }

  async function uploadFile(path: string) {
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

  function handleDeleteImage(filename: string) {
    deletingFilename = filename;
  }

  async function confirmDelete() {
    if (!deletingFilename) return;
    const filename = deletingFilename;
    deletingFilename = null;
    try {
      await modioDeleteMedia(modId, [filename]);
      toastStore.success(m.modio_media_deleted?.() ?? "Image deleted");
    } catch {
      toastStore.error(m.modio_error_save_failed());
    }
  }

  function openPreview(img: { url: string; original: string; filename: string }) {
    previewImage = { url: img.original || img.url, filename: img.filename };
  }

  function closePreview() {
    previewImage = null;
  }

  function handlePreviewKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") closePreview();
  }
</script>

<div class="px-3 pb-3">
  <div class="grid grid-cols-3 gap-1.5">
    {#each images as img, i (img.filename)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div
        role="button"
        tabindex={0}
        class="group relative aspect-video rounded overflow-hidden bg-[var(--th-bg-700)] cursor-pointer focus:outline-none focus:ring-1 focus:ring-[var(--th-accent,#0ea5e9)]"
        onclick={() => openPreview(img)}
        onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPreview(img); } }}
        aria-label="Preview {img.filename}"
      >
        <img src={img.url} alt={img.filename} loading="lazy" class="h-full w-full object-cover" />
        <button
          type="button"
          class="absolute top-0.5 right-0.5 rounded bg-[var(--th-bg-900)]/80 p-0.5 text-[var(--th-text-400)] opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-red-400 transition-opacity"
          onclick={(e) => { e.stopPropagation(); handleDeleteImage(img.filename); }}
          aria-label={m.modio_media_delete({ index: String(i + 1) })}
        >
          <Trash2 size={10} />
        </button>
      </div>
    {/each}

    <!-- Faux-thumbnail add button with drag-and-drop -->
    <button
      type="button"
      bind:this={dropTargetRef}
      class="relative aspect-video rounded border-2 border-dashed overflow-hidden flex items-center justify-center cursor-pointer transition-colors
        {isDragOver
          ? 'border-[var(--th-accent,#0ea5e9)] bg-[color-mix(in_srgb,var(--th-accent,#0ea5e9)_10%,transparent)]'
          : 'border-[var(--th-border-600)] bg-[var(--th-bg-800)] hover:border-[var(--th-text-500)] hover:bg-[var(--th-bg-700)]'}"
      onclick={browseAndAdd}
      disabled={isAdding}
      aria-label={m.modio_add_image()}
    >
      {#if isAdding}
        <Loader2 size={18} class="{getPrefersReducedMotion() ? '' : 'animate-spin'} text-[var(--th-text-500)]" />
      {:else}
        <Plus size={18} class="text-[var(--th-text-500)]" />
      {/if}
    </button>
  </div>

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

<!-- Full-screen image preview overlay -->
{#if previewImage}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80"
    role="dialog"
    tabindex={-1}
    aria-label="Image preview"
    onclick={closePreview}
    onkeydown={handlePreviewKeydown}
  >
    <button
      type="button"
      class="absolute top-4 right-4 rounded-full bg-[var(--th-bg-800)]/80 p-2 text-[var(--th-text-300)] hover:text-white hover:bg-[var(--th-bg-700)] z-10"
      onclick={closePreview}
      aria-label="Close preview"
    >
      <X size={20} />
    </button>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <img
      src={previewImage.url}
      alt={previewImage.filename}
      class="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
      onclick={(e) => e.stopPropagation()}
    />
  </div>
{/if}
