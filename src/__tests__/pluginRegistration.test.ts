import { describe, it, expect, vi, afterEach } from "vitest";
import { pluginHost } from "../lib/plugins/pluginHost.svelte.js";
import { commandRegistry } from "../lib/utils/commandRegistry.svelte.js";
import { contextKeys } from "../lib/plugins/contextKeyService.svelte.js";

// Mock Svelte component imports used by the plugins — vitest can't render .svelte files
vi.mock("../components/platform/nexus/NexusPanel.svelte", () => ({ default: {} }));
vi.mock("../components/platform/nexus/NexusSettingsSubpanel.svelte", () => ({ default: {} }));
vi.mock("../components/platform/modio/ModioPanel.svelte", () => ({ default: {} }));
vi.mock("../components/platform/modio/ModioSettingsSubpanel.svelte", () => ({ default: {} }));
vi.mock("../components/git/GitPanel.svelte", () => ({ default: {} }));
vi.mock("../components/git/ForgeSection.svelte", () => ({ default: {} }));
vi.mock("../components/settings/GitSettingsSection.svelte", () => ({ default: {} }));

import { nexusPlugin } from "../lib/plugins/builtins/nexusPlugin.svelte.js";
import { modioPlugin } from "../lib/plugins/builtins/modioPlugin.svelte.js";
import { gitPlugin } from "../lib/plugins/builtins/gitPlugin.svelte.js";

describe("Plugin Registration — Nexus", () => {
  afterEach(async () => {
    await pluginHost.deactivateAll();
  });

  it("nexusPlugin registers with correct manifest id", () => {
    pluginHost.register(nexusPlugin);
    const manifests = pluginHost.getRegisteredPlugins();
    expect(manifests.some((m) => m.id === "cmty.nexus")).toBe(true);
  });

  it("nexusPlugin.activate registers all 4 commands", async () => {
    pluginHost.register(nexusPlugin);
    await pluginHost.activate("cmty.nexus");

    const commands = commandRegistry.getAll();
    expect(commands.some((c) => c.id === "nexus:setApiKey")).toBe(true);
    expect(commands.some((c) => c.id === "nexus:clearApiKey")).toBe(true);
    expect(commands.some((c) => c.id === "nexus:resolveMod")).toBe(true);
    expect(commands.some((c) => c.id === "nexus:upload")).toBe(true);
  });

  it("nexusPlugin.activate registers and activates successfully", async () => {
    pluginHost.register(nexusPlugin);
    await pluginHost.activate("cmty.nexus");

    expect(pluginHost.isActivated("cmty.nexus")).toBe(true);
  });

  it("nexusPlugin.deactivate removes context keys", async () => {
    pluginHost.register(nexusPlugin);
    await pluginHost.activate("cmty.nexus");
    await pluginHost.deactivate("cmty.nexus");

    expect(contextKeys.get("nexusConnected")).toBeUndefined();
  });
});

describe("Plugin Registration — mod.io", () => {
  afterEach(async () => {
    await pluginHost.deactivateAll();
  });

  it("modioPlugin registers with correct manifest id", () => {
    pluginHost.register(modioPlugin);
    const manifests = pluginHost.getRegisteredPlugins();
    expect(manifests.some((m) => m.id === "cmty.modio")).toBe(true);
  });

  it("modioPlugin.activate registers all 5 commands", async () => {
    pluginHost.register(modioPlugin);
    await pluginHost.activate("cmty.modio");

    const commands = commandRegistry.getAll();
    expect(commands.some((c) => c.id === "modio:connect")).toBe(true);
    expect(commands.some((c) => c.id === "modio:disconnect")).toBe(true);
    expect(commands.some((c) => c.id === "modio:upload")).toBe(true);
    expect(commands.some((c) => c.id === "modio:createMod")).toBe(true);
    expect(commands.some((c) => c.id === "modio:editMod")).toBe(true);
  });

  it("modioPlugin.activate registers and activates successfully", async () => {
    pluginHost.register(modioPlugin);
    await pluginHost.activate("cmty.modio");

    expect(pluginHost.isActivated("cmty.modio")).toBe(true);
  });

  it("modioPlugin.deactivate removes context keys", async () => {
    pluginHost.register(modioPlugin);
    await pluginHost.activate("cmty.modio");
    await pluginHost.deactivate("cmty.modio");

    expect(contextKeys.get("modioConnected")).toBeUndefined();
    expect(contextKeys.get("modioAuthenticated")).toBeUndefined();
  });
});

describe("Plugin Registration — All Plugins", () => {
  afterEach(async () => {
    await pluginHost.deactivateAll();
  });

  it("all three plugins register and activate via fireActivationEvent", async () => {
    pluginHost.register(gitPlugin);
    pluginHost.register(nexusPlugin);
    pluginHost.register(modioPlugin);

    await pluginHost.fireActivationEvent("onStartupFinished");

    expect(pluginHost.isActivated("cmty.git")).toBe(true);
    expect(pluginHost.isActivated("cmty.nexus")).toBe(true);
    expect(pluginHost.isActivated("cmty.modio")).toBe(true);
  });
});
