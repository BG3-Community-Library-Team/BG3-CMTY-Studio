<script lang="ts">
  import { m } from "../paraglide/messages.js";
  import { uiStore, type ActivityView } from "../lib/stores/uiStore.svelte.js";
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import Search from "@lucide/svelte/icons/search";
  import Settings from "@lucide/svelte/icons/settings";
  import Database from "@lucide/svelte/icons/database";
  import HelpCircle from "@lucide/svelte/icons/help-circle";

  const VIEW_REGISTRY: Record<string, { label: () => string; icon: typeof FolderOpen }> = {
    explorer: { label: () => m.activity_bar_explorer(), icon: FolderOpen },
    search: { label: () => m.activity_bar_search(), icon: Search },
    "loaded-data": { label: () => m.activity_bar_loaded_data(), icon: Database },
    settings: { label: () => m.activity_bar_settings(), icon: Settings },
    help: { label: () => m.activity_bar_help(), icon: HelpCircle },
  };

  let views = $derived(
    uiStore.activityBarOrder
      .filter(id => id !== "search" || modStore.scanResult)
      .filter(id => id in VIEW_REGISTRY)
      .map(id => ({ id, label: VIEW_REGISTRY[id].label(), icon: VIEW_REGISTRY[id].icon }))
  );

  // ── Drag-and-drop state ──
  const DEAD_ZONE = 4;
  const SLOT_HEIGHT = 42; // 40px button + 2px gap

  let dragIndex: number | null = $state(null);
  let dragOffsetY = $state(0);
  let pointerStartY = $state(0);
  let isDragging = $state(false);
  let dropIndex: number | null = $state(null);
  let suppressTransition = $state(false);

  function onPointerDown(e: PointerEvent, index: number) {
    if (e.button !== 0) return;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    pointerStartY = e.clientY;
    dragIndex = index;
    isDragging = false;
    dragOffsetY = 0;
  }

  function onPointerMove(e: PointerEvent) {
    if (dragIndex === null) return;
    const dy = e.clientY - pointerStartY;
    if (!isDragging && Math.abs(dy) < DEAD_ZONE) return;
    isDragging = true;
    dragOffsetY = dy;

    // Compute drop position
    const rawTarget = dragIndex + Math.round(dy / SLOT_HEIGHT);
    dropIndex = Math.max(0, Math.min(views.length - 1, rawTarget));
  }

  function onPointerUp() {
    if (isDragging && dragIndex !== null && dropIndex !== null && dragIndex !== dropIndex) {
      const order = [...uiStore.activityBarOrder];
      const visibleIds = views.map(v => v.id);
      const fromId = visibleIds[dragIndex];
      const toId = visibleIds[dropIndex];
      const fromFull = order.indexOf(fromId);
      const toFull = order.indexOf(toId);
      if (fromFull >= 0 && toFull >= 0) {
        suppressTransition = true;
        order.splice(fromFull, 1);
        order.splice(toFull, 0, fromId);
        uiStore.setActivityBarOrder(order);
        requestAnimationFrame(() => { suppressTransition = false; });
      }
    }
    dragIndex = null;
    isDragging = false;
    dragOffsetY = 0;
    dropIndex = null;
  }

  function onKeyDown(e: KeyboardEvent, index: number) {
    if (!e.altKey) return;
    const dir = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
    if (dir === 0) return;
    e.preventDefault();
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= views.length) return;
    const order = [...uiStore.activityBarOrder];
    const visibleIds = views.map(v => v.id);
    const fromFull = order.indexOf(visibleIds[index]);
    const toFull = order.indexOf(visibleIds[newIndex]);
    if (fromFull >= 0 && toFull >= 0) {
      order.splice(fromFull, 1);
      order.splice(toFull, 0, visibleIds[index]);
      uiStore.setActivityBarOrder(order);
    }
  }
</script>

<nav class="activity-bar" class:no-transition={suppressTransition} aria-label={m.activity_bar_aria()}>
  {#each views as view, i (view.id)}
    {@const Icon = view.icon}
    {@const isActive = uiStore.activeView === view.id && uiStore.sidebarVisible}
    {@const isBeingDragged = isDragging && dragIndex === i}
    {@const shift = isDragging && dragIndex !== null && dropIndex !== null && i !== dragIndex
      ? (i >= Math.min(dragIndex, dropIndex) && i <= Math.max(dragIndex, dropIndex)
        ? (dropIndex > dragIndex ? -SLOT_HEIGHT : SLOT_HEIGHT)
        : 0)
      : 0}
    <button
      class="activity-icon"
      class:active={isActive}
      class:dragging={isBeingDragged}
      title={view.label}
      aria-label={view.label}
      aria-pressed={isActive}
      aria-roledescription="reorderable"
      style={isBeingDragged ? `transform: translateY(${dragOffsetY}px); z-index: 50; opacity: 0.7;` : shift ? `transform: translateY(${shift}px);` : ''}
      onclick={() => { if (!isDragging) uiStore.toggleSidebar(view.id); }}
      onpointerdown={(e) => onPointerDown(e, i)}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onpointercancel={onPointerUp}
      onkeydown={(e) => onKeyDown(e, i)}
    >
      <Icon size={22} strokeWidth={isActive ? 2 : 1.5} />
    </button>
  {/each}
</nav>

<style>
  .activity-bar {
    display: flex;
    flex-direction: column;
    width: 48px;
    min-width: 48px;
    background: var(--th-sidebar-bg-deep, var(--th-bg-950));
    border-right: 1px solid var(--th-sidebar-border, var(--th-bg-700));
    padding-top: 4px;
    gap: 2px;
    align-items: center;
    z-index: 10;
  }

  .activity-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 6px;
    color: var(--th-sidebar-text-muted, var(--th-text-500));
    background: transparent;
    border: none;
    cursor: pointer;
    transition: color 0.15s, background 0.15s, transform 0.15s;
    position: relative;
    touch-action: none;
  }

  .activity-icon.dragging {
    pointer-events: none;
    transition: none;
  }

  .no-transition .activity-icon {
    transition: none !important;
  }

  .activity-icon:hover {
    color: var(--th-sidebar-text, var(--th-text-200));
    background: var(--th-sidebar-highlight, var(--th-bg-800));
  }

  .activity-icon.active {
    color: var(--th-sidebar-text, var(--th-text-100));
    background: var(--th-sidebar-highlight, var(--th-bg-800));
  }

  .activity-icon.active::before {
    content: "";
    position: absolute;
    left: -4px;
    top: 8px;
    bottom: 8px;
    width: 2px;
    background: var(--th-accent-500, #38bdf8);
    border-radius: 1px;
  }
</style>
