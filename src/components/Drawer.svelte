<script lang="ts">
  import type { Snippet } from "svelte";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";

  let {
    title,
    count,
    collapsed = $bindable(false),
    ontoggle,
    headerActions,
    children,
  }: {
    title: string;
    count?: number;
    collapsed?: boolean;
    ontoggle?: () => void;
    headerActions?: Snippet;
    children: Snippet;
  } = $props();

  let headerHovered = $state(false);

  function toggle(): void {
    if (ontoggle) {
      ontoggle();
    } else {
      collapsed = !collapsed;
    }
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  }
</script>

<div class="drawer" class:collapsed>
  <button
    class="drawer-header"
    onclick={toggle}
    onkeydown={handleKeydown}
    onmouseenter={() => (headerHovered = true)}
    onmouseleave={() => (headerHovered = false)}
    aria-expanded={!collapsed}
  >
    <span class="drawer-chevron" class:expanded={!collapsed}>
      <ChevronRight size={14} />
    </span>
    <span class="drawer-title">{title.toUpperCase()}</span>

    {#if count != null && count > 0}
      <span class="drawer-count">{count}</span>
    {/if}

    {#if headerActions && headerHovered}
      <span
        class="drawer-actions"
        role="presentation"
        onclick={(e: MouseEvent) => e.stopPropagation()}
        onkeydown={(e: KeyboardEvent) => e.stopPropagation()}
      >
        {@render headerActions()}
      </span>
    {/if}
  </button>

  {#if !collapsed}
    <div class="drawer-body">
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .drawer {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .drawer-header {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    gap: 4px;
    height: 24px;
    min-height: 24px;
    padding: 0 8px;
    background: var(--th-bg-700, #3f3f46);
    border: none;
    cursor: pointer;
    user-select: none;
    width: 100%;
    text-align: left;
    color: var(--th-text-300, #d4d4d8);
  }

  .drawer-header:hover {
    background: color-mix(in srgb, var(--th-bg-700, #3f3f46) 80%, white);
  }

  .drawer-header:focus-visible {
    outline: 2px solid var(--th-accent-sky, #38bdf8);
    outline-offset: -2px;
  }

  .drawer-chevron {
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 150ms ease-out;
    flex-shrink: 0;
    color: var(--th-text-500, #8b8b94);
  }

  .drawer-chevron.expanded {
    transform: rotate(90deg);
  }

  .drawer-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .drawer-count {
    margin-left: auto;
    min-width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 9px;
    background: var(--th-bg-sky-600, #0284c7);
    color: #fff;
    font-size: 0.65rem;
    font-weight: 600;
    flex-shrink: 0;
  }

  .drawer-actions {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .drawer-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
  }

  :global(:root.reduced-motion) .drawer-chevron {
    transition: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .drawer-chevron {
      transition: none;
    }
  }
</style>
