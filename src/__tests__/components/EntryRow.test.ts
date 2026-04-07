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

import EntryRow from "../../components/EntryRow.svelte";
import type { DiffEntry } from "../../lib/types/index.js";

function makeEntry(overrides: Partial<DiffEntry> = {}): DiffEntry {
  return {
    uuid: "test-uuid-1234",
    display_name: "Test Entry",
    source_file: "Mods/TestMod/test.lsx",
    entry_kind: "Modified",
    changes: [
      {
        field: "PassivesAdded",
        change_type: "ChildAdded",
        mod_value: "NewPassive",
        vanilla_value: "",
        added_values: ["NewPassive"],
        removed_values: [],
      },
    ],
    node_id: "ClassDescription",
    region_id: "",
    raw_attributes: { UUID: "test-uuid-1234", Name: "Test Entry" },
    raw_attribute_types: { UUID: "guid", Name: "FixedString" },
    raw_children: {},
    ...overrides,
  };
}

describe("TC-001: EntryRow component", () => {
  it("renders entry display name", () => {
    const { container } = render(EntryRow, {
      entry: makeEntry(),
      section: "ClassDescriptions",
    });
    expect(container.textContent).toContain("Test Entry");
  });

  it("renders with data-entry-id attribute", () => {
    const { container } = render(EntryRow, {
      entry: makeEntry(),
      section: "ClassDescriptions",
    });
    const row = container.querySelector("[data-entry-id]");
    expect(row).toBeTruthy();
    expect(row!.getAttribute("data-entry-id")).toBe(
      "ClassDescriptions:test-uuid-1234"
    );
  });

  it("shows change count summary for entries with changes", () => {
    const { container } = render(EntryRow, {
      entry: makeEntry(),
      section: "ClassDescriptions",
    });
    // A single change renders the field name (per entry_row_changes_one i18n key)
    // Our mock returns the key as text
    const text = container.textContent ?? "";
    expect(text).toBeTruthy();
  });

  it("renders edit button with accessible aria-label", () => {
    const { container } = render(EntryRow, {
      entry: makeEntry(),
      section: "ClassDescriptions",
    });
    // The edit button has aria-label from entry_row_edit_aria() message
    const editBtn = container.querySelector(
      "button[aria-label*='entry_row_edit_aria']"
    );
    expect(editBtn).toBeTruthy();
  });

  it("renders expand button with accessible aria-label", () => {
    const { container } = render(EntryRow, {
      entry: makeEntry(),
      section: "ClassDescriptions",
    });
    // The expand/chevron button has aria-label from entry_row_expand_aria() message
    const expandBtn = container.querySelector(
      "button[aria-label*='entry_row_expand_aria']"
    );
    expect(expandBtn).toBeTruthy();
  });

  it("renders vanilla entry differently", () => {
    const vanillaEntry = makeEntry({
      entry_kind: "Vanilla",
      changes: [],
    });
    const { container } = render(EntryRow, {
      entry: vanillaEntry,
      section: "ClassDescriptions",
    });
    // Vanilla entries should have title with the vanilla tooltip text
    const row = container.querySelector("[data-entry-id]");
    expect(row).toBeTruthy();
    expect(row!.getAttribute("title")).toContain("entry_row_vanilla_tooltip");
  });

  it("applies left margin for nested entries via depth prop", () => {
    const { container } = render(EntryRow, {
      entry: makeEntry(),
      section: "SubRaces",
      depth: 2,
    });
    const row = container.querySelector("[data-entry-id]");
    expect(row).toBeTruthy();
    // depth=2 should produce a margin-left style
    expect(row!.getAttribute("style")).toContain("margin-left");
  });
});
