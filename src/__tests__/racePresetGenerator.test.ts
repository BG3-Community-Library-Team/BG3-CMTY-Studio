/**
 * Tests for racePresetGenerator — covers generatePresets() and generateDreamGuardianEntries()
 * Epic 5 + Epic 6 (Phase 3 — Batch Generation)
 *
 * Body semantics (BG3 schema):
 *   BodyType:  0 = Masculine, 1 = Feminine   (sex / gender presentation)
 *   BodyShape: 0 = Regular,   1 = Strong     (body build)
 */
import { describe, it, expect } from "vitest";
import { generatePresets, generateDreamGuardianEntries } from "../lib/utils/racePresetGenerator.js";

describe("generatePresets", () => {
  const BASE_INPUT = {
    raceUuid: "race-uuid-1",
    raceName: "Dunmer",
    subRaces: [],
    bodyMatrix: [
      { shape: 0, type: 0 },
      { shape: 0, type: 1 },
      { shape: 1, type: 0 },
      { shape: 1, type: 1 },
    ],
    cameraBase: "HUM" as const,
  };

  it("generates 4 presets + 4 templates for 1 race with 4 body combos", () => {
    const results = generatePresets(BASE_INPUT);
    // 4 body combos × 1 target = 4 pairs (preset + template each)
    expect(results).toHaveLength(8);
    const presets = results.filter(r => r.section === "CharacterCreationPresets");
    const templates = results.filter(r => r.section === "RootTemplates");
    expect(presets).toHaveLength(4);
    expect(templates).toHaveLength(4);
  });

  it("generates 12 presets + 12 templates for 1 base + 3 sub-races with 4 body combos", () => {
    const results = generatePresets({
      ...BASE_INPUT,
      subRaces: [
        { uuid: "sub-1", name: "Ashlander" },
        { uuid: "sub-2", name: "Chimer" },
        { uuid: "sub-3", name: "Telvanni" },
      ],
    });
    // 4 body combos × 3 sub-races = 12 pairs
    expect(results).toHaveLength(24);
    const presets = results.filter(r => r.section === "CharacterCreationPresets");
    const templates = results.filter(r => r.section === "RootTemplates");
    expect(presets).toHaveLength(12);
    expect(templates).toHaveLength(12);
  });

  it("each template MapKey appears in corresponding preset's RootTemplate field", () => {
    const results = generatePresets(BASE_INPUT);
    const templates = results.filter(r => r.section === "RootTemplates");
    const presets = results.filter(r => r.section === "CharacterCreationPresets");

    for (const template of templates) {
      const linked = presets.find(p => p.fields.RootTemplate === template.fields.MapKey);
      expect(linked).toBeDefined();
    }
  });

  it("template count matches preset count (1:1)", () => {
    const results = generatePresets(BASE_INPUT);
    const presets = results.filter(r => r.section === "CharacterCreationPresets");
    const templates = results.filter(r => r.section === "RootTemplates");
    expect(presets.length).toBe(templates.length);
  });

  it("camera derivation uses BodyType for sex: type 0 → M suffix", () => {
    const results = generatePresets({
      ...BASE_INPUT,
      bodyMatrix: [{ shape: 0, type: 0 }],
      cameraBase: "HUM",
    });
    const preset = results.find(r => r.section === "CharacterCreationPresets")!;
    expect(preset.fields.CloseUpA).toBe("HUM_M_Camera_Closeup_A");
    expect(preset.fields.CloseUpB).toBe("HUM_M_Camera_Closeup_B");
    expect(preset.fields.Overview).toBe("HUM_M_Camera_Overview_A");
  });

  it("camera derivation: ELF + type 1 → ELF_F_Camera_Closeup_A", () => {
    const results = generatePresets({
      ...BASE_INPUT,
      bodyMatrix: [{ shape: 1, type: 1 }],
      cameraBase: "ELF",
    });
    const preset = results.find(r => r.section === "CharacterCreationPresets")!;
    expect(preset.fields.CloseUpA).toBe("ELF_F_Camera_Closeup_A");
    expect(preset.fields.CloseUpB).toBe("ELF_F_Camera_Closeup_B");
    expect(preset.fields.Overview).toBe("ELF_F_Camera_Overview_A");
  });

  it("all generated UUIDs / MapKeys are unique", () => {
    const results = generatePresets({
      ...BASE_INPUT,
      subRaces: [
        { uuid: "sub-1", name: "Ashlander" },
        { uuid: "sub-2", name: "Chimer" },
      ],
    });
    const ids = results.map(r => r.fields.UUID || r.fields.MapKey);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("RaceUUID is always the base race, SubRaceUUID varies by target", () => {
    const results = generatePresets({
      ...BASE_INPUT,
      subRaces: [
        { uuid: "sub-1", name: "Ashlander" },
        { uuid: "sub-2", name: "Chimer" },
      ],
    });
    const presets = results.filter(r => r.section === "CharacterCreationPresets");
    for (const p of presets) {
      expect(p.fields.RaceUUID).toBe("race-uuid-1");
      expect(["sub-1", "sub-2"]).toContain(p.fields.SubRaceUUID);
    }
  });

  it("no sub-races → SubRaceUUID = raceUuid (self-reference)", () => {
    const results = generatePresets({
      ...BASE_INPUT,
      bodyMatrix: [{ shape: 0, type: 0 }],
    });
    const preset = results.find(r => r.section === "CharacterCreationPresets")!;
    expect(preset.fields.SubRaceUUID).toBe("race-uuid-1");
  });

  it("template Race field matches target sub-race UUID", () => {
    const results = generatePresets({
      ...BASE_INPUT,
      subRaces: [{ uuid: "sub-1", name: "Ashlander" }],
      bodyMatrix: [{ shape: 0, type: 0 }],
    });
    const template = results.find(r => r.section === "RootTemplates")!;
    expect(template.fields.Race).toBe("sub-1");
  });

  it("template Name: {SubRace}_{Sex}_{Build}_Player", () => {
    const results = generatePresets({
      ...BASE_INPUT,
      subRaces: [{ uuid: "sub-1", name: "Ashlander" }],
      bodyMatrix: [{ shape: 0, type: 0 }],
    });
    const template = results.find(r => r.section === "RootTemplates")!;
    expect(template.fields.Name).toBe("Ashlander_M_Regular_Player");
  });

  it("template uses MapKey (not UUID) and includes SpellSet + LevelName", () => {
    const results = generatePresets({
      ...BASE_INPUT,
      bodyMatrix: [{ shape: 0, type: 0 }],
    });
    const template = results.find(r => r.section === "RootTemplates")!;
    expect(template.fields.MapKey).toBeDefined();
    expect(template.fields.UUID).toBeUndefined();
    expect(template.fields.SpellSet).toBe("CommonPlayerActions");
    expect(template.fields.LevelName).toBe("");
    expect(template.fields.ParentTemplateId).toBe("");
    expect(template.fields.CharacterVisualResourceID).toBe("");
    expect(template.fields.AnimationSetResourceID).toBe("");
  });

  it("preset has VOLinesTableUUID set to vanilla CC constant", () => {
    const results = generatePresets({
      ...BASE_INPUT,
      bodyMatrix: [{ shape: 0, type: 0 }],
    });
    const preset = results.find(r => r.section === "CharacterCreationPresets")!;
    expect(preset.fields.VOLinesTableUUID).toBe("14df8f45-90af-4bd0-8024-42624da9976e");
  });

  it("generates nothing when bodyMatrix is empty", () => {
    const results = generatePresets({
      ...BASE_INPUT,
      bodyMatrix: [],
    });
    expect(results).toHaveLength(0);
  });
});

describe("generateDreamGuardianEntries", () => {
  const BASE_DG_INPUT = {
    raceUuid: "race-uuid-1",
    raceName: "Dunmer",
    bodyMatrix: [
      { shape: 0, type: 0 },
      { shape: 0, type: 1 },
    ],
    cameraBase: "HUM" as const,
  };

  it("generates 2 templates + 2 presets for 2 body combos", () => {
    const results = generateDreamGuardianEntries(BASE_DG_INPUT);
    expect(results).toHaveLength(4);
    const templates = results.filter(r => r.section === "RootTemplates");
    const presets = results.filter(r => r.section === "CompanionPresets");
    expect(templates).toHaveLength(2);
    expect(presets).toHaveLength(2);
  });

  it("DG templates use vanilla parent template UUIDs based on BodyType (sex)", () => {
    const results = generateDreamGuardianEntries(BASE_DG_INPUT);
    const templates = results.filter(r => r.section === "RootTemplates");
    const maleTemplate = templates.find(t => t.fields.Name.includes("_M_"))!;
    const femaleTemplate = templates.find(t => t.fields.Name.includes("_F_"))!;
    expect(maleTemplate.fields.ParentTemplateId).toBe("f7fc1cc8-5d9e-4ef0-a96f-440e8ce8728e");
    expect(femaleTemplate.fields.ParentTemplateId).toBe("ae7bfa09-87f7-4c34-ad55-513153eeddc4");
  });

  it("DG presets use CompanionPresets section (not CharacterCreationPresets)", () => {
    const results = generateDreamGuardianEntries(BASE_DG_INPUT);
    const presets = results.filter(r => r.section === "CompanionPresets");
    expect(presets).toHaveLength(2);
    expect(results.filter(r => r.section === "CharacterCreationPresets")).toHaveLength(0);
  });

  it("DG presets reference base race UUID, not sub-race", () => {
    const results = generateDreamGuardianEntries(BASE_DG_INPUT);
    const presets = results.filter(r => r.section === "CompanionPresets");
    for (const p of presets) {
      expect(p.fields.RaceUUID).toBe("race-uuid-1");
    }
  });

  it("DG SubRaceUUID is null GUID", () => {
    const results = generateDreamGuardianEntries(BASE_DG_INPUT);
    const presets = results.filter(r => r.section === "CompanionPresets");
    for (const p of presets) {
      expect(p.fields.SubRaceUUID).toBe("00000000-0000-0000-0000-000000000000");
    }
  });

  it("DG templates have Equipment: EQP_Daisy", () => {
    const results = generateDreamGuardianEntries(BASE_DG_INPUT);
    const templates = results.filter(r => r.section === "RootTemplates");
    for (const t of templates) {
      expect(t.fields.Equipment).toBe("EQP_Daisy");
    }
  });

  it("DG presets have VOLinesTableUUID and VoiceTableUUID constants", () => {
    const results = generateDreamGuardianEntries(BASE_DG_INPUT);
    const presets = results.filter(r => r.section === "CompanionPresets");
    for (const p of presets) {
      expect(p.fields.VOLinesTableUUID).toBe("eec1dacc-91ee-49db-968f-a367faa97f42");
      expect(p.fields.VoiceTableUUID).toBe("60e91119-d07a-497a-8b3f-1cd88d3b464e");
    }
  });

  it("4 body combos → 8 DG entries (4 templates + 4 presets)", () => {
    const results = generateDreamGuardianEntries({
      ...BASE_DG_INPUT,
      bodyMatrix: [
        { shape: 0, type: 0 },
        { shape: 0, type: 1 },
        { shape: 1, type: 0 },
        { shape: 1, type: 1 },
      ],
    });
    expect(results).toHaveLength(8);
    expect(results.filter(r => r.section === "RootTemplates")).toHaveLength(4);
    expect(results.filter(r => r.section === "CompanionPresets")).toHaveLength(4);
  });

  it("DG template Name follows pattern: {Race}_{M|F}_Daisy", () => {
    const results = generateDreamGuardianEntries(BASE_DG_INPUT);
    const templates = results.filter(r => r.section === "RootTemplates");
    const names = templates.map(t => t.fields.Name).sort();
    expect(names).toEqual(["Dunmer_F_Daisy", "Dunmer_M_Daisy"]);
  });

  it("DG template type is 'character'", () => {
    const results = generateDreamGuardianEntries(BASE_DG_INPUT);
    const templates = results.filter(r => r.section === "RootTemplates");
    for (const t of templates) {
      expect(t.fields.Type).toBe("character");
    }
  });

  it("DG template MapKey appears in DG preset's RootTemplate field", () => {
    const results = generateDreamGuardianEntries(BASE_DG_INPUT);
    const templates = results.filter(r => r.section === "RootTemplates");
    const presets = results.filter(r => r.section === "CompanionPresets");

    for (const template of templates) {
      const linked = presets.find(p => p.fields.RootTemplate === template.fields.MapKey);
      expect(linked).toBeDefined();
    }
  });

  it("DG camera uses Companion prefix", () => {
    const results = generateDreamGuardianEntries({
      ...BASE_DG_INPUT,
      bodyMatrix: [{ shape: 0, type: 0 }],
      cameraBase: "ELF",
    });
    const preset = results.find(r => r.section === "CompanionPresets")!;
    expect(preset.fields.CloseUpA).toBe("ELF_M_Camera_CompanionCloseup_A");
    expect(preset.fields.CloseUpB).toBe("ELF_M_Camera_CompanionCloseup_B");
    expect(preset.fields.Overview).toBe("ELF_M_Camera_CompanionOverview_A");
  });

  it("generates nothing when bodyMatrix is empty", () => {
    const results = generateDreamGuardianEntries({
      ...BASE_DG_INPUT,
      bodyMatrix: [],
    });
    expect(results).toHaveLength(0);
  });
});
