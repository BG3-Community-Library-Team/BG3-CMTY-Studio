import {
  nexusHasApiKey,
  nexusSetApiKey,
  nexusValidateApiKey,
  nexusClearApiKey,
  nexusResolveMod,
  nexusGetFileGroups,
  type NexusFileGroup,
} from "../tauri/nexus.js";
import { readProjectFile, writeProjectFile } from "../tauri/project-settings.js";

export type { NexusFileGroup };

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

class NexusStore {
  // ── Connection state (app-scoped) ───────────────────────────────
  apiKeyValid: boolean = $state(false);
  isValidating: boolean = $state(false);
  connectionError: string | null = $state(null);

  // ── Per-project state ───────────────────────────────────────────
  modId: string | null = $state(null);
  modName: string | null = $state(null);
  modUuid: string | null = $state(null);
  fileGroups: NexusFileGroup[] = $state([]);
  selectedFileGroupId: string | null = $state(null);
  gameDomain: string = $state("baldursgate3");
  category: string | null = $state(null);
  defaultFileGroup: string = $state("");
  modUrl: string | null = $state(null);
  projectPath: string | null = $state(null);

  #saveTimer: ReturnType<typeof setTimeout> | null = null;

  // ── API Key Methods ─────────────────────────────────────────────

  async checkApiKey(): Promise<void> {
    if (this.isValidating) return;
    try {
      this.apiKeyValid = await nexusHasApiKey();
    } catch (e) {
      this.apiKeyValid = false;
      this.connectionError = e instanceof Error ? e.message : String(e);
    }
  }

  async setApiKey(key: string): Promise<void> {
    try {
      await nexusSetApiKey(key);
      await this.checkApiKey();
    } catch (e) {
      this.connectionError = e instanceof Error ? e.message : String(e);
    }
  }

  async validateApiKey(): Promise<void> {
    this.isValidating = true;
    this.connectionError = null;
    try {
      this.apiKeyValid = await nexusValidateApiKey();
    } catch (e) {
      this.apiKeyValid = false;
      this.connectionError = e instanceof Error ? e.message : String(e);
    } finally {
      this.isValidating = false;
    }
  }

  async clearApiKey(): Promise<void> {
    try {
      await nexusClearApiKey();
      this.apiKeyValid = false;
    } catch (e) {
      this.connectionError = e instanceof Error ? e.message : String(e);
    }
  }

  // ── Mod Resolution ──────────────────────────────────────────────

  async resolveMod(urlOrId: string): Promise<void> {
    try {
      const details = await nexusResolveMod(urlOrId);
      this.modId = String(details.game_scoped_id);
      this.modName = details.name;
      this.modUuid = details.id;
    } catch (e) {
      this.connectionError = e instanceof Error ? e.message : String(e);
    }
  }

  // ── File Groups ─────────────────────────────────────────────────

  async loadFileGroups(): Promise<void> {
    try {
      this.fileGroups = await nexusGetFileGroups(this.modUuid!);
    } catch (e) {
      this.connectionError = e instanceof Error ? e.message : String(e);
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
        this.selectedFileGroupId = typeof parsed.selectedFileGroupId === "string" ? parsed.selectedFileGroupId : null;
        this.category = typeof parsed.category === "string" ? parsed.category : null;
        this.defaultFileGroup = typeof parsed.defaultFileGroup === "string" ? parsed.defaultFileGroup : "";
      }
    } catch (e) {
      // Corrupted or missing JSON — use defaults, don't crash
      console.warn("[nexusStore] Failed to load project config:", e);
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
    if (this.selectedFileGroupId != null) config.selectedFileGroupId = this.selectedFileGroupId;
    if (this.category != null) config.category = this.category;
    if (this.defaultFileGroup) config.defaultFileGroup = this.defaultFileGroup;
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
    this.fileGroups = [];
    this.selectedFileGroupId = null;
    this.category = null;
    this.defaultFileGroup = "";
    this.projectPath = null;
  }
}

export const nexusStore = new NexusStore();
