/**
 * Tests for errorLocalization module: AppError localization with
 * stable Rust error keys and fallback behavior.
 */
import { describe, it, expect } from "vitest";
import { localizeError, type AppError } from "../lib/errorLocalization.js";

// ─── Known error keys ────────────────────────────────────────────────

describe("localizeError — known keys", () => {
  it("localizes 'source_dir_not_found' with path context", () => {
    const err: AppError = {
      kind: "io",
      message: "source_dir_not_found",
      context: { path: "/some/missing/dir" },
    };
    expect(localizeError(err)).toBe("Source directory not found: /some/missing/dir");
  });

  it("localizes 'source_dir_not_found' without path context", () => {
    const err: AppError = {
      kind: "io",
      message: "source_dir_not_found",
      context: {},
    };
    expect(localizeError(err)).toBe("Source directory not found: unknown");
  });

  it("localizes 'source_dir_not_found' with undefined context", () => {
    const err: AppError = {
      kind: "io",
      message: "source_dir_not_found",
    };
    expect(localizeError(err)).toBe("Source directory not found: unknown");
  });

  it("localizes 'schema_db_not_found' with path context", () => {
    const err: AppError = {
      kind: "io",
      message: "schema_db_not_found",
      context: { path: "/db/ref_base.sqlite" },
    };
    expect(localizeError(err)).toBe(
      "Schema database not found: /db/ref_base.sqlite. Build ref_base.sqlite first.",
    );
  });

  it("localizes 'schema_db_not_found' without path context", () => {
    const err: AppError = {
      kind: "io",
      message: "schema_db_not_found",
      context: {},
    };
    expect(localizeError(err)).toBe(
      "Schema database not found: unknown. Build ref_base.sqlite first.",
    );
  });

  it("localizes 'mod_dir_not_found' with path context", () => {
    const err: AppError = {
      kind: "io",
      message: "mod_dir_not_found",
      context: { path: "C:\\mods\\my_mod" },
    };
    expect(localizeError(err)).toBe("Mod directory not found: C:\\mods\\my_mod");
  });

  it("localizes 'mod_dir_not_found' without path context", () => {
    const err: AppError = {
      kind: "io",
      message: "mod_dir_not_found",
    };
    expect(localizeError(err)).toBe("Mod directory not found: unknown");
  });
});

// ─── Fallback behavior ──────────────────────────────────────────────

describe("localizeError — fallback", () => {
  it("returns raw message for unknown error key", () => {
    const err: AppError = {
      kind: "unknown",
      message: "Something unexpected happened",
    };
    expect(localizeError(err)).toBe("Something unexpected happened");
  });

  it("returns raw message for unmapped key even with context", () => {
    const err: AppError = {
      kind: "parse",
      message: "xml_parse_error",
      context: { file: "meta.lsx", line: "42" },
    };
    expect(localizeError(err)).toBe("xml_parse_error");
  });

  it("returns empty string for empty message", () => {
    const err: AppError = {
      kind: "unknown",
      message: "",
    };
    expect(localizeError(err)).toBe("");
  });
});

// ─── AppError structure ──────────────────────────────────────────────

describe("AppError interface", () => {
  it("accepts minimal error (kind + message only)", () => {
    const err: AppError = { kind: "io", message: "some_error" };
    const result = localizeError(err);
    expect(typeof result).toBe("string");
  });

  it("accepts error with context map", () => {
    const err: AppError = {
      kind: "io",
      message: "source_dir_not_found",
      context: { path: "/x", extra: "info" },
    };
    const result = localizeError(err);
    // Extra context keys don't break formatting
    expect(result).toContain("/x");
  });
});
