<!--
  UploadProgressModal — Shared modal for Nexus and mod.io uploads.
  Subscribes to platformUploadStore for real-time progress updates.
-->
<script lang="ts">
  import { m } from "../../paraglide/messages.js";
  import { platformUploadStore } from "../../lib/stores/platformUploadStore.svelte.js";
  import { focusTrap } from "../../lib/utils/focusTrap.js";
  import { invoke } from "@tauri-apps/api/core";
  import type { UploadStage } from "../../lib/types/platform.js";
  import X from "@lucide/svelte/icons/x";
  import Check from "@lucide/svelte/icons/check";
  import AlertCircle from "@lucide/svelte/icons/alert-circle";
  import Loader2 from "@lucide/svelte/icons/loader-2";
  import ExternalLink from "@lucide/svelte/icons/external-link";

  let { onclose }: { onclose: () => void } = $props();

  const STAGES: UploadStage[] = ["Packaging", "Hashing", "Uploading", "Finalizing", "Processing", "Publishing"];

  const STAGE_LABELS: Record<UploadStage, () => string> = {
    Packaging: () => m.upload_stage_packaging(),
    Hashing: () => m.upload_stage_hashing(),
    Uploading: () => m.upload_stage_uploading(),
    Finalizing: () => m.upload_stage_finalizing(),
    Processing: () => m.upload_stage_processing(),
    Publishing: () => m.upload_stage_publishing(),
    Complete: () => m.upload_stage_complete(),
    Error: () => m.upload_stage_error(),
  };

  let progress = $derived(platformUploadStore.currentUpload);
  let currentStageIdx = $derived(progress ? STAGES.indexOf(progress.stage as UploadStage) : -1);
  let isComplete = $derived(progress?.stage === "Complete");
  let isError = $derived(progress?.stage === "Error");
  let canCancel = $derived(
    progress != null &&
    !isComplete &&
    !isError &&
    currentStageIdx < STAGES.indexOf("Finalizing"),
  );

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function stageStatus(stageIdx: number): "complete" | "active" | "pending" | "error" {
    if (isError && stageIdx === currentStageIdx) return "error";
    if (stageIdx < currentStageIdx) return "complete";
    if (stageIdx === currentStageIdx) return "active";
    return "pending";
  }

  async function handleCancel() {
    try {
      await invoke("cmd_cancel_upload");
    } catch { /* ignore if command not available */ }
  }

  async function handleRetry() {
    try {
      await invoke("cmd_retry_upload");
    } catch { /* ignore */ }
  }

  function handleClose() {
    platformUploadStore.reset();
    onclose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && (isComplete || isError)) handleClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="fixed inset-0 bg-[var(--th-modal-backdrop)] z-[60] flex items-center justify-center p-4"
  role="presentation"
