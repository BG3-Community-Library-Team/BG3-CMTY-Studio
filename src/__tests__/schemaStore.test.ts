/**
 * schemaStore tests — covers load/reload lifecycle, cache hits/misses,
 * section lookups, error handling, reset, and concurrent load guards.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the tauri lsx-export module so no real IPC calls happen
const mockDumpDbSchemas = vi.fn();
vi.mock("../lib/tauri/lsx-export.js", () => ({
  dumpDbSchemas: (...args: any[]) => mockDumpDbSchemas(...args),
  inferSchemas: vi.fn().mockResolvedValue([]),
}));

// Also mock the barrel re-export so schemaStore's import resolves
vi.mock("../lib/utils/tauri.js", async (importOriginal) => {
  const orig = await importOriginal() as Record<string, unknown>;
  return {
    ...orig,
    dumpDbSchemas: (...args: any[]) => mockDumpDbSchemas(...args),
  };
});

const { schemaStore } = await import("../lib/stores/schemaStore.svelte.js");

/** Helper to build a minimal NodeSchema-like object. */
function makeSchema(nodeId: string, section: string, attrCount = 0) {
  return {
    node_id: nodeId,
    section,
    sample_count: 1,
    attributes: Array.from({ length: attrCount }, (_, i) => ({
      name: `attr_${i}`,
      attr_type: "FixedString",
      frequency: 1.0,
    })),
    children: [],
  };
}

