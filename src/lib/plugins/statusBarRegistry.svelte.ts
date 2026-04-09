/**
 * EXT-5: Status Bar Registry — plugin status bar item contributions.
 *
 * Plugins register status bar items with alignment, priority, and when clauses.
 * Items are reactive — plugins update text/icon directly after registration.
 */

import type { StatusBarItemContribution } from "./pluginTypes.js";
import { contextKeys } from "./contextKeyService.svelte.js";

class RegisteredStatusBarItem {
  id: string;
  pluginId: string;
  alignment: "left" | "right";
  priority: number;
  when?: string;

  // Reactive render state — updated by the plugin at runtime
  text: string = $state("");
  tooltip: string = $state("");
  icon: string = $state("");
  command: string = $state(""); // command ID to execute on click

  constructor(pluginId: string, item: StatusBarItemContribution) {
    this.id = item.id;
    this.pluginId = pluginId;
    this.alignment = item.alignment;
    this.priority = item.priority ?? 0;
    this.when = item.when;
  }

  /** Computed visibility from when clause */
  get visible(): boolean {
    return contextKeys.evaluate(this.when);
  }
}

class StatusBarRegistry {
  items: RegisteredStatusBarItem[] = $state([]);

  /** Register a status bar item from manifest. Returns the reactive item for the plugin to update. */
  registerItem(
    pluginId: string,
    item: StatusBarItemContribution,
  ): RegisteredStatusBarItem {
    const registered = new RegisteredStatusBarItem(pluginId, item);
    this.items = [...this.items, registered];
    return registered;
  }

  /** Get visible items for a given alignment, sorted by priority (lower = further left) */
  getVisibleItems(alignment: "left" | "right"): RegisteredStatusBarItem[] {
    return this.items
      .filter((i) => i.alignment === alignment && i.visible)
      .sort((a, b) => a.priority - b.priority);
  }

  /** Dispose all items for a plugin */
  disposePlugin(pluginId: string): void {
    this.items = this.items.filter((i) => i.pluginId !== pluginId);
  }
}

export { RegisteredStatusBarItem };
export const statusBarRegistry = new StatusBarRegistry();
