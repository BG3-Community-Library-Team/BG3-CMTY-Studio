import { describe, it, expect, vi } from "vitest";
import { noopLinter } from "../lib/editor/lintBridge.js";

// Mock the tauri scripts module before importing bg3Linter
vi.mock("../lib/tauri/scripts.js", () => ({
  validateScript: vi.fn().mockResolvedValue([]),
}));

// Mock @codemirror/lint to avoid CM6 runtime
vi.mock("@codemirror/lint", () => ({
  linter: vi.fn((callback: unknown, _opts?: unknown) => ({
    __linterCallback: callback,
    __type: "linter-extension",
  })),
}));

// Now import after mocks are set up
const { bg3Linter } = await import("../lib/editor/lintBridge.js");
const { validateScript } = await import("../lib/tauri/scripts.js");
const { linter: mockLinter } = await import("@codemirror/lint");

describe("lintBridge", () => {
  describe("noopLinter", () => {
    it("is an empty array", () => {
      expect(noopLinter).toEqual([]);
    });
  });

  describe("bg3Linter", () => {
    it("returns a linter extension", () => {
      const ext = bg3Linter("test.txt", "osiris") as { __type: string };
      expect(ext.__type).toBe("linter-extension");
    });

    it("calls CM6 linter with delay 500", () => {
      bg3Linter("test.txt", "osiris");
      expect(mockLinter).toHaveBeenCalledWith(expect.any(Function), { delay: 500 });
    });

    it("maps diagnostics to CM6 format", async () => {
      const mockValidate = vi.mocked(validateScript);
      mockValidate.mockResolvedValueOnce([
        { line: 1, message: "Missing THEN", severity: "Error" },
        { line: 2, message: "Unused variable", severity: "Warning" },
      ]);

      const ext = bg3Linter("test.osiris", "osiris") as { __linterCallback: (view: unknown) => Promise<unknown[]> };
      const callback = ext.__linterCallback;

      // Simulate a CM6 EditorView with a 2-line document
      const mockView = {
        state: {
          doc: {
            toString: () => "IF\nTHEN",
            lines: 2,
            line: (n: number) => {
              if (n === 1) return { from: 0, to: 2 };
              if (n === 2) return { from: 3, to: 7 };
              throw new Error("Invalid line");
            },
          },
        },
      };

      const result = await callback(mockView);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        from: 0,
        to: 2,
        severity: "error",
        message: "Missing THEN",
        source: "bg3-lint",
      });
      expect(result[1]).toEqual({
        from: 3,
        to: 7,
        severity: "warning",
        message: "Unused variable",
        source: "bg3-lint",
      });
    });

    it("skips diagnostics with out-of-bounds line numbers", async () => {
      const mockValidate = vi.mocked(validateScript);
      mockValidate.mockResolvedValueOnce([
        { line: 0, message: "Line 0 (OOB)", severity: "Error" },
        { line: 1, message: "Valid line", severity: "Info" },
        { line: 99, message: "Line 99 (OOB)", severity: "Error" },
      ]);

      const ext = bg3Linter("t.txt", "osiris") as { __linterCallback: (view: unknown) => Promise<unknown[]> };
      const callback = ext.__linterCallback;

      const mockView = {
        state: {
          doc: {
            toString: () => "line one",
            lines: 1,
            line: (n: number) => {
              if (n === 1) return { from: 0, to: 8 };
              throw new Error("Invalid line");
            },
          },
        },
      };

      const result = await callback(mockView);
      expect(result).toHaveLength(1);
      expect((result[0] as { message: string }).message).toBe("Valid line");
    });

    it("maps severity Info to info", async () => {
      const mockValidate = vi.mocked(validateScript);
      mockValidate.mockResolvedValueOnce([
        { line: 1, message: "Info msg", severity: "Info" },
      ]);

      const ext = bg3Linter("t.txt", "osiris") as { __linterCallback: (view: unknown) => Promise<unknown[]> };
      const mockView = {
        state: {
          doc: {
            toString: () => "test",
            lines: 1,
            line: () => ({ from: 0, to: 4 }),
          },
        },
      };

      const result = await ext.__linterCallback(mockView);
      expect((result[0] as { severity: string }).severity).toBe("info");
    });

    it("returns empty array on IPC error", async () => {
      const mockValidate = vi.mocked(validateScript);
      mockValidate.mockRejectedValueOnce(new Error("IPC failed"));

      const ext = bg3Linter("t.txt", "osiris") as { __linterCallback: (view: unknown) => Promise<unknown[]> };
      const mockView = {
        state: {
          doc: {
            toString: () => "test",
            lines: 1,
            line: () => ({ from: 0, to: 4 }),
          },
        },
      };

      const result = await ext.__linterCallback(mockView);
      expect(result).toEqual([]);
    });

    it("passes correct args to validateScript", async () => {
      const mockValidate = vi.mocked(validateScript);
      mockValidate.mockResolvedValueOnce([]);

      const ext = bg3Linter("my/file.txt", "stats") as { __linterCallback: (view: unknown) => Promise<unknown[]> };
      const mockView = {
        state: {
          doc: {
            toString: () => "content here",
            lines: 1,
            line: () => ({ from: 0, to: 12 }),
          },
        },
      };

      await ext.__linterCallback(mockView);
      expect(mockValidate).toHaveBeenCalledWith("my/file.txt", "stats", "content here", undefined);
    });
  });
});
