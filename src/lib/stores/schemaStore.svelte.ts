/**
 * Schema store — loads and caches LSX node schemas from DB metadata.
 *
 * Schemas describe what attributes and children each LSX node_id type has,
 * enabling generic form rendering for sections without hardcoded SECTION_CAPS.
 */

import { dumpDbSchemas, type NodeSchema } from "../utils/tauri.js";

/** Map of node_id → NodeSchema for O(1) lookup. */
let schemasMap = $state<Map<string, NodeSchema>>(new Map());

/** Map of section name → NodeSchema[] for section-level lookup. */
let sectionMap = $state<Map<string, NodeSchema[]>>(new Map());

/** Whether schemas have been loaded. */
let loaded = $state(false);

/** Whether a load is in progress. */
let loading = $state(false);

export const schemaStore = {
  get schemas(): Map<string, NodeSchema> {
    return schemasMap;
  },

  get loaded(): boolean {
    return loaded;
  },

  get loading(): boolean {
    return loading;
  },

  /** Get schema for a specific node_id. */
  getByNodeId(nodeId: string): NodeSchema | undefined {
    return schemasMap.get(nodeId);
  },

  /** Get all schemas for a section (e.g. "Gods" → [NodeSchema for "God"]). */
  getBySection(section: string): NodeSchema[] {
    return sectionMap.get(section) ?? [];
  },

  /** Iterate over all (section, schemas[]) pairs. */
  sectionEntries(): IterableIterator<[string, NodeSchema[]]> {
    return sectionMap.entries();
  },

  /** Load schemas from vanilla data. No-op if already loaded. */
  async load(): Promise<void> {
    if (loaded || loading) return;
    loading = true;
    try {
      const schemas = await dumpDbSchemas();
      const byNodeId = new Map<string, NodeSchema>();
      const bySection = new Map<string, NodeSchema[]>();
      for (const schema of schemas) {
        byNodeId.set(schema.node_id, schema);
        const list = bySection.get(schema.section) ?? [];
        list.push(schema);
        bySection.set(schema.section, list);
      }
      schemasMap = byNodeId;
      sectionMap = bySection;
    } catch (e) {
      console.warn("Failed to load schemas:", e);
    } finally {
      loaded = true;
      loading = false;
    }
  },

  /** Force reload schemas (e.g. after infer-schemas run). */
  async reload(): Promise<void> {
    loaded = false;
    loading = false;
    await this.load();
  },

  /** Reset store state. */
  reset(): void {
    schemasMap = new Map();
    sectionMap = new Map();
    loaded = false;
    loading = false;
  },
};
