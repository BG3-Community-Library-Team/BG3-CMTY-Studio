import {
  nexusHasApiKey,
  nexusSetApiKey,
  nexusValidateApiKey,
  nexusClearApiKey,
  nexusResolveMod,
  nexusGetFileGroups,
  type NexusFileGroup,
  type NexusUserProfile,
} from "../tauri/nexus.js";
import { readProjectFile, writeProjectFile } from "../tauri/project-settings.js";

export type { NexusFileGroup };

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Extract a human-readable message from a Tauri IPC error or plain Error. */
function extractErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e && typeof (e as Record<string, unknown>).message === "string") {
    return (e as Record<string, unknown>).message as string;
  }
  return String(e);
}

class NexusStore {
  // ── Connection state (app-scoped) ───────────────────────────────
  apiKeyValid: boolean = $state(false);
  isValidating: boolean = $state(false);
  connectionError: string | null = $state(null);
  /** Authenticated user profile (name + profile URL) from Nexus v1 validate. */
  userProfile: NexusUserProfile | null = $state(null);

  // ── Per-project state ───────────────────────────────────────────
  modId: string | null = $state(null);
  modName: string | null = $state(null);
  modUuid: string | null = $state(null);
  modSummary: string | null = $state(null);
  modThumbnailUrl: string | null = $state(null);
  modTags: string[] = $state([]);
  modCategoryName: string | null = $state(null);
  modAdultContent: boolean = $state(false);
  fileGroups: NexusFileGroup[] = $state([]);
  selectedFileGroupId: string | null = $state(null);
  gameDomain: string = $state("baldursgate3");
  category: string | null = $state(null);
  defaultFileGroup: string = $state("");
  modUrl: string | null = $state(null);
  /** When true, use the Upload API v3 (file-group based). When false, use v1. */
  useUploadV3: boolean = $state(false);
  /** Epoch ms when mod data was last fetched from the Nexus API. */
  lastFetchedAt: number | null = $state(null);
  projectPath: string | null = $state(null);

  /** 24 hours in milliseconds. */
  static readonly CACHE_TTL_MS = 86_400_000;

  /** Epoch ms when the API key was last validated successfully. */
  lastApiKeyCheckAt: number | null = $state(null);

  #saveTimer: ReturnType<typeof setTimeout> | null = null;

  // ── API Key Methods ─────────────────────────────────────────────

  /** True when the cached API key validation is still fresh (< 24 h). */
  isApiKeyCheckFresh(): boolean {
    if (!this.lastApiKeyCheckAt || !this.apiKeyValid) return false;
    return Date.now() - this.lastApiKeyCheckAt < NexusStore.CACHE_TTL_MS;
  }

  async checkApiKey(): Promise<void> {
    if (this.isValidating) return;
    // Skip re-validation if we validated successfully within the TTL window
    if (this.isApiKeyCheckFresh()) return;
    try {
      const hasKey = await nexusHasApiKey();
      if (hasKey) {
        // Key exists — validate it automatically so the user doesn't need to click "Test"
        await this.validateApiKey();
      } else {
        this.apiKeyValid = false;
        this.lastApiKeyCheckAt = null;
      }
    } catch (e) {
      this.apiKeyValid = false;
      this.lastApiKeyCheckAt = null;
      this.connectionError = extractErrorMessage(e);
    }
  }

  async setApiKey(key: string): Promise<void> {
    try {
      await nexusSetApiKey(key);
      await this.checkApiKey();
    } catch (e) {
      this.connectionError = extractErrorMessage(e);
    }
  }

  async validateApiKey(): Promise<void> {
    this.isValidating = true;
    this.connectionError = null;
    try {
      const profile = await nexusValidateApiKey();
      this.apiKeyValid = profile != null;
      this.userProfile = profile;
      this.lastApiKeyCheckAt = this.apiKeyValid ? Date.now() : null;
    } catch (e) {
      this.apiKeyValid = false;
      this.userProfile = null;
      this.lastApiKeyCheckAt = null;
      this.connectionError = extractErrorMessage(e);
    } finally {
      this.isValidating = false;
    }
  }

  async clearApiKey(): Promise<void> {
    try {
      await nexusClearApiKey();
      this.apiKeyValid = false;
      this.userProfile = null;
      this.lastApiKeyCheckAt = null;
    } catch (e) {
      this.connectionError = extractErrorMessage(e);
    }
  }

  // ── Mod Resolution ──────────────────────────────────────────────

  async resolveMod(urlOrId: string): Promise<void> {
    try {
      const details = await nexusResolveMod(urlOrId);
      this.modId = String(details.game_scoped_id);
      this.modName = details.name;
      this.modUuid = details.id;
      this.modSummary = details.summary;
      this.modThumbnailUrl = details.thumbnail_url;
      this.modTags = details.tags;
      this.modCategoryName = details.category_name;
      this.modAdultContent = details.contains_adult_content;
      this.lastFetchedAt = Date.now();
    } catch (e) {
      this.connectionError = extractErrorMessage(e);
    }
  }

  /** True when cached data is missing or older than CACHE_TTL_MS (24 h). */
  isStale(): boolean {
    if (this.lastFetchedAt == null) return true;
    return Date.now() - this.lastFetchedAt > NexusStore.CACHE_TTL_MS;
  }

  /** Re-fetches mod data if stale and a mod is linked. */
  async refreshIfStale(): Promise<void> {
    if (!this.modId || !this.isStale()) return;
    await this.resolveMod(this.modId);
    this.saveProjectConfig();
  }

