import { describe, it, expect } from "vitest";
import { isAppError, getErrorMessage } from "../lib/types/index.js";

describe("isAppError", () => {
  it("returns true for valid AppError objects", () => {
    expect(isAppError({ kind: "NotFound", message: "missing" })).toBe(true);
  });

  it("returns false for null", () => {
    expect(isAppError(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isAppError(undefined)).toBe(false);
  });

  it("returns false for plain string", () => {
    expect(isAppError("error")).toBe(false);
  });

  it("returns false for number", () => {
    expect(isAppError(42)).toBe(false);
  });

  it("returns false for object without kind", () => {
    expect(isAppError({ message: "test" })).toBe(false);
  });

  it("returns false for object without message", () => {
    expect(isAppError({ kind: "NotFound" })).toBe(false);
  });

  it("returns false for object with non-string message", () => {
    expect(isAppError({ kind: "NotFound", message: 42 })).toBe(false);
  });

  it("returns true with extra properties", () => {
    expect(isAppError({ kind: "IoError", message: "disk full", extra: true })).toBe(true);
  });

  it("returns false for array", () => {
    expect(isAppError([{ kind: "NotFound", message: "nope" }])).toBe(false);
  });
});

describe("getErrorMessage", () => {
  it("extracts message from AppError", () => {
    expect(getErrorMessage({ kind: "NotFound", message: "not found" })).toBe("not found");
  });

  it("extracts message from Error instance", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("converts string to string", () => {
    expect(getErrorMessage("plain error")).toBe("plain error");
  });

  it("converts number to string", () => {
    expect(getErrorMessage(404)).toBe("404");
  });

  it("converts null to string", () => {
    expect(getErrorMessage(null)).toBe("null");
  });

  it("converts undefined to string", () => {
    expect(getErrorMessage(undefined)).toBe("undefined");
  });

  it("converts object to string", () => {
    expect(getErrorMessage({ foo: "bar" })).toBe("[object Object]");
  });
});
