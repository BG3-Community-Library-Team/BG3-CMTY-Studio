<script lang="ts">
  import type { SectionCapabilities } from "../../lib/data/sectionCaps.js";
  import type { ComboboxOption } from "../../lib/utils/comboboxOptions.js";
  import type { ListItemsInfo } from "../../lib/utils/tauri.js";
  import { validationKey } from "../../lib/data/fieldKeys.js";
  import SingleSelectCombobox from "../SingleSelectCombobox.svelte";
  import X from "@lucide/svelte/icons/x";

  let {
    fields = $bindable(),
    caps,
    warnKeys,
    validationErrors,
    listItemsCache,
    getFieldComboboxOptions,
    onaddField,
    onremoveField,
    allFieldKeysUsed = false,
    resolveLocaText,
  }: {
    fields: { key: string; value: string }[];
    caps: SectionCapabilities;
    warnKeys: Set<string>;
    validationErrors: { key: string; message: string; severity: "error" | "warning" }[];
    listItemsCache: Map<string, ListItemsInfo>;
    getFieldComboboxOptions: (fieldKey: string) => ComboboxOption[];
    onaddField: () => void;
    onremoveField: (i: number) => void;
    allFieldKeysUsed?: boolean;
    resolveLocaText?: (handle: string | undefined) => string | undefined;
  } = $props();
</script>

