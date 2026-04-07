import { invoke } from "@tauri-apps/api/core";

// === Types ===

export interface UpsertResult {
  pk_value: string;
  was_insert: boolean;
}

export interface StagingOperation {
  op: "Upsert" | "MarkDeleted" | "UnmarkDeleted";
  table: string;
  columns?: Record<string, string>;
  is_new?: boolean;
  pk?: string;
}

export interface StagingBatchResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: string[];
}

export interface StagingChange {
  table: string;
  pk_value: string;
  change_type: "new" | "modified" | "deleted";
  columns: Record<string, unknown>;
}

export interface StagingSectionSummary {
  table_name: string;
  region_id: string | null;
  node_id: string | null;
  source_type: string;
  total_rows: number;
  active_rows: number;
  new_rows: number;
  modified_rows: number;
  deleted_rows: number;
}

// === Write API ===

export async function stagingUpsertRow(
  stagingDbPath: string,
  table: string,
  columns: Record<string, string>,
  isNew: boolean,
): Promise<UpsertResult> {
  return invoke("cmd_staging_upsert_row", { stagingDbPath, table, columns, isNew });
}

export async function stagingMarkDeleted(
  stagingDbPath: string,
  table: string,
  pk: string,
): Promise<boolean> {
  return invoke("cmd_staging_mark_deleted", { stagingDbPath, table, pk });
}

export async function stagingUnmarkDeleted(
  stagingDbPath: string,
  table: string,
  pk: string,
): Promise<boolean> {
  return invoke("cmd_staging_unmark_deleted", { stagingDbPath, table, pk });
}

export async function stagingBatchWrite(
  stagingDbPath: string,
  operations: StagingOperation[],
): Promise<StagingBatchResult> {
  return invoke("cmd_staging_batch_write", { stagingDbPath, operations });
}

// === Read API ===

export async function stagingQueryChanges(
  stagingDbPath: string,
  table?: string,
): Promise<StagingChange[]> {
  return invoke("cmd_staging_query_changes", { stagingDbPath, table: table ?? null });
}

export async function stagingListSections(
  stagingDbPath: string,
): Promise<StagingSectionSummary[]> {
  return invoke("cmd_staging_list_sections", { stagingDbPath });
}

export async function stagingQuerySection(
  stagingDbPath: string,
  table: string,
  includeDeleted?: boolean,
): Promise<Record<string, unknown>[]> {
  return invoke("cmd_staging_query_section", { stagingDbPath, table, includeDeleted: includeDeleted ?? null });
}

export async function stagingGetRow(
  stagingDbPath: string,
  table: string,
  pk: string,
): Promise<Record<string, unknown> | null> {
  return invoke("cmd_staging_get_row", { stagingDbPath, table, pk });
}

// === Meta API ===

export async function stagingGetMeta(
  stagingDbPath: string,
  key: string,
): Promise<string | null> {
  return invoke("cmd_staging_get_meta", { stagingDbPath, key });
}

export async function stagingSetMeta(
  stagingDbPath: string,
  key: string,
  value: string,
): Promise<void> {
  return invoke("cmd_staging_set_meta", { stagingDbPath, key, value });
}

// === Undo API ===

export interface UndoReplayEntry {
  table_name: string;
  pk_value: string;
  action: string;
}

export async function stagingSnapshot(
  stagingDbPath: string,
  label: string,
): Promise<number> {
  return invoke("cmd_staging_snapshot", { stagingDbPath, label });
}

export async function stagingUndo(
  stagingDbPath: string,
): Promise<UndoReplayEntry[]> {
  return invoke("cmd_staging_undo", { stagingDbPath });
}

export async function stagingRedo(
  stagingDbPath: string,
): Promise<UndoReplayEntry[]> {
  return invoke("cmd_staging_redo", { stagingDbPath });
}

// === Maintenance API ===

export async function stagingWalCheckpoint(
  stagingDbPath: string,
): Promise<void> {
  return invoke("cmd_staging_wal_checkpoint", { stagingDbPath });
}

export async function stagingCompactUndo(
  stagingDbPath: string,
  maxEntries?: number,
): Promise<number> {
  return invoke("cmd_staging_compact_undo", { stagingDbPath, maxEntries: maxEntries ?? null });
}
