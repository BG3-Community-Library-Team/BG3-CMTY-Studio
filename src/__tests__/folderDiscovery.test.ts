import { describe, it, expect } from "vitest";
import {
  discoverSections,
  enrichCoreFolders,
  mergeAdditionalSections,
  type DiscoveredSections,
} from "../lib/utils/folderDiscovery.js";
import type { FolderNode } from "../lib/data/bg3FolderStructure.js";
import type { NodeSchema } from "../lib/tauri/lsx-export.js";

// ── Fixtures ─────────────────────────────────────────────────────────────

function makeSchema(node_id: string, attrCount = 1): NodeSchema {
  return {
    node_id,
    section: node_id,
    sample_count: 1,
    attributes: Array.from({ length: attrCount }, (_, i) => ({
      name: `attr${i}`,
      type: "FixedString",
      sample_values: [],
      coverage: 1.0,
    })),
    children: [],
  } as NodeSchema;
}

const EMPTY_STATIC = new Set<string>();
const EMPTY_EXCLUDED = new Set<string>();

function emptyDiscovered(): DiscoveredSections {
  return { cc: [], content: [], vfx: [], sound: [], general: [] };
}

// ── discoverSections ─────────────────────────────────────────────────────

describe("discoverSections", () => {
  it("categorizes CharacterCreation-prefixed sections into cc", () => {
    const entries = new Map<string, NodeSchema[]>([
      ["CharacterCreationColors", [makeSchema("CCColor")]],
    ]);
    const result = discoverSections(entries, EMPTY_STATIC, EMPTY_EXCLUDED);
    expect(result.cc).toHaveLength(1);
    expect(result.cc[0].name).toBe("CharacterCreationColors");
  });

  it("categorizes Effect-prefixed sections into vfx", () => {
    const entries = new Map<string, NodeSchema[]>([
      ["EffectBloom", [makeSchema("Bloom")]],
    ]);
    const result = discoverSections(entries, EMPTY_STATIC, EMPTY_EXCLUDED);
    expect(result.vfx).toHaveLength(1);
    expect(result.vfx[0].name).toBe("EffectBloom");
  });

  it("categorizes Bank/Visual sections into content", () => {
    const entries = new Map<string, NodeSchema[]>([
      ["AnimationBank", [makeSchema("AB")]],
      ["VisualSet", [makeSchema("VS")]],
    ]);
    const result = discoverSections(entries, EMPTY_STATIC, EMPTY_EXCLUDED);
    expect(result.content).toHaveLength(2);
  });

  it("categorizes Sound-prefixed sections into sound", () => {
    const entries = new Map<string, NodeSchema[]>([
      ["SoundOcclusion", [makeSchema("SO")]],
    ]);
    const result = discoverSections(entries, EMPTY_STATIC, EMPTY_EXCLUDED);
    expect(result.sound).toHaveLength(1);
    expect(result.sound[0].name).toBe("SoundOcclusion");
  });

  it("does not categorize bare 'Sound' as sound", () => {
    const entries = new Map<string, NodeSchema[]>([
      ["Sound", [makeSchema("S")]],
    ]);
    const result = discoverSections(entries, EMPTY_STATIC, EMPTY_EXCLUDED);
    expect(result.sound).toHaveLength(0);
    expect(result.general).toHaveLength(1);
  });

  it("puts uncategorized sections into general", () => {
    const entries = new Map<string, NodeSchema[]>([
      ["CustomThing", [makeSchema("CT")]],
    ]);
    const result = discoverSections(entries, EMPTY_STATIC, EMPTY_EXCLUDED);
    expect(result.general).toHaveLength(1);
    expect(result.general[0].name).toBe("CustomThing");
  });

  it("skips static sections", () => {
    const entries = new Map<string, NodeSchema[]>([
      ["Races", [makeSchema("Race")]],
    ]);
    const result = discoverSections(entries, new Set(["Races"]), EMPTY_EXCLUDED);
    expect(result.general).toHaveLength(0);
  });

  it("skips excluded sections", () => {
    const entries = new Map<string, NodeSchema[]>([
      ["Internal", [makeSchema("Intern")]],
    ]);
    const result = discoverSections(entries, EMPTY_STATIC, new Set(["Internal"]));
    expect(result.general).toHaveLength(0);
  });

  it("skips stats: prefixed sections", () => {
    const entries = new Map<string, NodeSchema[]>([
      ["stats:Armor", [makeSchema("A")]],
    ]);
    const result = discoverSections(entries, EMPTY_STATIC, EMPTY_EXCLUDED);
    expect(result.general).toHaveLength(0);
  });

  it("skips sections with no attributes in any schema", () => {
    const entries = new Map<string, NodeSchema[]>([
      ["EmptyAttrs", [makeSchema("E", 0)]],
    ]);
    const result = discoverSections(entries, EMPTY_STATIC, EMPTY_EXCLUDED);
    expect(result.general).toHaveLength(0);
  });

  it("sorts sections alphabetically within each category", () => {
    const entries = new Map<string, NodeSchema[]>([
      ["Zzz", [makeSchema("Z")]],
      ["Aaa", [makeSchema("A")]],
      ["Mmm", [makeSchema("M")]],
    ]);
    const result = discoverSections(entries, EMPTY_STATIC, EMPTY_EXCLUDED);
    expect(result.general.map((n) => n.name)).toEqual(["Aaa", "Mmm", "Zzz"]);
  });

  it("generates label from camelCase name", () => {
    const entries = new Map<string, NodeSchema[]>([
      ["CharacterCreationColors", [makeSchema("CC")]],
    ]);
    const result = discoverSections(entries, EMPTY_STATIC, EMPTY_EXCLUDED);
    expect(result.cc[0].label).toBe("Character Creation Colors");
  });
});

