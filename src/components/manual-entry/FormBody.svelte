<script lang="ts">
  import type { FormLayout, LayoutRow, LayoutSubsection, LayoutInnerCard, LayoutField } from "../../lib/data/formLayouts.js";
  import type { SectionCapabilities } from "../../lib/data/sectionCaps.js";
  import type { ComboboxOption } from "../../lib/utils/comboboxOptions.js";
  import type { StringItem, ChildItem } from "../../lib/utils/fieldCodec.js";
  import { evaluateGate, STAT_TYPE_METADATA, type FieldGate } from "../../lib/data/statFieldMetadata.js";
  import { uiStore } from "../../lib/stores/uiStore.svelte.js";
  import InheritanceBanner from "../InheritanceBanner.svelte";
  import X from "@lucide/svelte/icons/x";
  import LayoutCell from "./LayoutCell.svelte";
  import FormSectionCard from "./FormSectionCard.svelte";
  import StringFieldset from "./StringFieldset.svelte";
  import TagFieldset from "./TagFieldset.svelte";
  import MultiSelectCombobox from "../MultiSelectCombobox.svelte";
  import FlagGroupBadges from "./FlagGroupBadges.svelte";

  interface Props {
    layout: FormLayout;
    caps: SectionCapabilities;
    strings: StringItem[];
    children: ChildItem[];
    getFieldValue: (key: string) => string;
    setFieldValue: (key: string, val: string) => void;
    getBoolValue: (key: string) => boolean;
    setBoolValue: (key: string, val: boolean) => void;
    fieldComboboxOptions: (key: string) => ComboboxOption[];
    resolveLocaText: (handle: string | undefined) => string | undefined;
    generateUuid: () => string;
    availablePassiveNames: ComboboxOption[];
    warnKeys: Set<string>;
    getChildValueOptions: (type: string) => ComboboxOption[];
    tags?: { uuids: string[]; action: string; type: string; modGuid: string }[];
    allowedTagTypes?: string[];
    getTagOptionsForType?: (tagType: string) => ComboboxOption[];
    fieldGating?: Record<string, FieldGate>;
    parentName?: string;
    parentFields?: Record<string, string>;
    childFields?: Record<string, string>;
    showInheritanceBanner?: boolean;
    showInheritanceSuggestions?: boolean;
    inheritanceSuggestions?: string[];
    onClearInheritance?: () => void;
    onApplyInheritanceSuggestion?: (parentName: string) => void;
    statType?: string;
    hiddenFieldKeys?: string[];
    activeSubIdx?: number;
    /** Filter string — only fields whose key contains this text (case-insensitive) are shown */
    fieldFilter?: string;
  }

  let {
    layout,
    caps,
    strings = $bindable(),
    children: childItems = $bindable(),
    getFieldValue,
    setFieldValue,
    getBoolValue,
    setBoolValue,
    fieldComboboxOptions,
    resolveLocaText,
    generateUuid,
    availablePassiveNames,
    warnKeys,
    getChildValueOptions,
    tags = $bindable(),
    allowedTagTypes = [],
    getTagOptionsForType,
    fieldGating = {},
    parentName = '',
    parentFields = {},
    childFields = {},
    showInheritanceBanner = false,
    showInheritanceSuggestions = false,
    inheritanceSuggestions = [],
    onClearInheritance = () => {},
    onApplyInheritanceSuggestion = () => {},
    statType = '',
    hiddenFieldKeys = [],
    activeSubIdx = $bindable(0),
    fieldFilter = '',
  }: Props = $props();

  let hiddenFieldKeySet = $derived(new Set(hiddenFieldKeys));
  let fieldFilterLower = $derived(fieldFilter.toLowerCase().trim());

  /** Check whether a field's gate condition is currently met. */
  function isGateMet(key: string): boolean {
    const gate = fieldGating[key];
    if (!gate) return true;
    // Fall back to inherited parent value when the field is not explicitly set
    const triggerValue = getFieldValue(gate.trigger) || parentFields?.[gate.trigger] || '';
    return evaluateGate(gate, { [gate.trigger]: triggerValue });
  }

  /** Determine whether a field should be rendered. */
  function shouldShowField(key: string): boolean {
    if (hiddenFieldKeySet.has(key)) return false;
    if (fieldFilterLower && !key.toLowerCase().includes(fieldFilterLower)) return false;
    if (isGateMet(key)) return true;
    if (uiStore.showAllStatsFields) return true;
    if (getFieldValue(key).trim() !== '') return true;
    return false;
  }

  /** Get visual state for a gated field: 'normal' | 'warn' | 'dim'. */
  function getFieldGateState(key: string): 'normal' | 'warn' | 'dim' {
    const gate = fieldGating[key];
    if (!gate) return 'normal';
    if (isGateMet(key)) return 'normal';
    // Gate not met — field has a value → warning indicator
    if (getFieldValue(key).trim() !== '') return 'warn';
    // Gate not met, no value — only visible via "show all" → dimmed
    return 'dim';
  }

  function removeChild(i: number) { childItems = childItems.filter((_, idx) => idx !== i); }

  function visibleRowHasUsingField(items: LayoutRow['items']): boolean {
    return items.some((item) => item.type === 'field' && item.key === 'Using');
  }

  let childIndexMap = $derived(new Map(childItems.map((c, i) => [c, i])));

  // activeSubIdx is now a bindable prop (see Props interface above); no local $state needed.

  // Lazily rendered subsection tabs: render a tab once it's been visited, then keep in DOM.
  let renderedSubIdxs = $state(new Set<number>([0]));
  $effect(() => { renderedSubIdxs = new Set([...renderedSubIdxs, activeSubIdx]); });

  function isSubsectionVisible(sub: LayoutSubsection): boolean {
    if (sub.component) return false;
    const hasVisibleRowItems = sub.rows.some(row => row.items.some(item => shouldShowField(item.key)));
    const hasVisibleCardItems = sub.innerCards?.some(card =>
      card.rows.some(row => row.items.some(item => shouldShowField(item.key))) ||
      (card.columnGroups?.some(group => group.some(item => shouldShowField(item.key))) ?? false)
    ) ?? false;
    const hasOtherContent = !!(sub.stringKeys?.length || sub.tagKeys?.length || sub.inlineChildGroups?.length);
    const hasFlagGroupContent = sub.flagGroupKeys?.some(k => shouldShowField(k)) ?? false;
    return hasVisibleRowItems || hasVisibleCardItems || hasOtherContent || hasFlagGroupContent;
  }

  /** Whether an inner card's showWhen gate is met (or has no gate). */
  function isCardVisible(card: LayoutInnerCard): boolean {
    if (!card.showWhen) return true;
    // Fall back to inherited parent value when field is not explicitly set
    const triggerValue = getFieldValue(card.showWhen.trigger) || parentFields?.[card.showWhen.trigger] || '';
    const met = evaluateGate(card.showWhen, { [card.showWhen.trigger]: triggerValue });
    if (met) return true;
    if (uiStore.showAllStatsFields) return true;
    // Still show if any field in the card has a value
    return card.rows.some(row => row.items.some(item => item.type === 'field' && getFieldValue(item.key).trim() !== ''));
  }
