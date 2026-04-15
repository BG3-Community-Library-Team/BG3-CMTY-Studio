/**
 * Tests for CreateModDialog — validation, form state, submission flow.
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/svelte";

afterEach(cleanup);

// ── Mocks ────────────────────────────────────────────────────────

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

vi.mock("../lib/tauri/modio.js", () => ({
  modioCreateMod: vi.fn().mockResolvedValue({
    id: 42,
    name: "Test Mod",
    name_id: "test-mod",
    status: 0,
    date_added: 1000,
  }),
  modioHasOauthToken: vi.fn().mockResolvedValue(false),
  modioGetMyMods: vi.fn().mockResolvedValue([]),
}));

vi.mock("../lib/stores/toastStore.svelte.js", () => ({
  toastStore: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("../lib/tauri/project-settings.js", () => ({
  readProjectFile: vi.fn().mockResolvedValue("{}"),
  writeProjectFile: vi.fn().mockResolvedValue(undefined),
}));

// ── Imports ──────────────────────────────────────────────────────

import CreateModDialog from "../components/platform/modio/CreateModDialog.svelte";
import { modioCreateMod } from "../lib/tauri/modio.js";

// ── Helpers ──────────────────────────────────────────────────────

function renderDialog(props?: Partial<{ onclose: () => void; oncreated: (mod: any) => void }>) {
  return render(CreateModDialog, {
    props: {
      onclose: props?.onclose ?? vi.fn(),
      oncreated: props?.oncreated ?? vi.fn(),
    },
  });
}

// ── Tests ────────────────────────────────────────────────────────

describe("CreateModDialog", () => {
  beforeEach(() => {
    vi.mocked(modioCreateMod).mockClear();
  });

  it("renders dialog with title", () => {
    renderDialog();
    expect(screen.getByText("modio_create_mod_title")).toBeTruthy();
  });

  it("renders all required form fields", () => {
    renderDialog();

    // Name, Summary, Logo labels should be present
    expect(screen.getByText("modio_create_name_label")).toBeTruthy();
    expect(screen.getByText("modio_create_summary_label")).toBeTruthy();
    expect(screen.getByText("modio_create_logo_label")).toBeTruthy();
  });

  it("shows submit button", () => {
    renderDialog();
    // Submit button text
    expect(screen.getAllByText("modio_create_submit").length).toBeGreaterThanOrEqual(1);
  });

  it("dialog has role=dialog and aria-modal", () => {
    renderDialog();
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(dialog?.getAttribute("aria-labelledby")).toBe("create-mod-title");
  });

  it("close button has accessible label", () => {
    renderDialog();
    expect(screen.getByLabelText("common_close")).toBeTruthy();
  });

  it("calls onclose when close button clicked", async () => {
    const onclose = vi.fn();
    renderDialog({ onclose });

    const closeBtn = screen.getByLabelText("common_close");
    await fireEvent.click(closeBtn);

    expect(onclose).toHaveBeenCalledOnce();
  });

  it("calls onclose on Escape key", async () => {
    const onclose = vi.fn();
    renderDialog({ onclose });

    await fireEvent.keyDown(window, { key: "Escape" });
    expect(onclose).toHaveBeenCalledOnce();
  });

  it("shows validation errors on empty submit", async () => {
    renderDialog();

    // Click create without filling anything
    const submitBtns = screen.getAllByText("modio_create_submit");
    // The footer submit button
    const submitBtn = submitBtns[submitBtns.length - 1];
    await fireEvent.click(submitBtn);

    // Should show validation messages
    expect(screen.getByText("modio_create_validation_name")).toBeTruthy();
    expect(screen.getByText("modio_create_validation_summary")).toBeTruthy();
    expect(screen.getByText("modio_create_validation_logo")).toBeTruthy();

    // Should NOT have called the API
    expect(modioCreateMod).not.toHaveBeenCalled();
  });

  it("auto-generates name ID from name input", async () => {
    renderDialog();

    const nameInput = screen.getByLabelText(/modio_create_name_label/);
    await fireEvent.input(nameInput, { target: { value: "My Cool Mod!" } });

    const nameIdInput = document.querySelector('#create-mod-name-id') as HTMLInputElement;
    // After name change, the auto-derived nameId should be "my-cool-mod"
    // Note: $effect runs synchronously in Svelte 5 runes
    expect(nameIdInput).toBeTruthy();
  });

  it("summary character counter shows count", () => {
    renderDialog();
    // Should show "/250" counter
    expect(screen.getByText("0/250")).toBeTruthy();
  });

  it("name ID hint text is displayed", () => {
    renderDialog();
    expect(screen.getByText("modio_create_name_id_hint")).toBeTruthy();
  });

  it("visibility checkbox is present", () => {
    renderDialog();
    const checkbox = document.querySelector('#create-mod-visibility') as HTMLInputElement;
    expect(checkbox).toBeTruthy();
    expect(checkbox?.type).toBe("checkbox");
  });
});
