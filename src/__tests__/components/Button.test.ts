// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";

afterEach(cleanup);

// Mock paraglide messages — returns the message key as text
vi.mock("../../paraglide/messages.js", () => {
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

import Button from "../../components/Button.svelte";

describe("TC-001: Button component", () => {
  it("renders a button element with default props", () => {
    render(Button);
    const btn = screen.getByRole("button");
    expect(btn).toBeTruthy();
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it("renders with each variant class", () => {
    const variants = ["primary", "secondary", "destructive", "ghost", "link"] as const;
    for (const variant of variants) {
      const { unmount } = render(Button, { variant });
      const btn = screen.getByRole("button");
      expect(btn).toBeTruthy();
      // Verify the button renders without crashing for each variant
      expect(btn.className).toBeTruthy();
      unmount();
    }
  });

  it("renders with each size class", () => {
    const sizes = ["sm", "md", "lg", "icon"] as const;
    for (const size of sizes) {
      const { unmount } = render(Button, { size });
      const btn = screen.getByRole("button");
      expect(btn.className).toBeTruthy();
      unmount();
    }
  });

  it("shows loading spinner when loading=true", () => {
    const { container } = render(Button, { loading: true });
    const btn = screen.getByRole("button");
    // Button should be disabled when loading
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    // Should contain the spinning loader SVG (Loader2 icon with animate-spin)
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeTruthy();
  });

  it("is disabled when disabled=true and has correct ARIA state", () => {
    render(Button, { disabled: true });
    const btn = screen.getByRole("button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    // Disabled buttons have the HTML disabled attribute which implicitly
    // sets aria-disabled behavior
    expect(btn.hasAttribute("disabled")).toBe(true);
  });

  it("applies cursor-not-allowed when disabled", () => {
    render(Button, { disabled: true });
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("cursor-not-allowed");
    expect(btn.className).toContain("opacity-50");
  });

  it("applies cursor-not-allowed when loading", () => {
    render(Button, { loading: true });
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("cursor-not-allowed");
    expect(btn.className).toContain("opacity-50");
  });

  it("renders children snippet content", () => {
    const children = createRawSnippet(() => ({
      render: () => `<span data-testid="btn-child">Click me</span>`,
    }));
    render(Button, { children });
    expect(screen.getByTestId("btn-child")).toBeTruthy();
    expect(screen.getByTestId("btn-child").textContent).toBe("Click me");
  });

  it("spreads additional HTML attributes", () => {
    render(Button, { "aria-label": "Save changes", type: "submit" });
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("aria-label")).toBe("Save changes");
    expect(btn.getAttribute("type")).toBe("submit");
  });
});
