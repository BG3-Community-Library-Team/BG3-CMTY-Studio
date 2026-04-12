// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/svelte";
import { suppressConsoleError } from "../helpers/suppressConsole.js";

afterEach(cleanup);

// Mock paraglide messages
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

import ErrorBoundaryWrapper from "./helpers/ErrorBoundaryWrapper.svelte";

describe("TC-001: ErrorBoundary component", () => {
  // Suppress console.error — ErrorBoundary intentionally logs caught render errors
  const consoleSpy = suppressConsoleError();
  it("renders children normally when no error occurs", () => {
    render(ErrorBoundaryWrapper, { fail: false });
    const child = screen.getByTestId("child-content");
    expect(child).toBeTruthy();
    expect(child.textContent).toBe("OK");
  });

  it("shows error fallback when child throws", () => {
    // The wrapper passes fail=true, causing the child expression to throw.
    // <svelte:boundary> should catch this and render the {#snippet failed} content.
    const { container } = render(ErrorBoundaryWrapper, { fail: true });
    // Child content should NOT be visible
    expect(screen.queryByTestId("child-content")).toBeNull();
    // The error fallback should contain the error message
    const errorText = container.textContent ?? "";
    expect(errorText).toContain("Test render error");
  });

  it("shows retry button in error fallback", () => {
    const { container } = render(ErrorBoundaryWrapper, { fail: true });
    // The ErrorBoundary renders a Reset/Retry button in the error state
    const retryBtn = container.querySelector("button");
    expect(retryBtn).toBeTruthy();
    expect(retryBtn!.textContent).toContain("error_boundary_retry");
  });

  it("error fallback includes component name in message", () => {
    const { container } = render(ErrorBoundaryWrapper, { fail: true });
    // The error message template is: error_boundary_message({ name })
    // Our mock returns: "error_boundary_message(TestBoundary)"
    expect(container.textContent).toContain("TestBoundary");
  });

  it("error fallback has accessible structure", () => {
    const { container } = render(ErrorBoundaryWrapper, { fail: true });
    // Should have a button for retry
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThanOrEqual(1);
    // Should have text content describing the error
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs.length).toBeGreaterThanOrEqual(1);
  });
});
