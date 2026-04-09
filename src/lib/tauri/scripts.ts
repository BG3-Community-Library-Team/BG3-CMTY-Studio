import { invoke } from "@tauri-apps/api/core";

export interface ScriptFileInfo {
  path: string;
  size: number;
  is_new: boolean;
  is_modified: boolean;
}

export async function scriptRead(
  modPath: string,
  filePath: string,
): Promise<string | null> {
  return invoke("cmd_script_read", { modPath, filePath });
}

export async function scriptWrite(
  modPath: string,
  filePath: string,
  content: string,
): Promise<boolean> {
  return invoke("cmd_script_write", { modPath, filePath, content });
}

export async function scriptDelete(
  modPath: string,
  filePath: string,
): Promise<boolean> {
  return invoke("cmd_script_delete", { modPath, filePath });
}

export async function scriptList(
  modPath: string,
  prefix?: string,
): Promise<ScriptFileInfo[]> {
  return invoke("cmd_script_list", { modPath, prefix: prefix ?? null });
}

export async function scriptCreateFromTemplate(
  modPath: string,
  filePath: string,
  templateId: string,
  variables: Record<string, string>,
): Promise<boolean> {
  return invoke("cmd_script_create_from_template", {
    modPath,
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

export async function importKhonsuScripts(
  dbPath: string,
  modPath: string,
  modFolder: string,
): Promise<number> {
  return invoke("cmd_import_khonsu_scripts", { dbPath, modPath, modFolder });
}

export async function scaffoldSeStructure(
  modPath: string,
  modFolder: string,
  includeServer: boolean,
  includeClient: boolean,
): Promise<string[]> {
  return invoke("cmd_scaffold_se_structure", {
    modPath,
    modFolder,
    includeServer,
    includeClient,
  });
}

export async function scaffoldKhonsuStructure(
  modPath: string,
  modFolder: string,
): Promise<string[]> {
  return invoke("cmd_scaffold_khonsu_structure", { modPath, modFolder });
}

export async function scaffoldOsirisStructure(
  modPath: string,
  modFolder: string,
): Promise<string[]> {
  return invoke("cmd_scaffold_osiris_structure", { modPath, modFolder });
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

// ── External template support ──

export interface ExternalTemplateInfo {
  id: string;
  label: string;
  category: string;
  extension: string;
  source_path: string;
}

export async function listExternalTemplates(
  folderPath: string,
): Promise<ExternalTemplateInfo[]> {
  return invoke("cmd_list_external_templates", { folderPath });
}

export async function createFromExternalTemplate(
  modPath: string,
  filePath: string,
  sourcePath: string,
  variables: Record<string, string>,
): Promise<boolean> {
  return invoke("cmd_create_from_external_template", {
    modPath,
    filePath,
    sourcePath,
    variables,
  });
}
