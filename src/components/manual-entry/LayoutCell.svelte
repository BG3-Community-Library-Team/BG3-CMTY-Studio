<script lang="ts">
  import type { LayoutField } from "../../lib/data/formLayouts.js";
  import type { SectionCapabilities } from "../../lib/data/sectionCaps.js";
  import type { ComboboxOption } from "../../lib/utils/comboboxOptions.js";
  import { tooltip } from "../../lib/actions/tooltip.js";
  import { cssToBg3Color, bg3ToCssColor } from "../../lib/utils/fieldCodec.js";
  import { getInheritanceFieldStatus } from "../../lib/utils/inheritanceComparison.js";
  import { isContentHandle, parseHandleVersion, autoLocalize } from "../../lib/utils/localizationManager.js";
  import { modStore } from "../../lib/stores/modStore.svelte.js";
  import { projectStore } from "../../lib/stores/projectStore.svelte.js";
  import { stagingUpsertRow } from "../../lib/tauri/staging.js";
  import { scriptRead, scriptWrite } from "../../lib/tauri/scripts.js";
  import { generateLocalizationXml } from "../../lib/tauri/loca.js";
  import { STAT_TYPE_METADATA } from "../../lib/data/statFieldMetadata.js";
  import Shuffle from "@lucide/svelte/icons/shuffle";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import HelpCircle from "@lucide/svelte/icons/help-circle";
  import Pencil from "@lucide/svelte/icons/pencil";
  import SingleSelectCombobox from "../SingleSelectCombobox.svelte";
  import MultiSelectCombobox from "../MultiSelectCombobox.svelte";
  import InlineCodeEditor from "./InlineCodeEditor.svelte";
  import CostFieldGroup from "./CostFieldGroup.svelte";
  import IconAtlasPreview from "../IconAtlasPreview.svelte";

  interface Props {
    item: LayoutField;
    caps: SectionCapabilities;
    getFieldValue: (key: string) => string;
    setFieldValue: (key: string, value: string) => void;
    getBoolValue: (key: string) => boolean;
    setBoolValue: (key: string, value: boolean) => void;
    fieldComboboxOptions: (key: string) => ComboboxOption[];
    resolveLocaText: (handle: string | undefined) => string | undefined;
    generateUuid: () => string;
    parentFields?: Record<string, string>;
    childFields?: Record<string, string>;
    reversed?: boolean;
    statType?: string;
  }

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
    parentFields = {},
    childFields = {},
    reversed = false,
    statType = '',
  }: Props = $props();

  let localOverrideEnabled = $state(false);
  let localSyncLocked = $state(false);

  /** Persist a new or updated auto-loca entry to both the staging DB and to
   *  `Localization/English/english.xml` on disk so the entry survives re-scans. */
  async function persistAutoLocaEntry(handle: string, version: number, text: string): Promise<void> {
    const modPath = modStore.selectedModPath;
    const stagingDbPath = projectStore.stagingDbPath;
    if (!modPath || !stagingDbPath) return;

    try {
      // Upsert into staging DB for immediate in-session combobox reactivity.
      await stagingUpsertRow(stagingDbPath, "loca__english", {
        contentuid: handle,
        text,
        version: String(version),
      }, true);
    } catch (e) {
      console.warn("[auto-loca] Failed to upsert into staging DB:", e);
    }

    try {
      // Merge with any existing english.xml (creates the file if it doesn't exist).
      const modFolder = modStore.modFolder || modPath.split(/[\\/]/).pop() || "";
      const locaFilePath = `Mods/${modFolder}/Localization/English/english.xml`;
      const existing = await scriptRead(modPath, locaFilePath);
      const xml = await generateLocalizationXml(
        [{ contentuid: handle, version, text }],
        existing ?? undefined,
      );
      await scriptWrite(modPath, locaFilePath, xml);
    } catch (e) {
      console.warn("[auto-loca] Failed to write english.xml:", e);
    }
  }

  function handleLocaChange(fieldKey: string, inputValue: string) {
    if (!inputValue) return;

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

    if (isContentHandle(inputValue) || parseHandleVersion(inputValue)) {
      setFieldValue(fieldKey, inputValue);
      return;
    }

    const currentFieldValue = getFieldValue(fieldKey);
    const { fieldValue, handle } = autoLocalize(
      inputValue,
      currentFieldValue,
      modStore.autoLocaEntries,
    );

    const version = modStore.autoLocaEntries.get(handle)?.version ?? 1;

    const updated = new Map(modStore.localizationMap);
    updated.set(handle, inputValue);
    modStore.localizationMap = updated;

    setFieldValue(fieldKey, fieldValue);

    // Persist to staging DB + english.xml (fire-and-forget; errors are non-fatal).
    void persistAutoLocaEntry(handle, version, inputValue);
  }

  function jumpToReference(targetSection: string, uuid: string) {
    window.dispatchEvent(new CustomEvent('navigate-to-section', { detail: { section: targetSection } }));
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('entry-start-edit', { detail: { section: targetSection, uuid } }));
    }, 50);
  }

  function hasExplicitChildValue(): boolean {
    return Object.prototype.hasOwnProperty.call(childFields, item.key);
  }

  function getDisplayTokens(rawValue: string): string[] {
    if (!rawValue) return [];

    const descriptor = caps.fieldCombobox?.[item.key] ?? '';
    const optionLabelMap = new Map(fieldComboboxOptions(item.key).map((option) => [option.value, option.label]));
    const values = descriptor.startsWith('multi')
      ? rawValue.split(';').map((value) => value.trim()).filter(Boolean)
      : [rawValue];

    return values.map((value) => optionLabelMap.get(value) ?? value);
  }

  function getDisplayValue(rawValue: string): string {
    return getDisplayTokens(rawValue).join('; ');
  }

  function handleOverrideToggle(enabled: boolean): void {
    if (enabled) {
      localOverrideEnabled = true;
      return;
    }

    localOverrideEnabled = false;
    setFieldValue(item.key, '');
  }

  $effect(() => {
    if (!Object.prototype.hasOwnProperty.call(parentFields, item.key)) {
      localOverrideEnabled = false;
    }
  });

  $effect(() => {
    if (!localSyncLocked) return;
    const syncKey = statType ? STAT_TYPE_METADATA[statType]?.fieldSyncMap?.[item.key] : undefined;
    if (!syncKey) return;
    // Use parentValue if existing (inherited field), otherwise get current field value
    const hasSyncSourceParent = Object.prototype.hasOwnProperty.call(parentFields, syncKey);
    const sourceValue = hasSyncSourceParent ? parentFields[syncKey] : getFieldValue(syncKey);
    if (!sourceValue) return; // Don't sync if source is empty
    if (getFieldValue(item.key) !== sourceValue) {
      setFieldValue(item.key, sourceValue);
    }
  });
