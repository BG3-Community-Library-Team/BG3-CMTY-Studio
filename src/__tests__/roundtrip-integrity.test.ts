/**
 * PF-037: Round-trip integrity tests.
 *
 * Verifies that `checkRoundTrip()` correctly detects data loss,
 * mutation, unknown sections, and comments when comparing the
 * original config against what `parseExistingConfig()` captured.
 */

import { describe, it, expect } from "vitest";
import { checkRoundTrip, formatReport, type RoundTripReport } from "../lib/validation/roundtrip.js";
import { parseExistingConfig } from "../lib/utils/configParser.js";
import { suppressConsoleError, expectConsoleCalled } from "./helpers/suppressConsole.js";

// ── Helpers ─────────────────────────────────────────────────

function roundTrip(content: string, filePath = "test.yaml"): RoundTripReport {
  const { entries } = parseExistingConfig(content, filePath);
  return checkRoundTrip(content, filePath, entries);
}

function issueTypes(report: RoundTripReport): string[] {
  return report.issues.map((i) => i.type);
}

// ── Tests ───────────────────────────────────────────────────

describe("PF-037: Round-Trip Integrity — Full Fidelity", () => {
  it("perfect YAML round-trip yields 100% fidelity", () => {
    const yaml = `
Progressions:
  - UUID: "aabbccdd-1122-3344-5566-778899001122"
    Booleans:
      - Key: AllowImprovement
        Value: true
`;
    const report = roundTrip(yaml);
    expect(report.fidelityPercent).toBe(100);
    expect(report.issues).toHaveLength(0);
    expect(report.totalEntriesOriginal).toBe(1);
    expect(report.totalEntriesImported).toBe(1);
  });

  it("perfect JSON round-trip yields 100% fidelity", () => {
    const json = JSON.stringify({
      Progressions: [{
        UUID: "aabbccdd-1122-3344-5566-778899001122",
        Booleans: [{ Key: "AllowImprovement", Value: "true" }],
      }],
    });
    const report = roundTrip(json, "test.json");
    expect(report.fidelityPercent).toBe(100);
    expect(report.issues).toHaveLength(0);
  });

  it("multi-section config with full fidelity", () => {
    const yaml = `
Progressions:
  - UUID: "prog-uuid"
Lists:
  - UUID: "list-uuid"
    Action: Insert
    Type: SpellList
Races:
  - UUID: "race-uuid"
`;
    const report = roundTrip(yaml);
    expect(report.fidelityPercent).toBe(100);
    expect(report.totalEntriesOriginal).toBe(3);
    expect(report.totalEntriesImported).toBe(3);
  });
});

describe("PF-037: Round-Trip Integrity — Loss Detection", () => {
  it("detects UNKNOWN_SECTION for unrecognized sections", () => {
    const yaml = `
CustomMod:
  - UUID: "custom-uuid"
Progressions:
  - UUID: "prog-uuid"
`;
    const report = roundTrip(yaml);
    const unknown = report.issues.filter((i) => i.type === "UNKNOWN_SECTION");
    expect(unknown).toHaveLength(1);
    expect(unknown[0].section).toBe("CustomMod");
    expect(report.unknownSections).toContain("CustomMod");
  });

  it("detects LOST_COMMENT when YAML has comments", () => {
    const yaml = `
# This is a mod config
Progressions:
  - UUID: "prog-uuid" # inline comment
`;
    const report = roundTrip(yaml);
    expect(report.hadComments).toBe(true);
    const commentIssues = report.issues.filter((i) => i.type === "LOST_COMMENT");
    expect(commentIssues).toHaveLength(1);
  });

  it("no LOST_COMMENT for comment-free configs", () => {
    const yaml = `
Progressions:
  - UUID: "prog-uuid"
`;
    const report = roundTrip(yaml);
    expect(report.hadComments).toBe(false);
    const commentIssues = report.issues.filter((i) => i.type === "LOST_COMMENT");
    expect(commentIssues).toHaveLength(0);
  });

  it("multiple unknown sections are all reported", () => {
    const yaml = `
FutureSectionA:
  - UUID: "a"
FutureSectionB:
  - UUID: "b"
Progressions:
  - UUID: "prog-uuid"
`;
    const report = roundTrip(yaml);
    expect(report.unknownSections).toHaveLength(2);
    expect(report.unknownSections).toContain("FutureSectionA");
    expect(report.unknownSections).toContain("FutureSectionB");
  });
});

