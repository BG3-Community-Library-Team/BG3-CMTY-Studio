import {
  modioHasOauthToken,
  modioSetOauthToken,
  modioGetUser,
  modioGetMyMods,
  modioDisconnect,
  type ModioModSummary,
  type ModioUserProfile,
} from "../tauri/modio.js";

export type { ModioModSummary, ModioUserProfile };

class ModioStore {
  // ── Connection state (app-scoped) ───────────────────────────────
  isAuthenticated: boolean = $state(false);
  userName: string = $state("");
  userId: string = $state("");
  avatarUrl: string = $state("");
  connectionError: string | null = $state(null);
  tokenExpiry: string = $state("");
  gameId: string = $state("629");

  // ── Per-project state ───────────────────────────────────────────
  userMods: ModioModSummary[] = $state([]);
  selectedModId: number | null = $state(null);

  // ── Derived state ───────────────────────────────────────────────
  tokenExpired: boolean = $derived(
    this.tokenExpiry !== "" && new Date(this.tokenExpiry) < new Date(),
  );

  daysUntilExpiry: number = $derived.by(() => {
    if (this.tokenExpiry === "") return -1;
    const diff = new Date(this.tokenExpiry).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  });

  // ── Methods ─────────────────────────────────────────────────────

  async checkAuth(): Promise<void> {
    try {
      this.connectionError = null;
      const hasToken = await modioHasOauthToken();
      if (hasToken) {
        const user = await modioGetUser();
        this.isAuthenticated = true;
        this.userName = user.name;
        this.userId = String(user.id);
        this.avatarUrl = user.avatar_url;
      } else {
        this.isAuthenticated = false;
      }
    } catch (e) {
      this.connectionError = e instanceof Error ? e.message : String(e);
      this.isAuthenticated = false;
    }
  }

  async saveToken(token: string): Promise<void> {
    try {
      this.connectionError = null;
      const user = await modioSetOauthToken(token);
      this.isAuthenticated = true;
      this.userName = user.name;
      this.userId = String(user.id);
      this.avatarUrl = user.avatar_url;
    } catch (e) {
      this.connectionError = e instanceof Error ? e.message : String(e);
    }
  }

  async getProfile(): Promise<void> {
    try {
      this.connectionError = null;
      const user = await modioGetUser();
      this.userName = user.name;
      this.userId = String(user.id);
      this.avatarUrl = user.avatar_url;
    } catch (e) {
      this.connectionError = e instanceof Error ? e.message : String(e);
    }
  }

  async loadUserMods(): Promise<void> {
    try {
      this.connectionError = null;
      this.userMods = await modioGetMyMods(Number(this.gameId));
    } catch (e) {
      this.connectionError = e instanceof Error ? e.message : String(e);
    }
  }

  async disconnect(): Promise<void> {
    try {
      await modioDisconnect();
      this.isAuthenticated = false;
      this.userName = "";
      this.userId = "";
      this.avatarUrl = "";
      this.connectionError = null;
      this.tokenExpiry = "";
    } catch (e) {
      this.connectionError = e instanceof Error ? e.message : String(e);
    }
  }

  resetProject(): void {
    this.userMods = [];
    this.selectedModId = null;
  }
}

export const modioStore = new ModioStore();
