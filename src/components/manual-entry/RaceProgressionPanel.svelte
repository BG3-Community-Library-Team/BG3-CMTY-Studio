<script lang="ts">
  import { projectStore, sectionToTable } from "../../lib/stores/projectStore.svelte.js";
  import type { EntryRow } from "../../lib/types/entryRow.js";
  import { modStore } from "../../lib/stores/modStore.svelte.js";
  import { parseRawSelectors } from "../../lib/utils/selectorParser.js";
  import { encodeSelectors } from "../../lib/utils/fieldCodec.js";
  import { emptyParams, type SelectorParamValues } from "../../lib/data/selectorDefs.js";
  import type { ComboboxOption } from "../../lib/utils/comboboxOptions.js";
  import FormSelectors from "./FormSelectors.svelte";
  import MultiSelectCombobox from "../MultiSelectCombobox.svelte";
  import Plus from "@lucide/svelte/icons/plus";
  import X from "@lucide/svelte/icons/x";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import { tooltip } from "../../lib/actions/tooltip.js";
  import { generateUuid } from "../../lib/utils/uuid.js";

  let {
    raceUuid,
    progressionTableUuid,
    passiveOptions = [],
  }: {
    raceUuid: string;
    progressionTableUuid: string;
    passiveOptions?: ComboboxOption[];
  } = $props();

  interface SelectorSubItem {
    action: string;
    fn: string;
    selectorUuid: string;
    overwrite: boolean;
    modGuid: string;
    isReplace: boolean;
    params: SelectorParamValues;
  }

  interface ProgressionSubform {
    id: string;
    existingPk?: string;
    level: string;
    name: string;
    boosts: string;
    passivesAdded: string;
    passivesRemoved: string;
    allowImprovement: boolean;
    selectors: SelectorSubItem[];
    markedForDeletion: boolean;
  }

  let subforms: ProgressionSubform[] = $state([]);
  let initialized = $state(false);

  /** Load existing race progressions from the store on first render */
  $effect(() => {
    if (initialized) return;
    if (!progressionTableUuid) { initialized = true; return; }

    // 1. Manual entries (user-created / imported) from staging DB
    const manualUuids = new Set<string>();
    const progEntries = projectStore.getEntries(sectionToTable('Progressions'));
    const existing = progEntries.filter(e => {
      const tableUuid = String(e.TableUUID ?? '');
      const progType = String(e.ProgressionType ?? '');
      const raceRef = String(e.RaceUUID ?? e.Race ?? '');
      return (
        (tableUuid === progressionTableUuid || raceRef === raceUuid) &&
        progType === '2'
      );
    });

    const built: ProgressionSubform[] = existing.map((entry) => {
      const uuid = String(entry.UUID ?? '') || `existing-${entry._pk}`;
      manualUuids.add(uuid);
      let selectors: SelectorSubItem[] = [];
      const selectorsRaw = String(entry.Selectors ?? '');
      if (selectorsRaw) {
        const parsed = parseRawSelectors(selectorsRaw);
        selectors = parsed.map(sel => ({
          action: 'Insert',
          fn: sel.fn,
          selectorUuid: '',
          overwrite: false,
          modGuid: '',
          isReplace: sel.isReplace,
          params: sel.params,
        }));
      }
      return {
        id: uuid,
        existingPk: entry._pk,
        level: String(entry.Level ?? ''),
        name: String(entry.Name ?? ''),
        boosts: String(entry.Boosts ?? ''),
        passivesAdded: String(entry.PassivesAdded ?? ''),
        passivesRemoved: String(entry.PassivesRemoved ?? ''),
        allowImprovement: String(entry.AllowImprovement ?? '') === 'true',
        selectors,
        markedForDeletion: false,
      };
    });

    // 2. Diff entries from scan result (mod PAK) — avoid duplicates already in manual entries
    const allScanResults = [modStore.scanResult, ...modStore.additionalModResults];
    for (const scan of allScanResults) {
      if (!scan) continue;
      const progSection = scan.sections.find(s => s.section === 'Progressions');
      if (!progSection) continue;
      for (const de of progSection.entries) {
        if (manualUuids.has(de.uuid)) continue;
        const attrs = de.raw_attributes;
        if (attrs.TableUUID !== progressionTableUuid) continue;
        if (attrs.ProgressionType !== '2') continue;
        manualUuids.add(de.uuid);

        let selectors: SelectorSubItem[] = [];
        if (attrs.Selectors) {
          const parsed = parseRawSelectors(attrs.Selectors);
          selectors = parsed.map(sel => ({
            action: 'Insert',
            fn: sel.fn,
            selectorUuid: '',
            overwrite: false,
            modGuid: '',
            isReplace: sel.isReplace,
            params: sel.params,
          }));
        }
        built.push({
          id: de.uuid,
          level: attrs.Level ?? '',
          name: attrs.Name ?? '',
          boosts: attrs.Boosts ?? '',
          passivesAdded: attrs.PassivesAdded ?? '',
          passivesRemoved: attrs.PassivesRemoved ?? '',
          allowImprovement: attrs.AllowImprovement === 'true',
          selectors,
          markedForDeletion: false,
        });
      }
    }

    if (built.length > 0) {
      subforms = built;
    }
    initialized = true;
  });

  let sortedSubforms = $derived(
    [...subforms]
      .filter(s => !s.markedForDeletion)
      .sort((a, b) => {
        const la = parseInt(a.level) || 0;
        const lb = parseInt(b.level) || 0;
        return la - lb;
      })
  );

  /** Progressions grouped by level, sorted ascending */
  let progressionsByLevel = $derived.by(() => {
    const map = new Map<number, ProgressionSubform[]>();
    for (const sub of sortedSubforms) {
      const lvl = parseInt(sub.level || '0', 10) || 0;
      const existing = map.get(lvl);
      if (existing) existing.push(sub);
      else map.set(lvl, [sub]);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a - b)
      .map(([level, progressions]) => ({ level, progressions }));
  });

  let deletedSubforms = $derived(subforms.filter(s => s.markedForDeletion));

  let newLevel: string | number = $state('');

  let levelMissing = $derived(!String(newLevel ?? '').trim() || Number(newLevel) < 1);

  function addSubform() {
    const level = String(newLevel ?? '').trim();
    if (!level || Number(level) < 1) return;
    subforms = [...subforms, {
      id: `temp-${generateUuid()}`,
      level,
      name: '',
      boosts: '',
      passivesAdded: '',
      passivesRemoved: '',
      allowImprovement: false,
      selectors: [],
      markedForDeletion: false,
    }];
    newLevel = '';
  }

  function removeSubform(id: string) {
    const sub = subforms.find(s => s.id === id);
    if (!sub) return;

    if (sub.existingPk != null) {
      sub.markedForDeletion = true;
      subforms = [...subforms]; // trigger reactivity
    } else {
      subforms = subforms.filter(s => s.id !== id);
    }
  }

  function restoreSubform(id: string) {
    const sub = subforms.find(s => s.id === id);
    if (!sub) return;
    sub.markedForDeletion = false;
    subforms = [...subforms];
  }

  /** Expose the level groups so UnifiedForm can build nav children */
  export function getLevelGroups(): { level: number; count: number }[] {
    return progressionsByLevel.map(g => ({ level: g.level, count: g.progressions.length }));
  }

  /**
   * Build the diff of what needs to be created, updated, and removed.
   * Called by ManualEntryForm on save.
   */
  export function syncProgressions(): {
    toCreate: { section: string; fields: Record<string, string> }[];
    toUpdate: { pk: string; section: string; fields: Record<string, string> }[];
    toRemove: string[];
  } {
    const toCreate: { section: string; fields: Record<string, string> }[] = [];
    const toUpdate: { pk: string; section: string; fields: Record<string, string> }[] = [];
    const toRemove: string[] = [];

    for (const sub of subforms) {
      if (sub.markedForDeletion) {
        if (sub.existingPk != null) toRemove.push(sub.existingPk);
        continue;
      }

      // Skip empty subforms (no level set)
      if (!sub.level) continue;

      const fields: Record<string, string> = {
        UUID: sub.id.startsWith('temp-') || sub.id.startsWith('existing-')
          ? generateUuid()
          : sub.id,
        TableUUID: progressionTableUuid,
        ProgressionType: '2',
        Level: sub.level,
      };

      if (sub.name) fields.Name = sub.name;
      if (sub.boosts) fields.Boosts = sub.boosts;
      if (sub.passivesAdded) fields.PassivesAdded = sub.passivesAdded;
      if (sub.passivesRemoved) fields.PassivesRemoved = sub.passivesRemoved;
      if (sub.allowImprovement) fields.AllowImprovement = 'true';

      // Encode selectors into Selector:N:* keys
      if (sub.selectors.length > 0) {
        encodeSelectors(sub.selectors as any, fields);
      }

      if (sub.existingPk != null) {
        toUpdate.push({ pk: sub.existingPk, section: 'Progressions', fields });
      } else {
        toCreate.push({ section: 'Progressions', fields });
      }
    }

    return { toCreate, toUpdate, toRemove };
  }
