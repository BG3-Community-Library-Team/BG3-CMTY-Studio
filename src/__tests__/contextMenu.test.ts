/**
 * Tests for ContextMenuItemDef construction, disabled state logic,
 * and drag-reorder utility functions from dragReorder.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ContextMenuItemDef } from "../lib/types/contextMenu.js";
import {
  createDragReorderState,
  handleDragStart,
  handleDragEnd,
  getPinContextMenuItems,
} from "../components/explorer/dragReorder.js";

const { uiStore } = await import("../lib/stores/uiStore.svelte.js");

describe("ContextMenuItemDef construction", () => {
  it("creates a basic item with label and action", () => {
    const action = vi.fn();
    const item: ContextMenuItemDef = {
      label: "Copy",
      action,
    };
    expect(item.label).toBe("Copy");
    expect(item.disabled).toBeUndefined();
    item.action!();
    expect(action).toHaveBeenCalledOnce();
  });

  it("creates a disabled item", () => {
    const item: ContextMenuItemDef = {
      label: "Paste",
      disabled: true,
      action: vi.fn(),
    };
    expect(item.disabled).toBe(true);
  });

  it("creates an item with separator", () => {
    const item: ContextMenuItemDef = {
      label: "Delete",
      separator: "before",
    };
    expect(item.separator).toBe("before");
  });

  it("creates an item with submenu", () => {
    const item: ContextMenuItemDef = {
      label: "Export",
      submenu: [
        { label: "As JSON" },
        { label: "As YAML" },
      ],
    };
    expect(item.submenu).toHaveLength(2);
    expect(item.submenu![0].label).toBe("As JSON");
  });

  it("creates an item with shortcut", () => {
    const item: ContextMenuItemDef = {
      label: "Save",
      shortcut: "Ctrl+S",
    };
    expect(item.shortcut).toBe("Ctrl+S");
  });

  it("submenu items can have their own disabled state", () => {
    const item: ContextMenuItemDef = {
      label: "File",
      submenu: [
        { label: "New", disabled: false },
        { label: "Open Recent", disabled: true },
      ],
    };
    expect(item.submenu![0].disabled).toBe(false);
    expect(item.submenu![1].disabled).toBe(true);
  });
});

describe("DragReorderState", () => {
  it("createDragReorderState returns clean initial state", () => {
    const state = createDragReorderState();
    expect(state.draggedId).toBeNull();
    expect(state.draggedFromSection).toBeNull();
    expect(state.dropTargetId).toBeNull();
    expect(state.dropPosition).toBeNull();
  });

  it("handleDragStart sets dragged id and section", () => {
    const state = createDragReorderState();
    const mockEvent = {
      dataTransfer: {
        effectAllowed: "",
        setData: vi.fn(),
      },
    } as unknown as DragEvent;

    handleDragStart(mockEvent, "node-1", "section-a", state);
    expect(state.draggedId).toBe("node-1");
    expect(state.draggedFromSection).toBe("section-a");
  });

  it("handleDragEnd clears all state", () => {
    const state = createDragReorderState();
    state.draggedId = "node-1";
    state.draggedFromSection = "section-a";
    state.dropTargetId = "node-2";
    state.dropPosition = "before";

    handleDragEnd(state);
    expect(state.draggedId).toBeNull();
    expect(state.draggedFromSection).toBeNull();
    expect(state.dropTargetId).toBeNull();
    expect(state.dropPosition).toBeNull();
  });
});

describe("getPinContextMenuItems", () => {
  beforeEach(() => {
    uiStore.reset();
    localStorage.clear();
  });

  it("returns 'Pin to top' label when node is not pinned", () => {
    const items = getPinContextMenuItems("drawer1", "node-1", false);
    expect(items).toHaveLength(1);
    expect(items[0].label.toLowerCase()).toContain("pin");
  });

  it("returns 'Unpin' label when node is pinned", () => {
    const items = getPinContextMenuItems("drawer1", "node-1", true);
    expect(items).toHaveLength(1);
    expect(items[0].label.toLowerCase()).toContain("unpin");
  });

  it("pin action calls uiStore.pinNode", () => {
    const items = getPinContextMenuItems("drawer1", "node-1", false);
    items[0].action!();
    expect(uiStore.isNodePinned("drawer1", "node-1")).toBe(true);
  });

  it("unpin action calls uiStore.unpinNode", () => {
    uiStore.pinNode("drawer1", "node-1");
    const items = getPinContextMenuItems("drawer1", "node-1", true);
    items[0].action!();
    expect(uiStore.isNodePinned("drawer1", "node-1")).toBe(false);
  });
});
