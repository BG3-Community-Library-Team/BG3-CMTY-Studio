/**
 * Pure utility functions for generating Character Creation Preset entries,
 * paired RootTemplate entries, and Dream Guardian entries for a race.
 *
 * Epic 5 + Epic 6 — Phase 3 (Batch Generation)
 *
 * Body semantics (BG3 schema):
 *   BodyType:  0 = Masculine, 1 = Feminine   (sex / gender presentation)
 *   BodyShape: 0 = Regular,   1 = Strong     (body build)
 */
import { generateUuid } from "./uuid.js";

export interface PresetGeneratorInput {
  raceUuid: string;
  raceName: string;
  subRaces: { uuid: string; name: string }[];
  bodyMatrix: { shape: number; type: number }[];
  cameraBase: "HUM" | "ELF" | "HUM_MB" | "DRG";
}

export interface GeneratedEntry {
  section: string;
  fields: Record<string, string>;
}

/** Universal VOLinesTableUUID for player CC Presets (all vanilla races use this) */
const CC_VOLINES_UUID = "14df8f45-90af-4bd0-8024-42624da9976e";

/** DG-specific VOLinesTableUUID (CompanionPresets) */
const DG_VOLINES_UUID = "eec1dacc-91ee-49db-968f-a367faa97f42";

/** DG-specific VoiceTableUUID (CompanionPresets) */
const DG_VOICE_UUID = "60e91119-d07a-497a-8b3f-1cd88d3b464e";

/**
 * Derive the sex suffix from BodyType (NOT BodyShape).
 * BodyType 0 = Masculine → "M", BodyType 1 = Feminine → "F"
 */
function sexSuffix(bodyType: number): string {
  return bodyType === 0 ? "M" : "F";
}

/** Derive the build label from BodyShape. 0 = Regular, 1 = Strong */
function buildLabel(bodyShape: number): string {
  return bodyShape === 0 ? "Regular" : "Strong";
}

/**
 * Generate CC Preset + RootTemplate entry pairs for all body × sub-race combinations.
 * Each CC Preset is cross-linked to its RootTemplate via the `RootTemplate` field.
 */
export function generatePresets(input: PresetGeneratorInput): GeneratedEntry[] {
  const results: GeneratedEntry[] = [];

  // If no sub-races, generate for base race (self-reference)
  const targets =
    input.subRaces.length > 0
      ? input.subRaces
      : [{ uuid: input.raceUuid, name: input.raceName }];

  for (const target of targets) {
    for (const body of input.bodyMatrix) {
      const presetUuid = generateUuid();
      const templateUuid = generateUuid();
      const sex = sexSuffix(body.type);
      const build = buildLabel(body.shape);

      // RootTemplate entry (MapKey is the primary key for Templates region)
      results.push({
        section: "RootTemplates",
        fields: {
          MapKey: templateUuid,
          Name: `${target.name}_${sex}_${build}_Player`,
          Type: "character",
          LevelName: "",
          Race: target.uuid,
          SpellSet: "CommonPlayerActions",
          ParentTemplateId: "",
          CharacterVisualResourceID: "",
          AnimationSetResourceID: "",
        },
      });

      // CC Preset entry (cross-linked to template)
      results.push({
        section: "CharacterCreationPresets",
        fields: {
          UUID: presetUuid,
          RaceUUID: input.raceUuid,
          SubRaceUUID: target.uuid,
          BodyShape: String(body.shape),
          BodyType: String(body.type),
          RootTemplate: templateUuid,
          CloseUpA: `${input.cameraBase}_${sex}_Camera_Closeup_A`,
          CloseUpB: `${input.cameraBase}_${sex}_Camera_Closeup_B`,
          Overview: `${input.cameraBase}_${sex}_Camera_Overview_A`,
          VOLinesTableUUID: CC_VOLINES_UUID,
        },
      });
    }
  }

  return results;
}

/** Vanilla Dream Guardian parent template UUIDs */
const VANILLA_DG_PARENTS = {
  male: "f7fc1cc8-5d9e-4ef0-a96f-440e8ce8728e",
  female: "ae7bfa09-87f7-4c34-ad55-513153eeddc4",
} as const;

/**
 * Generate Dream Guardian RootTemplate + CompanionPreset entry pairs.
 * DG entries always reference the base race (not sub-races),
 * and use vanilla DG parent templates.
 */
export function generateDreamGuardianEntries(input: {
  raceUuid: string;
  raceName: string;
  bodyMatrix: { shape: number; type: number }[];
  cameraBase: "HUM" | "ELF" | "HUM_MB" | "DRG";
}): GeneratedEntry[] {
  const results: GeneratedEntry[] = [];
  const NULL_GUID = "00000000-0000-0000-0000-000000000000";

  for (const body of input.bodyMatrix) {
    const dgTemplateUuid = generateUuid();
    const dgPresetUuid = generateUuid();
    const sex = sexSuffix(body.type);
    const parentTemplate =
      body.type === 0 ? VANILLA_DG_PARENTS.male : VANILLA_DG_PARENTS.female;

    // DG RootTemplate
    results.push({
      section: "RootTemplates",
      fields: {
        MapKey: dgTemplateUuid,
        Name: `${input.raceName}_${sex}_Daisy`,
        Type: "character",
        LevelName: "",
        Race: input.raceUuid,
        ParentTemplateId: parentTemplate,
        Equipment: "EQP_Daisy",
      },
    });

    // DG CompanionPreset (separate section from player CC Presets)
    results.push({
      section: "CompanionPresets",
      fields: {
        UUID: dgPresetUuid,
        RaceUUID: input.raceUuid,
        SubRaceUUID: NULL_GUID,
        RootTemplate: dgTemplateUuid,
        BodyShape: String(body.shape),
        BodyType: String(body.type),
        CloseUpA: `${input.cameraBase}_${sex}_Camera_CompanionCloseup_A`,
        CloseUpB: `${input.cameraBase}_${sex}_Camera_CompanionCloseup_B`,
        Overview: `${input.cameraBase}_${sex}_Camera_CompanionOverview_A`,
        VOLinesTableUUID: DG_VOLINES_UUID,
        VoiceTableUUID: DG_VOICE_UUID,
      },
    });
  }

  return results;
}