describe("PF-037: Round-Trip Integrity — Field Comparison", () => {
  it("reports fidelity based on entry count", () => {
    const yaml = `
Progressions:
  - UUID: "uuid-1"
  - UUID: "uuid-2"
  - UUID: "uuid-3"
`;
    const report = roundTrip(yaml);
    expect(report.totalEntriesOriginal).toBe(3);
    expect(report.fidelityPercent).toBe(100);
  });

  it("entries with same UUID match correctly", () => {
    const json = JSON.stringify({
      Lists: [
        { UUID: "list-1", Action: "Insert", Type: "SpellList" },
        { UUID: "list-2", Action: "Remove", Type: "SkillList" },
      ],
    });
    const report = roundTrip(json, "test.json");
    expect(report.fidelityPercent).toBe(100);
    expect(report.totalEntriesOriginal).toBe(2);
  });
});

describe("PF-037: Round-Trip Integrity — Edge Cases", () => {
  const consoleSpy = suppressConsoleError();

  it("empty config yields 100% fidelity with zero entries", () => {
    const report = roundTrip("{}", "test.json");
    expect(report.fidelityPercent).toBe(100);
    expect(report.totalEntriesOriginal).toBe(0);
    expect(report.totalEntriesImported).toBe(0);
    expect(report.issues).toHaveLength(0);
  });

  it("YAML with only FileVersion header", () => {
    const yaml = `FileVersion: "2.4.3"`;
    const report = roundTrip(yaml);
    expect(report.totalEntriesOriginal).toBe(0);
    expect(report.fidelityPercent).toBe(100);
  });

  it("unparseable content returns 0% fidelity", () => {
    // Invalid JSON
    const report = roundTrip("{invalid json!!!!!", "test.json");
    expect(report.fidelityPercent).toBe(0);
    expectConsoleCalled(consoleSpy, "Failed to parse existing config");
  });

  it("JSON with BOM still gets round-trip checked", () => {
    // JSON.parse doesn't strip BOM, so import returns empty
    const json = "\uFEFF" + JSON.stringify({ Progressions: [{ UUID: "test" }] });
    const report = roundTrip(json, "test.json");
    // The parser fails on BOM'd JSON, so fidelity should reflect that
    expect(report.totalEntriesImported).toBe(0);
    expectConsoleCalled(consoleSpy, "Failed to parse existing config");
  });

  it("handles config with only unknown sections", () => {
    const yaml = `
UnknownA:
  - UUID: "a"
UnknownB:
  - UUID: "b"
`;
    const report = roundTrip(yaml);
    expect(report.unknownSections).toHaveLength(2);
    expect(report.totalEntriesOriginal).toBe(0);
    expect(report.totalEntriesImported).toBe(0);
    expect(report.fidelityPercent).toBe(100); // no known entries → 100% vacuously
  });
});

describe("PF-037: formatReport", () => {
  it("renders a clean report for full fidelity", () => {
    const report: RoundTripReport = {
      issues: [],
      totalEntriesOriginal: 5,
      totalEntriesImported: 5,
      fidelityPercent: 100,
      hadComments: false,
      unknownSections: [],
    };
    const text = formatReport(report);
    expect(text).toContain("Import Fidelity Report");
    expect(text).toContain("Fidelity:            100%");
    expect(text).toContain("No issues detected");
  });

  it("renders issues grouped by type", () => {
    const report: RoundTripReport = {
      issues: [
        { type: "LOST_FIELD", section: "Progressions", uuid: "uuid-1", field: "Action", originalValue: "Insert" },
        { type: "LOST_FIELD", section: "Lists", uuid: "uuid-2", field: "Type", originalValue: "SpellList" },
        { type: "UNKNOWN_SECTION", section: "CustomMod" },
      ],
      totalEntriesOriginal: 3,
      totalEntriesImported: 2,
      fidelityPercent: 33,
      hadComments: false,
      unknownSections: ["CustomMod"],
    };
    const text = formatReport(report);
    expect(text).toContain("LOST_FIELD (2)");
    expect(text).toContain("UNKNOWN_SECTION (1)");
    expect(text).toContain("section: Progressions");
    expect(text).toContain("Unknown sections skipped: CustomMod");
  });
});
