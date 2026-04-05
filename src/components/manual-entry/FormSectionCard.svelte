<script lang="ts">
  import type { Snippet } from "svelte";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";

  let {
    title,
    open = $bindable(true),
    accentColor = undefined,
    icon = undefined,
    headerActions = undefined,
    children,
  }: {
    title: string;
    open?: boolean;
    accentColor?: string;
    icon?: Snippet;
    headerActions?: Snippet;
    children: Snippet;
  } = $props();
</script>

<details class="form-section-card" bind:open style={accentColor ? `border-top: 3px solid ${accentColor}` : ''}>
  <summary class="card-header">
    <span class="card-header-left">
      <ChevronRight size={12} class="card-chevron shrink-0 transition-transform" />
      {#if icon}
        {@render icon()}
      {/if}
      <span class="card-title">{title}</span>
    </span>
    {#if headerActions}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <span class="card-header-actions" onclick={(e) => e.stopPropagation()}>
        {@render headerActions()}
      </span>
    {/if}
  </summary>
  <div class="card-body">
    {@render children()}
  </div>
</details>

<style>
  .form-section-card {
    border: 1px solid var(--th-card-border);
    border-radius: 0.5rem;
    background: var(--th-card-bg);
    box-shadow: var(--th-card-shadow);
    margin-top: 0.25rem;
    overflow: hidden;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.625rem;
    background: var(--th-card-header-bg);
    cursor: pointer;
    user-select: none;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--th-text-400, #a1a1aa);
  }

  .card-header:hover {
    color: var(--th-text-200, #e4e4e7);
  }

  .card-header-left {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .card-title {
    line-height: 1;
  }

  .card-header-actions {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    margin-left: auto;
  }

  .card-header :global(.card-chevron) {
    transform: rotate(0deg);
  }

  details[open] > .card-header :global(.card-chevron) {
    transform: rotate(90deg);
  }

  .card-body {
    padding: 0.5rem 0.625rem 0.625rem;
  }
</style>
