<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import Loader2 from "@lucide/svelte/icons/loader-2";
  import ImageOff from "@lucide/svelte/icons/image-off";
  import { m } from "../paraglide/messages.js";

  let {
    ddsPath = "",
    projectDir = "",
    onpathchange,
  }: {
    ddsPath?: string;
    projectDir?: string;
    onpathchange?: (newPath: string) => void;
  } = $props();

  let loading = $state(false);
  let error = $state("");
  let pngData = $state("");
  let showModal = $state(false);
  let dragOver = $state(false);

  // Debounced effect to load preview when path changes
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    const path = ddsPath;
    const dir = projectDir;

    if (debounceTimer) clearTimeout(debounceTimer);

    if (!path) {
      pngData = "";
      error = "";
      loading = false;
      return;
    }

    loading = true;
    error = "";

    debounceTimer = setTimeout(async () => {
      try {
        const result = await invoke<string>("cmd_convert_dds_to_png", {
          path,
          projectDir: dir,
        });
        pngData = result;
        loading = false;
      } catch (e) {
        error = String(e);
        pngData = "";
        loading = false;
      }
    }, 300);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  });

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    const files = e.dataTransfer?.files;
    if (!files?.length) return;
    const file = files[0];
    if (!file.name.toLowerCase().endsWith(".dds")) return;
    onpathchange?.(file.name);
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    dragOver = true;
  }

  function handleDragLeave() {
    dragOver = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && showModal) {
      e.stopPropagation();
      showModal = false;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="texture-preview"
  class:drag-over={dragOver}
  role="region"
  aria-label={m.texture_preview_title()}
  ondrop={handleDrop}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
>
  <div class="texture-preview-header">
    <span class="texture-preview-title">{m.texture_preview_title()}</span>
  </div>

  <div class="texture-preview-content">
    {#if loading}
      <div class="texture-preview-state">
        <Loader2 size={24} class="animate-spin" />
        <span>{m.texture_preview_loading()}</span>
      </div>
    {:else if error}
      <div class="texture-preview-state texture-preview-error">
        <ImageOff size={24} />
        <span>{m.texture_preview_error()}</span>
        <span class="texture-preview-error-detail">{error}</span>
      </div>
    {:else if pngData}
      <button
        class="texture-preview-image-btn"
        onclick={() => (showModal = true)}
        aria-label={m.texture_preview_click_enlarge()}
        type="button"
      >
        <img
          src="data:image/png;base64,{pngData}"
          alt={m.texture_preview_title()}
          class="texture-preview-image"
        />
        <span class="texture-preview-enlarge-hint"
          >{m.texture_preview_click_enlarge()}</span
        >
      </button>
    {:else}
      <div class="texture-preview-state texture-preview-empty">
        <ImageOff size={24} />
        <span>{m.texture_preview_empty()}</span>
      </div>
    {/if}
  </div>

  <div class="texture-preview-drop-hint">{m.texture_preview_drop_hint()}</div>
</div>

{#if showModal && pngData}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="texture-modal-backdrop"
    onclick={() => (showModal = false)}
    onkeydown={(e) => {
      if (e.key === "Escape") showModal = false;
    }}
    role="dialog"
    aria-modal="true"
    aria-label={m.texture_preview_title()}
    tabindex="-1"
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <img
      src="data:image/png;base64,{pngData}"
      alt={m.texture_preview_title()}
      class="texture-modal-image"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    />
    <button
      class="texture-modal-close"
      onclick={() => (showModal = false)}
      aria-label={m.common_close()}
      type="button">&times;</button
    >
  </div>
{/if}

<style>
  .texture-preview {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--th-border-700);
    border-radius: 0.375rem;
    background: var(--th-bg-900);
    overflow: hidden;
  }

  .texture-preview.drag-over {
    border-color: var(--th-accent-500);
    border-style: dashed;
  }

  .texture-preview-header {
    display: flex;
    align-items: center;
    padding: 0.375rem 0.5rem;
    border-bottom: 1px solid var(--th-border-700);
    background: var(--th-bg-800);
  }

  .texture-preview-title {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--th-text-200);
  }

  .texture-preview-content {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 200px;
    height: 200px;
    margin: 0.5rem auto;
    position: relative;
  }

  .texture-preview-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    color: var(--th-text-400);
    font-size: 0.75rem;
    text-align: center;
    padding: 1rem;
  }

  .texture-preview-error {
    color: var(--th-accent-danger, var(--th-text-400));
  }

  .texture-preview-error-detail {
    font-size: 0.625rem;
    opacity: 0.7;
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .texture-preview-empty {
    color: var(--th-text-500);
  }

  .texture-preview-image-btn {
    all: unset;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    width: 100%;
    height: 100%;
  }

  .texture-preview-image-btn:focus-visible {
    outline: 2px solid var(--th-accent-500);
    outline-offset: 2px;
    border-radius: 0.25rem;
  }

  .texture-preview-image {
    max-width: 100%;
    max-height: 180px;
    object-fit: contain;
    border-radius: 0.25rem;
  }

  .texture-preview-enlarge-hint {
    font-size: 0.625rem;
    color: var(--th-text-500);
  }

  .texture-preview-drop-hint {
    text-align: center;
    font-size: 0.625rem;
    color: var(--th-text-500);
    padding: 0.25rem 0.5rem 0.375rem;
    border-top: 1px solid var(--th-border-700);
  }

  /* Modal */
  .texture-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.8);
  }

  .texture-modal-image {
    max-width: 90vw;
    max-height: 90vh;
    object-fit: contain;
    border-radius: 0.5rem;
  }

  .texture-modal-close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: var(--th-bg-800);
    color: var(--th-text-200);
    border: 1px solid var(--th-border-700);
    border-radius: 0.375rem;
    width: 2rem;
    height: 2rem;
    font-size: 1.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .texture-modal-close:hover {
    background: var(--th-bg-700);
  }
</style>
