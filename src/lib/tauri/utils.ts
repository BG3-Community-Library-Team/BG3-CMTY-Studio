import { invoke } from "@tauri-apps/api/core";

/**
 * IPC Parameter Conventions:
 * - Empty string `""` = "all" for String filter params (e.g. `entryType: ""` returns all types)
 * - `undefined` / `null` = omit optional params (maps to Rust `Option::None`)
 */

/** T2-2 / IPC-06: Paginated response envelope from Rust commands. */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
}

/** Extract items from a paginated response, preserving backward-compatible usage. */
export function unwrap<T>(resp: PaginatedResponse<T>): T[] {
  return resp.items;
}

/** IPC-ERR-16: Invoke with a timeout to prevent indefinite hangs. */
export async function invokeWithTimeout<T>(
  cmd: string,
  args?: Record<string, unknown>,
  timeoutMs: number = 60_000,
): Promise<T> {
  return Promise.race([
    invoke<T>(cmd, args),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`IPC call '${cmd}' timed out after ${timeoutMs}ms`)),
        timeoutMs,
      ),
    ),
  ]);
}
