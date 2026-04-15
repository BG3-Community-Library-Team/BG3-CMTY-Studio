import { invoke } from "@tauri-apps/api/core";

// ── Nexus IPC Type Definitions ──────────────────────────────────

export interface NexusModDetails {
  id: string;
  game_scoped_id: number;
  name: string;
  summary: string | null;
  thumbnail_url: string | null;
  contains_adult_content: boolean;
  category_name: string | null;
  tags: string[];
}

export interface NexusFileGroup {
  id: string;
  name: string;
  version_count: number;
  last_upload: string | null;
  latest_file_name: string | null;
}

export interface NexusFileVersion {
  id: string;
  name: string;
  version: string;
  category: string | null;
  description: string | null;
  changelog_html: string | null;
  created_at: string | null;
  size_kb: number | null;
}

export interface NexusDependency {
  id: string;
  mod_id: string;
  name: string;
  version: string;
}

export interface NexusUploadParams {
  file_path: string;
  mod_uuid: string;
  file_group_id: string;
  name: string;
  version: string;
  description: string | null;
  category: string | null;
}

export interface NexusPackageUploadParams {
  source_dir: string;
  mod_uuid: string;
  file_group_id: string;
  name: string;
  version: string;
  description: string | null;
  category: string | null;
  exclude_patterns: string[] | null;
}

export interface NexusUserProfile {
  user_id: number;
  name: string;
  profile_url: string | null;
}

// ── API Key Management ──────────────────────────────────────────

export async function nexusHasApiKey(): Promise<boolean> {
  return invoke<boolean>("cmd_nexus_has_api_key");
}

export async function nexusSetApiKey(apiKey: string): Promise<void> {
  return invoke("cmd_nexus_set_api_key", { apiKey });
}

export async function nexusValidateApiKey(): Promise<NexusUserProfile | null> {
  return invoke<NexusUserProfile | null>("cmd_nexus_validate_api_key");
}

export async function nexusClearApiKey(): Promise<void> {
  return invoke("cmd_nexus_clear_api_key");
}

// ── Mod Resolution ──────────────────────────────────────────────

export async function nexusResolveMod(urlOrId: string): Promise<NexusModDetails> {
  return invoke<NexusModDetails>("cmd_nexus_resolve_mod", { urlOrId });
}

// ── File Update Groups ──────────────────────────────────────────

export async function nexusGetFileGroups(modUuid: string): Promise<NexusFileGroup[]> {
  return invoke<NexusFileGroup[]>("cmd_nexus_get_file_groups", { modUuid });
}

// ── File Versions ───────────────────────────────────────────────

export async function nexusGetFileVersions(groupId: string): Promise<NexusFileVersion[]> {
  return invoke<NexusFileVersion[]>("cmd_nexus_get_file_versions", { groupId });
}

export async function nexusGetAllModFiles(modId: number): Promise<NexusFileVersion[]> {
  return invoke<NexusFileVersion[]>("cmd_nexus_get_all_mod_files", { modId });
}

// ── File Upload ─────────────────────────────────────────────────

export async function nexusUploadFile(params: NexusUploadParams): Promise<void> {
  return invoke("cmd_nexus_upload_file", { params });
}

// ── Mod File Creation ───────────────────────────────────────────

export async function nexusCreateModFile(
  modUuid: string,
  uploadId: string,
  name: string,
  version: string,
  description: string,
  category: string,
): Promise<void> {
  return invoke("cmd_nexus_create_mod_file", { modUuid, uploadId, name, version, description, category });
}

// ── Package + Upload ────────────────────────────────────────────

export async function nexusPackageAndUpload(params: NexusPackageUploadParams): Promise<void> {
  return invoke("cmd_nexus_package_and_upload", { params });
}

// ── File Dependencies ───────────────────────────────────────────

export async function nexusGetModRequirements(groupIds: string[]): Promise<NexusDependency[]> {
  return invoke<NexusDependency[]>("cmd_nexus_get_mod_requirements", { groupIds });
}

export async function nexusSetFileDependencies(fileId: string, dependencyModIds: string[]): Promise<void> {
  return invoke("cmd_nexus_set_file_dependencies", { fileId, dependencyModIds });
}

// ── File Group Rename ───────────────────────────────────────────

export async function nexusRenameFileGroup(groupId: string, newName: string): Promise<void> {
  return invoke("cmd_nexus_rename_file_group", { groupId, newName });
}
