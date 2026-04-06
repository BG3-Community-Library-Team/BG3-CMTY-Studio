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
    NEW:  "badge-new",
    EDIT: "badge-edit",
    DUP:  "badge-muted",
    IMP:  "badge-import",
    WARN: "badge-warn",
    ERR:  "badge-error",
    MOD:  "badge-info",
    OVRD: "badge-override",
    BASE: "badge-muted",
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

<style>
  .badge-new      { background-color: var(--th-badge-new-bg);      color: var(--th-badge-new-text); }
  .badge-edit     { background-color: var(--th-badge-edit-bg);     color: var(--th-badge-edit-text); }
  .badge-muted    { background-color: var(--th-badge-muted-bg);    color: var(--th-badge-muted-text); }
  .badge-import   { background-color: var(--th-badge-import-bg);   color: var(--th-badge-import-text); }
  .badge-warn     { background-color: var(--th-badge-warn-bg);     color: var(--th-badge-warn-text); }
  .badge-error    { background-color: var(--th-badge-error-bg);    color: var(--th-badge-error-text); }
  .badge-info     { background-color: var(--th-badge-info-bg);     color: var(--th-badge-info-text); }
  .badge-override { background-color: var(--th-badge-override-bg); color: var(--th-badge-override-text); }
</style>
