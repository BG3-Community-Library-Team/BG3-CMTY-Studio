<!--
  Reusable toggle switch for settings pages.
  Matches the pill toggle used in FormHeader (CF Blacklist, header booleans).
  compact=true: inline pill+label only, no row hover, no description.
-->
<script lang="ts">
  interface Props {
    checked: boolean;
    onchange: (checked: boolean) => void;
    label: string;
    description?: string;
    disabled?: boolean;
    compact?: boolean;
  }
  let { checked, onchange, label, description, disabled = false, compact = false }: Props = $props();
</script>

<button
  type="button"
  role="switch"
  aria-checked={checked}
  aria-label={label}
  {disabled}
  class="toggle-root"
  class:compact
  class:disabled
  onclick={() => { if (!disabled) onchange(!checked); }}
>
  <span class="track" class:on={checked}>
    <span class="knob" class:on={checked}></span>
  </span>
  <span class="label-wrap">
    <span class="label-text" class:on={checked}>{label}</span>
    {#if description && !compact}
      <span class="label-desc">{description}</span>
    {/if}
  </span>
</button>

<style>
  .toggle-root {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    cursor: pointer;
    border-radius: 0.25rem;
    padding: 0.375rem 0.5rem;
    margin-left: -0.5rem;
    margin-right: -0.5rem;
    background: transparent;
    border: none;
    text-align: left;
    transition: background-color 0.15s;
    width: calc(100% + 1rem);
  }
  .toggle-root:hover:not(.disabled) {
    background: color-mix(in srgb, var(--th-bg-700) 60%, transparent);
  }
  .toggle-root.compact {
    display: inline-flex;
    padding: 0.125rem 0.25rem;
    margin: 0;
    width: auto;
    flex-shrink: 0;
  }
  .toggle-root.compact:hover:not(.disabled) {
    background: color-mix(in srgb, var(--th-bg-700) 40%, transparent);
  }
  .toggle-root.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  /* Pill — matches FormHeader h-4 w-7 sizing */
  .track {
    position: relative;
    display: inline-flex;
    height: 1rem;
    width: 1.75rem;
    flex-shrink: 0;
    align-items: center;
    border-radius: 9999px;
    background: var(--th-bg-600, #52525b);
    transition: background-color 0.2s;
  }
  .track.on {
    background: var(--th-bg-sky-600, #0284c7);
  }
  /* Knob — matches FormHeader h-3 w-3 sizing */
  .knob {
    pointer-events: none;
    display: inline-block;
    height: 0.75rem;
    width: 0.75rem;
    border-radius: 9999px;
    background: white;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
    transition: transform 0.2s;
    transform: translateX(2px);
  }
  .knob.on {
    /* 1.75rem track - 0.75rem knob - 2×2px margin = 14px = translate-x-3.5 */
    transform: translateX(14px);
  }
  .label-wrap {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  /* Label color shifts when on — matches FormHeader text-sky-400 / text-[--th-text-500] */
  .label-text {
    font-size: 0.75rem;
    color: var(--th-text-500);
    line-height: 1.3;
    transition: color 0.15s;
  }
  .label-text.on {
    color: var(--th-text-sky-400, #38bdf8);
  }
  .label-desc {
    font-size: 0.7rem;
    color: var(--th-text-500);
    margin: 0;
    line-height: 1.3;
  }
</style>
