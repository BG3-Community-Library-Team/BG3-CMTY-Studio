<script lang="ts">
  import type { Section } from "../lib/types/index.js";
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Download from "@lucide/svelte/icons/download";
  import { m } from "../paraglide/messages.js";

  let {
    section,
    x,
    y,
    onclose,
    onexpand,
    oncollapse,
  }: {
    section: Section;
    x: number;
    y: number;
    onclose: () => void;
    onexpand: () => void;
    oncollapse: () => void;
  } = $props();

  let showExtractSub = $state(false);

  /** Additional mods that contain this section (detected via listPakSections). */
  let folderName = $derived(section as string);
  let modsWithSection = $derived.by(() => {
    const result: { name: string; path: string }[] = [];
    for (const [modPath, sections] of modStore.modPakSections) {
      if (sections.includes(folderName)) {
        const name = modPath.split(/[\\/]/).pop() ?? modPath;
        result.push({ name, path: modPath });
      }
    }
    return result;
  });

  function handleExpand() {
    onexpand();
    onclose();
  }

  function handleCollapse() {
    oncollapse();
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

  <!-- Separator -->
  <div class="my-1 border-t border-[var(--th-border-700,#3f3f46)]/50"></div>

  <!-- Extract from additional mods -->
  {#if modsWithSection.length > 0}
    <div class="my-1 border-t border-[var(--th-border-700,#3f3f46)]/50"></div>

    <div
      class="relative"
      role="menuitem"
      tabindex="-1"
      onmouseenter={() => showExtractSub = true}
      onmouseleave={() => showExtractSub = false}
    >
      <button
        class="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[var(--th-text-200)] hover:bg-[var(--th-bg-700,#27272a)] transition-colors"
        onclick={() => showExtractSub = !showExtractSub}
      >
        <Download size={14} class="text-sky-400" />
        {m.section_context_extract_files()}
        <ChevronRight size={12} class="ml-auto text-[var(--th-text-500)]" />
      </button>

      {#if showExtractSub}
        <div
          class="absolute left-full top-0 ml-1 min-w-[180px] bg-[var(--th-bg-800,#1f1f23)] border border-[var(--th-border-700,#3f3f46)]
                 rounded-lg shadow-xl shadow-black/40 py-1"
          role="menu"
        >
          {#each modsWithSection as mod}
            <button
              class="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[var(--th-text-200)] hover:bg-[var(--th-bg-700,#27272a)] transition-colors truncate"
              onclick={() => { /* TODO: mod-specific extraction is no longer relevant, remove */ onclose(); }}
              role="menuitem"
              title={mod.path}
            >
              <Download size={14} class="text-amber-400 shrink-0" />
              <span class="truncate">{mod.name}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>
