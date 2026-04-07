import { invoke } from "@tauri-apps/api/core";

/** Read a text file from an absolute path. Returns null if the file does not exist. */
export async function readTextFile(path: string): Promise<string | null> {
  try {
    return await invoke<string>("cmd_read_text_file", { path });
  } catch {
    return null;
  }
}

/** Write a text file to an absolute path (creates parent dirs if needed). */
export async function writeTextFile(path: string, content: string): Promise<void> {
  await invoke("cmd_write_text_file", { path, content });
}
