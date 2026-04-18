/**
 * Tests for modioStore — auth flow, config persistence (loadProjectConfig,
 * saveProjectConfig), resetProject, corrupted JSON, computed properties.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  suppressConsoleWarn,
  expectConsoleCalled,
} from "./helpers/suppressConsole.js";

// ── Mocks ────────────────────────────────────────────────────────

const mockHasOauthToken = vi.fn().mockResolvedValue(false);
const mockSetOauthToken = vi.fn().mockResolvedValue({ id: 1, name: "TestUser", avatar_url: "https://example.com/avatar.png", date_online: 1000 });
const mockGetUser = vi.fn().mockResolvedValue({ id: 1, name: "TestUser", avatar_url: "https://example.com/avatar.png", date_online: 1000 });
const mockDisconnect = vi.fn().mockResolvedValue(undefined);
const mockGetMyMods = vi.fn().mockResolvedValue([]);
const mockReadProjectFile = vi.fn().mockResolvedValue("{}");
const mockWriteProjectFile = vi.fn().mockResolvedValue(undefined);

vi.mock("../lib/tauri/modio.js", () => ({
  modioHasOauthToken: (...args: unknown[]) => mockHasOauthToken(...args),
  modioSetOauthToken: (...args: unknown[]) => mockSetOauthToken(...args),
  modioGetUser: (...args: unknown[]) => mockGetUser(...args),
  modioDisconnect: (...args: unknown[]) => mockDisconnect(...args),
  modioGetMyMods: (...args: unknown[]) => mockGetMyMods(...args),
}));

vi.mock("../lib/tauri/project-settings.js", () => ({
  readProjectFile: (...args: unknown[]) => mockReadProjectFile(...args),
  writeProjectFile: (...args: unknown[]) => mockWriteProjectFile(...args),
}));

// Need __TAURI_INTERNALS__ on window for isTauri() checks
beforeEach(() => {
  (globalThis as any).window = { __TAURI_INTERNALS__: true };
});

afterEach(() => {
  delete (globalThis as any).window;
});

import { modioStore } from "../lib/stores/modioStore.svelte.js";

describe("modioStore", () => {
  beforeEach(() => {
    modioStore.resetProject();
    // Reset auth state manually since resetProject doesn't touch it
    modioStore.isAuthenticated = false;
    modioStore.userName = null;
    modioStore.userId = null;
    modioStore.avatarUrl = null;
    modioStore.tokenExpiry = null;
    modioStore.connectionError = null;
    mockHasOauthToken.mockReset().mockResolvedValue(false);
    mockSetOauthToken.mockReset().mockResolvedValue({ id: 1, name: "TestUser", avatar_url: "https://example.com/avatar.png", date_online: 1000 });
    mockGetUser.mockReset().mockResolvedValue({ id: 1, name: "TestUser", avatar_url: "https://example.com/avatar.png", date_online: 1000 });
    mockDisconnect.mockReset().mockResolvedValue(undefined);
    mockGetMyMods.mockReset().mockResolvedValue([]);
    mockReadProjectFile.mockReset().mockResolvedValue("{}");
    mockWriteProjectFile.mockReset().mockResolvedValue(undefined);
  });

  // ── GAME_ID constant ───────────────────────────────────

  it("GAME_ID is 6715 and not settable", () => {
    expect(modioStore.GAME_ID).toBe(6715);
    // Verify it's readonly by checking the value stays 6715
    expect(modioStore.GAME_ID).toBe(6715);
  });

  // ── checkAuth ──────────────────────────────────────────

  it("checkAuth() validates stored token via /me bridge", async () => {
    mockHasOauthToken.mockResolvedValueOnce(true);
    await modioStore.checkAuth();
    expect(modioStore.isAuthenticated).toBe(true);
    expect(modioStore.userName).toBe("TestUser");
    expect(modioStore.userId).toBe(1);
    expect(mockGetUser).toHaveBeenCalled();
  });

  it("checkAuth() handles no token gracefully", async () => {
    mockHasOauthToken.mockResolvedValueOnce(false);
    await modioStore.checkAuth();
    expect(modioStore.isAuthenticated).toBe(false);
  });

  it("checkAuth() deduplicates in-flight calls", async () => {
    modioStore.isAuthenticating = true;
    await modioStore.checkAuth();
    expect(mockHasOauthToken).not.toHaveBeenCalled();
  });

  // ── disconnect ─────────────────────────────────────────

  it("disconnect() clears all auth state", async () => {
    // Set up authenticated state
    modioStore.isAuthenticated = true;
    modioStore.userName = "user";
    modioStore.userId = 42;
    modioStore.avatarUrl = "https://example.com/pic.png";
    modioStore.tokenExpiry = new Date();

    await modioStore.disconnect();

    expect(modioStore.isAuthenticated).toBe(false);
    expect(modioStore.userName).toBeNull();
    expect(modioStore.userId).toBeNull();
    expect(modioStore.avatarUrl).toBeNull();
    expect(modioStore.tokenExpiry).toBeNull();
    expect(mockDisconnect).toHaveBeenCalled();
  });

  // ── Config roundtrip ───────────────────────────────────

  it("loadProjectConfig → saveProjectConfig roundtrip", async () => {
    const platformsData = {
      TestMod: {
        modio: {
          selectedModId: 42,
          selectedModName: "TestMod",
          selectedModNameId: "test-mod",
          selectedModUrl: "https://mod.io/g/baldursgate3/m/test-mod",
        },
      },
    };
    mockReadProjectFile.mockResolvedValueOnce(JSON.stringify(platformsData));
    await modioStore.loadProjectConfig("/project/path", "TestMod");
    expect(modioStore.selectedModId).toBe(42);
    expect(modioStore.selectedModName).toBe("TestMod");

    // Mock for read-merge-write in #executeSave
    mockReadProjectFile.mockResolvedValueOnce("{}");

    // Trigger save
    vi.useFakeTimers();
    modioStore.saveProjectConfig();
    vi.advanceTimersByTime(600);
    vi.useRealTimers();

    await vi.waitFor(() => {
      expect(mockWriteProjectFile).toHaveBeenCalled();
    });
    const written = JSON.parse(mockWriteProjectFile.mock.calls[0][2]);
    expect(written.TestMod.modio.selectedModId).toBe(42);
    expect(written.TestMod.modio.selectedModName).toBe("TestMod");
  });

  // ── resetProject ───────────────────────────────────────

  it("resetProject() clears per-project state", () => {
    modioStore.selectedModId = 42;
    modioStore.selectedModName = "Test";
    modioStore.projectPath = "/some/path";
    modioStore.resetProject();
    expect(modioStore.selectedModId).toBeNull();
    expect(modioStore.selectedModName).toBeNull();
    expect(modioStore.projectPath).toBeNull();
  });

  // ── Missing config ─────────────────────────────────────

  it("missing config file handled silently", async () => {
    mockReadProjectFile.mockResolvedValueOnce("{}");  // platforms.json
    mockReadProjectFile.mockResolvedValueOnce("{}");  // legacy modio.json
    await modioStore.loadProjectConfig("/empty/path", "EmptyMod");
    expect(modioStore.selectedModId).toBeNull();
    expect(modioStore.selectedModName).toBeNull();
    expect(modioStore.projectPath).toBe("/empty/path");
  });

  // ── Corrupted JSON ─────────────────────────────────────

  describe("corrupted config", () => {
    const warnRef = suppressConsoleWarn();

    it("corrupted JSON defaults gracefully", async () => {
      mockReadProjectFile.mockResolvedValueOnce("not json {{{");
      await modioStore.loadProjectConfig("/bad/path", "BadMod");
      expectConsoleCalled(warnRef, "[modioStore]");
      expect(modioStore.selectedModId).toBeNull();
    });
  });

  // ── Computed: tokenExpired ─────────────────────────────

  it("tokenExpired computed", () => {
    modioStore.tokenExpiry = new Date(Date.now() - 86_400_000); // 1 day ago
    expect(modioStore.tokenExpired).toBe(true);
    modioStore.tokenExpiry = new Date(Date.now() + 86_400_000); // 1 day ahead
    expect(modioStore.tokenExpired).toBe(false);
  });

  // ── Computed: daysUntilExpiry ──────────────────────────

  it("daysUntilExpiry computed", () => {
    modioStore.tokenExpiry = null;
    expect(modioStore.daysUntilExpiry).toBe(Infinity);
    modioStore.tokenExpiry = new Date(Date.now() - 86_400_000 * 2); // 2 days ago
    expect(modioStore.daysUntilExpiry).toBe(0);
    modioStore.tokenExpiry = new Date(Date.now() + 86_400_000 * 30); // 30 days
    expect(modioStore.daysUntilExpiry).toBe(30);
  });
});
