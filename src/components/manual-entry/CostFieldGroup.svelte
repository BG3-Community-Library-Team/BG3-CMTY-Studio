<script lang="ts">
  import Plus from '@lucide/svelte/icons/plus';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import SingleSelectCombobox from '../SingleSelectCombobox.svelte';
  import {
    listCostResourceOptions,
    parseCostFieldValue,
    serializeCostFieldValue,
    getCostResourceMaxLevel,
    type CostFieldEntry,
    type CostResourceOption,
  } from '../../lib/services/costResourceDiscovery.js';

  interface Props {
    value: string;
    onchange?: (value: string) => void;
    disabled?: boolean;
  }

  let { value, onchange, disabled = false }: Props = $props();

  let entries = $state<CostFieldEntry[]>([]);
  let options = $state<CostResourceOption[]>([]);
  let loading = $state(false);
  let loadAttempted = $state(false);

  function syncFromValue(nextValue: string): void {
    const parsed = parseCostFieldValue(nextValue);
    const current = serializeCostFieldValue(entries);
    if (current !== nextValue) {
      entries = parsed;
    }
  }

  async function loadOptions(): Promise<void> {
    loading = true;
    loadAttempted = true;
    try {
      options = await listCostResourceOptions();
    } finally {
      loading = false;
    }
  }

  function emitChange(nextEntries: CostFieldEntry[]): void {
    entries = nextEntries;
    onchange?.(serializeCostFieldValue(nextEntries));
  }

  function updateEntry(index: number, patch: Partial<CostFieldEntry>): void {
    const nextEntries = entries.map((entry, entryIndex) => {
      if (entryIndex !== index) return entry;

      const nextEntry = { ...entry, ...patch };
      const maxLevel = getCostResourceMaxLevel(nextEntry.resource, options);
      if ('resource' in patch && maxLevel <= 0) {
        nextEntry.level = '';
      }
      return nextEntry;
    });

    emitChange(nextEntries);
  }

  function addEntry(): void {
    emitChange([...entries, { resource: '', quantity: '1', level: '' }]);
  }

  function removeEntry(index: number): void {
    emitChange(entries.filter((_, entryIndex) => entryIndex !== index));
  }

  function showLevelField(entry: CostFieldEntry): boolean {
    return entry.level.trim().length > 0 || getCostResourceMaxLevel(entry.resource, options) > 0;
  }

  const comboboxOptions = $derived(options.map(option => ({ value: option.name, label: option.label })));

  $effect(() => {
    syncFromValue(value);
  });

  $effect(() => {
    if (!loadAttempted && options.length === 0 && !loading) {
      loadOptions().catch(err => {
        console.warn('[CostFieldGroup] Failed to load cost resource options:', err);
      });
    }
  });
</script>

<div class="cost-field-group" class:cost-field-group-disabled={disabled}>
  {#if entries.length === 0 && !disabled}
    <button type="button" class="cost-add-btn" onclick={addEntry}>
      <Plus size={14} />
      <span>Add Cost</span>
    </button>
  {:else if entries.length === 0 && disabled}
    <div class="cost-empty-inherited">No costs set</div>
  {:else}
    <div class="cost-entry-list">
      {#each entries as entry, index}
        <div class="cost-entry-row">
          <div class="cost-entry-resource">
            <SingleSelectCombobox
              options={comboboxOptions}
              value={entry.resource}
              placeholder={loading ? 'Loading resources…' : 'Action resource or group'}
              maxDisplayed={0}
              onchange={disabled ? () => {} : (nextValue) => updateEntry(index, { resource: nextValue })}
              disabled={disabled}
            />
          </div>
          <input
            type="text"
            class="cost-input cost-entry-quantity"
            value={entry.quantity}
            placeholder="Quantity"
            aria-label="Cost quantity"
            disabled={disabled}
            oninput={disabled ? undefined : (e) => updateEntry(index, { quantity: (e.target as HTMLInputElement).value })}
          />
          {#if showLevelField(entry)}
            <input
              type="text"
              class="cost-input cost-entry-level"
              value={entry.level}
              placeholder="Level"
              aria-label="Cost level"
              disabled={disabled}
              oninput={disabled ? undefined : (e) => updateEntry(index, { level: (e.target as HTMLInputElement).value })}
            />
          {/if}
          {#if !disabled}
            <button
              type="button"
              class="cost-remove-btn"
              onclick={() => removeEntry(index)}
              aria-label="Remove cost entry"
            >
              <Trash2 size={14} />
            </button>
          {/if}
        </div>
      {/each}
    </div>
    {#if !disabled}
      <button type="button" class="cost-add-btn" onclick={addEntry}>
        <Plus size={14} />
        <span>Add Cost</span>
      </button>
    {/if}
  {/if}
</div>

<style>
  .cost-field-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .cost-entry-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .cost-entry-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 6.5rem 5.5rem auto;
    gap: 0.5rem;
    align-items: centers;
  }

  .cost-entry-resource {
    min-width: 0;
  }

  .cost-input {
    box-sizing: border-box;
    width: 100%;
    height: 1rem;
    background-color: var(--th-input-bg);
    border: 1px solid var(--th-input-border);
    border-radius: 0.25rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.8125rem;
    color: var(--th-input-text);
  }

  .cost-input:focus {
    outline: none;
    border-color: rgb(14 165 233);
  }

  .cost-add-btn,
  .cost-remove-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    border-radius: 0.25rem;
    cursor: pointer;
    transition: color 120ms ease, border-color 120ms ease, background-color 120ms ease;
  }

  .cost-add-btn {
    align-self: flex-start;
    font-size: 0.6875rem;
    padding: 0.1875rem 0.625rem;
    border: 1px dashed var(--th-border-700, var(--th-input-border));
    background: transparent;
    color: var(--th-text-400);
  }

  .cost-add-btn:hover {
    color: var(--th-text-200);
    border-color: var(--th-accent-500, #38bdf8);
    background: transparent;
  }

  .cost-remove-btn {
    width: 2rem;
    height: 2rem;
    padding: 0;
    border: none;
    border-radius: 0.1875rem;
    background: transparent;
    color: var(--th-text-500);
  }

  .cost-remove-btn:hover {
    background: var(--th-bg-700);
    color: var(--th-error, #f87171);
  }

  .cost-remove-btn:focus-visible {
    outline: none;
    background: var(--th-bg-700);
    color: var(--th-error, #f87171);
  }

  @media (max-width: 720px) {
    .cost-entry-row {
      grid-template-columns: minmax(0, 1fr) 5.5rem 4.75rem 2rem;
    }
  }

  .cost-field-group-disabled {
    opacity: 0.75;
  }

  .cost-empty-inherited {
    font-size: 0.6875rem;
    color: var(--th-text-500);
    font-style: italic;
    padding: 0.25rem 0;
  }
</style>