/**
 * Integration tests for the full plugin lifecycle.
 *
 * Unlike pluginHost.test.ts (which tests the host in isolation),
 * these tests verify the FULL integration path from plugin registration
 * through all contribution registries to deactivation cleanup.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { pluginHost } from "../lib/plugins/pluginHost.svelte.js";
import { commandRegistry, type Command } from "../lib/utils/commandRegistry.svelte.js";
import { configurationRegistry } from "../lib/plugins/configurationRegistry.svelte.js";
import { viewRegistry } from "../lib/plugins/viewRegistry.svelte.js";
import { statusBarRegistry } from "../lib/plugins/statusBarRegistry.svelte.js";
import { menuRegistry } from "../lib/plugins/menuRegistry.svelte.js";
import { contextKeys } from "../lib/plugins/contextKeyService.svelte.js";
import type { PluginModule, PluginContext } from "../lib/plugins/pluginTypes.js";

// ── Helpers ──────────────────────────────────────────────

let testCounter = 0;

/** Build a unique plugin ID for each test to prevent singleton interference */
function uniqueId(base: string): string {
  return `test.int.${base}.${++testCounter}`;
}

/** Build a fully-featured test plugin manifest with all contribution types */
function makeFullPlugin(
  id: string,
  overrides: {
    activate?: PluginModule["activate"];
    deactivate?: PluginModule["deactivate"];
    activationEvents?: PluginModule["manifest"]["activationEvents"];
  } = {},
): PluginModule {
  const shortName = id.split(".").pop()!;

  return {
    manifest: {
      id,
      name: `Test Plugin ${shortName}`,
      version: "1.0.0",
      activationEvents: overrides.activationEvents ?? ["*"],
      contributes: {
        commands: [
          { command: `${shortName}:doSomething`, title: "Do Something", category: "Test" },
          { command: `${shortName}:doOther`, title: "Do Other", category: "Test", enablement: `${shortName}Active` },
        ],
        configuration: {
          title: `${shortName} Settings`,
          properties: {
            [`${shortName}.enabled`]: {
              type: "boolean",
              default: true,
              description: "Enable the feature",
            },
            [`${shortName}.threshold`]: {
              type: "number",
              default: 42,
              description: "Threshold value",
            },
          },
        },
        viewsContainers: [
          { id: `${shortName}-container`, title: `${shortName} Container`, icon: "box", location: "sidebar" as const },
        ],
        views: {
          [`${shortName}-container`]: [
            { id: `${shortName}.mainView`, name: `${shortName} Main` },
            { id: `${shortName}.conditional`, name: `${shortName} Conditional`, when: `${shortName}Active` },
          ],
        },
        statusBarItems: [
          { id: `${shortName}.status`, alignment: "left" as const, priority: 50, when: `${shortName}Active` },
        ],
        menus: {
          commandPalette: [
            { command: `${shortName}:doSomething`, when: `${shortName}Active` },
            { command: `${shortName}:doOther`, when: `${shortName}Active` },
          ],
        },
      },
    },
    activate:
      overrides.activate ??
      ((ctx: PluginContext) => {
        // Register command implementations (as real plugins do)
        const cmds: Command[] = [
          {
            id: `${shortName}:doSomething`,
            label: "Do Something",
            category: "action",
            icon: "▶",
            when: `${shortName}Active`,
            enabled: () => true,
            execute: vi.fn(),
          },
          {
            id: `${shortName}:doOther`,
            label: "Do Other",
            category: "action",
            icon: "▶",
            when: `${shortName}Active`,
            enabled: () => true,
            execute: vi.fn(),
          },
        ];
        commandRegistry.registerMany(cmds);
      }),
    deactivate: overrides.deactivate ?? vi.fn(),
  };
}

// ── Lifecycle cleanup ────────────────────────────────────

/** Context keys created during tests — cleaned up in afterEach */
const testContextKeys: string[] = [];

function setTestKey(key: string, value: unknown): void {
  testContextKeys.push(key);
  contextKeys.set(key, value);
}

