<script lang="ts">
  import type { DiffEntry } from "../lib/types/index.js";
  import ContextMenu from "./ContextMenu.svelte";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Plus from "@lucide/svelte/icons/plus";
  import ToggleLeft from "@lucide/svelte/icons/toggle-left";
  import ToggleRight from "@lucide/svelte/icons/toggle-right";
  import { m } from "../paraglide/messages.js";

  let {
    entry,
    section,
    x,
    y,
    isEnabled = true,
    onclose,
    onedit,
    onaddsubrace,
    ontoggle,
  }: {
    entry: DiffEntry;
    section: string;
    x: number;
    y: number;
    isEnabled?: boolean;
    onclose: () => void;
    onedit?: (entry: DiffEntry) => void;
    onaddsubrace?: (parentEntry: DiffEntry) => void;
    ontoggle?: (entry: DiffEntry) => void;
  } = $props();
</script>

<ContextMenu {x} {y} header={entry.display_name || entry.uuid} headerTitle={entry.display_name ?? entry.uuid} {onclose}>
  {#if onedit}
    <button
      type="button"
      class="ctx-item"
      role="menuitem"
      onclick={() => { onedit(entry); onclose(); }}
    >
      <Pencil size={12} class="shrink-0" />
      {m.entry_context_menu_edit()}
    </button>
  {/if}
  {#if ontoggle}
    <button
      type="button"
      class="ctx-item"
      role="menuitem"
      onclick={() => { ontoggle(entry); onclose(); }}
    >
      {#if isEnabled}
        <ToggleRight size={12} class="shrink-0" />
        {m.entry_context_menu_disable()}
      {:else}
        <ToggleLeft size={12} class="shrink-0" />
        {m.entry_context_menu_enable()}
      {/if}
    </button>
  {/if}
  {#if section === 'Races' && onaddsubrace}
    <button
      type="button"
      class="ctx-item"
      role="menuitem"
      onclick={() => { onaddsubrace(entry); onclose(); }}
    >
      <Plus size={12} class="shrink-0" />
      {m.entry_context_menu_add_sub_race()}
    </button>
  {/if}
</ContextMenu>
