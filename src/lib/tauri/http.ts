import { invoke } from "@tauri-apps/api/core";

/**
 * Fetch a remote text resource (e.g., JSON schema) from an allowed URL.
 * Only HTTPS URLs from allowed prefixes (GitHub raw content) are permitted.
 */
export async function fetchRemoteSchema(url: string): Promise<string> {
  return invoke<string>("cmd_fetch_remote_schema", { url });
}
