<!--
  TagBadge: Reusable badge component with hover tooltip for entry type tags.
  Supports NEW, EDIT, DUP, IMP, and warning (⚠) badges.
  Tooltip uses fixed positioning with viewport bounds awareness.
-->
<script lang="ts">
  import { m } from "../paraglide/messages.js";

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
    NEW:  m.tag_tooltip_new(),
    EDIT: m.tag_tooltip_edit(),
    DUP:  m.tag_tooltip_dup(),
    IMP:  m.tag_tooltip_imp(),
    WARN: m.tag_tooltip_warn(),
    ERR:  m.tag_tooltip_err(),
    MOD:  m.tag_tooltip_mod(),
    OVRD: m.tag_tooltip_ovrd(),
    BASE: m.tag_tooltip_base(),
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
