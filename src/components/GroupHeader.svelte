<!--
  PF-032: Collapsible Group Header.
  Renders a group label with entry count, expand/collapse toggle,
  and a group-level select-all checkbox.
-->
<script lang="ts">
  import type { EntryGroup } from "../lib/utils/grouping.js";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import SquareDashed from "@lucide/svelte/icons/square-dashed";
  import { m } from "../paraglide/messages.js";

  let { group, expanded, ontoggle, onselectall }: {
    group: EntryGroup;
    expanded: boolean;
    ontoggle: () => void;
    onselectall: () => void;
  } = $props();
</script>

<div
  class="flex items-center gap-2 px-3 py-1.5 rounded bg-[var(--th-bg-700)]
         text-xs font-semibold uppercase tracking-wider text-[var(--th-text-400)]
         select-none"
>
  <!-- Expand/collapse toggle -->
  <button
    class="text-[var(--th-text-500)] hover:text-[var(--th-text-200)]
           text-xs leading-none"
    onclick={ontoggle}
    aria-expanded={expanded}
    aria-label={expanded ? m.group_header_collapse_aria({ key: group.key }) : m.group_header_expand_aria({ key: group.key })}
    type="button"
  ><ChevronRight size={12} class="transition-transform {expanded ? 'rotate-90' : ''}" /></button>

  <!-- Group label (clickable to toggle) -->
  <button
    class="flex-1 text-left hover:text-[var(--th-text-200)] transition-colors"
    onclick={ontoggle}
    type="button"
  >
    {group.label}
  </button>

  <!-- Group select-all -->
  <button
    class="text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors
           px-1.5 py-0.5 rounded border border-sky-400/30 hover:border-sky-300/40"
    onclick={onselectall}
    title={m.group_header_toggle_all_title()}
    type="button"
  ><SquareDashed size={12} class="inline -mt-0.5" /> All</button>
</div>
