<script lang="ts">
  import { configStore } from "../../lib/stores/configStore.svelte.js";
  import { modStore } from "../../lib/stores/modStore.svelte.js";
  import Plus from "@lucide/svelte/icons/plus";
  import X from "@lucide/svelte/icons/x";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import { tooltip } from "../../lib/actions/tooltip.js";
  import { generateUuid } from "../../lib/utils/uuid.js";

  let {
    backgroundUuid,
  }: {
    backgroundUuid: string;
  } = $props();

  interface GoalSubform {
    id: string;
    existingIndex?: number;
    experienceReward: string;
    inspirationPoints: string;
    rewardLevel: string;
    markedForDeletion: boolean;
  }

  let subforms: GoalSubform[] = $state([]);
  let initialized = $state(false);

  /** Load existing background goals from the store on first render */
  $effect(() => {
    if (initialized) return;
    if (!backgroundUuid) { initialized = true; return; }

    const manualUuids = new Set<string>();
    const built: GoalSubform[] = [];

    // 1. Manual entries (user-created / imported config)
    for (let i = 0; i < configStore.manualEntries.length; i++) {
      const e = configStore.manualEntries[i];
      if (e.section !== 'BackgroundGoals') continue;
      if (e.fields.BackgroundUuid !== backgroundUuid) continue;
      const uuid = e.fields.UUID || `existing-${i}`;
      manualUuids.add(uuid);
      built.push({
        id: uuid,
        existingIndex: i,
        experienceReward: e.fields.ExperienceReward ?? '',
        inspirationPoints: e.fields.InspirationPoints ?? '',
        rewardLevel: e.fields.RewardLevel ?? '',
        markedForDeletion: false,
      });
    }

    // 2. Diff entries from scan result (mod PAK) — avoid duplicates
    const allScanResults = [modStore.scanResult, ...modStore.additionalModResults];
    for (const scan of allScanResults) {
      if (!scan) continue;
      const goalSection = scan.sections.find(s => s.section === 'BackgroundGoals');
      if (!goalSection) continue;
      for (const de of goalSection.entries) {
        if (manualUuids.has(de.uuid)) continue;
        const attrs = de.raw_attributes;
        if (attrs.BackgroundUuid !== backgroundUuid) continue;
        manualUuids.add(de.uuid);
        built.push({
          id: de.uuid,
          experienceReward: attrs.ExperienceReward ?? '',
          inspirationPoints: attrs.InspirationPoints ?? '',
          rewardLevel: attrs.RewardLevel ?? '',
          markedForDeletion: false,
        });
      }
    }

    if (built.length > 0) {
      subforms = built;
    }
    initialized = true;
  });

  let activeSubforms = $derived(subforms.filter(s => !s.markedForDeletion));
  let deletedSubforms = $derived(subforms.filter(s => s.markedForDeletion));

  /** Level to assign when adding a new goal */
  let newGoalLevel = $state('1');

  /** Goals grouped by reward level, sorted ascending */
  let goalsByLevel = $derived.by(() => {
    const map = new Map<number, GoalSubform[]>();
    for (const sub of activeSubforms) {
      const lvl = parseInt(sub.rewardLevel || '0', 10) || 0;
      const existing = map.get(lvl);
      if (existing) existing.push(sub);
      else map.set(lvl, [sub]);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a - b)
      .map(([level, goals]) => ({ level, goals }));
  });

  function addSubform() {
    subforms = [...subforms, {
      id: `temp-${generateUuid()}`,
      experienceReward: '0',
      inspirationPoints: '0',
      rewardLevel: newGoalLevel || '1',
      markedForDeletion: false,
    }];
  }

  function removeSubform(id: string) {
    const sub = subforms.find(s => s.id === id);
    if (!sub) return;
    if (sub.existingIndex != null) {
      sub.markedForDeletion = true;
      subforms = [...subforms];
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
    return goalsByLevel.map(g => ({ level: g.level, count: g.goals.length }));
  }

  /**
   * Build the diff of what needs to be created, updated, and removed.
   * Called by UnifiedForm on save.
   */
  export function syncGoals(): {
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

      const fields: Record<string, string> = {
        UUID: sub.id.startsWith('temp-') || sub.id.startsWith('existing-')
          ? generateUuid()
          : sub.id,
        BackgroundUuid: backgroundUuid,
      };

      if (sub.experienceReward) fields.ExperienceReward = sub.experienceReward;
      if (sub.inspirationPoints) fields.InspirationPoints = sub.inspirationPoints;
      if (sub.rewardLevel) fields.RewardLevel = sub.rewardLevel;

      if (sub.existingIndex != null) {
        toUpdate.push({ index: sub.existingIndex, section: 'BackgroundGoals', fields });
      } else {
        toCreate.push({ section: 'BackgroundGoals', fields });
      }
    }

    return { toCreate, toUpdate, toRemove };
  }
</script>

