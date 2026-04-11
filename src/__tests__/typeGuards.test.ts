import { describe, it, expect } from "vitest";
import { isAppError, getErrorMessage, getSectionDisplayName, SECTION_DISPLAY_NAMES, isCoreSection, isCfEligible } from "../lib/types/index.js";
import { isSyntheticCategory, EAGER_REGION_IDS } from "../lib/data/vanillaRegistry.js";

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

describe("getSectionDisplayName", () => {
  it("returns override for known sections", () => {
    expect(getSectionDisplayName("Races")).toBe("Races");
    expect(getSectionDisplayName("SpellLists")).toBe("Spell Lists");
    expect(getSectionDisplayName("ProgressionTables")).toBe("Progression Tables");
  });

  it("humanizes CamelCase for unknown sections", () => {
    expect(getSectionDisplayName("CustomFeats")).toBe("Custom Feats");
    expect(getSectionDisplayName("MySpecialAbilities")).toBe("My Special Abilities");
  });

  it("handles single word sections", () => {
    expect(getSectionDisplayName("Items")).toBe("Items");
  });

  it("handles consecutive uppercase letters", () => {
    expect(getSectionDisplayName("NPCDialogs")).toBe("NPC Dialogs");
  });
});

describe("SECTION_DISPLAY_NAMES proxy", () => {
  it("delegates to getSectionDisplayName", () => {
    expect(SECTION_DISPLAY_NAMES["Races"]).toBe("Races");
    expect(SECTION_DISPLAY_NAMES["CustomFeats"]).toBe("Custom Feats");
  });

  it("returns override for TextureAtlasInfo", () => {
    expect(SECTION_DISPLAY_NAMES["TextureAtlasInfo"]).toBe("Texture Atlas");
  });
});

describe("isCoreSection", () => {
  it("returns true for core sections", () => {
    expect(isCoreSection("Races")).toBe(true);
    expect(isCoreSection("Spells")).toBe(true);
    expect(isCoreSection("Feats")).toBe(true);
  });

  it("returns false for non-core sections", () => {
    expect(isCoreSection("FakeSection" as any)).toBe(false);
  });
});

describe("isCfEligible", () => {
  it("always returns false (deprecated)", () => {
    expect(isCfEligible("Races")).toBe(false);
    expect(isCfEligible("Spells")).toBe(false);
  });
});

describe("isSyntheticCategory", () => {
  it("returns true for ProgressionTables", () => {
    expect(isSyntheticCategory("ProgressionTables")).toBe(true);
  });

  it("returns true for VoiceTables", () => {
    expect(isSyntheticCategory("VoiceTables")).toBe(true);
  });

  it("returns false for regular region IDs", () => {
    expect(isSyntheticCategory("Lists")).toBe(false);
    expect(isSyntheticCategory("Races")).toBe(false);
  });
});

describe("EAGER_REGION_IDS", () => {
  it("includes core sections", () => {
    expect(EAGER_REGION_IDS.has("Lists")).toBe(true);
    expect(EAGER_REGION_IDS.has("Progressions")).toBe(true);
  });

  it("does not include unrecognized names", () => {
    expect(EAGER_REGION_IDS.has("NotASection")).toBe(false);
  });
});
