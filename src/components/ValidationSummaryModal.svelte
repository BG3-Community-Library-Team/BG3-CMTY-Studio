<!--
  ValidationSummaryModal: Lists all validation errors and warnings grouped by section.
  Each row shows section name, entry display name, and issue description.
  Clicking an entry scrolls the main panel to that entry.
-->
<script lang="ts">
  import { SECTION_DISPLAY_NAMES, type Section } from "../lib/types/index.js";
  import { focusTrap } from "../lib/utils/focusTrap.js";
  import { m } from "../paraglide/messages.js";
  import { tick } from "svelte";
  import TagBadge from "./TagBadge.svelte";

  let { onclose }: { onclose: () => void } = $props();

  // TODO: Wire validation summary from projectStore when validation engine is migrated
  const validationSummary = { errorCount: 0, warningCount: 0, errors: [] as IssueItem[], warnings: [] as IssueItem[] };

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") { e.preventDefault(); onclose(); }
  }

  type IssueItem = { section: string; uuid: string; displayName: string; message: string };

  /** Group issues by section, preserving order of appearance */
  function groupBySection(items: IssueItem[]): { section: string; label: string; items: IssueItem[] }[] {
    const map = new Map<string, IssueItem[]>();
    for (const item of items) {
      const group = map.get(item.section) ?? [];
      group.push(item);
      map.set(item.section, group);
    }
    return Array.from(map, ([section, items]) => ({
      section,
      label: SECTION_DISPLAY_NAMES[section as Section] ?? section,
      items,
    }));
  }

  let errorGroups = $derived(groupBySection(validationSummary.errors));
  let warningGroups = $derived(groupBySection(validationSummary.warnings));

  async function jumpToEntry(section: string, uuid: string) {
    onclose();
    await tick();
    const el = document.querySelector(`[data-entry-id="${CSS.escape(section)}:${CSS.escape(uuid)}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-[var(--th-modal-backdrop)]"
  role="presentation"
>
  <div class="absolute inset-0" onclick={onclose} role="presentation"></div>
  <div
    class="modal-panel relative z-10 bg-[var(--th-bg-900)] border border-[var(--th-border-700)] rounded-lg shadow-2xl w-[520px] max-h-[80vh] flex flex-col"
    role="dialog"
    aria-modal="true"
    aria-label={m.validation_summary_title()}
    use:focusTrap
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-5 py-3 border-b border-[var(--th-border-700)]">
      <h2 class="text-base font-bold text-[var(--th-text-100)]">{m.validation_summary_title()}</h2>
      <button
        class="text-[var(--th-text-400)] hover:text-[var(--th-text-200)] text-lg leading-none p-2 rounded"
        onclick={onclose}
        aria-label={m.common_close()}
      >&times;</button>
    </div>

    <!-- Body -->
    <div class="px-5 py-4 overflow-y-auto space-y-4">
      {#if validationSummary.errorCount === 0 && validationSummary.warningCount === 0}
        <p class="text-sm text-[var(--th-text-400)]">{m.validation_summary_no_issues()}</p>
      {/if}

      {#if errorGroups.length > 0}
        <div>
          <h3 class="text-sm font-semibold text-red-400 mb-2">
            {m.validation_summary_errors_heading({ count: validationSummary.errorCount })}
          </h3>
          {#each errorGroups as group (group.section)}
            <div class="mb-3">
              <div class="text-xs font-medium text-[var(--th-text-300)] mb-1">{group.label}</div>
              {#each group.items as item (item.uuid + item.message)}
                <button
                  class="w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs rounded
                         hover:bg-[var(--th-bg-800)] transition-colors group"
                  onclick={() => jumpToEntry(item.section, item.uuid)}
                  type="button"
                >
                  <TagBadge tag="ERR" />
                  <span class="text-[var(--th-text-200)] truncate max-w-[140px]">{item.displayName}</span>
                  <span class="text-[var(--th-text-500)] truncate flex-1">{item.message}</span>
                </button>
              {/each}
            </div>
          {/each}
        </div>
      {/if}

      {#if warningGroups.length > 0}
        <div>
          <h3 class="text-sm font-semibold text-amber-400 mb-2">
            {m.validation_summary_warnings_heading({ count: validationSummary.warningCount })}
          </h3>
          {#each warningGroups as group (group.section)}
            <div class="mb-3">
              <div class="text-xs font-medium text-[var(--th-text-300)] mb-1">{group.label}</div>
              {#each group.items as item (item.uuid + item.message)}
                <button
                  class="w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs rounded
                         hover:bg-[var(--th-bg-800)] transition-colors group"
                  onclick={() => jumpToEntry(item.section, item.uuid)}
                  type="button"
                >
                  <TagBadge tag="WARN" />
                  <span class="text-[var(--th-text-200)] truncate max-w-[140px]">{item.displayName}</span>
                  <span class="text-[var(--th-text-500)] truncate flex-1">{item.message}</span>
                </button>
              {/each}
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Footer -->
    <div class="flex justify-end px-5 py-3 border-t border-[var(--th-border-700)]">
      <button
        class="px-3 py-1.5 text-xs rounded bg-[var(--th-bg-800)] text-[var(--th-text-200)] hover:bg-[var(--th-bg-700)] transition-colors"
        onclick={onclose}
        type="button"
      >{m.common_close()}</button>
    </div>
  </div>
</div>
