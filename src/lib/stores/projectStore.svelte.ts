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
} from "../tauri/staging.js";
import { getDbPaths } from "../tauri/db-management.js";
import { toastStore } from "./toastStore.svelte.js";
import { getErrorMessage, type OutputFormat } from "../types/index.js";

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
 * Resolves via projectStore.sections when available — handles stats tables
 * (e.g. "stats__Spells") and multi-node regions (e.g. "lsx__Progressions__Progression").
 * Falls back to `lsx__${section}` before hydration.
 */
export function sectionToTable(section: string): string {
  const match = projectStore.sections.find(s => s.region_id === section);
  if (match) return match.table_name;
  return `lsx__${section}`;
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

  /** Auto-generated localization entries (handle → {text, version}). */
  autoLocaEntries: Map<string, { text: string; version: number }> = $state(new Map());

  // === Private State ===
  #entryCache: Map<string, EntryRow[]> = $state(new Map());
  #stagingDbPath: string = "";
  #writeGeneration: number = 0;
  #savedGeneration: number = 0;
  #hydrated: boolean = false;

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
    return entries;
  }

  // ────────────────────────────────────────────────────────────────────
  //  Mutations (write-through, optimistic cache)
  // ────────────────────────────────────────────────────────────────────

  /** Toggle the soft-delete flag on an entry. */
  async toggleEntry(table: string, pk: string): Promise<void> {
    const entries = this.#entryCache.get(table);
    const entry = entries?.find(e => e._pk === pk);
    if (!entry) return;

    const wasDeleted = entry._is_deleted;
    entry._is_deleted = !wasDeleted;

    try {
      if (wasDeleted) {
        await stagingUnmarkDeleted(this.#stagingDbPath, table, pk);
      } else {
        await stagingMarkDeleted(this.#stagingDbPath, table, pk);
      }
      this.#markDirty();
    } catch (err) {
      entry._is_deleted = wasDeleted;
      toastStore.warning("Failed to toggle entry", getErrorMessage(err));
    }
  }

  /** Update one or more columns on an existing entry. */
  async updateEntry(table: string, pk: string, columns: Record<string, string>): Promise<void> {
    const entries = this.#entryCache.get(table);
    const entry = entries?.find(e => e._pk === pk);

    // Capture old values for rollback
    const oldValues: Record<string, unknown> = {};
    if (entry) {
      for (const key of Object.keys(columns)) {
        oldValues[key] = entry[key];
      }
      for (const [key, value] of Object.entries(columns)) {
        entry[key] = value;
      }
      entry._is_modified = true;
    }

    try {
      await stagingUpsertRow(this.#stagingDbPath, table, columns, false);
      this.#markDirty();
    } catch (err) {
      if (entry) {
        for (const [key, value] of Object.entries(oldValues)) {
          entry[key] = value;
        }
      }
      toastStore.warning("Failed to update entry", getErrorMessage(err));
    }
  }

  /** Insert a brand-new entry into a section. */
  async addEntry(table: string, columns: Record<string, string>): Promise<void> {
    try {
      await stagingUpsertRow(this.#stagingDbPath, table, columns, true);
      this.invalidateSection(table);
      this.#markDirty();
    } catch (err) {
      toastStore.warning("Failed to add entry", getErrorMessage(err));
    }
  }

  /** Remove an entry — hard-delete for new entries, soft-delete for existing. */
  async removeEntry(table: string, pk: string): Promise<void> {
    const entries = this.#entryCache.get(table);
    const entryIndex = entries?.findIndex(e => e._pk === pk) ?? -1;
    const entry = entryIndex >= 0 ? entries![entryIndex] : undefined;
    const wasNew = entry?._is_new ?? false;

    if (entry && !wasNew) {
      entry._is_deleted = true;
    }

    try {
      await stagingMarkDeleted(this.#stagingDbPath, table, pk);
      if (wasNew && entries && entryIndex >= 0) {
        entries.splice(entryIndex, 1);
      }
      this.#markDirty();
    } catch (err) {
      if (entry && !wasNew) {
        entry._is_deleted = false;
      }
      toastStore.warning("Failed to remove entry", getErrorMessage(err));
    }
  }

  /** Toggle the deleted flag for a batch of entries in one IPC call. */
  async batchToggle(table: string, pks: string[], deleted: boolean): Promise<void> {
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
      }
      toastStore.warning("Failed to batch toggle", getErrorMessage(err));
    }
  }

  /** Discard cached entries for a section and reload from the staging DB. */
  async resetSection(table: string): Promise<void> {
    this.#entryCache.delete(table);
    try {
      await this.loadSection(table);
    } catch (err) {
      toastStore.warning("Failed to reset section", getErrorMessage(err));
    }
  }

  // ────────────────────────────────────────────────────────────────────
  //  Undo / Redo
  // ────────────────────────────────────────────────────────────────────

  /** Capture an undo snapshot in the staging DB. */
  async snapshot(label: string): Promise<void> {
    if (!this.#stagingDbPath) return;
    try {
      await stagingSnapshot(this.#stagingDbPath, label);
    } catch (err) {
      console.warn("Failed to create undo snapshot:", err);
    }
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
    this.sections = [];
    this.format = "Yaml";
    this.dirty = false;
    this.#entryCache.clear();
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
    return this.#entryCache.get(table) ?? [];
  }

  /** Whether the given section has been loaded into the cache. */
  isSectionLoaded(table: string): boolean {
    return this.#entryCache.has(table);
  }

  /** Remove a section from cache so the next {@link loadSection} call re-fetches from DB. */
  invalidateSection(table: string): void {
    this.#entryCache.delete(table);
  }

  // ────────────────────────────────────────────────────────────────────
  //  Private Helpers
  // ────────────────────────────────────────────────────────────────────

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
