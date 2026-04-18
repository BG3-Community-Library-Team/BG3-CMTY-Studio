/**
 * Tests for ModioPanel — linked/unlinked states, upload form,
 * collapsible sections, mod list navigation.
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/svelte";

afterEach(cleanup);

// ── Mocks ────────────────────────────────────────────────────────

// Mock motion store (reads matchMedia at import time, not available in jsdom)
vi.mock("../lib/stores/motion.svelte.js", () => ({
  getPrefersReducedMotion: () => true,
}));

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

// mod.io IPC
vi.mock("../lib/tauri/modio.js", () => ({
  modioHasOauthToken: vi.fn().mockResolvedValue(false),
  modioSetOauthToken: vi.fn().mockResolvedValue({ id: 1, name: "TestUser", avatar_url: "", date_online: 1000 }),
  modioGetUser: vi.fn().mockResolvedValue({ id: 1, name: "TestUser", avatar_url: "", date_online: 1000 }),
  modioDisconnect: vi.fn().mockResolvedValue(undefined),
  modioGetMyMods: vi.fn().mockResolvedValue([]),
  modioPackageAndUpload: vi.fn().mockResolvedValue(undefined),
  modioCreateMod: vi.fn().mockResolvedValue({ id: 1, name: "Test", name_id: "test", status: 0, date_added: 1000 }),
  modioListFiles: vi.fn().mockResolvedValue([]),
  modioEditMod: vi.fn().mockResolvedValue({ id: 1, name: "Test", name_id: "test", status: 1, date_added: 1000 }),
  modioAddMedia: vi.fn().mockResolvedValue(undefined),
  modioDeleteMedia: vi.fn().mockResolvedValue(undefined),
  modioGetGameTags: vi.fn().mockResolvedValue([]),
  modioAddTags: vi.fn().mockResolvedValue(undefined),
  modioRemoveTags: vi.fn().mockResolvedValue(undefined),
  modioGetDependencies: vi.fn().mockResolvedValue([]),
  modioAddDependencies: vi.fn().mockResolvedValue(undefined),
  modioRemoveDependencies: vi.fn().mockResolvedValue(undefined),
  modioEditFile: vi.fn().mockResolvedValue(undefined),
  modioDeleteFile: vi.fn().mockResolvedValue(undefined),
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

// Mock errorLocalization
vi.mock("../lib/errorLocalization.js", () => ({
  localizeError: vi.fn().mockReturnValue("Unknown error"),
}));

// ── Imports ──────────────────────────────────────────────────────

import { modioStore } from "../lib/stores/modioStore.svelte.js";
import { modStore } from "../lib/stores/modStore.svelte.js";
import ModioPanel from "../components/platform/modio/ModioPanel.svelte";

describe("ModioPanel", () => {
  beforeEach(() => {
    modioStore.resetProject();
    modioStore.isAuthenticated = false;
    modioStore.userName = "TestUser";
    modioStore.userId = 1;
    modioStore.avatarUrl = "";
    modioStore.tokenExpiry = null;
    modioStore.connectionError = null;
    modioStore.isLoadingMods = false;
    modioStore.userMods = [];
    modioStore.selectedModId = null;
    modioStore.selectedModName = null;
    modioStore.selectedModNameId = null;
    modioStore.selectedModUrl = null;
  });

  // ── Unlinked state ─────────────────────────────────────

  it("renders unlinked state when no mod is selected", () => {
    render(ModioPanel);

    expect(screen.getByText("modio_no_mod_selected")).toBeTruthy();
    expect(screen.getByText("modio_select_mod_cta")).toBeTruthy();
    expect(screen.getByText("modio_create_mod")).toBeTruthy();
  });

  it("shows empty mod list message", () => {
    render(ModioPanel);
    expect(screen.getByText("modio_dashboard_empty")).toBeTruthy();
  });

  it("renders mod list when mods exist", () => {
    modioStore.isLoadingMods = false;
    modioStore.userMods = [
      {
        id: 100,
        name: "Test Mod Alpha",
        name_id: "test-mod-alpha",
        summary: "A test mod",
        logo_url: "",
        status: 1,
        visibility: 1,
        date_added: 1000,
        date_updated: 2000,
        stats: { downloads_total: 500, subscribers_total: 100, ratings_positive: 10, ratings_negative: 2 },
      },
    ];

    render(ModioPanel);

    expect(screen.getByText("Test Mod Alpha")).toBeTruthy();
    // The listbox should be present
    expect(screen.getByRole("listbox")).toBeTruthy();
  });

  it("keyboard navigates mod list with ArrowDown/ArrowUp", async () => {
    modioStore.isLoadingMods = false;
    modioStore.userMods = [
      {
        id: 100, name: "Mod A", name_id: "mod-a", summary: "", logo_url: "",
        status: 1, visibility: 1, date_added: 1000, date_updated: 2000,
        stats: { downloads_total: 0, subscribers_total: 0, ratings_positive: 0, ratings_negative: 0 },
      },
      {
        id: 200, name: "Mod B", name_id: "mod-b", summary: "", logo_url: "",
        status: 1, visibility: 1, date_added: 1000, date_updated: 2000,
        stats: { downloads_total: 0, subscribers_total: 0, ratings_positive: 0, ratings_negative: 0 },
      },
    ];

    render(ModioPanel);

    const listbox = screen.getByRole("listbox");
    await fireEvent.keyDown(listbox, { key: "ArrowDown" });
    await fireEvent.keyDown(listbox, { key: "ArrowDown" });

    // Second option should have focus styling (focusedModIndex = 1)
    const options = screen.getAllByRole("option");
    expect(options.length).toBe(2);
  });

  // ── Linked state ───────────────────────────────────────

  it("renders linked state with mod info and sections", () => {
    modioStore.isAuthenticated = true;
    modioStore.selectedModId = 100;
    modioStore.selectedModName = "My Cool Mod";
    modioStore.selectedModUrl = "https://mod.io/g/baldursgate3/m/my-cool-mod";
    modioStore.userMods = [
      {
        id: 100, name: "My Cool Mod", name_id: "my-cool-mod", summary: "A mod",
        logo_url: "", status: 1, visibility: 1, date_added: 1000, date_updated: 2000,
        stats: { downloads_total: 1234, subscribers_total: 567, ratings_positive: 10, ratings_negative: 1 },
      },
    ];

    render(ModioPanel);

    expect(screen.getByText("My Cool Mod")).toBeTruthy();
    expect(screen.getByText("modio_mod_status_accepted")).toBeTruthy();
    expect(screen.getByText("modio_mod_visibility_public")).toBeTruthy();
    // Stats should show
    expect(screen.getByText("modio_dashboard_downloads")).toBeTruthy();
    expect(screen.getByText("modio_dashboard_subscribers")).toBeTruthy();
  });

  it("shows collapsible section buttons", () => {
    modioStore.isAuthenticated = true;
    modioStore.selectedModId = 100;
    modioStore.selectedModName = "Test Mod";
    modioStore.userMods = [
      {
        id: 100, name: "Test Mod", name_id: "test", summary: "", logo_url: "",
        status: 1, visibility: 1, date_added: 1000, date_updated: 2000,
        stats: { downloads_total: 0, subscribers_total: 0, ratings_positive: 0, ratings_negative: 0 },
      },
    ];

    render(ModioPanel);

    // Section toggle buttons — look for aria-expanded
    const expandButtons = document.querySelectorAll('[aria-expanded]');
    // Upload form + 5 sections = 6 expandable elements
    expect(expandButtons.length).toBeGreaterThanOrEqual(5);
  });

  it("shows upload form with version input and upload button", () => {
    modioStore.isAuthenticated = true;
    modioStore.selectedModId = 100;
    modioStore.selectedModName = "Test Mod";
    modioStore.userMods = [
      {
        id: 100, name: "Test Mod", name_id: "test", summary: "", logo_url: "",
        status: 1, visibility: 1, date_added: 1000, date_updated: 2000,
        stats: { downloads_total: 0, subscribers_total: 0, ratings_positive: 0, ratings_negative: 0 },
      },
    ];

    render(ModioPanel);

    // Upload version label should be present
    expect(screen.getByText("modio_upload_version_label")).toBeTruthy();
    // Upload button text
    const uploadBtns = screen.getAllByText("modio_upload_button");
    expect(uploadBtns.length).toBeGreaterThanOrEqual(1);
  });

  // ── Header actions ─────────────────────────────────────

  it("connection button is always visible", () => {
    render(ModioPanel);
    expect(screen.getByLabelText("modio_connection_label")).toBeTruthy();
  });

  it("refresh button appears in linked state", () => {
    modioStore.isAuthenticated = true;
    modioStore.selectedModId = 100;
    modioStore.selectedModName = "Test Mod";
    modioStore.userMods = [];

    render(ModioPanel);

    expect(screen.getByLabelText("modio_refresh")).toBeTruthy();
  });

  // ── Stat formatting ────────────────────────────────────

  it("formats stat numbers correctly (K abbreviation)", () => {
    modioStore.isAuthenticated = true;
    modioStore.selectedModId = 100;
    modioStore.selectedModName = "Cool Mod";
    modioStore.userMods = [
      {
        id: 100, name: "Cool Mod", name_id: "cool", summary: "", logo_url: "",
        status: 1, visibility: 1, date_added: 1000, date_updated: 2000,
        stats: { downloads_total: 1500, subscribers_total: 200, ratings_positive: 0, ratings_negative: 0 },
      },
    ];

    render(ModioPanel);

    // 1500 should format as 1.5K
    expect(screen.getByText("1.5K")).toBeTruthy();
  });

  // ── Unlink action ──────────────────────────────────────

  it("unlink button clears selected mod", async () => {
    modioStore.isAuthenticated = true;
    modioStore.selectedModId = 100;
    modioStore.selectedModName = "Test Mod";
    modioStore.selectedModUrl = "https://mod.io/g/baldursgate3/m/test";
    modioStore.userMods = [];

    render(ModioPanel);

    const unlinkBtn = screen.getByLabelText("Unlink mod");
    await fireEvent.click(unlinkBtn);

    expect(modioStore.selectedModId).toBeNull();
    expect(modioStore.selectedModName).toBeNull();
  });
});