</script>

{#if !layout.noDefaultHr && layout.identityExtras}
  <div class="border-t border-zinc-700"></div>
{/if}

<!-- Ungrouped rows -->
{#if layout.rows}
  <FormSectionCard title="Fields" id="section-fields">
  {#if layout.sideColumnBooleans?.length}
    <!-- Side-column layout: rows on left, stacked booleans on right -->
    <div class="flex gap-4 items-start">
      <div class="flex-1 space-y-2 min-w-0">
        {#each layout.rows as row}
          {@const visibleItems = row.items.filter(item => shouldShowField(item.key))}
          {#if visibleItems.length > 0}
          {@const colCount = layout.maxFieldColumns ? Math.max(Math.min(visibleItems.length, layout.maxFieldColumns), layout.maxFieldColumns) : visibleItems.length}
          <div class="grid gap-2" style="grid-template-columns: repeat({colCount}, minmax(0, 1fr));">
            {#each visibleItems as item}
              {@const gateState = getFieldGateState(item.key)}
              <div class={gateState === 'warn' ? 'ring-1 ring-yellow-500/50 rounded-md' : gateState === 'dim' ? 'opacity-40' : ''}>
                <LayoutCell {item} {caps} {getFieldValue} {setFieldValue} {getBoolValue} {setBoolValue} {fieldComboboxOptions} {resolveLocaText} {generateUuid} {statType} {parentFields} {childFields} reversed />
              </div>
            {/each}
          </div>
          {#if visibleRowHasUsingField(visibleItems) && showInheritanceBanner}
            <div class="mt-2">
              <InheritanceBanner {parentName} {parentFields} {childFields} {onClearInheritance} />
            </div>
          {/if}
          {#if visibleRowHasUsingField(visibleItems) && showInheritanceSuggestions}
            <div class="inheritance-suggestions">
              <span class="inheritance-suggestions-label">Common parents</span>
              <div class="inheritance-suggestion-list">
                {#each inheritanceSuggestions as suggestion}
                  <button type="button" class="inheritance-suggestion-btn" onclick={() => onApplyInheritanceSuggestion(suggestion)}>{suggestion}</button>
                {/each}
              </div>
            </div>
          {/if}
          {/if}
        {/each}
      </div>
      <!-- Side column: stacked booleans (right-aligned) -->
      <div class="flex flex-col gap-3 pt-4 shrink-0 items-end">
        {#each layout.sideColumnBooleans as boolKey}
          <div class="flex items-center gap-2 text-xs whitespace-nowrap">
            <span class="text-[11px] cursor-pointer select-none {getBoolValue(boolKey) ? 'text-sky-400' : 'text-[var(--th-text-500)]'}" role="button" tabindex="0" onclick={() => setBoolValue(boolKey, !getBoolValue(boolKey))} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setBoolValue(boolKey, !getBoolValue(boolKey)); } }}>{boolKey}</span>
            <button type="button" class="relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 {getBoolValue(boolKey) ? 'bg-sky-500' : 'bg-[var(--th-bg-600,#52525b)]'}" role="switch" aria-checked={getBoolValue(boolKey)} aria-label={boolKey} onclick={() => setBoolValue(boolKey, !getBoolValue(boolKey))}>
              <span class="pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 {getBoolValue(boolKey) ? 'translate-x-3.5' : 'translate-x-0.5'}"></span>
            </button>
          </div>
        {/each}
      </div>
    </div>
  {:else}
  {#each layout.rows as row}
    {@const visibleItems = row.items.filter(item => shouldShowField(item.key))}
    {#if visibleItems.length > 0}
    {#if row.wrap}
    <div class="flex flex-wrap gap-2">
      {#each visibleItems as item}
        {@const gateState = getFieldGateState(item.key)}
        <div class="flex-1 min-w-[180px] {gateState === 'warn' ? 'ring-1 ring-yellow-500/50 rounded-md' : gateState === 'dim' ? 'opacity-40' : ''}" style={row.maxItemWidth ? `max-width: ${row.maxItemWidth}` : ''}>
          <LayoutCell {item} {caps} {getFieldValue} {setFieldValue} {getBoolValue} {setBoolValue} {fieldComboboxOptions} {resolveLocaText} {generateUuid} {statType} {parentFields} {childFields} reversed />
        </div>
      {/each}
    </div>
    {#if visibleRowHasUsingField(visibleItems) && showInheritanceBanner}
      <div class="mt-2">
        <InheritanceBanner {parentName} {parentFields} {childFields} {onClearInheritance} />
      </div>
    {/if}
    {#if visibleRowHasUsingField(visibleItems) && showInheritanceSuggestions}
      <div class="inheritance-suggestions">
        <span class="inheritance-suggestions-label">Common parents</span>
        <div class="inheritance-suggestion-list">
          {#each inheritanceSuggestions as suggestion}
            <button type="button" class="inheritance-suggestion-btn" onclick={() => onApplyInheritanceSuggestion(suggestion)}>{suggestion}</button>
          {/each}
        </div>
      </div>
    {/if}
    {:else}
    {@const colCount = layout.maxFieldColumns ? Math.min(visibleItems.length, layout.maxFieldColumns) : visibleItems.length}
    <div class="grid gap-2" style="grid-template-columns: repeat({colCount}, minmax(0, 1fr));">
      {#each visibleItems as item}
        {@const gateState = getFieldGateState(item.key)}
        <div class={gateState === 'warn' ? 'ring-1 ring-yellow-500/50 rounded-md' : gateState === 'dim' ? 'opacity-40' : ''}>
          <LayoutCell {item} {caps} {getFieldValue} {setFieldValue} {getBoolValue} {setBoolValue} {fieldComboboxOptions} {resolveLocaText} {generateUuid} {statType} {parentFields} {childFields} reversed />
        </div>
      {/each}
    </div>
    {#if visibleRowHasUsingField(visibleItems) && showInheritanceBanner}
      <div class="mt-2">
        <InheritanceBanner {parentName} {parentFields} {childFields} {onClearInheritance} />
      </div>
    {/if}
    {#if visibleRowHasUsingField(visibleItems) && showInheritanceSuggestions}
      <div class="inheritance-suggestions">
        <span class="inheritance-suggestions-label">Common parents</span>
        <div class="inheritance-suggestion-list">
          {#each inheritanceSuggestions as suggestion}
            <button type="button" class="inheritance-suggestion-btn" onclick={() => onApplyInheritanceSuggestion(suggestion)}>{suggestion}</button>
          {/each}
        </div>
      </div>
    {/if}
    {/if}
    {/if}
  {/each}
  {/if}
  </FormSectionCard>
{/if}

<!-- Named subsections — rendered as a tabbed drawer when multiple are visible -->

{#snippet renderColumnGroups(groups: LayoutField[][])}
<div class="column-groups-layout">
    {#each groups as group}
      <div class="column-group">
        {#each group as item}
          {#if shouldShowField(item.key)}
            {@const gateState = getFieldGateState(item.key)}
            <div class={gateState === 'warn' ? 'ring-1 ring-yellow-500/50 rounded-md' : gateState === 'dim' ? 'opacity-40' : ''}>
              <LayoutCell {item} {caps} {getFieldValue} {setFieldValue} {getBoolValue} {setBoolValue} {fieldComboboxOptions} {resolveLocaText} {generateUuid} {statType} {parentFields} {childFields} />
            </div>
          {/if}
        {/each}
      </div>
    {/each}
  </div>
{/snippet}

{#snippet renderCardRows(rows: LayoutRow[], maxCols?: number)}
  <div class="space-y-2">
    {#each rows as row}
      {@const visibleItems = row.items.filter(item => item.type === 'spacer' || shouldShowField(item.key))}
      {#if visibleItems.length > 0}
      {#if row.wrap}
      <div class="flex flex-wrap gap-2">
        {#each visibleItems as item}
          {#if item.type === 'spacer'}
            <div class="flex-1 min-w-[180px]"></div>
          {:else}
          {@const gateState = getFieldGateState(item.key)}
          <div class="flex-1 min-w-[180px] {gateState === 'warn' ? 'ring-1 ring-yellow-500/50 rounded-md' : gateState === 'dim' ? 'opacity-40' : ''}" style={row.maxItemWidth ? `max-width: ${row.maxItemWidth}` : ''}>
            <LayoutCell {item} {caps} {getFieldValue} {setFieldValue} {getBoolValue} {setBoolValue} {fieldComboboxOptions} {resolveLocaText} {generateUuid} {statType} {parentFields} {childFields} reversed />
          </div>
          {/if}
        {/each}
      </div>
      {:else}
      {@const colCount = maxCols ? Math.min(visibleItems.length, maxCols) : visibleItems.length}
      {@const gridTemplate = row.gridTemplate ?? `repeat(${colCount}, minmax(0, 1fr))`}
      <div class="grid gap-2" style="grid-template-columns: {gridTemplate};">
        {#each visibleItems as item}
          {#if item.type === 'spacer'}
            <div></div>
          {:else}
          {@const gateState = getFieldGateState(item.key)}
          <div class={gateState === 'warn' ? 'ring-1 ring-yellow-500/50 rounded-md' : gateState === 'dim' ? 'opacity-40' : ''}>
            <LayoutCell {item} {caps} {getFieldValue} {setFieldValue} {getBoolValue} {setBoolValue} {fieldComboboxOptions} {resolveLocaText} {generateUuid} {statType} {parentFields} {childFields} reversed />
          </div>
          {/if}
        {/each}
      </div>
      {/if}
      {/if}
    {/each}
  </div>
{/snippet}

{#snippet renderSubBody(sub: LayoutSubsection)}
  {#if sub.flagGroupKeys?.length || sub.boolFlagKeys?.length}
    {@const boolFlagDefs = (sub.boolFlagKeys ?? []).map(key => {
      const toggle = statType ? STAT_TYPE_METADATA[statType]?.fieldBoolToggle?.[key] : undefined;
      return { key, label: key, onValue: toggle?.onValue ?? '1', offValue: toggle?.offValue ?? '0' };
    })}
    <FormSectionCard
      title="Flags"
      id="section-inner-flag-group"
      open={true}
    >
      <FlagGroupBadges
        fieldKeys={sub.flagGroupKeys ?? []}
        {boolFlagDefs}
        {fieldComboboxOptions}
        {getFieldValue}
        {setFieldValue}
        {parentFields}
        {childFields}
      />
    </FormSectionCard>
  {/if}
  <div class="space-y-2">
    {#each sub.rows as row}
      {@const visibleItems = row.items.filter(item => item.type === 'spacer' || shouldShowField(item.key))}
      {#if visibleItems.length > 0}
      {#if row.wrap}
      <div class="flex flex-wrap gap-2">
        {#each visibleItems as item}
          {#if item.type === 'spacer'}
            <div class="flex-1 min-w-[180px]"></div>
          {:else}
          {@const gateState = getFieldGateState(item.key)}
          <div class="flex-1 min-w-[180px] {gateState === 'warn' ? 'ring-1 ring-yellow-500/50 rounded-md' : gateState === 'dim' ? 'opacity-40' : ''}" style={row.maxItemWidth ? `max-width: ${row.maxItemWidth}` : ''}>
            <LayoutCell {item} {caps} {getFieldValue} {setFieldValue} {getBoolValue} {setBoolValue} {fieldComboboxOptions} {resolveLocaText} {generateUuid} {statType} {parentFields} {childFields} reversed />
          </div>
          {/if}
        {/each}
      </div>
      {:else}
      {@const subColCount = sub.maxFieldColumns ? Math.min(visibleItems.length, sub.maxFieldColumns) : visibleItems.length}
      {@const subGridTemplate = row.gridTemplate ?? `repeat(${subColCount}, minmax(0, 1fr))`}
      <div class="grid gap-2" style="grid-template-columns: {subGridTemplate};">
        {#each visibleItems as item}
          {#if item.type === 'spacer'}
            <div></div>
          {:else}
          {@const gateState = getFieldGateState(item.key)}
          <div class={gateState === 'warn' ? 'ring-1 ring-yellow-500/50 rounded-md' : gateState === 'dim' ? 'opacity-40' : ''}>
            <LayoutCell {item} {caps} {getFieldValue} {setFieldValue} {getBoolValue} {setBoolValue} {fieldComboboxOptions} {resolveLocaText} {generateUuid} {statType} {parentFields} {childFields} reversed />
          </div>
          {/if}
        {/each}
      </div>
      {/if}
      {/if}
    {/each}
  </div>
  {#if sub.innerCards}
    {@const mainCards = sub.innerCards.filter(c => !c.fullRow)}
    {@const fullRowCards = sub.innerCards.filter(c => c.fullRow)}
    {#if mainCards.length > 0}
      {@const hasColLayout = mainCards.some(c => c.col !== undefined)}
      {#if hasColLayout}
        {@const col1Cards = mainCards.filter(c => !c.col || c.col === 1)}
        {@const col2Cards = mainCards.filter(c => c.col === 2)}
        <div class="inner-cards-columns">
          <div class="inner-cards-col">
            {#each col1Cards as card}
              {#if isCardVisible(card)}
              <FormSectionCard
                title={card.title}
                id="section-inner-{card.title.toLowerCase().replace(/\s+/g, '-')}"
                open={!card.collapsed}
              >
                {@render renderCardRows(card.rows)}
              </FormSectionCard>
              {/if}
            {/each}
          </div>
          <div class="inner-cards-col">
            {#each col2Cards as card}
              {#if isCardVisible(card)}
              <FormSectionCard
                title={card.title}
                id="section-inner-{card.title.toLowerCase().replace(/\s+/g, '-')}"
                open={!card.collapsed}
              >
                {@render renderCardRows(card.rows)}
              </FormSectionCard>
              {/if}
            {/each}
          </div>
        </div>
      {:else}
        <div class="inner-cards-row">
          {#each mainCards as card}
            {#if isCardVisible(card)}
            <div class="inner-card-col" style={card.width ? `flex: 1 1 ${card.width}; max-width: ${card.width}` : 'flex: 1; min-width: 0'}>
              <FormSectionCard
                title={card.title}
                id="section-inner-{card.title.toLowerCase().replace(/\s+/g, '-')}"
                open={!card.collapsed}
              >
                {@render renderCardRows(card.rows)}
              </FormSectionCard>
            </div>
            {/if}
          {/each}
        </div>
      {/if}
    {/if}
    {#each fullRowCards as card}
      {#if isCardVisible(card)}
      <FormSectionCard
        title={card.title}
        id="section-inner-{card.title.toLowerCase().replace(/\s+/g, '-')}"
        open={!card.collapsed}
      >
        {#if card.columnGroups}
          {@render renderColumnGroups(card.columnGroups)}
        {:else}
          {@render renderCardRows(card.rows, card.maxFieldColumns ?? 2)}
        {/if}
      </FormSectionCard>
      {/if}
    {/each}
  {/if}
  {#if sub.stringKeys}
    {@const subStrings = strings.filter(s => sub.stringKeys!.includes(s.type))}
    {@const subStringTypesUsed = new Set(subStrings.map(s => s.type))}
    {@const allSubStringTypesUsed = sub.stringKeys!.every(k => subStringTypesUsed.has(k))}
    <div class="mt-2">
      <StringFieldset
        bind:strings
        {caps}
        {availablePassiveNames}
        {warnKeys}
        allStringTypesUsed={allSubStringTypesUsed}
        hideRemoveButton={layout.noRemoveButtons ?? false}
        onaddString={() => {
          const first = sub.stringKeys!.find(k => !subStringTypesUsed.has(k)) ?? sub.stringKeys![0];
          strings = [...strings, { action: "Insert", type: first, values: "", modGuid: "" }];
        }}
        onremoveString={(i) => { strings = strings.filter((_, idx) => idx !== i); }}
        filterKeys={sub.stringKeys}
        adjacentBooleans={sub.stringAdjacentBooleans}
        {getBoolValue}
        {setBoolValue}
      />
    </div>
  {/if}
  {#if sub.tagKeys && tags && getTagOptionsForType}
    {@const subTags = tags.filter(t => sub.tagKeys!.includes(t.type))}
    {@const subTagTypesUsed = new Set(subTags.map(t => t.type))}
    {@const allSubTagTypesUsed = sub.tagKeys!.every(k => subTagTypesUsed.has(k))}
    {@const subAllowedTagTypes = allowedTagTypes.filter(t => sub.tagKeys!.includes(t))}
    <div class="mt-2">
      <TagFieldset
        bind:tags
        allowedTagTypes={subAllowedTagTypes}
        {getTagOptionsForType}
        {warnKeys}
        allTagTypesUsed={allSubTagTypesUsed}
        hideRemoveButton={layout.noRemoveButtons ?? false}
        onaddTag={() => {
          const first = sub.tagKeys!.find(k => !subTagTypesUsed.has(k)) ?? sub.tagKeys![0];
          if (tags) tags = [...tags, { uuids: [], action: "Insert", type: first, modGuid: "" }];
        }}
        onremoveTag={(i) => { if (tags) tags = tags.filter((_, idx) => idx !== i); }}
      />
    </div>
  {/if}
  {#if sub.inlineChildGroups}
    {#each sub.inlineChildGroups as group}
      {@const groupChildren = childItems.filter(c => group.types.includes(c.type))}
      {@const groupUsed = new Set(groupChildren.map(c => c.type))}
      {@const groupAvailable = group.types.filter(t => !groupUsed.has(t))}
      <div class="mt-2">
        <fieldset class="space-y-1">
          {#if groupChildren.length === 0}
            {#if groupAvailable.length > 0}
              <button class="text-xs text-sky-400 hover:text-sky-300" onclick={() => { childItems = [...childItems, { type: groupAvailable[0], values: [], action: "Insert", modGuid: "" }]; }}>+ Add {group.title.toLowerCase()}</button>
            {/if}
          {:else}
            <div class={group.columns ? 'grid gap-2' : 'space-y-1'} style={group.columns ? `grid-template-columns: repeat(${group.columns}, minmax(0, 1fr))` : ''}>
            {#each groupChildren as c}
              {@const absIdx = childIndexMap.get(c) ?? 0}
              <div class="flex gap-1 items-start">
                <div class="flex-1 flex flex-col gap-1 min-w-0">
                  <MultiSelectCombobox
                    label={c.type}
                    options={getChildValueOptions(c.type)}
                    selected={c.values}
                    placeholder="Search or paste UUID(s)…"
                    onchange={(vals) => c.values = vals}
                  />
                </div>
                {#if !layout.noRemoveButtons}
                <button class="text-xs text-red-400 hover:text-red-300 self-center px-1.5 min-w-6 min-h-6 inline-flex items-center justify-center" onclick={() => removeChild(absIdx)} aria-label="Remove child"><X size={14} /></button>
                {/if}
              </div>
            {/each}
            </div>
            {#if groupAvailable.length > 0}
              <button class="text-xs text-sky-400 hover:text-sky-300" onclick={() => { childItems = [...childItems, { type: groupAvailable[0], values: [], action: "Insert", modGuid: "" }]; }}>+ Add {group.types[groupAvailable.length > 1 ? 0 : groupAvailable.length - 1]?.toLowerCase() ?? 'entry'}</button>
            {/if}
          {/if}
        </fieldset>
      </div>
    {/each}
  {/if}
{/snippet}

{#if layout.subsections}
  {@const visibleSubs = layout.subsections.filter(isSubsectionVisible)}
  {#if visibleSubs.length > 1}
    <!-- Tabbed drawer: multiple visible subsections → horizontal tab strip -->
    {@const clampedIdx = Math.min(activeSubIdx, visibleSubs.length - 1)}
    <div class="subsection-tabs-wrapper">
      <div class="subsection-tab-strip" role="tablist">
        {#each visibleSubs as sub, i}
          <button
            type="button"
            role="tab"
            class="subsection-tab"
            class:subsection-tab-active={i === clampedIdx}
            aria-selected={i === clampedIdx}
            onclick={() => { activeSubIdx = i; }}
          >{sub.title}</button>
        {/each}
      </div>
      <div class="subsection-tab-pane">
        {#each visibleSubs as sub, i}
          <div
            id="section-sub-{sub.title.toLowerCase().replace(/\s+/g, '-')}"
            class="subsection-tab-pane-content"
            class:subsection-tab-pane-hidden={i !== clampedIdx}
            role="tabpanel"
            aria-hidden={i !== clampedIdx}
          >
            {#if i === clampedIdx || renderedSubIdxs.has(i)}
            {#if sub.headerBooleans}
              <div class="subsection-header-booleans">
                {#each sub.headerBooleans as bKey}
                  <span class="flex items-center gap-1.5">
                    <button
                      type="button"
                      class="relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 {getBoolValue(bKey) ? 'bg-sky-500' : 'bg-[var(--th-bg-600,#52525b)]'}"
                      role="switch"
                      aria-checked={getBoolValue(bKey)}
                      aria-label={bKey}
                      onclick={() => setBoolValue(bKey, !getBoolValue(bKey))}
                    >
                      <span class="pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 {getBoolValue(bKey) ? 'translate-x-3.5' : 'translate-x-0.5'}"></span>
                    </button>
                    <span class="text-[11px] cursor-pointer select-none {getBoolValue(bKey) ? 'text-sky-400' : 'text-[var(--th-text-500)]'} font-normal" role="button" tabindex="0" onclick={() => setBoolValue(bKey, !getBoolValue(bKey))} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setBoolValue(bKey, !getBoolValue(bKey)); } }}>{sub.headerBooleanLabels?.[bKey] ?? bKey}</span>
                  </span>
                {/each}
              </div>
            {/if}
            {@render renderSubBody(sub)}
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {:else}
    <!-- Single visible subsection: keep accordion card UI -->
    {#each visibleSubs as sub}
      <FormSectionCard title={sub.title} id="section-sub-{sub.title.toLowerCase().replace(/\s+/g, '-')}" open={!sub.collapsed}>
        {#snippet headerActions()}
          {#if sub.headerBooleans}
            {#each sub.headerBooleans as bKey}
              <span class="flex items-center gap-1.5">
                <button
                  type="button"
                  class="relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 {getBoolValue(bKey) ? 'bg-sky-500' : 'bg-[var(--th-bg-600,#52525b)]'}"
                  role="switch"
                  aria-checked={getBoolValue(bKey)}
                  aria-label={bKey}
                  onclick={() => setBoolValue(bKey, !getBoolValue(bKey))}
                >
                  <span class="pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 {getBoolValue(bKey) ? 'translate-x-3.5' : 'translate-x-0.5'}"></span>
                </button>
                <span class="text-[11px] cursor-pointer select-none {getBoolValue(bKey) ? 'text-sky-400' : 'text-[var(--th-text-500)]'} font-normal" role="button" tabindex="0" onclick={() => setBoolValue(bKey, !getBoolValue(bKey))} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setBoolValue(bKey, !getBoolValue(bKey)); } }}>{sub.headerBooleanLabels?.[bKey] ?? bKey}</span>
              </span>
            {/each}
          {/if}
        {/snippet}
        {@render renderSubBody(sub)}
      </FormSectionCard>
    {/each}
  {/if}
{/if}

<style>
  .inheritance-suggestions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }

  .inheritance-suggestions-label {
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--th-text-500);
  }

  .inheritance-suggestion-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .inheritance-suggestion-btn {
    padding: 0.35rem 0.65rem;
    border: 1px solid var(--th-border-700);
    border-radius: 9999px;
    background: var(--th-bg-800);
    color: var(--th-text-300);
    font-size: 0.75rem;
    transition: border-color 120ms ease, color 120ms ease, background-color 120ms ease;
  }

  .inheritance-suggestion-btn:hover,
  .inheritance-suggestion-btn:focus-visible {
    outline: none;
    border-color: rgb(56 189 248 / 0.5);
    background: rgb(12 74 110 / 0.25);
    color: rgb(186 230 253);
  }

  /* ── Subsection tab strip ── */
  .subsection-tabs-wrapper {
    border: 1px solid var(--th-card-border, var(--th-border-700));
    border-radius: 0.5rem;
    background: var(--th-card-bg, var(--th-bg-800));
    box-shadow: var(--th-card-shadow, 0 1px 3px rgba(0,0,0,.1));
    margin-top: 0.25rem;
    overflow: hidden;
  }

  .subsection-tab-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 0;
    background: var(--th-card-header-bg, var(--th-bg-850));
    border-bottom: 1px solid var(--th-card-border, var(--th-border-700));
    padding: 0 0.25rem;
  }

  .subsection-tab {
    padding: 0.4375rem 0.875rem;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--th-text-400);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: color 120ms ease, border-color 120ms ease;
    white-space: nowrap;
    user-select: none;
    margin-bottom: -1px;
  }

  .subsection-tab:hover {
    color: var(--th-text-200);
  }

  .subsection-tab-active {
    color: var(--th-text-100);
    border-bottom-color: var(--th-focus-ring, #38bdf8);
  }

  .subsection-tab-pane {
    padding: 0.625rem;
  }

  .subsection-tab-pane-hidden {
    display: none;
  }

  .subsection-header-booleans {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }

  /* ── Inner cards (side-by-side collapsible cards within a tab pane) ── */
  .inner-cards-row {
    display: flex;
    flex-wrap: nowrap;
    gap: 0.5rem;
    align-items: flex-start;
    margin-bottom: 0.5rem;
  }

  .inner-card-col {
    min-width: 0;
  }

  /* ── Column-based stacked inner cards layout (col=1 / col=2) ── */
  .inner-cards-columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    align-items: start;
    margin-bottom: 0.5rem;
  }

  .inner-cards-col {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
  }

  /* ── Column-groups layout (independent vertical stacks, no cross-row alignment) ── */
  .column-groups-layout {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
    align-items: start;
  }

  .column-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
  }
</style>

