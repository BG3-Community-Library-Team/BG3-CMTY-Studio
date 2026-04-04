<script lang="ts">
  import type { SectionCapabilities } from "../../lib/data/sectionCaps.js";
  import FieldsetShell from "./FieldsetShell.svelte";

  let {
    booleans = $bindable(),
    caps,
    allBoolKeysUsed,
    onaddBoolean,
    onremoveBoolean,
  }: {
    booleans: { key: string; value: boolean }[];
    caps: SectionCapabilities;
    allBoolKeysUsed: boolean;
    onaddBoolean: () => void;
    onremoveBoolean: (i: number) => void;
  } = $props();
</script>

<FieldsetShell items={booleans} label="boolean" allUsed={allBoolKeysUsed} onadd={onaddBoolean} onremove={(i) => onremoveBoolean(i)}>
  {#snippet children(b, _i)}
    <label class="flex-1 flex items-center gap-2 cursor-pointer select-none min-w-0">
      <span class="text-xs text-[var(--th-text-400)] w-48 truncate shrink-0" title={b.key}>{b.key}</span>
      <button
        type="button"
        class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 {b.value ? 'bg-emerald-500' : 'bg-[var(--th-bg-600,#52525b)]'}"
        role="switch"
        aria-checked={b.value}
        aria-label="{b.key} toggle"
        onclick={() => b.value = !b.value}
      >
        <span
          class="pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 {b.value ? 'translate-x-4' : 'translate-x-0.5'}"
        ></span>
      </button>
      <span class="text-[10px] text-[var(--th-text-500)] w-8">{b.value ? 'true' : 'false'}</span>
    </label>
  {/snippet}
</FieldsetShell>

