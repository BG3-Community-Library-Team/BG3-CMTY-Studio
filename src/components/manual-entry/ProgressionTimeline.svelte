<script lang="ts">
  import type { DiffEntry } from "../../lib/types/index.js";
  import { configStore } from "../../lib/stores/configStore.svelte.js";
  import { modStore } from "../../lib/stores/modStore.svelte.js";
  import { changesToManualFields } from "../../lib/utils/preview.js";
  import TagBadge from "../TagBadge.svelte";
  import ManualEntryForm from "../ManualEntryForm.svelte";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Pencil from "@lucide/svelte/icons/pencil";
  import PanelRightOpen from "@lucide/svelte/icons/panel-right-open";

  let {
    entries,
    section,
    onSelectEntry,
  }: {
    entries: DiffEntry[];
    section: string;
    onSelectEntry?: (uuid: string) => void;
  } = $props();

  /** Track collapsed state per group key */
  let collapsed: Record<string, boolean> = $state({});
  /** Track which entry is being edited inline */
  let editingUuid: string | null = $state(null);
  /** Track collapsed state for edit forms (preserved while editing) */
  let editCollapsed: Record<string, boolean> = $state({});
  /** Whether to open the summary panel when editing starts */
  let openWithSummary = $state(false);

  function toggleGroup(key: string) {
    collapsed[key] = !collapsed[key];
  }

  function startEdit(uuid: string) {
    if (editingUuid === uuid) {
      // Toggle collapse if already editing
      editCollapsed[uuid] = !editCollapsed[uuid];
    } else {
      editingUuid = uuid;
      editCollapsed[uuid] = false;
      openWithSummary = false;
    }
    onSelectEntry?.(uuid);
  }

  /** Toggle summary pane without changing form expand/collapse state */
  function toggleSummary(uuid: string) {
    if (editingUuid === uuid) {
      // Already editing this entry — dispatch event to toggle summary in the form
      window.dispatchEvent(new CustomEvent('toggle-entry-summary', { detail: { section, uuid } }));
    } else {
      // Start editing with summary open, form expanded
      editingUuid = uuid;
      editCollapsed[uuid] = false;
      openWithSummary = true;
    }
    onSelectEntry?.(uuid);
  }

  function closeEdit() {
    editingUuid = null;
    openWithSummary = false;
  }

  /** Get prefill fields for an entry being edited */
  function getPrefillFields(entry: DiffEntry): Record<string, string> {
    const override = configStore.getAutoEntryOverride(section, entry.uuid);
    if (override) return override;
    return changesToManualFields(
      {
        section: section as any,
        uuid: entry.uuid,
        display_name: entry.display_name,
        changes: entry.changes,
        manual: false,
      },
      entry.raw_attributes,
      entry.raw_children,
    );
  }

  interface TimelineStep {
    entry: DiffEntry;
    level: number;
    enabled: boolean;
    isNew: boolean;
    hasOverride: boolean;
    passives: string[];
    boosts: string[];
  }

  interface TimelineGroup {
    key: string;
    displayName: string;
    steps: TimelineStep[];
  }

  let groups: TimelineGroup[] = $derived.by(() => {
    if (entries.length === 0) return [];

    const groupMap = new Map<string, DiffEntry[]>();

    for (const entry of entries) {
      const tableUUID = entry.raw_attributes?.TableUUID ?? "";
      const name = entry.raw_attributes?.Name ?? "";
      const key = tableUUID || name || "Unknown";
      const existing = groupMap.get(key);
      if (existing) {
        existing.push(entry);
      } else {
        groupMap.set(key, [entry]);
      }
    }

    const result: TimelineGroup[] = [];

    for (const [key, groupEntries] of groupMap) {
      const nameFromEntry = groupEntries[0]?.raw_attributes?.Name;
      const displayName = nameFromEntry || modStore.lookupDisplayName(key) || key;

      const steps: TimelineStep[] = groupEntries
        .map((entry) => {
          const level = parseInt(entry.raw_attributes?.Level ?? "0", 10);
          const enabled = configStore.isEnabled(section, entry.uuid);
          const isNew = entry.entry_kind !== "Vanilla" && entry.entry_kind !== "Modified";
          const hasOverride = !!configStore.getAutoEntryOverride(section, entry.uuid);
          const passivesRaw = entry.raw_attributes?.PassivesAdded ?? "";
          const boostsRaw = entry.raw_attributes?.Boosts ?? "";
          return {
            entry,
            level: isNaN(level) ? 0 : level,
            enabled,
            isNew,
            hasOverride,
            passives: passivesRaw ? passivesRaw.split(";").map(s => s.trim()).filter(Boolean) : [],
            boosts: boostsRaw ? boostsRaw.split(";").map(s => s.trim()).filter(Boolean) : [],
          };
        })
        .sort((a, b) => a.level - b.level);

      result.push({ key, displayName, steps });
    }

    return result.sort((a, b) => a.displayName.localeCompare(b.displayName));
  });

  // Listen for entry-start-edit events from external sources
  $effect(() => {
    function handleExternalEdit(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.section === section && detail?.uuid) {
        editingUuid = detail.uuid;
        editCollapsed[detail.uuid] = false;
      }
    }
    window.addEventListener('entry-start-edit', handleExternalEdit);
    return () => window.removeEventListener('entry-start-edit', handleExternalEdit);
  });
