<script lang="ts">
  import type { LayoutField } from "../../lib/data/formLayouts.js";
  import type { SectionCapabilities } from "../../lib/data/sectionCaps.js";
  import type { ComboboxOption } from "../../lib/utils/comboboxOptions.js";
  import { tooltip } from "../../lib/actions/tooltip.js";
  import { cssToBg3Color, bg3ToCssColor } from "../../lib/utils/fieldCodec.js";
  import { isContentHandle, parseHandleVersion, autoLocalize } from "../../lib/utils/localizationManager.js";
  import { configStore } from "../../lib/stores/configStore.svelte.js";
  import { modStore } from "../../lib/stores/modStore.svelte.js";
  import Shuffle from "@lucide/svelte/icons/shuffle";
  import SingleSelectCombobox from "../SingleSelectCombobox.svelte";

  let {
    item,
    caps,
    getFieldValue,
    setFieldValue,
    getBoolValue,
    setBoolValue,
    fieldComboboxOptions,
    resolveLocaText,
    generateUuid,
    reversed = false,
  }: {
    item: LayoutField;
    caps: SectionCapabilities;
    getFieldValue: (key: string) => string;
    setFieldValue: (key: string, value: string) => void;
    getBoolValue: (key: string) => boolean;
    setBoolValue: (key: string, value: boolean) => void;
    fieldComboboxOptions: (key: string) => ComboboxOption[];
    resolveLocaText: (handle: string | undefined) => string | undefined;
    generateUuid: () => string;
    reversed?: boolean;
  } = $props();

  // --- Auto-localization support for loca: fields ---

  function handleLocaChange(fieldKey: string, inputValue: string) {
    if (!inputValue) return;

    // 1. Check for explicit loca: or # prefix → use raw handle
    const locaPrefix = inputValue.startsWith('loca:') ? 5 : inputValue.startsWith('#') ? 1 : 0;
    if (locaPrefix > 0) {
      const rawHandle = inputValue.slice(locaPrefix).trim();
      if (rawHandle) {
        const parsed = parseHandleVersion(rawHandle);
        if (parsed) {
          setFieldValue(fieldKey, rawHandle);
        } else if (isContentHandle(rawHandle)) {
          setFieldValue(fieldKey, `${rawHandle};1`);
        } else {
          setFieldValue(fieldKey, rawHandle);
        }
        return;
      }
    }

    // 2. Check if user selected an existing contentuid from the dropdown
    if (isContentHandle(inputValue) || parseHandleVersion(inputValue)) {
      setFieldValue(fieldKey, inputValue);
      return;
    }

    // 3. Plain text — auto-localize
    const currentFieldValue = getFieldValue(fieldKey);
    const { fieldValue, handle } = autoLocalize(
      inputValue,
      currentFieldValue,
      configStore.autoLocaEntries,
    );

    // Make the generated text immediately resolvable via global loca map
    const updated = new Map(modStore.localizationMap);
    updated.set(handle, inputValue);
    modStore.localizationMap = updated;

    setFieldValue(fieldKey, fieldValue);
  }

</script>

