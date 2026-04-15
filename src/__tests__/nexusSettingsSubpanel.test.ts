/**
 * Tests for NexusSettingsSubpanel — render states, connection section,
 * project-gated section, API key input, save button, status badge.
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/svelte";

afterEach(cleanup);

// ── Mocks ────────────────────────────────────────────────────────

// Paraglide messages — return the key as text
vi.mock("../paraglide/messages.js", () => {
  const handler: ProxyHandler<Record<string, Function>> = {
    get(_target, prop: string) {
      if (prop === "__esModule") return true;
      if (typeof prop === "symbol") return undefined;
      return (params?: Record<string, unknown>) => {
        if (params && Object.keys(params).length > 0) {
          return `${String(prop)}(${Object.values(params).join(", ")})`;
        }
        return String(prop);
      };
    },
  };
  return { m: new Proxy({} as Record<string, Function>, handler) };
});

// Nexus IPC — all calls resolve to safe defaults
vi.mock("../lib/tauri/nexus.js", () => ({
  nexusHasApiKey: vi.fn().mockResolvedValue(false),
  nexusSetApiKey: vi.fn().mockResolvedValue(undefined),
  nexusValidateApiKey: vi.fn().mockResolvedValue(true),
  nexusClearApiKey: vi.fn().mockResolvedValue(undefined),
  nexusResolveMod: vi.fn().mockResolvedValue({
    id: "uuid-123",
    name: "Test Mod",
    game_scoped_id: 1933,
  }),
  nexusGetFileGroups: vi.fn().mockResolvedValue([]),
}));

// Project settings IPC
vi.mock("../lib/tauri/project-settings.js", () => ({
  readProjectFile: vi.fn().mockResolvedValue("{}"),
  writeProjectFile: vi.fn().mockResolvedValue(undefined),
}));

// ── Context key service — control modLoaded ──────────────────────
import { contextKeys } from "../lib/plugins/contextKeyService.svelte.js";
import NexusSettingsSubpanel from "../components/platform/nexus/NexusSettingsSubpanel.svelte";

describe("NexusSettingsSubpanel", () => {
  beforeEach(() => {
    contextKeys.delete("modLoaded");
  });

  // ── Connection section always visible ──────────────────

  it("renders the connection section without a project open", () => {
    const { container } = render(NexusSettingsSubpanel);
    // The connection section label is rendered via m.nexus_connection_section_label()
    expect(container.textContent).toContain("nexus_connection_section_label");
  });

  it("renders the settings header", () => {
    const { container } = render(NexusSettingsSubpanel);
    expect(container.textContent).toContain("nexus_settings_header");
  });

  // ── Connection-only subpanel (no project section) ───

  it("does not render any project section", () => {
    const { container } = render(NexusSettingsSubpanel);
    expect(container.textContent).not.toContain("nexus_project_section_label");
    expect(container.textContent).not.toContain("nexus_open_project_for_settings");
  });

  it("does not render project section even when modLoaded is true", () => {
    contextKeys.set("modLoaded", true);
    const { container } = render(NexusSettingsSubpanel);
    expect(container.textContent).not.toContain("nexus_project_section_label");
  });

  // ── API key input ──────────────────────────────────────

  it("renders the API key input with type='password'", () => {
    // keyStatus starts as "none" (nexusHasApiKey mocked to return false),
    // so the API key input should be visible.
    const { container } = render(NexusSettingsSubpanel);
    const input = container.querySelector("input[type='password']");
    expect(input).not.toBeNull();
  });

  // ── Save button disabled when empty ────────────────────

  it("renders a save button that is disabled when input is empty", () => {
    const { container } = render(NexusSettingsSubpanel);
    const buttons = container.querySelectorAll("button");
    const saveBtn = Array.from(buttons).find(
      (b) => b.textContent?.includes("nexus_save_button"),
    );
    expect(saveBtn).toBeTruthy();
    expect(saveBtn!.disabled).toBe(true);
  });

  // ── Connection badge ───────────────────────────────────

  it("connection badge has role='status'", () => {
    const { container } = render(NexusSettingsSubpanel);
    const badge = container.querySelector("[role='status']");
    expect(badge).not.toBeNull();
  });

  it("connection badge shows 'not connected' by default", () => {
    const { container } = render(NexusSettingsSubpanel);
    const badge = container.querySelector("[role='status']");
    expect(badge!.textContent).toContain("nexus_not_connected");
  });
});
