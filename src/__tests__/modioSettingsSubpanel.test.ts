/**
 * Tests for ModioSettingsSubpanel — render states, OAuth token input,
 * connected/disconnected states, disconnect action.
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/svelte";

afterEach(cleanup);

// ── Mocks ────────────────────────────────────────────────────────

// Paraglide messages — return the key as text
vi.mock("../paraglide/messages.js", () => {
  const handler: ProxyHandler<Record<string, Function>> = {
    get(_target, prop: string) {
      if (prop === "__esModule") return true;
      if (typeof prop === "symbol") return undefined;
      return (params?: Record<string, string>) => {
        if (params) {
          let msg = prop;
          for (const [key, val] of Object.entries(params)) {
            msg = msg.replace(`{${key}}`, val);
          }
          return msg;
        }
        return prop;
      };
    },
  };
  return { m: new Proxy({} as Record<string, Function>, handler) };
});

// mod.io IPC — all calls resolve to safe defaults
vi.mock("../lib/tauri/modio.js", () => ({
  modioHasOauthToken: vi.fn().mockResolvedValue(false),
  modioSetOauthToken: vi.fn().mockResolvedValue({ id: 1, name: "TestUser", avatar_url: "https://example.com/avatar.png", date_online: 1000 }),
  modioGetUser: vi.fn().mockResolvedValue({ id: 1, name: "TestUser", avatar_url: "https://example.com/avatar.png", date_online: 1000 }),
  modioDisconnect: vi.fn().mockResolvedValue(undefined),
  modioGetMyMods: vi.fn().mockResolvedValue([]),
}));

// Project settings IPC
vi.mock("../lib/tauri/project-settings.js", () => ({
  readProjectFile: vi.fn().mockResolvedValue("{}"),
  writeProjectFile: vi.fn().mockResolvedValue(undefined),
}));

// Mock toastStore
vi.mock("../lib/stores/toastStore.svelte.js", () => ({
  toastStore: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock @lucide/svelte icons
vi.mock("@lucide/svelte/icons/external-link", () => ({ default: {} }));
vi.mock("@lucide/svelte/icons/alert-triangle", () => ({ default: {} }));
vi.mock("@lucide/svelte/icons/loader-2", () => ({ default: {} }));
vi.mock("@lucide/svelte/icons/log-out", () => ({ default: {} }));

// ── Imports ──────────────────────────────────────────────────────

import { modioStore } from "../lib/stores/modioStore.svelte.js";
import ModioSettingsSubpanel from "../components/platform/modio/ModioSettingsSubpanel.svelte";

describe("ModioSettingsSubpanel", () => {
  beforeEach(() => {
    modioStore.resetProject();
    modioStore.isAuthenticated = false;
    modioStore.userName = null;
    modioStore.userId = null;
    modioStore.avatarUrl = null;
    modioStore.tokenExpiry = null;
    modioStore.connectionError = null;
  });

  // ── Disconnected state ─────────────────────────────────

  it("renders OAuth section in disconnected state", () => {
    render(ModioSettingsSubpanel);
    expect(screen.getByText("modio_settings_header")).toBeTruthy();
    expect(screen.getByText("modio_status_disconnected")).toBeTruthy();
    expect(screen.getByLabelText("modio_token_label")).toBeTruthy();
  });

  // ── Connected state ────────────────────────────────────

  it("connected state shows user profile + expiry", () => {
    modioStore.isAuthenticated = true;
    modioStore.userName = "TestUser";
    modioStore.avatarUrl = "https://example.com/avatar.png";
    modioStore.tokenExpiry = new Date(Date.now() + 86_400_000 * 15); // 15 days

    render(ModioSettingsSubpanel);
    expect(screen.getByText(/TestUser/)).toBeTruthy();
    // The avatar img should be present
    const img = document.querySelector('img[loading="lazy"]');
    expect(img).toBeTruthy();
  });

  // ── Disconnect action ──────────────────────────────────

  it("disconnect clears state and returns to disconnected view", async () => {
    modioStore.isAuthenticated = true;
    modioStore.userName = "TestUser";

    render(ModioSettingsSubpanel);

    // Should show connected state
    expect(screen.getByText(/TestUser/)).toBeTruthy();

    // Click disconnect
    const disconnectBtn = screen.getByText("modio_disconnect");
    await fireEvent.click(disconnectBtn);

    // After disconnect, store should be cleared
    expect(modioStore.isAuthenticated).toBe(false);
  });
});