{#if item.type === 'field'}
  {@const ft = caps.fieldTypes?.[item.key]}
  {@const isNum = ft === 'int'}
  {@const hasBadge = ft && ft !== 'bool' && !caps.fieldCombobox?.[item.key]}
  {@const badgeClass = ft === 'string' || ft === 'str' ? 'badge-text' : ft === 'int' ? 'badge-number' : ft === 'float' ? 'badge-decimal' : (ft === 'string (UUID)' || ft === 'guid' || ft === 'uuid') ? 'badge-uuid' : 'badge-text'}
  {@const badgeText = ft === 'string' || ft === 'str' ? 'Text' : ft === 'int' ? 'Number' : ft === 'float' ? 'Decimal' : (ft === 'string (UUID)' || ft === 'guid' || ft === 'uuid') ? 'UUID' : ft ?? ''}
  {@const comboPlaceholder = badgeText ? `${badgeText} — Search…` : 'Search…'}
  {@const isLoca = caps.fieldCombobox?.[item.key]?.startsWith('loca:')}
  <div class="flex flex-col gap-1.5 text-xs min-w-0">
    <label for="field-{item.key}" class="font-medium text-[var(--th-text-400)]">{item.label ?? item.key}
      {#if hasBadge}
        <span class="text-[10px] font-medium px-1.5 py-0.5 rounded-full {badgeClass}">{badgeText}</span>
      {/if}
      {#if item.generateUuid}
        <button type="button"
          class="inline-flex items-center justify-center w-5 h-5 rounded text-[var(--th-text-500)]
                 hover:text-[var(--th-text-200)] hover:bg-[var(--th-bg-600)] transition-colors cursor-pointer"
          onclick={() => setFieldValue(item.key, generateUuid())}
          use:tooltip={"Generate random UUID"}
          aria-label="Generate random UUID"
        ><Shuffle size={12} /></button>
      {/if}
    </label>
    {#if isLoca}
      <div class="loca-field">
        <SingleSelectCombobox
          options={fieldComboboxOptions(item.key)}
          value={getFieldValue(item.key)}
          placeholder="Type loca: or # for handles, text: or $ for text…"
          maxDisplayed={25}
          requirePrefix={['loca:', '#', 'text:', '$']}
          textOnlyPrefixes={['text:', '$']}
          displayValueOnly={true}
          locaResolver={resolveLocaText}
          onchange={(v) => handleLocaChange(item.key, v)}
        />
      </div>
    {:else if caps.fieldCombobox?.[item.key]}
      <SingleSelectCombobox
        options={fieldComboboxOptions(item.key)}
        value={getFieldValue(item.key)}
        placeholder={comboPlaceholder}
        maxDisplayed={0}
        onchange={(v) => setFieldValue(item.key, v)}
      />
    {:else if item.colorField}
      <div class="flex items-center gap-2">
        <input
          type="color"
          class="color-picker-swatch"
          value={bg3ToCssColor(getFieldValue(item.key) || '#000000')}
          oninput={(e) => setFieldValue(item.key, cssToBg3Color((e.target as HTMLInputElement).value))}
        />
        <input
          type="text"
          class="form-input flex-1"
          value={getFieldValue(item.key)}
          oninput={(e) => setFieldValue(item.key, (e.target as HTMLInputElement).value)}
          placeholder="#AARRGGBB"
        />
        {#if getFieldValue(item.key)}
          <span class="shrink-0 w-5 h-5 rounded border border-white/20" style="background-color: {bg3ToCssColor(getFieldValue(item.key))}"></span>
        {/if}
      </div>
    {:else if item.textarea}
      <textarea class="form-input w-full" rows="2" value={getFieldValue(item.key)} oninput={(e) => setFieldValue(item.key, (e.target as HTMLTextAreaElement).value)}></textarea>
    {:else}
      <input id="field-{item.key}" type={isNum ? 'number' : 'text'} class="form-input w-full" value={getFieldValue(item.key)} oninput={(e) => setFieldValue(item.key, (e.target as HTMLInputElement).value)} />
    {/if}
  </div>
{:else}
  {#if reversed}
    <div class="flex items-center justify-end gap-2 text-xs min-w-0 self-end pb-1">
      <span class="text-[11px] cursor-pointer select-none transition-colors duration-200 {getBoolValue(item.key) ? 'text-sky-400' : 'text-[var(--th-text-500)]'}" role="button" tabindex="0" onclick={() => setBoolValue(item.key, !getBoolValue(item.key))} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setBoolValue(item.key, !getBoolValue(item.key)); } }}>{item.label ?? item.key}</span>
      <button
        type="button"
        class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 {getBoolValue(item.key) ? 'bg-sky-500' : 'bg-[var(--th-bg-600,#52525b)]'}"
        role="switch"
        aria-checked={getBoolValue(item.key)}
        aria-label={item.label ?? item.key}
        onclick={() => setBoolValue(item.key, !getBoolValue(item.key))}
      >
        <span class="pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 {getBoolValue(item.key) ? 'translate-x-4.5' : 'translate-x-0.5'}"></span>
      </button>
    </div>
  {:else}
    <div class="flex items-center gap-2 text-xs min-w-0 self-end pb-1">
      <button
        type="button"
        class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 {getBoolValue(item.key) ? 'bg-sky-500' : 'bg-[var(--th-bg-600,#52525b)]'}"
        role="switch"
        aria-checked={getBoolValue(item.key)}
        aria-label={item.label ?? item.key}
        onclick={() => setBoolValue(item.key, !getBoolValue(item.key))}
      >
        <span class="pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 {getBoolValue(item.key) ? 'translate-x-4.5' : 'translate-x-0.5'}"></span>
      </button>
      <span class="text-[11px] cursor-pointer select-none transition-colors duration-200 {getBoolValue(item.key) ? 'text-sky-400' : 'text-[var(--th-text-500)]'}" role="button" tabindex="0" onclick={() => setBoolValue(item.key, !getBoolValue(item.key))} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setBoolValue(item.key, !getBoolValue(item.key)); } }}>{item.label ?? item.key}</span>
    </div>
  {/if}
{/if}

<style>
  .form-input {
    box-sizing: border-box;
    height: 2.25rem;
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

  /* Type-hint badges for layout-rendered fields */
  .badge-uuid {
    background-color: var(--th-badge-uuid-bg, rgba(109, 40, 217, .15));
    color: var(--th-badge-uuid-text, var(--th-text-violet-400, #c4b5fd));
  }
  .badge-number {
    background-color: var(--th-badge-number-bg, rgba(3, 105, 161, .15));
    color: var(--th-badge-number-text, var(--th-text-sky-300, #7dd3fc));
  }
  .badge-text {
    background-color: var(--th-badge-text-bg, var(--th-bg-700, rgba(63, 63, 70, .5)));
    color: var(--th-badge-text-text, var(--th-text-300, #d4d4d8));
  }
  .badge-decimal {
    background-color: var(--th-badge-decimal-bg, rgba(180, 83, 9, .15));
    color: var(--th-badge-decimal-text, var(--th-text-amber-400, #fbbf24));
  }

  /* Color picker swatch (UIColor fields) */
  .color-picker-swatch {
    width: 2rem;
    height: 2rem;
    min-width: 2rem;
    padding: 0;
    border: 1px solid var(--th-border-600, #52525b);
    border-radius: 0.25rem;
    cursor: pointer;
    background: transparent;
  }
  .color-picker-swatch::-webkit-color-swatch-wrapper { padding: 2px; }
  .color-picker-swatch::-webkit-color-swatch { border: none; border-radius: 2px; }

  /* Auto-localization field layout */
  .loca-field {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .loca-handle-badge {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: 9px;
    color: var(--th-text-500);
    font-family: monospace;
  }
  .loca-handle-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .loca-copy-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--th-text-500);
    padding: 1px;
    border-radius: 2px;
  }
  .loca-copy-btn:hover {
    color: var(--th-text-200);
    background: var(--th-bg-600, rgba(255,255,255,0.06));
  }
</style>
