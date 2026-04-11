<script lang="ts">
  import X from "@lucide/svelte/icons/x";
  import PanelRightOpen from "@lucide/svelte/icons/panel-right-open";
  import PanelRightClose from "@lucide/svelte/icons/panel-right-close";
  import { tooltip } from "../../lib/actions/tooltip.js";
  import type { SectionCapabilities } from "../../lib/data/sectionCaps.js";
  import { m } from "../../paraglide/messages.js";
  import type { FormLayout } from "../../lib/data/formLayouts.js";

  let {
    isEdit = false,
    baseCaps,
    caps,
    entryFilter = undefined,
    selectedNodeType = $bindable(""),
    blacklist = $bindable(false),
    layout = undefined,
    rawAttributes = null,
    showSummary = false,
    getBoolValue,
    setBoolValue,
    onclose,
    ontoggleSummary = undefined,
  }: {
    isEdit: boolean;
    baseCaps: SectionCapabilities;
    caps: SectionCapabilities;
    entryFilter?: { field: string; value: string };
    selectedNodeType: string;
    blacklist: boolean;
    layout?: FormLayout;
    rawAttributes?: Record<string, string> | null;
    showSummary?: boolean;
    getBoolValue: (key: string) => boolean;
    setBoolValue: (key: string, value: boolean) => void;
    onclose: () => void;
    ontoggleSummary?: () => void;
  } = $props();
</script>

<div class="flex items-center justify-between sticky top-0 z-[3] bg-[var(--th-bg-900)] py-1">
  <div class="flex items-center gap-3">
    <h4 class="text-sm font-semibold text-[var(--th-text-200)]">
      {isEdit ? m.form_header_edit_entry() : m.form_header_add_entry()}
    </h4>
    {#if baseCaps.nodeTypes && !(entryFilter?.field === "node_id" && baseCaps.nodeTypes[entryFilter.value])}
      <select
        class="form-input text-xs h-6 py-0"
        value={selectedNodeType}
        onchange={(e) => selectedNodeType = (e.target as HTMLSelectElement).value}
      >
        {#each Object.entries(baseCaps.nodeTypes) as [nodeId, label]}
          <option value={nodeId}>{label}</option>
        {/each}
      </select>
    {/if}
    {#if caps.hasBlacklist}
      <div class="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          class="relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 {blacklist ? 'bg-red-500' : 'bg-[var(--th-bg-600,#52525b)]'}"
          role="switch"
          aria-checked={blacklist}
          aria-label={m.form_header_cf_blacklist()}
          use:tooltip={m.form_header_cf_blacklist_tooltip()}
          onclick={() => blacklist = !blacklist}
        >
          <span
            class="pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 {blacklist ? 'translate-x-3.5' : 'translate-x-0.5'}"
          ></span>
        </button>
        <span class="text-[11px] cursor-pointer select-none {blacklist ? 'text-red-400' : 'text-[var(--th-text-500)]'}" role="button" tabindex="0" onclick={() => blacklist = !blacklist} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); blacklist = !blacklist; } }}>{m.form_header_cf_blacklist()}</span>
      </div>
    {/if}
    {#if layout?.headerBooleans}
      {#each layout.headerBooleans as bKey}
        {#if !(bKey === 'IsMulticlass' && ((entryFilter?.field === 'ProgressionType' && entryFilter.value === '2') || rawAttributes?.ProgressionType === '2'))}
        <div class="flex items-center gap-1.5 shrink-0">
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
          <span class="text-[11px] cursor-pointer select-none {getBoolValue(bKey) ? 'text-sky-400' : 'text-[var(--th-text-500)]'}" role="button" tabindex="0" onclick={() => setBoolValue(bKey, !getBoolValue(bKey))} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setBoolValue(bKey, !getBoolValue(bKey)); } }}>{bKey}</span>
        </div>
        {/if}
      {/each}
    {/if}
  </div>
  <div class="flex items-center gap-1">
    {#if ontoggleSummary}
      <button
        class="text-xs text-[var(--th-text-400)] hover:text-[var(--th-text-200)] min-w-6 min-h-6 inline-flex items-center justify-center"
        onclick={ontoggleSummary}
        aria-label="Toggle summary panel"
        use:tooltip={"Toggle summary panel"}
      >
        {#if showSummary}
          <PanelRightClose size={14} />
        {:else}
          <PanelRightOpen size={14} />
        {/if}
      </button>
    {/if}
    <button class="text-xs text-[var(--th-text-400)] hover:text-[var(--th-text-200)] min-w-6 min-h-6 inline-flex items-center justify-center" onclick={onclose} aria-label={m.form_header_close_aria()}><X size={14} /></button>
  </div>
</div>

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
  select.form-input {
    appearance: auto;
  }
</style>