describe("Plugin System Integration", () => {
  beforeEach(() => {
    testContextKeys.length = 0;
  });

  afterEach(async () => {
    await pluginHost.deactivateAll();
    // Clean up command registry entries from test plugins
    commandRegistry.commands = commandRegistry.commands.filter(
      (c) => !c.id.includes("test.int.") && !c.id.match(/^[a-zA-Z0-9]+:(doSomething|doOther|fail|cmdA|cmdB)$/),
    );
    // Clean up context keys
    for (const key of testContextKeys) {
      contextKeys.delete(key);
    }
  });

  // ── 1. Full lifecycle: register → activate → verify → deactivate → verify ──

  it("full lifecycle: contributions appear in all registries after activate and disappear after deactivate", async () => {
    const pluginId = uniqueId("lifecycle");
    const shortName = pluginId.split(".").pop()!;
    const plugin = makeFullPlugin(pluginId);

    pluginHost.register(plugin);
    await pluginHost.activate(pluginId);

    // Configuration registered
    const sections = configurationRegistry.getSections();
    expect(sections.some((s) => s.title === `${shortName} Settings`)).toBe(true);
    expect(configurationRegistry.get(`${shortName}.enabled`)).toBe(true);
    expect(configurationRegistry.get(`${shortName}.threshold`)).toBe(42);

    // View container registered
    const containers = viewRegistry.getContainers("sidebar");
    expect(containers.some((c) => c.id === `${shortName}-container`)).toBe(true);

    // Views registered (including conditional)
    setTestKey(`${shortName}Active`, true);
    const visibleViews = viewRegistry.getVisibleViews(`${shortName}-container`);
    expect(visibleViews.some((v) => v.id === `${shortName}.mainView`)).toBe(true);
    expect(visibleViews.some((v) => v.id === `${shortName}.conditional`)).toBe(true);

    // Status bar items registered
    expect(statusBarRegistry.items.some((i) => i.id === `${shortName}.status`)).toBe(true);

    // Menu entries registered
    const paletteEntries = menuRegistry.getVisibleEntries("commandPalette");
    expect(paletteEntries.some((e) => e.command === `${shortName}:doSomething`)).toBe(true);

    // Commands registered (by activate function)
    expect(commandRegistry.getAll().some((c) => c.id === `${shortName}:doSomething`)).toBe(true);
    expect(commandRegistry.getAll().some((c) => c.id === `${shortName}:doOther`)).toBe(true);

    // ── Deactivate ──
    await pluginHost.deactivate(pluginId);

    // Configuration removed
    expect(configurationRegistry.getSections().some((s) => s.title === `${shortName} Settings`)).toBe(false);
    expect(configurationRegistry.get(`${shortName}.enabled`)).toBeUndefined();

    // View container removed
    expect(viewRegistry.getContainers("sidebar").some((c) => c.id === `${shortName}-container`)).toBe(false);

    // Views removed
    expect(viewRegistry.getVisibleViews(`${shortName}-container`)).toHaveLength(0);

    // Status bar items removed
    expect(statusBarRegistry.items.some((i) => i.id === `${shortName}.status`)).toBe(false);

    // Menu entries removed
    expect(menuRegistry.getVisibleEntries("commandPalette").some((e) => e.command === `${shortName}:doSomething`)).toBe(false);

    // Commands removed (by unregisterPrefix in deactivate)
    expect(commandRegistry.getAll().some((c) => c.id === `${shortName}:doSomething`)).toBe(false);
  });

  // ── 2. Context key ↔ when clause integration ──────────

  it("context key changes affect command visibility via when clause", () => {
    const key = `visTest_${testCounter++}`;

    // Register a command with a when clause
    const cmd: Command = {
      id: `vis:${key}`,
      label: "Conditional Command",
      category: "action",
      icon: "▶",
      when: key,
      enabled: () => true,
      execute: vi.fn(),
    };
    commandRegistry.register(cmd);

    // Key not set → command should not be visible
    expect(commandRegistry.getVisibleCommands().some((c) => c.id === `vis:${key}`)).toBe(false);

    // Set key → command should be visible
    setTestKey(key, true);
    expect(commandRegistry.getVisibleCommands().some((c) => c.id === `vis:${key}`)).toBe(true);

    // Unset key → command should not be visible again
    contextKeys.set(key, false);
    expect(commandRegistry.getVisibleCommands().some((c) => c.id === `vis:${key}`)).toBe(false);

    // Cleanup
    commandRegistry.unregister(`vis:${key}`);
  });

  // ── 3. Plugin with configuration defaults ──────────────

  it("configuration defaults are accessible after activation and removed after deactivation", async () => {
    const pluginId = uniqueId("cfgDefaults");
    const shortName = pluginId.split(".").pop()!;
    const plugin = makeFullPlugin(pluginId);

    pluginHost.register(plugin);
    await pluginHost.activate(pluginId);

    // Defaults accessible
    expect(configurationRegistry.get(`${shortName}.enabled`)).toBe(true);
    expect(configurationRegistry.get(`${shortName}.threshold`)).toBe(42);

    // Override a value
    configurationRegistry.set(`${shortName}.threshold`, 100);
    expect(configurationRegistry.get(`${shortName}.threshold`)).toBe(100);

    // Deactivate — configuration removed (including overrides)
    await pluginHost.deactivate(pluginId);
    expect(configurationRegistry.get(`${shortName}.threshold`)).toBeUndefined();
    expect(configurationRegistry.getSections().some((s) => s.title === `${shortName} Settings`)).toBe(false);
  });

  // ── 4. View contributions with when clauses ────────────

  it("view visibility responds to context key changes via when clauses", async () => {
    const pluginId = uniqueId("viewWhen");
    const shortName = pluginId.split(".").pop()!;
    const plugin = makeFullPlugin(pluginId);

    pluginHost.register(plugin);
    await pluginHost.activate(pluginId);

    // View without when clause is always visible
    const alwaysVisible = viewRegistry.getVisibleViews(`${shortName}-container`);
    expect(alwaysVisible.some((v) => v.id === `${shortName}.mainView`)).toBe(true);

    // Conditional view hidden when key not set
    expect(alwaysVisible.some((v) => v.id === `${shortName}.conditional`)).toBe(false);

    // Set context key → conditional view becomes visible
    setTestKey(`${shortName}Active`, true);
    const nowVisible = viewRegistry.getVisibleViews(`${shortName}-container`);
    expect(nowVisible.some((v) => v.id === `${shortName}.conditional`)).toBe(true);

    // Clear context key → conditional view hidden again
    contextKeys.set(`${shortName}Active`, false);
    const hiddenAgain = viewRegistry.getVisibleViews(`${shortName}-container`);
    expect(hiddenAgain.some((v) => v.id === `${shortName}.conditional`)).toBe(false);

    // Deactivate → all views removed
    await pluginHost.deactivate(pluginId);
    expect(viewRegistry.getVisibleViews(`${shortName}-container`)).toHaveLength(0);
  });

  // ── 5. Status bar item lifecycle ───────────────────────

  it("status bar items appear after activation and disappear after deactivation", async () => {
    const pluginId = uniqueId("statusBar");
    const shortName = pluginId.split(".").pop()!;
    const plugin = makeFullPlugin(pluginId);

    pluginHost.register(plugin);
    await pluginHost.activate(pluginId);

    // Item registered
    const item = statusBarRegistry.items.find((i) => i.id === `${shortName}.status`);
    expect(item).toBeDefined();
    expect(item!.pluginId).toBe(pluginId);
    expect(item!.alignment).toBe("left");
    expect(item!.priority).toBe(50);

    // Item visibility controlled by when clause
    expect(item!.visible).toBe(false); // key not set
    setTestKey(`${shortName}Active`, true);
    expect(item!.visible).toBe(true);

    // Deactivate → item removed
    await pluginHost.deactivate(pluginId);
    expect(statusBarRegistry.items.some((i) => i.id === `${shortName}.status`)).toBe(false);
  });

  // ── 6. Menu contribution lifecycle ─────────────────────

  it("menu entries appear after activation and disappear after deactivation", async () => {
    const pluginId = uniqueId("menus");
    const shortName = pluginId.split(".").pop()!;
    const plugin = makeFullPlugin(pluginId);

    pluginHost.register(plugin);
    await pluginHost.activate(pluginId);

    // Entries not visible without context key
    const hiddenEntries = menuRegistry.getVisibleEntries("commandPalette");
    expect(hiddenEntries.some((e) => e.command === `${shortName}:doSomething`)).toBe(false);

    // Set context key → entries visible
    setTestKey(`${shortName}Active`, true);
    const visibleEntries = menuRegistry.getVisibleEntries("commandPalette");
    expect(visibleEntries.some((e) => e.command === `${shortName}:doSomething`)).toBe(true);
    expect(visibleEntries.some((e) => e.command === `${shortName}:doOther`)).toBe(true);

    // Deactivate → entries removed
    await pluginHost.deactivate(pluginId);
    setTestKey(`${shortName}Active`, true); // Ensure key is set to confirm entries really gone
    expect(menuRegistry.getVisibleEntries("commandPalette").some((e) => e.command === `${shortName}:doSomething`)).toBe(false);
  });

  // ── 7. Error resilience — bad plugin doesn't crash host ─

  it("a plugin that throws in activate does not prevent other plugins from activating", async () => {
    const badId = uniqueId("badPlugin");
    const goodId = uniqueId("goodPlugin");
    const goodShort = goodId.split(".").pop()!;

    const badPlugin = makeFullPlugin(badId, {
      activate: () => {
        throw new Error("Plugin activation bomb");
      },
    });

    const goodActivate = vi.fn((ctx: PluginContext) => {
      commandRegistry.register({
        id: `${goodShort}:doSomething`,
        label: "Good Command",
        category: "action",
        icon: "▶",
        enabled: () => true,
        execute: vi.fn(),
      });
    });
    const goodPlugin = makeFullPlugin(goodId, { activate: goodActivate });

    pluginHost.register(badPlugin);
    pluginHost.register(goodPlugin);

    // Activating the bad plugin should not throw
    await expect(pluginHost.activate(badId)).resolves.toBeUndefined();
    // Bad plugin is still marked as activated (contributions are valid)
    expect(pluginHost.isActivated(badId)).toBe(true);

    // Good plugin can still activate
    await pluginHost.activate(goodId);
    expect(pluginHost.isActivated(goodId)).toBe(true);
    expect(goodActivate).toHaveBeenCalledOnce();

    // Good plugin's contributions are intact
    expect(commandRegistry.getAll().some((c) => c.id === `${goodShort}:doSomething`)).toBe(true);
  });

  // ── 8. Multiple plugins — isolation ────────────────────

  it("deactivating one plugin does not remove another plugin's contributions", async () => {
    const idA = uniqueId("pluginA");
    const idB = uniqueId("pluginB");
    const shortA = idA.split(".").pop()!;
    const shortB = idB.split(".").pop()!;

    const pluginA = makeFullPlugin(idA);
    const pluginB = makeFullPlugin(idB);

    pluginHost.register(pluginA);
    pluginHost.register(pluginB);
    await pluginHost.activate(idA);
    await pluginHost.activate(idB);

    // Both plugins' contributions exist
    expect(configurationRegistry.getSections().some((s) => s.title === `${shortA} Settings`)).toBe(true);
    expect(configurationRegistry.getSections().some((s) => s.title === `${shortB} Settings`)).toBe(true);
    expect(statusBarRegistry.items.some((i) => i.id === `${shortA}.status`)).toBe(true);
    expect(statusBarRegistry.items.some((i) => i.id === `${shortB}.status`)).toBe(true);
    expect(viewRegistry.getContainers("sidebar").some((c) => c.id === `${shortA}-container`)).toBe(true);
    expect(viewRegistry.getContainers("sidebar").some((c) => c.id === `${shortB}-container`)).toBe(true);

    // Deactivate plugin A
    await pluginHost.deactivate(idA);

    // Plugin A's contributions removed
    expect(configurationRegistry.getSections().some((s) => s.title === `${shortA} Settings`)).toBe(false);
    expect(statusBarRegistry.items.some((i) => i.id === `${shortA}.status`)).toBe(false);
    expect(viewRegistry.getContainers("sidebar").some((c) => c.id === `${shortA}-container`)).toBe(false);
    expect(commandRegistry.getAll().some((c) => c.id === `${shortA}:doSomething`)).toBe(false);

    // Plugin B's contributions still intact
    expect(configurationRegistry.getSections().some((s) => s.title === `${shortB} Settings`)).toBe(true);
    expect(statusBarRegistry.items.some((i) => i.id === `${shortB}.status`)).toBe(true);
    expect(viewRegistry.getContainers("sidebar").some((c) => c.id === `${shortB}-container`)).toBe(true);
    expect(commandRegistry.getAll().some((c) => c.id === `${shortB}:doSomething`)).toBe(true);
  });

  // ── 9. Activation events — onCommand ───────────────────

  it("fireActivationEvent activates plugins listening for that event", async () => {
    const pluginId = uniqueId("onCmd");
    const shortName = pluginId.split(".").pop()!;
    const activateFn = vi.fn((ctx: PluginContext) => {
      commandRegistry.register({
        id: `${shortName}:doSomething`,
        label: "Lazy Command",
        category: "action",
        icon: "▶",
        enabled: () => true,
        execute: vi.fn(),
      });
    });

    const plugin = makeFullPlugin(pluginId, {
      activate: activateFn,
      activationEvents: [`onCommand:${shortName}:doSomething`],
    });

    pluginHost.register(plugin);

    // Plugin not yet activated
    expect(pluginHost.isActivated(pluginId)).toBe(false);

    // Fire the activation event
    await pluginHost.fireActivationEvent(`onCommand:${shortName}:doSomething`);

    // Plugin now activated
    expect(pluginHost.isActivated(pluginId)).toBe(true);
    expect(activateFn).toHaveBeenCalledOnce();

    // Contributions are registered
    expect(configurationRegistry.getSections().some((s) => s.title === `${shortName} Settings`)).toBe(true);
    expect(commandRegistry.getAll().some((c) => c.id === `${shortName}:doSomething`)).toBe(true);
  });

  // ── 10. Star activation event ──────────────────────────

  it("plugins with '*' activation event activate on any fireActivationEvent call", async () => {
    const pluginId = uniqueId("star");
    const activateFn = vi.fn();

    const plugin = makeFullPlugin(pluginId, {
      activate: activateFn,
      activationEvents: ["*"],
    });

    pluginHost.register(plugin);

    // Fire an arbitrary event
    await pluginHost.fireActivationEvent("onSomeRandomEvent");

    expect(pluginHost.isActivated(pluginId)).toBe(true);
    expect(activateFn).toHaveBeenCalledOnce();
  });

  // ── 11. Deactivate error does not crash host ───────────

  it("a plugin that throws in deactivate does not prevent cleanup", async () => {
    const pluginId = uniqueId("deactThrow");
    const shortName = pluginId.split(".").pop()!;

    const plugin = makeFullPlugin(pluginId, {
      deactivate: () => {
        throw new Error("Deactivation bomb");
      },
    });

    pluginHost.register(plugin);
    await pluginHost.activate(pluginId);

    // Deactivation should not throw despite plugin error
    await expect(pluginHost.deactivate(pluginId)).resolves.toBeUndefined();

    // Plugin is deactivated and contributions are cleaned up
    expect(pluginHost.isActivated(pluginId)).toBe(false);
    expect(configurationRegistry.getSections().some((s) => s.title === `${shortName} Settings`)).toBe(false);
    expect(statusBarRegistry.items.some((i) => i.id === `${shortName}.status`)).toBe(false);
  });

  // ── 12. Context key + menu visibility cross-registry ───

  it("context key changes propagate to menu entry visibility", () => {
    const key = `menuVis_${testCounter++}`;

    // Directly register a menu entry with a when clause
    const disposable = menuRegistry.registerMenuEntries("test.direct", {
      commandPalette: [
        { command: "test:menuCmd", when: key },
      ],
    });

    // Not visible without key
    expect(menuRegistry.getVisibleEntries("commandPalette").some((e) => e.command === "test:menuCmd")).toBe(false);

    // Set key → visible
    setTestKey(key, true);
    expect(menuRegistry.getVisibleEntries("commandPalette").some((e) => e.command === "test:menuCmd")).toBe(true);

    // Complex expression
    const key2 = `menuVis2_${testCounter++}`;
    setTestKey(key2, false);
    const d2 = menuRegistry.registerMenuEntries("test.direct2", {
      commandPalette: [
        { command: "test:complexCmd", when: `${key} && ${key2}` },
      ],
    });

    // key=true, key2=false → AND fails
    expect(menuRegistry.getVisibleEntries("commandPalette").some((e) => e.command === "test:complexCmd")).toBe(false);

    // key=true, key2=true → AND passes
    contextKeys.set(key2, true);
    testContextKeys.push(key2);
    expect(menuRegistry.getVisibleEntries("commandPalette").some((e) => e.command === "test:complexCmd")).toBe(true);

    disposable.dispose();
    d2.dispose();
  });

  // ── 13. deactivateAll cleans up everything ─────────────

  it("deactivateAll removes contributions from all active plugins", async () => {
    const idA = uniqueId("allA");
    const idB = uniqueId("allB");
    const shortA = idA.split(".").pop()!;
    const shortB = idB.split(".").pop()!;

    pluginHost.register(makeFullPlugin(idA));
    pluginHost.register(makeFullPlugin(idB));
    await pluginHost.activate(idA);
    await pluginHost.activate(idB);

    // Both active
    expect(pluginHost.isActivated(idA)).toBe(true);
    expect(pluginHost.isActivated(idB)).toBe(true);

    await pluginHost.deactivateAll();

    // Both deactivated
    expect(pluginHost.isActivated(idA)).toBe(false);
    expect(pluginHost.isActivated(idB)).toBe(false);

    // All contributions removed
    expect(configurationRegistry.getSections().some((s) => s.title === `${shortA} Settings`)).toBe(false);
    expect(configurationRegistry.getSections().some((s) => s.title === `${shortB} Settings`)).toBe(false);
    expect(statusBarRegistry.items.some((i) => i.id === `${shortA}.status`)).toBe(false);
    expect(statusBarRegistry.items.some((i) => i.id === `${shortB}.status`)).toBe(false);
  });
});
