<script lang="ts">
  import type { SectionCapabilities } from "../../lib/data/sectionCaps.js";
  import type { ComboboxOption } from "../../lib/utils/comboboxOptions.js";
  import MultiSelectCombobox from "../MultiSelectCombobox.svelte";
  import FieldsetShell from "./FieldsetShell.svelte";

  let {
    children: childItems = $bindable(),
    caps,
    getChildValueOptions,
    warnKeys,
    allChildTypesUsed = false,
    onaddChild,
    onremoveChild,
  }: {
    children: { type: string; values: string[]; action: string; modGuid: string }[];
    caps: SectionCapabilities;
    getChildValueOptions: (childType: string) => ComboboxOption[];
    warnKeys: Set<string>;
    allChildTypesUsed?: boolean;
    onaddChild: () => void;
    onremoveChild: (i: number) => void;
  } = $props();


</script>

<FieldsetShell items={childItems} label="child" allUsed={allChildTypesUsed} onadd={onaddChild} onremove={(i) => onremoveChild(i)} rowClass="items-start">
  {#snippet children(c, _i)}
    <div class="flex-1 flex flex-col gap-1 min-w-0">
      <MultiSelectCombobox
        label={c.type}
        options={getChildValueOptions(c.type)}
        selected={c.values}
        placeholder="Search or paste UUID(s)…"
        onchange={(vals) => c.values = vals}
      />
    </div>
  {/snippet}
</FieldsetShell>

