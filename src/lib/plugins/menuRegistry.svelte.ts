/**
 * EXT-6: Menu Registry — command visibility in palette and context menus.
 *
 * Plugins control where their commands appear and under what conditions.
 * The registry stores when clause overrides per menu location.
 */

import type { MenuContributions, Disposable } from "./pluginTypes.js";
import { contextKeys } from "./contextKeyService.svelte.js";

interface RegisteredMenuEntry {
  command: string;
  pluginId: string;
  menuId: string;
  when?: string;
  group?: string;
  order?: number;
}

class MenuRegistry {
  private entries: RegisteredMenuEntry[] = $state([]);

  /** Register menu entries from a plugin manifest */
  registerMenuEntries(pluginId: string, menus: MenuContributions): Disposable {
    const newEntries: RegisteredMenuEntry[] = [];

    for (const [menuId, items] of Object.entries(menus)) {
      if (!items) continue;
      for (const item of items) {
        newEntries.push({
          command: item.command,
          pluginId,
          menuId,
          when: item.when,
          group: item.group,
          order: item.order,
        });
      }
    }

    this.entries = [...this.entries, ...newEntries];

    return {
      dispose: () => {
        const toRemove = new Set(newEntries);
        this.entries = this.entries.filter((e) => !toRemove.has(e));
      },
    };
  }

  /** Get visible entries for a specific menu, evaluating when clauses */
  getVisibleEntries(menuId: string): RegisteredMenuEntry[] {
    return this.entries.filter(
      (e) => e.menuId === menuId && contextKeys.evaluate(e.when),
    );
  }

  /** Check if a command should be visible in the command palette.
   *  Commands WITHOUT an explicit palette entry are visible by default (VS Code behavior).
   *  Commands WITH an entry are filtered by their when clause. */
  isCommandVisibleInPalette(commandId: string): boolean {
    const paletteEntry = this.entries.find(
      (e) => e.menuId === "commandPalette" && e.command === commandId,
    );
    // No explicit palette entry → visible by default
    if (!paletteEntry) return true;
    // Has entry → evaluate when clause
    return contextKeys.evaluate(paletteEntry.when);
  }

  /** Dispose all entries for a plugin */
  disposePlugin(pluginId: string): void {
    this.entries = this.entries.filter((e) => e.pluginId !== pluginId);
  }
}

export { type RegisteredMenuEntry };
export const menuRegistry = new MenuRegistry();
