import type { Component } from "svelte";

export interface ContextMenuItemDef {
  label: string;
  icon?: Component;
  shortcut?: string;
  action?: () => void;
  submenu?: ContextMenuItemDef[];
  disabled?: boolean;
  separator?: "before" | "after";
}
