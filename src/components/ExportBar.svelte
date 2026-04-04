<script lang="ts">
  import { m } from "../paraglide/messages.js";
  import { configStore } from "../lib/stores/configStore.svelte.js";
  import { saveConfig, openPath, saveLsx, previewLsx } from "../lib/utils/tauri.js";
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import { toastStore } from "../lib/stores/toastStore.svelte.js";
  import { diffEntryToLsx, getRegionId } from "../lib/utils/entryToLsx.js";
  import type { Section } from "../lib/types/index.js";
  import { getErrorMessage } from "../lib/types/index.js";
  import Check from "@lucide/svelte/icons/check";
  import X from "@lucide/svelte/icons/x";
  import Loader2 from "@lucide/svelte/icons/loader-2";
  import FolderOutput from "@lucide/svelte/icons/folder-output";
  import Button from "./Button.svelte";

  let { outputMode = "config", lsxPreviewText = "", onexportmod }: { outputMode?: "config" | "lsx"; lsxPreviewText?: string; onexportmod?: () => void } = $props();

  let saving = $state(false);
  let copySuccess = $state(false);

  /** Transient save button state: null = default, "success" | "failure" */
  let saveState: "success" | "failure" | null = $state(null);
  let saveError = $state("");

  /** Snapshot of previewText at save time — "Saved ✓" persists until preview changes */
  let savedPreviewSnapshot: string | null = $state(null);

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

  // Clear "Saved ✓" when preview text changes (meaning config was mutated and regenerated)
  $effect(() => {
    if (savedPreviewSnapshot !== null && configStore.previewText !== savedPreviewSnapshot) {
      saveState = null;
      savedPreviewSnapshot = null;
    }
  });

  async function handleSave(): Promise<void> {
    if (!modStore.scanResult || !configStore.previewText) return;
    saving = true;
    saveState = null;
    saveError = "";
    try {
      const folder = modStore.scanResult.mod_meta.folder;
      const ext = configStore.format === "Yaml" ? "yaml" : "json";
      const dirPath = `${modStore.selectedModPath}/Mods/${folder}/ScriptExtender`;
      const path = `${dirPath}/CompatibilityFrameworkConfig.${ext}`;
      // Save the preview text directly — matches what the user sees in the output panel
      await saveConfig(configStore.previewText, path, true);
      saveState = "success";
      savedPreviewSnapshot = configStore.previewText;
      configStore.markClean();
      toastStore.registerToastAction(
        "open-config-dir",
        () => { openPath(dirPath).catch(console.error); },
      );
      toastStore.success(
        m.app_config_saved(),
        path,
        {
          label: m.export_mod_open_folder(),
          actionId: "open-config-dir",
        },
      );
    } catch (e) {
      console.error("Save failed:", e);
      saveState = "failure";
      saveError = getErrorMessage(e);
      toastStore.error(m.app_save_failed(), saveError);
      trackedTimeout(() => { saveState = null; saveError = ""; }, 3000);
    } finally {
      saving = false;
    }
  }

  async function handleCopy(): Promise<void> {
    const text = outputMode === "lsx" ? lsxPreviewText : configStore.previewText;
    try {
      await navigator.clipboard.writeText(text);
      copySuccess = true;
      toastStore.success(m.export_bar_copy_success());
      trackedTimeout(() => copySuccess = false, 3500);
    } catch {
      console.error("Copy failed");
    }
  }

  async function handleSaveLsx(): Promise<void> {
    if (!modStore.scanResult) return;
    saving = true;
    saveState = null;
    saveError = "";
    try {
      const sections = modStore.scanResult.sections ?? [];
      const folder = modStore.scanResult.mod_meta.folder;
      const modPath = modStore.selectedModPath;

      for (const section of sections) {
        if (section.entries.length === 0) continue;
        const regionId = getRegionId(section.section as Section);
        const entries = section.entries.map(diffEntryToLsx);
        // Determine the output folder path based on section type
        const folderName = regionId;
        const outputPath = `${modPath}/Public/${folder}/${folderName}/${folderName}.lsx`;
        await saveLsx(entries, regionId, outputPath);
      }

      saveState = "success";
      const dirPath = `${modPath}/Public/${folder}`;
      const exportedCount = sections.filter(s => s.entries.length > 0).length;
      toastStore.registerToastAction(
        "open-lsx-dir",
        () => { openPath(dirPath).catch(console.error); },
      );
      toastStore.success(
        m.export_bar_lsx_saved_title(),
        m.export_bar_lsx_saved_message({ exportedCount, dirPath }),
        {
          label: m.export_mod_open_folder(),
          actionId: "open-lsx-dir",
        },
      );
    } catch (e) {
      console.error("LSX save failed:", e);
      saveState = "failure";
      saveError = getErrorMessage(e);
      toastStore.error(m.export_bar_lsx_save_failed(), saveError);
      trackedTimeout(() => { saveState = null; saveError = ""; }, 3000);
    } finally {
      saving = false;
    }
  }

  let saveButtonLabel = $derived(
    saving
      ? m.export_bar_saving()
      : saveState === "success"
        ? m.export_bar_saved()
        : saveState === "failure"
          ? m.export_bar_save_failed_label()
          : m.export_bar_save_label()
  );

  let saveButtonClass = $derived(
    saveState === "success"
      ? "flex-1"
      : saveState === "failure"
        ? "flex-1"
        : "flex-1"
  );

  let saveVariant = $derived<"primary" | "secondary" | "destructive">(
    saveState === "success" ? "secondary" : saveState === "failure" ? "destructive" : "primary"
  );
</script>

<div class="flex items-center gap-2">
  <Button
    variant="secondary"
    size="md"
    class="flex-1"
    onclick={handleCopy}
    disabled={outputMode === "lsx" ? !lsxPreviewText : !configStore.previewText}
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
