import { invoke } from "@tauri-apps/api/core";
import { invokeWithTimeout } from "./utils.js";

// ---- vanilla/mod processing integration ----

export interface ModProcessResult {
  lsf_converted: number;
  unpack_path: string;
  errors: string[];
  /** Parsed mod meta from .pak extraction (null for directory mods). */
  mod_meta: ModMetaInfo | null;
  /** Whether the mod has a Public folder (mods without one are unlikely to have CF-relevant content). */
  has_public_folder: boolean;
}

export async function processModFolder(
  modPath: string,
  modName: string
): Promise<ModProcessResult> {
  return invokeWithTimeout("cmd_process_mod_folder", { modPath, modName }, 120_000);
}

export async function dirSize(dirPath: string): Promise<number> {
  return invoke("cmd_dir_size", { dirPath });
}

export interface ModMetaInfo {
  uuid: string;
  folder: string;
  name: string;
  author: string;
  version: string;
  version64: string;
  description: string;
  md5: string;
  mod_type: string;
  tags: string;
  num_players: string;
  gm_template: string;
  char_creation_level: string;
  lobby_level: string;
  menu_level: string;
  startup_level: string;
  photo_booth: string;
  main_menu_bg_video: string;
  publish_version: string;
  target_mode: string;
  dependencies: import("../types/index.js").MetaDependency[];
}

export async function readModMeta(modPath: string): Promise<ModMetaInfo> {
  return invoke("cmd_read_mod_meta", { modPath });
}

// ─── Mod Scaffold ──────────────────────────────────────────────────

export interface CreateModResult {
  mod_root: string;
  meta_path: string;
  public_path: string;
  has_script_extender: boolean;
}

/** Create a new mod folder scaffold with meta.lsx, Public/ dir, and optional SE dir. */
export async function createModScaffold(
  targetDir: string,
  modName: string,
  author: string,
  description: string,
  useScriptExtender: boolean,
  folder: string = "",
  version: string = "1.0.0.0",
): Promise<CreateModResult> {
  return invoke("cmd_create_mod_scaffold", { targetDir, modName, author, description, useScriptExtender, folder, version });
}

// ─── Granular Extraction ───────────────────────────────────────────

export interface PakSectionInfo {
  folder: string;
  file_count: number;
}

/** List which data sections exist inside a .pak file without extracting. */
export async function listPakSections(
  pakPath: string,
): Promise<PakSectionInfo[]> {
  return invoke("cmd_list_pak_sections", { pakPath });
}

// ---- Mod File Preview ----

/** A text file discovered within the mod directory. */
export interface ModFileEntry {
  rel_path: string;
  extension: string;
  size: number;
}

/** List previewable text files (.md, .txt, .lua, .json, .yaml, etc.) in a mod directory. */
export async function listModFiles(modPath: string): Promise<ModFileEntry[]> {
  return invoke("cmd_list_mod_files", { modPath });
}

/** Read the text content of a file within a mod directory. */
export async function readModFile(modPath: string, relPath: string): Promise<string> {
  return invoke("cmd_read_mod_file", { modPath, relPath });
}