describe("schemaStore", () => {
  beforeEach(() => {
    schemaStore.reset();
    mockDumpDbSchemas.mockReset();
  });

  // ── Initial state ─────────────────────────────────────────────────

  describe("initial state", () => {
    it("starts not loaded and not loading", () => {
      expect(schemaStore.loaded).toBe(false);
      expect(schemaStore.loading).toBe(false);
    });

    it("has empty schemas map", () => {
      expect(schemaStore.schemas.size).toBe(0);
    });
  });

  // ── load() ────────────────────────────────────────────────────────

  describe("load", () => {
    it("loads schemas and populates both maps", async () => {
      mockDumpDbSchemas.mockResolvedValueOnce([
        makeSchema("God", "Gods"),
        makeSchema("Race", "Races"),
        makeSchema("SubRace", "Races"),
      ]);

      await schemaStore.load();

      expect(schemaStore.loaded).toBe(true);
      expect(schemaStore.loading).toBe(false);
      expect(schemaStore.schemas.size).toBe(3);
    });

    it("is a no-op if already loaded", async () => {
      mockDumpDbSchemas.mockResolvedValueOnce([makeSchema("God", "Gods")]);
      await schemaStore.load();
      mockDumpDbSchemas.mockClear();

      await schemaStore.load();
      expect(mockDumpDbSchemas).not.toHaveBeenCalled();
    });

    it("is a no-op if currently loading", async () => {
      // Hold the first call in a pending state
      let resolveFirst!: (v: any) => void;
      mockDumpDbSchemas.mockReturnValueOnce(new Promise(r => { resolveFirst = r; }));

      const p1 = schemaStore.load();
      expect(schemaStore.loading).toBe(true);

      // Second call should bail out early
      mockDumpDbSchemas.mockResolvedValueOnce([makeSchema("X", "Y")]);
      const p2 = schemaStore.load();

      resolveFirst([makeSchema("God", "Gods")]);
      await Promise.all([p1, p2]);

      // Only one call should have been made
      expect(mockDumpDbSchemas).toHaveBeenCalledTimes(1);
      expect(schemaStore.schemas.size).toBe(1);
    });

    it("sets loaded=true even on error", async () => {
      mockDumpDbSchemas.mockRejectedValueOnce(new Error("IPC error"));

      await schemaStore.load();

      expect(schemaStore.loaded).toBe(true);
      expect(schemaStore.loading).toBe(false);
      // Maps remain empty on failure
      expect(schemaStore.schemas.size).toBe(0);
    });
  });

  // ── getByNodeId ───────────────────────────────────────────────────

  describe("getByNodeId", () => {
    it("returns schema for a known node_id", async () => {
      mockDumpDbSchemas.mockResolvedValueOnce([makeSchema("God", "Gods", 3)]);
      await schemaStore.load();

      const schema = schemaStore.getByNodeId("God");
      expect(schema).toBeDefined();
      expect(schema!.node_id).toBe("God");
      expect(schema!.attributes).toHaveLength(3);
    });

    it("returns undefined for unknown node_id", async () => {
      mockDumpDbSchemas.mockResolvedValueOnce([makeSchema("God", "Gods")]);
      await schemaStore.load();

      expect(schemaStore.getByNodeId("NonExistent")).toBeUndefined();
    });

    it("returns undefined when schemas not loaded", () => {
      expect(schemaStore.getByNodeId("God")).toBeUndefined();
    });
  });

  // ── getBySection ──────────────────────────────────────────────────

  describe("getBySection", () => {
    it("returns all schemas for a section", async () => {
      mockDumpDbSchemas.mockResolvedValueOnce([
        makeSchema("Race", "Races"),
        makeSchema("SubRace", "Races"),
        makeSchema("God", "Gods"),
      ]);
      await schemaStore.load();

      const raceSchemas = schemaStore.getBySection("Races");
      expect(raceSchemas).toHaveLength(2);
      expect(raceSchemas.map(s => s.node_id).sort()).toEqual(["Race", "SubRace"]);
    });

    it("returns empty array for unknown section", async () => {
      mockDumpDbSchemas.mockResolvedValueOnce([makeSchema("God", "Gods")]);
      await schemaStore.load();

      expect(schemaStore.getBySection("NonExistentSection")).toEqual([]);
    });

    it("returns empty array when schemas not loaded", () => {
      expect(schemaStore.getBySection("Races")).toEqual([]);
    });
  });

  // ── sectionEntries ────────────────────────────────────────────────

  describe("sectionEntries", () => {
    it("iterates all section→schemas pairs", async () => {
      mockDumpDbSchemas.mockResolvedValueOnce([
        makeSchema("Race", "Races"),
        makeSchema("God", "Gods"),
        makeSchema("SubRace", "Races"),
      ]);
      await schemaStore.load();

      const entries = [...schemaStore.sectionEntries()];
      expect(entries).toHaveLength(2);
      const sections = entries.map(([s]) => s).sort();
      expect(sections).toEqual(["Gods", "Races"]);
    });

    it("returns empty iterator when not loaded", () => {
      expect([...schemaStore.sectionEntries()]).toHaveLength(0);
    });
  });

  // ── reload ────────────────────────────────────────────────────────

  describe("reload", () => {
    it("reloads schemas even if already loaded", async () => {
      mockDumpDbSchemas.mockResolvedValueOnce([makeSchema("God", "Gods")]);
      await schemaStore.load();
      expect(schemaStore.schemas.size).toBe(1);

      mockDumpDbSchemas.mockResolvedValueOnce([
        makeSchema("God", "Gods"),
        makeSchema("Race", "Races"),
      ]);
      await schemaStore.reload();
      expect(schemaStore.schemas.size).toBe(2);
      expect(mockDumpDbSchemas).toHaveBeenCalledTimes(2);
    });
  });

  // ── reset ─────────────────────────────────────────────────────────

  describe("reset", () => {
    it("clears all state", async () => {
      mockDumpDbSchemas.mockResolvedValueOnce([makeSchema("God", "Gods")]);
      await schemaStore.load();

      schemaStore.reset();
      expect(schemaStore.loaded).toBe(false);
      expect(schemaStore.loading).toBe(false);
      expect(schemaStore.schemas.size).toBe(0);
      expect(schemaStore.getByNodeId("God")).toBeUndefined();
      expect(schemaStore.getBySection("Gods")).toEqual([]);
    });

    it("allows re-loading after reset", async () => {
      mockDumpDbSchemas.mockResolvedValueOnce([makeSchema("God", "Gods")]);
      await schemaStore.load();
      schemaStore.reset();

      mockDumpDbSchemas.mockResolvedValueOnce([makeSchema("Race", "Races")]);
      await schemaStore.load();

      expect(schemaStore.schemas.size).toBe(1);
      expect(schemaStore.getByNodeId("Race")).toBeDefined();
      expect(schemaStore.getByNodeId("God")).toBeUndefined();
    });
  });

  // ── Edge: empty schema array from IPC ─────────────────────────────

  describe("edge cases", () => {
    it("handles empty response from dumpDbSchemas", async () => {
      mockDumpDbSchemas.mockResolvedValueOnce([]);
      await schemaStore.load();

      expect(schemaStore.loaded).toBe(true);
      expect(schemaStore.schemas.size).toBe(0);
    });

    it("handles single schema with no attributes or children", async () => {
      mockDumpDbSchemas.mockResolvedValueOnce([{
        node_id: "Empty",
        section: "EmptySection",
        sample_count: 0,
        attributes: [],
        children: [],
      }]);
      await schemaStore.load();

      const schema = schemaStore.getByNodeId("Empty");
      expect(schema).toBeDefined();
      expect(schema!.attributes).toHaveLength(0);
      expect(schema!.children).toHaveLength(0);
    });
  });
});
