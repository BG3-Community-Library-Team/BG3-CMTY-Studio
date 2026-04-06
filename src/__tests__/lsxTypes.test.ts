/**
 * Tests for lsxTypes module: LSX attribute type classification,
 * render-type mapping, and combobox descriptor inference.
 */
import { describe, it, expect } from "vitest";
import {
  classifyLsxType,
  renderTypeToFieldType,
  inferComboboxDescriptor,
  UUID_SECTION_MAP,
} from "../lib/utils/lsxTypes.js";

// ─── classifyLsxType ─────────────────────────────────────────────────

describe("classifyLsxType", () => {
  it("classifies 'bool' as 'boolean'", () => {
    expect(classifyLsxType("bool", "SomeFlag")).toBe("boolean");
  });

  describe("integer types → 'number'", () => {
    it.each(["int8", "int16", "int32", "int64", "uint8", "uint16", "uint32", "uint64"])(
      "classifies '%s' as 'number'",
      (type) => {
        expect(classifyLsxType(type, "SomeField")).toBe("number");
      },
    );
  });

  describe("float types → 'float'", () => {
    it.each(["float", "double", "float64"])(
      "classifies '%s' as 'float'",
      (type) => {
        expect(classifyLsxType(type, "SomeField")).toBe("float");
      },
    );
  });

  it("classifies 'guid' as 'uuid'", () => {
    expect(classifyLsxType("guid", "SomeGuid")).toBe("uuid");
  });

  describe("translated string types → 'loca'", () => {
    it("classifies 'TranslatedString' as 'loca'", () => {
      expect(classifyLsxType("TranslatedString", "DisplayName")).toBe("loca");
    });

    it("classifies 'TranslatedFSString' as 'loca'", () => {
      expect(classifyLsxType("TranslatedFSString", "Description")).toBe("loca");
    });
  });

  describe("vector types → 'vector'", () => {
    it.each(["fvec2", "fvec3", "fvec4", "ivec2", "ivec3", "ivec4"])(
      "classifies '%s' as 'vector'",
      (type) => {
        expect(classifyLsxType(type, "Position")).toBe("vector");
      },
    );
  });

  describe("FixedString heuristics", () => {
    it("FixedString with UUID-suffix name and UUID examples → 'uuid'", () => {
      expect(
        classifyLsxType("FixedString", "RaceUUID", [
          "0eb594cb-8820-4be6-a58d-8be7a1a98fba",
        ]),
      ).toBe("uuid");
    });

    it("FixedString with Guid-suffix name and UUID examples → 'uuid'", () => {
      expect(
        classifyLsxType("FixedString", "ParentGuid", [
          "12345678-abcd-1234-abcd-1234567890ab",
        ]),
      ).toBe("uuid");
    });

    it("FixedString with UUID-suffix name but NO UUID examples → 'text'", () => {
      expect(classifyLsxType("FixedString", "RaceUUID", ["not-a-uuid"])).toBe("text");
    });

    it("FixedString with loca-related name → 'loca'", () => {
      expect(classifyLsxType("FixedString", "Description")).toBe("loca");
    });

    it("FixedString named 'DisplayName' → 'loca'", () => {
      expect(classifyLsxType("FixedString", "DisplayName")).toBe("loca");
    });

    it("FixedString named 'DisplayDescription' → 'loca'", () => {
      expect(classifyLsxType("FixedString", "DisplayDescription")).toBe("loca");
    });

    it("FixedString with color examples → 'color'", () => {
      expect(
        classifyLsxType("FixedString", "SomeName", ["#FF00AA", "#AABB00CC"]),
      ).toBe("color");
    });

    it("FixedString with 9-char hex color → 'color'", () => {
      expect(
        classifyLsxType("FixedString", "TintColor", ["#FF00AABB"]),
      ).toBe("color");
    });

    it("FixedString with no special patterns → 'text'", () => {
      expect(
        classifyLsxType("FixedString", "SomeName", ["plain text value"]),
      ).toBe("text");
    });

    it("FixedString with no examples → 'text'", () => {
      expect(classifyLsxType("FixedString", "SomeName")).toBe("text");
    });
  });

  describe("other string-like types", () => {
    it("classifies 'LSString' as 'text' (basic)", () => {
      expect(classifyLsxType("LSString", "SomeName")).toBe("text");
    });

    it("classifies 'LSWString' as 'text' (basic)", () => {
      expect(classifyLsxType("LSWString", "SomeName")).toBe("text");
    });

    it("LSString with UUID-suffix name and UUID examples → 'uuid'", () => {
      expect(
        classifyLsxType("LSString", "SomeId", [
          "aabbccdd-1234-5678-9abc-def012345678",
        ]),
      ).toBe("uuid");
    });
  });

  it("unknown type falls back to 'text'", () => {
    expect(classifyLsxType("SomeUnknownType", "Whatever")).toBe("text");
  });
});

// ─── renderTypeToFieldType ───────────────────────────────────────────

