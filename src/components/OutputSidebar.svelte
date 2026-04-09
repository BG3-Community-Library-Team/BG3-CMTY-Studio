<script lang="ts">
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import { projectStore } from "../lib/stores/projectStore.svelte.js";
  import { toastStore } from "../lib/stores/toastStore.svelte.js";
  import { highlightXml } from "../lib/utils/preview.js";
  import { previewLsx } from "../lib/utils/tauri.js";
  import { diffEntryToLsx, getRegionId } from "../lib/utils/entryToLsx.js";
  import { getErrorMessage } from "../lib/types/index.js";
  import type { Section } from "../lib/types/index.js";
  import { m } from "../paraglide/messages.js";
  import ExportBar from "./ExportBar.svelte";
  import { commandRegistry } from "../lib/utils/commandRegistry.svelte.js";
  import { saveProject, validateHandlers, type HandlerWarning } from "../lib/tauri/save.js";
  import { getDbPaths } from "../lib/tauri/db-management.js";
  import PreExportValidation from "./PreExportValidation.svelte";

  let isSaving = $state(false);
  let validationWarnings: HandlerWarning[] = $state([]);
  let showValidationModal = $state(false);

  async function handleSave() {
    if (!modStore.selectedModPath || isSaving) return;
    isSaving = true;
    try {
      const dbPaths = await getDbPaths();
      // Run pre-export validation
      const warnings = await validateHandlers(
        dbPaths.staging,
        dbPaths.base,
        modStore.selectedModPath,
        modStore.modName,
        modStore.modFolder,
      );
      const hasErrors = warnings.some(w => w.severity === "Error");
      const hasWarnings = warnings.some(w => w.severity === "Warning" || w.severity === "Info");
      if (hasErrors || hasWarnings) {
        validationWarnings = warnings;
        showValidationModal = true;
        isSaving = false;
        return;
      }
      await executeSave(dbPaths);
    } catch (e: unknown) {
      toastStore.error("Save failed", getErrorMessage(e));
      isSaving = false;
    }
  }

  async function executeSave(dbPaths?: { staging: string; base: string }) {
    if (!modStore.selectedModPath) return;
    isSaving = true;
    try {
      if (!dbPaths) dbPaths = await getDbPaths();
      const result = await saveProject(
        dbPaths.staging,
        dbPaths.base,
        modStore.selectedModPath,
        modStore.modName,
        modStore.modFolder,
        false,
        false,
      );
      if (result.errors.length === 0) {
        projectStore.markClean();
        const fileCount = result.files_created.length + result.files_updated.length;
        toastStore.success(
          `Saved ${fileCount} file${fileCount !== 1 ? "s" : ""}`,
          `${result.total_entries} entries exported`,
        );
      } else {
        toastStore.error("Save failed", result.errors.join(", "));
      }
    } catch (e: unknown) {
      toastStore.error("Save failed", getErrorMessage(e));
    } finally {
      isSaving = false;
    }
  }

  function handleValidationContinue() {
    showValidationModal = false;
    validationWarnings = [];
    executeSave();
  }

  function handleValidationCancel() {
    showValidationModal = false;
    validationWarnings = [];
  }

  function handleValidationRetry() {
    showValidationModal = false;
    validationWarnings = [];
    handleSave();
  }

  // ---- LSX preview ----
  let lsxPreviewText = $state("");
  let generatingLsx = $state(false);

  $effect(() => {
    const sections = modStore.scanResult?.sections ?? [];
    if (sections.length === 0) {
      lsxPreviewText = "";
      return;
    }

    // Group entries by section (each section becomes a separate region)
    // For now, preview the first section with entries
    const sectionWithEntries = sections.find(s => s.entries.length > 0);
    if (!sectionWithEntries) {
      lsxPreviewText = "";
      return;
    }

    const entries = sectionWithEntries.entries.map(diffEntryToLsx);
    const regionId = getRegionId(sectionWithEntries.section as Section);

    generatingLsx = true;
    previewLsx(entries, regionId)
      .then(xml => {
        lsxPreviewText = xml;
        generatingLsx = false;
      })
      .catch(err => {
        console.error("LSX preview error:", err);
        lsxPreviewText = `<!-- Error generating LSX preview: ${getErrorMessage(err)} -->`;
        generatingLsx = false;
      });
  });

  let lsxHighlightedHtml = $derived(
    lsxPreviewText ? highlightXml(lsxPreviewText) : ""
  );

  let previewFilename = $derived(m.output_lsx_preview());
</script>

<aside class="flex flex-col h-full border-l border-[var(--th-border-700)] relative">
  <!-- Preview generation loading indicator -->
  {#if generatingLsx}
    <div class="absolute top-0 left-0 right-0 h-0.5 bg-[var(--th-bg-700)] overflow-hidden z-10">
      <div class="h-full w-1/3 bg-sky-400 rounded-full animate-[indeterminate_1.4s_ease-in-out_infinite]"></div>
    </div>
  {/if}
  <!-- Sidebar header -->
  <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--th-border-700)]">
    <div class="flex items-center gap-3">
      <h2 class="text-sm font-semibold text-[var(--th-text-200)]">{m.output_preview_heading()}</h2>
    </div>
  </div>
  {#if lsxPreviewText}
    <div class="px-4 py-1 text-[10px] text-[var(--th-text-500)] font-mono border-b border-[var(--th-border-700)] truncate">
      {previewFilename}
    </div>
  {/if}

  <!-- Preview area -->
  <div class="flex-1 min-h-0 overflow-y-auto p-4 scrollbar-thin" aria-live="polite">
    {#if lsxHighlightedHtml}
      <pre class="text-xs leading-relaxed font-mono whitespace-pre-wrap break-words">{@html lsxHighlightedHtml}</pre>
    {:else}
      <div class="flex items-center justify-center h-full text-zinc-600 text-sm">
        <p>{m.output_scan_mod_hint()}</p>
      </div>
    {/if}
  </div>

  <!-- Export bar -->
  <div class="px-4 py-3 border-t border-[var(--th-border-700)]">
    <ExportBar lsxPreviewText={lsxPreviewText} onexportmod={() => commandRegistry.execute('action.packageProject')} onsave={handleSave} saving={isSaving} />
  </div>
</aside>

{#if showValidationModal && validationWarnings.length > 0}
  <PreExportValidation
    warnings={validationWarnings}
    oncontinue={handleValidationContinue}
    oncancel={handleValidationCancel}
    onretry={handleValidationRetry}
  />
{/if}


