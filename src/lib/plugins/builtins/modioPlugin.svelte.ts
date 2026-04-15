/**
 * mod.io Plugin — integration for publishing and mod management.
 *
 * Registers mod.io commands, sidebar views, and status bar items
 * following the same plugin pattern as gitPlugin.svelte.ts.
 */

import type { PluginModule, PluginContext } from "../pluginTypes.js";
import { commandRegistry, type Command } from "../../utils/commandRegistry.svelte.js";
import { contextKeys } from "../contextKeyService.svelte.js";
import { viewRegistry } from "../viewRegistry.svelte.js";
import { statusBarRegistry } from "../statusBarRegistry.svelte.js";
import { modioStore } from "../../stores/modioStore.svelte.js";
import { modStore } from "../../stores/modStore.svelte.js";
import ModioPanel from "../../../components/platform/modio/ModioPanel.svelte";
import ModioSettingsSubpanel from "../../../components/platform/modio/ModioSettingsSubpanel.svelte";
import modioIcon from "../../../components/icons/modioIcon.svelte";

export const modioPlugin: PluginModule = {
  manifest: {
    id: "cmty.modio",
    name: "mod.io",
    description: "mod.io integration for publishing and mod management",
    version: "1.0.0",
    activationEvents: ["onStartupFinished"],
    contributes: {
      commands: [
        { command: "modio:connect", title: "Connect", category: "mod.io", enablement: "!modioConnected" },
        { command: "modio:disconnect", title: "Disconnect", category: "mod.io", enablement: "modioConnected" },
        { command: "modio:upload", title: "Upload to mod.io", category: "mod.io", enablement: "modioConnected && modLoaded" },
        { command: "modio:createMod", title: "Create Mod", category: "mod.io", enablement: "modioConnected" },
        { command: "modio:editMod", title: "Edit Mod", category: "mod.io", enablement: "modioConnected" },
      ],
      configuration: {
        title: "mod.io",
        properties: {},
      },
      viewsContainers: [
        { id: "cmty-modio", title: "mod.io", icon: "modio", iconComponent: modioIcon, location: "sidebar" },
      ],
      views: {
        "cmty-modio": [
          { id: "modio.panel", name: "mod.io", when: "modLoaded" },
          { id: "modio.settings", name: "mod.io Settings", when: "modLoaded" },
        ],
      },
      statusBarItems: [
        { id: "modio.status", alignment: "left", priority: 49, when: "modioConnected" },
      ],
      menus: {
        commandPalette: [
          { command: "modio:connect", when: "!modioConnected" },
          { command: "modio:disconnect", when: "modioConnected" },
          { command: "modio:upload", when: "modioConnected && modLoaded" },
          { command: "modio:createMod", when: "modioConnected" },
          { command: "modio:editMod", when: "modioConnected" },
        ],
      },
    },
  },

  activate(ctx: PluginContext) {
    // 1. Register command implementations
    const commands: Command[] = [
      {
        id: "modio:connect",
        label: "Connect to mod.io",
        category: "action",
        icon: "🔗",
        when: "!modioConnected",
        enabled: () => !modioStore.isAuthenticated,
        execute: async () => {
          // Placeholder — will open settings panel
        },
      },
      {
        id: "modio:disconnect",
        label: "Disconnect from mod.io",
        category: "action",
        icon: "⏏",
        when: "modioConnected",
        enabled: () => modioStore.isAuthenticated,
        execute: async () => {
          await modioStore.disconnect();
        },
      },
      {
        id: "modio:upload",
        label: "Upload to mod.io",
        category: "action",
        icon: "↑",
        when: "modioConnected && modLoaded",
        enabled: () => modioStore.isAuthenticated,
        execute: async () => {
          // Placeholder — noop for now
        },
      },
      {
        id: "modio:createMod",
        label: "Create Mod on mod.io",
        category: "action",
        icon: "＋",
        when: "modioConnected",
        enabled: () => modioStore.isAuthenticated,
        execute: async () => {
          // Placeholder — noop for now
        },
      },
      {
        id: "modio:editMod",
        label: "Edit Mod on mod.io",
        category: "action",
        icon: "✎",
        when: "modioConnected",
        enabled: () => modioStore.isAuthenticated,
        execute: async () => {
          // Placeholder — noop for now
        },
      },
    ];
    commandRegistry.registerMany(commands);

    // 2. Set view components for sidebar
    viewRegistry.setViewComponent("modio.panel", ModioPanel);
    viewRegistry.setViewComponent("modio.settings", ModioSettingsSubpanel);

    // 3. Find the status bar item registered by the host and configure it
    const statusItem = statusBarRegistry.items.find(i => i.id === "modio.status");
    if (statusItem) {
      statusItem.text = "";
      statusItem.icon = "package";
      statusItem.tooltip = "mod.io";
    }

    // 4. Set up context key syncing and status bar text via $effect.root
    const cleanupEffects = $effect.root(() => {
      $effect(() => {
        contextKeys.set("modioConnected", modioStore.isAuthenticated);
      });
      $effect(() => {
        contextKeys.set("modioAuthenticated", modioStore.isAuthenticated && !modioStore.tokenExpired);
      });
      $effect(() => {
        if (statusItem) {
          statusItem.text = modioStore.userName || "";
          statusItem.tooltip = modioStore.isAuthenticated
            ? `mod.io: ${modioStore.userName}`
            : "mod.io: Not connected";
        }
      });

      // Project lifecycle: load/reset config when project changes
      $effect(() => {
        const path = modStore.selectedModPath;
        if (path) {
          modioStore.loadProjectConfig(path);
        } else {
          modioStore.resetProject();
        }
      });
    });

    // Check auth on activation so status bar shows immediately
    modioStore.checkAuth();

    // Store cleanup in subscriptions
    ctx.subscriptions.push({ dispose: cleanupEffects });
  },

  deactivate() {
    // Clean up context keys
    contextKeys.delete("modioConnected");
    contextKeys.delete("modioAuthenticated");
    // Commands will be cleaned up by pluginHost via unregisterPrefix
  },
};
