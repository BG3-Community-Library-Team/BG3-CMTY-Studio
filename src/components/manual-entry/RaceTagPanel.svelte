<script lang="ts">
  import { configStore } from "../../lib/stores/configStore.svelte.js";
  import { modStore } from "../../lib/stores/modStore.svelte.js";
  import { resolveLoca, parseHandleVersion, isContentHandle, autoLocalize } from "../../lib/utils/localizationManager.js";
  import type { ChildItem } from "../../lib/utils/fieldCodec.js";
  import type { ComboboxOption } from "../../lib/utils/comboboxOptions.js";
  import MultiSelectCombobox from "../MultiSelectCombobox.svelte";
  import SingleSelectCombobox from "../SingleSelectCombobox.svelte";
  import { tooltip } from "../../lib/actions/tooltip.js";

  import X from "@lucide/svelte/icons/x";
  import Plus from "@lucide/svelte/icons/plus";
  import { generateUuid } from "../../lib/utils/uuid.js";

  let {
    raceName,
    raceDisplayName,
    raceDescription,
    raceEntryUuid = '',
    children = $bindable(),
    getChildValueOptions,
    isNewEntry = false,
  }: {
    raceName: string;
    raceDisplayName: string;
    raceDescription: string;
    raceEntryUuid?: string;
    children: ChildItem[];
    getChildValueOptions: (type: string) => ComboboxOption[];
    isNewEntry?: boolean;
  } = $props();

  // Sentinel values for dummy combobox entries representing the subform tags
  const RACE_TAG_SENTINEL = '__race_tag__';
  const REALLY_TAG_SENTINEL = '__really_tag__';

  interface TagPreview {
    name: string;
    displayName: string;
    description: string;
    displayDescription: string;
  }

  let showRaceTag = $state(false);
  let showReallyTag = $state(false);

  let tag1: TagPreview = $state({
    name: '',
    displayName: '',
    description: '',
    displayDescription: '',
  });

  let tag2: TagPreview = $state({
    name: '',
    displayName: '',
    description: '',
    displayDescription: '',
  });

  /** Resolved description text (reactive — updates when loca data loads) */
  let resolvedDescription = $derived(
    resolveLoca(raceDescription, configStore.autoLocaEntries, (h) => modStore.lookupLocalizedString(h))
  );

  /** Extract the bare contentuid handle from the Description field value */
  let descriptionHandle = $derived.by(() => {
    if (!raceDescription) return '';
    const stripped = raceDescription.startsWith('|') && raceDescription.endsWith('|') ? raceDescription.slice(1, -1) : raceDescription;
    const parsed = parseHandleVersion(stripped);
    if (parsed) return parsed.handle;
    if (isContentHandle(stripped)) return stripped;
    return '';
  });

  /** Resolved localized text — empty string if resolution failed (still a raw handle) */
  let resolvedDescriptionText = $derived(
    resolvedDescription !== raceDescription && resolvedDescription !== '' ? resolvedDescription : ''
  );

  // Auto-fill from race fields
  $effect(() => {
    tag1.name = raceName ? `|${raceName}|` : '';
    tag1.displayName = raceDisplayName;

    // DisplayDescription = the raw contentuid handle
    tag1.displayDescription = descriptionHandle;
    // Description = the resolved localized text wrapped in pipes
    tag1.description = resolvedDescriptionText ? `|${resolvedDescriptionText}|` : '';

    tag2.name = raceName ? `|REALLY_${raceName}|` : '';
    tag2.displayName = raceDisplayName;
    tag2.displayDescription = descriptionHandle;
    tag2.description = resolvedDescriptionText ? `|${resolvedDescriptionText}|` : '';
  });

  let existingTagChild = $derived(children.find(c => c.type === 'Tags'));
  let realTagValues = $derived(existingTagChild?.values ?? []);

  /** Loca combobox options for DisplayName / DisplayDescription */
  let locaOptions = $derived.by((): ComboboxOption[] => {
    const opts: ComboboxOption[] = [];
    const seen = new Set<string>();
    for (const f of configStore.locaEntries) {
      for (const v of f.values) {
        if (v.contentuid && !seen.has(v.contentuid)) {
          seen.add(v.contentuid);
          opts.push({ value: v.contentuid, label: v.text ? `${v.text}  —  ${v.contentuid}` : v.contentuid });
        }
      }
    }
    for (const [handle, text] of modStore.localizationMap) {
      if (!seen.has(handle)) {
        seen.add(handle);
        opts.push({ value: handle, label: text ? `${text}  —  ${handle}` : handle });
      }
    }
    return opts;
  });

  function resolveLocaText(handle: string | undefined): string | undefined {
    if (!handle) return undefined;
    const resolved = resolveLoca(handle, configStore.autoLocaEntries, (h) => modStore.lookupLocalizedString(h));
    return resolved === handle ? undefined : resolved;
  }

  function handleLocaChange(tag: TagPreview, fieldKey: 'displayName' | 'displayDescription', inputValue: string) {
    if (!inputValue) return;

    const locaPrefix = inputValue.startsWith('loca:') ? 5 : inputValue.startsWith('#') ? 1 : 0;
    if (locaPrefix > 0) {
      const rawHandle = inputValue.slice(locaPrefix).trim();
      if (rawHandle) {
        const parsed = parseHandleVersion(rawHandle);
        if (parsed) {
          tag[fieldKey] = rawHandle;
        } else if (isContentHandle(rawHandle)) {
          tag[fieldKey] = `${rawHandle};1`;
        } else {
          tag[fieldKey] = rawHandle;
        }
        return;
      }
    }

    if (isContentHandle(inputValue) || parseHandleVersion(inputValue)) {
      tag[fieldKey] = inputValue;
      return;
    }

    const currentFieldValue = tag[fieldKey];
    const { fieldValue, handle } = autoLocalize(
      inputValue,
      currentFieldValue,
      configStore.autoLocaEntries,
    );

    const updated = new Map(modStore.localizationMap);
    updated.set(handle, inputValue);
    modStore.localizationMap = updated;

    tag[fieldKey] = fieldValue;
  }

  /** Combined selected values: real tag UUIDs + dummy sentinels for active subforms */
  let comboboxSelected = $derived.by(() => {
    const vals = [...realTagValues];
    if (showRaceTag) vals.push(RACE_TAG_SENTINEL);
    if (showReallyTag) vals.push(REALLY_TAG_SENTINEL);
    return vals;
  });

  /** Merge dummy options into the real options list */
  let comboboxOptions = $derived.by((): ComboboxOption[] => {
    const real = getChildValueOptions('Tags');
    const dummies: ComboboxOption[] = [];
    if (showRaceTag) {
      dummies.push({ value: RACE_TAG_SENTINEL, label: `🏷 Race Tag: ${tag1.name || '(unnamed)'}` });
    }
    if (showReallyTag) {
      dummies.push({ value: REALLY_TAG_SENTINEL, label: `🏷 REALLY Tag: ${tag2.name || '(unnamed)'}` });
    }
    return [...dummies, ...real];
  });

  /** Whether either tag subform has all required fields */
  let tag1Valid = $derived(
    tag1.name.trim() !== '' && tag1.displayName.trim() !== '' &&
    tag1.description.trim() !== '' && tag1.displayDescription.trim() !== ''
  );
  let tag2Valid = $derived(
    tag2.name.trim() !== '' && tag2.displayName.trim() !== '' &&
    tag2.description.trim() !== '' && tag2.displayDescription.trim() !== ''
  );

  /** Sentinels that should not have X buttons in the combobox */
  let nonRemovableSentinels = $derived.by((): string[] => {
    const vals: string[] = [];
    if (showRaceTag) vals.push(RACE_TAG_SENTINEL);
    if (showReallyTag) vals.push(REALLY_TAG_SENTINEL);
    return vals;
  });

  /** Whether there are any race/REALLY tags selected (real UUIDs, not sentinels) or subforms active */
  let hasAnyRaceTags = $derived(showRaceTag || showReallyTag || realTagValues.length > 0);

  function handleTagValuesChange(vals: string[]) {
    // Prevent deselecting sentinel values via the combobox — only X button can remove them
    if (showRaceTag && !vals.includes(RACE_TAG_SENTINEL)) {
      vals = [...vals, RACE_TAG_SENTINEL];
    }
    if (showReallyTag && !vals.includes(REALLY_TAG_SENTINEL)) {
      vals = [...vals, REALLY_TAG_SENTINEL];
    }

    // Filter out sentinels from real children values
    const realVals = vals.filter(v => v !== RACE_TAG_SENTINEL && v !== REALLY_TAG_SENTINEL);

    const existing = children.find(c => c.type === 'Tags');
    if (existing) {
      existing.values = realVals;
      children = [...children];
    } else if (realVals.length > 0) {
      children = [...children, { type: 'Tags', values: realVals, action: 'Insert', modGuid: '' }];
    }
  }

  function activateSubforms() {
    showRaceTag = true;
    showReallyTag = true;
  }

  function removeRaceTag() {
    showRaceTag = false;
  }

  function removeReallyTag() {
    showReallyTag = false;
  }

  /**
   * Generate tag entries and wire into children.
   * Called by ManualEntryForm on save — only creates tags for active subforms.
   */
  export function generateTags(): void {
    const tagsToCreate: { section: string; fields: Record<string, string> }[] = [];
    const newUuids: string[] = [];

    if (showRaceTag && tag1Valid) {
      const uuid = generateUuid();
      newUuids.push(uuid);
      tagsToCreate.push({
        section: 'Tags',
        fields: {
          UUID: uuid,
          Name: tag1.name,
          DisplayName: tag1.displayName,
          Description: tag1.description,
          DisplayDescription: tag1.displayDescription,
          Categories: 'Character',
        },
      });
    }

    if (showReallyTag && tag2Valid) {
      const uuid = generateUuid();
      newUuids.push(uuid);
      tagsToCreate.push({
        section: 'Tags',
        fields: {
          UUID: uuid,
          Name: tag2.name,
          DisplayName: tag2.displayName,
          Description: tag2.description,
          DisplayDescription: tag2.displayDescription,
          Categories: 'Character',
        },
      });
    }

    if (tagsToCreate.length === 0) return;

    configStore.addManualEntries(tagsToCreate, 'Generate race tags');

    // Register Osiris race tag pair if both tags were generated
    if (tagsToCreate.length === 2 && raceEntryUuid) {
      const raceTagName = tag1.name.replace(/^\|/, '').replace(/\|$/, '').toUpperCase();
      const reallyTagName = tag2.name.replace(/^\|/, '').replace(/\|$/, '').toUpperCase();
      configStore.registerOsirisRaceTagPair(
        raceEntryUuid,
        raceTagName,
        newUuids[0],
        reallyTagName,
        newUuids[1],
      );
    }

    // Wire UUIDs into race's Tags children
    const tagsChild = children.find(c => c.type === 'Tags');
    if (tagsChild) {
      tagsChild.values = [...tagsChild.values, ...newUuids];
      children = [...children];
    } else {
      children = [...children, { type: 'Tags', values: newUuids, action: 'Insert', modGuid: '' }];
    }
  }
