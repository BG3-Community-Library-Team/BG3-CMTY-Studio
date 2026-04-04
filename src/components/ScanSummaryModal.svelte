<script lang="ts">
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import { configStore } from "../lib/stores/configStore.svelte.js";
  import { SECTION_DISPLAY_NAMES, SECTIONS_ORDERED } from "../lib/types/index.js";
  import type { Section, ScanResult, DiffEntry, Change } from "../lib/types/index.js";
  import { focusTrap } from "../lib/utils/focusTrap.js";
  import Info from "@lucide/svelte/icons/info";
  import { m } from "../paraglide/messages.js";

  let { onclose }: { onclose: () => void } = $props();

  const result: ScanResult | null = modStore.scanResult;

  /** Per-section summary stats */
  let sectionStats = $derived.by(() => {
    if (!result) return [];
    return SECTIONS_ORDERED.map(section => {
      const sec = result.sections.find(s => s.section === section);
      const autoCount = sec?.entries.length ?? 0;
      const importedCount = configStore.manualEntries.filter(e => e.section === section && e.imported).length;
      const manualCount = configStore.manualEntries.filter(e => e.section === section && !e.imported).length;
      return { section, autoCount, importedCount, manualCount };
    }).filter(s => s.autoCount > 0 || s.importedCount > 0 || s.manualCount > 0);
  });

  let totalAuto = $derived(sectionStats.reduce((s, x) => s + x.autoCount, 0));
  let totalImported = $derived(sectionStats.reduce((s, x) => s + x.importedCount, 0));
  let totalManual = $derived(sectionStats.reduce((s, x) => s + x.manualCount, 0));
  let totalSections = $derived(sectionStats.length);
  let hasExistingConfig = $derived(!!result?.existing_config_path);

  /** Fingerprint a set of changes for comparison — includes mod_value for Changed entries */
  function changesFingerprint(changes: Change[]): string {
    return changes
      .map(c => `${c.change_type}:${c.field}:${c.mod_value ?? ""}:[${c.added_values.join(",")}]:[${c.removed_values.join(",")}]`)
      .sort()
      .join("|");
  }

  /** Merge suggestions: entries with same changes but different UUIDs.
   *  Skips EntireEntryNew entries — their changes are trivially unique per entry. */
  let sameChangesSuggestions = $derived.by(() => {
    if (!result) return [];
    const suggestions: { section: string; fingerprint: string; uuids: string[]; displayNames: string[] }[] = [];

    for (const sec of result.sections) {
      const byFingerprint = new Map<string, DiffEntry[]>();
      for (const entry of sec.entries) {
        // Skip new entries — they have attribute-level changes that are always unique per entry
        if (entry.entry_kind === "New") continue;
        const fp = changesFingerprint(entry.changes);
        if (!fp) continue; // skip entries with no changes
        const group = byFingerprint.get(fp) ?? [];
        group.push(entry);
        byFingerprint.set(fp, group);
      }
      for (const [fp, group] of byFingerprint) {
        if (group.length >= 2) {
          suggestions.push({
            section: sec.section,
            fingerprint: fp,
            uuids: group.map(e => e.uuid),
            displayNames: group.map(e => e.display_name || e.uuid.slice(0, 8)),
          });
        }
      }
    }
    return suggestions;
  });

  /** Merge suggestions: same UUID with different changes (from imported + auto) */
  let sameUuidSuggestions = $derived.by(() => {
    if (!result) return [];
    const suggestions: { section: string; uuid: string; autoChanges: number; importedFields: number }[] = [];

    const importedByKey = new Map<string, Record<string, string>>();
    for (const imp of configStore.manualEntries.filter(e => e.imported)) {
      const uuid = imp.fields["UUID"];
      if (uuid) importedByKey.set(`${imp.section}::${uuid}`, imp.fields);
    }

    for (const sec of result.sections) {
      for (const entry of sec.entries) {
        const key = `${sec.section}::${entry.uuid}`;
        const impFields = importedByKey.get(key);
        if (impFields) {
          // Both auto and imported exist for the same UUID — check if imports add new fields
          const autoFieldSet = new Set(entry.changes.map(c => c.field));
          const impFieldCount = Object.keys(impFields).filter(k => k !== "UUID" && !autoFieldSet.has(k)).length;
          if (impFieldCount > 0) {
            suggestions.push({
              section: sec.section,
              uuid: entry.uuid,
              autoChanges: entry.changes.length,
              importedFields: impFieldCount,
            });
          }
        }
      }
    }
    return suggestions;
  });

  /** Recommendations for the user */
  let recommendations = $derived.by(() => {
    const tips: string[] = [];

    if (totalAuto === 0 && totalImported === 0) {
      tips.push(m.scan_summary_no_entries_help());
    }

    if (hasExistingConfig && totalImported > 0) {
      tips.push(`Imported ${totalImported} entries from the existing config file. Review them in each section panel — they're marked with an IMP badge.`);
    }

    if (totalAuto > 0) {
      tips.push(m.scan_summary_auto_detected_entries());
    }

    // Check for new entries (EntireEntryNew)
    const newEntryCount = result?.sections.reduce((sum, sec) =>
      sum + sec.entries.filter(e => e.entry_kind === "New").length, 0
    ) ?? 0;
    if (newEntryCount > 0) {
      tips.push(`${newEntryCount} entirely new ${newEntryCount === 1 ? 'entry' : 'entries'} detected (not present in vanilla). These will be added as new config entries.`);
    }

    // Merge suggestions
    if (sameChangesSuggestions.length > 0) {
      const total = sameChangesSuggestions.reduce((s, g) => s + g.uuids.length, 0);
      tips.push(`${sameChangesSuggestions.length} group${sameChangesSuggestions.length > 1 ? 's' : ''} of entries (${total} total) share identical changes and could be consolidated using YAML anchors or combined UUID lists.`);
    }
    if (sameUuidSuggestions.length > 0) {
      tips.push(`${sameUuidSuggestions.length} ${sameUuidSuggestions.length === 1 ? 'entry has' : 'entries have'} both auto-detected and imported changes on the same UUID. The imported version may extend or override the auto-detected one — review these entries carefully.`);
    }

    return tips;
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") onclose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-[var(--th-modal-backdrop)]"
  role="presentation"
>
  <!-- Click-outside-to-close backdrop -->
  <div class="absolute inset-0" onclick={onclose} role="presentation"></div>
  <!-- Panel -->
  <div
    class="modal-panel relative z-10 bg-[var(--th-bg-900)] border border-[var(--th-border-700)] rounded-lg shadow-2xl w-[520px] max-h-[80vh] flex flex-col"
    role="dialog"
    aria-modal="true"
    aria-label={m.scan_summary_title()}
    use:focusTrap
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-5 py-3 border-b border-[var(--th-border-700)]">
      <h2 class="text-base font-bold text-[var(--th-text-100)]">{m.scan_summary_title()}</h2>
      <button
        class="text-[var(--th-text-400)] hover:text-[var(--th-text-200)] text-lg leading-none p-2 rounded"
        onclick={onclose}
        aria-label={m.common_close()}
      >&times;</button>
    </div>

    <!-- Body -->
    <div class="px-5 py-4 overflow-y-auto space-y-4">
      <!-- Existing config note (at top for immediate visibility) -->
      {#if hasExistingConfig}
        <div class="flex items-center gap-2 px-3 py-2 rounded bg-[var(--th-info-bg)] border border-[var(--th-info-border)] text-xs text-[var(--th-text-teal-300)]">
          <Info class="w-4 h-4 shrink-0" />
          {m.scan_summary_existing_config_note()}
        </div>
      {/if}

      <!-- Mod info -->
      {#if result}
        <div class="flex items-center gap-3 text-sm">
          <span class="text-[var(--th-text-400)]">{m.scan_summary_mod_label()}</span>
          <span class="font-semibold text-[var(--th-text-100)]">{result.mod_meta.name || result.mod_meta.folder}</span>
          {#if result.mod_meta.author}
            <span class="text-[var(--th-text-500)]">{m.scan_summary_mod_by({ author: result.mod_meta.author })}</span>
          {/if}
        </div>
      {/if}

      <!-- Totals row -->
      <div class="flex gap-4 text-sm">
        <div class="flex items-center gap-1.5">
          <span class="inline-block w-2 h-2 rounded-full bg-sky-500"></span>
          <span class="text-[var(--th-text-300)]">{totalAuto} {m.scan_summary_legend_auto()}</span>
        </div>
        {#if totalImported > 0}
          <div class="flex items-center gap-1.5">
            <span class="inline-block w-2 h-2 rounded-full bg-teal-500"></span>
            <span class="text-[var(--th-text-300)]">{totalImported} {m.scan_summary_legend_imported()}</span>
          </div>
        {/if}
        {#if totalManual > 0}
          <div class="flex items-center gap-1.5">
            <span class="inline-block w-2 h-2 rounded-full bg-violet-500"></span>
            <span class="text-[var(--th-text-300)]">{totalManual} {m.scan_summary_legend_manual()}</span>
          </div>
        {/if}
        <div class="ml-auto text-[var(--th-text-500)]">{totalSections} {totalSections === 1 ? 'section' : 'sections'}</div>
      </div>

      <!-- Section breakdown -->
      {#if sectionStats.length > 0}
        <div class="rounded border border-[var(--th-border-700)] overflow-hidden">
          <table class="w-full text-xs">
            <thead>
              <tr class="bg-[var(--th-bg-800)] text-[var(--th-text-400)] text-left">
                <th class="px-3 py-1.5 font-medium">{m.scan_summary_table_section()}</th>
                <th class="px-3 py-1.5 font-medium text-right">{m.scan_summary_table_auto()}</th>
                <th class="px-3 py-1.5 font-medium text-right">{m.scan_summary_table_imp()}</th>
                <th class="px-3 py-1.5 font-medium text-right">{m.scan_summary_table_man()}</th>
              </tr>
            </thead>
            <tbody>
              {#each sectionStats as row}
                <tr class="border-t border-[var(--th-border-700)] hover:bg-[var(--th-bg-800-50)]">
                  <td class="px-3 py-1.5 text-[var(--th-text-200)]">{SECTION_DISPLAY_NAMES[row.section as Section] ?? row.section}</td>
                  <td class="px-3 py-1.5 text-right font-mono {row.autoCount > 0 ? 'text-[var(--th-text-sky-400)]' : 'text-[var(--th-text-500)]'}">{row.autoCount}</td>
                  <td class="px-3 py-1.5 text-right font-mono {row.importedCount > 0 ? 'text-[var(--th-text-teal-300)]' : 'text-[var(--th-text-500)]'}">{row.importedCount}</td>
                  <td class="px-3 py-1.5 text-right font-mono {row.manualCount > 0 ? 'text-violet-400' : 'text-[var(--th-text-500)]'}">{row.manualCount}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p class="text-sm text-[var(--th-text-400)] italic">{m.scan_summary_no_entries()}</p>
      {/if}

      <!-- Recommendations -->
      {#if recommendations.length > 0}
        <div class="space-y-2">
          <h3 class="text-xs font-semibold text-[var(--th-text-400)] uppercase tracking-wide">{m.scan_summary_recommendations()}</h3>
          {#each recommendations as tip}
            <div class="flex gap-2 text-xs text-[var(--th-text-300)] leading-relaxed">
              <span class="text-[var(--th-text-amber-400)] shrink-0 mt-0.5">&#x25B8;</span>
              <span>{tip}</span>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Merge suggestions: same changes, different UUIDs -->
      {#if sameChangesSuggestions.length > 0}
        <div class="space-y-1.5">
          <h3 class="text-xs font-semibold text-[var(--th-text-400)] uppercase tracking-wide">{m.scan_summary_merge_candidates()}</h3>
          {#each sameChangesSuggestions as group}
            <div class="px-3 py-2 rounded bg-sky-900/20 border border-sky-700/30 text-xs">
              <span class="text-[var(--th-text-sky-300,#7dd3fc)] font-medium">{SECTION_DISPLAY_NAMES[group.section as Section] ?? group.section}</span>
              <span class="text-[var(--th-text-400)]"> — {group.uuids.length} entries share identical changes:</span>
              <div class="mt-1 flex flex-wrap gap-1">
                {#each group.displayNames as name}
                  <span class="px-1.5 py-0.5 rounded bg-sky-800/40 text-[var(--th-text-sky-300,#7dd3fc)] font-mono text-xs">{name}</span>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Merge suggestions: same UUID, different changes -->
      {#if sameUuidSuggestions.length > 0}
        <div class="space-y-1.5">
          <h3 class="text-xs font-semibold text-[var(--th-text-400)] uppercase tracking-wide">{m.scan_summary_overlap_heading()}</h3>
          {#each sameUuidSuggestions as overlap}
            <div class="px-3 py-2 rounded bg-amber-900/20 border border-amber-700/30 text-xs">
              <span class="text-[var(--th-text-amber-300,#fcd34d)] font-medium">{SECTION_DISPLAY_NAMES[overlap.section as Section] ?? overlap.section}</span>
              <span class="text-[var(--th-text-400)]"> — UUID <span class="font-mono">{overlap.uuid.slice(0, 8)}…</span> has {overlap.autoChanges} auto change{overlap.autoChanges !== 1 ? 's' : ''} + {overlap.importedFields} extra imported field{overlap.importedFields !== 1 ? 's' : ''}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Footer -->
    <div class="flex justify-end px-5 py-3 border-t border-[var(--th-border-700)]">
      <button
        class="px-4 py-1.5 text-sm font-medium rounded bg-[var(--th-bg-sky-600)] hover:opacity-90 text-white transition-colors"
        onclick={onclose}
      >{m.scan_summary_continue()}</button>
    </div>
  </div>
</div>
