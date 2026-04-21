<script lang="ts">
  import type { ComboboxOption } from "../../lib/utils/comboboxOptions.js";
  import Plus from "@lucide/svelte/icons/plus";
  import X from "@lucide/svelte/icons/x";

  interface Props {
    fieldKeys: string[];
    fieldComboboxOptions: (key: string) => ComboboxOption[];
    getFieldValue: (key: string) => string;
    setFieldValue: (key: string, val: string) => void;
    parentFields?: Record<string, string>;
    childFields?: Record<string, string>;
  }

  let {
    fieldKeys,
    fieldComboboxOptions,
    getFieldValue,
    setFieldValue,
    parentFields = {},
    childFields = {},
  }: Props = $props();

  // Per-field colors indexed by position in fieldKeys
  const FIELD_COLORS = [
    { bg: 'rgba(59,130,246,0.15)',  text: '#60a5fa', border: 'rgba(59,130,246,0.3)'  },  // blue
    { bg: 'rgba(168,85,247,0.15)', text: '#c084fc', border: 'rgba(168,85,247,0.3)'  },  // purple
    { bg: 'rgba(20,184,166,0.15)', text: '#2dd4bf', border: 'rgba(20,184,166,0.3)'  },  // teal
    { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24', border: 'rgba(245,158,11,0.3)'  },  // amber
    { bg: 'rgba(244,63,94,0.15)',  text: '#fb7185', border: 'rgba(244,63,94,0.3)'   },  // rose
    { bg: 'rgba(34,197,94,0.15)',  text: '#4ade80', border: 'rgba(34,197,94,0.3)'   },  // green
  ];

  let showDropdown = $state(false);
  let addBtnRef: HTMLButtonElement | null = $state(null);
  let dropdownRef: HTMLDivElement | null = $state(null);
  let dropdownPos = $state({ top: 0, left: 0 });
  let freeTextInputs = $state<Record<string, string>>({});

  /** Returns true when the field has no explicit child value — it's inherited from parent. */
  function isFieldInherited(key: string): boolean {
    return (
      Object.prototype.hasOwnProperty.call(parentFields, key) &&
      !Object.prototype.hasOwnProperty.call(childFields, key)
    );
  }

  const hasInheritanceData = $derived(Object.keys(parentFields).length > 0);

  const allFieldsInherited = $derived(
    hasInheritanceData &&
    fieldKeys.every(k =>
      Object.prototype.hasOwnProperty.call(parentFields, k) &&
      !Object.prototype.hasOwnProperty.call(childFields, k)
    )
  );

  /** Get the effective flag values for a field (child if exists, else parent). */
  function getEffectiveFlags(key: string): string[] {
    let val: string;
    if (Object.prototype.hasOwnProperty.call(childFields, key)) {
      val = getFieldValue(key);
    } else {
      val = parentFields[key] ?? '';
    }
    return val ? val.split(';').map(s => s.trim()).filter(Boolean) : [];
  }

  type ActiveBadge = { fieldKey: string; value: string; colorIdx: number; removable: boolean };

  const activeBadges = $derived.by((): ActiveBadge[] => {
    const badges: ActiveBadge[] = [];
    for (let i = 0; i < fieldKeys.length; i++) {
      const key = fieldKeys[i];
      const inherited = isFieldInherited(key);
      for (const flag of getEffectiveFlags(key)) {
        badges.push({ fieldKey: key, value: flag, colorIdx: i, removable: !inherited });
      }
    }
    return badges;
  });

  function removeFlag(fieldKey: string, flagValue: string) {
    const newFlags = getEffectiveFlags(fieldKey).filter(f => f !== flagValue);
    setFieldValue(fieldKey, newFlags.join(';'));
  }

  function addFlag(fieldKey: string, flagValue: string) {
    const trimmed = flagValue.trim();
    if (!trimmed) return;
    const current = getEffectiveFlags(fieldKey);
    if (!current.includes(trimmed)) {
      setFieldValue(fieldKey, [...current, trimmed].join(';'));
    }
    showDropdown = false;
    freeTextInputs = { ...freeTextInputs, [fieldKey]: '' };
  }

  /** Copy parent's value into childFields so the field becomes overridable. */
  function overrideField(fieldKey: string) {
    const parentVal = parentFields[fieldKey] ?? '';
    setFieldValue(fieldKey, parentVal);
  }

  function getAvailableOptions(fieldKey: string): ComboboxOption[] {
    const active = new Set(getEffectiveFlags(fieldKey));
    return fieldComboboxOptions(fieldKey).filter(opt => !active.has(opt.value));
  }

  function toggleDropdown() {
    showDropdown = !showDropdown;
    if (showDropdown && addBtnRef) {
      const rect = addBtnRef.getBoundingClientRect();
      dropdownPos = { top: rect.bottom + 4, left: rect.left };
    }
  }

  function handleClickOutside(e: MouseEvent) {
    if (dropdownRef && !dropdownRef.contains(e.target as Node)) {
      showDropdown = false;
    }
  }

  $effect(() => {
    if (showDropdown) {
      document.addEventListener('click', handleClickOutside, true);
      return () => document.removeEventListener('click', handleClickOutside, true);
    }
  });
</script>

<div class="flag-group-badges">
  <!-- Badge strip -->
  <div class="flex flex-wrap gap-1.5 items-center py-1 min-h-[2rem]">
    {#each activeBadges as badge}
      {@const color = FIELD_COLORS[badge.colorIdx % FIELD_COLORS.length]}
      <span
        class="flag-badge"
        style="background: {color.bg}; color: {color.text}; border: 1px solid {color.border};"
      >
        {badge.value}
        {#if badge.removable}
          <button
            type="button"
            class="flag-badge-remove"
            aria-label="Remove {badge.value}"
            onclick={() => removeFlag(badge.fieldKey, badge.value)}
          >
            <X size={9} />
          </button>
        {/if}
      </span>
    {/each}

    {#if activeBadges.length === 0}
      <span class="text-[11px] text-[var(--th-text-600)] italic">No flags set</span>
    {/if}

    {#if !allFieldsInherited}
      <button
        type="button"
        bind:this={addBtnRef}
        class="flag-add-btn"
        onclick={toggleDropdown}
      >
        <Plus size={10} />
        Add flag
      </button>
    {/if}
  </div>

  <!-- Dropdown portal -->
  {#if showDropdown}
    <div
      class="flag-dropdown"
      style="top: {dropdownPos.top}px; left: {dropdownPos.left}px;"
      bind:this={dropdownRef}
    >
      {#each fieldKeys as fieldKey, i}
        {@const color = FIELD_COLORS[i % FIELD_COLORS.length]}
        {@const inherited = isFieldInherited(fieldKey)}
        {@const availableOpts = inherited ? [] : getAvailableOptions(fieldKey)}
        <div class="flag-dropdown-category">
          <div class="flag-dropdown-category-header" style="color: {color.text};">
            {fieldKey}
          </div>
          {#if inherited}
            <button
              type="button"
              class="flag-override-btn"
              onclick={() => overrideField(fieldKey)}
            >
              Override
            </button>
          {:else if availableOpts.length > 0}
            {#each availableOpts as opt}
              <button
                type="button"
                class="flag-dropdown-option"
                onclick={() => addFlag(fieldKey, opt.value)}
              >
                {opt.label}
              </button>
            {/each}
          {:else}
            <!-- Free-text input for fields with no predefined options -->
            <div class="flag-freetext">
              <input
                type="text"
                class="flag-freetext-input"
                placeholder="Type flag value…"
                value={freeTextInputs[fieldKey] ?? ''}
                oninput={(e) => { freeTextInputs = { ...freeTextInputs, [fieldKey]: (e.currentTarget as HTMLInputElement).value }; }}
                onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFlag(fieldKey, freeTextInputs[fieldKey] ?? ''); } }}
              />
              <button
                type="button"
                class="flag-freetext-add"
                onclick={() => addFlag(fieldKey, freeTextInputs[fieldKey] ?? '')}
              >
                Add
              </button>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .flag-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.6875rem;
    font-weight: 500;
    padding: 0.1rem 0.4rem;
    border-radius: 0.25rem;
    white-space: nowrap;
  }

  .flag-badge-remove {
    display: inline-flex;
    align-items: center;
    opacity: 0.6;
    transition: opacity 0.15s;
    cursor: pointer;
    padding: 0;
    background: none;
    border: none;
    color: inherit;
  }
  .flag-badge-remove:hover { opacity: 1; }

  .flag-add-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.6875rem;
    padding: 0.15rem 0.5rem;
    border-radius: 0.25rem;
    border: 1px dashed var(--th-border-500, #52525b);
    color: var(--th-text-400, #a1a1aa);
    background: transparent;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }
  .flag-add-btn:hover {
    color: var(--th-text-200, #e4e4e7);
    border-color: var(--th-border-300, #71717a);
  }

  .flag-dropdown {
    position: fixed;
    z-index: 100;
    background: var(--th-bg-800, #27272a);
    border: 1px solid var(--th-border-600, #3f3f46);
    border-radius: 0.5rem;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    min-width: 200px;
    max-height: 380px;
    overflow-y: auto;
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .flag-dropdown-category { display: flex; flex-direction: column; gap: 0.125rem; }

  .flag-dropdown-category-header {
    font-size: 0.625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 0.1rem 0.25rem 0.25rem;
    border-bottom: 1px solid var(--th-border-700, #3f3f46);
    margin-bottom: 0.125rem;
  }

  .flag-dropdown-option {
    display: block;
    width: 100%;
    text-align: left;
    font-size: 0.6875rem;
    padding: 0.2rem 0.4rem;
    border-radius: 0.25rem;
    background: none;
    border: none;
    color: var(--th-text-300, #d4d4d8);
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
  }
  .flag-dropdown-option:hover {
    background: var(--th-bg-700, #3f3f46);
    color: var(--th-text-100, #f4f4f5);
  }

  .flag-override-btn {
    display: block;
    width: 100%;
    text-align: left;
    font-size: 0.6875rem;
    padding: 0.2rem 0.4rem;
    border-radius: 0.25rem;
    border: 1px solid var(--th-border-500, #52525b);
    background: none;
    color: var(--th-text-400, #a1a1aa);
    cursor: pointer;
    transition: background 0.1s, color 0.1s, border-color 0.1s;
  }
  .flag-override-btn:hover {
    background: var(--th-bg-700, #3f3f46);
    color: var(--th-text-200, #e4e4e7);
    border-color: var(--th-border-400, #71717a);
  }

  .flag-freetext {
    display: flex;
    gap: 0.25rem;
    align-items: center;
    padding: 0.1rem 0;
  }

  .flag-freetext-input {
    flex: 1;
    font-size: 0.6875rem;
    padding: 0.2rem 0.4rem;
    border-radius: 0.25rem;
    border: 1px solid var(--th-border-500, #52525b);
    background: var(--th-bg-900, #18181b);
    color: var(--th-text-200, #e4e4e7);
    outline: none;
    min-width: 0;
  }
  .flag-freetext-input:focus {
    border-color: var(--th-accent-500, #3b82f6);
  }

  .flag-freetext-add {
    font-size: 0.6875rem;
    padding: 0.2rem 0.5rem;
    border-radius: 0.25rem;
    border: 1px solid var(--th-border-500, #52525b);
    background: none;
    color: var(--th-text-400, #a1a1aa);
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.1s, color 0.1s;
  }
  .flag-freetext-add:hover {
    background: var(--th-bg-700, #3f3f46);
    color: var(--th-text-200, #e4e4e7);
  }
</style>