</script>

<div class="tag-panel space-y-3">
  <!-- Tags combobox with optional Generate button -->
  <div class="space-y-1">
    <!-- svelte-ignore a11y_label_has_associated_control -->
    <label class="text-zinc-400 text-xs">Tags</label>
    <div class="flex gap-2 items-stretch">
      <div class="flex-1 min-w-0">
        <MultiSelectCombobox
          options={comboboxOptions}
          selected={comboboxSelected}
          placeholder="Search or paste UUID(s)…"
          nonRemovable={nonRemovableSentinels}
          onchange={handleTagValuesChange}
        />
      </div>
      {#if !hasAnyRaceTags}
        <button type="button"
          class="shrink-0 px-2.5 text-xs font-medium text-sky-300 bg-sky-900/40 border border-sky-700/50 rounded hover:bg-sky-800/50 transition-colors inline-flex items-center gap-1"
          onclick={activateSubforms}
          use:tooltip={"Generate Race Tag and REALLY Tag subforms"}
        >
          <Plus size={12} /> Generate Tags
        </button>
      {/if}
    </div>
    {#if !hasAnyRaceTags}
      <p class="text-[10px] text-[var(--th-text-500)]">No racial tags found. Use the Generate Tags button to create Race and REALLY tags.</p>
    {/if}
  </div>

  <!-- Race Tag subform -->
  {#if showRaceTag}
    <div class="tag-preview">
      <div class="flex items-center gap-1.5 mb-2">
        <span class="text-xs font-semibold text-[var(--th-text-400)]">Race Tag</span>
        <span class="text-[var(--th-text-500)] cursor-help text-[10px]" use:tooltip={"The Race Tag identifies this race in the game engine. It is used for ability checks, dialog conditions, and racial feature gating."}>(?)</span>
        {#if tag1Valid}
          <span class="text-[10px] text-emerald-500/70 font-normal ml-1">(ready)</span>
        {/if}
        <span class="ml-auto">
          <button type="button" class="text-xs text-red-400 hover:text-red-300 px-1.5 min-w-6 min-h-6 inline-flex items-center justify-center"
            onclick={removeRaceTag} aria-label="Remove Race Tag subform" title="Remove Race Tag (won't be created on save)">
            <X size={14} />
          </button>
        </span>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div class="flex flex-col gap-0.5 text-xs">
          <label class="text-[var(--th-text-400)]" for="tag1-desc">Description <span class="text-red-400">*</span></label>
          <input id="tag1-desc" type="text" class="form-input w-full" bind:value={tag1.description} required />
        </div>
        <div class="flex flex-col gap-0.5 text-xs">
          <label class="text-[var(--th-text-400)]" for="tag1-name">Name <span class="text-red-400">*</span></label>
          <input id="tag1-name" type="text" class="form-input w-full" bind:value={tag1.name} required />
        </div>
        <div class="flex flex-col gap-0.5 text-xs min-w-0">
          <span class="text-[var(--th-text-400)]">Display Description <span class="text-red-400">*</span></span>
          <div class="loca-field">
            <SingleSelectCombobox
              options={locaOptions}
              value={tag1.displayDescription}
              placeholder="Type loca: or # for handles, text: or $ for text…"
              maxDisplayed={25}
              requirePrefix={['loca:', '#', 'text:', '$']}
              textOnlyPrefixes={['text:', '$']}
              displayValueOnly={true}
              locaResolver={resolveLocaText}
              onchange={(v) => handleLocaChange(tag1, 'displayDescription', v)}
            />
          </div>
        </div>
        <div class="flex flex-col gap-0.5 text-xs min-w-0">
          <span class="text-[var(--th-text-400)]">Display Name <span class="text-red-400">*</span></span>
          <div class="loca-field">
            <SingleSelectCombobox
              options={locaOptions}
              value={tag1.displayName}
              placeholder="Type loca: or # for handles, text: or $ for text…"
              maxDisplayed={25}
              requirePrefix={['loca:', '#', 'text:', '$']}
              textOnlyPrefixes={['text:', '$']}
              displayValueOnly={true}
              locaResolver={resolveLocaText}
              onchange={(v) => handleLocaChange(tag1, 'displayName', v)}
            />
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- REALLY Tag subform -->
  {#if showReallyTag}
    <div class="tag-preview">
      <div class="flex items-center gap-1.5 mb-2">
        <span class="text-xs font-semibold text-[var(--th-text-400)]">REALLY Tag</span>
        <span class="text-[var(--th-text-500)] cursor-help text-[10px]" use:tooltip={"The REALLY Tag is a secondary tag applied to all subraces of a parent race, used by the game to check 'is this character really an Elf?' regardless of specific subrace."}>(?)</span>
        {#if tag2Valid}
          <span class="text-[10px] text-emerald-500/70 font-normal ml-1">(ready)</span>
        {/if}
        <span class="ml-auto">
          <button type="button" class="text-xs text-red-400 hover:text-red-300 px-1.5 min-w-6 min-h-6 inline-flex items-center justify-center"
            onclick={removeReallyTag} aria-label="Remove REALLY Tag subform" title="Remove REALLY Tag (won't be created on save)">
            <X size={14} />
          </button>
        </span>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div class="flex flex-col gap-0.5 text-xs">
          <label class="text-[var(--th-text-400)]" for="tag2-desc">Description <span class="text-red-400">*</span></label>
          <input id="tag2-desc" type="text" class="form-input w-full" bind:value={tag2.description} required />
        </div>
        <div class="flex flex-col gap-0.5 text-xs">
          <label class="text-[var(--th-text-400)]" for="tag2-name">Name <span class="text-red-400">*</span></label>
          <input id="tag2-name" type="text" class="form-input w-full" bind:value={tag2.name} required />
        </div>
        <div class="flex flex-col gap-0.5 text-xs min-w-0">
          <span class="text-[var(--th-text-400)]">Display Description <span class="text-red-400">*</span></span>
          <div class="loca-field">
            <SingleSelectCombobox
              options={locaOptions}
              value={tag2.displayDescription}
              placeholder="Type loca: or # for handles, text: or $ for text…"
              maxDisplayed={25}
              requirePrefix={['loca:', '#', 'text:', '$']}
              textOnlyPrefixes={['text:', '$']}
              displayValueOnly={true}
              locaResolver={resolveLocaText}
              onchange={(v) => handleLocaChange(tag2, 'displayDescription', v)}
            />
          </div>
        </div>
        <div class="flex flex-col gap-0.5 text-xs min-w-0">
          <span class="text-[var(--th-text-400)]">Display Name <span class="text-red-400">*</span></span>
          <div class="loca-field">
            <SingleSelectCombobox
              options={locaOptions}
              value={tag2.displayName}
              placeholder="Type loca: or # for handles, text: or $ for text…"
              maxDisplayed={25}
              requirePrefix={['loca:', '#', 'text:', '$']}
              textOnlyPrefixes={['text:', '$']}
              displayValueOnly={true}
              locaResolver={resolveLocaText}
              onchange={(v) => handleLocaChange(tag2, 'displayName', v)}
            />
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if isNewEntry && (showRaceTag || showReallyTag)}
    <p class="text-[10px] text-emerald-400/80">Tag entries will be created and linked to this race on save.</p>
  {/if}
</div>

<style>
  .tag-preview {
    padding: 0.375rem 0.5rem 0.5rem;
    border: 1px solid var(--th-border-700, #3f3f46);
    border-radius: 0.25rem;
    background: var(--th-bg-800, rgba(0, 0, 0, 0.15));
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
  .form-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

</style>
