<script lang="ts">
  import { settingsStore } from "../../lib/stores/settingsStore.svelte.js";
  import Shuffle from "@lucide/svelte/icons/shuffle";
  import { tooltip } from "../../lib/actions/tooltip.js";
  import SingleSelectCombobox from "../SingleSelectCombobox.svelte";
  import MultiSelectCombobox from "../MultiSelectCombobox.svelte";
  import LayoutCell from "./LayoutCell.svelte";
  import type { SectionCapabilities } from "../../lib/data/sectionCaps.js";
  import type { FormLayout, LayoutField } from "../../lib/data/formLayouts.js";
  import type { ComboboxOption } from "../../lib/utils/comboboxOptions.js";
  import type { ListItemsInfo } from "../../lib/utils/tauri.js";

  let {
    caps,
    uuids = $bindable(),
    displayName = $bindable(),
    entryComment = $bindable(),
    generateUuid,
    warnKeys,
    combinedSpellIdOptions,
    listItems = $bindable(),
    listInheritList = $bindable(),
    listExcludeList = $bindable(),
    listItemsLabel,
    listItemsOptions,
    listItemsPlaceholder,
    listItemsCache,
    availableListOptions,
    argDefinitionsList = $bindable(),
    availableActionResourceOptions,
    sectionUuidOptions,
    layout,
    getFieldValue,
    setFieldValue,
    getBoolValue,
    setBoolValue,
    fieldComboboxOptions,
    resolveLocaText,
    statType = '',
  }: {
    caps: SectionCapabilities;
    uuids: string[];
    displayName: string;
    entryComment: string;
    generateUuid: () => string;
    warnKeys: Set<string>;
    combinedSpellIdOptions: ComboboxOption[];
    listItems: string;
    listInheritList: string[];
    listExcludeList: string[];
    listItemsLabel: string;
    listItemsOptions: ComboboxOption[];
    listItemsPlaceholder: string;
    listItemsCache: Map<string, ListItemsInfo>;
    availableListOptions: ComboboxOption[];
    argDefinitionsList: string[];
    availableActionResourceOptions: ComboboxOption[];
    sectionUuidOptions: ComboboxOption[];
    layout: FormLayout | undefined;
    getFieldValue: (key: string) => string;
    setFieldValue: (key: string, value: string) => void;
    getBoolValue: (key: string) => boolean;
    setBoolValue: (key: string, value: boolean) => void;
    fieldComboboxOptions: (key: string) => ComboboxOption[];
    resolveLocaText: (handle: string | undefined) => string | undefined;
    statType?: string;
  } = $props();
</script>

