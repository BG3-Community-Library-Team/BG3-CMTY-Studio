import type { EntryRow, SourceType } from "../types/entryRow.js";
import type {
  StagingSectionSummary,
  StagingOperation,
  UndoReplayEntry,
} from "../tauri/staging.js";
import {
  stagingListSections,
  stagingQuerySection,
  stagingGetMeta,
  stagingSetMeta,
  stagingUpsertRow,
  stagingMarkDeleted,
  stagingUnmarkDeleted,
  stagingBatchWrite,
  stagingSnapshot,
  stagingUndo,
  stagingRedo,
  stagingGetRow,
  stagingCompactUndo,
} from "../tauri/staging.js";
import { getDbPaths, checkStagingIntegrity, recreateStaging } from "../tauri/db-management.js";
import { toastStore } from "./toastStore.svelte.js";
import { getErrorMessage, type OutputFormat } from "../types/index.js";
import { CF_SECTION_TO_FOLDER } from "../data/bg3FolderStructure.js";
import { createDebouncedWriter } from "../utils/debounce.js";

interface PendingWrite {
  id: string;
  operation: () => Promise<void>;
  retries: number;
  lastError: string;
}

/**
 * Derive the primary-key column name from a raw staging DB row.
 *
 * Heuristic order:
 *  1. If the row already carries `_pk_column` metadata → use it
 *  2. If the row has a `UUID` key → "UUID"
 *  3. If the row has a `Name` key (stats entries) → "Name"
 *  4. Fallback → "rowid"
 */
function derivePkColumn(row: Record<string, unknown>): string {
  if (typeof row._pk_column === "string" && row._pk_column) return row._pk_column;
  if ("UUID" in row) return "UUID";
  if ("Name" in row) return "Name";
  return "rowid";
}

/**
 * Convert a raw staging DB row into a typed {@link EntryRow}.
 */
function rowToEntryRow(
  row: Record<string, unknown>,
  table: string,
  sourceType: SourceType,
): EntryRow {
  const pkColumn = derivePkColumn(row);
  const pk = String(row[pkColumn] ?? "");

  return {
    ...row,
    _pk: pk,
    _pk_column: pkColumn,
    _table: table,
    _is_new: !!row._is_new,
    _is_modified: !!row._is_modified,
    _is_deleted: !!row._is_deleted,
    _source_type: sourceType,
  } as EntryRow;
}

/**
 * Convert a section name (e.g. "Races") to its staging DB table name.
 *
 * Uses projectStore.sections (from staging_list_sections) for live lookup,
 * with deterministic fallbacks that match the Rust table naming convention:
 *   - Multi-node LSX: `lsx__${regionId}__${nodeId}`
 *   - Single-node LSX: `lsx__${regionId}`
 *   - Stats:           `stats__${nodeId}`
 *
 * The LSX region IDs often differ from the UI section name (e.g. "Lists"
 * is a UI grouping — actual regions are "SpellLists", "PassiveLists", etc.).
 * When a nodeId is known, we search by node_id directly since data-node IDs
 * are unique across all regions in the DB.
 */
