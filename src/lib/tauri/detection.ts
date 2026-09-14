import { invoke } from "@tauri-apps/api/core";
import type { ResolvedUserDataDir } from "../types/generated/index.js";

export type { ResolvedUserDataDir, UserDataSource } from "../types/generated/index.js";

// ---- Load Order ----

/** Hints used to find the Larian user data folder. */
export interface UserDataLookup {
  /** Configured game Data folder; on Linux it selects the matching Proton/Wine prefix. */
  gameDataPath?: string;
  /** User-chosen user data folder, used when it exists. */
  userDataOverride?: string;
}

function lookupArgs(lookup: UserDataLookup) {
  return {
    gameDataPath: lookup.gameDataPath || null,
    userDataOverride: lookup.userDataOverride || null,
  };
}

/** List all .pak files in the Mods folder of the Larian user data folder. */
export async function listLoadOrderPaks(lookup: UserDataLookup = {}): Promise<string[]> {
  return invoke("cmd_list_load_order_paks", lookupArgs(lookup));
}

/** Get active mod folder names from the most recent modsettings.lsx profile. */
export async function getActiveModFolders(lookup: UserDataLookup = {}): Promise<string[]> {
  return invoke("cmd_get_active_mod_folders", lookupArgs(lookup));
}

/** Resolve the Larian user data folder, or null when none is found. */
export async function getLarianUserDataDir(lookup: UserDataLookup = {}): Promise<ResolvedUserDataDir | null> {
  return invoke("cmd_get_larian_user_data_dir", lookupArgs(lookup));
}

// ---- Auto-detect & discovery ----

/** Auto-detect the BG3 game Data folder (Windows Registry, or Steam libraries on Linux). */
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

/** Reveal a file or directory in the native OS file manager (selecting it if it's a file). */
export async function revealPath(path: string): Promise<void> {
  return invoke("cmd_reveal_path", { path });
}

/** Rename (move) a directory on disk. */
export async function renameDir(
  fromPath: string,
  toPath: string,
): Promise<void> {
  return invoke("cmd_rename_dir", { fromPath, toPath });
}