</script>

<!-- External edit events handled by $effect below -->

{#if groups.length > 0}
  <div class="timeline-container">
    {#each groups as group (group.key)}
      <!-- Group header -->
      <button
        class="timeline-group-header"
        onclick={() => toggleGroup(group.key)}
      >
        <span
          class="inline-flex transition-transform duration-150"
          class:rotate-90={!collapsed[group.key]}
        >
          <ChevronRight size={14} />
        </span>
        <span class="truncate">{group.displayName}</span>
        <span class="text-xs text-[var(--th-text-400)] ml-auto shrink-0">
          {group.steps.length} levels
        </span>
      </button>

      <!-- Timeline steps -->
      {#if !collapsed[group.key]}
        <div class="timeline-track">
          {#each group.steps as step, i (step.entry.uuid)}
            {@const isEditing = editingUuid === step.entry.uuid}
            {@const isFormCollapsed = editCollapsed[step.entry.uuid] ?? false}
            {@const isLast = i === group.steps.length - 1}

            <!-- Step header (always visible) -->
            <div
              class="timeline-step"
              class:timeline-step-active={isEditing}
              class:mb-1={!isLast && !isEditing}
            >
              <!-- Clickable main area -->
              <button
                class="timeline-step-main"
                onclick={() => startEdit(step.entry.uuid)}
              >
                <!-- Level circle -->
                <span
                  class="timeline-level-circle"
                  class:bg-sky-500={step.enabled}
                  class:bg-[var(--th-bg-600)]={!step.enabled}
                >
                  {step.level}
                </span>

                <!-- Badges -->
                {#if step.isNew}
                  <TagBadge tag="NEW" />
                {:else if step.entry.entry_kind === "Modified"}
                  <TagBadge tag="OVRD" />
                {/if}
                {#if step.hasOverride}
                  <TagBadge tag="MOD" />
                {/if}

                <!-- Step name -->
                <span class="text-xs font-semibold text-[var(--th-text-200)] truncate flex-1">
                  Level {step.level}
                </span>

                {#if step.passives.length > 0 || step.boosts.length > 0}
                  <span class="text-[10px] text-[var(--th-text-500)]">
                    {step.passives.length + step.boosts.length} effects
                  </span>
                {/if}
              </button>

              <!-- Action buttons (always visible) -->
              <span class="timeline-step-actions">
                <button
                  type="button"
                  class="p-1 rounded text-[var(--th-text-500)] hover:text-[var(--th-text-200)] hover:bg-[var(--th-bg-600)] transition-colors"
                  title="Edit entry"
                  aria-label="Edit Level {step.level}"
                  onclick={(e) => { e.stopPropagation(); startEdit(step.entry.uuid); }}
                >
                  <Pencil size={12} />
                </button>
                <button
                  type="button"
                  class="p-1 rounded text-[var(--th-text-500)] hover:text-[var(--th-text-200)] hover:bg-[var(--th-bg-600)] transition-colors"
                  title="Toggle summary panel"
                  aria-label="Toggle summary panel"
                  onclick={(e) => { e.stopPropagation(); toggleSummary(step.entry.uuid); }}
                >
                  <PanelRightOpen size={12} />
                </button>
              </span>
            </div>

            <!-- Inline passives/boosts summary (visible when not editing, or when form is collapsed) -->
            {#if !isEditing || isFormCollapsed}
              {#if step.passives.length > 0 || step.boosts.length > 0}
                <div class="timeline-step-details">
                  {#if step.passives.length > 0}
                    <div class="flex flex-wrap gap-1">
                      {#each step.passives as passive}
                        <span class="timeline-chip">{passive}</span>
                      {/each}
                    </div>
                  {/if}
                  {#if step.boosts.length > 0}
                    <div class="flex flex-wrap gap-1">
                      {#each step.boosts as boost}
                        <span class="timeline-chip timeline-chip-boost">{boost}</span>
                      {/each}
                    </div>
                  {/if}
                </div>
              {/if}
            {/if}

            <!-- Inline edit form (always mounted when editing; collapsed via height to preserve fixed summary drawer) -->
            {#if isEditing}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <div class="timeline-form-container" style:height={isFormCollapsed ? "0px" : ""} style:overflow={isFormCollapsed ? "hidden" : ""} style:padding={isFormCollapsed ? "0" : ""} onclick={(e) => e.stopPropagation()} oncontextmenu={(e) => e.stopPropagation()}>
                <ManualEntryForm
                  {section}
                  prefill={getPrefillFields(step.entry)}
                  editIndex={-1}
                  autoEntryId={step.entry.uuid}
                  rawAttributes={step.entry.raw_attributes}
                  rawChildren={step.entry.raw_children}
                  sourceFile={step.entry.source_file}
                  initialShowSummary={openWithSummary}
                  onclose={closeEdit}
                />
              </div>
            {/if}
          {/each}
        </div>
      {/if}
    {/each}
  </div>
{/if}

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

  .timeline-group-header {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    width: 100%;
    text-align: left;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--th-text-200);
    cursor: pointer;
    transition: color 0.15s;
  }
  .timeline-group-header:hover {
    color: var(--th-text-100);
  }

  .timeline-track {
    margin-left: 0.75rem;
    padding-left: 0.75rem;
    border-left: 2px solid var(--th-border-700);
  }

  .timeline-step {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    width: 100%;
    padding: 0.375rem 0.25rem;
    margin-left: -0.25rem;
    border-radius: 0.25rem;
    transition: background-color 0.15s;
  }
  .timeline-step:hover {
    background: var(--th-bg-800);
  }
  .timeline-step-active {
    background: var(--th-bg-800);
  }

  .timeline-step-main {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    min-width: 0;
    text-align: left;
    cursor: pointer;
  }

  .timeline-step-actions {
    display: flex;
    align-items: center;
    gap: 0.125rem;
    flex-shrink: 0;
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
    margin-left: -23px;
  }

  .timeline-step-details {
    padding-left: 1.75rem;
    padding-bottom: 0.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .timeline-chip {
    display: inline-block;
    padding: 0.0625rem 0.375rem;
    font-size: 10px;
    border-radius: 0.25rem;
    background: var(--th-badge-muted-bg, var(--th-bg-800));
    color: var(--th-badge-muted-text, var(--th-text-300));
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .timeline-chip-boost {
    background: var(--th-badge-import-bg, var(--th-bg-800));
    color: var(--th-badge-import-text, var(--th-text-emerald-400));
  }

  .timeline-form-container {
    padding: 0.5rem 0 0.5rem 1.25rem;
  }
</style>