export function sectionToTable(section: string, nodeId?: string, regionIdOverride?: string): string {
  const folder = CF_SECTION_TO_FOLDER[section];
  const regionId = regionIdOverride ?? folder?.regionId ?? section;

  // Resolve effective nodeId: explicit param > folder nodeTypes > undefined
  const effectiveNodeId = nodeId ?? folder?.nodeTypes?.[0];

  // ── With nodeId: try exact (region + node), then node-only ──
  if (effectiveNodeId) {
    // Stats sections (Spells → stats__SpellData, stats__Armor, etc.)
    const statsMatch = projectStore.sections.find(
      s => s.source_type === "stats" && s.table_name === `stats__${effectiveNodeId}`,
    );
    if (statsMatch) return statsMatch.table_name;

    // LSX exact match by (region_id, node_id)
    const exact = projectStore.sections.find(
      s => s.region_id === regionId && s.node_id === effectiveNodeId,
    );
    if (exact) return exact.table_name;

    // LSX match by node_id alone — handles cross-region lookups where
    // the UI section doesn't match the LSX region (e.g. Section="Lists"
    // but SpellList lives in region "SpellLists", Section="CharacterCreation"
    // but CharacterCreationAccessorySet lives in region "CharacterCreationAccessorySets")
    const byNode = projectStore.sections.find(
      s => s.node_id === effectiveNodeId && s.source_type !== "stats",
    );
    if (byNode) return byNode.table_name;

    // Deterministic fallback: stats tables use stats__ prefix if the folder has no regionId
    if (!folder?.regionId) return `stats__${effectiveNodeId}`;

    // Deterministic fallback: multi-node LSX table
    return `lsx__${regionId}__${effectiveNodeId}`;
  }

  // ── Without any nodeId: find by region, prefer data tables over root ──
  const regionMatches = projectStore.sections.filter(s => s.region_id === regionId);
  const dataTable = regionMatches.find(s => s.node_id !== "root");
  if (dataTable) return dataTable.table_name;
  if (regionMatches.length > 0) return regionMatches[0].table_name;

  // Deterministic fallback: single-node LSX table
  return `lsx__${regionId}`;
}

/**
 * Check if any staging table for a section has new rows.
 * Handles multi-table sections (like CharacterCreation) by checking all
 * tables with matching region_id, and also checks the resolved table for
 * cross-region sections (like Lists → SpellLists, PassiveLists, etc.).
 */
export function sectionHasNewEntries(section: string): boolean {
  const folder = CF_SECTION_TO_FOLDER[section];
  const regionId = folder?.regionId ?? section;
  const resolvedTable = sectionToTable(section);
  return projectStore.sections.some(
    s => (s.region_id === regionId || s.table_name === resolvedTable) && s.node_id !== "root" && s.new_rows > 0,
  );
}

/**
 * Thin reactive caching layer over the staging DB.
 *
 * Every mutation writes through to the staging DB via IPC first and
 * updates the local cache optimistically.  On IPC failure the cache
 * is rolled back and the user is notified via toast.
 */
class ProjectStore {
  // === Reactive State ===
  sections: StagingSectionSummary[] = $state([]);
  format: OutputFormat = $state("Yaml");
  dirty: boolean = $state(false);
  pendingWriteCount: number = $state(0);
  syncError: string | null = $state(null);
  dbCorrupted: boolean = $state(false);

  /** Auto-generated localization entries (handle → {text, version}). */
  autoLocaEntries: Map<string, { text: string; version: number }> = $state(new Map());

  // === Private State ===
  #entryCache: Map<string, EntryRow[]> = $state(new Map());
  /** Bumped on every cache mutation to guarantee reactive propagation. */
  #cacheVersion: number = $state(0);
  #stagingDbPath: string = "";

  /** Public read-only access to the staging DB path. */
  get stagingDbPath(): string {
    return this.#stagingDbPath;
  }
  #writeGeneration: number = 0;
  #savedGeneration: number = 0;
  #snapshotCount: number = 0;
  #hydrated: boolean = false;
  #retryQueue: PendingWrite[] = [];
  #nextRetryId: number = 0;

