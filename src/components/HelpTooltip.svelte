<!--
  PF-030: Contextual Help Tooltip.
  Renders a small (?) icon next to a label. On hover/focus, shows a positioned
  tooltip with help text from the FIELD_HELP map.  If no help text exists for
  the given key, renders nothing (graceful degradation).

  Uses fixed positioning with getBoundingClientRect() so the tooltip escapes
  any ancestor overflow:hidden/auto containers (e.g. scrolling SectionPanels).
-->
<script lang="ts">
  import { getHelpText } from "../lib/utils/helpText.js";
  import { m } from "../paraglide/messages.js";

  let { helpKey }: { helpKey: string } = $props();

  let text = $derived(getHelpText(helpKey));
  let visible = $state(false);
  let triggerEl: HTMLButtonElement | undefined = $state(undefined);

  // Fixed tooltip position (viewport coordinates)
  let tooltipX = $state(0);
  let tooltipY = $state(0);
  let position: "above" | "below" = $state("above");

  let tooltipEl: HTMLDivElement | undefined = $state(undefined);

  function show() {
    if (!text) return;
    visible = true;
    requestAnimationFrame(() => {
      if (triggerEl) {
        const rect = triggerEl.getBoundingClientRect();
        const zoom = getComputedZoom(triggerEl);
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        // Measure actual tooltip dimensions when available
        const tooltipWidth = tooltipEl?.offsetWidth ?? 280;
        const tooltipHeight = tooltipEl?.offsetHeight ?? 40;
        const halfWidth = tooltipWidth / 2;
        // Horizontal: anchor near the trigger, offset based on available space
        let x = rect.left / zoom + rect.width / zoom / 2;
        // Clamp so tooltip stays within viewport with 8px margin
        if (x - halfWidth < 8) x = halfWidth + 8;
        if (x + halfWidth > vw / zoom - 8) x = vw / zoom - halfWidth - 8;
        tooltipX = x;
        // Vertical: prefer below the trigger (directly under icon), fall back to above
        const gap = 2; // minimal gap so tooltip feels connected to icon
        const rBottom = rect.bottom / zoom;
        const rTop = rect.top / zoom;
        const spaceBelow = vh / zoom - rBottom;
        const spaceAbove = rTop;
        if (spaceBelow >= tooltipHeight + gap + 4) {
          position = "below";
          tooltipY = rBottom + gap;
        } else if (spaceAbove >= tooltipHeight + gap + 4) {
          position = "above";
          tooltipY = rTop - gap;
        } else {
          if (spaceBelow >= spaceAbove) {
            position = "below";
            tooltipY = rBottom + gap;
          } else {
            position = "above";
            tooltipY = rTop - gap;
          }
        }
      }
    });
  }

  /** Walk up the DOM to find the effective CSS zoom factor. */
  function getComputedZoom(el: HTMLElement): number {
    let zoom = 1;
    let current: HTMLElement | null = el;
    while (current) {
      const z = parseFloat(getComputedStyle(current).zoom || '1');
      if (z && z !== 1) zoom *= z;
      current = current.parentElement;
    }
    return zoom;
  }

  function hide() {
    visible = false;
  }

  /** Svelte action: moves element to document.body to escape stacking contexts. */
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      },
    };
  }

  const tooltipId = $derived(`help-${helpKey.replace(/[^a-zA-Z0-9]/g, "-")}`);
</script>

{#if text}
  <span class="inline-flex items-center">
    <button
      bind:this={triggerEl}
      class="inline-flex items-center justify-center w-4 h-4 rounded-full
             text-xs leading-none font-bold
             text-[var(--th-text-500)] hover:text-[var(--th-text-200)]
             bg-[var(--th-bg-700)] hover:bg-[var(--th-bg-600,var(--th-border-600))]
             cursor-help"
      onmouseenter={show}
      onmouseleave={hide}
      onfocus={show}
      onblur={hide}
      aria-describedby={visible ? tooltipId : undefined}
      type="button"
      tabindex="0"
    >{m.help_tooltip_text()}</button>
  </span>
{/if}

{#if visible && text}
  <div
    use:portal
    id={tooltipId}
    role="tooltip"
    bind:this={tooltipEl}
    class="fixed z-[200] max-w-xs px-3 py-2 text-xs leading-relaxed rounded-md shadow-lg
           bg-[var(--th-bg-950)] text-[var(--th-tooltip-text,var(--th-text-100))] border border-[var(--th-border-600)]
           pointer-events-none"
    style="left: {tooltipX}px; top: {tooltipY}px; transform: translateX(-50%){position === 'above' ? ' translateY(-100%)' : ''};"
  >
    {text}
  </div>
{/if}
