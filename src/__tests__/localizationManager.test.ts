import { describe, it, expect, beforeEach } from "vitest";
import {
  generateContentHandle,
  isContentHandle,
  parseHandleVersion,
  autoLocalize,
  type AutoLocaEntry,
} from "../lib/utils/localizationManager.js";

// ---------------------------------------------------------------------------
// generateContentHandle
// ---------------------------------------------------------------------------
describe("generateContentHandle", () => {
  it("matches BG3 pattern h{8hex}g{4hex}g{4hex}g{4hex}g{12hex}", () => {
    const handle = generateContentHandle();
    expect(handle).toMatch(
      /^h[0-9a-f]{8}g[0-9a-f]{4}g[0-9a-f]{4}g[0-9a-f]{4}g[0-9a-f]{12}$/i,
    );
  });

  it("generates unique handles on repeated calls", () => {
    const handles = new Set<string>();
    for (let i = 0; i < 50; i++) handles.add(generateContentHandle());
    expect(handles.size).toBe(50);
  });

  it("uses only hex characters (plus h/g separators)", () => {
    const handle = generateContentHandle();
    // Remove the structural characters and check the rest is hex
    const hexOnly = handle.replace(/^h/, "").replace(/g/g, "");
    expect(hexOnly).toMatch(/^[0-9a-f]+$/i);
    expect(hexOnly.length).toBe(32);
  });
});

// ---------------------------------------------------------------------------
// isContentHandle
// ---------------------------------------------------------------------------
describe("isContentHandle", () => {
  it("returns true for valid handle", () => {
    const handle = generateContentHandle();
    expect(isContentHandle(handle)).toBe(true);
  });

  it("returns false for plain text", () => {
    expect(isContentHandle("Hello World")).toBe(false);
    expect(isContentHandle("")).toBe(false);
  });

  it("returns false for handle;version format (full string)", () => {
    const handle = generateContentHandle();
    expect(isContentHandle(`${handle};1`)).toBe(false);
  });

  it("returns false for partial handle", () => {
    expect(isContentHandle("h12345678g")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseHandleVersion
// ---------------------------------------------------------------------------
describe("parseHandleVersion", () => {
  it("parses handle;1 correctly", () => {
    const handle = generateContentHandle();
    const result = parseHandleVersion(`${handle};1`);
    expect(result).not.toBeNull();
    expect(result!.handle).toBe(handle);
    expect(result!.version).toBe(1);
  });

  it("parses multi-digit version", () => {
    const handle = generateContentHandle();
    const result = parseHandleVersion(`${handle};42`);
    expect(result).not.toBeNull();
    expect(result!.version).toBe(42);
  });

  it("returns null for plain text", () => {
    expect(parseHandleVersion("Hello World")).toBeNull();
  });

  it("returns null for handle without version", () => {
    const handle = generateContentHandle();
    expect(parseHandleVersion(handle)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseHandleVersion("")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// autoLocalize
// ---------------------------------------------------------------------------
describe("autoLocalize", () => {
  let map: Map<string, AutoLocaEntry>;

  beforeEach(() => {
    map = new Map();
  });

  it("plain text → generates new handle, stores in map", () => {
    const result = autoLocalize("My Race Name", "", map);
    expect(result.handle).toBeTruthy();
    expect(isContentHandle(result.handle)).toBe(true);
    expect(result.fieldValue).toBe(`${result.handle};1`);
    expect(map.get(result.handle)).toEqual({ text: "My Race Name", version: 1 });
  });

  it("subsequent edit with existing handle → updates text, keeps handle", () => {
    // First call
    const first = autoLocalize("Original", "", map);
    // Second call with the existing field value
    const second = autoLocalize("Updated", first.fieldValue, map);
    expect(second.handle).toBe(first.handle);
    expect(second.fieldValue).toBe(first.fieldValue);
    expect(map.get(first.handle)!.text).toBe("Updated");
  });

  it("new field (no current value) → generates new handle", () => {
    const result = autoLocalize("New Entry", "", map);
    expect(map.size).toBe(1);
    expect(result.handle).toBeTruthy();
  });

  it("current value is foreign handle (not in autoLocaMap) → generates new handle", () => {
    const foreignHandle = generateContentHandle();
    const result = autoLocalize("New Text", `${foreignHandle};1`, map);
    expect(result.handle).not.toBe(foreignHandle);
    expect(map.size).toBe(1);
    expect(map.has(result.handle)).toBe(true);
  });

  it("multiple fields get unique handles", () => {
    const r1 = autoLocalize("Field One", "", map);
    const r2 = autoLocalize("Field Two", "", map);
    expect(r1.handle).not.toBe(r2.handle);
    expect(map.size).toBe(2);
  });

  it("preserves version when updating existing entry", () => {
    // Simulate a handle;3 field value
    const handle = generateContentHandle();
    map.set(handle, { text: "Old", version: 3 });
    const result = autoLocalize("New Text", `${handle};3`, map);
    expect(result.handle).toBe(handle);
    expect(map.get(handle)!.text).toBe("New Text");
    expect(map.get(handle)!.version).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Persistence round-trip simulation
// ---------------------------------------------------------------------------
describe("autoLocaEntries persistence", () => {
  it("round-trips through serialize/deserialize", () => {
    const map = new Map<string, AutoLocaEntry>();
    autoLocalize("Race Name", "", map);
    autoLocalize("Race Description", "", map);

    // Serialize (same pattern as configStore.persistProject)
    const serialized = Array.from(map.entries()).map(([handle, { text, version }]) => ({
      handle,
      text,
      version,
    }));
    const json = JSON.stringify(serialized);

    // Deserialize
    const parsed = JSON.parse(json);
    const restored = new Map<string, AutoLocaEntry>();
    for (const entry of parsed) {
      restored.set(entry.handle, { text: entry.text, version: entry.version });
    }

    expect(restored.size).toBe(2);
    for (const [handle, entry] of map) {
      expect(restored.get(handle)).toEqual(entry);
    }
  });
});
