<script lang="ts">
  import { SELECTOR_FUNCTIONS, SELECTOR_PARAMS_BY_FN, PARAM_PLACEHOLDERS } from "../../lib/data/selectorDefs.js";
  import type { ComboboxOption } from "../../lib/utils/comboboxOptions.js";
  import type { SelectorItem } from "../../lib/utils/fieldCodec.js";
  import { tooltip } from "../../lib/actions/tooltip.js";
  import SingleSelectCombobox from "../SingleSelectCombobox.svelte";
  import CircleHelp from "@lucide/svelte/icons/circle-help";
  import X from "@lucide/svelte/icons/x";

  let {
    selectors = $bindable(),
    abilityOptions,
    actionResourceOptions,
    bonusTypeOptions,
    selectorIdOptions,
    guidOptionsForFn,
    warnKeys,
    onaddSelector,
    onremoveSelector,
  }: {
    selectors: SelectorItem[];
    abilityOptions: ComboboxOption[];
    actionResourceOptions: ComboboxOption[];
    bonusTypeOptions: ComboboxOption[];
    selectorIdOptions: ComboboxOption[];
    guidOptionsForFn: (fn: string) => ComboboxOption[];
    warnKeys: Set<string>;
    onaddSelector: () => void;
    onremoveSelector: (i: number) => void;
  } = $props();
</script>

