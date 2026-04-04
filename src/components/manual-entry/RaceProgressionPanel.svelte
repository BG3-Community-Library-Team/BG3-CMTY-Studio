<script lang="ts">
  import { configStore, type ManualEntry } from "../../lib/stores/configStore.svelte.js";
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
    existingIndex?: number;
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

    // 1. Manual entries (user-created / imported config)
    const manualUuids = new Set<string>();
    const existing = configStore.getManualEntriesForRace(raceUuid, progressionTableUuid)
      .filter(m =>
        m.entry.section === 'Progressions' &&
        m.entry.fields.ProgressionType === '2'
      );

    const built: ProgressionSubform[] = existing.map(({ entry, index }) => {
      const uuid = entry.fields.UUID || `existing-${index}`;
      manualUuids.add(uuid);
      let selectors: SelectorSubItem[] = [];
      if (entry.fields.Selectors) {
        const parsed = parseRawSelectors(entry.fields.Selectors);
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
        existingIndex: index,
        level: entry.fields.Level ?? '',
        name: entry.fields.Name ?? '',
        boosts: entry.fields.Boosts ?? '',
        passivesAdded: entry.fields.PassivesAdded ?? '',
        passivesRemoved: entry.fields.PassivesRemoved ?? '',
        allowImprovement: entry.fields.AllowImprovement === 'true',
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

  let deletedSubforms = $derived(subforms.filter(s => s.markedForDeletion));

  let newLevel: string | number = $state('');

  let levelMissing = $derived(!String(newLevel ?? '').trim() || Number(newLevel) < 1);

  function addSubform() {
    const level = String(newLevel ?? '').trim();
    if (!level || Number(level) < 1) return;
    subforms = [...subforms, {
      id: `temp-${crypto.randomUUID()}`,
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

    if (sub.existingIndex != null) {
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

  /**
   * Build the diff of what needs to be created, updated, and removed.
   * Called by ManualEntryForm on save.
   */
  export function syncProgressions(): {
    toCreate: { section: string; fields: Record<string, string> }[];
    toUpdate: { index: number; section: string; fields: Record<string, string> }[];
    toRemove: number[];
  } {
    const toCreate: { section: string; fields: Record<string, string> }[] = [];
    const toUpdate: { index: number; section: string; fields: Record<string, string> }[] = [];
    const toRemove: number[] = [];

    for (const sub of subforms) {
      if (sub.markedForDeletion) {
        if (sub.existingIndex != null) toRemove.push(sub.existingIndex);
        continue;
      }

      // Skip empty subforms (no level set)
      if (!sub.level) continue;

      const fields: Record<string, string> = {
        UUID: sub.id.startsWith('temp-') || sub.id.startsWith('existing-')
          ? crypto.randomUUID()
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

      if (sub.existingIndex != null) {
        toUpdate.push({ index: sub.existingIndex, section: 'Progressions', fields });
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
    {#each sortedSubforms as sub (sub.id)}
      <details class="progression-subform" open>
        <summary class="layout-subsection-summary text-xs font-semibold text-[var(--th-text-400)] cursor-pointer hover:text-[var(--th-text-200)] select-none flex items-center gap-1.5">
          <ChevronRight size={12} class="layout-chevron shrink-0 transition-transform" />
          Level {sub.level || '?'}
          {#if sub.name}
            <span class="font-normal text-[var(--th-text-500)]">— {sub.name}</span>
          {/if}
          {#if sub.existingIndex != null}
            <span class="text-[10px] text-emerald-500/70 font-normal ml-1">(saved)</span>
          {/if}
          <span class="font-mono text-[10px] text-[var(--th-text-500)] select-all cursor-text truncate font-normal translate-y-px">{sub.id}</span>
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <span class="ml-auto" onclick={(e) => e.stopPropagation()}>
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
    {/each}

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