</script>

{#if item.type === 'field'}
  {@const ft = caps.fieldTypes?.[item.key]}
  {@const fieldValue = getFieldValue(item.key)}
  {@const hasInheritanceData = Object.keys(parentFields).length > 0}
  {@const hasExplicitValue = hasExplicitChildValue()}
  {@const inheritanceStatus = hasInheritanceData ? getInheritanceFieldStatus(item.key, parentFields, childFields) : null}
  {@const hasParentValue = Object.prototype.hasOwnProperty.call(parentFields, item.key)}
  {@const parentValue = hasParentValue ? parentFields[item.key] : ''}
  {@const overrideEnabled = hasExplicitValue || localOverrideEnabled}
  {@const effectiveFieldValue = hasExplicitValue ? fieldValue : (overrideEnabled && hasParentValue ? parentValue : fieldValue)}
  {@const isMultiField = caps.fieldCombobox?.[item.key]?.startsWith('multi') ?? false}
  {@const displayTokens = isMultiField ? getDisplayTokens(parentValue) : []}
  {@const showInheritedValue = inheritanceStatus === 'inherited' && hasParentValue && !overrideEnabled}
  {@const showOverrideToggle = inheritanceStatus !== null && hasParentValue}
  {@const showOverrideBadge = showOverrideToggle && overrideEnabled && !showInheritedValue}
  {@const isNum = ft === 'int'}
  {@const isFloat = ft === 'float'}
  {@const hasBadge = ft && ft !== 'bool' && !caps.fieldCombobox?.[item.key]}
  {@const badgeClass = ft === 'string' || ft === 'str' ? 'badge-text' : ft === 'int' ? 'badge-number' : ft === 'float' ? 'badge-decimal' : (ft === 'string (UUID)' || ft === 'guid' || ft === 'uuid') ? 'badge-uuid' : 'badge-text'}
  {@const badgeText = ft === 'string' || ft === 'str' ? 'Text' : ft === 'int' ? 'Number' : ft === 'float' ? 'Decimal' : (ft === 'string (UUID)' || ft === 'guid' || ft === 'uuid') ? 'UUID' : ft ?? ''}
  {@const comboPlaceholder = badgeText ? `${badgeText} — Search…` : 'Search…'}
  {@const isLoca = caps.fieldCombobox?.[item.key]?.startsWith('loca:')}
  {@const isIconName = caps.fieldCombobox?.[item.key]?.startsWith('iconName:')}
  {@const expressionType = statType ? STAT_TYPE_METADATA[statType]?.fieldExpressionType?.[item.key] : undefined}
  {@const boolToggleDef = statType ? STAT_TYPE_METADATA[statType]?.fieldBoolToggle?.[item.key] : undefined}
  {@const syncSourceKey = statType ? STAT_TYPE_METADATA[statType]?.fieldSyncMap?.[item.key] : undefined}
  {@const fieldDisabled = !!syncSourceKey && localSyncLocked}
  {@const showReadOnlyMultiline = item.textarea || !!expressionType || (caps.fieldCombobox?.[item.key]?.startsWith('multi') ?? false) || parentValue.includes(';') || parentValue.length > 60}
  {#if boolToggleDef}
    {@const isOn = effectiveFieldValue === boolToggleDef.onValue}
    {#if reversed}
      <div class="flex items-center justify-end gap-2 text-xs min-w-0 self-end pb-1">
        <span class="text-[11px] cursor-pointer select-none transition-colors duration-200 {isOn ? 'text-sky-400' : 'text-[var(--th-text-500)]'}" role="button" tabindex="0" onclick={() => setFieldValue(item.key, isOn ? boolToggleDef!.offValue : boolToggleDef!.onValue)} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFieldValue(item.key, isOn ? boolToggleDef!.offValue : boolToggleDef!.onValue); } }}>{item.label ?? item.key}</span>
        <button type="button" class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 {isOn ? 'bg-sky-500' : 'bg-[var(--th-bg-600,#52525b)]'}" role="switch" aria-checked={isOn} aria-label={item.label ?? item.key} onclick={() => setFieldValue(item.key, isOn ? boolToggleDef!.offValue : boolToggleDef!.onValue)}>
          <span class="pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 {isOn ? 'translate-x-4.5' : 'translate-x-0.5'}"></span>
        </button>
      </div>
    {:else}
      <div class="flex items-center gap-2 text-xs min-w-0 self-end pb-1">
        <button type="button" class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 {isOn ? 'bg-sky-500' : 'bg-[var(--th-bg-600,#52525b)]'}" role="switch" aria-checked={isOn} aria-label={item.label ?? item.key} onclick={() => setFieldValue(item.key, isOn ? boolToggleDef!.offValue : boolToggleDef!.onValue)}>
          <span class="pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 {isOn ? 'translate-x-4.5' : 'translate-x-0.5'}"></span>
        </button>
        <span class="text-[11px] cursor-pointer select-none transition-colors duration-200 {isOn ? 'text-sky-400' : 'text-[var(--th-text-500)]'}" role="button" tabindex="0" onclick={() => setFieldValue(item.key, isOn ? boolToggleDef!.offValue : boolToggleDef!.onValue)} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFieldValue(item.key, isOn ? boolToggleDef!.offValue : boolToggleDef!.onValue); } }}>{item.label ?? item.key}</span>
      </div>
    {/if}
  {:else}
  <div class="flex flex-col gap-1.5 text-xs min-w-0">
    <label for="field-{item.key}" class="font-medium text-[var(--th-text-400)]">{item.label ?? item.key}
      {#if hasBadge}
        <span class="text-[10px] font-medium px-1.5 py-0.5 rounded-full {badgeClass}">{badgeText}</span>
      {:else if isLoca}
        <span class="text-[10px] font-medium px-1.5 py-0.5 rounded-full badge-loca">LOCA</span>
      {/if}
      {#if showInheritedValue}
        <span class="inheritance-status-badge">Inherited</span>
      {/if}
      {#if showOverrideBadge}
        <span class="override-status-badge">Override</span>
      {/if}
      {#if expressionType}
        <span class="expression-badge" data-expr-type={expressionType}>
          {expressionType === 'roll' ? 'Roll' : expressionType === 'effect' ? 'Functor' : expressionType === 'condition' ? 'Condition' : expressionType === 'cost' ? 'Cost' : 'Display'}
        </span>
        <button type="button"
          class="inline-flex items-center justify-center w-4 h-4 rounded text-[var(--th-text-500)] hover:text-[var(--th-text-200)] transition-colors cursor-help"
          use:tooltip={expressionType === 'roll' ? 'Dice roll expression. Example: Attack(AttackType.MeleeWeaponAttack) or SavingThrow(Ability.Dexterity, 15)'
            : expressionType === 'effect' ? 'Functor expression (semicolon-separated). Example: DealDamage(1d6,Fire) or ApplyStatus(BURNING,2)'
            : expressionType === 'condition' ? "Condition expression. Example: HasStatus('BURNING') or WieldingWeapon('Melee')"
            : expressionType === 'cost' ? 'Resource cost (colon+semicolon format). Example: ActionPoint:1 or SpellSlot:1:1;BonusActionPoint:1'
            : 'Display parameter for tooltip interpolation. Example: DealDamage(1d6,Fire) resolves in description text.'}
          aria-label="Expression syntax help"
        ><HelpCircle size={12} /></button>
      {/if}
      {#if item.generateUuid}
        <button type="button"
          class="inline-flex items-center justify-center w-5 h-5 rounded text-[var(--th-text-500)] hover:text-[var(--th-text-200)] hover:bg-[var(--th-bg-600)] transition-colors cursor-pointer"
          onclick={() => setFieldValue(item.key, generateUuid())}
          use:tooltip={"Generate random UUID"}
          aria-label="Generate random UUID"
        ><Shuffle size={12} /></button>
      {/if}
    </label>

    <div class:inheritance-field-shell={showOverrideToggle && expressionType !== 'cost'}>      <div class:inheritance-field-main={showOverrideToggle && expressionType !== 'cost'}>
        {#if showInheritedValue}
          {#if item.colorField}
            <div class="inheritance-readonly inheritance-readonly-color">
              <span class="shrink-0 w-5 h-5 rounded border border-white/20" style="background-color: {bg3ToCssColor(parentValue || '#000000')}"></span>
              <span class="truncate">{parentValue}</span>
            </div>
          {:else if isLoca}
            <div class="inheritance-readonly inheritance-readonly-loca">{parentValue}</div>
          {:else if expressionType === 'cost'}
            <CostFieldGroup
              value={parentValue}
              disabled={true}
              showOverride={showOverrideToggle}
              overrideEnabled={false}
              onOverrideToggle={() => handleOverrideToggle(true)}
            />
          {:else if caps.fieldCombobox?.[item.key]?.startsWith('multiSection:')}
            <MultiSelectCombobox
              options={fieldComboboxOptions(item.key)}
              selected={parentValue ? parentValue.split(';').map((v) => v.trim()).filter(Boolean) : []}
              placeholder=""
              disabled={true}
              onchange={() => {}}
            />
          {:else if displayTokens.length > 0}
            <div class="inheritance-readonly inheritance-readonly-multiline inheritance-token-list">
              {#each displayTokens as token}
                <span class="inheritance-token">{token}</span>
              {/each}
            </div>
          {:else if showReadOnlyMultiline}
            <div class="inheritance-readonly inheritance-readonly-multiline">{getDisplayValue(parentValue)}</div>
          {:else}
            <div class="inheritance-readonly">{getDisplayValue(parentValue)}</div>
          {/if}
        {:else if isLoca}
          <div class="loca-field">
            <SingleSelectCombobox
              options={fieldComboboxOptions(item.key)}
              value={effectiveFieldValue}
              placeholder="Type loca: or # for handles, text: or $ for text…"
              maxDisplayed={25}
              requirePrefix={['loca:', '#', 'text:', '$']}
              textOnlyPrefixes={['text:', '$']}
              displayValueOnly={true}
              locaResolver={resolveLocaText}
              hideLocaPreview={true}
              onchange={(v) => handleLocaChange(item.key, v)}
            />
          </div>
        {:else if caps.fieldCombobox?.[item.key]}
          {@const descriptor = caps.fieldCombobox[item.key]}
          {@const isSectionRef = descriptor.startsWith('section:')}
          {@const targetSection = isSectionRef ? descriptor.split(':')[1] : ''}
          {@const refDisplayName = isSectionRef && effectiveFieldValue ? modStore.lookupDisplayName(effectiveFieldValue) : undefined}
          {#if isSectionRef && refDisplayName}
            <div class="flex items-center gap-1">
              <div class="flex-1 min-w-0">
                <SingleSelectCombobox
                  options={fieldComboboxOptions(item.key)}
                  value={effectiveFieldValue}
                  placeholder={comboPlaceholder}
                  maxDisplayed={0}
                  disabled={fieldDisabled}
                  onchange={(v) => setFieldValue(item.key, v)}
                />
              </div>
              <button
                type="button"
                class="inline-flex items-center justify-center w-5 h-5 rounded text-[var(--th-text-500)] hover:text-sky-400 hover:bg-[var(--th-bg-600)] transition-colors cursor-pointer"
                onclick={() => jumpToReference(targetSection, effectiveFieldValue)}
                use:tooltip={`Jump to ${refDisplayName} in ${targetSection}`}
                aria-label={`Jump to ${refDisplayName} in ${targetSection}`}
              ><ExternalLink size={12} /></button>
            </div>
          {:else}
            {@const isMulti = descriptor.startsWith('multi')}
            {#if isMulti}
              <MultiSelectCombobox
                options={fieldComboboxOptions(item.key)}
                selected={effectiveFieldValue ? effectiveFieldValue.split(';').map((value) => value.trim()).filter(Boolean) : []}
                placeholder={comboPlaceholder}
                disabled={fieldDisabled}
                onchange={(vals) => setFieldValue(item.key, vals.join(';'))}
              />
            {:else}
              <SingleSelectCombobox
                options={fieldComboboxOptions(item.key)}
                value={effectiveFieldValue}
                placeholder={comboPlaceholder}
                maxDisplayed={isIconName ? 50 : 0}
                disabled={fieldDisabled}
                showAtlasIcon={isIconName}
                onchange={(v) => setFieldValue(item.key, v)}
              />
            {/if}
          {/if}
        {:else if expressionType === 'cost'}
          <CostFieldGroup
            value={effectiveFieldValue}
            disabled={fieldDisabled}
            onchange={(v) => setFieldValue(item.key, v)}
            showOverride={showOverrideToggle && !localSyncLocked}
            overrideEnabled={overrideEnabled}
            onOverrideToggle={() => handleOverrideToggle(!overrideEnabled)}
            showSync={!!syncSourceKey && !showInheritedValue}
            syncLocked={localSyncLocked}
            syncSourceKey={syncSourceKey ?? ''}
            onSyncToggle={() => { localSyncLocked = !localSyncLocked; }}
          />
        {:else if expressionType}
          <InlineCodeEditor
            value={effectiveFieldValue}
            {expressionType}
            onchange={(v) => setFieldValue(item.key, v)}
          />
        {:else if item.colorField}
          <div class="flex items-center gap-2">
            <input
              type="color"
              class="color-picker-swatch"
              value={bg3ToCssColor(effectiveFieldValue || '#000000')}
              oninput={(e) => setFieldValue(item.key, cssToBg3Color((e.target as HTMLInputElement).value))}
            />
            <input
              type="text"
              class="form-input flex-1"
              value={effectiveFieldValue}
              oninput={(e) => setFieldValue(item.key, (e.target as HTMLInputElement).value)}
              placeholder="#AARRGGBB"
            />
            {#if effectiveFieldValue}
              <span class="shrink-0 w-5 h-5 rounded border border-white/20" style="background-color: {bg3ToCssColor(effectiveFieldValue)}"></span>
            {/if}
          </div>
        {:else if item.textarea}
          <textarea class="form-input w-full" rows="2" disabled={fieldDisabled} value={effectiveFieldValue} oninput={(e) => setFieldValue(item.key, (e.target as HTMLTextAreaElement).value)}></textarea>
        {:else}
          <input id="field-{item.key}" type={(isNum || isFloat) ? 'number' : 'text'} step={isFloat ? 'any' : undefined} class="form-input w-full" disabled={fieldDisabled} value={effectiveFieldValue} oninput={(e) => setFieldValue(item.key, (e.target as HTMLInputElement).value)} />
        {/if}
      </div>

      {#if showOverrideToggle && expressionType !== 'cost'}
        <label class="inheritance-toggle" data-active={overrideEnabled ? 'true' : 'false'}
          use:tooltip={overrideEnabled ? 'Override active — uncheck to revert to inherited value' : 'Override inherited value'}
        >
          <input
            type="checkbox"
            checked={overrideEnabled}
            aria-label={`Enable override for ${item.label ?? item.key}`}
            onchange={(e) => handleOverrideToggle((e.target as HTMLInputElement).checked)}
          />
          <Pencil size={11} />
        </label>
      {/if}
    </div>
    {#if isLoca && (effectiveFieldValue || (showInheritedValue && parentValue))}
      {@const locaHandle = showInheritedValue ? parentValue : effectiveFieldValue}
      {@const locaPreviewText = resolveLocaText?.(locaHandle)}
      {#if locaPreviewText && locaPreviewText !== locaHandle}
        <details class="loca-inherited-details">
          <summary class="text-xs text-[var(--th-text-400)] cursor-pointer hover:text-[var(--th-text-200)] px-2 py-1 select-none">Preview localized text</summary>
          <div class="px-2 pb-1.5 pt-0.5 text-xs text-[var(--th-text-200)] whitespace-pre-wrap break-words">{locaPreviewText}</div>
        </details>
      {/if}
    {/if}
    {#if isIconName && !showInheritedValue && effectiveFieldValue}
      <div class="icon-field-preview-block">
        <IconAtlasPreview iconName={effectiveFieldValue} size="lg" />
        <span class="icon-preview-name">{effectiveFieldValue}</span>
      </div>
    {/if}
    {#if syncSourceKey && !showInheritedValue && expressionType !== 'cost'}
      <div class="flex items-center gap-2 mt-0.5">
        <button
          type="button"
          class="relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 {localSyncLocked ? 'bg-sky-500' : 'bg-[var(--th-bg-600,#52525b)]'}"
          role="switch"
          aria-checked={localSyncLocked}
          aria-label={`Auto-sync from ${syncSourceKey}`}
          onclick={() => { localSyncLocked = !localSyncLocked; }}
          use:tooltip={localSyncLocked ? `Auto-synced from ${syncSourceKey} — click to unlock` : `Click to auto-sync from ${syncSourceKey}`}
        >
          <span class="pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 {localSyncLocked ? 'translate-x-3.5' : 'translate-x-0.5'}"></span>
        </button>
        <span class="text-[11px] {localSyncLocked ? 'text-sky-400' : 'text-[var(--th-text-500)]'}">Sync from {syncSourceKey}</span>
      </div>
    {/if}
    {#if !isLoca && caps.fieldCombobox?.[item.key]?.startsWith('section:') && effectiveFieldValue}
      {@const selectedSectionOpt = fieldComboboxOptions(item.key).find((o) => o.value === effectiveFieldValue)}
      {#if selectedSectionOpt?._locaHandle}
        {@const sectionLocaText = resolveLocaText?.(selectedSectionOpt._locaHandle)}
        {#if sectionLocaText && sectionLocaText !== selectedSectionOpt._locaHandle}
          <details class="loca-inherited-details">
            <summary class="text-xs text-[var(--th-text-400)] cursor-pointer hover:text-[var(--th-text-200)] px-2 py-1 select-none">Preview localized text</summary>
            <div class="px-2 pb-1.5 pt-0.5 text-xs text-[var(--th-text-200)] whitespace-pre-wrap break-words">{sectionLocaText}</div>
          </details>
        {/if}
      {/if}
    {/if}
  </div>
  {/if}
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

  .inheritance-field-shell {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: stretch;
    gap: 0;
  }

  .inheritance-field-main {
    flex: 1;
    min-width: 0;
  }

  .inheritance-readonly {
    box-sizing: border-box;
    min-height: 2.25rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    background-color: rgba(39, 39, 42, 0.75);
    border: 1px solid rgba(56, 189, 248, 0.25);
    border-radius: 0.25rem;
    padding: 0.25rem 0.625rem;
    font-size: 0.8125rem;
    color: var(--th-text-200, #e4e4e7);
  }

  /* .inheritance-readonly-loca — no size override; inherits min-height: 2.25rem from .inheritance-readonly */

  .inheritance-readonly-multiline {
    align-items: flex-start;
    min-height: 4.5rem;
    white-space: pre-wrap;
    word-break: break-word;
  }

  /* Token lists (multiStatic/multiSection fields) should size to content, not inherit 4.5rem */
  .inheritance-token-list {
    min-height: 2.25rem;
    white-space: normal;
    word-break: normal;
  }

  .inheritance-readonly-color {
    justify-content: flex-start;
  }

  .inheritance-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    align-self: start;
    border: 1px solid var(--th-input-border);
    border-left: none;
    border-radius: 0 0.25rem 0.25rem 0;
    padding: 0 0.4rem;
    min-height: 2.25rem;
    min-width: fit-content;
    color: var(--th-text-400);
    background: var(--th-bg-800, rgba(39, 39, 42, 0.7));
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
  }

  .inheritance-toggle[data-active="true"] {
    border-color: rgba(56, 189, 248, 0.4);
    color: var(--th-text-sky-300, #7dd3fc);
    background: rgba(14, 165, 233, 0.12);
  }

  .inheritance-toggle input {
    margin: 0;
    accent-color: var(--th-accent-500, #38bdf8);
  }

  .inheritance-field-shell > .inheritance-field-main :global(.combobox-trigger),
  .inheritance-field-shell > .inheritance-field-main .form-input,
  .inheritance-field-shell > .inheritance-field-main .inheritance-readonly {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  .inheritance-status-badge,
  .override-status-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .inheritance-status-badge {
    background: rgba(56, 189, 248, 0.16);
    color: var(--th-text-sky-300, #7dd3fc);
  }

  .override-status-badge {
    background: rgba(245, 158, 11, 0.16);
    color: var(--th-badge-warn-text, #fbbf24);
  }

  .inheritance-token-list {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem;
  }

  .inheritance-token {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    background: rgba(63, 63, 70, 0.7);
    color: var(--th-text-200);
    font-size: 0.75rem;
  }

  .badge-uuid {
    background-color: var(--th-badge-new-bg);
    color: var(--th-badge-new-text);
  }

  .badge-number {
    background-color: var(--th-badge-info-bg);
    color: var(--th-badge-info-text);
  }

  .badge-text {
    background-color: var(--th-badge-muted-bg);
    color: var(--th-badge-muted-text);
  }

  .badge-decimal {
    background-color: var(--th-badge-warn-bg);
    color: var(--th-badge-warn-text);
  }

  .badge-loca {
    background-color: var(--th-badge-success-bg, #14532d);
    color: var(--th-badge-success-text, #86efac);
  }

  .loca-inherited-details {
    background-color: var(--th-bg-800, rgba(39, 39, 42, 0.6));
    border: 1px solid var(--th-input-border, rgba(63, 63, 70, 0.5));
    border-radius: 0.25rem;
    margin-top: 0.125rem;
  }

  .icon-field-preview-block {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.5rem;
    margin-top: 0.125rem;
    background-color: var(--th-bg-800, rgba(39, 39, 42, 0.6));
    border: 1px solid var(--th-input-border, rgba(63, 63, 70, 0.5));
    border-radius: 0.25rem;
  }

  .icon-preview-name {
    font-size: 0.75rem;
    color: var(--th-text-400);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

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

  .expression-field {
    font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;
    font-size: 0.8125rem;
    line-height: 1.5;
    white-space: pre-wrap;
    resize: vertical;
    min-height: 4.5rem;
    height: auto;
  }

  .expression-badge {
    display: inline-flex;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    vertical-align: middle;
  }

  .expression-badge[data-expr-type="roll"] {
    background-color: rgba(56, 189, 248, 0.15);
    color: var(--th-text-sky-400, #38bdf8);
  }

  .expression-badge[data-expr-type="effect"] {
    background-color: rgba(168, 85, 247, 0.15);
    color: var(--th-text-purple-400, #a855f7);
  }

  .expression-badge[data-expr-type="condition"] {
    background-color: rgba(251, 191, 36, 0.15);
    color: var(--th-text-amber-400, #fbbf24);
  }

  .expression-badge[data-expr-type="cost"] {
    background-color: rgba(52, 211, 153, 0.15);
    color: var(--th-text-emerald-400, #34d399);
  }

  .expression-badge[data-expr-type="display"] {
    background-color: rgba(148, 163, 184, 0.15);
    color: var(--th-text-400, #94a3b8);
  }
</style>
