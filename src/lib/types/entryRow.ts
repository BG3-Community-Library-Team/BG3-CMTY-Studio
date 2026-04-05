/** Source type discriminator for EntryRow */
export type SourceType = "lsx" | "stats" | "loca";

/**
 * Unified row type for the projectStore, representing a single entry in the staging DB.
 * Replaces DiffEntry + ManualEntry + SelectedEntry for the new DB-backed architecture.
 */
export interface EntryRow {
  /** Primary key value (usually UUID, sometimes rowid) */
  _pk: string;
  /** Name of the primary key column in the staging table */
  _pk_column: string;
  /** Staging DB table name (e.g., "Races", "Progressions") */
  _table: string;
  /** Whether this entry was created by the user (not from existing mod files) */
  _is_new: boolean;
  /** Whether any column has been modified from its original value */
  _is_modified: boolean;
  /** Whether this entry is soft-deleted (disabled) */
  _is_deleted: boolean;
  /** Source data type: "lsx", "stats", "loca" */
  _source_type: SourceType;
  /** Dynamic data columns from the staging DB row */
  [column: string]: unknown;
}

/** Type guard for EntryRow source type narrowing */
export function isLsxEntry(entry: EntryRow): boolean {
  return entry._source_type === "lsx";
}

export function isStatsEntry(entry: EntryRow): boolean {
  return entry._source_type === "stats";
}

export function isLocaEntry(entry: EntryRow): boolean {
  return entry._source_type === "loca";
}
