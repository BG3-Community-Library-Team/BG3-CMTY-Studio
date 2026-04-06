import { invoke } from "@tauri-apps/api/core";

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