// ── enrichCoreFolders ────────────────────────────────────────────────────

describe("enrichCoreFolders", () => {
  const baseFolders: FolderNode[] = [
    { name: "_CharacterCreation", label: "CC", children: [{ name: "Presets", label: "Presets" }] },
    { name: "_Content", label: "Content", children: [] },
    { name: "_VFX", label: "VFX", children: [] },
    { name: "_Other", label: "Other" },
  ];

  it("returns original when nothing to add", () => {
    const result = enrichCoreFolders(baseFolders, emptyDiscovered());
    expect(result).toBe(baseFolders);
  });

  it("appends cc sections to _CharacterCreation", () => {
    const disc = emptyDiscovered();
    disc.cc = [{ name: "CCColor", label: "CC Color", Section: "CCColor" }];
    const result = enrichCoreFolders(baseFolders, disc);
    const ccFolder = result.find((f) => f.name === "_CharacterCreation")!;
    expect(ccFolder.children).toHaveLength(2); // Presets + CCColor
  });

  it("appends content sections to _Content", () => {
    const disc = emptyDiscovered();
    disc.content = [{ name: "AnimBank", label: "Anim", Section: "AnimBank" }];
    const result = enrichCoreFolders(baseFolders, disc);
    const contentFolder = result.find((f) => f.name === "_Content")!;
    expect(contentFolder.children).toHaveLength(1);
  });

  it("does not modify _Other", () => {
    const disc = emptyDiscovered();
    disc.cc = [{ name: "X", label: "X", Section: "X" }];
    const result = enrichCoreFolders(baseFolders, disc);
    const otherFolder = result.find((f) => f.name === "_Other");
    expect(otherFolder).toEqual(baseFolders.find((f) => f.name === "_Other"));
  });
});

// ── mergeAdditionalSections ──────────────────────────────────────────────

describe("mergeAdditionalSections", () => {
  const baseAdditional: FolderNode[] = [
    { name: "_Sound", label: "Sound", children: [{ name: "SoundCore", label: "Core" }] },
    { name: "Misc", label: "Misc" },
  ];

  it("appends sound sections to _Sound children", () => {
    const disc = emptyDiscovered();
    disc.sound = [{ name: "SoundEnv", label: "Sound Env", Section: "SoundEnv" }];
    const result = mergeAdditionalSections(baseAdditional, disc);
    const soundFolder = result.find((f) => f.name === "_Sound")!;
    expect(soundFolder.children).toHaveLength(2);
  });

  it("appends general sections to the list", () => {
    const disc = emptyDiscovered();
    disc.general = [{ name: "NewThing", label: "New Thing", Section: "NewThing" }];
    const result = mergeAdditionalSections(baseAdditional, disc);
    expect(result.some((f) => f.name === "NewThing")).toBe(true);
  });

  it("sorts the combined list alphabetically", () => {
    const disc = emptyDiscovered();
    disc.general = [{ name: "Aaa", label: "Aaa", Section: "Aaa" }];
    const result = mergeAdditionalSections(baseAdditional, disc);
    const labels = result.map((f) => f.label);
    const sorted = [...labels].sort((a, b) => a.localeCompare(b));
    expect(labels).toEqual(sorted);
  });

  it("does not mutate original arrays", () => {
    const disc = emptyDiscovered();
    disc.general = [{ name: "X", label: "X", Section: "X" }];
    const origLength = baseAdditional.length;
    mergeAdditionalSections(baseAdditional, disc);
    expect(baseAdditional).toHaveLength(origLength);
  });
});
