import { modioHasOauthToken, modioSetOauthToken, modioGetUser, modioDisconnect, modioGetMyMods, modioGetMod, type ModioModSummary } from "../tauri/modio.js";
import { readProjectFile, writeProjectFile } from "../tauri/project-settings.js";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function extractErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e && typeof (e as Record<string, unknown>).message === "string") {
    return (e as Record<string, unknown>).message as string;
  }
  return String(e);
}

class ModioStore {
  // ── Auth state ──────────────────────────────────────────────────
  isAuthenticated = $state(false);
  userName = $state<string | null>(null);
  userId = $state<number | null>(null);
  avatarUrl = $state<string | null>(null);
  tokenExpiry = $state<Date | null>(null);
  isAuthenticating = $state(false);
  connectionError = $state<string | null>(null);

  /** BG3 game ID on mod.io. */
  readonly GAME_ID = 6715;

  // ── Per-project state ───────────────────────────────────────────
  selectedModId = $state<number | null>(null);
  selectedModName = $state<string | null>(null);
  selectedModNameId = $state<string | null>(null);
  selectedModUrl = $state<string | null>(null);
  userMods = $state<ModioModSummary[]>([]);
  isLoadingMods = $state(false);
  projectPath = $state<string | null>(null);

  #saveTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Computed ────────────────────────────────────────────────────

  get tokenExpired(): boolean {
    return this.tokenExpiry != null && this.tokenExpiry < new Date();
  }

  get daysUntilExpiry(): number {
    if (this.tokenExpiry == null) return Infinity;
    const ms = this.tokenExpiry.getTime() - Date.now();
    if (ms <= 0) return 0;
    return Math.ceil(ms / 86_400_000);
  }

  // ── Methods ─────────────────────────────────────────────────────

  async checkAuth(): Promise<void> {
    if (this.isAuthenticating) return;
    this.isAuthenticating = true;
    try {
      const hasToken = await modioHasOauthToken();
      if (hasToken) {
        const profile = await modioGetUser();
        this.isAuthenticated = true;
        this.userName = profile.name;
        this.userId = profile.id;
        this.avatarUrl = profile.avatar_url;
        // Restore path — we don't know when the token was issued
        this.tokenExpiry = null;
      } else {
        this.isAuthenticated = false;
        this.userName = null;
        this.userId = null;
        this.avatarUrl = null;
        this.tokenExpiry = null;
      }
    } catch {
      this.isAuthenticated = false;
      this.userName = null;
      this.userId = null;
      this.avatarUrl = null;
      this.tokenExpiry = null;
    } finally {
      this.isAuthenticating = false;
    }
  }

  async saveToken(token: string, userId: number): Promise<void> {
    try {
      const profile = await modioSetOauthToken(token, userId);
      this.isAuthenticated = true;
      this.userName = profile.name;
      this.userId = profile.id;
      this.avatarUrl = profile.avatar_url;
      this.tokenExpiry = new Date(Date.now() + 365 * 86_400_000);
      this.connectionError = null;
    } catch (e) {
      this.connectionError = extractErrorMessage(e);
      throw e;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await modioDisconnect();
    } catch (e) {
      console.warn("modioDisconnect failed:", extractErrorMessage(e));
    }
    this.isAuthenticated = false;
    this.userName = null;
    this.userId = null;
    this.avatarUrl = null;
    this.tokenExpiry = null;
    this.connectionError = null;
  }

  // ── Config Persistence ──────────────────────────────────────────

  async loadProjectConfig(path: string): Promise<void> {
    this.projectPath = path;
    if (!path || !isTauri()) return;
    try {
      const content = await readProjectFile(path, "modio.json");
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === "object") {
        this.selectedModId = typeof parsed.selectedModId === "number" ? parsed.selectedModId : null;
        this.selectedModName = typeof parsed.selectedModName === "string" ? parsed.selectedModName : null;
        this.selectedModNameId = typeof parsed.selectedModNameId === "string" ? parsed.selectedModNameId : null;
        this.selectedModUrl = typeof parsed.selectedModUrl === "string" ? parsed.selectedModUrl : null;
      }
    } catch (e) {
      console.warn("[modioStore] Failed to load project config:", e);
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
    if (this.selectedModId != null) config.selectedModId = this.selectedModId;
    if (this.selectedModName != null) config.selectedModName = this.selectedModName;
    if (this.selectedModNameId != null) config.selectedModNameId = this.selectedModNameId;
    if (this.selectedModUrl != null) config.selectedModUrl = this.selectedModUrl;
    try {
      await writeProjectFile(this.projectPath, "modio.json", JSON.stringify(config, null, 2));
    } catch (e) {
      console.warn("[modioStore] Failed to save project config:", e);
    }
  }

  // ── Project Reset ───────────────────────────────────────────────

  resetProject(): void {
    if (this.#saveTimer) {
      clearTimeout(this.#saveTimer);
      this.#saveTimer = null;
    }
    this.selectedModId = null;
    this.selectedModName = null;
    this.selectedModNameId = null;
    this.selectedModUrl = null;
    this.userMods = [];
    this.isLoadingMods = false;
    this.projectPath = null;
  }

  // ── Mod Listing ─────────────────────────────────────────────────

  async loadUserMods(): Promise<void> {
    if (this.isLoadingMods || !this.isAuthenticated) return;
    this.isLoadingMods = true;
    try {
      this.userMods = await modioGetMyMods();
    } catch (e) {
      console.warn("[modioStore] Failed to load user mods:", e);
    } finally {
      this.isLoadingMods = false;
    }
  }

  selectMod(mod: ModioModSummary): void {
    this.selectedModId = mod.id;
    this.selectedModName = mod.name;
    this.selectedModNameId = mod.name_id;
    this.selectedModUrl = `https://mod.io/g/baldursgate3/m/${mod.name_id}`;
    this.saveProjectConfig();
  }

  /** Resolve a mod.io URL or numeric ID to a mod summary and link it. */
  async resolveMod(input: string): Promise<void> {
    const trimmed = input.trim();

    // Extract numeric mod ID from URL or raw number
    let modId: number | null = null;
    const urlMatch = trimmed.match(/mod\.io\/.*?\/m\/[^/]+/i) ? null : trimmed.match(/(\d+)/);
    // Try numeric ID first
    const asNum = parseInt(trimmed, 10);
    if (!isNaN(asNum) && String(asNum) === trimmed) {
      modId = asNum;
    }
    // Try extracting from mod.io URL — mod.io uses name_id in URLs not numeric IDs,
    // so we search the user's mods for a matching name_id
    if (modId == null) {
      const nameIdMatch = trimmed.match(/mod\.io\/.*?\/m\/([a-zA-Z0-9_-]+)/i);
      if (nameIdMatch) {
        const nameId = nameIdMatch[1].toLowerCase();
        const found = this.userMods.find(m => m.name_id.toLowerCase() === nameId);
        if (found) {
          this.selectMod(found);
          return;
        }
      }
      // Also try a generic numeric ID at end of URL
      if (urlMatch) {
        modId = parseInt(urlMatch[1], 10);
      }
    }

    if (modId == null || modId <= 0) {
      throw new Error("Could not parse a mod ID from the input");
    }

    // Check if already in user mods
    const existing = this.userMods.find(m => m.id === modId);
    if (existing) {
      this.selectMod(existing);
      return;
    }

    // Fetch from API
    const mod = await modioGetMod(modId);
    this.selectMod(mod);
  }
}

export const modioStore = new ModioStore();
