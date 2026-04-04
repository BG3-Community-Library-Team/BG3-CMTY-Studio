import { describe, it, expect, vi } from "vitest";

// Mock settingsStore before importing comboboxOptions
vi.mock("../lib/stores/settingsStore.svelte.js", () => ({
  settingsStore: {
    showModNamePrefix: true,
    showComboboxNames: true,
  },
}));

import { resolveDisplayName, sortComboboxOptions, type ComboboxOption } from "../lib/utils/comboboxOptions.js";

describe("resolveDisplayName", () => {
  it("returns 'Unnamed' for empty string", () => {
    expect(resolveDisplayName("")).toBe("Unnamed");
  });

  it("returns raw string for non-loca sections", () => {
    expect(resolveDisplayName("MySpell", "Spells")).toBe("MySpell");
  });

  it("attempts loca lookup for Backgrounds section with handle-format string", () => {
    const lookup = vi.fn().mockReturnValue("Resolved Name");
    const result = resolveDisplayName("h1234g5678", "Backgrounds", lookup);
    expect(lookup).toHaveBeenCalledWith("h1234g5678");
    expect(result).toBe("Resolved Name");
  });

  it("returns raw handle when lookup fails", () => {
    const lookup = vi.fn().mockReturnValue(undefined);
    const result = resolveDisplayName("h1234g5678", "Backgrounds", lookup);
    expect(result).toBe("h1234g5678");
  });

  it("detects loca handles even outside LOCA_SECTIONS", () => {
    const lookup = vi.fn().mockReturnValue("Localized");
    const result = resolveDisplayName("habcdefg12345", "Feats", lookup);
    expect(result).toBe("Localized");
  });
});

describe("sortComboboxOptions", () => {
  it("sorts entries alphabetically by display name", () => {
    const opts: ComboboxOption[] = [
      { value: "a", label: "A", _source: "Vanilla", _displayName: "Bravo" },
      { value: "b", label: "B", _source: "MyMod", _displayName: "Alpha" },
    ];
    const sorted = sortComboboxOptions(opts);
    expect(sorted[0]._displayName).toBe("Alpha");
    expect(sorted[1]._displayName).toBe("Bravo");
  });

  it("pushes 'Unnamed' entries to the end", () => {
    const opts: ComboboxOption[] = [
      { value: "a", label: "A", _displayName: "Unnamed" },
      { value: "b", label: "B", _displayName: "Charlie" },
    ];
    const sorted = sortComboboxOptions(opts);
    expect(sorted[0]._displayName).toBe("Charlie");
    expect(sorted[1]._displayName).toBe("Unnamed");
  });

  it("treats UUID-like display names as unnamed", () => {
    const opts: ComboboxOption[] = [
      { value: "a", label: "A", _displayName: "12345678-aaaa-bbbb-cccc-dddddddddddd" },
      { value: "b", label: "B", _displayName: "Named Entry" },
    ];
    const sorted = sortComboboxOptions(opts);
    expect(sorted[0]._displayName).toBe("Named Entry");
  });

  it("stable-sorts equal categories by label", () => {
    const opts: ComboboxOption[] = [
      { value: "b", label: "Bravo", _source: "Mod", _displayName: "Bravo" },
      { value: "a", label: "Alpha", _source: "Mod", _displayName: "Alpha" },
    ];
    const sorted = sortComboboxOptions(opts);
    expect(sorted[0].label).toBe("Alpha");
    expect(sorted[1].label).toBe("Bravo");
  });

  it("handles empty array", () => {
    expect(sortComboboxOptions([])).toEqual([]);
  });
});
