<!--
  PreExportValidation: Shows pre-export validation results grouped by handler.
  Errors block the export; warnings allow proceeding; info items are collapsed.
-->
<script lang="ts">
  import { focusTrap } from "../lib/utils/focusTrap.js";
  import { m } from "../paraglide/messages.js";
  import type { HandlerWarning } from "../lib/tauri/save.js";
  import CircleAlert from "@lucide/svelte/icons/circle-alert";
  import AlertTriangle from "@lucide/svelte/icons/alert-triangle";
  import Info from "@lucide/svelte/icons/info";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";

  let {
    warnings,
    oncontinue,
    oncancel,
    onretry,
  }: {
    warnings: HandlerWarning[];
    oncontinue: () => void;
    oncancel: () => void;
    onretry: () => void;
  } = $props();

  // Group warnings by handler_name
  let grouped = $derived.by(() => {
    const map = new Map<string, HandlerWarning[]>();
    for (const w of warnings) {
      const list = map.get(w.handler_name) ?? [];
      list.push(w);
      map.set(w.handler_name, list);
    }
    return map;
  });

  let errorCount = $derived(warnings.filter(w => w.severity === "Error").length);
  let warningCount = $derived(warnings.filter(w => w.severity === "Warning").length);
  let infoCount = $derived(warnings.filter(w => w.severity === "Info").length);
  let hasErrors = $derived(errorCount > 0);

  // Track collapsed state for info sections (collapsed by default)
  let infoCollapsed: Record<string, boolean> = $state({});

  function toggleInfoSection(handler: string) {
    infoCollapsed[handler] = !infoCollapsed[handler];
  }

  function isInfoCollapsed(handler: string): boolean {
    return infoCollapsed[handler] !== false; // collapsed by default
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") { e.preventDefault(); oncancel(); }
  }

  function severityIcon(severity: string) {
    switch (severity) {
      case "Error": return CircleAlert;
      case "Warning": return AlertTriangle;
      default: return Info;
    }
  }

  function severityColor(severity: string): string {
    switch (severity) {
      case "Error": return "text-red-400";
      case "Warning": return "text-amber-400";
      default: return "text-[var(--th-text-400)]";
    }
  }

  function severityBgColor(severity: string): string {
    switch (severity) {
      case "Error": return "border-red-700/60 bg-red-900/20";
      case "Warning": return "border-amber-700/60 bg-amber-900/20";
      default: return "border-[var(--th-border-700)] bg-[var(--th-bg-950)]";
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-[var(--th-modal-backdrop)]"
  role="presentation"
>
  <div class="absolute inset-0" onclick={oncancel} role="presentation"></div>
  <div
    class="modal-panel relative z-10 bg-[var(--th-bg-900)] border border-[var(--th-border-700)] rounded-lg shadow-2xl w-[560px] max-h-[80vh] flex flex-col"
    role="dialog"
    aria-modal="true"
    aria-labelledby="validation-title"
    use:focusTrap
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-5 py-3 border-b border-[var(--th-border-700)]">
      <h2 id="validation-title" class="text-base font-bold text-[var(--th-text-100)]">
        {m.pre_export_validation_title()}
      </h2>
      <button
        class="text-[var(--th-text-400)] hover:text-[var(--th-text-200)] text-lg leading-none p-2 rounded"
        onclick={oncancel}
        aria-label={m.common_close()}
      >&times;</button>
    </div>

    <!-- Summary bar -->
    <div class="px-5 py-2 flex items-center gap-4 border-b border-[var(--th-border-700)] text-xs">
      {#if errorCount > 0}
        <span class="flex items-center gap-1 text-red-400">
          <CircleAlert size={12} />
          {m.pre_export_validation_error_count({ count: errorCount })}
        </span>
      {/if}
      {#if warningCount > 0}
        <span class="flex items-center gap-1 text-amber-400">
          <AlertTriangle size={12} />
          {m.pre_export_validation_warning_count({ count: warningCount })}
        </span>
      {/if}
      {#if infoCount > 0}
        <span class="flex items-center gap-1 text-[var(--th-text-400)]">
          <Info size={12} />
          {m.pre_export_validation_info_count({ count: infoCount })}
        </span>
      {/if}
    </div>

    <!-- Body -->
    <div class="px-5 py-4 overflow-y-auto space-y-3 scrollbar-thin flex-1">
      {#if warnings.length === 0}
        <p class="text-sm text-[var(--th-text-400)]">{m.validation_summary_no_issues()}</p>
      {:else}
        {#each [...grouped] as [handler, items] (handler)}
          <div class="space-y-1.5">
            <h3 class="text-xs font-semibold text-[var(--th-text-300)] uppercase tracking-wide">{handler}</h3>
            {#each items as item}
              {#if item.severity === "Info"}
                <!-- Info items: collapsible, collapsed by default -->
                {#if items.filter(i => i.severity === "Info").indexOf(item) === 0}
                  <button
                    class="flex items-center gap-1 text-xs text-[var(--th-text-400)] hover:text-[var(--th-text-200)] py-0.5"
                    onclick={() => toggleInfoSection(handler)}
                  >
                    {#if isInfoCollapsed(handler)}
                      <ChevronRight size={12} />
                    {:else}
                      <ChevronDown size={12} />
                    {/if}
                    {m.pre_export_validation_info_count({ count: items.filter(i => i.severity === "Info").length })}
                  </button>
                  {#if !isInfoCollapsed(handler)}
                    {#each items.filter(i => i.severity === "Info") as infoItem}
                      <div class="rounded border {severityBgColor('Info')} p-2 ml-4">
                        <div class="flex items-start gap-2">
                          <Info size={12} class="mt-0.5 shrink-0 text-[var(--th-text-400)]" />
                          <p class="text-xs text-[var(--th-text-300)]">{infoItem.message}</p>
                        </div>
                      </div>
                    {/each}
                  {/if}
                {/if}
              {:else}
                <div class="rounded border {severityBgColor(item.severity)} p-2">
                  <div class="flex items-start gap-2">
                    {#if item.severity === "Error"}
                      <CircleAlert size={12} class="mt-0.5 shrink-0 text-red-400" />
                    {:else}
                      <AlertTriangle size={12} class="mt-0.5 shrink-0 text-amber-400" />
                    {/if}
                    <p class="text-xs {severityColor(item.severity)}">{item.message}</p>
                  </div>
                </div>
              {/if}
            {/each}
          </div>
        {/each}
      {/if}
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--th-border-700)]">
      <button
        class="px-3 py-1.5 text-xs rounded border border-[var(--th-border-700)] text-[var(--th-text-300)] hover:text-[var(--th-text-100)] hover:bg-[var(--th-bg-800)]"
        onclick={oncancel}
      >
        {m.common_cancel()}
      </button>
      {#if hasErrors}
        <button
          class="px-3 py-1.5 text-xs rounded bg-red-600 hover:bg-red-500 text-white font-medium"
          onclick={onretry}
        >
          {m.pre_export_validation_fix_and_retry()}
        </button>
      {:else}
        <button
          class="px-3 py-1.5 text-xs rounded bg-[var(--th-accent-600)] hover:bg-[var(--th-accent-500)] text-white font-medium"
          onclick={oncontinue}
        >
          {m.pre_export_validation_continue_anyway()}
        </button>
      {/if}
    </div>
  </div>
</div>