</script>

<div class="progression-panel space-y-2">
  {#if sortedSubforms.length === 0 && deletedSubforms.length === 0}
    <div class="flex flex-col items-center justify-center py-4 border border-dashed border-[var(--th-border-700)] rounded">
      <p class="text-xs text-[var(--th-text-500)] mb-2">No progressions defined for this race.</p>
      <div class="flex items-center gap-2">
        <div class="flex flex-col gap-0.5 text-xs w-16 shrink-0">
          <label class="text-[var(--th-text-400)]" for="prog-new-level-empty">Level <span class="text-red-400">*</span></label>
          <input id="prog-new-level-empty" type="number" class="form-input w-full" min="1" max="20" placeholder="Lv" bind:value={newLevel} />
        </div>
        <button type="button" class="h-8 mt-auto px-2.5 text-xs font-medium text-sky-300 bg-sky-900/40 border border-sky-700/50 rounded hover:bg-sky-800/50 transition-colors inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed" onclick={addSubform} disabled={levelMissing} use:tooltip={levelMissing ? 'Enter a level (1–20) first' : 'Add a new progression at this level'}>
          <Plus size={12} /> Add Progression
        </button>
        {#if levelMissing}
          <span class="text-[10px] text-[var(--th-text-500)] mt-auto mb-1">Enter a level (1–20) to add a progression.</span>
        {/if}
      </div>
    </div>
  {:else}
    <!-- Timeline visual grouped by level -->
    <div class="timeline-container">
      {#each progressionsByLevel as group (group.level)}
        <div class="timeline-level-group" id="section-race-prog-level-{group.level}">
          <!-- Level marker with circle on the track -->
          <div class="timeline-level-header">
            <span class="timeline-level-circle bg-sky-500">{group.level}</span>
            <span class="text-xs font-semibold text-[var(--th-text-200)]">Level {group.level}</span>
            <span class="text-[10px] text-[var(--th-text-500)]">{group.progressions.length} {group.progressions.length === 1 ? 'progression' : 'progressions'}</span>
          </div>

          <!-- Progressions within this level -->
          {#each group.progressions as sub (sub.id)}
            <div class="timeline-item">
              <details class="progression-subform" open>
                <summary class="layout-subsection-summary text-xs font-semibold text-[var(--th-text-400)] cursor-pointer hover:text-[var(--th-text-200)] select-none flex items-center gap-1.5">
                  <ChevronRight size={12} class="layout-chevron shrink-0 transition-transform" />
                  Progression
                  {#if sub.name}
                    <span class="font-normal text-[var(--th-text-500)]">— {sub.name}</span>
                  {/if}
                  {#if sub.existingPk != null}
                    <span class="text-[10px] text-emerald-500/70 font-normal ml-1">(saved)</span>
                  {/if}
                  <span class="font-mono text-[10px] text-[var(--th-text-500)] select-all cursor-text truncate font-normal translate-y-px">{sub.id}</span>
                  <span class="ml-auto" role="presentation" onclick={(e) => e.stopPropagation()} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); }}>
                    <button type="button" class="text-xs text-red-400 hover:text-red-300 px-1.5 min-w-6 min-h-6 inline-flex items-center justify-center"
                      onclick={() => removeSubform(sub.id)} aria-label="Remove progression">
                      <X size={14} />
                    </button>
                  </span>
                </summary>

                <div class="progression-fields space-y-2 mt-2">
                  <div class="flex gap-2">
                    <div class="flex flex-col gap-0.5 text-xs w-16 shrink-0">
                      <label class="text-[var(--th-text-400)]" for="prog-level-{sub.id}">Level <span class="text-red-400">*</span></label>
                      <input id="prog-level-{sub.id}" type="number" class="form-input w-full" min="1" max="20"
                        bind:value={sub.level} required />
                    </div>
                    <div class="flex flex-col gap-0.5 text-xs w-48 shrink-0">
                      <label class="text-[var(--th-text-400)]" for="prog-name-{sub.id}">Name <span class="text-red-400">*</span></label>
                      <input id="prog-name-{sub.id}" type="text" class="form-input w-full"
                        bind:value={sub.name} placeholder="e.g., Elf" required />
                    </div>
                  </div>
                  <div class="flex gap-2 items-end">
                    <div class="flex flex-col gap-0.5 text-xs flex-1 min-w-0">
                      <label class="text-[var(--th-text-400)]" for="prog-boosts-{sub.id}">Boosts</label>
                      <input id="prog-boosts-{sub.id}" type="text" class="form-input w-full"
                        bind:value={sub.boosts} placeholder="e.g., ActionResource(Movement,9,0);Proficiency(LightArmor)" />
                    </div>
                    <label class="shrink-0 h-8 inline-flex items-center gap-2 text-xs cursor-pointer px-2 rounded">
                      <button type="button"
                        class="relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 {sub.allowImprovement ? 'bg-sky-500' : 'bg-[var(--th-bg-600,#52525b)]'}"
                        role="switch" aria-checked={sub.allowImprovement} aria-label="Allow Improvement"
                        onclick={() => { sub.allowImprovement = !sub.allowImprovement; subforms = [...subforms]; }}>
                        <span class="pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 {sub.allowImprovement ? 'translate-x-3.5' : 'translate-x-0.5'}"></span>
                      </button>
                      <span class="whitespace-nowrap {sub.allowImprovement ? 'text-sky-400' : 'text-[var(--th-text-500)]'}">Grant Feat</span>
                    </label>
                  </div>
                  <div class="flex flex-col gap-0.5 text-xs">
                    <span class="text-[var(--th-text-400)]">Passives Added</span>
                    <MultiSelectCombobox
                      options={passiveOptions}
                      selected={sub.passivesAdded ? sub.passivesAdded.split(';').map(v => v.trim()).filter(Boolean) : []}
                      onchange={(vals) => { sub.passivesAdded = vals.join(';'); subforms = [...subforms]; }}
                      placeholder="e.g., Darkvision, KeenSenses"
                    />
                  </div>
                  <div class="flex flex-col gap-0.5 text-xs">
                    <span class="text-[var(--th-text-400)]">Passives Removed</span>
                    <MultiSelectCombobox
                      options={passiveOptions}
                      selected={sub.passivesRemoved ? sub.passivesRemoved.split(';').map(v => v.trim()).filter(Boolean) : []}
                      onchange={(vals) => { sub.passivesRemoved = vals.join(';'); subforms = [...subforms]; }}
                      placeholder="Passives removed at this level"
                    />
                  </div>
                </div>

                <!-- Selectors -->
                <div class="mt-2">
                  <FormSelectors bind:selectors={sub.selectors} warnKeys={new Set()} />
                </div>
              </details>
            </div>
          {/each}
        </div>
      {/each}
    </div>

    {#if deletedSubforms.length > 0}
      <div class="space-y-1">
        {#each deletedSubforms as sub (sub.id)}
          <div class="flex items-center gap-2 text-xs text-[var(--th-text-500)] line-through opacity-60 px-2 py-1 border border-dashed border-[var(--th-border-700)] rounded">
            <span>Level {sub.level || '?'}{sub.name ? ` — ${sub.name}` : ''}</span>
            <button type="button" class="ml-auto text-sky-400 hover:text-sky-300 no-underline inline-flex items-center gap-1"
              onclick={() => restoreSubform(sub.id)} aria-label="Restore progression">
              <RotateCcw size={12} /> Restore
            </button>
          </div>
        {/each}
      </div>
    {/if}

    <div class="flex items-center gap-2">
      <div class="flex flex-col gap-0.5 text-xs w-16 shrink-0">
        <label class="text-[var(--th-text-400)]" for="prog-new-level">Level <span class="text-red-400">*</span></label>
        <input id="prog-new-level" type="number" class="form-input w-full" min="1" max="20" placeholder="Lv" bind:value={newLevel} />
      </div>
      <button type="button" class="h-8 mt-auto px-2.5 text-xs font-medium text-sky-300 bg-sky-900/40 border border-sky-700/50 rounded hover:bg-sky-800/50 transition-colors inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed" onclick={addSubform} disabled={levelMissing} use:tooltip={levelMissing ? 'Enter a level (1–20) first' : 'Add a new progression at this level'}>
        <Plus size={12} /> Add Progression
      </button>
      {#if levelMissing}
        <span class="text-[10px] text-[var(--th-text-500)] mt-auto mb-1">Enter a level (1–20) to add a progression.</span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .timeline-container {
    background: var(--th-bg-900);
    border: 1px solid var(--th-border-700);
    border-radius: 0.5rem;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .timeline-level-group {
    position: relative;
    padding-left: 1.25rem;
    border-left: 2px solid var(--th-border-700);
    margin-left: 0.5rem;
  }

  .timeline-level-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }

  .timeline-level-circle {
    flex-shrink: 0;
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 9999px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
    color: white;
    margin-left: calc(-1.875rem - 1px);
  }

  .timeline-item {
    padding-left: 0.25rem;
    margin-bottom: 0.25rem;
  }

  .progression-subform {
    padding: 0.375rem 0.5rem 0.5rem;
    border: 1px solid var(--th-border-700, #3f3f46);
    border-radius: 0.25rem;
    background: var(--th-bg-800, rgba(0, 0, 0, 0.15));
  }

  /* Chevron rotation for expand/collapse */
  .progression-subform > :global(.layout-subsection-summary .layout-chevron) {
    transform: rotate(0deg);
  }
  .progression-subform[open] > :global(.layout-subsection-summary .layout-chevron) {
    transform: rotate(90deg);
  }

  .form-input {
    box-sizing: border-box;
    height: 2rem;
    background-color: var(--th-input-bg);
    border: 1px solid var(--th-input-border);
    border-radius: 0.25rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.8125rem;
    color: var(--th-input-text);
  }
  .form-input:focus {
    outline: none;
    border-color: rgb(14 165 233);
  }
</style>
