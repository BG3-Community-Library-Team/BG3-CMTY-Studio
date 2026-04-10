<script lang="ts">
  import type { ContextMenuItemDef } from "../lib/types/contextMenu.js";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";

  let {
    item,
    focused = false,
    onactivate,
    onsubmenuopen,
    onsubmenuclose,
    onpointermove,
  }: {
    item: ContextMenuItemDef;
    focused?: boolean;
    onactivate: () => void;
    onsubmenuopen: () => void;
    onsubmenuclose: () => void;
    onpointermove: () => void;
  } = $props();

  let hasSubmenu = $derived(!!item.submenu?.length);
  let submenuVisible = $state(false);
  let hoverTimer: ReturnType<typeof setTimeout> | undefined;
  let itemEl: HTMLButtonElement | undefined = $state(undefined);
  let submenuEl: HTMLDivElement | undefined = $state(undefined);
  let submenuStyle = $state("visibility: hidden");

  // Submenu focus tracking
  let submenuFocusIdx = $state(-1);
  let submenuItems = $derived(
    item.submenu?.filter((si) => si.separator !== "before" && si.separator !== "after" || si.label) ?? [],
  );

  function showSubmenu() {
    if (!hasSubmenu || item.disabled) return;
    submenuVisible = true;
    submenuFocusIdx = -1;
    onsubmenuopen();
    requestAnimationFrame(() => positionSubmenu());
  }

  function hideSubmenu() {
    submenuVisible = false;
    submenuFocusIdx = -1;
    clearTimeout(hoverTimer);
    onsubmenuclose();
  }

  function positionSubmenu() {
    if (!itemEl || !submenuEl) return;
    const parentRect = itemEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const subRect = submenuEl.getBoundingClientRect();

    let left = parentRect.right + 2;
    let top = parentRect.top;

    // Flip left if not enough space on right
    if (left + subRect.width > vw - 8) {
      left = parentRect.left - subRect.width - 2;
    }
    // Clamp vertical
    if (top + subRect.height > vh - 8) {
      top = Math.max(4, vh - subRect.height - 8);
    }

    submenuStyle = `left: ${left}px; top: ${top}px`;
  }

  function handlePointerEnter() {
    if (item.disabled) return;
    onpointermove();
    if (hasSubmenu) {
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(showSubmenu, 200);
    }
  }

  function handlePointerLeave() {
    if (hasSubmenu) {
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(hideSubmenu, 150);
    }
  }

  function handleSubmenuPointerEnter() {
    clearTimeout(hoverTimer);
  }

  function handleSubmenuPointerLeave() {
    hoverTimer = setTimeout(hideSubmenu, 150);
  }

  function handleSubitemClick(subItem: ContextMenuItemDef) {
    if (subItem.disabled) return;
    subItem.action?.();
    onactivate();
  }

  export function openSubmenu() {
    showSubmenu();
  }

  export function closeSubmenu() {
    hideSubmenu();
  }

  export function isSubmenuVisible() {
    return submenuVisible;
  }
</script>

<button
  bind:this={itemEl}
  class="ctx-menu-item"
  class:focused
  class:disabled={item.disabled}
  role="menuitem"
  aria-disabled={item.disabled || undefined}
  aria-haspopup={hasSubmenu ? "menu" : undefined}
  aria-expanded={hasSubmenu ? submenuVisible : undefined}
  tabindex={focused ? 0 : -1}
  onclick={() => {
    if (item.disabled) return;
    if (hasSubmenu) {
      showSubmenu();
    } else {
      item.action?.();
      onactivate();
    }
  }}
  onpointerenter={handlePointerEnter}
  onpointerleave={handlePointerLeave}
>
  {#if item.icon}
    {@const IconComponent = item.icon}
    <span class="ctx-menu-icon">
      <IconComponent size={12} />
    </span>
  {/if}
  <span class="ctx-menu-label">{item.label}</span>
  {#if item.shortcut && !hasSubmenu}
    <span class="ctx-menu-shortcut">{item.shortcut}</span>
  {/if}
  {#if hasSubmenu}
    <span class="ctx-menu-chevron">
      <ChevronRight size={10} />
    </span>
  {/if}
</button>

{#if hasSubmenu && submenuVisible}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    bind:this={submenuEl}
    class="ctx-submenu fixed z-[153] min-w-[160px] max-w-[280px] py-1 rounded-md
           bg-[var(--th-bg-600,#27272a)] border border-[var(--th-border-700,#3f3f46)]"
    style="{submenuStyle}; box-shadow: 0 2px 8px rgba(0,0,0,0.25);"
    role="menu"
    tabindex="-1"
    onpointerenter={handleSubmenuPointerEnter}
    onpointerleave={handleSubmenuPointerLeave}
  >
    {#each item.submenu ?? [] as subItem, i}
      {#if subItem.separator === "before"}
        <div class="ctx-sep" role="separator"></div>
      {/if}
      <button
        class="ctx-menu-item"
        class:focused={submenuFocusIdx === i}
        class:disabled={subItem.disabled}
        role="menuitem"
        aria-disabled={subItem.disabled || undefined}
        tabindex={submenuFocusIdx === i ? 0 : -1}
        onclick={() => handleSubitemClick(subItem)}
      >
        {#if subItem.icon}
          {@const SubIcon = subItem.icon}
          <span class="ctx-menu-icon">
            <SubIcon size={12} />
          </span>
        {/if}
        <span class="ctx-menu-label">{subItem.label}</span>
        {#if subItem.shortcut}
          <span class="ctx-menu-shortcut">{subItem.shortcut}</span>
        {/if}
      </button>
      {#if subItem.separator === "after"}
        <div class="ctx-sep" role="separator"></div>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .ctx-menu-item {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 4px 10px;
    border: none;
    background: transparent;
    color: var(--th-text-200);
    font-size: 12px;
    cursor: pointer;
    text-align: left;
    transition: background-color 0.1s;
    white-space: nowrap;
  }
  .ctx-menu-item.focused,
  .ctx-menu-item:hover:not(.disabled) {
    background: var(--th-bg-500, #3f3f46);
  }
  .ctx-menu-item.disabled {
    color: var(--th-text-600, #52525b);
    cursor: default;
    pointer-events: none;
  }
  .ctx-menu-icon {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    width: 14px;
    color: var(--th-text-400);
  }
  .ctx-menu-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ctx-menu-shortcut {
    font-size: 10px;
    color: var(--th-text-500);
    margin-left: auto;
    padding-left: 16px;
    flex-shrink: 0;
  }
  .ctx-menu-chevron {
    display: flex;
    align-items: center;
    color: var(--th-text-500);
    margin-left: auto;
    padding-left: 8px;
    flex-shrink: 0;
  }
  .ctx-sep {
    height: 1px;
    background: var(--th-border-700);
    margin: 4px 0;
  }
</style>
