import { describe, it, expect } from "vitest";
import {
  simpleKey,
  indexedKey,
  entryKey,
  fieldOverrideKey,
  validationKey,
  projectKey,
} from "../lib/data/fieldKeys.js";

describe("fieldKeys helpers", () => {
  it("simpleKey joins prefix and name", () => {
    expect(simpleKey("Boolean", "Hidden")).toBe("Boolean:Hidden");
  });

  it("indexedKey joins prefix, index, and subkey", () => {
    expect(indexedKey("Selector", 0, "Action")).toBe("Selector:0:Action");
  });

  it("indexedKey handles multi-digit indices", () => {
    expect(indexedKey("Selector", 12, "Guid")).toBe("Selector:12:Guid");
  });

  it("entryKey joins section and id with double-colon", () => {
    expect(entryKey("Races", "uuid-1")).toBe("Races::uuid-1");
  });

  it("fieldOverrideKey joins section, entryId, and field", () => {
    expect(fieldOverrideKey("Races", "uuid-1", "Name")).toBe("Races::uuid-1::Name");
  });

  it("validationKey prefixes with field:", () => {
    expect(validationKey("DisplayName")).toBe("field:DisplayName");
  });

  it("projectKey prefixes with bg3-cmty-project::", () => {
    expect(projectKey("/some/path")).toBe("bg3-cmty-project::/some/path");
  });
});