>
  <div
    class="bg-[var(--th-bg-800)] border border-[var(--th-border-700)] rounded-lg shadow-2xl w-full max-w-md flex flex-col"
    role="dialog"
    aria-modal="true"
    aria-labelledby="upload-progress-title"
    tabindex="-1"
    use:focusTrap
  >
    <!-- Header -->
    <div class="px-5 py-4 border-b border-[var(--th-border-700)] flex items-center gap-3">
      <h3 id="upload-progress-title" class="text-sm font-bold text-[var(--th-text-100)]">
        {m.upload_progress_title({ platform: progress?.platform ?? "..." })}
      </h3>
      {#if isComplete || isError}
        <button class="ml-auto p-2 rounded hover:bg-[var(--th-bg-600)]" onclick={handleClose} aria-label={m.common_close()}>
          <X size={14} class="text-[var(--th-text-500)]" />
        </button>
      {/if}
    </div>

    <!-- Stage list -->
    <div class="px-5 py-4 space-y-3" aria-live="polite">
      {#each STAGES as stage, idx}
        {@const status = stageStatus(idx)}
        <div class="flex items-center gap-3">
          <!-- Indicator -->
          <div class="flex-shrink-0 w-5 h-5 flex items-center justify-center">
            {#if status === "complete"}
              <Check size={16} class="text-[var(--th-success,#10b981)]" />
            {:else if status === "active"}
              <Loader2 size={16} class="text-[var(--th-accent,#0ea5e9)] upload-spin" />
            {:else if status === "error"}
              <AlertCircle size={16} class="text-[var(--th-error,#ef4444)]" />
            {:else}
              <div class="w-2 h-2 rounded-full bg-[var(--th-text-600)]"></div>
            {/if}
          </div>

          <!-- Label + progress -->
          <div class="flex-1 min-w-0">
            <span
              class="text-xs font-medium"
              class:text-[var(--th-text-200)]={status === "active" || status === "complete"}
              class:text-[var(--th-text-500)]={status === "pending"}
              class:text-[var(--th-error,#ef4444)]={status === "error"}
            >
              {STAGE_LABELS[stage]()}
            </span>

            {#if status === "active" && progress}
              <!-- Progress bar for upload stage -->
              {#if stage === "Uploading" && progress.bytes_total > 0}
                <div class="mt-1 w-full h-1.5 bg-[var(--th-bg-700)] rounded-full overflow-hidden">
                  <div
                    class="h-full bg-[var(--th-accent,#0ea5e9)] rounded-full transition-all duration-300"
                    style="width: {progress.percent}%"
                    role="progressbar"
                    aria-valuenow={progress.percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  ></div>
                </div>
                <p class="text-[10px] text-[var(--th-text-500)] mt-0.5">
                  {m.upload_bytes_progress({ sent: formatBytes(progress.bytes_sent), total: formatBytes(progress.bytes_total) })}
                </p>
              {:else if progress.percent > 0}
                <div class="mt-1 w-full h-1.5 bg-[var(--th-bg-700)] rounded-full overflow-hidden">
                  <div
                    class="h-full bg-[var(--th-accent,#0ea5e9)] rounded-full transition-all duration-300"
                    style="width: {progress.percent}%"
                    role="progressbar"
                    aria-valuenow={progress.percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  ></div>
                </div>
              {/if}
            {/if}
          </div>
        </div>
      {/each}

      <!-- Error message -->
      {#if isError && progress?.message}
        <div class="mt-2 p-3 bg-red-900/20 border border-red-700/40 rounded text-xs text-red-300">
          {progress.message}
        </div>
      {/if}

      <!-- Success message -->
      {#if isComplete}
        <div class="mt-2 p-3 bg-emerald-900/20 border border-emerald-700/40 rounded text-xs text-emerald-300">
          {m.upload_success()}
        </div>
      {/if}
    </div>

    <!-- Footer actions -->
    <div class="px-5 py-3 border-t border-[var(--th-border-700)] flex items-center justify-end gap-2">
      {#if isError}
        <button
          class="px-3 py-1.5 text-xs rounded bg-[var(--th-accent,#0ea5e9)] hover:brightness-110 text-white font-medium transition-colors"
          onclick={handleRetry}
        >{m.upload_retry()}</button>
        <button
          class="px-3 py-1.5 text-xs rounded bg-[var(--th-bg-700)] hover:bg-[var(--th-bg-600)] text-[var(--th-text-300)] transition-colors"
          onclick={handleClose}
        >{m.common_close()}</button>
      {:else if isComplete}
        <button
          class="px-3 py-1.5 text-xs rounded bg-[var(--th-accent,#0ea5e9)] hover:brightness-110 text-white font-medium transition-colors flex items-center gap-1.5"
          onclick={handleClose}
        >
          <ExternalLink size={12} />
          {m.upload_open_on_platform({ platform: progress?.platform ?? "" })}
        </button>
        <button
          class="px-3 py-1.5 text-xs rounded bg-[var(--th-bg-700)] hover:bg-[var(--th-bg-600)] text-[var(--th-text-300)] transition-colors"
          onclick={handleClose}
        >{m.common_close()}</button>
      {:else}
        <button
          class="px-3 py-1.5 text-xs rounded bg-[var(--th-bg-700)] text-[var(--th-text-300)] transition-colors"
          class:hover:bg-[var(--th-bg-600)]={canCancel}
          class:opacity-40={!canCancel}
          class:cursor-not-allowed={!canCancel}
          disabled={!canCancel}
          onclick={handleCancel}
        >{m.upload_cancel()}</button>
      {/if}
    </div>
  </div>
</div>

<style>
  @keyframes upload-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  :global(.upload-spin) {
    animation: upload-spin 1s linear infinite;
  }
  @media (prefers-reduced-motion: reduce) {
    :global(.upload-spin) {
      animation: none;
    }
  }
</style>
