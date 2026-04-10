// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/svelte";

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

import FileExplorer from "../../components/FileExplorer.svelte";

describe("TC-001: FileExplorer component", () => {
  it("renders with role='none' container", () => {
    const { container } = render(FileExplorer);
    const explorer = container.querySelector("[role='none']");
    expect(explorer).toBeTruthy();
  });

  it("renders explorer header", () => {
    const { container } = render(FileExplorer);
    // The header is rendered via ExplorerHeader component (i18n keys in test mode)
    const header = container.querySelector(".explorer-header");
    expect(header).toBeTruthy();
    expect(header!.textContent!.toUpperCase()).toContain("EXPLORER");
  });

  it("shows empty state when no mod is loaded", () => {
    const { container } = render(FileExplorer);
    // When modStore.scanResult is null (default), an empty state is shown
    const emptyState = container.querySelector(".empty-state");
    expect(emptyState).toBeTruthy();
    expect(emptyState!.textContent).toContain("No mod loaded");
  });

  it("empty state has accessible open-project buttons", () => {
    const { container } = render(FileExplorer);
    const emptyState = container.querySelector(".empty-state");
    expect(emptyState).toBeTruthy();
    // Should have at least one button for opening a project
    const buttons = emptyState!.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it("does not render treeitem nodes when no mod is loaded", () => {
    const { container } = render(FileExplorer);
    const treeItems = container.querySelectorAll("[role='treeitem']");
    expect(treeItems.length).toBe(0);
  });
});
