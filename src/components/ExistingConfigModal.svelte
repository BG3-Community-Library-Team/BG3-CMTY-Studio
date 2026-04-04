<script lang="ts">
  import { m } from "../paraglide/messages.js";
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import { readExistingConfig, previewConfig } from "../lib/utils/tauri.js";
  import { highlightYaml, highlightJson } from "../lib/utils/preview.js";
  import { parseExistingConfig } from "../lib/utils/configParser.js";
  import { focusTrap } from "../lib/utils/focusTrap.js";
import { getErrorMessage } from "../lib/types/index.js";
  import X from "@lucide/svelte/icons/x";

  let { onclose }: { onclose: () => void } = $props();

  let content = $state("");
  /** Original loaded content — used as the source for format conversions so that
   *  a failed conversion can never corrupt the content the user sees. */
  let originalContent = $state("");
  let loading = $state(true);
  let format = $state<"yaml" | "json">("yaml");
  let originalFormat = $state<"yaml" | "json">("yaml");
  let copyLabel = $state(m.common_copy());
  /** Banner message shown on conversion failure */
  let conversionError = $state("");

  /** Track active timer IDs for cleanup on component destroy */
  let timerIds: ReturnType<typeof setTimeout>[] = $state([]);

  function trackedTimeout(fn: () => void, ms: number): void {
    const id = setTimeout(() => {
      fn();
      timerIds = timerIds.filter(t => t !== id);
    }, ms);
    timerIds = [...timerIds, id];
  }

  $effect(() => {
    return () => {
      for (const id of timerIds) clearTimeout(id);
    };
  });

  // Load content on mount
  $effect(() => {
    const path = modStore.scanResult?.existing_config_path;
    if (!path) { loading = false; return; }
    loading = true;
    readExistingConfig(path)
      .then(c => {
        content = c;
        originalContent = c;
        const detectedFormat = path.endsWith(".json") ? "json" as const : "yaml" as const;
        format = detectedFormat;
        originalFormat = detectedFormat;
      })
      .catch(e => { content = `Failed to load: ${getErrorMessage(e)}`; })
      .finally(() => { loading = false; });
  });

  async function convertFormat(): Promise<void> {
    conversionError = "";
    const targetFormat = format === "yaml" ? "json" as const : "yaml" as const;
    try {
      const { entries, warnings } = parseExistingConfig(originalContent, `config.${originalFormat}`);
      if (warnings.length > 0) console.warn("Config parse warnings:", warnings);
      content = await previewConfig([], entries, {}, targetFormat, false, false, false);
      originalContent = content;
      originalFormat = targetFormat;
      format = targetFormat;
    } catch (e) {
      conversionError = m.existing_config_conversion_error({ error: getErrorMessage(e) });
    }
  }

  async function copyToClipboard(): Promise<void> {
    try {
      await navigator.clipboard.writeText(content);
      copyLabel = m.common_copied();
      trackedTimeout(() => { copyLabel = m.common_copy(); }, 1500);
    } catch {
      copyLabel = m.common_copy_failed();
      trackedTimeout(() => { copyLabel = m.common_copy(); }, 1500);
    }
  }

  let highlightedHtml = $derived(
    content
      ? format === "yaml"
        ? highlightYaml(content)
        : highlightJson(content)
      : ""
  );
</script>

<svelte:window onkeydown={(e: KeyboardEvent) => { if (e.key === 'Escape') onclose(); }} />

<!-- Modal backdrop -->
<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-[var(--th-modal-backdrop)]"
  role="presentation"
>
  <div class="absolute inset-0" onclick={onclose} role="presentation"></div>
  <div
    class="modal-panel relative z-10 w-[640px] max-h-[80vh] flex flex-col bg-[var(--th-bg-900)] border border-[var(--th-border-700)] rounded-lg shadow-2xl"
    role="dialog"
    aria-modal="true"
    aria-label={m.existing_config_title()}
    use:focusTrap
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--th-border-700)]">
      <h3 class="text-sm font-semibold text-[var(--th-text-200)]">{m.existing_config_title()}</h3>
      <div class="flex items-center gap-2">
        <button
          class="px-2.5 py-1 text-xs rounded bg-[var(--th-bg-700)] text-[var(--th-text-300)] hover:opacity-80"
          onclick={convertFormat}
          title="Convert between YAML and JSON"
        >
          {m.existing_config_convert_to({ format: format === "yaml" ? "JSON" : "YAML" })}
        </button>
        <button
          class="px-2.5 py-1 text-xs rounded bg-[var(--th-bg-sky-600)] text-white hover:opacity-90"
          onclick={copyToClipboard}
        >
          {copyLabel}
        </button>
        <button
          class="text-[var(--th-text-400)] hover:text-[var(--th-text-200)] text-sm px-1"
          onclick={onclose}
          aria-label={m.common_close()}
        ><X size={14} /></button>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-auto p-4 scrollbar-thin">
      {#if conversionError}
        <div class="mb-3 px-3 py-2 rounded bg-red-900/60 border border-red-700 text-red-200 text-xs">
          {conversionError}
        </div>
      {/if}
      {#if loading}
        <p class="text-xs text-[var(--th-text-500)] text-center py-8" role="status" aria-live="polite">{m.common_loading()}</p>
      {:else if highlightedHtml}
        <pre class="text-xs leading-relaxed font-mono whitespace-pre-wrap break-words text-[var(--th-text-300)]">{@html highlightedHtml}</pre>
      {:else}
        <pre class="text-xs leading-relaxed font-mono whitespace-pre-wrap break-words text-[var(--th-text-300)]">{content}</pre>
      {/if}
    </div>

    <!-- Footer info -->
    <div class="px-4 py-2 border-t border-[var(--th-border-700)] text-xs text-[var(--th-text-500)]">
      {modStore.scanResult?.existing_config_path ?? ""}
      <span class="ml-2 uppercase">{format}</span>
    </div>
  </div>
</div>
