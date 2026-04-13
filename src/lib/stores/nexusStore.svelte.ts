import {
  nexusHasApiKey,
  nexusSetApiKey,
  nexusValidateApiKey,
  nexusClearApiKey,
  nexusResolveMod,
  nexusGetFileGroups,
  type NexusFileGroup,
} from "../tauri/nexus.js";

export type { NexusFileGroup };

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

  // ── API Key Methods ─────────────────────────────────────────────

  async checkApiKey(): Promise<void> {
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

  // ── Project Reset ───────────────────────────────────────────────

  resetProject(): void {
    this.modId = null;
    this.modName = null;
    this.modUuid = null;
    this.fileGroups = [];
    this.selectedFileGroupId = null;
    this.category = null;
  }
}

export const nexusStore = new NexusStore();
