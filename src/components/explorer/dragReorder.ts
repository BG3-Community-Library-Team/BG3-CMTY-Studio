/**
 * Shared drag-to-reorder utilities for explorer tree nodes.
 * Provides drag state management, insertion indicator logic, and pin-to-top context menu helpers.
 */
import type { Component } from "svelte";
import Pin from "@lucide/svelte/icons/pin";
import PinOff from "@lucide/svelte/icons/pin-off";
import { m } from "../../paraglide/messages.js";
import { uiStore } from "../../lib/stores/uiStore.svelte.js";
import type { ContextMenuItemDef } from "../../lib/types/contextMenu.js";

// ── Drag-reorder state ──

export interface DragReorderState {
  draggedId: string | null;
  draggedFromSection: string | null;
  dropTargetId: string | null;
  dropPosition: "before" | "after" | "inside" | null;
}

export function createDragReorderState(): DragReorderState {
  return {
    draggedId: null,
    draggedFromSection: null,
    dropTargetId: null,
    dropPosition: null,
  };
}

// ── Drag event handlers ──

export function handleDragStart(
  e: DragEvent,
  nodeId: string,
  sectionId: string,
  state: DragReorderState,
): void {
  state.draggedId = nodeId;
  state.draggedFromSection = sectionId;

  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", nodeId);
  }
}

export function handleDragOver(
  e: DragEvent,
  targetNodeId: string,
  targetSectionId: string,
  state: DragReorderState,
  allowCrossSection = false,
): void {
  // Reject cross-section drops unless explicitly allowed
  if (!allowCrossSection && state.draggedFromSection !== targetSectionId) {
    if (e.dataTransfer) e.dataTransfer.dropEffect = "none";
    return;
  }

  // Don't drop on self
  if (state.draggedId === targetNodeId) {
    state.dropTargetId = null;
    state.dropPosition = null;
    return;
  }

  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";

  // Calculate whether cursor is on upper or lower half
  const target = e.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const midpoint = rect.top + rect.height / 2;
  const position: "before" | "after" = e.clientY < midpoint ? "before" : "after";

  state.dropTargetId = targetNodeId;
  state.dropPosition = position;
}

export function handleDrop(
  e: DragEvent,
  targetNodeId: string,
  targetSectionId: string,
  state: DragReorderState,
  onReorder: (draggedId: string, targetId: string, position: "before" | "after") => void,
  onMove?: (draggedId: string, targetId: string) => void,
): void {
  e.preventDefault();

  const { draggedId, draggedFromSection, dropPosition } = state;
  if (!draggedId || !dropPosition) {
    handleDragEnd(state);
    return;
  }

  // Cross-section move
  if (draggedFromSection !== targetSectionId && onMove) {
    onMove(draggedId, targetNodeId);
  } else if (draggedFromSection === targetSectionId && (dropPosition === "before" || dropPosition === "after")) {
    onReorder(draggedId, targetNodeId, dropPosition);
  }

  handleDragEnd(state);
}

export function handleDragEnd(state: DragReorderState): void {
  state.draggedId = null;
  state.draggedFromSection = null;
  state.dropTargetId = null;
  state.dropPosition = null;
}

// ── Pin-to-top context menu items ──

export function getPinContextMenuItems(
  drawerId: string,
  nodeId: string,
  isPinned: boolean,
): ContextMenuItemDef[] {
  return [
    {
      label: isPinned ? m.explorer_context_menu_unpin() : m.explorer_context_menu_pin_to_top(),
      icon: (isPinned ? PinOff : Pin) as Component,
      action: () => {
        if (isPinned) {
          uiStore.unpinNode(drawerId, nodeId);
        } else {
          uiStore.pinNode(drawerId, nodeId);
        }
      },
    },
  ];
}
