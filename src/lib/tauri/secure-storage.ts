import { invoke } from "@tauri-apps/api/core";

/** Get a value from OS-level secure storage. Returns empty string if not found. */
export async function getSecureSetting(key: string): Promise<string> {
  return invoke("cmd_get_secure_setting", { key });
}

/** Write a value to OS-level secure storage. Pass empty string to delete the entry. */
export async function setSecureSetting(key: string, value: string): Promise<void> {
  return invoke("cmd_set_secure_setting", { key, value });
}