<fieldset class="space-y-2">
  {#each selectors ?? [] as s, i}
    <div class="flex items-start gap-2 bg-zinc-800/40 rounded p-2 border border-zinc-700/50">
      <div class="flex-1 flex flex-col gap-1.5 min-w-0">
        <!-- Action + Function row -->
        <div class="flex items-center gap-2 flex-wrap">
          <select class="form-input w-20" bind:value={s.action} aria-label="Action">
            <option value="Insert">Insert</option>
            <option value="Remove">Remove</option>
          </select>
          <select class="form-input flex-1 min-w-36" bind:value={s.fn} aria-label="Selector function">
            {#each SELECTOR_FUNCTIONS as fnName}
              <option value={fnName}>{fnName}</option>
            {/each}
          </select>
          {#if s.fn === "SelectPassives"}
            <div class="flex items-center gap-2 shrink-0">
              <button
                type="button"
                class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 {s.isReplace ? 'bg-amber-500' : 'bg-[var(--th-bg-600,#52525b)]'}"
                role="switch"
                aria-checked={s.isReplace}
                aria-label="Replace passives"
                title={s.isReplace ? "Will output as ReplacePassives" : "Will output as SelectPassives"}
                onclick={() => s.isReplace = !s.isReplace}
              >
                <span
                  class="pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 {s.isReplace ? 'translate-x-4' : 'translate-x-0.5'}"
                ></span>
              </button>
              <span class="text-xs {s.isReplace ? 'text-amber-400' : 'text-[var(--th-text-400)]'}">Replace</span>
            </div>
          {/if}
        </div>

        {#if s.action === "Remove"}
          <input type="text" class="form-input w-full" bind:value={s.selectorUuid} aria-label="Selector UUID"
            placeholder="UUID of list referenced in selector" />
        {:else}
          {@const relevantParams = SELECTOR_PARAMS_BY_FN[s.fn] ?? []}
          {#if relevantParams.length > 0}
            <div class="grid grid-cols-2 gap-1.5">
              {#each relevantParams as pk}
                {@const fieldId = `selector-param-${i}-${pk}`}
                <div class="flex flex-col">
                  <label class="text-[10px] text-[var(--th-text-500)] mb-0.5 flex items-center gap-1" for={fieldId}>
                    {pk}
                    {#if PARAM_PLACEHOLDERS[pk]}
                      <span class="text-[var(--th-text-400)] cursor-help" use:tooltip={PARAM_PLACEHOLDERS[pk]}>
                        <CircleHelp class="w-3 h-3" />
                      </span>
                    {/if}
                  </label>
                  {#if pk === "PrepareType"}
                    <select id={fieldId} class="form-input text-xs" bind:value={s.params.PrepareType}>
                      <option value="">Default</option>
                      <option value="AlwaysPrepared">AlwaysPrepared</option>
                    </select>
                  {:else if pk === "CooldownType"}
                    <select id={fieldId} class="form-input text-xs" bind:value={s.params.CooldownType}>
                      <option value="">Default</option>
                      <option value="UntilRest">UntilRest</option>
                    </select>
                  {:else if pk === "LimitToProficiency"}
                    <div class="flex items-center gap-2 h-[30px]">
                      <button
                        id={fieldId}
                        type="button"
                        class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 {s.params.LimitToProficiency !== 'false' ? 'bg-[var(--th-accent-500,#0ea5e9)]' : 'bg-[var(--th-bg-600,#52525b)]'}"
                        role="switch"
                        aria-checked={s.params.LimitToProficiency !== 'false'}
                        aria-label="Limit to proficiency"
                        onclick={() => s.params.LimitToProficiency = s.params.LimitToProficiency === 'false' ? 'true' : 'false'}
                      >
                        <span
                          class="pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 {s.params.LimitToProficiency !== 'false' ? 'translate-x-4' : 'translate-x-0.5'}"
                        ></span>
                      </button>
                      <span class="text-xs text-[var(--th-text-400)]">{s.params.LimitToProficiency !== 'false' ? 'Yes' : 'No'}</span>
                    </div>
                  {:else if pk === "Amount" || pk === "SwapAmount"}
                    <input id={fieldId} type="number" min="0" step="1" class="form-input text-xs h-[30px]"
                      bind:value={s.params[pk as keyof typeof s.params]}
                      placeholder="Number" />
                  {:else if pk === "CastingAbility"}
                    <SingleSelectCombobox
                      options={abilityOptions}
                      value={s.params.CastingAbility}
                      placeholder="Ability — Select ability…"
                      onchange={(v) => s.params.CastingAbility = v}
                    />
                  {:else if pk === "ActionResource"}
                    <SingleSelectCombobox
                      options={actionResourceOptions}
                      value={s.params.ActionResource}
                      placeholder="UUID — Select action resource…"
                      onchange={(v) => s.params.ActionResource = v}
                    />
                  {:else if pk === "BonusType"}
                    <SingleSelectCombobox
                      options={bonusTypeOptions}
                      value={s.params.BonusType || "AbilityBonus"}
                      placeholder="Text — Select bonus type…"
                      onchange={(v) => s.params.BonusType = v}
                    />
                  {:else if pk === "SelectorId"}
                    <SingleSelectCombobox
                      options={selectorIdOptions}
                      value={s.params.SelectorId}
                      placeholder="Text — e.g. BardCantrip"
                      onchange={(v) => s.params.SelectorId = v}
                    />
                  {:else if pk === "Guid"}
                    <SingleSelectCombobox
                      options={guidOptionsForFn(s.fn)}
                      value={s.params.Guid}
                      placeholder="UUID — Select list UUID…"
                      onchange={(v) => s.params.Guid = v}
                    />
                  {:else}
                    <input id={fieldId} type="text" class="form-input text-xs"
                      bind:value={s.params[pk as keyof typeof s.params]}
                      placeholder="" />
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        {/if}


      </div>
      <button class="text-xs text-red-400 hover:text-red-300 self-center px-1.5 min-w-6 min-h-6 inline-flex items-center justify-center" onclick={() => onremoveSelector(i)} aria-label="Remove selector"><X size={14} /></button>
    </div>
  {/each}
  <div class="flex justify-end">
    <button class="h-8 px-2.5 text-xs font-medium text-sky-300 bg-sky-900/40 border border-sky-700/50 rounded hover:bg-sky-800/50 transition-colors inline-flex items-center gap-1" onclick={onaddSelector}>+ Add Selector</button>
  </div>
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
  select.form-input {
    appearance: auto;
  }
</style>