  #debouncedWriter = createDebouncedWriter<{ table: string; columns: Record<string, string> }>(
    async (key, { table, columns }) => {
      try {
        await stagingUpsertRow(this.#stagingDbPath, table, columns, false);
        this.#markDirty();
      } catch (err) {
        // Roll back cache by fetching actual DB state
        const pk = key.slice(key.indexOf("::") + 2);
        try {
          const dbRow = await stagingGetRow(this.#stagingDbPath, table, pk);
          const entries = this.#entryCache.get(table);
          const entry = entries?.find(e => e._pk === pk);
          if (entry && dbRow) {
            for (const [k, v] of Object.entries(dbRow)) {
              if (!k.startsWith("_")) entry[k] = v;
            }
          }
        } catch {
          // Best-effort rollback — invalidate cache so next load re-fetches
          this.#entryCache.delete(table);
          this.#cacheVersion++;
        }
        toastStore.warning("Failed to update entry", getErrorMessage(err));
      }
    },
    100,
  );

  // ────────────────────────────────────────────────────────────────────
  //  Hydration
  // ────────────────────────────────────────────────────────────────────

  /** Load project metadata and section list from the staging DB. */
  async hydrate(): Promise<void> {
    const { staging } = await getDbPaths();
    this.#stagingDbPath = staging;
    this.sections = await stagingListSections(staging);

    const formatMeta = await stagingGetMeta(staging, "format");
    if (formatMeta) this.format = formatMeta as OutputFormat;

    this.#entryCache.clear();
    this.#cacheVersion++;
    this.#writeGeneration = 0;
    this.#savedGeneration = 0;
    this.dirty = false;
    this.#hydrated = true;
  }

  // ────────────────────────────────────────────────────────────────────
  //  Section Loading (lazy)
  // ────────────────────────────────────────────────────────────────────

  /** Lazily load all rows for a staging table.  Returns cached data on subsequent calls. */
  async loadSection(table: string): Promise<EntryRow[]> {
    const cached = this.#entryCache.get(table);
    if (cached) return cached;

    const rows = await stagingQuerySection(this.#stagingDbPath, table, true);
    if (!rows) return [];
    const sourceType = this.#sourceTypeForTable(table);
    const entries: EntryRow[] = rows.map(row => rowToEntryRow(row, table, sourceType));
    this.#entryCache.set(table, entries);
    this.#cacheVersion++;
    return entries;
  }

  // ────────────────────────────────────────────────────────────────────
  //  Mutations (write-through, optimistic cache)
  // ────────────────────────────────────────────────────────────────────

  /** Flush all pending debounced writes.  Call before discrete mutations or project close. */
  async flushPendingWrites(): Promise<void> {
    await this.#debouncedWriter.flush();
  }

  /** Toggle the soft-delete flag on an entry. */
  async toggleEntry(table: string, pk: string): Promise<void> {
    await this.#debouncedWriter.flush();
    const entries = this.#entryCache.get(table);
    const entry = entries?.find(e => e._pk === pk);
    if (!entry) return;

    const wasDeleted = entry._is_deleted;
    entry._is_deleted = !wasDeleted;
    this.#cacheVersion++;

    try {
      if (wasDeleted) {
        await stagingUnmarkDeleted(this.#stagingDbPath, table, pk);
      } else {
        await stagingMarkDeleted(this.#stagingDbPath, table, pk);
      }
      this.#markDirty();
    } catch (err) {
      entry._is_deleted = wasDeleted;
      this.#cacheVersion++;
      const ipcOp = wasDeleted
        ? () => stagingUnmarkDeleted(this.#stagingDbPath, table, pk)
        : () => stagingMarkDeleted(this.#stagingDbPath, table, pk);
      this.#enqueueRetry(
        async () => { await ipcOp(); this.#markDirty(); },
        getErrorMessage(err),
      );
    }
  }

  /** Update one or more columns on an existing entry.  Returns true on success. */
  updateEntry(table: string, pk: string, columns: Record<string, string>): boolean {
    if (!this.#stagingDbPath) {
      toastStore.warning("Cannot update entry", "No project loaded");
      return false;
    }
    const entries = this.#entryCache.get(table);
    const entry = entries?.find(e => e._pk === pk);

    // Optimistic cache update
    if (entry) {
      for (const [key, value] of Object.entries(columns)) {
        entry[key] = value;
      }
      entry._is_modified = true;
      this.#cacheVersion++;
    }

    const key = `${table}::${pk}`;
    this.#debouncedWriter.enqueue(key, { table, columns });
    return true;
  }

  /** Insert a brand-new entry into a section.  Returns true on success. */
  async addEntry(table: string, columns: Record<string, string>): Promise<boolean> {
    if (!this.#stagingDbPath) {
      toastStore.warning("Cannot add entry", "No project loaded");
      return false;
    }
    await this.#debouncedWriter.flush();
    try {
      await stagingUpsertRow(this.#stagingDbPath, table, columns, true);
      this.invalidateSection(table);
      await this.loadSection(table);
      this.#markDirty();
      // Refresh section list so sectionToTable lookups stay current
      this.sections = await stagingListSections(this.#stagingDbPath);
      return true;
    } catch (err) {
      this.#enqueueRetry(
        async () => {
          await stagingUpsertRow(this.#stagingDbPath, table, columns, true);
          this.invalidateSection(table);
          this.#markDirty();
          this.sections = await stagingListSections(this.#stagingDbPath);
        },
        getErrorMessage(err),
      );
      return false;
    }
  }

  /** Remove an entry — hard-delete for new entries, soft-delete for existing. */
  async removeEntry(table: string, pk: string): Promise<void> {
    await this.#debouncedWriter.flush();
    const entries = this.#entryCache.get(table);
    const entryIndex = entries?.findIndex(e => e._pk === pk) ?? -1;
    const entry = entryIndex >= 0 ? entries![entryIndex] : undefined;
    const wasNew = entry?._is_new ?? false;

    if (entry && !wasNew) {
      entry._is_deleted = true;
    }
    this.#cacheVersion++;

    try {
      await stagingMarkDeleted(this.#stagingDbPath, table, pk);
      if (wasNew && entries && entryIndex >= 0) {
        entries.splice(entryIndex, 1);
        this.#cacheVersion++;
      }
      this.#markDirty();
    } catch (err) {
      if (entry && !wasNew) {
        entry._is_deleted = false;
      }
      this.#cacheVersion++;
      this.#enqueueRetry(
        async () => {
          await stagingMarkDeleted(this.#stagingDbPath, table, pk);
          this.#markDirty();
        },
        getErrorMessage(err),
      );
    }
  }

  /** Toggle the deleted flag for a batch of entries in one IPC call. */
  async batchToggle(table: string, pks: string[], deleted: boolean): Promise<void> {
    await this.#debouncedWriter.flush();
    const ops: StagingOperation[] = pks.map(pk => ({
      op: deleted ? "MarkDeleted" : "UnmarkDeleted",
      table,
      pk,
    }));

    const entries = this.#entryCache.get(table);
    const oldStates = new Map<string, boolean>();

    if (entries) {
      for (const entry of entries) {
        if (pks.includes(entry._pk)) {
          oldStates.set(entry._pk, entry._is_deleted);
          entry._is_deleted = deleted;
        }
      }
      this.#cacheVersion++;
    }

    try {
      await stagingBatchWrite(this.#stagingDbPath, ops);
      this.#markDirty();
    } catch (err) {
      if (entries) {
        for (const entry of entries) {
          const old = oldStates.get(entry._pk);
          if (old !== undefined) {
            entry._is_deleted = old;
          }
        }
        this.#cacheVersion++;
      }
      this.#enqueueRetry(
        async () => {
          await stagingBatchWrite(this.#stagingDbPath, ops);
          this.#markDirty();
        },
        getErrorMessage(err),
      );
    }
  }

  /** Discard cached entries for a section and reload from the staging DB. */
  async resetSection(table: string): Promise<void> {
    this.#entryCache.delete(table);
    this.#cacheVersion++;
    try {
      await this.loadSection(table);
    } catch (err) {
      toastStore.warning("Failed to reset section", getErrorMessage(err));
    }
  }

  /** Invalidate cache, reload entries, and refresh section list for a table. */
  async refreshSection(table: string): Promise<void> {
    this.invalidateSection(table);
    await this.loadSection(table);
    this.sections = await stagingListSections(this.#stagingDbPath);
  }

  // ────────────────────────────────────────────────────────────────────
  //  Undo / Redo
  // ────────────────────────────────────────────────────────────────────

  /** Capture an undo snapshot in the staging DB. */
  async snapshot(label: string): Promise<void> {
    if (!this.#stagingDbPath) return;
    try {
      await stagingSnapshot(this.#stagingDbPath, label);
      this.#snapshotCount++;
      if (this.#snapshotCount % 50 === 0) {
        this.compactUndoJournal();
      }
    } catch (err) {
      console.warn("Failed to create undo snapshot:", err);
    }
  }

  /** Fire-and-forget: trim the undo journal to the most recent entries. */
  compactUndoJournal(): void {
    if (!this.#stagingDbPath) return;
    stagingCompactUndo(this.#stagingDbPath).catch((err) => {
      console.warn("Failed to compact undo journal:", err);
    });
  }

  /** Undo the last staging operation and refresh affected sections. */
  async undo(): Promise<void> {
    if (!this.#stagingDbPath) return;
    try {
      const replayed = await stagingUndo(this.#stagingDbPath);
      if (replayed.length === 0) return;
      this.#invalidateReplayedTables(replayed);
      this.sections = await stagingListSections(this.#stagingDbPath);
      this.#markDirty();
    } catch (err) {
      toastStore.warning("Undo failed", getErrorMessage(err));
    }
  }

  /** Redo the last undone staging operation and refresh affected sections. */
  async redo(): Promise<void> {
    if (!this.#stagingDbPath) return;
    try {
      const replayed = await stagingRedo(this.#stagingDbPath);
      if (replayed.length === 0) return;
      this.#invalidateReplayedTables(replayed);
      this.sections = await stagingListSections(this.#stagingDbPath);
      this.#markDirty();
    } catch (err) {
      toastStore.warning("Redo failed", getErrorMessage(err));
    }
  }

  // ────────────────────────────────────────────────────────────────────
  //  Lifecycle
  // ────────────────────────────────────────────────────────────────────

  /** Mark the current generation as the saved baseline (clears dirty flag). */
  markClean(): void {
    this.#savedGeneration = this.#writeGeneration;
    this.dirty = false;
  }

  /** Set the output format and persist to staging meta. */
  async setFormat(format: OutputFormat): Promise<void> {
    this.format = format;
    if (this.#stagingDbPath) {
      await stagingSetMeta(this.#stagingDbPath, "format", format);
    }
  }

  /** Read a meta key from the staging DB. */
  async getMeta(key: string): Promise<string | null> {
    if (!this.#stagingDbPath) return null;
    return stagingGetMeta(this.#stagingDbPath, key);
  }

  /** Write a meta key to the staging DB. */
  async setMeta(key: string, value: string): Promise<void> {
    if (!this.#stagingDbPath) return;
    await stagingSetMeta(this.#stagingDbPath, key, value);
  }

  /** Reset all state to initial values. */
  reset(): void {
    this.#debouncedWriter.cancel();
    this.sections = [];
    this.format = "Yaml";
    this.dirty = false;
    this.pendingWriteCount = 0;
    this.syncError = null;
    this.dbCorrupted = false;
    this.#retryQueue = [];
    this.#entryCache.clear();
    this.#cacheVersion++;
    this.#stagingDbPath = "";
    this.#writeGeneration = 0;
    this.#savedGeneration = 0;
    this.#hydrated = false;
  }

  // ────────────────────────────────────────────────────────────────────
  //  Cache Accessors
  // ────────────────────────────────────────────────────────────────────

  /** Synchronously return cached entries for a table (empty array if not yet loaded). */
  getEntries(table: string): EntryRow[] {
    // Read version counter to establish a reactive dependency — guarantees
    // $derived consumers re-evaluate after any cache mutation (belt-and-suspenders
    // for SvelteMap proxy edge cases in async flows).
    void this.#cacheVersion;
    return this.#entryCache.get(table) ?? [];
  }

  /** Whether the given section has been loaded into the cache. */
  isSectionLoaded(table: string): boolean {
    return this.#entryCache.has(table);
  }

  /** Remove a section from cache so the next {@link loadSection} call re-fetches from DB. */
  invalidateSection(table: string): void {
    this.#entryCache.delete(table);
    this.#cacheVersion++;
  }

  // ────────────────────────────────────────────────────────────────────
  //  Error Recovery
  // ────────────────────────────────────────────────────────────────────

  /** Clear the entry cache, reload all loaded sections, and refresh section list. */
  async forceSync(): Promise<void> {
    if (!this.#stagingDbPath) return;
    const loadedTables = [...this.#entryCache.keys()];
    this.#entryCache.clear();
    this.#cacheVersion++;
    this.#retryQueue = [];
    this.pendingWriteCount = 0;
    this.syncError = null;

    try {
      this.sections = await stagingListSections(this.#stagingDbPath);
      for (const table of loadedTables) {
        await this.loadSection(table);
      }
      toastStore.success("Project re-synced from database");
    } catch (err) {
      toastStore.error("Force sync failed", getErrorMessage(err));
    }
  }

  /** Run integrity check on staging DB and flag corruption if found. */
  async checkAndResetIfCorrupted(): Promise<void> {
    try {
      const result = await checkStagingIntegrity();
      if (result) {
        toastStore.error("Database integrity error", result);
        this.dbCorrupted = true;
      }
    } catch (err) {
      toastStore.error("Integrity check failed", getErrorMessage(err));
    }
  }

  /** Recreate staging DB from scratch and re-hydrate the project. */
  async resetCorruptedDb(): Promise<void> {
    try {
      await recreateStaging();
      this.dbCorrupted = false;
      await this.hydrate();
      toastStore.success("Database reset successfully");
    } catch (err) {
      toastStore.error("Database reset failed", getErrorMessage(err));
    }
  }

  // ────────────────────────────────────────────────────────────────────
  //  Private Helpers
  // ────────────────────────────────────────────────────────────────────

  #enqueueRetry(operation: () => Promise<void>, errorMsg: string): void {
    const id = String(++this.#nextRetryId);
    const pending: PendingWrite = { id, operation, retries: 0, lastError: errorMsg };
    this.#retryQueue.push(pending);
    this.pendingWriteCount = this.#retryQueue.length;
    this.#scheduleRetry(pending);
  }

  #scheduleRetry(pending: PendingWrite): void {
    const delay = 200 * Math.pow(2, pending.retries); // 200ms, 400ms, 800ms
    setTimeout(async () => {
      try {
        await pending.operation();
        // Success — remove from queue
        const idx = this.#retryQueue.indexOf(pending);
        if (idx >= 0) this.#retryQueue.splice(idx, 1);
        this.pendingWriteCount = this.#retryQueue.length;
        if (this.#retryQueue.length === 0) this.syncError = null;
        toastStore.success("Write recovered");
      } catch (err) {
        pending.retries++;
        pending.lastError = getErrorMessage(err);
        if (pending.retries < 3) {
          this.#scheduleRetry(pending);
        } else {
          // Max retries exhausted
          this.syncError = pending.lastError;
          toastStore.error("Write failed after retries", pending.lastError);
        }
      }
    }, delay);
  }

  #markDirty(): void {
    this.#writeGeneration++;
    this.dirty = this.#writeGeneration !== this.#savedGeneration;
  }

  #sourceTypeForTable(table: string): SourceType {
    const summary = this.sections.find(s => s.table_name === table);
    return (summary?.source_type as SourceType) ?? "lsx";
  }

  #invalidateReplayedTables(replayed: UndoReplayEntry[]): void {
    const tables = new Set(replayed.map(e => e.table_name));
    for (const table of tables) {
      this.invalidateSection(table);
    }
  }
}

export const projectStore = new ProjectStore();
