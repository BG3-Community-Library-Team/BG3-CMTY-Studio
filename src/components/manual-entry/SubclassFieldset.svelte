<script lang="ts">
  import type { ComboboxOption } from "../../lib/utils/comboboxOptions.js";
  import SingleSelectCombobox from "../SingleSelectCombobox.svelte";
  import FieldsetShell from "./FieldsetShell.svelte";

  let {
    subclasses = $bindable(),
    availableSubclassOptions,
    warnKeys,
    onaddSubclass,
    onremoveSubclass,
  }: {
    subclasses: { uuid: string; action: string; modGuid: string }[];
    availableSubclassOptions: ComboboxOption[];
    warnKeys: Set<string>;
    onaddSubclass: () => void;
    onremoveSubclass: (i: number) => void;
  } = $props();
</script>

<FieldsetShell items={subclasses} label="subclass removal" alwaysShowAdd onadd={onaddSubclass} onremove={(i) => onremoveSubclass(i)}>
  {#snippet header()}
    <p class="text-xs text-[var(--th-text-500)]">Subclass insertion is automatic. Only removal requires configuration.</p>
  {/snippet}
  {#snippet children(s, i)}
    <div class="flex-1 min-w-0">
      <SingleSelectCombobox
        label={i === 0 ? "Subclass UUID" : ""}
        options={availableSubclassOptions}
        value={s.uuid}
        placeholder="Search or paste UUID…"
        onchange={(v) => s.uuid = v}
      />
    </div>
  {/snippet}
</FieldsetShell>
