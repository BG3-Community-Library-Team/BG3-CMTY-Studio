import { describe, it, expect } from "vitest";
import {
  extractLsxRegions,
  regionToSection,
  inferSectionFromLsxContent,
  inferAllSectionsFromLsxContent,
  parseLsxContentToSections,
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

// ── inferAllSectionsFromLsxContent ───────────────────────────────────────

describe("inferAllSectionsFromLsxContent", () => {
  it("returns all sections from multi-region file", () => {
    const xml = `<region id="ActionResourceDefinitions"></region><region id="Races"></region>`;
    expect(inferAllSectionsFromLsxContent(xml)).toEqual(["ActionResources", "Races"]);
  });

  it("returns empty array for no regions", () => {
    expect(inferAllSectionsFromLsxContent("<save></save>")).toEqual([]);
  });

  it("returns single-element array for single region", () => {
    const xml = `<save><region id="Races"><node id="root"/></region></save>`;
    expect(inferAllSectionsFromLsxContent(xml)).toEqual(["Races"]);
  });
});

// ── parseLsxContentToSections ────────────────────────────────────────────

describe("parseLsxContentToSections", () => {
  it("parses a basic LSX file with one entry", () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<save>
  <region id="Races">
    <node id="root">
      <children>
        <node id="Race">
          <attribute id="UUID" type="guid" value="abc-123" />
          <attribute id="Name" type="FixedString" value="TestRace" />
          <attribute id="ParentGuid" type="guid" value="parent-guid" />
        </node>
      </children>
    </node>
  </region>
</save>`;
    const result = parseLsxContentToSections(xml);
    expect(result).toHaveLength(1);
    expect(result[0].section).toBe("Races");
    expect(result[0].entries).toHaveLength(1);
    expect(result[0].entries[0].uuid).toBe("abc-123");
    expect(result[0].entries[0].display_name).toBe("TestRace");
    expect(result[0].entries[0].node_id).toBe("Race");
    expect(result[0].entries[0].region_id).toBe("Races");
    expect(result[0].entries[0].raw_attributes).toEqual({
      UUID: "abc-123",
      Name: "TestRace",
      ParentGuid: "parent-guid",
    });
    expect(result[0].entries[0].raw_attribute_types).toEqual({
      UUID: "guid",
      Name: "FixedString",
      ParentGuid: "guid",
    });
    expect(result[0].entries[0].entry_kind).toBe("New");
  });

  it("parses multiple entries in one section", () => {
    const xml = `<save>
  <region id="Progressions">
    <node id="root">
      <children>
        <node id="Progression">
          <attribute id="UUID" type="guid" value="uuid-1" />
          <attribute id="Name" type="FixedString" value="Prog1" />
        </node>
        <node id="Progression">
          <attribute id="UUID" type="guid" value="uuid-2" />
          <attribute id="Name" type="FixedString" value="Prog2" />
        </node>
        <node id="Progression">
          <attribute id="UUID" type="guid" value="uuid-3" />
          <attribute id="Name" type="FixedString" value="Prog3" />
        </node>
      </children>
    </node>
  </region>
</save>`;
    const result = parseLsxContentToSections(xml);
    expect(result).toHaveLength(1);
    expect(result[0].entries).toHaveLength(3);
    expect(result[0].entries.map(e => e.display_name)).toEqual(["Prog1", "Prog2", "Prog3"]);
  });

  it("parses multiple regions into separate sections", () => {
    const xml = `<save>
  <region id="Races">
    <node id="root">
      <children>
        <node id="Race">
          <attribute id="UUID" type="guid" value="race-1" />
          <attribute id="Name" type="FixedString" value="MyRace" />
        </node>
      </children>
    </node>
  </region>
  <region id="Progressions">
    <node id="root">
      <children>
        <node id="Progression">
          <attribute id="UUID" type="guid" value="prog-1" />
          <attribute id="Name" type="FixedString" value="MyProg" />
        </node>
      </children>
    </node>
  </region>
</save>`;
    const result = parseLsxContentToSections(xml);
    expect(result).toHaveLength(2);
    expect(result[0].section).toBe("Races");
    expect(result[1].section).toBe("Progressions");
  });

  it("maps remapped region IDs to section names", () => {
    const xml = `<save>
  <region id="ActionResourceDefinitions">
    <node id="root">
      <children>
        <node id="ActionResourceDefinition">
          <attribute id="UUID" type="guid" value="ar-1" />
          <attribute id="Name" type="FixedString" value="TestResource" />
        </node>
      </children>
    </node>
  </region>
</save>`;
    const result = parseLsxContentToSections(xml);
    expect(result).toHaveLength(1);
    expect(result[0].section).toBe("ActionResources");
  });

  it("returns empty array for invalid XML", () => {
    expect(parseLsxContentToSections("not valid xml <><>")).toEqual([]);
  });

  it("returns empty array for empty XML", () => {
    expect(parseLsxContentToSections("")).toEqual([]);
  });

  it("returns empty for region with no children", () => {
    const xml = `<save><region id="Races"><node id="root"></node></region></save>`;
    expect(parseLsxContentToSections(xml)).toEqual([]);
  });

  it("uses MapKey as UUID fallback", () => {
    const xml = `<save>
  <region id="Progressions">
    <node id="root">
      <children>
        <node id="Progression">
          <attribute id="MapKey" type="FixedString" value="mk-123" />
          <attribute id="Name" type="FixedString" value="Test" />
        </node>
      </children>
    </node>
  </region>
</save>`;
    const result = parseLsxContentToSections(xml);
    expect(result[0].entries[0].uuid).toBe("mk-123");
  });

  it("extracts child groups", () => {
    const xml = `<save>
  <region id="Races">
    <node id="root">
      <children>
        <node id="Race">
          <attribute id="UUID" type="guid" value="race-1" />
          <attribute id="Name" type="FixedString" value="TestRace" />
          <children>
            <node id="EyeColors">
              <children>
                <node id="EyeColor">
                  <attribute id="Object" type="guid" value="eye-guid-1" />
                </node>
                <node id="EyeColor">
                  <attribute id="Object" type="guid" value="eye-guid-2" />
                </node>
              </children>
            </node>
          </children>
        </node>
      </children>
    </node>
  </region>
</save>`;
    const result = parseLsxContentToSections(xml);
    expect(result[0].entries[0].raw_children).toEqual({
      EyeColors: ["eye-guid-1", "eye-guid-2"],
    });
  });

  it("sets source_file to empty string", () => {
    const xml = `<save><region id="Races"><node id="root"><children><node id="Race"><attribute id="UUID" type="guid" value="x" /></node></children></node></region></save>`;
    const result = parseLsxContentToSections(xml);
    expect(result[0].entries[0].source_file).toBe("");
  });

  it("sets changes to empty array", () => {
    const xml = `<save><region id="Races"><node id="root"><children><node id="Race"><attribute id="UUID" type="guid" value="x" /></node></children></node></region></save>`;
    const result = parseLsxContentToSections(xml);
    expect(result[0].entries[0].changes).toEqual([]);
  });

  it("skips regions where root node is missing", () => {
    const xml = `<save><region id="Races"><node id="NotRoot"><children><node id="Race"><attribute id="UUID" type="guid" value="x" /></node></children></node></region></save>`;
    const result = parseLsxContentToSections(xml);
    expect(result).toEqual([]);
  });

  it("skips regions where root has no children block", () => {
    const xml = `<save><region id="Races"><node id="root"><attribute id="Foo" type="FixedString" value="bar" /></node></region></save>`;
    const result = parseLsxContentToSections(xml);
    expect(result).toEqual([]);
  });

  it("generates UUID when entry has no UUID or MapKey", () => {
    const xml = `<save><region id="Races"><node id="root"><children><node id="Race"><attribute id="Name" type="FixedString" value="TestName" /></node></children></node></region></save>`;
    const result = parseLsxContentToSections(xml);
    expect(result[0].entries[0].uuid).toBeTruthy();
    expect(result[0].entries[0].display_name).toBe("TestName");
  });

  it("uses DisplayName when Name is absent", () => {
    const xml = `<save><region id="Races"><node id="root"><children><node id="Race"><attribute id="UUID" type="guid" value="u1" /><attribute id="DisplayName" type="FixedString" value="Shown" /></node></children></node></region></save>`;
    const result = parseLsxContentToSections(xml);
    expect(result[0].entries[0].display_name).toBe("Shown");
  });

  it("handles self-closing entry nodes", () => {
    const xml = `<save><region id="Races"><node id="root"><children><node id="Race" /></children></node></region></save>`;
    const result = parseLsxContentToSections(xml);
    // Self-closing node has no attributes, so UUID falls back to generated
    expect(result[0].entries).toHaveLength(1);
    expect(result[0].entries[0].node_id).toBe("Race");
  });

  it("handles group node with children but no Object/MapKey attributes", () => {
    const xml = `<save>
  <region id="Races">
    <node id="root">
      <children>
        <node id="Race">
          <attribute id="UUID" type="guid" value="r1" />
          <children>
            <node id="SomeGroup">
              <children>
                <node id="Item">
                  <attribute id="Unrelated" type="FixedString" value="val" />
                </node>
              </children>
            </node>
          </children>
        </node>
      </children>
    </node>
  </region>
</save>`;
    const result = parseLsxContentToSections(xml);
    expect(result[0].entries[0].raw_children).toEqual({});
  });

  it("handles entry with no direct children block", () => {
    const xml = `<save><region id="Races"><node id="root"><children><node id="Race"><attribute id="UUID" type="guid" value="r1" /><attribute id="Name" type="FixedString" value="Test" /></node></children></node></region></save>`;
    const result = parseLsxContentToSections(xml);
    expect(result[0].entries[0].raw_children).toEqual({});
  });

  it("handles malformed children block (missing close tag)", () => {
    const xml = `<save><region id="Races"><node id="root"><children><node id="Race"><attribute id="UUID" type="guid" value="r1" /><children><node id="Grp"></node></children></node></children></node></region></save>`;
    const result = parseLsxContentToSections(xml);
    // Should still parse the entry even if inner children extraction hits edge cases
    expect(result[0].entries).toHaveLength(1);
  });

  it("skips Object attributes with empty value in child groups", () => {
    const xml = `<save>
  <region id="Races">
    <node id="root">
      <children>
        <node id="Race">
          <attribute id="UUID" type="guid" value="r1" />
          <children>
            <node id="Colors">
              <children>
                <node id="Color">
                  <attribute id="Object" type="guid" value="" />
                </node>
                <node id="Color">
                  <attribute id="Object" type="guid" value="real-guid" />
                </node>
              </children>
            </node>
          </children>
        </node>
      </children>
    </node>
  </region>
</save>`;
    const result = parseLsxContentToSections(xml);
    expect(result[0].entries[0].raw_children).toEqual({
      Colors: ["real-guid"],
    });
  });

  it("handles nested self-closing nodes inside deeper nesting", () => {
    const xml = `<save>
  <region id="Races">
    <node id="root">
      <children>
        <node id="Race">
          <attribute id="UUID" type="guid" value="r1" />
          <children>
            <node id="SubGroup">
              <children>
                <node id="Item" />
              </children>
            </node>
          </children>
        </node>
      </children>
    </node>
  </region>
</save>`;
    const result = parseLsxContentToSections(xml);
    // SubGroup exists but Item is self-closing with no Object attribute, so no children
    expect(result[0].entries[0].raw_children).toEqual({});
  });

  it("returns empty results when root children block is empty", () => {
    const xml = `<save><region id="Races"><node id="root"><children>   </children></node></region></save>`;
    const result = parseLsxContentToSections(xml);
    expect(result).toEqual([]);
  });
});
