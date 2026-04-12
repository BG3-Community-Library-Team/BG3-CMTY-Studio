<!--
  Settings panel — collapsible section using <details>/<summary>,
  styled like FormSectionCard.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";

  interface Props {
    title: string;
    children: Snippet;
    columns?: 1 | 2 | 3;
    open?: boolean;
  }
  let { title, children, columns = 1, open = $bindable(true) }: Props = $props();
</script>

<details class="settings-panel" bind:open>
  <summary class="panel-header">
    <ChevronRight size={12} class="panel-chevron shrink-0" />
    <span class="panel-title">{title}</span>
  </summary>
  <div class="panel-body" class:two-col={columns === 2} class:three-col={columns === 3}>
    {@render children()}
  </div>
</details>

<style>
  .settings-panel {
    border: 1px solid var(--th-card-border, var(--th-border-700));
    border-radius: 0.5rem;
    background: var(--th-card-bg, var(--th-bg-850));
    overflow: hidden;
    margin-bottom: 0;
  }
  .panel-header {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.625rem;
    background: var(--th-card-header-bg, var(--th-bg-800));
    cursor: pointer;
    user-select: none;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--th-text-400);
    transition: color 0.15s;
  }
  .panel-header:hover {
    color: var(--th-text-200);
  }
  .panel-title {
    line-height: 1;
  }
  .settings-panel :global(.panel-chevron) {
    transform: rotate(0deg);
    transition: transform 150ms ease-out;
    flex-shrink: 0;
  }
  details[open] > .panel-header :global(.panel-chevron) {
    transform: rotate(90deg);
  }
  .panel-body {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.75rem;
  }
  .panel-body.two-col {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.25rem 1rem;
  }
  .panel-body.three-col {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.25rem 0.5rem;
  }
</style>
