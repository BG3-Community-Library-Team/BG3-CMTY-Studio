import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { pluginHost } from "../lib/plugins/pluginHost.svelte.js";
import { configurationRegistry } from "../lib/plugins/configurationRegistry.svelte.js";
import type { PluginModule } from "../lib/plugins/pluginTypes.js";

function makeTestPlugin(
  overrides: {
    manifest?: Partial<PluginModule["manifest"]>;
    activate?: PluginModule["activate"];
    deactivate?: PluginModule["deactivate"];
  } = {},
): PluginModule {
  return {
    manifest: {
      id: overrides.manifest?.id ?? "test.plugin",
      name: overrides.manifest?.name ?? "Test Plugin",
      activationEvents: overrides.manifest?.activationEvents ?? ["onStartupFinished"],
      contributes: overrides.manifest?.contributes ?? {},
    },
    activate: overrides.activate ?? vi.fn(),
    deactivate: overrides.deactivate ?? vi.fn(),
  };
}

describe("PluginHost", () => {
  // Track registered plugin IDs so we can clean up the singleton
  const registeredIds: string[] = [];

  beforeEach(() => {
    registeredIds.length = 0;
  });

  afterEach(async () => {
    // Deactivate all plugins registered during this test
    await pluginHost.deactivateAll();
    // The singleton retains registered (but inactive) plugins.
    // Since register is idempotent, leftover entries won't cause issues
    // as long as IDs are unique per test.
  });

  // ── register ───────────────────────────────────────────

  it("stores a plugin so getRegisteredPlugins includes its manifest", () => {
    const plugin = makeTestPlugin({ manifest: { id: "test.reg1" } });
    pluginHost.register(plugin);
    registeredIds.push("test.reg1");

    const manifests = pluginHost.getRegisteredPlugins();
    expect(manifests.some((m) => m.id === "test.reg1")).toBe(true);
  });

  it("register is idempotent — duplicate id does not create a second entry", () => {
    const plugin = makeTestPlugin({ manifest: { id: "test.idem" } });
    pluginHost.register(plugin);
    pluginHost.register(plugin);
    registeredIds.push("test.idem");

    const count = pluginHost.getRegisteredPlugins().filter((m) => m.id === "test.idem").length;
    expect(count).toBe(1);
  });

  // ── activate ───────────────────────────────────────────

  it("calls the plugin's activate function", async () => {
    const activateFn = vi.fn();
    const plugin = makeTestPlugin({
      manifest: { id: "test.act1" },
      activate: activateFn,
    });
    pluginHost.register(plugin);
    registeredIds.push("test.act1");

    await pluginHost.activate("test.act1");

    expect(activateFn).toHaveBeenCalledOnce();
    expect(pluginHost.isActivated("test.act1")).toBe(true);
  });

  it("processes configuration contributions on activate", async () => {
    const plugin = makeTestPlugin({
      manifest: {
        id: "test.cfg1",
        contributes: {
          configuration: {
            title: "Test Config",
            properties: {
              "test.cfg1.enabled": {
                type: "boolean",
                default: true,
                description: "Enable test feature",
              },
            },
          },
        },
      },
    });
    pluginHost.register(plugin);
    registeredIds.push("test.cfg1");

    await pluginHost.activate("test.cfg1");

    const sections = configurationRegistry.getSections();
    expect(sections.some((s) => s.title === "Test Config")).toBe(true);
  });

  it("does not crash when a plugin throws in activate", async () => {
    const plugin = makeTestPlugin({
      manifest: { id: "test.throw1" },
      activate: () => {
        throw new Error("boom");
      },
    });
    pluginHost.register(plugin);
    registeredIds.push("test.throw1");

    // Should not throw
    await expect(pluginHost.activate("test.throw1")).resolves.toBeUndefined();
    // Plugin is still considered activated (contributions are valid)
    expect(pluginHost.isActivated("test.throw1")).toBe(true);
  });

  // ── deactivate ─────────────────────────────────────────

  it("calls the plugin's deactivate function", async () => {
    const deactivateFn = vi.fn();
    const plugin = makeTestPlugin({
      manifest: { id: "test.deact1" },
      deactivate: deactivateFn,
    });
    pluginHost.register(plugin);
    registeredIds.push("test.deact1");

    await pluginHost.activate("test.deact1");
    await pluginHost.deactivate("test.deact1");

    expect(deactivateFn).toHaveBeenCalledOnce();
    expect(pluginHost.isActivated("test.deact1")).toBe(false);
  });

  it("removes configuration contributions on deactivate", async () => {
    const plugin = makeTestPlugin({
      manifest: {
        id: "test.cfgclean",
        contributes: {
          configuration: {
            title: "Cleanup Config",
            properties: {
              "test.cfgclean.val": {
                type: "string",
                default: "hello",
                description: "A test prop",
              },
            },
          },
        },
      },
    });
    pluginHost.register(plugin);
    registeredIds.push("test.cfgclean");

    await pluginHost.activate("test.cfgclean");
    expect(configurationRegistry.getSections().some((s) => s.title === "Cleanup Config")).toBe(
      true,
    );

    await pluginHost.deactivate("test.cfgclean");
    expect(configurationRegistry.getSections().some((s) => s.title === "Cleanup Config")).toBe(
      false,
    );
  });

  // ── fireActivationEvent ────────────────────────────────

  it("activates plugins that listen for the fired event", async () => {
    const activateFn = vi.fn();
    const plugin = makeTestPlugin({
      manifest: { id: "test.event1", activationEvents: ["onStartupFinished"] },
      activate: activateFn,
    });
    pluginHost.register(plugin);
    registeredIds.push("test.event1");

    await pluginHost.fireActivationEvent("onStartupFinished");

    expect(activateFn).toHaveBeenCalledOnce();
    expect(pluginHost.isActivated("test.event1")).toBe(true);
  });

  it("does not activate plugins listening for a different event", async () => {
    const activateFn = vi.fn();
    const plugin = makeTestPlugin({
      manifest: { id: "test.event2", activationEvents: ["onCommand:foo"] },
      activate: activateFn,
    });
    pluginHost.register(plugin);
    registeredIds.push("test.event2");

    await pluginHost.fireActivationEvent("onStartupFinished");

    expect(activateFn).not.toHaveBeenCalled();
    expect(pluginHost.isActivated("test.event2")).toBe(false);
  });
});
