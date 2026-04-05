<script lang="ts">
  import { m } from "../paraglide/messages.js";
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import { toastStore } from "../lib/stores/toastStore.svelte.js";
  import FolderOutput from "@lucide/svelte/icons/folder-output";
  import Button from "./Button.svelte";

  let { lsxPreviewText = "", onexportmod }: { lsxPreviewText?: string; onexportmod?: () => void } = $props();

  let copySuccess = $state(false);

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
  <Button
    variant="secondary"
    size="md"
    class="flex-1"
    onclick={handleCopy}
    disabled={!lsxPreviewText}
  >
    {copySuccess ? m.common_copied() : m.common_copy()}
  </Button>

  {#if onexportmod}
    <Button
      variant="secondary"
      size="md"
      onclick={onexportmod}
      disabled={!modStore.scanResult}
      title={m.export_bar_export_title()}
    >
      <FolderOutput size={14} />
    </Button>
  {/if}
</div>
