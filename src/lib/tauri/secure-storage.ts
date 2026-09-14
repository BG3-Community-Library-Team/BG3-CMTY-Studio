import { invoke } from "@tauri-apps/api/core";
import type { CredentialBackendStatus } from "../types/generated/index.js";

export type { CredentialBackendStatus } from "../types/generated/index.js";

/** Get a value from OS-level secure storage. Returns empty string if not found. */
export async function getSecureSetting(key: string): Promise<string> {
  return invoke("cmd_get_secure_setting", { key });
}

/** Delete a value from OS-level secure storage. Succeeds if it doesn't exist. */
export async function deleteSecureSetting(key: string): Promise<void> {
  return invoke("cmd_delete_secure_setting", { key });
}

/** Availability of the OS credential store (mirrors Rust `CredentialBackendStatus`). */
export interface CredentialBackendStatus {
  available: boolean;
  /** Provider name such as "KWallet", when it can be identified (Linux only). */
  provider: string | null;
  /** Why the store can't be used, when unavailable. */
  reason: string | null;
}

/** Check whether the OS credential store can be used, and which provider serves it on Linux. */
export async function getCredentialBackendStatus(): Promise<CredentialBackendStatus> {
  return invoke("cmd_credential_backend_status");
}
