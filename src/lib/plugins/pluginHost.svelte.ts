/**
 * EXT-8: Plugin Host — central plugin lifecycle manager.
 *
 * Manages registration, activation, deactivation, and disposal
 * of all plugins in the application.
 */

import type { PluginId, PluginModule, PluginContext, Disposable } from "./pluginTypes.js";
import { commandRegistry } from "../utils/commandRegistry.svelte.js";
import { configurationRegistry } from "./configurationRegistry.svelte.js";
import { viewRegistry } from "./viewRegistry.svelte.js";
import { statusBarRegistry } from "./statusBarRegistry.svelte.js";
import { menuRegistry } from "./menuRegistry.svelte.js";

class PluginHost {
  private registered = new Map<PluginId, PluginModule>();
  private activated = new Map<PluginId, PluginContext>();
  private disposables = new Map<PluginId, Disposable[]>();
  private activationIndex = new Map<string, PluginId[]>(); // event → pluginIds

  /** Register a plugin module (does NOT activate it) */
  register(plugin: PluginModule): void {
    const id = plugin.manifest.id;
    if (this.registered.has(id)) return; // Idempotent
    this.registered.set(id, plugin);

    // Index activation events
    for (const event of plugin.manifest.activationEvents) {
      const existing = this.activationIndex.get(event) ?? [];
      existing.push(id);
      this.activationIndex.set(event, existing);
    }
  }

  /** Activate a plugin — processes contributions and calls activate() */
  async activate(pluginId: PluginId): Promise<void> {
    if (this.activated.has(pluginId)) return; // Already active
    const plugin = this.registered.get(pluginId);
    if (!plugin) return;

    const ctx: PluginContext = { pluginId, subscriptions: [] };
    const pluginDisposables: Disposable[] = [];

    // Process manifest contributions
    const { contributes } = plugin.manifest;

    // Commands: the plugin's activate() registers command implementations
    // directly via commandRegistry — the host doesn't register placeholders.

    // Configuration
    if (contributes.configuration) {
      pluginDisposables.push(
        configurationRegistry.registerConfiguration(pluginId, contributes.configuration)
      );
    }

    // View containers
    if (contributes.viewsContainers) {
      for (const container of contributes.viewsContainers) {
        pluginDisposables.push(
          viewRegistry.registerViewContainer(pluginId, container)
        );
      }
    }

    // Views
    if (contributes.views) {
      for (const [containerId, views] of Object.entries(contributes.views)) {
        for (const view of views) {
          pluginDisposables.push(
            viewRegistry.registerView(pluginId, containerId, view)
          );
        }
      }
    }

    // Status bar items
    if (contributes.statusBarItems) {
      for (const item of contributes.statusBarItems) {
        statusBarRegistry.registerItem(pluginId, item);
      }
    }

    // Menu entries
    if (contributes.menus) {
      pluginDisposables.push(
        menuRegistry.registerMenuEntries(pluginId, contributes.menus)
      );
    }

    // Store disposables before calling activate (in case activate throws)
    this.disposables.set(pluginId, pluginDisposables);
    this.activated.set(pluginId, ctx);

    // Call plugin's activate()
    try {
      await plugin.activate(ctx);
    } catch (e) {
      console.error(`[PluginHost] Failed to activate plugin "${pluginId}":`, e);
      // Don't deactivate on error — contributions are still valid
    }
  }

  /** Deactivate a plugin — calls deactivate(), removes contributions */
  async deactivate(pluginId: PluginId): Promise<void> {
    const plugin = this.registered.get(pluginId);
    const ctx = this.activated.get(pluginId);
    if (!ctx) return; // Not active

    // Call plugin's deactivate()
    try {
      await plugin?.deactivate?.();
    } catch (e) {
      console.error(`[PluginHost] Error deactivating plugin "${pluginId}":`, e);
    }

    // Dispose plugin's subscriptions
    for (const sub of ctx.subscriptions) {
      try { sub.dispose(); } catch { /* swallow */ }
    }

    // Dispose contribution registrations
    const disps = this.disposables.get(pluginId) ?? [];
    for (const d of disps) {
      try { d.dispose(); } catch { /* swallow */ }
    }

    // Clean up registries by pluginId
    viewRegistry.disposePlugin(pluginId);
    statusBarRegistry.disposePlugin(pluginId);
    menuRegistry.disposePlugin(pluginId);

    // Remove all commands registered by the plugin (convention: "shortName." prefix)
    const shortName = pluginId.split(".").pop();
    if (shortName) {
      commandRegistry.unregisterPrefix(`${shortName}:`);
      commandRegistry.unregisterPrefix(`${shortName}.`);
    }

    this.activated.delete(pluginId);
    this.disposables.delete(pluginId);
  }

  /** Deactivate all plugins (app shutdown) */
  async deactivateAll(): Promise<void> {
    const ids = [...this.activated.keys()];
    for (const id of ids) {
      await this.deactivate(id);
    }
  }

  /** Fire an activation event — activates all plugins listening for it */
  async fireActivationEvent(event: string): Promise<void> {
    // First activate "*" (always-active) plugins
    const starPlugins = this.activationIndex.get("*") ?? [];
    for (const id of starPlugins) {
      await this.activate(id);
    }

    // Then activate plugins listening for this specific event
    const eventPlugins = this.activationIndex.get(event) ?? [];
    for (const id of eventPlugins) {
      await this.activate(id);
    }
  }

  /** Check if a plugin is activated */
  isActivated(pluginId: PluginId): boolean {
    return this.activated.has(pluginId);
  }

  /** Get all registered plugin manifests */
  getRegisteredPlugins(): PluginModule["manifest"][] {
    return [...this.registered.values()].map(p => p.manifest);
  }
}

export const pluginHost = new PluginHost();
