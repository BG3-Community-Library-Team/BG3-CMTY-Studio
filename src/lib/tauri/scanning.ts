import { invoke } from "@tauri-apps/api/core";
import type { ScanResult } from "../types/index.js";
import type { DetectResult } from "../types/modSelection.js";
import { invokeWithTimeout } from "./utils.js";

export type { ScanResult } from "../types/index.js";

export async function scanMod(
  modPath: string,
  extraScanPaths?: string[],
  isPrimary?: boolean
): Promise<ScanResult> {
  return invokeWithTimeout("cmd_scan_mod", { modPath, extraScanPaths: extraScanPaths ?? null, isPrimary: isPrimary ?? null }, 120_000);
}

export async function rediffMod(
  primaryModPath: string,
  compareModPath: string,
): Promise<import("../types/index.js").SectionResult[]> {
  return invoke("cmd_rediff_mod", { primaryModPath, compareModPath });
}

export async function detectModFolders(projectPath: string): Promise<DetectResult> {
  return invoke("cmd_detect_mod_folders", { projectPath });
}
