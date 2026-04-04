<!--
  TagBadge: Reusable badge component with hover tooltip for entry type tags.
  Supports NEW, EDIT, DUP, IMP, and warning (⚠) badges.
  Tooltip uses fixed positioning with viewport bounds awareness.
-->
<script lang="ts">
  export type TagType = "NEW" | "EDIT" | "DUP" | "IMP" | "WARN" | "ERR" | "MOD" | "OVRD" | "BASE";

  let { tag }: { tag: TagType } = $props();

  const TAG_STYLES: Record<TagType, string> = {
    NEW:  "bg-violet-800/50 text-violet-300",
    EDIT: "bg-amber-700 text-amber-100",
    DUP:  "bg-zinc-700 text-zinc-300",
    IMP:  "bg-teal-800/50 text-teal-300",
    WARN: "bg-amber-600/50 text-amber-300",
    ERR:  "bg-red-700/50 text-red-300",
    MOD:  "bg-sky-800/50 text-sky-300",
    OVRD: "bg-orange-800/50 text-orange-300",
    BASE: "bg-zinc-700/40 text-zinc-400",
  };

  const TAG_LABELS: Record<TagType, string> = {
    NEW:  "NEW",
    EDIT: "EDIT",
    DUP:  "DUP",
    IMP:  "IMP",
    WARN: "⚠",
    ERR:  "✕",
    MOD:  "MOD",
    OVRD: "OVRD",
    BASE: "BASE",
  };

  const TAG_TOOLTIPS: Record<TagType, string> = {
    NEW:  "New: This entry has been introduced by the active mod",
    EDIT: "Edited: This entry differs from the mod's unpacked files",
    DUP:  "Duplicate: This entry matches the mod's unpacked files exactly",
    IMP:  "Imported: Entries from a pre-existing configuration file",
    WARN: "Warning: This entry has no actionable changes and will be skipped in output",
    ERR:  "Error: This entry has configuration errors that must be fixed",
    MOD:  "Modified: This entry has unsaved changes",
    OVRD: "Override: This entry overrides vanilla or loaded mod data",
    BASE: "Base: Unmodified vanilla game entry",
  };

  let showTooltip = $state(false);
  let badgeEl: HTMLSpanElement | undefined = $state(undefined);
  let tipX = $state(0);
  let tipY = $state(0);
  let position: "above" | "below" = $state("above");

  function show() {
    showTooltip = true;
    requestAnimationFrame(() => {
      if (!badgeEl) return;
      const rect = badgeEl.getBoundingClientRect();
      const vw = window.innerWidth;
      let x = rect.left + rect.width / 2;
      const HALF_W = 120;
      if (x - HALF_W < 8) x = HALF_W + 8;
      if (x + HALF_W > vw - 8) x = vw - HALF_W - 8;
      tipX = x;
      if (rect.top < 60) {
        position = "below";
        tipY = rect.bottom + 6;
      } else {
        position = "above";
        tipY = rect.top - 6;
      }
    });
  }
</script>

<span
  bind:this={badgeEl}
  class="text-xs font-mono px-1.5 py-0.5 rounded {TAG_STYLES[tag]} cursor-default select-none"
  onmouseenter={show}
  onmouseleave={() => showTooltip = false}
  role="img"
  aria-label={TAG_TOOLTIPS[tag]}
>
  {TAG_LABELS[tag]}
</span>

{#if showTooltip}
  <span
    class="fixed z-[200] px-2.5 py-1.5 text-xs leading-tight font-sans whitespace-nowrap rounded-md shadow-lg pointer-events-none
           bg-[var(--th-bg-950)] text-[var(--th-tooltip-text,var(--th-text-100))] border border-[var(--th-border-600)]"
    style="left: {tipX}px; {position === 'above' ? `bottom: calc(100vh - ${tipY}px)` : `top: ${tipY}px`}; transform: translateX(-50%);"
  >
    {TAG_TOOLTIPS[tag]}
  </span>
{/if}
