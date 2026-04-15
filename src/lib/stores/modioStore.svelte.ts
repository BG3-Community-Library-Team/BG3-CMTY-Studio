/**
 * modioStore — Stub for mod.io state management.
 * Full implementation in 7A-3 / 7A-4.
 */

class ModioStore {
  isAuthenticated = $state(false);
  userName = $state<string | null>(null);
  tokenExpired = $state(false);

  async disconnect(): Promise<void> {
    this.isAuthenticated = false;
    this.userName = null;
  }
}

export const modioStore = new ModioStore();
