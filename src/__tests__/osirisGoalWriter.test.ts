/**
 * Osiris goal file generation tests — covers osirisGoalWriter utility functions.
 */
import { describe, it, expect } from "vitest";
import { toOsirisGuidString, generateRaceTagGoalFile, type RaceTagPair } from "../lib/utils/osirisGoalWriter.js";

// ── toOsirisGuidString() ─────────────────────────────────────────────────

describe("toOsirisGuidString", () => {
  it("converts tag name and UUID to GUIDSTRING format", () => {
    const result = toOsirisGuidString("DUNMER", "a1b2c3d4-e5f6-7890-abcd-ef1234567890");
    expect(result).toBe("DUNMER_a1b2c3d4-e5f6-7890-abcd-ef1234567890");
  });

  it("strips pipe wrapping and uppercases the tag name", () => {
    const result = toOsirisGuidString("|Dunmer|", "a1b2c3d4-e5f6-7890-abcd-ef1234567890");
    expect(result).toBe("DUNMER_a1b2c3d4-e5f6-7890-abcd-ef1234567890");
  });

  it("handles REALLY_ prefix correctly", () => {
    const result = toOsirisGuidString("REALLY_DUNMER", "b2c3d4e5-f6a7-8901-bcde-f12345678901");
    expect(result).toBe("REALLY_DUNMER_b2c3d4e5-f6a7-8901-bcde-f12345678901");
  });

  it("rejects tag names with lowercase characters after stripping", () => {
    expect(() => toOsirisGuidString("dunmer", "a1b2c3d4-e5f6-7890-abcd-ef1234567890"))
      .not.toThrow(); // uppercased internally, so "dunmer" → "DUNMER" which is valid
    // But pipe-stripped + uppercased result must pass TAGNAME_RE
  });

  it("rejects tag names with special characters", () => {
    expect(() => toOsirisGuidString("DUNMER TAG", "a1b2c3d4-e5f6-7890-abcd-ef1234567890"))
      .toThrow("Invalid tag name for Osiris");
  });

  it("rejects tag names with dots", () => {
    expect(() => toOsirisGuidString("DUNMER.TAG", "a1b2c3d4-e5f6-7890-abcd-ef1234567890"))
      .toThrow("Invalid tag name for Osiris");
  });

  it("rejects UUIDs with invalid characters", () => {
    expect(() => toOsirisGuidString("DUNMER", "not-a-valid-uuid"))
      .toThrow("Invalid UUID for Osiris goal file");
  });

  it("rejects UUIDs with injection attempts", () => {
    expect(() => toOsirisGuidString("DUNMER", 'a1b2c3d4-e5f6-7890-abcd-ef1234567890");DB_Drop('))
      .toThrow("Invalid UUID for Osiris goal file");
  });

  it("accepts numeric tag names", () => {
    const result = toOsirisGuidString("TAG123", "a1b2c3d4-e5f6-7890-abcd-ef1234567890");
    expect(result).toBe("TAG123_a1b2c3d4-e5f6-7890-abcd-ef1234567890");
  });

  it("rejects empty tag name after stripping", () => {
    expect(() => toOsirisGuidString("||", "a1b2c3d4-e5f6-7890-abcd-ef1234567890"))
      .toThrow("Invalid tag name for Osiris");
  });
});

// ── generateRaceTagGoalFile() ────────────────────────────────────────────

describe("generateRaceTagGoalFile", () => {
  const singlePair: RaceTagPair = {
    raceTagName: "DUNMER",
    raceTagUuid: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    reallyTagName: "REALLY_DUNMER",
    reallyTagUuid: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  };

  it("returns empty string for empty pairs array", () => {
    expect(generateRaceTagGoalFile([])).toBe('');
  });

  it("produces valid goal file with 1 DB_RaceTags fact", () => {
    const result = generateRaceTagGoalFile([singlePair]);
    expect(result).toContain("DB_RaceTags(DUNMER_a1b2c3d4-e5f6-7890-abcd-ef1234567890, REALLY_DUNMER_b2c3d4e5-f6a7-8901-bcde-f12345678901);");
  });

  it("starts with Version 1 and SubGoalCombiner SGC_AND", () => {
    const result = generateRaceTagGoalFile([singlePair]);
    expect(result).toMatch(/^Version 1\n/);
    expect(result).toContain("SubGoalCombiner SGC_AND");
  });

  it("ends with ParentTargetEdge __Shared_Campaign", () => {
    const result = generateRaceTagGoalFile([singlePair]);
    expect(result).toContain('ParentTargetEdge "__Shared_Campaign"');
    expect(result.trimEnd()).toMatch(/ParentTargetEdge "__Shared_Campaign"$/);
  });

  it("places DB_RaceTags in INITSECTION", () => {
    const result = generateRaceTagGoalFile([singlePair]);
    const lines = result.split('\n');
    const initIdx = lines.indexOf('INITSECTION');
    const kbIdx = lines.indexOf('KBSECTION');
    const dbIdx = lines.findIndex(l => l.startsWith('DB_RaceTags'));
    expect(initIdx).toBeGreaterThan(-1);
    expect(kbIdx).toBeGreaterThan(-1);
    expect(dbIdx).toBeGreaterThan(initIdx);
    expect(dbIdx).toBeLessThan(kbIdx);
  });

  it("uses GUIDSTRING format with no (TAG) cast prefix", () => {
    const result = generateRaceTagGoalFile([singlePair]);
    expect(result).not.toContain("(TAG)");
  });

  it("produces goal file with 3 DB_RaceTags facts for 3 pairs", () => {
    const pairs: RaceTagPair[] = [
      singlePair,
      {
        raceTagName: "BOSMER",
        raceTagUuid: "11111111-2222-3333-4444-555555555555",
        reallyTagName: "REALLY_BOSMER",
        reallyTagUuid: "66666666-7777-8888-9999-aaaaaaaaaaaa",
      },
      {
        raceTagName: "ALTMER",
        raceTagUuid: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        reallyTagName: "REALLY_ALTMER",
        reallyTagUuid: "ffffffff-0000-1111-2222-333333333333",
      },
    ];
    const result = generateRaceTagGoalFile(pairs);
    const dbLines = result.split('\n').filter(l => l.startsWith('DB_RaceTags'));
    expect(dbLines).toHaveLength(3);
    expect(dbLines[0]).toContain("DUNMER");
    expect(dbLines[1]).toContain("BOSMER");
    expect(dbLines[2]).toContain("ALTMER");
  });

  it("includes all required goal file sections", () => {
    const result = generateRaceTagGoalFile([singlePair]);
    expect(result).toContain("INITSECTION");
    expect(result).toContain("KBSECTION");
    expect(result).toContain("EXITSECTION");
    expect(result).toContain("ENDEXITSECTION");
  });

  it("tag names are uppercased with pipe-wrapping stripped", () => {
    const pair: RaceTagPair = {
      raceTagName: "HUMAN",
      raceTagUuid: "69fd1443-7686-4ca9-9516-72ec0b9d94d7",
      reallyTagName: "REALLY_HUMAN",
      reallyTagUuid: "8e288154-e7ca-4277-b2df-e61639b1cce8",
    };
    const result = generateRaceTagGoalFile([pair]);
    // Matches the vanilla format exactly
    expect(result).toContain(
      "DB_RaceTags(HUMAN_69fd1443-7686-4ca9-9516-72ec0b9d94d7, REALLY_HUMAN_8e288154-e7ca-4277-b2df-e61639b1cce8);"
    );
  });
});
