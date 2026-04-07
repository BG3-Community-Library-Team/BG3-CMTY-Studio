<script lang="ts">
  import type { Section } from "../lib/types/index.js";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import { m } from "../paraglide/messages.js";

  let {
    section,
    x,
    y,
    onclose,
    onexpand,
    oncollapse,
    onrefresh,
  }: {
    section: Section;
    x: number;
    y: number;
    onclose: () => void;
    onexpand: () => void;
    oncollapse: () => void;
    onrefresh?: () => void;
  } = $props();

  function handleExpand() {
    onexpand();
    onclose();
  }

  function handleCollapse() {
    oncollapse();
    onclose();
  }

  function handleRefresh() {
    onrefresh?.();
    onclose();
  }

  /** Clamp the menu position so it doesn't overflow the viewport. */
  let menuStyle = $derived.by(() => {
    const vw = typeof window !== "undefined" ? window.innerWidth : 800;
    const vh = typeof window !== "undefined" ? window.innerHeight : 600;
    const menuWidth = 220;
    const menuHeight = 180;
    const clampedX = Math.min(x, vw - menuWidth - 8);
    const clampedY = Math.min(y, vh - menuHeight - 8);
    return `left: ${clampedX}px; top: ${clampedY}px;`;
  });
</script>

<!-- Backdrop to catch clicks outside -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-[100]"
  onmousedown={onclose}
  oncontextmenu={(e) => { e.preventDefault(); onclose(); }}
></div>

<!-- Context menu -->
<div
  class="fixed z-[101] min-w-[200px] bg-[var(--th-bg-800,#1f1f23)] border border-[var(--th-border-700,#3f3f46)]
         rounded-lg shadow-xl shadow-black/40 py-1 text-sm select-none"
  style={menuStyle}
  role="menu"
>
  <!-- Expand / Collapse -->
  <button
    class="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[var(--th-text-200)] hover:bg-[var(--th-bg-700,#27272a)] transition-colors"
    onclick={handleExpand}
    role="menuitem"
  >
    <ChevronRight size={14} class="text-[var(--th-text-500)]" />
    {m.section_context_expand()}
  </button>
  <button
    class="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[var(--th-text-200)] hover:bg-[var(--th-bg-700,#27272a)] transition-colors"
    onclick={handleCollapse}
    role="menuitem"
  >
    <ChevronRight size={14} class="rotate-90 text-[var(--th-text-500)]" />
    {m.section_context_collapse()}
  </button>

  {#if onrefresh}
    <div class="mx-2 my-1 border-t border-[var(--th-border-700)]/50"></div>
    <button
      class="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[var(--th-text-200)] hover:bg-[var(--th-bg-700,#27272a)] transition-colors"
      onclick={handleRefresh}
      role="menuitem"
    >
      <RefreshCw size={14} class="text-[var(--th-text-500)]" />
      Refresh
    </button>
  {/if}

</div>
