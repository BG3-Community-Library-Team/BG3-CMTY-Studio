import { describe, it, expect } from "vitest";
import { jsonSchemaPlugin } from "../lib/plugins/jsonSchemaPlugin.js";
import type { CompletionContext } from "../lib/plugins/completionTypes.js";

function makeCtx(overrides: Partial<CompletionContext> = {}): CompletionContext {
  return {
    lineTextBeforeCursor: "",
    fullText: "",
    language: "json",
    cursorOffset: 0,
    typedPrefix: "",
    ...overrides,
  };
}

describe("jsonSchemaPlugin", () => {
  it("has correct metadata", () => {
    expect(jsonSchemaPlugin.id).toBe("bg3-json-schema");
    expect(jsonSchemaPlugin.name).toBe("BG3 JSON Schema");
    expect(jsonSchemaPlugin.languages).toEqual(["json"]);
    expect(jsonSchemaPlugin.priority).toBe(40);
  });

  it("returns empty for empty prefix", () => {
    expect(jsonSchemaPlugin.getCompletions(makeCtx({ typedPrefix: "" }))).toEqual([]);
  });

  it("returns empty for single-char prefix", () => {
    expect(jsonSchemaPlugin.getCompletions(makeCtx({ typedPrefix: "R" }))).toEqual([]);
  });

  it("returns empty for unknown JSON mode", () => {
    const result = jsonSchemaPlugin.getCompletions(
      makeCtx({ typedPrefix: "Re", fullText: '{ "foo": "bar" }' }),
    );
    expect(result).toEqual([]);
  });

  // SE Config mode
  describe("SE Config mode", () => {
    const seConfigText = '{ "RequiredVersion": 1, "ModTable": "MyMod" }';

    it("detects SE Config and returns keys", () => {
      const result = jsonSchemaPlugin.getCompletions(
        makeCtx({ typedPrefix: "Re", fullText: seConfigText }),
      );
      expect(result.some((r) => r.label === "RequiredVersion")).toBe(true);
    });

    it("returns ModTable for 'Mo' prefix", () => {
      const result = jsonSchemaPlugin.getCompletions(
        makeCtx({ typedPrefix: "Mo", fullText: seConfigText }),
      );
      expect(result.some((r) => r.label === "ModTable")).toBe(true);
    });

    it("returns FeatureFlags for 'Fe' prefix", () => {
      const result = jsonSchemaPlugin.getCompletions(
        makeCtx({ typedPrefix: "Fe", fullText: seConfigText }),
      );
      expect(result.some((r) => r.label === "FeatureFlags")).toBe(true);
    });

    it("returns feature flags inside FeatureFlags array", () => {
      const result = jsonSchemaPlugin.getCompletions(
        makeCtx({
          typedPrefix: "Lu",
          fullText: seConfigText,
          lineTextBeforeCursor: '  "FeatureFlags": ["Lu',
        }),
      );
      expect(result.some((r) => r.label === "Lua")).toBe(true);
    });

    it("returns Osiris feature flag", () => {
      const result = jsonSchemaPlugin.getCompletions(
        makeCtx({
          typedPrefix: "Os",
          fullText: seConfigText,
          lineTextBeforeCursor: '  "FeatureFlags": ["Os',
        }),
      );
      expect(result.some((r) => r.label === "Osiris")).toBe(true);
      expect(result.some((r) => r.label === "OsirisExtensions")).toBe(true);
    });
  });

  // MCM mode
  describe("MCM mode", () => {
    const mcmText = '{ "SchemaVersion": 1, "Tabs": [] }';

    it("detects MCM and returns top-level keys", () => {
      const result = jsonSchemaPlugin.getCompletions(
        makeCtx({ typedPrefix: "Sc", fullText: mcmText }),
      );
      expect(result.some((r) => r.label === "SchemaVersion")).toBe(true);
    });

    it("returns MCM setting keys", () => {
      const result = jsonSchemaPlugin.getCompletions(
        makeCtx({ typedPrefix: "Na", fullText: mcmText }),
      );
      expect(result.some((r) => r.label === "Name")).toBe(true);
    });

    it("returns widget types for Type value context", () => {
      const result = jsonSchemaPlugin.getCompletions(
        makeCtx({
          typedPrefix: "ch",
          fullText: mcmText,
          lineTextBeforeCursor: '"Type": "ch',
        }),
      );
      expect(result.some((r) => r.label === "checkbox")).toBe(true);
    });

    it("returns slider widget types", () => {
      const result = jsonSchemaPlugin.getCompletions(
        makeCtx({
          typedPrefix: "sl",
          fullText: mcmText,
          lineTextBeforeCursor: '"Type": "sl',
        }),
      );
      expect(result.some((r) => r.label === "slider_int")).toBe(true);
      expect(result.some((r) => r.label === "slider_float")).toBe(true);
    });
  });

  it("is case-insensitive", () => {
    const result = jsonSchemaPlugin.getCompletions(
      makeCtx({
        typedPrefix: "re",
        fullText: '{ "RequiredVersion": 1 }',
      }),
    );
    expect(result.some((r) => r.label === "RequiredVersion")).toBe(true);
  });

  it("SE Config keys have kind 'property'", () => {
    const result = jsonSchemaPlugin.getCompletions(
      makeCtx({
        typedPrefix: "Re",
        fullText: '{ "RequiredVersion": 1 }',
      }),
    );
    const item = result.find((r) => r.label === "RequiredVersion");
    expect(item?.kind).toBe("property");
  });

  it("SE Config keys have quoted insertText", () => {
    const result = jsonSchemaPlugin.getCompletions(
      makeCtx({
        typedPrefix: "Re",
        fullText: '{ "RequiredVersion": 1 }',
      }),
    );
    const item = result.find((r) => r.label === "RequiredVersion");
    expect(item?.insertText).toBe('"RequiredVersion"');
  });
});
