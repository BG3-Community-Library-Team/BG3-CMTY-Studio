/**
 * Tests for editor settings in settingsStore:
 * - Fields exist with correct defaults
 * - Values can be mutated
 * - resetEditorSettings restores defaults
 */
import { describe, it, expect, beforeEach } from "vitest";

const { settingsStore } = await import("../lib/stores/settingsStore.svelte.js");

describe("Editor Settings", () => {
  beforeEach(() => {
    // Reset editor settings to defaults before each test
    settingsStore.resetEditorSettings();
  });

  // ── Default values ─────────────────────────────────────────

  it("has correct default editorFontSize", () => {
    expect(settingsStore.editorFontSize).toBe(12);
  });

  it("has correct default editorFontFamily", () => {
    expect(settingsStore.editorFontFamily).toBe("Cascadia Code, Fira Code, JetBrains Mono, monospace");
  });

  it("has correct default editorTabSize", () => {
    expect(settingsStore.editorTabSize).toBe(2);
  });

  it("has correct default editorWordWrap", () => {
    expect(settingsStore.editorWordWrap).toBe(false);
  });

  it("has correct default editorLineNumbers", () => {
    expect(settingsStore.editorLineNumbers).toBe(true);
  });

  it("has correct default editorBracketMatching", () => {
    expect(settingsStore.editorBracketMatching).toBe(true);
  });

  it("has correct default editorActiveLineHighlight", () => {
    expect(settingsStore.editorActiveLineHighlight).toBe(true);
  });

  it("has correct default editorMinimap", () => {
    expect(settingsStore.editorMinimap).toBe(false);
  });

  it("has correct default editorLintDelay", () => {
    expect(settingsStore.editorLintDelay).toBe(500);
  });

  // ── Mutation ───────────────────────────────────────────────

  it("allows setting editorFontSize", () => {
    settingsStore.editorFontSize = 16;
    expect(settingsStore.editorFontSize).toBe(16);
  });

  it("allows setting editorTabSize", () => {
    settingsStore.editorTabSize = 4;
    expect(settingsStore.editorTabSize).toBe(4);
  });

  it("allows toggling editorWordWrap", () => {
    settingsStore.editorWordWrap = true;
    expect(settingsStore.editorWordWrap).toBe(true);
  });

  it("allows toggling editorLineNumbers", () => {
    settingsStore.editorLineNumbers = false;
    expect(settingsStore.editorLineNumbers).toBe(false);
  });

  it("allows setting editorFontFamily", () => {
    settingsStore.editorFontFamily = "monospace";
    expect(settingsStore.editorFontFamily).toBe("monospace");
  });

  it("allows toggling editorBracketMatching", () => {
    settingsStore.editorBracketMatching = false;
    expect(settingsStore.editorBracketMatching).toBe(false);
  });

  it("allows setting editorLintDelay", () => {
    settingsStore.editorLintDelay = 1000;
    expect(settingsStore.editorLintDelay).toBe(1000);
  });

  // ── Reset ──────────────────────────────────────────────────

  it("resetEditorSettings restores all defaults", () => {
    // Mutate all editor settings
    settingsStore.editorFontSize = 20;
    settingsStore.editorFontFamily = "Arial";
    settingsStore.editorTabSize = 8;
    settingsStore.editorWordWrap = true;
    settingsStore.editorLineNumbers = false;
    settingsStore.editorBracketMatching = false;
    settingsStore.editorActiveLineHighlight = false;
    settingsStore.editorMinimap = true;
    settingsStore.editorLintDelay = 2000;

    settingsStore.resetEditorSettings();

    expect(settingsStore.editorFontSize).toBe(12);
    expect(settingsStore.editorFontFamily).toBe("Cascadia Code, Fira Code, JetBrains Mono, monospace");
    expect(settingsStore.editorTabSize).toBe(2);
    expect(settingsStore.editorWordWrap).toBe(false);
    expect(settingsStore.editorLineNumbers).toBe(true);
    expect(settingsStore.editorBracketMatching).toBe(true);
    expect(settingsStore.editorActiveLineHighlight).toBe(true);
    expect(settingsStore.editorMinimap).toBe(false);
    expect(settingsStore.editorLintDelay).toBe(500);
  });

  it("resetEditorSettings does not affect non-editor settings", () => {
    settingsStore.zoomLevel = 150;
    settingsStore.resetEditorSettings();
    expect(settingsStore.zoomLevel).toBe(150);
    // Clean up
    settingsStore.zoomLevel = 100;
  });
});
