<script lang="ts">
  import { configStore } from "../lib/stores/configStore.svelte.js";
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import { highlightYaml, highlightJson, highlightXml, isEntryValid } from "../lib/utils/preview.js";
  import { previewConfig, previewLsx } from "../lib/utils/tauri.js";
  import { settingsStore } from "../lib/stores/settingsStore.svelte.js";
  import { PreviewWorkerClient } from "../lib/utils/previewWorkerClient.js";
  import { diffEntryToLsx, getRegionId } from "../lib/utils/entryToLsx.js";
  import { getErrorMessage } from "../lib/types/index.js";
import type { Section } from "../lib/types/index.js";
  import { m } from "../paraglide/messages.js";
  import FormatToggle from "./FormatToggle.svelte";
  import ExportBar from "./ExportBar.svelte";
  import ExportModModal from "./ExportModModal.svelte";

  /** Output mode: CF config (YAML/JSON) or LSX XML preview */
  type OutputMode = "config" | "lsx";
  let outputMode = $state<OutputMode>("config");

  let showExportModal = $state(false);

  let format = $derived(configStore.format);
  let selectedEntries = $derived(configStore.selectedEntries);

  // PF-023: Debounced async preview generation
  const previewClient = new PreviewWorkerClient(50);

  /** Whether a preview generation IPC call is in flight */
  let generatingPreview = $state(false);

  // Regenerate preview whenever inputs change
  // PF-023: Uses debounced async generation to avoid blocking the UI thread
  $effect(() => {
    // access reactive deps
    const _entries = selectedEntries;
    const _fmt = format;
    const _manual = configStore.manualEntries;
    const _overrides = configStore.autoEntryOverrides;
    const _sectionComments = settingsStore.enableSectionComments;
    const _entryComments = settingsStore.enableEntryComments;

    if (_entries.length === 0 && _manual.length === 0) {
      configStore.setPreview("");
      return;
    }

    const hlFn = _fmt === "Yaml" ? highlightYaml : highlightJson;
    const formatStr = _fmt === "Yaml" ? "yaml" : "json";

    // Rust IPC wrapper as async GenerateFn
    const genFn = (entries: typeof _entries, manual: typeof _manual, overrides: typeof _overrides) =>
      previewConfig(
        entries.filter(isEntryValid),
        manual,
        overrides,
        formatStr,
        true,
        _sectionComments,
        _entryComments,
      );

    (async () => {
      generatingPreview = true;
      try {
        const result = await previewClient.generate(genFn, hlFn, _entries, _manual, _overrides);
        if (result) {
          configStore.setPreview(result.previewText, result.highlightedHtml);
        }
      } catch (e) {
        console.error("Preview generation failed:", e);
      } finally {
        generatingPreview = false;
      }
    })();
  });

  // ---- LSX preview ----
  let lsxPreviewText = $state("");
  let generatingLsx = $state(false);

  $effect(() => {
    if (outputMode !== "lsx") return;

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

  let highlightedHtml = $derived(configStore.highlightedPreviewHtml);

  let previewFilename = $derived(
    outputMode === "lsx"
      ? m.output_lsx_preview()
      : format === "Yaml" ? m.output_cf_config_yaml() : m.output_cf_config_json()
  );
</script>

<aside class="flex flex-col h-full border-l border-[var(--th-border-700)] relative">
  <!-- Preview generation loading indicator -->
  {#if generatingPreview || generatingLsx}
    <div class="absolute top-0 left-0 right-0 h-0.5 bg-[var(--th-bg-700)] overflow-hidden z-10">
      <div class="h-full w-1/3 bg-sky-400 rounded-full animate-[indeterminate_1.4s_ease-in-out_infinite]"></div>
    </div>
  {/if}
  <!-- Sidebar header -->
  <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--th-border-700)]">
    <div class="flex items-center gap-3">
      <h2 class="text-sm font-semibold text-[var(--th-text-200)]">{m.output_preview_heading()}</h2>
    </div>
    <div class="flex items-center gap-2">
      {#if outputMode === "config"}
        <FormatToggle />
      {/if}
    </div>
  </div>
  {#if configStore.previewText || lsxPreviewText}
    <div class="px-4 py-1 text-[10px] text-[var(--th-text-500)] font-mono border-b border-[var(--th-border-700)] truncate">
      {previewFilename}
    </div>
  {/if}

  <!-- Preview area -->
  <div class="flex-1 min-h-0 overflow-y-auto p-4 scrollbar-thin" aria-live="polite">
    {#if outputMode === "lsx"}
      <!-- LSX XML preview -->
      {#if lsxHighlightedHtml}
        <pre class="text-xs leading-relaxed font-mono whitespace-pre-wrap break-words">{@html lsxHighlightedHtml}</pre>
      {:else}
        <div class="flex items-center justify-center h-full text-zinc-600 text-sm">
          <p>{m.output_scan_mod_hint()}</p>
        </div>
      {/if}
    {:else if highlightedHtml}
      <pre class="text-xs leading-relaxed font-mono whitespace-pre-wrap break-words">{@html highlightedHtml}</pre>
    {:else}
      <div class="flex items-center justify-center h-full text-zinc-600 text-sm">
        <p>{m.output_select_entries_hint()}</p>
      </div>
    {/if}
  </div>

  <!-- Export bar -->
  <div class="px-4 py-3 border-t border-[var(--th-border-700)]">
    <ExportBar outputMode={outputMode} lsxPreviewText={lsxPreviewText} onexportmod={() => showExportModal = true} />
  </div>
</aside>

{#if showExportModal}
  <ExportModModal onclose={() => showExportModal = false} />
{/if}


