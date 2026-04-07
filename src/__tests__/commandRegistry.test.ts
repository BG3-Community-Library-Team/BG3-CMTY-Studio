import { describe, it, expect, vi, beforeEach } from "vitest";

// The module uses $state which is compiled by the svelte plugin.
// Import the singleton and its types.
import {
  commandRegistry,
  CATEGORY_LABELS,
  PALETTE_CATEGORIES,
  type Command,
  type CommandCategory,
} from "../lib/utils/commandRegistry.svelte.js";

function makeCmd(overrides: Partial<Command> = {}): Command {
  return {
    id: overrides.id ?? "test.cmd",
    label: overrides.label ?? "Test Command",
    category: overrides.category ?? "action",
    icon: overrides.icon ?? "▶",
    shortcut: overrides.shortcut,
    enabled: overrides.enabled ?? (() => true),
    execute: overrides.execute ?? vi.fn(),
  };
}

describe("CommandRegistry", () => {
  beforeEach(() => {
    // Reset registry state between tests
    commandRegistry.commands = [];
    commandRegistry.recentIds = [];
    localStorage.clear();
  });

  // ── register() ──────────────────────────────────────────

  describe("register()", () => {
    it("adds a command to the registry", () => {
      const cmd = makeCmd({ id: "a.one" });
      commandRegistry.register(cmd);
      expect(commandRegistry.getAll()).toHaveLength(1);
      expect(commandRegistry.getAll()[0].id).toBe("a.one");
    });

    it("prevents duplicate registrations (same id)", () => {
      const cmd1 = makeCmd({ id: "dup.id" });
      const cmd2 = makeCmd({ id: "dup.id", label: "Different" });
      commandRegistry.register(cmd1);
      commandRegistry.register(cmd2);
      expect(commandRegistry.getAll()).toHaveLength(1);
      expect(commandRegistry.getAll()[0].label).toBe("Test Command");
    });

    it("allows multiple commands with different ids", () => {
      commandRegistry.register(makeCmd({ id: "a" }));
      commandRegistry.register(makeCmd({ id: "b" }));
      commandRegistry.register(makeCmd({ id: "c" }));
      expect(commandRegistry.getAll()).toHaveLength(3);
    });
  });

  // ── registerMany() ─────────────────────────────────────

  describe("registerMany()", () => {
    it("registers an array of commands", () => {
      commandRegistry.registerMany([
        makeCmd({ id: "m1" }),
        makeCmd({ id: "m2" }),
        makeCmd({ id: "m3" }),
      ]);
      expect(commandRegistry.getAll()).toHaveLength(3);
    });

    it("skips duplicates within the batch", () => {
      commandRegistry.registerMany([
        makeCmd({ id: "same" }),
        makeCmd({ id: "same" }),
      ]);
      expect(commandRegistry.getAll()).toHaveLength(1);
    });
  });

  // ── unregister() ────────────────────────────────────────

  describe("unregister()", () => {
    it("removes an existing command", () => {
      commandRegistry.register(makeCmd({ id: "rem" }));
      expect(commandRegistry.getAll()).toHaveLength(1);
      commandRegistry.unregister("rem");
      expect(commandRegistry.getAll()).toHaveLength(0);
    });

    it("is a no-op for a non-existing id", () => {
      commandRegistry.register(makeCmd({ id: "keep" }));
      commandRegistry.unregister("nonexistent");
      expect(commandRegistry.getAll()).toHaveLength(1);
    });
  });

  // ── unregisterPrefix() ─────────────────────────────────

  describe("unregisterPrefix()", () => {
    it("removes all commands whose id starts with the prefix", () => {
      commandRegistry.registerMany([
        makeCmd({ id: "nav.home" }),
        makeCmd({ id: "nav.settings" }),
        makeCmd({ id: "action.save" }),
      ]);
      commandRegistry.unregisterPrefix("nav.");
      const ids = commandRegistry.getAll().map(c => c.id);
      expect(ids).toEqual(["action.save"]);
    });

    it("removes nothing when prefix matches no command", () => {
      commandRegistry.register(makeCmd({ id: "action.one" }));
      commandRegistry.unregisterPrefix("zzz.");
      expect(commandRegistry.getAll()).toHaveLength(1);
    });
  });

  // ── getEnabled() ────────────────────────────────────────

  describe("getEnabled()", () => {
    it("returns only commands whose enabled() returns true", () => {
      commandRegistry.register(makeCmd({ id: "on", enabled: () => true }));
      commandRegistry.register(makeCmd({ id: "off", enabled: () => false }));
      const enabled = commandRegistry.getEnabled();
      expect(enabled).toHaveLength(1);
      expect(enabled[0].id).toBe("on");
    });

    it("returns empty when all disabled", () => {
      commandRegistry.register(makeCmd({ id: "d1", enabled: () => false }));
      expect(commandRegistry.getEnabled()).toHaveLength(0);
    });
  });

  // ── getEnabledByCategory() ─────────────────────────────

  describe("getEnabledByCategory()", () => {
    it("filters by category AND enabled state", () => {
      commandRegistry.registerMany([
        makeCmd({ id: "a1", category: "action", enabled: () => true }),
        makeCmd({ id: "a2", category: "action", enabled: () => false }),
        makeCmd({ id: "n1", category: "navigation", enabled: () => true }),
      ]);
      const actions = commandRegistry.getEnabledByCategory("action");
      expect(actions).toHaveLength(1);
      expect(actions[0].id).toBe("a1");
    });

    it("returns empty for a category with no commands", () => {
      commandRegistry.register(makeCmd({ id: "a1", category: "action" }));
      expect(commandRegistry.getEnabledByCategory("help")).toHaveLength(0);
    });
  });

  // ── getCategoryIcon() ──────────────────────────────────

  describe("getCategoryIcon()", () => {
    it("returns the correct icon for each category", () => {
      expect(commandRegistry.getCategoryIcon("action")).toBe("▶");
      expect(commandRegistry.getCategoryIcon("navigation")).toBe("◎");
      expect(commandRegistry.getCategoryIcon("data")).toBe("⊞");
      expect(commandRegistry.getCategoryIcon("setting")).toBe("⚙");
      expect(commandRegistry.getCategoryIcon("entry")).toBe("≡");
      expect(commandRegistry.getCategoryIcon("help")).toBe("?");
    });
  });

  // ── execute() ───────────────────────────────────────────

  describe("execute()", () => {
    it("calls execute and records recent for an enabled command", () => {
      const exec = vi.fn();
      commandRegistry.register(makeCmd({ id: "run.me", execute: exec }));
      commandRegistry.execute("run.me");
      expect(exec).toHaveBeenCalledOnce();
      expect(commandRegistry.recentIds).toContain("run.me");
    });

    it("does NOT execute a disabled command", () => {
      const exec = vi.fn();
      commandRegistry.register(makeCmd({ id: "skip", enabled: () => false, execute: exec }));
      commandRegistry.execute("skip");
      expect(exec).not.toHaveBeenCalled();
    });

    it("does nothing for an unknown command id", () => {
      // Should not throw
      commandRegistry.execute("does.not.exist");
    });
  });

  // ── recordRecent() & getRecent() ───────────────────────

  describe("recent commands", () => {
    it("records and retrieves recent commands", () => {
      commandRegistry.register(makeCmd({ id: "r1" }));
      commandRegistry.register(makeCmd({ id: "r2" }));
      commandRegistry.recordRecent("r1");
      commandRegistry.recordRecent("r2");
      const recent = commandRegistry.getRecent();
      expect(recent.map(c => c.id)).toEqual(["r2", "r1"]);
    });

    it("limits recent to MAX_RECENT (3)", () => {
      for (let i = 0; i < 5; i++) {
        commandRegistry.register(makeCmd({ id: `r${i}` }));
        commandRegistry.recordRecent(`r${i}`);
      }
      expect(commandRegistry.recentIds).toHaveLength(3);
    });

    it("moves re-used command to front without duplicating", () => {
      commandRegistry.register(makeCmd({ id: "a" }));
      commandRegistry.register(makeCmd({ id: "b" }));
      commandRegistry.recordRecent("a");
      commandRegistry.recordRecent("b");
      commandRegistry.recordRecent("a");
      expect(commandRegistry.recentIds).toEqual(["a", "b"]);
    });

    it("excludes action.searchEntries from recent", () => {
      commandRegistry.register(makeCmd({ id: "action.searchEntries" }));
      commandRegistry.recordRecent("action.searchEntries");
      expect(commandRegistry.recentIds).toHaveLength(0);
    });

    it("getRecent() skips disabled commands", () => {
      commandRegistry.register(makeCmd({ id: "dis", enabled: () => false }));
      commandRegistry.recordRecent("dis");
      expect(commandRegistry.getRecent()).toHaveLength(0);
    });

    it("getRecent() skips ids no longer registered", () => {
      commandRegistry.register(makeCmd({ id: "temp" }));
      commandRegistry.recordRecent("temp");
      commandRegistry.unregister("temp");
      expect(commandRegistry.getRecent()).toHaveLength(0);
    });

    it("persists recent to localStorage", () => {
      commandRegistry.register(makeCmd({ id: "persist" }));
      commandRegistry.recordRecent("persist");
      const stored = localStorage.getItem("bg3-cmty-studio-recent-commands");
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!)).toContain("persist");
    });
  });

  // ── matchShortcut() ────────────────────────────────────

  describe("matchShortcut()", () => {
    function makeKeyEvent(overrides: Partial<KeyboardEvent> = {}): KeyboardEvent {
      return {
        key: "k",
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        ...overrides,
      } as KeyboardEvent;
    }

    it("matches a Ctrl+K shortcut", () => {
      commandRegistry.register(makeCmd({ id: "sc1", shortcut: "Ctrl+K" }));
      const result = commandRegistry.matchShortcut(makeKeyEvent({ key: "k", ctrlKey: true }));
      expect(result).toBeDefined();
      expect(result!.id).toBe("sc1");
    });

    it("matches Ctrl+Shift+K", () => {
      commandRegistry.register(makeCmd({ id: "sc2", shortcut: "Ctrl+Shift+K" }));
      const result = commandRegistry.matchShortcut(
        makeKeyEvent({ key: "k", ctrlKey: true, shiftKey: true }),
      );
      expect(result!.id).toBe("sc2");
    });

    it("matches Alt+A", () => {
      commandRegistry.register(makeCmd({ id: "sc3", shortcut: "Alt+A" }));
      const result = commandRegistry.matchShortcut(makeKeyEvent({ key: "a", altKey: true }));
      expect(result!.id).toBe("sc3");
    });

    it("returns undefined when no shortcut matches", () => {
      commandRegistry.register(makeCmd({ id: "no", shortcut: "Ctrl+X" }));
      const result = commandRegistry.matchShortcut(makeKeyEvent({ key: "z", ctrlKey: true }));
      expect(result).toBeUndefined();
    });

    it("returns undefined when command has no shortcut", () => {
      commandRegistry.register(makeCmd({ id: "noscut" }));
      const result = commandRegistry.matchShortcut(makeKeyEvent({ key: "k", ctrlKey: true }));
      expect(result).toBeUndefined();
    });

    it("normalizes + key to = for numpad compatibility", () => {
      commandRegistry.register(makeCmd({ id: "zoom", shortcut: "Ctrl+=" }));
      const result = commandRegistry.matchShortcut(makeKeyEvent({ key: "+", ctrlKey: true }));
      expect(result).toBeDefined();
      expect(result!.id).toBe("zoom");
    });

    it("matches multi-char key names like Escape", () => {
      commandRegistry.register(makeCmd({ id: "esc", shortcut: "Escape" }));
      const result = commandRegistry.matchShortcut(makeKeyEvent({ key: "Escape" }));
      expect(result!.id).toBe("esc");
    });

    it("uses metaKey as Ctrl equivalent", () => {
      commandRegistry.register(makeCmd({ id: "meta", shortcut: "Ctrl+S" }));
      const result = commandRegistry.matchShortcut(makeKeyEvent({ key: "s", metaKey: true }));
      expect(result!.id).toBe("meta");
    });
  });

  // ── CATEGORY_LABELS and PALETTE_CATEGORIES exports ─────

  describe("exports", () => {
    it("CATEGORY_LABELS returns strings for all categories", () => {
      const categories: CommandCategory[] = ["action", "navigation", "data", "setting", "entry", "help"];
      for (const cat of categories) {
        expect(typeof CATEGORY_LABELS[cat]()).toBe("string");
      }
    });

    it("PALETTE_CATEGORIES is an ordered array", () => {
      expect(PALETTE_CATEGORIES).toEqual(["action", "data", "setting", "help"]);
    });
  });
});