<div class="goals-panel">
  {#if activeSubforms.length === 0 && deletedSubforms.length === 0}
    <div class="flex flex-col items-center justify-center py-4 border border-dashed border-[var(--th-border-700)] rounded">
      <p class="text-xs text-[var(--th-text-500)] mb-2">No background goals defined.</p>
      <div class="flex items-center gap-2">
        <label class="text-xs text-[var(--th-text-400)]" for="new-goal-level-empty">Level</label>
        <input id="new-goal-level-empty" type="number" class="form-input w-14 text-center" min="1" max="20"
          bind:value={newGoalLevel} />
        <button type="button"
          class="h-8 px-2.5 text-xs font-medium text-sky-300 bg-sky-900/40 border border-sky-700/50 rounded hover:bg-sky-800/50 transition-colors inline-flex items-center gap-1"
          onclick={addSubform}
          use:tooltip={'Add a new background goal'}>
          <Plus size={12} /> Add Goal
        </button>
      </div>
    </div>
  {:else}
    <!-- Timeline visual grouped by level -->
    <div class="timeline-container">
      {#each goalsByLevel as group (group.level)}
        <div class="timeline-level-group" id="section-bg-goal-level-{group.level}">
          <!-- Level marker with circle on the track -->
          <div class="timeline-level-header">
            <span class="timeline-level-circle bg-sky-500">{group.level}</span>
            <span class="text-xs font-semibold text-[var(--th-text-200)]">Level {group.level}</span>
            <span class="text-[10px] text-[var(--th-text-500)]">{group.goals.length} {group.goals.length === 1 ? 'goal' : 'goals'}</span>
          </div>

          <!-- Goals within this level -->
          {#each group.goals as sub (sub.id)}
            <div class="timeline-goal">
              <details class="goal-subform" open>
                <summary class="layout-subsection-summary text-xs font-semibold text-[var(--th-text-400)] cursor-pointer hover:text-[var(--th-text-200)] select-none flex items-center gap-1.5">
                  <ChevronRight size={12} class="layout-chevron shrink-0 transition-transform" />
                  Goal
                  <span class="goal-summary-details font-normal text-[var(--th-text-500)]">
                    — XP {sub.experienceReward || '0'} · Insp {sub.inspirationPoints || '0'}
                  </span>
                  {#if sub.existingIndex != null}
                    <span class="text-[10px] text-emerald-500/70 font-normal ml-1">(saved)</span>
                  {/if}
                  <span class="font-mono text-[10px] text-[var(--th-text-500)] select-all cursor-text truncate font-normal translate-y-px">{sub.id}</span>
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <span class="ml-auto" onclick={(e) => e.stopPropagation()}>
                    <button type="button" class="text-xs text-red-400 hover:text-red-300 px-1.5 min-w-6 min-h-6 inline-flex items-center justify-center"
                      onclick={() => removeSubform(sub.id)} aria-label="Remove goal">
                      <X size={14} />
                    </button>
                  </span>
                </summary>

                <div class="goal-fields mt-2">
                  <div class="flex gap-2">
                    <div class="flex flex-col gap-0.5 text-xs flex-1">
                      <label class="text-[var(--th-text-400)]" for="goal-xp-{sub.id}">Experience Reward</label>
                      <input id="goal-xp-{sub.id}" type="number" class="form-input w-full" min="0"
                        bind:value={sub.experienceReward} placeholder="0" />
                    </div>
                    <div class="flex flex-col gap-0.5 text-xs flex-1">
                      <label class="text-[var(--th-text-400)]" for="goal-insp-{sub.id}">Inspiration Points</label>
                      <input id="goal-insp-{sub.id}" type="number" class="form-input w-full" min="0"
                        bind:value={sub.inspirationPoints} placeholder="0" />
                    </div>
                    <div class="flex flex-col gap-0.5 text-xs flex-1">
                      <label class="text-[var(--th-text-400)]" for="goal-level-{sub.id}">Reward Level</label>
                      <input id="goal-level-{sub.id}" type="number" class="form-input w-full" min="1"
                        bind:value={sub.rewardLevel} placeholder="1" />
                    </div>
                  </div>
                </div>
              </details>
            </div>
          {/each}
        </div>
      {/each}
    </div>

    {#if deletedSubforms.length > 0}
      <div class="space-y-1 mt-2">
        {#each deletedSubforms as sub (sub.id)}
          <div class="flex items-center gap-2 text-xs text-[var(--th-text-500)] line-through opacity-60 px-2 py-1 border border-dashed border-[var(--th-border-700)] rounded">
            <span>Goal — Level {sub.rewardLevel || '?'}</span>
            <button type="button" class="ml-auto text-sky-400 hover:text-sky-300 no-underline inline-flex items-center gap-1"
              onclick={() => restoreSubform(sub.id)} aria-label="Restore goal">
              <RotateCcw size={12} /> Restore
            </button>
          </div>
        {/each}
      </div>
    {/if}

    <div class="flex items-center gap-2 mt-2">
      <label class="text-xs text-[var(--th-text-400)]" for="new-goal-level">Level</label>
      <input id="new-goal-level" type="number" class="form-input w-14 text-center" min="1" max="20"
        bind:value={newGoalLevel} />
      <button type="button"
        class="h-8 px-2.5 text-xs font-medium text-sky-300 bg-sky-900/40 border border-sky-700/50 rounded hover:bg-sky-800/50 transition-colors inline-flex items-center gap-1"
        onclick={addSubform}
        use:tooltip={'Add a new background goal'}>
        <Plus size={12} /> Add Goal
      </button>
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

  .timeline-goal {
    padding-left: 0.25rem;
    margin-bottom: 0.25rem;
  }

  .goal-subform {
    padding: 0.375rem 0.5rem 0.5rem;
    border: 1px solid transparent;
    border-radius: 0.25rem;
    background: none;
  }

  .goal-subform[open] {
    border-color: var(--th-border-700, #3f3f46);
    background: var(--th-bg-800, rgba(0, 0, 0, 0.15));
  }

  /* Hide summary details when open (fields are shown inline) */
  .goal-subform[open] .goal-summary-details {
    display: none;
  }

  .goal-subform > :global(.layout-subsection-summary .layout-chevron) {
    transform: rotate(0deg);
  }
  .goal-subform[open] > :global(.layout-subsection-summary .layout-chevron) {
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
