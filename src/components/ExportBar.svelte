<script lang="ts">
  import { m } from "../paraglide/messages.js";
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import { projectStore } from "../lib/stores/projectStore.svelte.js";
  import { toastStore } from "../lib/stores/toastStore.svelte.js";
  import Package from "@lucide/svelte/icons/package";
  import Save from "@lucide/svelte/icons/save";
  import Eye from "@lucide/svelte/icons/eye";
  import Button from "./Button.svelte";
  import SaveSummaryModal from "./SaveSummaryModal.svelte";
  import { saveProject, type SaveProjectResult } from "../lib/tauri/save.js";
  import { getDbPaths } from "../lib/tauri/db-management.js";

  let { lsxPreviewText = "", onexportmod, onsave, saving = false }: { lsxPreviewText?: string; onexportmod?: () => void; onsave?: () => void; saving?: boolean } = $props();

  let copySuccess = $state(false);
  let summaryResult: SaveProjectResult | null = $state(null);
  let previewing = $state(false);

  async function handlePreview(): Promise<void> {
    if (!modStore.selectedModPath || previewing) return;
    previewing = true;
    try {
      const dbPaths = await getDbPaths();
      summaryResult = await saveProject(
        dbPaths.staging,
        dbPaths.base,
        modStore.selectedModPath,
        modStore.modName,
        modStore.modFolder,
        false,
        true,
      );
    } catch (err) {
      toastStore.error(m.export_bar_preview_failed(), String(err));
    } finally {
      previewing = false;
    }
  }

  /** Track active timer IDs for cleanup on component destroy */
  let activeTimers: ReturnType<typeof setTimeout>[] = $state([]);

  function trackedTimeout(fn: () => void, ms: number): void {
    const id = setTimeout(() => {
      fn();
      activeTimers = activeTimers.filter(t => t !== id);
    }, ms);
    activeTimers = [...activeTimers, id];
  }

  $effect(() => {
    return () => {
      for (const id of activeTimers) clearTimeout(id);
    };
  });

  async function handleCopy(): Promise<void> {
    const text = lsxPreviewText;
    try {
      await navigator.clipboard.writeText(text);
      copySuccess = true;
      toastStore.success(m.export_bar_copy_success());
      trackedTimeout(() => copySuccess = false, 3500);
    } catch {
      console.error("Copy failed");
    }
  }
</script>

<div class="flex items-center gap-2">
  {#if projectStore.dirty}
    <span class="text-xs text-amber-400 shrink-0" title="Unsaved changes">●</span>
  {/if}
  <Button
    variant="secondary"
    size="md"
    class="flex-1"
    onclick={handleCopy}
    disabled={!lsxPreviewText}
  >
    {copySuccess ? m.common_copied() : m.common_copy()}
  </Button>

  <Button
    variant="ghost"
    size="md"
    onclick={handlePreview}
    disabled={!modStore.selectedModPath || previewing}
    loading={previewing}
    title={m.export_bar_preview_save()}
  >
    <Eye size={14} />
  </Button>

  {#if onsave}
    <Button
      variant="primary"
      size="md"
      onclick={onsave}
      disabled={!projectStore.dirty || saving}
      loading={saving}
      title={projectStore.dirty ? "Save project (Ctrl+S)" : "No unsaved changes"}
    >
      <Save size={14} />
    </Button>
  {/if}

  {#if onexportmod}
    <Button
      variant="secondary"
      size="md"
      onclick={onexportmod}
      disabled={!modStore.scanResult}
      title={m.export_bar_export_title()}
    >
      <Package size={14} />
    </Button>
  {/if}
</div>

{#if summaryResult}
  <SaveSummaryModal result={summaryResult} onclose={() => summaryResult = null} />
{/if}
