/**
 * Tests for the project-level settings store.
 * Covers three-tier resolution (Project > Global > Default), set/clear/isSetAtProject.
 */
import { describe, it, expect, beforeEach } from "vitest";

const { projectSettingsStore } = await import("../lib/stores/projectSettingsStore.svelte.js");

describe("ProjectSettingsStore", () => {
  beforeEach(() => {
    projectSettingsStore.unload();
  });

  // ── Happy Paths ─────────────────────────────────────────────

  describe("happy paths", () => {
    it("getEffective returns project value when set", () => {
      projectSettingsStore.overrides = { enableMcmSupport: true };
      expect(projectSettingsStore.getEffective("enableMcmSupport")).toBe(true);
    });

    it("getEffective returns default when no project or global override", () => {
      // enableCfIntegration defaults to true per PROJECT_DEFAULTS
      expect(projectSettingsStore.getEffective("enableCfIntegration")).toBe(true);
      // enableMcmSupport defaults to false
      expect(projectSettingsStore.getEffective("enableMcmSupport")).toBe(false);
    });

    it("set() stores value and getEffective reflects it", () => {
      projectSettingsStore.set("mcmSchemaUrl", "https://example.com/schema");
      expect(projectSettingsStore.getEffective("mcmSchemaUrl")).toBe("https://example.com/schema");
    });

    it("clear() removes project override, falls back to default", () => {
      projectSettingsStore.set("enableMcmSupport", true);
      expect(projectSettingsStore.getEffective("enableMcmSupport")).toBe(true);

      projectSettingsStore.clear("enableMcmSupport");
      expect(projectSettingsStore.getEffective("enableMcmSupport")).toBe(false); // default
    });

    it("isSetAtProject() returns true after set, false after clear", () => {
      expect(projectSettingsStore.isSetAtProject("gitUserName")).toBe(false);

      projectSettingsStore.set("gitUserName", "Test User");
      expect(projectSettingsStore.isSetAtProject("gitUserName")).toBe(true);

      projectSettingsStore.clear("gitUserName");
      expect(projectSettingsStore.isSetAtProject("gitUserName")).toBe(false);
    });

    it("get() returns the raw project override value", () => {
      expect(projectSettingsStore.get("gitUserEmail")).toBeUndefined();
      projectSettingsStore.set("gitUserEmail", "test@example.com");
      expect(projectSettingsStore.get("gitUserEmail")).toBe("test@example.com");
    });

    it("getEffective returns default for string keys when empty", () => {
      // mcmSchemaUrl may have a non-empty global default from settingsStore
      expect(typeof projectSettingsStore.getEffective("mcmSchemaUrl")).toBe("string");
      expect(typeof projectSettingsStore.getEffective("gitUserName")).toBe("string");
      expect(typeof projectSettingsStore.getEffective("gitUserEmail")).toBe("string");
    });
  });

  // ── Unhappy Paths ───────────────────────────────────────────

  describe("unhappy paths", () => {
    it("getEffective with no project loaded returns default", () => {
      projectSettingsStore.unload();
      expect(projectSettingsStore.getEffective("enableMcmSupport")).toBe(false);
      expect(projectSettingsStore.getEffective("enableCfIntegration")).toBe(true);
    });

    it("set on unloaded store is safe", () => {
      projectSettingsStore.unload();
      // Should not throw
      projectSettingsStore.set("gitUserName", "value");
      expect(projectSettingsStore.getEffective("gitUserName")).toBe("value");
    });

    it("clear on unset key is safe (no-op)", () => {
      projectSettingsStore.clear("mcmSchemaUrl");
      // Should not throw, should still return default (may be non-empty global default)
      expect(typeof projectSettingsStore.getEffective("mcmSchemaUrl")).toBe("string");
    });

    it("unload clears all overrides and resets loaded state", () => {
      projectSettingsStore.set("enableMcmSupport", true);
      projectSettingsStore.loaded = true;
      projectSettingsStore.unload();
      expect(projectSettingsStore.loaded).toBe(false);
      expect(projectSettingsStore.overrides).toEqual({});
    });
  });

  // ── Semi-happy Paths ────────────────────────────────────────

  describe("semi-happy paths", () => {
    it("partial settings — some keys set, others not", () => {
      projectSettingsStore.set("enableMcmSupport", true);
      projectSettingsStore.set("gitUserName", "Modder");

      // Set keys return project values
      expect(projectSettingsStore.getEffective("enableMcmSupport")).toBe(true);
      expect(projectSettingsStore.getEffective("gitUserName")).toBe("Modder");

      // Unset keys return defaults
      expect(projectSettingsStore.getEffective("enableCfIntegration")).toBe(true); // default
      expect(projectSettingsStore.getEffective("gitUserEmail")).toBe(""); // default
      // mcmSchemaUrl may have a non-empty global default from settingsStore
      expect(typeof projectSettingsStore.getEffective("mcmSchemaUrl")).toBe("string");
    });

    it("set() replaces existing value", () => {
      projectSettingsStore.set("gitUserName", "First");
      projectSettingsStore.set("gitUserName", "Second");
      expect(projectSettingsStore.getEffective("gitUserName")).toBe("Second");
    });

    it("isSetAtProject for multiple keys", () => {
      projectSettingsStore.set("enableMcmSupport", true);
      projectSettingsStore.set("gitUserName", "User");

      expect(projectSettingsStore.isSetAtProject("enableMcmSupport")).toBe(true);
      expect(projectSettingsStore.isSetAtProject("gitUserName")).toBe(true);
      expect(projectSettingsStore.isSetAtProject("gitUserEmail")).toBe(false);
      expect(projectSettingsStore.isSetAtProject("mcmSchemaUrl")).toBe(false);
    });

    it("scriptEnginePreferences defaults to empty object", () => {
      const val = projectSettingsStore.getEffective("scriptEnginePreferences");
      expect(val).toEqual({});
    });
  });
});