<!-- Identity fields -->
{#if caps.isSpell}
  <div class="flex flex-col gap-0.5 text-xs">
    <span class="text-[var(--th-text-400)]">ID (Stat Entry Name) <span class="text-red-400">*</span></span>
    <SingleSelectCombobox
      options={combinedSpellIdOptions}
      value={displayName}
      placeholder="Shout_MySpell"
      onchange={(v) => displayName = v}
    />
  </div>
{:else if caps.isList}
  <div class="space-y-2">
    <div class="flex items-center gap-2">
      <div class="flex-1 min-w-0 text-xs">
        <label class="text-[var(--th-text-400)] text-xs flex items-center gap-1">UUID<span class="text-red-400 ml-0.5">*</span>
          <button
            type="button"
            class="inline-flex items-center justify-center w-5 h-5 rounded text-[var(--th-text-500)]
                   hover:text-[var(--th-text-200)] hover:bg-[var(--th-bg-600)] transition-colors cursor-pointer"
            onclick={() => uuids = [generateUuid()]}
            use:tooltip={"Generate random UUID"}
            aria-label="Generate random UUID"
          ><Shuffle size={12} /></button>
        </label>
        <SingleSelectCombobox
          options={availableListOptions}
          value={uuids[0] ?? ""}
          placeholder="Search or paste UUID…"
          required
          onchange={(v) => uuids = v ? [v] : []}
        />
      </div>
      <label class="flex flex-col gap-0.5 text-xs flex-1 min-w-0">
        <span class="text-[var(--th-text-400)]">Entry Label</span>
        <input type="text" class="form-input w-full" bind:value={displayName} placeholder="Display name" />
      </label>
    </div>
    <div class="grid grid-cols-1 gap-2">
      {#snippet listItemsField()}
        <div class="flex flex-col gap-0.5 text-xs col-span-2">
          <span class="text-[var(--th-text-400)]">{listItemsLabel} (select or type StatIDs)</span>
          <MultiSelectCombobox
            label=""
            options={listItemsOptions}
            selected={listItems ? listItems.split(";").map(v => v.trim()).filter(Boolean) : []}
            placeholder={listItemsPlaceholder}
            onchange={(vals) => listItems = vals.join(";")}
          />
        </div>
      {/snippet}
      {@render listItemsField()}
    </div>
    {#if settingsStore.enableCfIntegration}
    <div class="flex flex-col gap-0.5 text-xs">
      <MultiSelectCombobox
        label="Inherit from lists"
        options={availableListOptions}
        selected={listInheritList}
        placeholder="Search or paste UUIDs…"
        onchange={(vals) => listInheritList = vals}
      />
      {#if listInheritList.length > 0}
        <div class="space-y-1 mt-1">
          {#each listInheritList as uuid}
            {@const info = listItemsCache.get(uuid)}
            {#if info && info.items.length > 0}
              <details class="bg-zinc-800/60 rounded border border-zinc-700/50">
                <summary class="text-xs text-[var(--th-text-400)] cursor-pointer hover:text-[var(--th-text-200)] px-2 py-1 select-none">
                  {info.display_name || uuid} — {info.items.length} {info.item_key.toLowerCase()}
                </summary>
                <div class="px-2 pb-1.5 pt-0.5 flex flex-wrap gap-1">
                  {#each info.items as item}
                    <span class="text-[11px] px-1.5 py-0.5 rounded bg-sky-700/40 text-sky-400 font-mono">{item}</span>
                  {/each}
                </div>
              </details>
            {:else if info}
              <div class="text-xs text-[var(--th-text-500)] px-2">{info.display_name || uuid} — empty</div>
            {/if}
          {/each}
        </div>
      {/if}
    </div>
    <div class="flex flex-col gap-0.5 text-xs">
      <MultiSelectCombobox
        label="Exclude from lists"
        options={availableListOptions}
        selected={listExcludeList}
        placeholder="Search or paste UUIDs…"
        onchange={(vals) => listExcludeList = vals}
      />
      {#if listExcludeList.length > 0}
        <div class="space-y-1 mt-1">
          {#each listExcludeList as uuid}
            {@const info = listItemsCache.get(uuid)}
            {#if info && info.items.length > 0}
              <details class="bg-zinc-800/60 rounded border border-zinc-700/50">
                <summary class="text-xs text-[var(--th-text-400)] cursor-pointer hover:text-[var(--th-text-200)] px-2 py-1 select-none">
                  {info.display_name || uuid} — {info.items.length} {info.item_key.toLowerCase()}
                </summary>
                <div class="px-2 pb-1.5 pt-0.5 flex flex-wrap gap-1">
                  {#each info.items as item}
                    <span class="text-[11px] px-1.5 py-0.5 rounded bg-red-900/50 text-red-300 font-mono">{item}</span>
                  {/each}
                </div>
              </details>
            {:else if info}
              <div class="text-xs text-[var(--th-text-500)] px-2">{info.display_name || uuid} — empty</div>
            {/if}
          {/each}
        </div>
      {/if}
    </div>
    {/if}
  </div>
{:else if caps.isARG}
  <div class="space-y-2">
    <div class="flex items-center gap-2">
      <div class="w-1/2 min-w-0 text-xs">
        <label class="text-[var(--th-text-400)] text-xs flex items-center gap-1">UUID<span class="text-red-400 ml-0.5">*</span>
          <button
            type="button"
            class="inline-flex items-center justify-center w-5 h-5 rounded text-[var(--th-text-500)]
                   hover:text-[var(--th-text-200)] hover:bg-[var(--th-bg-600)] transition-colors cursor-pointer"
            onclick={() => uuids = [generateUuid()]}
            use:tooltip={"Generate random UUID"}
            aria-label="Generate random UUID"
          ><Shuffle size={12} /></button>
        </label>
        <SingleSelectCombobox
          options={sectionUuidOptions}
          value={uuids[0] ?? ""}
          placeholder="Search or paste UUID…"
          required
          onchange={(v) => uuids = v ? [v] : []}
        />
      </div>
      <label class="flex flex-col gap-0.5 text-xs flex-1 min-w-0">
        <span class="text-[var(--th-text-400)]">Entry Label</span>
        <input type="text" class="form-input w-full" bind:value={displayName} placeholder="Display name" />
      </label>
    </div>
    <div class="flex flex-col gap-0.5 text-xs">
      <MultiSelectCombobox
        label="Action Resources"
        options={availableActionResourceOptions}
        selected={argDefinitionsList}
        placeholder="Search or paste UUIDs…"
        onchange={(vals) => argDefinitionsList = vals}
      />
    </div>
  </div>
{:else}
  <div class="space-y-2">
    <div class="flex items-center gap-2">
        <div class="w-1/2 min-w-0 text-xs">
          <label class="text-[var(--th-text-400)] text-xs flex items-center gap-1">UUID<span class="text-red-400 ml-0.5">*</span>
            <button
              type="button"
              class="inline-flex items-center justify-center w-5 h-5 rounded text-[var(--th-text-500)]
                     hover:text-[var(--th-text-200)] hover:bg-[var(--th-bg-600)] transition-colors cursor-pointer"
              onclick={() => uuids = [generateUuid()]}
              use:tooltip={"Generate random UUID"}
              aria-label="Generate random UUID"
            ><Shuffle size={12} /></button>
          </label>
          <SingleSelectCombobox
            options={sectionUuidOptions}
            value={uuids[0] ?? ""}
            placeholder="Search or paste UUID…"
            required
            warnClass={warnKeys.has("uuid:cross") ? "border-red-500" : warnKeys.has("uuid:exists") ? "border-amber-500" : ""}
            onchange={(v) => uuids = v ? [v] : []}
          />
        </div>
        <label class="flex flex-col gap-0.5 text-xs flex-1 min-w-0">
          <span class="text-[var(--th-text-400)]">Entry Label</span>
          <input type="text" class="form-input w-full" bind:value={displayName} placeholder="Display name" />
        </label>
    </div>
    {#if settingsStore.enableEntryComments}
    <div class="flex flex-col gap-0.5 text-xs">
      <label class="flex flex-col gap-0.5 text-xs">
        <span class="text-[var(--th-text-400)]">Comment <span class="text-zinc-600">(YAML only)</span></span>
        <input
          type="text"
          class="form-input w-full"
          placeholder="e.g. Adds Shadow Sorcery origin spell"
          bind:value={entryComment}
        />
      </label>
    </div>
    {/if}
    <!-- Layout: identity extras (fields below UUID/Label, above HR) -->
    {#if layout?.identityExtras}
      {#each layout.identityExtras as row}
        <div class="grid gap-2" style="grid-template-columns: repeat({row.items.length}, minmax(0, 1fr));">
          {#each row.items as item}
            <LayoutCell {item} {caps} {getFieldValue} {setFieldValue} {getBoolValue} {setBoolValue} {fieldComboboxOptions} {resolveLocaText} {generateUuid} {statType} />
          {/each}
        </div>
      {/each}
    {/if}
  </div>
{/if}

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
</style>
