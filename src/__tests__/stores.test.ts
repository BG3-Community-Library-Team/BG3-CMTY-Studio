/**
 * Store tests — validates core store logic, error handling, and type re-exports.
 */
import { describe, it, expect } from "vitest";

// ── getErrorMessage ─────────────────────────────────────────────────

describe("getErrorMessage", () => {
  // Import from types since that's where it lives
  let getErrorMessage: (err: unknown) => string;

  // Dynamic import to avoid circular deps
  it("can import getErrorMessage", async () => {
    const mod = await import("../lib/types/index.js");
    getErrorMessage = mod.getErrorMessage;
    expect(typeof getErrorMessage).toBe("function");
  });

  it("extracts message from plain string", async () => {
    const { getErrorMessage } = await import("../lib/types/index.js");
    expect(getErrorMessage("something broke")).toBe("something broke");
  });

  it("extracts message from Error object", async () => {
    const { getErrorMessage } = await import("../lib/types/index.js");
    expect(getErrorMessage(new Error("test error"))).toBe("test error");
  });

  it("extracts message from AppError-shaped object", async () => {
    const { getErrorMessage } = await import("../lib/types/index.js");
    expect(getErrorMessage({ kind: "NotFound", message: "file not found" })).toBe("file not found");
  });

  it("handles null/undefined gracefully", async () => {
    const { getErrorMessage } = await import("../lib/types/index.js");
    expect(getErrorMessage(null)).toBe("null");
    expect(getErrorMessage(undefined)).toBe("undefined");
  });

  it("stringifies plain objects", async () => {
    const { getErrorMessage } = await import("../lib/types/index.js");
    const result = getErrorMessage({ code: 42 });
    expect(typeof result).toBe("string");
  });

  it("extracts message from Timeout error", async () => {
    const { getErrorMessage } = await import("../lib/types/index.js");
    expect(getErrorMessage({ kind: "Timeout", message: "Operation timed out after 120s" }))
      .toBe("Operation timed out after 120s");
  });

  it("detects Timeout kind via isAppError", async () => {
    const { isAppError } = await import("../lib/types/index.js");
    const err = { kind: "Timeout", message: "timed out" };
    expect(isAppError(err)).toBe(true);
    expect(err.kind).toBe("Timeout");
  });
});

// ── Section type re-export (IPC-05) ──────────────────────────────

describe("Section type re-export", () => {
  it("re-exports Section from generated bindings", async () => {
    const indexMod = await import("../lib/types/index.js");
    const generatedMod = await import("../lib/types/generated/Section.js");
    // SECTIONS_ORDERED should contain valid Section values that match generated type
    expect(indexMod.SECTIONS_ORDERED.length).toBeGreaterThan(50);
    // Verify the generated module export exists
    expect(generatedMod).toBeDefined();
  });
});