  // ── File Groups ─────────────────────────────────────────────────

  async loadFileGroups(): Promise<void> {
    try {
      this.fileGroups = await nexusGetFileGroups(this.modUuid!);
      // Auto-select the only file group, or the first one if none is selected
      if (!this.selectedFileGroupId && this.fileGroups.length > 0) {
        this.selectedFileGroupId = this.fileGroups[0].id;
      }
    } catch (e) {
      this.connectionError = extractErrorMessage(e);
    }
  }

  // ── Config Persistence ──────────────────────────────────────────

  async loadProjectConfig(projectPath: string): Promise<void> {
    this.projectPath = projectPath;
    if (!projectPath || !isTauri()) {
      return;
    }
    try {
      const content = await readProjectFile(projectPath, "nexus.json");
      const parsed = JSON.parse(content);
      // Validate shape — only load known keys
      if (parsed && typeof parsed === "object") {
        this.modId = typeof parsed.modId === "string" ? parsed.modId : null;
        this.modUuid = typeof parsed.modUuid === "string" ? parsed.modUuid : null;
        this.modName = typeof parsed.modName === "string" ? parsed.modName : null;
        this.modUrl = typeof parsed.modUrl === "string" ? parsed.modUrl : null;
        this.modSummary = typeof parsed.modSummary === "string" ? parsed.modSummary : null;
        this.modThumbnailUrl = typeof parsed.modThumbnailUrl === "string" ? parsed.modThumbnailUrl : null;
        this.modTags = Array.isArray(parsed.modTags) ? parsed.modTags : [];
        this.modCategoryName = typeof parsed.modCategoryName === "string" ? parsed.modCategoryName : null;
        this.modAdultContent = typeof parsed.modAdultContent === "boolean" ? parsed.modAdultContent : false;
        this.lastFetchedAt = typeof parsed.lastFetchedAt === "number" ? parsed.lastFetchedAt : null;
        this.selectedFileGroupId = typeof parsed.selectedFileGroupId === "string" ? parsed.selectedFileGroupId : null;
        this.category = typeof parsed.category === "string" ? parsed.category : null;
        this.defaultFileGroup = typeof parsed.defaultFileGroup === "string" ? parsed.defaultFileGroup : "";
        this.useUploadV3 = typeof parsed.useUploadV3 === "boolean" ? parsed.useUploadV3 : false;
      }
    } catch (e) {
      // Corrupted or missing JSON — use defaults, don't crash
      console.warn("[nexusStore] Failed to load project config:", e);
    }

    // Migration: old configs stored a v1 numeric uid as modUuid.
    // The v3 API needs a real UUID. Force re-resolution on next refreshIfStale.
    if (this.modUuid && /^\d+$/.test(this.modUuid)) {
      console.warn("[nexusStore] Detected numeric modUuid (v1 uid), forcing re-resolve");
      this.lastFetchedAt = null;
    }
  }

  saveProjectConfig(): void {
    if (!this.projectPath || !isTauri()) return;
    if (this.#saveTimer) clearTimeout(this.#saveTimer);
    this.#saveTimer = setTimeout(() => {
      this.#executeSave();
    }, 500);
  }

  async #executeSave(): Promise<void> {
    if (!this.projectPath) return;
    const config: Record<string, unknown> = {};
    if (this.modId != null) config.modId = this.modId;
    if (this.modUuid != null) config.modUuid = this.modUuid;
    if (this.modName != null) config.modName = this.modName;
    if (this.modUrl != null) config.modUrl = this.modUrl;
    if (this.modSummary != null) config.modSummary = this.modSummary;
    if (this.modThumbnailUrl != null) config.modThumbnailUrl = this.modThumbnailUrl;
    if (this.modTags.length > 0) config.modTags = this.modTags;
    if (this.modCategoryName != null) config.modCategoryName = this.modCategoryName;
    if (this.modAdultContent) config.modAdultContent = this.modAdultContent;
    if (this.lastFetchedAt != null) config.lastFetchedAt = this.lastFetchedAt;
    if (this.selectedFileGroupId != null) config.selectedFileGroupId = this.selectedFileGroupId;
    if (this.category != null) config.category = this.category;
    if (this.defaultFileGroup) config.defaultFileGroup = this.defaultFileGroup;
    if (this.useUploadV3) config.useUploadV3 = this.useUploadV3;
    try {
      await writeProjectFile(this.projectPath, "nexus.json", JSON.stringify(config, null, 2));
    } catch (e) {
      console.warn("[nexusStore] Failed to save project config:", e);
    }
  }

  // ── Project Reset ───────────────────────────────────────────────

  resetProject(): void {
    if (this.#saveTimer) {
      clearTimeout(this.#saveTimer);
      this.#saveTimer = null;
    }
    this.modId = null;
    this.modName = null;
    this.modUuid = null;
    this.modUrl = null;
    this.modSummary = null;
    this.modThumbnailUrl = null;
    this.modTags = [];
    this.modCategoryName = null;
    this.modAdultContent = false;
    this.lastFetchedAt = null;
    this.lastApiKeyCheckAt = null;
    this.fileGroups = [];
    this.selectedFileGroupId = null;
    this.category = null;
    this.defaultFileGroup = "";
    this.useUploadV3 = false;
    this.projectPath = null;
  }
}

export const nexusStore = new NexusStore();
