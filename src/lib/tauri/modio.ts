import { invoke } from "@tauri-apps/api/core";

// ── mod.io IPC Type Definitions ─────────────────────────────────

export interface ModioUserProfile {
  id: number;
  name: string;
  avatar_url: string;
  date_online: number;
}

export interface ModioModStats {
  downloads_total: number;
  subscribers_total: number;
  ratings_positive: number;
  ratings_negative: number;
}

export interface ModioModSummary {
  id: number;
  name: string;
  name_id: string;
  summary: string;
  logo_url: string;
  status: number;
  visibility: number;
  date_added: number;
  date_updated: number;
  stats: ModioModStats;
}

export interface ModioModResponse {
  id: number;
  name: string;
  name_id: string;
  status: number;
  date_added: number;
}

export interface CreateModParams {
  name: string;
  logo_path: string;
  summary?: string;
  description?: string;
  homepage_url?: string;
  visible?: number;
  tags?: string[];
}

export interface EditModParams {
  mod_id: number;
  name?: string;
  summary?: string;
  description?: string;
  homepage_url?: string;
  visible?: number;
  maturity_option?: number;
  logo_path?: string;
}

export interface AddMediaParams {
  mod_id: number;
  image_paths?: string[];
  logo_path?: string;
  youtube_urls?: string[];
}

export interface ModioDependency {
  mod_id: number;
  name: string;
  name_id: string;
  date_added: number;
}

export interface TagOption {
  name: string;
  tag_type: string;
  tags: string[];
}

export interface MetadataEntry {
  metakey: string;
  metavalue: string;
}

export interface ModioFileEntry {
  id: number;
  mod_id: number;
  filename: string;
  version: string | null;
  filesize: number;
  date_added: number;
  changelog: string | null;
  virus_status: number;
}

export interface EditFileParams {
  mod_id: number;
  file_id: number;
  version?: string;
  changelog?: string;
  active?: boolean;
}

export interface ModioUploadParams {
  mod_id: number;
  file_path: string;
  version: string;
  changelog?: string;
  active?: boolean;
  metadata_blob?: string;
}

export interface ModioModfileResponse {
  id: number;
  mod_id: number;
  filename: string;
  version: string | null;
  filesize: number;
  virus_status: number;
}

// ── Authentication & Credential Commands ────────────────────────

export async function modioHasOauthToken(): Promise<boolean> {
  return invoke("cmd_modio_has_oauth_token");
}

export async function modioSetOauthToken(token: string): Promise<ModioUserProfile> {
  return invoke("cmd_modio_set_oauth_token", { token });
}

export async function modioDisconnect(): Promise<void> {
  return invoke("cmd_modio_disconnect");
}

export async function modioGetUser(): Promise<ModioUserProfile> {
  return invoke("cmd_modio_get_user");
}

// ── Mod Listing ─────────────────────────────────────────────────

export async function modioGetMyMods(): Promise<ModioModSummary[]> {
  return invoke("cmd_modio_get_my_mods", { gameId: 629 });
}

// ── Mod Profile Management ──────────────────────────────────────

export async function modioCreateMod(params: CreateModParams): Promise<ModioModResponse> {
  return invoke("cmd_modio_create_mod", { params: { ...params, game_id: 629 } });
}

export async function modioEditMod(params: EditModParams): Promise<ModioModResponse> {
  return invoke("cmd_modio_edit_mod", { params: { ...params, game_id: 629 } });
}

// ── Media Management ────────────────────────────────────────────

export async function modioAddMedia(params: AddMediaParams): Promise<void> {
  return invoke("cmd_modio_add_media", { params: { ...params, game_id: 629 } });
}

export async function modioDeleteMedia(modId: number, filenames: string[]): Promise<void> {
  return invoke("cmd_modio_delete_media", { gameId: 629, modId, filenames });
}

// ── File/Version Management ─────────────────────────────────────

export async function modioListFiles(modId: number): Promise<ModioFileEntry[]> {
  return invoke("cmd_modio_list_files", { gameId: 629, modId });
}

export async function modioEditFile(params: EditFileParams): Promise<void> {
  return invoke("cmd_modio_edit_file", { params: { ...params, game_id: 629 } });
}

export async function modioDeleteFile(modId: number, fileId: number): Promise<void> {
  return invoke("cmd_modio_delete_file", { gameId: 629, modId, fileId });
}

export async function modioUploadFile(params: ModioUploadParams): Promise<ModioModfileResponse> {
  return invoke("cmd_modio_upload_file", { params: { ...params, game_id: 629 } });
}

// ── Dependency Management ───────────────────────────────────────

export async function modioGetDependencies(modId: number): Promise<ModioDependency[]> {
  return invoke("cmd_modio_get_dependencies", { gameId: 629, modId });
}

export async function modioAddDependencies(modId: number, dependencyIds: number[]): Promise<void> {
  return invoke("cmd_modio_add_dependencies", { gameId: 629, modId, dependencyIds });
}

export async function modioRemoveDependencies(modId: number, dependencyIds: number[]): Promise<void> {
  return invoke("cmd_modio_remove_dependencies", { gameId: 629, modId, dependencyIds });
}

// ── Tag Management ──────────────────────────────────────────────

export async function modioGetGameTags(): Promise<TagOption[]> {
  return invoke("cmd_modio_get_game_tags", { gameId: 629 });
}

export async function modioAddTags(modId: number, tags: string[]): Promise<void> {
  return invoke("cmd_modio_add_tags", { gameId: 629, modId, tags });
}

export async function modioRemoveTags(modId: number, tags: string[]): Promise<void> {
  return invoke("cmd_modio_remove_tags", { gameId: 629, modId, tags });
}

// ── Metadata KVP ────────────────────────────────────────────────

export async function modioGetMetadata(modId: number): Promise<MetadataEntry[]> {
  return invoke("cmd_modio_get_metadata", { gameId: 629, modId });
}

export async function modioAddMetadata(modId: number, entries: MetadataEntry[]): Promise<void> {
  return invoke("cmd_modio_add_metadata", { gameId: 629, modId, entries });
}

export async function modioRemoveMetadata(modId: number, entries: MetadataEntry[]): Promise<void> {
  return invoke("cmd_modio_remove_metadata", { gameId: 629, modId, entries });
}
