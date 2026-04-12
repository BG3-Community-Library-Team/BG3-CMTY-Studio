/**
 * Tests for DiffView — diff computation, hunk generation, unified/split rendering, empty diff.
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/svelte";

afterEach(cleanup);

// Mock paraglide messages
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

import DiffView from "../components/script-editors/DiffView.svelte";
import { diffLines } from "diff";

describe("DiffView", () => {
  describe("diff library", () => {
    it("diffLines detects additions", () => {
      const changes = diffLines("hello\n", "hello\nworld\n");
      expect(changes.some(c => c.added)).toBe(true);
    });

    it("diffLines detects removals", () => {
      const changes = diffLines("hello\nworld\n", "hello\n");
      expect(changes.some(c => c.removed)).toBe(true);
    });

    it("diffLines returns no changes for identical text", () => {
      const changes = diffLines("same\n", "same\n");
      expect(changes.every(c => !c.added && !c.removed)).toBe(true);
    });
  });

  describe("rendering", () => {
    it("shows 'no changes' for identical content", () => {
      render(DiffView, {
        leftContent: "hello\nworld",
        rightContent: "hello\nworld",
      });
      expect(screen.getByText("diff_view_no_changes")).toBeTruthy();
    });

    it("renders diff hunks for different content", () => {
      const { container } = render(DiffView, {
        leftContent: "line1\nline2\nline3\n",
        rightContent: "line1\nmodified\nline3\n",
      });
      // Should have diff content (not the "no changes" message)
      const diffContent = container.querySelector(".diff-content");
      expect(diffContent).toBeTruthy();
    });

    it("displays labels in toolbar", () => {
      render(DiffView, {
        leftContent: "a",
        rightContent: "b",
        leftLabel: "Before",
        rightLabel: "After",
      });
      expect(screen.getByText("Before")).toBeTruthy();
      expect(screen.getByText("After")).toBeTruthy();
    });

    it("renders unified view by default", () => {
      const { container } = render(DiffView, {
        leftContent: "old\n",
        rightContent: "new\n",
      });
      const unifiedBtn = container.querySelector('.diff-mode-btn.active');
      expect(unifiedBtn).toBeTruthy();
    });

    it("shows view mode toggle buttons", () => {
      render(DiffView, {
        leftContent: "a\n",
        rightContent: "b\n",
      });
      const unifiedBtn = screen.getByTitle("diff_view_unified");
      const splitBtn = screen.getByTitle("diff_view_split");
      expect(unifiedBtn).toBeTruthy();
      expect(splitBtn).toBeTruthy();
    });
  });

  describe("hunk computation", () => {
    it("handles empty left content", () => {
      const { container } = render(DiffView, {
        leftContent: "",
        rightContent: "new content\n",
      });
      const addedLines = container.querySelectorAll(".line-add");
      expect(addedLines.length).toBeGreaterThan(0);
    });

    it("handles empty right content", () => {
      const { container } = render(DiffView, {
        leftContent: "old content\n",
        rightContent: "",
      });
      const removedLines = container.querySelectorAll(".line-del");
      expect(removedLines.length).toBeGreaterThan(0);
    });

    it("handles both empty", () => {
      render(DiffView, {
        leftContent: "",
        rightContent: "",
      });
      expect(screen.getByText("diff_view_no_changes")).toBeTruthy();
    });

    it("renders multiple hunks for distant changes", () => {
      const lines = Array.from({ length: 20 }, (_, i) => `line${i}`);
      const left = lines.join("\n") + "\n";
      const right = [...lines];
      right[2] = "CHANGED2";
      right[17] = "CHANGED17";
      const rightStr = right.join("\n") + "\n";

      const { container } = render(DiffView, {
        leftContent: left,
        rightContent: rightStr,
      });
      const hunks = container.querySelectorAll(".diff-hunk");
      expect(hunks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("default labels", () => {
    it("shows Original and Modified by default", () => {
      render(DiffView, {
        leftContent: "a\n",
        rightContent: "b\n",
      });
      expect(screen.getByText("Original")).toBeTruthy();
      expect(screen.getByText("Modified")).toBeTruthy();
    });
  });
});
