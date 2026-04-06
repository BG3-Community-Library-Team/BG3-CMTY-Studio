import { invoke } from "@tauri-apps/api/core";
import type { SelectedEntry, SerializeOptions, AnchorGroup, ManualEntry } from "../types/index.js";

export async function generateConfig(
  entries: SelectedEntry[],
  options: SerializeOptions
): Promise<string> {
  return invoke("cmd_generate_config", { entries, options });
}

export async function saveConfig(
  content: string,
  outputPath: string,
  backup: boolean
): Promise<void> {
  return invoke("cmd_save_config", { content, outputPath, backup });
}

export async function readExistingConfig(
  configPath: string
): Promise<string> {
  return invoke("cmd_read_existing_config", { configPath });
}

export async function detectAnchors(
  entries: SelectedEntry[],
  threshold: number
): Promise<AnchorGroup[]> {
  return invoke("cmd_detect_anchors", { entries, threshold });
}

/** Generate config preview via Rust IPC (supports manual entries + overrides). */
export async function previewConfig(
  entries: SelectedEntry[],
  manualEntries: ManualEntry[],
  autoEntryOverrides: Record<string, Record<string, string>>,
  format: "yaml" | "json",
  includeComments: boolean,
  enableSectionComments: boolean,
  enableEntryComments: boolean,
): Promise<string> {
  return invoke("cmd_preview_config", {
    entries,
    manualEntries,
    autoEntryOverrides,
    format,
    includeComments,
    enableSectionComments,
    enableEntryComments,
  });
}
