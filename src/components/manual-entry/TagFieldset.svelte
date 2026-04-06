<script lang="ts">
  import type { ComboboxOption } from "../../lib/utils/comboboxOptions.js";
  import MultiSelectCombobox from "../MultiSelectCombobox.svelte";
  import FieldsetShell from "./FieldsetShell.svelte";

  let {
    tags = $bindable(),
    allowedTagTypes,
    getTagOptionsForType,
    warnKeys,
    allTagTypesUsed = false,
    hideRemoveButton = false,
    onaddTag,
    onremoveTag,
  }: {
    tags: { uuids: string[]; action: string; type: string; modGuid: string }[];
    allowedTagTypes: string[];
    getTagOptionsForType: (tagType: string) => ComboboxOption[];
    warnKeys: Set<string>;
    allTagTypesUsed?: boolean;
    hideRemoveButton?: boolean;
    onaddTag: () => void;
    onremoveTag: (i: number) => void;
  } = $props();
</script>

<FieldsetShell items={tags} label="tag" allUsed={allTagTypesUsed} {hideRemoveButton} onadd={onaddTag} onremove={(i) => onremoveTag(i)} rowClass="items-start">
  {#snippet children(t, _i)}
    <div class="flex-1 min-w-0">
      <MultiSelectCombobox
        label={t.type}
        options={getTagOptionsForType(t.type)}
        selected={t.uuids}
        placeholder="Search or paste tag UUID(s)…"
        onchange={(vals) => t.uuids = vals}
      />
    </div>
  {/snippet}
</FieldsetShell>

