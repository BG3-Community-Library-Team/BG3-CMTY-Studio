// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/svelte";

afterEach(cleanup);

// Polyfill ResizeObserver and scrollIntoView for jsdom (not available natively)
beforeAll(() => {
  globalThis.ResizeObserver ??= class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver;

  Element.prototype.scrollIntoView ??= function () {};
});

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

import ColorGridPicker from "../../components/ColorGridPicker.svelte";

function makeOptions(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    value: `color-${i}`,
    label: `Color ${i}`,
    color: `#${(i * 37 + 100).toString(16).padStart(6, "0").slice(0, 6)}`,
  }));
}

describe("TC-001: ColorGridPicker component", () => {
  const defaultOptions = makeOptions(12);
  const noop = () => {};

  it("renders grid with role='grid'", () => {
    render(ColorGridPicker, {
      label: "Test Colors",
      options: defaultOptions,
      selected: [],
      onchange: noop,
    });
    const grid = screen.getByRole("grid");
    expect(grid).toBeTruthy();
  });

  it("has aria-label matching the label prop", () => {
    render(ColorGridPicker, {
      label: "Test Colors",
      options: defaultOptions,
      selected: [],
      onchange: noop,
    });
    const grid = screen.getByRole("grid");
    expect(grid.getAttribute("aria-label")).toBe("Test Colors");
  });

  it("has aria-multiselectable='true'", () => {
    render(ColorGridPicker, {
      label: "Test Colors",
      options: defaultOptions,
      selected: [],
      onchange: noop,
    });
    const grid = screen.getByRole("grid");
    expect(grid.getAttribute("aria-multiselectable")).toBe("true");
  });

  it("renders correct number of swatches", () => {
    render(ColorGridPicker, {
      label: "Test Colors",
      options: defaultOptions,
      selected: [],
      onchange: noop,
    });
    const options = screen.getAllByRole("option");
    expect(options.length).toBe(defaultOptions.length);
  });

  it("marks selected swatches with aria-selected='true'", () => {
    render(ColorGridPicker, {
      label: "Test Colors",
      options: defaultOptions,
      selected: ["color-0", "color-3"],
      onchange: noop,
    });
    const options = screen.getAllByRole("option");
    const selectedOptions = options.filter(
      (o) => o.getAttribute("aria-selected") === "true"
    );
    expect(selectedOptions.length).toBe(2);
  });

  it("unselected swatches have aria-selected='false'", () => {
    render(ColorGridPicker, {
      label: "Test Colors",
      options: defaultOptions,
      selected: ["color-0"],
      onchange: noop,
    });
    const options = screen.getAllByRole("option");
    const unselected = options.filter(
      (o) => o.getAttribute("aria-selected") === "false"
    );
    expect(unselected.length).toBe(defaultOptions.length - 1);
  });

  it("each swatch has an aria-label with its name", () => {
    render(ColorGridPicker, {
      label: "Test Colors",
      options: defaultOptions,
      selected: [],
      onchange: noop,
    });
    const options = screen.getAllByRole("option");
    // Each option should have an aria-label matching the option label
    for (const opt of options) {
      expect(opt.getAttribute("aria-label")).toBeTruthy();
    }
  });

  it("calls onchange when a swatch is clicked", async () => {
    const changeSpy = vi.fn();
    render(ColorGridPicker, {
      label: "Test Colors",
      options: defaultOptions,
      selected: [],
      onchange: changeSpy,
    });
    const options = screen.getAllByRole("option");
    await fireEvent.click(options[0]);
    expect(changeSpy).toHaveBeenCalledTimes(1);
    // Should add the clicked color to the selection
    expect(changeSpy.mock.calls[0][0]).toContain("color-0");
  });

  it("renders grid row with role='row'", () => {
    const { container } = render(ColorGridPicker, {
      label: "Test Colors",
      options: defaultOptions,
      selected: [],
      onchange: noop,
    });
    const row = container.querySelector("[role='row']");
    expect(row).toBeTruthy();
  });

  it("renders gridcells for each swatch", () => {
    const { container } = render(ColorGridPicker, {
      label: "Test Colors",
      options: defaultOptions,
      selected: [],
      onchange: noop,
    });
    const cells = container.querySelectorAll("[role='gridcell']");
    expect(cells.length).toBe(defaultOptions.length);
  });
});
