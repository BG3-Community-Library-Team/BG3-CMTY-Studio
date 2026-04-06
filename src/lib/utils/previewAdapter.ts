/**
 * Preview adapter — migration shim bridging projectStore (staging DB)
 * data model to the existing LSX preview pipeline.
 *
 * The staging DB stores each attribute as a flat column on the row,
 * while the LSX preview IPC expects the DiffEntry-style nested maps
 * (raw_attributes, raw_attribute_types, raw_children).  This module
 * converts between the two representations.
 *
 * TODO: Remove when OutputSidebar is fully migrated to native staging queries.
 */

import { projectStore } from "../stores/projectStore.svelte.js";
import type { EntryRow } from "../types/entryRow.js";
import { previewLsx, type LsxPreviewEntry } from "../tauri/lsx-export.js";

// ── Internal metadata keys that must NOT appear in raw_attributes ──────────

/** Prefix-based meta columns added by the staging layer. */
const META_PREFIXES = ["_pk", "_is_", "_source_", "_table"];

/** Exact meta column names injected by the staging DB or EntryRow conversion. */
const META_COLUMNS = new Set([
  "_pk",
  "_pk_column",
  "_table",
  "_is_new",
  "_is_modified",
  "_is_deleted",
  "_source_type",
  "_file_id",
  "_SourceID",
  "_row_id",
  "_original_hash",
]);

/** Returns true if `key` is an internal metadata column, not a data attribute. */
function isMetaColumn(key: string): boolean {
  if (META_COLUMNS.has(key)) return true;
  // Safety net: any column starting with underscore that we missed
  // (staging tracking columns all use underscore prefix).
  return key.startsWith("_");
}

// ── EntryRow → LsxPreviewEntry conversion ──────────────────────────────────

/**
 * Convert a staging DB {@link EntryRow} into the {@link LsxPreviewEntry}
 * format expected by `cmd_preview_lsx`.
 *
 * @param row - A single entry from projectStore.loadSection()
 * @param nodeId - The LSX node_id for this table (from StagingSectionSummary.node_id)
 */
export function entryRowToLsxPreview(
  row: EntryRow,
  nodeId: string,
): LsxPreviewEntry {
  const rawAttributes: Record<string, string> = {};

  for (const [key, value] of Object.entries(row)) {
    if (isMetaColumn(key)) continue;
    // Skip null/undefined values — the LSX writer doesn't need them
    if (value == null) continue;
    rawAttributes[key] = String(value);
  }

  return {
    uuid: row._pk,
    node_id: nodeId,
    raw_attributes: rawAttributes,
    // TODO: Add IPC `cmd_staging_get_column_types` to fetch bg3_type per column
    // from the staging DB's _column_types table.  Until then, Rust's
    // `infer_attribute_type()` provides reasonable fallback inference.
    raw_attribute_types: {},
    // TODO: Children are stored as separate rows in child tables (FK-linked).
    // A staging-side join query is needed to reconstruct the raw_children map.
    // For now, top-level entries without inline children render correctly.
    raw_children: {},
  };
}

// ── Section-level preview generation ───────────────────────────────────────

/**
 * Generate an LSX preview for a given staging table.
 *
 * Queries all non-deleted entries from projectStore and converts
 * them to the format expected by the Rust preview command.
 *
 * @param table - Staging table name (e.g. "Races", "Progressions")
 * @returns Rendered LSX XML string, or empty string if no active entries
 */
export async function generateStagingPreview(
  table: string,
): Promise<string> {
  const entries = await projectStore.loadSection(table);
  const activeEntries = entries.filter((e) => !e._is_deleted);

  if (activeEntries.length === 0) return "";

  // Look up node_id and region_id from the section summary metadata.
  const summary = projectStore.sections.find((s) => s.table_name === table);
  const nodeId = summary?.node_id ?? table;
  const regionId = summary?.region_id ?? table;

  const previewEntries = activeEntries.map((e) =>
    entryRowToLsxPreview(e, nodeId),
  );

  return previewLsx(previewEntries, regionId);
}
