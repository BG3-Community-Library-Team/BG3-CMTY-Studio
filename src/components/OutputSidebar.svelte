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
  import { saveProject } from "../lib/tauri/save.js";
  import { getDbPaths } from "../lib/tauri/db-management.js";

  let isSaving = $state(false);

  async function handleSave() {
    if (!modStore.selectedModPath || isSaving) return;
    isSaving = true;
    try {
      const dbPaths = await getDbPaths();
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
    <ExportBar lsxPreviewText={lsxPreviewText} onexportmod={() => window.dispatchEvent(new CustomEvent('open-export-mod-modal'))} onsave={handleSave} saving={isSaving} />
  </div>
</aside>


