import { invoke } from "@tauri-apps/api/core";

// ---- LSX Output ----

/** An entry prepared for LSX preview/export. */
export interface LsxPreviewEntry {
  uuid: string;
  node_id: string;
  raw_attributes: Record<string, string>;
  raw_attribute_types: Record<string, string>;
  raw_children: Record<string, string[]>;
}

/** Preview LSX XML output for a set of entries. */
export async function previewLsx(
  entries: LsxPreviewEntry[],
  regionId: string,
): Promise<string> {
  return invoke("cmd_preview_lsx", { entries, regionId });
}

/** Save entries as an .lsx file to disk. */
export async function saveLsx(
  entries: LsxPreviewEntry[],
  regionId: string,
  outputPath: string,
): Promise<void> {
  return invoke("cmd_save_lsx", { entries, regionId, outputPath });
}

// ---- Multi-file Mod Export ----

/** A single file specification for batch mod export. */
export interface ExportFileSpec {
  output_path: string;
  region_id: string;
  entries: LsxPreviewEntry[];
}

/** Information about a single exported file. */
export interface ExportedFile {
  path: string;
  entry_count: number;
  bytes_written: number;
  backed_up: boolean;
}

/** Result of a full mod export operation. */
export interface ExportModResult {
  files: ExportedFile[];
  errors: string[];
  file_errors: Record<string, string[]>;
}

/** Export an entire mod: batch-write LSX files + optional CF config in one operation. */
export async function exportMod(
  lsxFiles: ExportFileSpec[],
  configContent: string | null,
  configPath: string | null,
  backup: boolean,
): Promise<ExportModResult> {
  return invoke("cmd_export_mod", { lsxFiles, configContent, configPath, backup });
}

/** Get the LSX region ID for a CF section name. */
export async function regionIdForSection(
  section: string,
): Promise<string> {
  return invoke("cmd_region_id_for_section", { section });
}

// ─── Schema Inference ──────────────────────────────────────────────────

export interface AttrSchema {
  name: string;
  attr_type: string;
  frequency: number;
  examples: string[];
}

export interface ChildSchema {
  group_id: string;
  child_node_id: string;
  frequency: number;
}

export interface NodeSchema {
  node_id: string;
  section: string;
  sample_count: number;
  attributes: AttrSchema[];
  children: ChildSchema[];
}

/** Infer LSX schemas from vanilla data. */
export async function inferSchemas(): Promise<NodeSchema[]> {
  return invoke("cmd_infer_schemas");
}
