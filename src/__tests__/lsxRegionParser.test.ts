import { describe, it, expect } from "vitest";
import {
  extractLsxRegions,
  regionToSection,
  inferSectionFromLsxContent,
} from "../lib/utils/lsxRegionParser.js";

// ── extractLsxRegions ────────────────────────────────────────────────────

describe("extractLsxRegions", () => {
  it("extracts a single region", () => {
    const xml = `<?xml version="1.0"?>\n<save><region id="Races"><node id="root"/></region></save>`;
    expect(extractLsxRegions(xml)).toEqual(["Races"]);
  });

  it("extracts multiple regions", () => {
    const xml = `<save><region id="Races"></region><region id="Progressions"></region></save>`;
    expect(extractLsxRegions(xml)).toEqual(["Races", "Progressions"]);
  });

  it("deduplicates regions", () => {
    const xml = `<region id="Races"></region><region id="Races"></region>`;
    expect(extractLsxRegions(xml)).toEqual(["Races"]);
  });

  it("returns empty array for no regions", () => {
    const xml = `<?xml version="1.0"?>\n<save><node id="root"/></save>`;
    expect(extractLsxRegions(xml)).toEqual([]);
  });

  it("returns empty for empty string", () => {
    expect(extractLsxRegions("")).toEqual([]);
  });

  it("handles regions with extra whitespace in tag", () => {
    const xml = `<region  id="Races" >content</region>`;
    expect(extractLsxRegions(xml)).toEqual(["Races"]);
  });

  it("is case-insensitive on the tag name", () => {
    const xml = `<REGION id="Races"></REGION><Region id="Classes"></Region>`;
    expect(extractLsxRegions(xml)).toEqual(["Races", "Classes"]);
  });

  it("handles multiline XML", () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<save>
  <version major="4" minor="0" revision="9" build="330"/>
  <region id="Progressions">
    <node id="root">
      <children>
        <node id="Progression"/>
      </children>
    </node>
  </region>
</save>`;
    expect(extractLsxRegions(xml)).toEqual(["Progressions"]);
  });
});

// ── regionToSection ──────────────────────────────────────────────────────

describe("regionToSection", () => {
  it("maps known remapped region to section name", () => {
    expect(regionToSection("ActionResourceDefinitions")).toBe("ActionResources");
    expect(regionToSection("ActionResourceGroupDefinitions")).toBe("ActionResourceGroups");
    expect(regionToSection("Spell")).toBe("SpellMetadata");
    expect(regionToSection("Status")).toBe("StatusMetadata");
    expect(regionToSection("Config")).toBe("Meta");
    expect(regionToSection("FactionContainer")).toBe("Factions");
    expect(regionToSection("Templates")).toBe("RootTemplates");
    expect(regionToSection("Rulesets")).toBe("Ruleset");
  });

  it("returns region ID as-is for unmapped regions", () => {
    expect(regionToSection("Races")).toBe("Races");
    expect(regionToSection("Progressions")).toBe("Progressions");
    expect(regionToSection("ClassDescriptions")).toBe("ClassDescriptions");
  });
});

// ── inferSectionFromLsxContent ───────────────────────────────────────────

describe("inferSectionFromLsxContent", () => {
  it("returns section from first region", () => {
    const xml = `<save><region id="Races"><node id="root"/></region></save>`;
    expect(inferSectionFromLsxContent(xml)).toBe("Races");
  });

  it("maps remapped regions", () => {
    const xml = `<save><region id="Templates"><node id="root"/></region></save>`;
    expect(inferSectionFromLsxContent(xml)).toBe("RootTemplates");
  });

  it("uses first region for multi-region files", () => {
    const xml = `<region id="ActionResourceDefinitions"></region><region id="Races"></region>`;
    expect(inferSectionFromLsxContent(xml)).toBe("ActionResources");
  });

  it("returns empty string when no regions found", () => {
    expect(inferSectionFromLsxContent("<save></save>")).toBe("");
  });

  it("returns empty string for empty input", () => {
    expect(inferSectionFromLsxContent("")).toBe("");
  });
});
