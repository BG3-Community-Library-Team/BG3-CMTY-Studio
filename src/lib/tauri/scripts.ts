import { invoke } from "@tauri-apps/api/core";

export interface ScriptFileInfo {
  path: string;
  size: number;
  is_new: boolean;
  is_modified: boolean;
}

export async function scriptRead(
  dbPath: string,
  filePath: string,
): Promise<string | null> {
  return invoke("cmd_script_read", { dbPath, filePath });
}

export async function scriptWrite(
  dbPath: string,
  filePath: string,
  content: string,
): Promise<boolean> {
  return invoke("cmd_script_write", { dbPath, filePath, content });
}

export async function scriptDelete(
  dbPath: string,
  filePath: string,
): Promise<boolean> {
  return invoke("cmd_script_delete", { dbPath, filePath });
}

export async function scriptList(
  dbPath: string,
  prefix?: string,
): Promise<ScriptFileInfo[]> {
  return invoke("cmd_script_list", { dbPath, prefix: prefix ?? null });
}

export async function scriptCreateFromTemplate(
  dbPath: string,
  filePath: string,
  templateId: string,
  variables: Record<string, string>,
): Promise<boolean> {
  return invoke("cmd_script_create_from_template", {
    dbPath,
    filePath,
    templateId,
    variables,
  });
}
