<script lang="ts">
  import type { ComboboxOption } from "../../lib/utils/comboboxOptions.js";
  import SingleSelectCombobox from "../SingleSelectCombobox.svelte";
  import FieldsetShell from "./FieldsetShell.svelte";

  let {
    spellFields = $bindable(),
    availableSpellFieldKeys,
    onaddSpellField,
    onremoveSpellField,
  }: {
    spellFields: { key: string; value: string }[];
    availableSpellFieldKeys: string[];
    onaddSpellField: () => void;
    onremoveSpellField: (i: number) => void;
  } = $props();
</script>

<FieldsetShell items={spellFields} label="stat field" alwaysShowAdd onadd={onaddSpellField} onremove={(i) => onremoveSpellField(i)}>
  {#snippet header()}
    <p class="text-xs text-[var(--th-text-500)]">Each field becomes a top-level key in the config. Values are semicolon-separated string arrays.</p>
  {/snippet}
  {#snippet children(f, i)}
    <div class="w-40">
      <SingleSelectCombobox
        label={i === 0 ? "Field" : ""}
        options={availableSpellFieldKeys.map(k => ({ value: k, label: k }))}
        value={f.key}
        placeholder="e.g. ContainerSpells"
        onchange={(v) => f.key = v}
      />
    </div>
    <input type="text" class="form-input flex-1" bind:value={f.value} placeholder="Value1;Value2;..." />
  {/snippet}
</FieldsetShell>

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
