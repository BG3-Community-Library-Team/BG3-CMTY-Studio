/**
 * Nexus Mods Plugin — integration for publishing and mod management.
 *
 * Follows the same plugin pattern as gitPlugin.svelte.ts.
 */

import type { PluginModule, PluginContext } from "../pluginTypes.js";
import { commandRegistry, type Command } from "../../utils/commandRegistry.svelte.js";
import { contextKeys } from "../contextKeyService.svelte.js";
import { viewRegistry } from "../viewRegistry.svelte.js";
import { statusBarRegistry } from "../statusBarRegistry.svelte.js";
import { nexusStore } from "../../stores/nexusStore.svelte.js";
import NexusPanel from "../../../components/platform/nexus/NexusPanel.svelte";
import NexusSettingsSubpanel from "../../../components/platform/nexus/NexusSettingsSubpanel.svelte";

export const nexusPlugin: PluginModule = {
  manifest: {
    id: "cmty.nexus",
    name: "Nexus Mods",
    description: "Nexus Mods integration for publishing and mod management",
    version: "1.0.0",
    activationEvents: ["onStartupFinished"],
    contributes: {
      commands: [
        { command: "nexus:setApiKey", title: "Set API Key", category: "Nexus", enablement: "" },
        { command: "nexus:clearApiKey", title: "Clear API Key", category: "Nexus", enablement: "nexusConnected" },
        { command: "nexus:resolveMod", title: "Resolve Mod", category: "Nexus", enablement: "nexusConnected" },
        { command: "nexus:upload", title: "Upload to Nexus", category: "Nexus", enablement: "nexusConnected && modLoaded" },
      ],
      configuration: {
        title: "Nexus Mods",
        properties: {},
      },
      viewsContainers: [
        { id: "cmty-publishing", title: "Publishing", icon: "globe", location: "sidebar" },
      ],
      views: {
        "cmty-publishing": [
          { id: "nexus.panel", name: "Nexus Mods", when: "modLoaded" },
          { id: "nexus.settings", name: "Nexus Settings" },
        ],
      },
      statusBarItems: [
        { id: "nexus.status", alignment: "left", priority: 50, when: "nexusConnected" },
      ],
      menus: {
        commandPalette: [
          { command: "nexus:setApiKey" },
          { command: "nexus:clearApiKey", when: "nexusConnected" },
          { command: "nexus:resolveMod", when: "nexusConnected" },
          { command: "nexus:upload", when: "nexusConnected && modLoaded" },
        ],
      },
    },
  },

  activate(ctx: PluginContext) {
    // 1. Register command implementations
    const commands: Command[] = [
      {
        id: "nexus:setApiKey",
        label: "Set API Key",
        category: "action",
        icon: "🔑",
        enabled: () => true,
        execute: async () => {
          const key = window.prompt("Enter your Nexus Mods API key:");
          if (!key?.trim()) return;
          await nexusStore.setApiKey(key.trim());
        },
      },
      {
        id: "nexus:clearApiKey",
        label: "Clear API Key",
        category: "action",
        icon: "✕",
        when: "nexusConnected",
        enabled: () => nexusStore.apiKeyValid,
        execute: async () => {
          await nexusStore.clearApiKey();
        },
      },
      {
        id: "nexus:resolveMod",
        label: "Resolve Mod",
        category: "action",
        icon: "🔍",
        when: "nexusConnected",
        enabled: () => nexusStore.apiKeyValid,
        execute: async () => {
          const urlOrId = window.prompt("Enter Nexus Mods URL or mod ID:");
          if (!urlOrId?.trim()) return;
          await nexusStore.resolveMod(urlOrId.trim());
        },
      },
      {
        id: "nexus:upload",
        label: "Upload to Nexus",
        category: "action",
        icon: "↑",
        when: "nexusConnected && modLoaded",
        enabled: () => nexusStore.apiKeyValid,
        execute: async () => {
          // Placeholder — real implementation in later sprint
        },
      },
    ];
    commandRegistry.registerMany(commands);

    // 2. Set view components for sidebar
    viewRegistry.setViewComponent("nexus.panel", NexusPanel);
    viewRegistry.setViewComponent("nexus.settings", NexusSettingsSubpanel);

    // 3. Find the status bar item registered by the host and configure it
    const statusItem = statusBarRegistry.items.find(i => i.id === "nexus.status");
    if (statusItem) {
      statusItem.text = "";
      statusItem.icon = "globe";
      statusItem.tooltip = "Nexus Mods";
    }

    // 4. Set up context key syncing and status bar text via $effect.root
    const cleanupEffects = $effect.root(() => {
      $effect(() => {
        contextKeys.set("nexusConnected", nexusStore.apiKeyValid);
      });
      $effect(() => {
        if (statusItem) {
          statusItem.text = nexusStore.modName ?? "";
          statusItem.tooltip = nexusStore.apiKeyValid ? "Nexus: Connected" : "Nexus: Not connected";
        }
      });
    });

    // Store cleanup in subscriptions
    ctx.subscriptions.push({ dispose: cleanupEffects });
  },

  deactivate() {
    contextKeys.delete("nexusConnected");
  },
};
