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

export async function importSeScripts(
  dbPath: string,
  modPath: string,
  modFolder: string,
): Promise<number> {
  return invoke("cmd_import_se_scripts", { dbPath, modPath, modFolder });
}

export async function importOsirisGoals(
  dbPath: string,
  modPath: string,
  modFolder: string,
): Promise<number> {
  return invoke("cmd_import_osiris_goals", { dbPath, modPath, modFolder });
}

export async function scaffoldSeStructure(
  dbPath: string,
  modFolder: string,
  includeServer: boolean,
  includeClient: boolean,
): Promise<string[]> {
  return invoke("cmd_scaffold_se_structure", {
    dbPath,
    modFolder,
    includeServer,
    includeClient,
  });
}

// ── Filesystem commands ──

export async function touchFile(
  modPath: string,
  relPath: string,
): Promise<void> {
  return invoke("cmd_touch_file", { modPath, relPath });
}

export async function createModDirectory(
  modPath: string,
  relPath: string,
): Promise<void> {
  return invoke("cmd_create_mod_directory", { modPath, relPath });
}

export async function moveModFile(
  modPath: string,
  srcRelPath: string,
  destRelPath: string,
): Promise<void> {
  return invoke("cmd_move_mod_file", { modPath, srcRelPath, destRelPath });
}

export async function copyModFile(
  modPath: string,
  srcRelPath: string,
  destRelPath: string,
): Promise<void> {
  return invoke("cmd_copy_mod_file", { modPath, srcRelPath, destRelPath });
}
