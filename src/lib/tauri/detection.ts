import { invoke } from "@tauri-apps/api/core";

// ---- Load Order ----

/** List all .pak files in the BG3 Mods directory (%LOCALAPPDATA%/Larian Studios/Baldur's Gate 3/Mods). */
export async function listLoadOrderPaks(): Promise<string[]> {
  return invoke("cmd_list_load_order_paks");
}

/** Get active mod folder names from the most recent modsettings.lsx profile. */
export async function getActiveModFolders(): Promise<string[]> {
  return invoke("cmd_get_active_mod_folders");
}

// ---- Auto-detect & discovery ----

/** Auto-detect the BG3 game Data folder via Windows Registry (Steam & GOG). */
export async function detectGameDataPath(): Promise<string | null> {
  return invoke("cmd_detect_game_data_path");
}

/** Check whether the Game Data folder contains expected vanilla .pak files. */
export async function validateGameDataPath(gameDataPath: string): Promise<boolean> {
  return invoke("cmd_validate_game_data_path", { gameDataPath });
}

/** Open a file or directory path in the native OS file explorer. */
export async function openPath(path: string): Promise<void> {
  return invoke("cmd_open_path", { path });
}

/** Rename (move) a directory on disk. */
export async function renameDir(
  fromPath: string,
  toPath: string,
): Promise<void> {
  return invoke("cmd_rename_dir", { fromPath, toPath });
}
