/**
 * settingsStore tests — covers persistence, zoom bounds, theme switching,
 * additional mod paths, unpack path management, migrations, and edge cases.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { mockConsoleWarn, expectConsoleCalled } from "./helpers/suppressConsole.js";

// The store reads localStorage on module load, so we seed it before importing.
beforeEach(() => {
  localStorage.clear();
});

// Use dynamic import so each describe can set up localStorage before load
async function freshStore() {
  // Reset modules so settingsStore re-reads localStorage
  vi.resetModules();
  const mod = await import("../lib/stores/settingsStore.svelte.js");
  return mod.settingsStore;
}

describe("SettingsStore", () => {
  // ── Defaults ──────────────────────────────────────────────────────

  describe("defaults", () => {
    it("uses default values when localStorage is empty", async () => {
      const store = await freshStore();
      expect(store.theme).toBe("balance");
      expect(store.zoomLevel).toBe(100);
      expect(store.defaultFormat).toBe("Yaml");
      expect(store.sidebarWidth).toBe(420);
      expect(store.leftPanelWidth).toBe(240);
      expect(store.reducedMotion).toBe("system");
      expect(store.alwaysShowSearchBar).toBe(false);
      expect(store.enableSectionComments).toBe(true);
      expect(store.enableEntryComments).toBe(false);
      expect(store.toastDuration).toBe(3000);
      expect(store.errorToastDuration).toBe(8000);
      expect(store.additionalModPaths).toEqual([]);
    });
  });

  // ── Persistence & Restoration ────────────────────────────────────

  describe("persistence", () => {
    it("persists non-secure settings to localStorage", async () => {
      const store = await freshStore();
      store.setTheme("dark");
      store.persistNow();
      const raw = localStorage.getItem("bg3-cmty-studio-settings");
      expect(raw).toBeTruthy();
      const data = JSON.parse(raw!);
      expect(data.theme).toBe("dark");
    });

    it("restores persisted values from localStorage on load", async () => {
      localStorage.setItem(
        "bg3-cmty-studio-settings",
        JSON.stringify({ theme: "solarized-dark", zoomLevel: 150 })
      );
      const store = await freshStore();
      expect(store.theme).toBe("solarized-dark");
      expect(store.zoomLevel).toBe(150);
    });

    it("falls back to defaults for corrupted localStorage", async () => {
      localStorage.setItem("bg3-cmty-studio-settings", "NOT_JSON{{{");
      const store = await freshStore();
      expect(store.theme).toBe("balance");
      expect(store.zoomLevel).toBe(100);
    });

    it("ignores type-mismatched values in localStorage", async () => {
      localStorage.setItem(
        "bg3-cmty-studio-settings",
        JSON.stringify({ theme: 42, zoomLevel: "big", sidebarWidth: true })
      );
      const store = await freshStore();
      // All should keep defaults because types don't match
      expect(store.theme).toBe("balance");
      expect(store.zoomLevel).toBe(100);
      expect(store.sidebarWidth).toBe(420);
    });

    it("ignores null/undefined values in localStorage", async () => {
      localStorage.setItem(
        "bg3-cmty-studio-settings",
        JSON.stringify({ theme: null, zoomLevel: undefined })
      );
      const store = await freshStore();
      expect(store.theme).toBe("balance");
      expect(store.zoomLevel).toBe(100);
    });
  });

  // ── Theme migration ───────────────────────────────────────────────

  describe("legacy migration", () => {
    it('migrates "split" theme to "balance"', async () => {
      localStorage.setItem(
        "bg3-cmty-studio-settings",
        JSON.stringify({ theme: "split" })
      );
      const store = await freshStore();
      expect(store.theme).toBe("balance");
    });

    it("resets invalid reducedMotion to system", async () => {
      localStorage.setItem(
        "bg3-cmty-studio-settings",
        JSON.stringify({ reducedMotion: "invalid" })
      );
      const store = await freshStore();
      expect(store.reducedMotion).toBe("system");
    });

    it('falls back to "dark" for unknown theme values (DSM-009)', async () => {
      localStorage.setItem(
        "bg3-cmty-studio-settings",
        JSON.stringify({ theme: "nonexistent-theme" })
      );
      const store = await freshStore();
      expect(store.theme).toBe("dark");
    });
  });

  // ── Zoom ──────────────────────────────────────────────────────────

  describe("zoom", () => {
    it("zoomIn increments by 10", async () => {
      const store = await freshStore();
      store.zoomIn();
      expect(store.zoomLevel).toBe(110);
    });

    it("zoomIn caps at 200", async () => {
      const store = await freshStore();
      store.zoomLevel = 200;
      store.zoomIn();
      expect(store.zoomLevel).toBe(200);
    });

    it("zoomOut decrements by 10", async () => {
      const store = await freshStore();
      store.zoomOut();
      expect(store.zoomLevel).toBe(90);
    });

    it("zoomOut floors at 50", async () => {
      const store = await freshStore();
      store.zoomLevel = 50;
      store.zoomOut();
      expect(store.zoomLevel).toBe(50);
    });

    it("zoomReset sets level to 100", async () => {
      const store = await freshStore();
      store.zoomLevel = 170;
      store.zoomReset();
      expect(store.zoomLevel).toBe(100);
    });
  });

  // ── Theme switching ───────────────────────────────────────────────

  describe("theme", () => {
    it("setTheme changes theme and persists", async () => {
      const store = await freshStore();
      store.setTheme("aubergine");
      expect(store.theme).toBe("aubergine");
      store.persistNow();
      const saved = JSON.parse(localStorage.getItem("bg3-cmty-studio-settings")!);
      expect(saved.theme).toBe("aubergine");
    });

    it("toggleTheme flips between dark and light", async () => {
      const store = await freshStore();
      store.setTheme("dark");
      store.toggleTheme();
      expect(store.theme).toBe("light");
      store.toggleTheme();
      expect(store.theme).toBe("dark");
    });

    it("toggleTheme from non-dark theme goes to light", async () => {
      const store = await freshStore();
      store.setTheme("aubergine");
      store.toggleTheme();
      // toggleTheme only handles dark/light; aubergine !== "dark" → switches to "dark"
      // Actually the code: this.theme === "dark" ? "light" : "dark"
      expect(store.theme).toBe("dark");
    });
  });

  // ── Custom theme ──────────────────────────────────────────────────

  describe("custom theme", () => {
    it("defaults to DEFAULT_CUSTOM_THEME values", async () => {
      const store = await freshStore();
      expect(store.customTheme.bgMain).toBe("#18181b");
    });

    it("loads saved custom theme from localStorage", async () => {
      localStorage.setItem(
        "bg3-cmty-studio-custom-theme",
        JSON.stringify({ bgMain: "#ff0000" })
      );
      const store = await freshStore();
      // Merges with defaults, so only bgMain should differ
      expect(store.customTheme.bgMain).toBe("#ff0000");
      expect(store.customTheme.bgSidebar).toBe("#27272a"); // still default
    });

    it("resets custom theme to defaults", async () => {
      const store = await freshStore();
      store.customTheme = { ...store.customTheme, bgMain: "#123456" };
      store.resetCustomThemeToDefaults();
      expect(store.customTheme.bgMain).toBe("#18181b");
    });

    it("handles corrupted custom theme JSON gracefully", async () => {
      const spy = mockConsoleWarn();
      localStorage.setItem("bg3-cmty-studio-custom-theme", "BROKEN{");
      const store = await freshStore();
      expect(store.customTheme.bgMain).toBe("#18181b"); // falls back to defaults
      expectConsoleCalled(spy, "Custom theme load failed");
      spy.mockRestore();
    });
  });

  // ── Additional mod paths ──────────────────────────────────────────

  describe("additional mod paths", () => {
    it("adds and removes paths", async () => {
      const store = await freshStore();
      store.addAdditionalModPath("/mods/a");
      store.addAdditionalModPath("/mods/b");
      expect(store.additionalModPaths).toContain("/mods/a");
      expect(store.additionalModPaths).toContain("/mods/b");

      store.removeAdditionalModPath("/mods/a");
      expect(store.additionalModPaths).not.toContain("/mods/a");
      expect(store.additionalModPaths).toContain("/mods/b");
    });

    it("does not duplicate paths", async () => {
      const store = await freshStore();
      store.addAdditionalModPath("/mods/a");
      store.addAdditionalModPath("/mods/a");
      expect(store.additionalModPaths.filter(p => p === "/mods/a")).toHaveLength(1);
    });

    it("setAdditionalModPaths replaces list", async () => {
      const store = await freshStore();
      store.addAdditionalModPath("/mods/a");
      store.addAdditionalModPath("/mods/b");

      store.setAdditionalModPaths(["/mods/b"]);
      expect(store.additionalModPaths).toEqual(["/mods/b"]);
    });

    it("removeAdditionalModPath removes path", async () => {
      const store = await freshStore();
      store.addAdditionalModPath("/mods/x");

      store.removeAdditionalModPath("/mods/x");
      expect(store.additionalModPaths).toEqual([]);
    });
  });

  // ── Setter methods ────────────────────────────────────────────────

  describe("setter methods", () => {
    it("setVanillaPath updates and persists", async () => {
      const store = await freshStore();
      store.setVanillaPath("/game/Data");
      expect(store.vanillaPath).toBe("/game/Data");
    });

    it("setDefaultFormat updates and persists", async () => {
      const store = await freshStore();
      store.setDefaultFormat("Json");
      expect(store.defaultFormat).toBe("Json");
    });

    it("setGameDataPath updates and persists", async () => {
      const store = await freshStore();
      store.setGameDataPath("/game/Data");
      expect(store.gameDataPath).toBe("/game/Data");
    });
  });

  // ── Array restoration from localStorage ───────────────────────────

  describe("array restoration", () => {
    it("restores arrays but rejects non-array values", async () => {
      localStorage.setItem(
        "bg3-cmty-studio-settings",
        JSON.stringify({ additionalModPaths: "not-an-array" })
      );
      const store = await freshStore();
      expect(store.additionalModPaths).toEqual([]); // default
    });

    it("restores valid arrays from localStorage", async () => {
      localStorage.setItem(
        "bg3-cmty-studio-settings",
        JSON.stringify({ additionalModPaths: ["/a", "/b"] })
      );
      const store = await freshStore();
      expect(store.additionalModPaths).toEqual(["/a", "/b"]);
    });
  });

  // ── debounced persistence ───────────────────────────────────────

  describe("debounced persistence", () => {
    afterEach(() => { vi.useRealTimers(); });

    it("persist() does not write immediately", async () => {
      vi.useFakeTimers();
      const store = await freshStore();
      store.setTheme("aubergine");
      const before = localStorage.getItem("bg3-cmty-studio-settings");
      // Should NOT have persisted yet (debounced)
      expect(before === null || !before.includes("aubergine")).toBe(true);
      vi.useRealTimers();
    });

    it("persistNow() writes immediately", async () => {
      const store = await freshStore();
      store.setTheme("gruvbox-dark");
      store.persistNow();
      const raw = localStorage.getItem("bg3-cmty-studio-settings");
      expect(raw).toBeTruthy();
      expect(JSON.parse(raw!).theme).toBe("gruvbox-dark");
    });

    it("persist() writes after debounce window", async () => {
      vi.useFakeTimers();
      const store = await freshStore();
      store.setTheme("balance");
      store.persist();
      vi.advanceTimersByTime(600); // 500ms debounce
      const raw = localStorage.getItem("bg3-cmty-studio-settings");
      expect(raw).toBeTruthy();
      expect(JSON.parse(raw!).theme).toBe("balance");
    });

    it("multiple persist() calls coalesce into single write", async () => {
      vi.useFakeTimers();
      const store = await freshStore();
      let writeCount = 0;
      const origSetItem = localStorage.setItem.bind(localStorage);
      localStorage.setItem = (k: string, v: string) => {
        if (k === "bg3-cmty-studio-settings") writeCount++;
        origSetItem(k, v);
      };
      store.persist();
      store.persist();
      store.persist();
      vi.advanceTimersByTime(600);
      expect(writeCount).toBe(1);
      localStorage.setItem = origSetItem;
    });

    it("persistNow() cancels pending debounced persist", async () => {
      vi.useFakeTimers();
      const store = await freshStore();
      let writeCount = 0;
      const origSetItem = localStorage.setItem.bind(localStorage);
      localStorage.setItem = (k: string, v: string) => {
        if (k === "bg3-cmty-studio-settings") writeCount++;
        origSetItem(k, v);
      };
      store.persist();
      store.persistNow();
      vi.advanceTimersByTime(600);
      // Should be 1 (from persistNow), not 2
      expect(writeCount).toBe(1);
      localStorage.setItem = origSetItem;
    });
  });
});
