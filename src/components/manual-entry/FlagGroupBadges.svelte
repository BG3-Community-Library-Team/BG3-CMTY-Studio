<script lang="ts">
  import type { ComboboxOption } from "../../lib/utils/comboboxOptions.js";
  import Plus from "@lucide/svelte/icons/plus";
  import X from "@lucide/svelte/icons/x";
  import Check from "@lucide/svelte/icons/check";

  interface BoolFlagDef {
    key: string;
    label: string;
    onValue: string;
    offValue: string;
  }

  interface Props {
    fieldKeys: string[];
    fieldComboboxOptions: (key: string) => ComboboxOption[];
    getFieldValue: (key: string) => string;
    setFieldValue: (key: string, val: string) => void;
    parentFields?: Record<string, string>;
    childFields?: Record<string, string>;
    onUnsetField?: (key: string) => void;
    /** Boolean fields rendered as on/off badges under an "Other" category */
    boolFlagDefs?: BoolFlagDef[];
  }

  let {
    fieldKeys,
    fieldComboboxOptions,
    getFieldValue,
    setFieldValue,
    parentFields = {},
    childFields = {},
    onUnsetField,
    boolFlagDefs = [],
  }: Props = $props();

  const BOOL_COLOR = { bg: 'rgba(113,113,122,0.15)', text: '#a1a1aa', border: 'rgba(113,113,122,0.3)' }; // zinc

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
    ) &&
    (boolFlagDefs ?? []).every(d =>
      !Object.prototype.hasOwnProperty.call(parentFields, d.key) ||
      Object.prototype.hasOwnProperty.call(childFields, d.key)
    )
  );

  /** Active bool flag defs — any explicitly-set value (on OR off) */
  const activeBoolFlags = $derived(
    (boolFlagDefs ?? []).filter(d => {
      const v = getFieldValue(d.key);
      return v === d.onValue || v === d.offValue;
    })
  );

  function toggleBoolFlag(def: BoolFlagDef) {
    const isOn = getFieldValue(def.key) === def.onValue;
    setFieldValue(def.key, isOn ? def.offValue : def.onValue);
    showDropdown = false;
  }

  /** True when the field has been explicitly overridden with an empty string ("None" selected). */
  function isNoneSelected(key: string): boolean {
    return Object.prototype.hasOwnProperty.call(childFields, key) && getFieldValue(key) === '';
  }

  /** Override the field to an empty string, clearing all flags for that section. */
  function selectNone(fieldKey: string) {
    setFieldValue(fieldKey, '');
    showDropdown = false;
  }

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

  type ActiveBadge = { fieldKey: string; value: string; colorIdx: number; removable: boolean; isNone?: boolean };

  const activeBadges = $derived.by((): ActiveBadge[] => {
    const badges: ActiveBadge[] = [];
    for (let i = 0; i < fieldKeys.length; i++) {
      const key = fieldKeys[i];
      const inherited = isFieldInherited(key);
      if (isNoneSelected(key)) {
        // Explicitly cleared — show a "None" placeholder badge
        badges.push({ fieldKey: key, value: 'None', colorIdx: i, removable: true, isNone: true });
      } else {
        for (const flag of getEffectiveFlags(key)) {
          badges.push({ fieldKey: key, value: flag, colorIdx: i, removable: !inherited });
        }
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
        class="flag-badge {badge.isNone ? 'flag-badge-none' : ''}"
        style="background: {badge.isNone ? 'transparent' : color.bg}; color: {badge.isNone ? 'var(--th-text-500)' : color.text}; border: 1px solid {badge.isNone ? 'rgba(113,113,122,0.3)' : color.border};"
      >
        {badge.value}
        {#if badge.removable}
          <button
            type="button"
            class="flag-badge-remove"
            aria-label="{badge.isNone ? 'Clear None override' : 'Remove ' + badge.value}"
            onclick={() => badge.isNone ? onUnsetField?.(badge.fieldKey) : removeFlag(badge.fieldKey, badge.value)}
          >
            <X size={9} />
          </button>
        {/if}
      </span>
    {/each}

    {#if activeBadges.length === 0 && activeBoolFlags.length === 0}
      <span class="text-[11px] text-[var(--th-text-600)] italic">No flags set</span>
    {/if}

    {#each activeBoolFlags as def}
      {@const isOn = getFieldValue(def.key) === def.onValue}
      <span
        class="flag-badge"
        style="background: {BOOL_COLOR.bg}; color: {BOOL_COLOR.text}; border: 1px solid {BOOL_COLOR.border};"
      >
        <button
          type="button"
          class="flag-badge-toggle"
          aria-label="Toggle {def.label} (currently {isOn ? 'true' : 'false'})"
          onclick={() => setFieldValue(def.key, isOn ? def.offValue : def.onValue)}
          title="Click to set {isOn ? 'false' : 'true'}"
        >
          {#if isOn}
            <Check size={9} />
          {:else}
            <X size={9} style="opacity: 0.5" />
          {/if}
        </button>
        <span class="flag-badge-separator"></span>
        {def.label}
        <button
          type="button"
          class="flag-badge-remove"
          aria-label="Remove {def.label}"
          onclick={() => setFieldValue(def.key, '')}
        >
          <X size={9} />
        </button>
      </span>
    {/each}

    {#if !allFieldsInherited || boolFlagDefs.length > 0}
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
      class="fixed z-[9999] w-64 rounded-md border border-[var(--th-border-600)] bg-[var(--th-bg-800)] shadow-lg overflow-hidden"
      style="top: {dropdownPos.top}px; left: {dropdownPos.left}px;"
      bind:this={dropdownRef}
    >
      <div class="max-h-96 overflow-y-auto py-1">
        {#each fieldKeys as fieldKey, i}
          {@const color = FIELD_COLORS[i % FIELD_COLORS.length]}
          {@const inherited = isFieldInherited(fieldKey)}
          {@const availableOpts = inherited ? [] : getAvailableOptions(fieldKey)}

          {#if i > 0}
            <div class="mx-2 my-1 border-t border-[var(--th-border-700)]"></div>
          {/if}

          <!-- Category header with override toggle -->
          <div class="flex items-center justify-between px-3 pt-1.5 pb-1">
            <span class="text-[9px] font-semibold uppercase tracking-wider" style="color: {color.text};">
              {fieldKey}
            </span>
            {#if Object.prototype.hasOwnProperty.call(parentFields, fieldKey)}
              <button
                type="button"
                class="override-toggle" class:override-active={!inherited}
                onclick={() => inherited ? overrideField(fieldKey) : onUnsetField?.(fieldKey)}
                title="{inherited ? 'Inherited — click to override' : 'Overriding — click to revert'}"
              >
                <span class="override-track"><span class="override-thumb"></span></span>
                <span class="override-label">Override</span>
              </button>
            {/if}
          </div>

          <!-- Options -->
          {#if inherited}
            <p class="px-3 pb-2 text-[10px] italic" style="color: {color.text}; opacity: 0.6;">Using inherited value</p>
          {:else if availableOpts.length > 0}
            <div class="grid grid-cols-2 gap-1 px-2 pb-1.5">
              {#if !isNoneSelected(fieldKey)}
                <!-- None option: clears all flags for this section -->
                <button
                  type="button"
                  class="rounded-full border px-2 py-0.5 text-[10px] font-medium truncate hover:opacity-80 focus:outline-none transition-opacity col-span-2"
                  style="background: transparent; color: var(--th-text-500); border-color: rgba(113,113,122,0.4); font-style: italic;"
                  onclick={() => selectNone(fieldKey)}
                  title="Set {fieldKey} to empty (None)"
                >
                  None
                </button>
              {/if}
              {#each availableOpts as opt}
                <button
                  type="button"
                  class="rounded-full border px-2 py-0.5 text-[10px] font-medium truncate hover:opacity-80 focus:outline-none transition-opacity"
                  style="background: {color.bg}; color: {color.text}; border-color: {color.border};"
                  onclick={() => addFlag(fieldKey, opt.value)}
                  title={opt.label}
                >
                  {opt.label}
                </button>
              {/each}
            </div>
          {:else}
            <!-- Free-text input for fields with no predefined options -->
            {#if !isNoneSelected(fieldKey)}
              <div class="px-2 pb-0.5">
                <button
                  type="button"
                  class="rounded-full border px-2 py-0.5 text-[10px] font-medium w-full truncate hover:opacity-80 focus:outline-none transition-opacity"
                  style="background: transparent; color: var(--th-text-500); border-color: rgba(113,113,122,0.4); font-style: italic;"
                  onclick={() => selectNone(fieldKey)}
                  title="Set {fieldKey} to empty (None)"
                >
                  None
                </button>
              </div>
            {/if}
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
        {/each}

        {#if boolFlagDefs.length > 0}
          {#if fieldKeys.length > 0}
            <div class="mx-2 my-1 border-t border-[var(--th-border-700)]"></div>
          {/if}
          <!-- Other: boolean flags -->
          <div class="flex items-center justify-between px-3 pt-1.5 pb-1">
            <span class="text-[9px] font-semibold uppercase tracking-wider" style="color: {BOOL_COLOR.text};">Other</span>
          </div>
          <div class="grid grid-cols-2 gap-1 px-2 pb-1.5">
            {#each boolFlagDefs.filter(d => getFieldValue(d.key) !== d.onValue && getFieldValue(d.key) !== d.offValue) as def}
              <button
                type="button"
                class="rounded-full border px-2 py-0.5 text-[10px] font-medium text-left truncate hover:opacity-80 focus:outline-none transition-opacity"
                style="background: transparent; color: {BOOL_COLOR.text}; border-color: rgba(113,113,122,0.3);"
                onclick={() => toggleBoolFlag(def)}
                title={def.label}
              >
                {def.label}
              </button>
            {/each}
            {#if boolFlagDefs.filter(d => getFieldValue(d.key) !== d.onValue && getFieldValue(d.key) !== d.offValue).length === 0}
              <p class="col-span-2 px-1 pb-2 text-[10px] italic" style="color: {BOOL_COLOR.text}; opacity: 0.6;">All flags active</p>
            {/if}
          </div>
        {/if}
      </div>
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

  .flag-badge-none {
    font-style: italic;
    opacity: 0.75;
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

  .flag-badge-toggle {
    display: inline-flex;
    align-items: center;
    opacity: 0.85;
    transition: opacity 0.15s;
    cursor: pointer;
    padding: 0;
    background: none;
    border: none;
    color: inherit;
  }
  .flag-badge-toggle:hover { opacity: 1; }

  .flag-badge-separator {
    width: 1px;
    height: 0.75em;
    background: currentColor;
    opacity: 0.3;
    flex-shrink: 0;
  }

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

  .override-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.15rem 0.25rem;
    border-radius: 0.25rem;
    color: var(--th-text-500, #71717a);
    transition: color 0.15s;
  }
  .override-toggle:hover { color: var(--th-text-300, #d4d4d8); }
  .override-toggle.override-active { color: var(--th-accent-400, #60a5fa); }

  .override-label { font-size: 0.625rem; }

  .override-track {
    width: 1.5rem;
    height: 0.875rem;
    border-radius: 9999px;
    background: var(--th-bg-600, #52525b);
    position: relative;
    flex-shrink: 0;
    transition: background 0.15s;
  }
  .override-active .override-track { background: var(--th-accent-500, #3b82f6); }

  .override-thumb {
    position: absolute;
    top: 0.125rem;
    left: 0.125rem;
    width: 0.625rem;
    height: 0.625rem;
    border-radius: 50%;
    background: white;
    transition: transform 0.15s;
  }
  .override-active .override-thumb { transform: translateX(0.625rem); }

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
