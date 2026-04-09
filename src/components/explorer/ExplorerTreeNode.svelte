<script lang="ts">
  import type { Snippet } from "svelte";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";

  let {
    label,
    depth = 0,
    expanded = false,
    active = false,
    hasChildren = false,
    icon,
    badge = "",
    badgeColor = "",
    onclick,
    ontoggle,
    oncontextmenu,
    ondblclick,
    onmouseenter,
    onmouseleave,
    children,
    hoverActions,
  }: {
    label: string;
    depth?: number;
    expanded?: boolean;
    active?: boolean;
    hasChildren?: boolean;
    icon?: Snippet;
    badge?: string;
    badgeColor?: string;
    onclick?: (e: MouseEvent) => void;
    ontoggle?: (e: MouseEvent) => void;
    oncontextmenu?: (e: MouseEvent) => void;
    ondblclick?: (e: MouseEvent) => void;
    onmouseenter?: (e: MouseEvent) => void;
    onmouseleave?: (e: MouseEvent) => void;
    children?: Snippet;
    hoverActions?: Snippet;
  } = $props();

  let paddingLeft = $derived(depth * 16 + 8);

  function handleChevronClick(e: MouseEvent) {
    e.stopPropagation();
    ontoggle?.(e);
  }

  function handleChevronKey(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      ontoggle?.(e as unknown as MouseEvent);
    }
  }
</script>

<div
  class="tree-node"
  class:active-node={active}
  style:padding-left="{paddingLeft}px"
  role="treeitem"
  tabindex="0"
  aria-expanded={hasChildren ? expanded : undefined}
  aria-selected={active}
>
  {#if hasChildren}
    <span
      class="chevron-hit"
      onclick={handleChevronClick}
      onkeydown={handleChevronKey}
      role="button"
      tabindex="0"
      aria-label="Toggle {label}"
    >
      <ChevronRight size={14} class="chevron {expanded ? 'expanded' : ''}" />
    </span>
  {:else}
    <span class="w-3.5 shrink-0"></span>
  {/if}

  <button
    class="tree-node-label"
    {onclick}
    {ondblclick}
    {oncontextmenu}
    {onmouseenter}
    {onmouseleave}
  >
    {#if icon}
      {@render icon()}
    {/if}
    <span class="node-label truncate">{label}</span>
    {#if hoverActions}
      {@render hoverActions()}
    {:else if badge}
      <span class="node-badge" style:background={badgeColor || undefined}>{badge}</span>
    {/if}
  </button>
</div>

{#if hasChildren && expanded && children}
  <div class="tree-children" style:padding-left="{depth > 0 ? 12 : 0}px">
    {@render children()}
  </div>
{/if}

<style>
  .tree-node {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    min-height: 24px;
    padding-right: 8px;
    border: none;
    background: transparent;
    color: var(--th-sidebar-text-muted, var(--th-text-300));
    font-size: 12px;
    cursor: pointer;
    border-radius: 3px;
    text-align: left;
    user-select: none;
    position: relative;
  }

  .tree-node:hover {
    background: var(--th-bg-700);
  }

  .tree-node.active-node {
    background: color-mix(in srgb, var(--th-accent-500, #0ea5e9) 12%, transparent);
    color: var(--th-text-100);
  }

  .tree-node.active-node::before {
    content: "";
    position: absolute;
    left: 0;
    top: 2px;
    bottom: 2px;
    width: 2px;
    border-radius: 1px;
    background: var(--th-accent-500, #0ea5e9);
  }

  .chevron-hit {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    cursor: pointer;
    border-radius: 3px;
    border: none;
    background: transparent;
  }

  .chevron-hit:hover {
    background: var(--th-bg-600);
  }

  :global(.chevron) {
    transition: transform 0.15s;
    flex-shrink: 0;
  }

  :global(.chevron.expanded) {
    transform: rotate(90deg);
  }

  .tree-node-label {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    color: inherit;
    font-size: inherit;
    cursor: pointer;
    text-align: left;
    padding: 0;
  }

  .node-label {
    flex: 1;
    min-width: 0;
  }

  .node-badge {
    font-size: 10px;
    padding: 0 5px;
    border-radius: 8px;
    background: var(--th-bg-600);
    color: var(--th-text-300);
    font-weight: 500;
    line-height: 16px;
    flex-shrink: 0;
  }

  .tree-children {
    padding-left: 12px;
  }

  :global(:root.reduced-motion) .chevron-hit :global(.chevron),
  :global(:root.reduced-motion) :global(.chevron) {
    transition: none;
  }
</style>
