<!--
  ExportModModal: Confirmation dialog for multi-file mod export.
  Shows a summary of all files to be written (LSX, localization, Osiris goals),
  with entry counts, backup option, and export/cancel actions.
-->
<script lang="ts">
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import { projectStore } from "../lib/stores/projectStore.svelte.js";
  import { toastStore } from "../lib/stores/toastStore.svelte.js";
  import { type Section, getErrorMessage } from "../lib/types/index.js";
  import { diffEntryToLsx, getRegionId } from "../lib/utils/entryToLsx.js";
  import { exportMod, openPath, saveConfig, type ExportFileSpec, packageMod } from "../lib/utils/tauri.js";
  import type { PackageModOptions } from "../lib/tauri/packaging.js";
  import { m } from "../paraglide/messages.js";
  import Check from "@lucide/svelte/icons/check";
  import X from "@lucide/svelte/icons/x";
  import FolderOutput from "@lucide/svelte/icons/folder-output";
  import Loader2 from "@lucide/svelte/icons/loader-2";
  import FileText from "@lucide/svelte/icons/file-text";
  import Languages from "@lucide/svelte/icons/languages";
  import ScrollText from "@lucide/svelte/icons/scroll-text";
  import Package from "@lucide/svelte/icons/package";
  import { focusTrap } from "../lib/utils/focusTrap.js";
  import { generateRaceTagGoalFile } from "../lib/utils/osirisGoalWriter.js";
  import type { LocaFileEntry } from "../lib/types/index.js";

  let { onclose }: { onclose: () => void } = $props();

  let backup = $state(true);
  let exporting = $state(false);
  let exportDone = $state(false);
  let exportErrors: string[] = $state([]);
  let exportFileErrors: Record<string, string[]> = $state({});
  let exportedCount = $state(0);

  // Pak packaging options
  let pakEnabled = $state(false);
  let pakCompression = $state<"lz4" | "zlib" | "none">("lz4");
  let pakLevel = $state<"fast" | "default" | "max">("default");
  let pakPriority = $state(0);
  let pakOutputPath = $state("");

  // Staging meta-loaded data (async on mount)
  let locaEntries: LocaFileEntry[] = $state([]);
  let autoLocaEntries: Map<string, { text: string; version: number }> = $state(new Map());
  let osirisGoalEntries: Map<string, { raceTagName: string; raceTagUuid: string; reallyTagName: string; reallyTagUuid: string }> = $state(new Map());
  let osirisGoalFileUuid: string = $state("");

  // Load meta data from staging DB on mount
  $effect(() => {
    (async () => {
      try {
        const locaRaw = await projectStore.getMeta("loca_entries");
        if (locaRaw) locaEntries = JSON.parse(locaRaw);

        const osirisRaw = await projectStore.getMeta("osiris_goal_entries");
        if (osirisRaw) {
          const parsed = JSON.parse(osirisRaw);
          const map = new Map<string, { raceTagName: string; raceTagUuid: string; reallyTagName: string; reallyTagUuid: string }>();
          if (Array.isArray(parsed)) {
            for (const p of parsed) {
              if (p.raceTagUuid) map.set(p.raceTagUuid, p);
            }
          }
          osirisGoalEntries = map;
        }

        const fileUuid = await projectStore.getMeta("osiris_goal_file_uuid");
        if (fileUuid) osirisGoalFileUuid = fileUuid;

        // Auto loca entries from loca__english section
        const locaRows = await projectStore.loadSection("loca__english");
        if (locaRows.length > 0) {
          const map = new Map<string, { text: string; version: number }>();
          for (const row of locaRows) {
            const handle = String(row["contentuid"] ?? "");
            const text = String(row["text"] ?? "");
            const version = parseInt(String(row["version"] ?? "1"), 10) || 1;
            if (handle) map.set(handle, { text, version });
          }
          autoLocaEntries = map;
        }
      } catch (err) {
        console.warn("Failed to load export meta from staging:", err);
      }
    })();
  });

  let scanResult = $derived(modStore.scanResult);
  let modPath = $derived(modStore.selectedModPath);
  let modFolder = $derived(scanResult?.mod_meta.folder ?? "");

  // Initialize default pak output path
  $effect(() => {
    if (modFolder && !pakOutputPath) {
      pakOutputPath = `${modFolder}.pak`;
    }
  });

  /** Gather all LSX file specs from scan results. */
  let lsxFileSpecs = $derived.by((): { specs: ExportFileSpec[]; totalEntries: number } => {
    if (!scanResult || !modPath) return { specs: [], totalEntries: 0 };

    const specs: ExportFileSpec[] = [];
    let totalEntries = 0;

    for (const section of scanResult.sections) {
      if (section.entries.length === 0) continue;

      const regionId = getRegionId(section.section);
      const entries = section.entries.map(diffEntryToLsx);
      const folderName = regionId;
      const outputPath = `${modPath}/Public/${modFolder}/${folderName}/${folderName}.lsx`;

      specs.push({ output_path: outputPath, region_id: regionId, entries });
      totalEntries += entries.length;
    }

    return { specs, totalEntries };
  });

  /** Localization file specs (user-authored + auto-generated). */
  let locaSpecs = $derived.by(() => {
    if (!modPath) return [] as { outputPath: string; content: string; label: string; count: number }[];
    const date = new Date();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const yyyy = date.getFullYear();
    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    const dateStr = `${mm}/${dd}/${yyyy} ${hh}:${min}`;

    const specs: { outputPath: string; content: string; label: string; count: number }[] = [];

    // User-authored localization entries from the Localization panel
    for (const entry of locaEntries) {
      if (!entry.label.trim() || entry.values.length === 0) continue;
      const fileName = entry.label.trim();
      const outputPath = `${modPath}/Localization/English/${fileName}.xml`;
      const lines = entry.values.map(v => {
        const escaped = v.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        return `  <content contentuid="${v.contentuid}" version="${v.version}">${escaped}</content>`;
      });
      const content = `<?xml version="1.0" encoding="utf-8"?>\n<contentList date="${dateStr}">\n${lines.join("\n")}\n</contentList>`;
      specs.push({ outputPath, content, label: fileName, count: entry.values.length });
    }

    // Auto-generated localization entries from TranslatedString fields
    if (autoLocaEntries.size > 0) {
      const autoLines: string[] = [];
      for (const [handle, { text, version }] of autoLocaEntries) {
        const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        autoLines.push(`  <content contentuid="${handle}" version="${version}">${escaped}</content>`);
      }
      const outputPath = `${modPath}/Localization/English/english.xml`;
      const content = `<?xml version="1.0" encoding="utf-8"?>\n<contentList date="${dateStr}">\n${autoLines.join("\n")}\n</contentList>`;
      specs.push({ outputPath, content, label: "english", count: autoLocaEntries.size });
    }

    return specs;
  });

  /** Osiris goal file spec for DB_RaceTags. */
  let osirisSpec = $derived.by((): { outputPath: string; content: string; label: string; count: number } | null => {
    if (!modPath || !modFolder || osirisGoalEntries.size === 0) return null;

    const pairs = Array.from(osirisGoalEntries.values());
    const content = generateRaceTagGoalFile(pairs);
    if (!content) return null;

    const modName = scanResult?.mod_meta.name ?? modFolder;
    const fileUuid = osirisGoalFileUuid;
    const fileName = `${modName}_NewRace_Tags-${fileUuid}.txt`;

    return {
      outputPath: `${modPath}/Mods/${modFolder}/Story/RawFiles/Goals/${fileName}`,
      content,
      label: fileName.replace('.txt', ''),
      count: pairs.length,
    };
  });

  /** Total file count for the export. */
  let totalFiles = $derived(lsxFileSpecs.specs.length + locaSpecs.length + (osirisSpec ? 1 : 0));

  /** Shorten a path to just the relative portion under modPath. */
  function relativePath(fullPath: string): string {
    if (!modPath) return fullPath;
    const prefix = modPath.replace(/\\/g, "/");
    const normalized = fullPath.replace(/\\/g, "/");
    if (normalized.startsWith(prefix)) {
      return normalized.slice(prefix.length + 1);
    }
    return fullPath;
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function handleExport(): Promise<void> {
    if (!scanResult || !modPath) return;
    exporting = true;
    exportErrors = [];
    exportFileErrors = {};

    try {
      const result = await exportMod(
        lsxFileSpecs.specs,
        null,
        null,
        backup,
      );

      // Write localization XML files
      for (const spec of locaSpecs) {
        try {
          await saveConfig(spec.content, spec.outputPath, backup);
          result.files.push({ path: spec.outputPath, entry_count: spec.count, bytes_written: spec.content.length, backed_up: backup });
        } catch (e) {
          const key = spec.outputPath;
          if (!result.file_errors[key]) result.file_errors[key] = [];
          result.file_errors[key].push(getErrorMessage(e));
        }
      }

      // Write Osiris goal file
      if (osirisSpec) {
        try {
          await saveConfig(osirisSpec.content, osirisSpec.outputPath, backup);
          result.files.push({
            path: osirisSpec.outputPath,
            entry_count: osirisSpec.count,
            bytes_written: osirisSpec.content.length,
            backed_up: backup,
          });
        } catch (e) {
          const key = osirisSpec.outputPath;
          if (!result.file_errors[key]) result.file_errors[key] = [];
          result.file_errors[key].push(getErrorMessage(e));
        }
      }

      exportedCount = result.files.length;
      exportErrors = result.errors;
      exportFileErrors = result.file_errors;

      // Package as .pak if enabled
      if (pakEnabled && modPath) {
        try {
          const pakResult = await packageMod({
            modPath,
            outputPath: pakOutputPath || `${modFolder}.pak`,
            priority: pakPriority,
            compression: pakCompression,
            compressionLevel: pakLevel,
          });
          toastStore.success(
            m.export_pak_success({ modName: modFolder, fileCount: String(pakResult.file_count), size: formatBytes(pakResult.total_bytes) }),
            "",
          );
        } catch (e) {
          exportErrors = [...exportErrors, m.export_pak_error({ error: getErrorMessage(e) })];
        }
      }

      exportDone = true;

      const totalErrorCount = result.errors.length + Object.values(result.file_errors).reduce((n, arr) => n + arr.length, 0);

      if (totalErrorCount === 0) {
        projectStore.markClean();
        toastStore.registerToastAction(
          "open-export-dir",
          () => { openPath(modPath!).catch(console.error); },
        );
        toastStore.success(
          m.export_mod_toast_success_title(),
          `${result.files.length} file${result.files.length === 1 ? "" : "s"} written`,
          {
            label: m.export_mod_open_folder(),
            actionId: "open-export-dir",
          },
        );
      } else {
        toastStore.warning(
          m.export_mod_toast_warning_title(),
          `${result.files.length} written, ${totalErrorCount} error${totalErrorCount === 1 ? "" : "s"}`,
        );
      }
    } catch (e) {
      exportErrors = [getErrorMessage(e)];
      exportDone = true;
      toastStore.error(m.export_mod_toast_error_title(), getErrorMessage(e));
    } finally {
      exporting = false;
    }
  }
</script>

<div
  class="fixed inset-0 bg-[var(--th-modal-backdrop)] z-[60] flex items-center justify-center p-4"
  onclick={onclose}
  onkeydown={(e) => e.key === "Escape" && onclose()}
  role="presentation"
>
  <div
    class="bg-[var(--th-bg-800)] border border-[var(--th-border-700)] rounded-lg shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.key === "Escape" && onclose()}
    role="dialog"
    aria-modal="true"
    aria-labelledby="export-modal-title"
    tabindex="-1"
    use:focusTrap
  >
    <!-- Header -->
    <div class="px-5 py-4 border-b border-[var(--th-border-700)] flex items-center gap-3">
      <FolderOutput size={18} class="text-sky-400" />
      <h3 id="export-modal-title" class="text-sm font-bold text-[var(--th-text-100)]">
        {m.export_mod_title()}
      </h3>
      <span class="ml-auto text-xs text-[var(--th-text-500)]">
        {totalFiles} file{totalFiles === 1 ? "" : "s"}
      </span>
    </div>

    <!-- File list -->
    <div class="flex-1 overflow-y-auto px-5 py-3 space-y-1">
      {#if !exportDone}
        <!-- LSX files -->
        {#each lsxFileSpecs.specs as spec}
          <div class="flex items-center gap-2 py-1.5 text-xs">
            <FileText size={14} class="text-emerald-400 shrink-0" />
            <span class="text-[var(--th-text-200)] truncate flex-1" title={spec.output_path}>
              {relativePath(spec.output_path)}
            </span>
            <span class="text-[var(--th-text-500)] shrink-0">
              {spec.entries.length} {spec.entries.length === 1 ? m.export_mod_entry_label() : m.export_mod_entries_label()}
            </span>
          </div>
        {/each}

        <!-- Localization files -->
        {#each locaSpecs as loca}
          <div class="flex items-center gap-2 py-1.5 text-xs">
            <Languages size={14} class="text-orange-400 shrink-0" />
            <span class="text-[var(--th-text-200)] truncate flex-1" title={loca.outputPath}>
              {relativePath(loca.outputPath)}
            </span>
            <span class="text-[var(--th-text-500)] shrink-0">
              {loca.count} {loca.count === 1 ? m.export_mod_entry_label() : m.export_mod_entries_label()}
            </span>
          </div>
        {/each}

        <!-- Osiris goal file -->
        {#if osirisSpec}
          <div class="flex items-center gap-2 py-1.5 text-xs">
            <ScrollText size={14} class="text-violet-400 shrink-0" />
            <span class="text-[var(--th-text-200)] truncate flex-1" title={osirisSpec.outputPath}>
              {relativePath(osirisSpec.outputPath)}
            </span>
            <span class="text-[var(--th-text-500)] shrink-0">
              {osirisSpec.count} race tag {osirisSpec.count === 1 ? m.export_mod_race_tag_pair() : m.export_mod_race_tag_pairs()}
            </span>
          </div>
        {/if}

        <!-- Packaging section -->
        <div class="border-t border-[var(--th-border-700)] mt-3 pt-3">
          <label class="flex items-center gap-2 text-xs text-[var(--th-text-200)] cursor-pointer select-none">
            <input
              type="checkbox"
              bind:checked={pakEnabled}
              class="rounded border-[var(--th-border-600)] bg-[var(--th-input-bg,#27272a)] accent-sky-500"
            />
            <Package size={14} class="text-amber-400" />
            {m.export_pak_toggle()}
          </label>

          {#if pakEnabled}
            <div class="mt-2 space-y-2 pl-6">
              <div>
                <label for="pak-output-path" class="block text-[10px] text-[var(--th-text-500)] mb-0.5">{m.export_pak_output_path()}</label>
                <input
                  id="pak-output-path"
                  type="text"
                  bind:value={pakOutputPath}
                  class="w-full text-xs px-2 py-1 rounded bg-[var(--th-input-bg,#27272a)] border border-[var(--th-border-600)] text-[var(--th-text-200)] focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                  placeholder="{modFolder}.pak"
                />
              </div>

              <div class="flex gap-3">
                <div class="flex-1">
                  <label for="pak-compression" class="block text-[10px] text-[var(--th-text-500)] mb-0.5">{m.export_pak_compression()}</label>
                  <select
                    id="pak-compression"
                    bind:value={pakCompression}
                    class="w-full text-xs px-2 py-1 rounded bg-[var(--th-input-bg,#27272a)] border border-[var(--th-border-600)] text-[var(--th-text-200)] focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                  >
                    <option value="lz4">LZ4</option>
                    <option value="zlib">Zlib</option>
                    <option value="none">None</option>
                  </select>
                </div>

                <div class="flex-1">
                  <label for="pak-level" class="block text-[10px] text-[var(--th-text-500)] mb-0.5">{m.export_pak_level()}</label>
                  <select
                    id="pak-level"
                    bind:value={pakLevel}
                    disabled={pakCompression === "none"}
                    class="w-full text-xs px-2 py-1 rounded bg-[var(--th-input-bg,#27272a)] border border-[var(--th-border-600)] text-[var(--th-text-200)] disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                  >
                    <option value="default">Default</option>
                    <option value="fast">Fast</option>
                    <option value="max">Max</option>
                  </select>
                </div>

                <div class="w-16">
                  <label for="pak-priority" class="block text-[10px] text-[var(--th-text-500)] mb-0.5" title={m.export_pak_priority_tooltip()}>{m.export_pak_priority()}</label>
                  <input
                    id="pak-priority"
                    type="number"
                    bind:value={pakPriority}
                    min="0"
                    max="255"
                    class="w-full text-xs px-2 py-1 rounded bg-[var(--th-input-bg,#27272a)] border border-[var(--th-border-600)] text-[var(--th-text-200)] focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                  />
                </div>
              </div>
            </div>
          {/if}
        </div>

        {#if totalFiles === 0}
          <p class="text-xs text-[var(--th-text-500)] text-center py-4">
            {m.export_mod_no_files()}
          </p>
        {/if}
      {:else}
        <!-- Export results -->
        <div class="space-y-2">
          {#if exportedCount > 0}
            <div class="flex items-center gap-2 text-xs text-emerald-400">
              <Check size={14} />
              <span>{exportedCount} file{exportedCount === 1 ? "" : "s"} exported successfully</span>
            </div>
          {/if}
          {#if exportErrors.length > 0 || Object.keys(exportFileErrors).length > 0}
            <div class="space-y-2">
              {#each Object.entries(exportFileErrors) as [filePath, errs]}
                <div class="space-y-0.5">
                  <div class="text-xs text-[var(--th-text-300)] font-medium truncate" title={filePath}>
                    {relativePath(filePath)}
                  </div>
                  {#each errs as err}
                    <div class="flex items-start gap-2 text-xs text-red-400 pl-2">
                      <X size={14} class="shrink-0 mt-0.5" />
                      <span>{err}</span>
                    </div>
                  {/each}
                </div>
              {/each}
              {#each exportErrors as err}
                <div class="flex items-start gap-2 text-xs text-red-400">
                  <X size={14} class="shrink-0 mt-0.5" />
                  <span>{err}</span>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Footer -->
    <div class="px-5 py-3 border-t border-[var(--th-border-700)] flex items-center gap-3">
      {#if !exportDone}
        <!-- Backup toggle -->
        <label class="flex items-center gap-1.5 text-xs text-[var(--th-text-300)] cursor-pointer select-none">
          <input
            type="checkbox"
            bind:checked={backup}
            class="rounded border-[var(--th-border-600)] bg-[var(--th-input-bg,#27272a)] accent-sky-500"
          />
          {m.export_mod_backup_checkbox()}
        </label>

        <span class="flex-1"></span>

        <button
          class="px-4 py-1.5 text-xs rounded bg-[var(--th-bg-700)] text-[var(--th-text-300)] hover:opacity-80 transition-colors"
          onclick={onclose}
        >{m.common_cancel()}</button>

        <button
          class="px-4 py-1.5 text-xs rounded bg-sky-600 text-white hover:bg-sky-500 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          disabled={exporting || totalFiles === 0}
          onclick={handleExport}
        >
          {#if exporting}
            <Loader2 size={12} class="animate-spin" /> {m.export_mod_button_exporting()}
          {:else}
            <FolderOutput size={12} /> Export {totalFiles} file{totalFiles === 1 ? "" : "s"}
          {/if}
        </button>
      {:else}
        <span class="flex-1"></span>
        <button
          class="px-4 py-1.5 text-xs rounded bg-sky-600 text-white hover:bg-sky-500 transition-colors"
          onclick={onclose}
        >{m.common_done()}</button>
      {/if}
    </div>
  </div>
</div>
