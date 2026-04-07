import { invoke } from "@tauri-apps/api/core";

export type WarningSeverity = "Info" | "Warning" | "Error";

export interface HandlerWarning {
  handler_name: string;
  message: string;
  severity: WarningSeverity;
}

export interface FileReport {
  path: string;
  handler: string;
  entry_count: number;
  bytes_written: number;
  backed_up: boolean;
}

export interface SaveProjectResult {
  files_created: FileReport[];
  files_updated: FileReport[];
  files_deleted: FileReport[];
  files_unchanged: number;
  total_entries: number;
  errors: string[];
  dry_run: boolean;
}

export async function saveProject(
  stagingDbPath: string,
  refBasePath: string,
  modPath: string,
  modName: string,
  modFolder: string,
  backup: boolean,
  dryRun: boolean,
): Promise<SaveProjectResult> {
  return invoke("cmd_save_project", {
    stagingDbPath,
    refBasePath,
    modPath,
    modName,
    modFolder,
    backup,
    dryRun,
  });
}

export async function validateHandlers(
  stagingDbPath: string,
  refBasePath: string,
  modPath: string,
  modName: string,
  modFolder: string,
): Promise<HandlerWarning[]> {
  return invoke("cmd_validate_handlers", {
    stagingDbPath,
    refBasePath,
    modPath,
    modName,
    modFolder,
  });
}