<fieldset class="space-y-1">
  {#each fields as f, i (i)}
    {@const comboboxOpts = getFieldComboboxOptions(f.key)}
    <div class="flex items-end gap-2">
      {#if comboboxOpts.length > 0}
        <!-- Field with combobox suggestions + type badge -->
        {@const ft = caps.fieldTypes?.[f.key]}
        {@const ftBadge = ft === 'string (UUID)' ? 'UUID' : ft === 'string' ? 'Text' : ft === 'int' ? 'Number' : ft || ''}
        {@const isLoca = caps.fieldCombobox?.[f.key]?.startsWith('loca:')}
        <div class="flex-1 min-w-0">
          <SingleSelectCombobox
            label={f.key}
            options={comboboxOpts}
            value={f.value}
            placeholder={ftBadge ? `${ftBadge} — Select or type value…` : "Select or type value…"}
            maxDisplayed={caps.fieldCombobox?.[f.key]?.startsWith('loca:') ? 25 : 0}
            requirePrefix={isLoca ? ['loca:', '#', 'text:', '$'] : undefined}
            textOnlyPrefixes={isLoca ? ['text:', '$'] : undefined}
            displayValueOnly={!!isLoca}
            locaResolver={isLoca ? resolveLocaText : undefined}
            onchange={(v) => f.value = v}
            warnClass={warnKeys.has(validationKey(f.key)) ? (validationErrors.find(e => e.key === validationKey(f.key))?.severity === 'error' ? 'field-err' : 'field-warn') : ''}
          />
        </div>
      {:else if caps.fieldTypes?.[f.key] === "int"}
        <label class="flex flex-col gap-0.5 flex-1">
          <span class="text-[10px] text-[var(--th-text-500)]">{f.key}</span>
          <div class="relative">
            <input
              type="number"
              class="form-input w-full h-[30px] {warnKeys.has(validationKey(f.key)) ? (validationErrors.find(e => e.key === validationKey(f.key))?.severity === 'error' ? 'field-err' : 'field-warn') : ''}"
              bind:value={f.value}
              placeholder="0"
              style="padding-right: 4rem;"
            />
            <span class="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs font-medium px-1.5 py-0.5 rounded-full badge-number pointer-events-none">Number</span>
          </div>
        </label>
      {:else if caps.fieldTypes?.[f.key] === "bool"}
        <span class="text-xs text-[var(--th-text-300)] flex-1 truncate" title={f.key}>{f.key}</span>
        <div class="flex items-center gap-2 h-[30px] shrink-0">
          <button
            type="button"
            class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 {f.value === 'true' ? 'bg-emerald-500' : 'bg-[var(--th-bg-600,#52525b)]'}"
            role="switch"
            aria-checked={f.value === 'true'}
            aria-label="{f.key} toggle"
            onclick={() => f.value = f.value === 'true' ? 'false' : 'true'}
          >
            <span
              class="pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 {f.value === 'true' ? 'translate-x-4' : 'translate-x-0.5'}"
            ></span>
          </button>
          <span class="text-[10px] text-[var(--th-text-500)] w-8">{f.value === 'true' ? 'true' : 'false'}</span>
        </div>
      {:else}
        {@const t = caps.fieldTypes?.[f.key]}
        {@const hasBadge = t && t !== 'bool'}
        <label class="flex flex-col gap-0.5 flex-1">
          <span class="text-[10px] text-[var(--th-text-500)]">{f.key}</span>
          <div class="relative">
          <input
            type="text"
            class="form-input w-full {warnKeys.has(validationKey(f.key)) ? (validationErrors.find(e => e.key === validationKey(f.key))?.severity === 'error' ? 'field-err' : 'field-warn') : ''}"
            bind:value={f.value}
            placeholder="Value"
            style={hasBadge ? "padding-right: 4rem;" : ""}
          />
          {#if hasBadge}
            {@const badgeClass = t === 'string' || t === 'str' ? 'badge-text' : t === 'float' ? 'badge-decimal' : (t === 'guid' || t === 'uuid' || t === 'string (UUID)') ? 'badge-uuid' : 'badge-text'}
            {@const badgeText = t === 'string' || t === 'str' ? 'Text' : t === 'float' ? 'Decimal' : (t === 'guid' || t === 'uuid') ? 'UUID' : t === 'string (UUID)' ? 'UUID' : t}
            <span class="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs font-medium px-1.5 py-0.5 rounded-full pointer-events-none {badgeClass}">{badgeText}</span>
          {/if}
          </div>
        </label>
      {/if}
      <button class="text-xs text-red-400 hover:text-red-300 min-w-6 min-h-6 inline-flex items-center justify-center self-end" onclick={() => onremoveField(i)} aria-label="Remove field"><X size={14} /></button>
    </div>
    <!-- SpellList preview: show list contents when a SpellList UUID is set -->
    {#if f.key === "SpellList" && f.value.trim()}
      {@const spellInfo = listItemsCache.get(f.value.trim())}
      {#if spellInfo && spellInfo.items.length > 0}
        <details class="bg-zinc-800/60 rounded border border-zinc-700/50 ml-1">
          <summary class="text-xs text-[var(--th-text-400)] cursor-pointer hover:text-[var(--th-text-200)] px-2 py-1 select-none">
            {spellInfo.display_name || f.value} — {spellInfo.items.length} {spellInfo.item_key.toLowerCase()}
          </summary>
          <div class="px-2 pb-1.5 pt-0.5 flex flex-wrap gap-1">
            {#each spellInfo.items as item}
              <span class="text-[11px] px-1.5 py-0.5 rounded bg-sky-700/40 text-sky-300 font-mono">{item}</span>
            {/each}
          </div>
        </details>
      {:else if spellInfo}
        <div class="text-xs text-[var(--th-text-500)] px-2 ml-1">{spellInfo.display_name || f.value} — empty list</div>
      {/if}
    {/if}
  {/each}
  {#if !allFieldKeysUsed}
  <button class="text-xs text-sky-400 hover:text-sky-300" onclick={onaddField}>+ Add field</button>
  {/if}
</fieldset>

<style>
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
  .form-input.field-warn {
    border-color: rgb(245 158 11);
  }
  .form-input.field-err {
    border-color: rgb(239 68 68);
  }
  .badge-uuid {
    background-color: var(--th-badge-uuid-bg, rgba(109, 40, 217, 0.5));
    color: var(--th-badge-uuid-text, var(--th-text-violet-400, #c4b5fd));
  }
  .badge-number {
    background-color: var(--th-badge-number-bg, rgba(3, 105, 161, 0.5));
    color: var(--th-badge-number-text, var(--th-text-sky-300, #7dd3fc));
  }
  .badge-text {
    background-color: var(--th-badge-text-bg, var(--th-bg-700, rgba(82, 82, 91, 0.5)));
    color: var(--th-badge-text-text, var(--th-text-300, #d4d4d8));
  }
  .badge-decimal {
    background-color: var(--th-badge-decimal-bg, rgba(180, 83, 9, 0.5));
    color: var(--th-badge-decimal-text, var(--th-text-amber-400, #fcd34d));
  }
</style>