describe("renderTypeToFieldType", () => {
  it("maps 'number' → 'int'", () => {
    expect(renderTypeToFieldType("number")).toBe("int");
  });

  it("maps 'float' → 'float'", () => {
    expect(renderTypeToFieldType("float")).toBe("float");
  });

  it("maps 'boolean' → 'bool'", () => {
    expect(renderTypeToFieldType("boolean")).toBe("bool");
  });

  it("maps 'uuid' → 'string (UUID)'", () => {
    expect(renderTypeToFieldType("uuid")).toBe("string (UUID)");
  });

  it("maps 'text' → 'string'", () => {
    expect(renderTypeToFieldType("text")).toBe("string");
  });

  it("maps 'loca' → 'string'", () => {
    expect(renderTypeToFieldType("loca")).toBe("string");
  });

  it("maps 'color' → 'string'", () => {
    expect(renderTypeToFieldType("color")).toBe("string");
  });

  it("maps 'textarea' → 'string'", () => {
    expect(renderTypeToFieldType("textarea")).toBe("string");
  });

  it("maps 'vector' → 'string'", () => {
    expect(renderTypeToFieldType("vector")).toBe("string");
  });
});

// ─── inferComboboxDescriptor ─────────────────────────────────────────

describe("inferComboboxDescriptor", () => {
  describe("loca fields", () => {
    it("Description with renderType 'loca' → 'loca:'", () => {
      expect(inferComboboxDescriptor("Description", "TranslatedString", "loca")).toBe("loca:");
    });

    it("DisplayName with renderType 'loca' → 'loca:'", () => {
      expect(inferComboboxDescriptor("DisplayName", "TranslatedString", "loca")).toBe("loca:");
    });
  });

  describe("UUID fields with known section mappings", () => {
    it("RaceUUID → 'section:Races'", () => {
      expect(inferComboboxDescriptor("RaceUUID", "FixedString", "uuid")).toBe("section:Races");
    });

    it("BackgroundUUID → 'section:Backgrounds'", () => {
      expect(inferComboboxDescriptor("BackgroundUUID", "FixedString", "uuid")).toBe("section:Backgrounds");
    });

    it("ParentGuid → 'section:RootTemplates'", () => {
      expect(inferComboboxDescriptor("ParentGuid", "FixedString", "uuid")).toBe("section:RootTemplates");
    });

    it("ClassUUID → 'section:ClassDescriptions'", () => {
      expect(inferComboboxDescriptor("ClassUUID", "FixedString", "uuid")).toBe("section:ClassDescriptions");
    });

    it("OriginUUID → 'section:Origins'", () => {
      expect(inferComboboxDescriptor("OriginUUID", "FixedString", "uuid")).toBe("section:Origins");
    });

    it("GodUUID → 'section:Gods'", () => {
      expect(inferComboboxDescriptor("GodUUID", "FixedString", "uuid")).toBe("section:Gods");
    });

    it("SpellId → 'section:Spells'", () => {
      expect(inferComboboxDescriptor("SpellId", "FixedString", "uuid")).toBe("section:Spells");
    });

    it("TagUUID → 'section:Tags'", () => {
      expect(inferComboboxDescriptor("TagUUID", "FixedString", "uuid")).toBe("section:Tags");
    });

    it("FeatGuid → 'section:Feats'", () => {
      expect(inferComboboxDescriptor("FeatGuid", "FixedString", "uuid")).toBe("section:Feats");
    });

    it("VoiceTableUUID → 'voiceTable:'", () => {
      expect(inferComboboxDescriptor("VoiceTableUUID", "FixedString", "uuid")).toBe("voiceTable:");
    });
  });

  describe("exact name matches in UUID_SECTION_MAP", () => {
    it("ParentGuid (exact match) → 'section:RootTemplates'", () => {
      expect(inferComboboxDescriptor("ParentGuid", "guid", "uuid")).toBe("section:RootTemplates");
    });

    it("ParentTemplateId (exact match) → 'section:RootTemplates'", () => {
      expect(inferComboboxDescriptor("ParentTemplateId", "guid", "uuid")).toBe("section:RootTemplates");
    });
  });

  describe("non-matching fields", () => {
    it("SomeField with renderType 'text' → undefined", () => {
      expect(inferComboboxDescriptor("SomeField", "FixedString", "text")).toBeUndefined();
    });

    it("SomeField with renderType 'number' → undefined", () => {
      expect(inferComboboxDescriptor("SomeField", "int32", "number")).toBeUndefined();
    });

    it("SomeField with renderType 'boolean' → undefined", () => {
      expect(inferComboboxDescriptor("IsActive", "bool", "boolean")).toBeUndefined();
    });

    it("UnknownUUID with renderType 'uuid' but no prefix match → undefined", () => {
      expect(inferComboboxDescriptor("UnknownUUID", "FixedString", "uuid")).toBeUndefined();
    });
  });
});

// ─── UUID_SECTION_MAP completeness ───────────────────────────────────

describe("UUID_SECTION_MAP", () => {
  it("maps Race → section:Races", () => {
    expect(UUID_SECTION_MAP["Race"]).toBe("section:Races");
  });

  it("maps SubRace → section:Races", () => {
    expect(UUID_SECTION_MAP["SubRace"]).toBe("section:Races");
  });

  it("maps ProgressionTable → progressionTable:", () => {
    expect(UUID_SECTION_MAP["ProgressionTable"]).toBe("progressionTable:");
  });

  it("contains all expected keys", () => {
    const expectedKeys = [
      "Race", "SubRace", "Background", "Class", "Origin", "God",
      "Progression", "Feat", "Tag", "Spell", "ParentGuid",
      "ParentTemplateId", "RootTemplate", "EquipmentType",
      "ActionResource", "VoiceTable", "ProgressionTable",
    ];
    for (const key of expectedKeys) {
      expect(UUID_SECTION_MAP[key]).toBeDefined();
    }
  });
});
