import { describe, it, expect } from "vitest";
import {
  getSectionCount,
  getGroupCount,
  hasModFiles,
  hasSection,
} from "../lib/utils/sectionCounts.js";
import type { SectionResult, DiffEntry } from "../lib/types/index.js";
import type { FolderNode } from "../lib/data/bg3FolderStructure.js";

// ── Fixtures ─────────────────────────────────────────────────────────────

function makeDiffEntry(overrides: Partial<DiffEntry> = {}): DiffEntry {
  return {
    uuid: "test-uuid",
    display_name: "Test",
    source_file: "Test.txt",
    entry_kind: "Modified",
    changes: [],
    node_id: "SpellData",
    region_id: "Spells",
    raw_attributes: {},
    raw_attribute_types: {},
    raw_children: {},
    ...overrides,
  } as DiffEntry;
}

function makeSectionResult(section: string, entries: DiffEntry[]): SectionResult {
  return { section, entries } as SectionResult;
}

function makeSectionMap(...sections: SectionResult[]): Map<string, SectionResult> {
  const m = new Map<string, SectionResult>();
  for (const s of sections) m.set(s.section, s);
  return m;
}

function makeManualCounts(entries: Record<string, number>): Map<string, number> {
  return new Map(Object.entries(entries));
}

const EMPTY_SECTION_MAP = new Map<string, SectionResult>();
const EMPTY_MANUAL_COUNTS = new Map<string, number>();

// ── getSectionCount ──────────────────────────────────────────────────────

describe("getSectionCount", () => {
  it("returns 0 for undefined section", () => {
    expect(getSectionCount(EMPTY_SECTION_MAP, EMPTY_MANUAL_COUNTS, undefined)).toBe(0);
  });

  it("returns 0 for missing section", () => {
    expect(getSectionCount(EMPTY_SECTION_MAP, EMPTY_MANUAL_COUNTS, "Races")).toBe(0);
  });

  it("returns entry count without filter", () => {
    const sm = makeSectionMap(
      makeSectionResult("Spells", [makeDiffEntry(), makeDiffEntry(), makeDiffEntry()]),
    );
    expect(getSectionCount(sm, EMPTY_MANUAL_COUNTS, "Spells")).toBe(3);
  });

  it("adds manual count when no filter", () => {
    const sm = makeSectionMap(makeSectionResult("Spells", [makeDiffEntry()]));
    const mc = makeManualCounts({ Spells: 5 });
    expect(getSectionCount(sm, mc, "Spells")).toBe(6); // 1 auto + 5 manual
  });

  it("excludes manual count when filter is present", () => {
    const sm = makeSectionMap(
      makeSectionResult("Spells", [
        makeDiffEntry({ node_id: "SpellData" }),
        makeDiffEntry({ node_id: "StatusData" }),
      ]),
    );
    const mc = makeManualCounts({ Spells: 10 });
    expect(getSectionCount(sm, mc, "Spells", { field: "node_id", value: "SpellData" })).toBe(1);
  });

  it("filters by node_id", () => {
    const sm = makeSectionMap(
      makeSectionResult("Spells", [
        makeDiffEntry({ node_id: "SpellData" }),
        makeDiffEntry({ node_id: "SpellData" }),
        makeDiffEntry({ node_id: "StatusData" }),
      ]),
    );
    expect(getSectionCount(sm, EMPTY_MANUAL_COUNTS, "Spells", { field: "node_id", value: "SpellData" })).toBe(2);
  });

  it("filters by raw_attributes field", () => {
    const sm = makeSectionMap(
      makeSectionResult("Spells", [
        makeDiffEntry({ raw_attributes: { SpellType: "Zone" } }),
        makeDiffEntry({ raw_attributes: { SpellType: "Projectile" } }),
        makeDiffEntry({ raw_attributes: { SpellType: "Zone" } }),
      ]),
    );
    expect(getSectionCount(sm, EMPTY_MANUAL_COUNTS, "Spells", { field: "SpellType", value: "Zone" })).toBe(2);
  });

  it("returns only manual count when section has no auto entries", () => {
    const mc = makeManualCounts({ Races: 3 });
    expect(getSectionCount(EMPTY_SECTION_MAP, mc, "Races")).toBe(3);
  });
});

// ── getGroupCount ────────────────────────────────────────────────────────

describe("getGroupCount", () => {
  it("returns 0 for node with no section, children, or groupSections", () => {
    const node: FolderNode = { name: "empty", label: "Empty" };
    expect(getGroupCount(EMPTY_SECTION_MAP, EMPTY_MANUAL_COUNTS, node)).toBe(0);
  });

  it("returns section count for leaf node", () => {
    const sm = makeSectionMap(makeSectionResult("Races", [makeDiffEntry(), makeDiffEntry()]));
    const node: FolderNode = { name: "Races", label: "Races", Section: "Races" };
    expect(getGroupCount(sm, EMPTY_MANUAL_COUNTS, node)).toBe(2);
  });

  it("applies entryFilter for leaf node", () => {
    const sm = makeSectionMap(
      makeSectionResult("Spells", [
        makeDiffEntry({ node_id: "SpellData" }),
        makeDiffEntry({ node_id: "StatusData" }),
      ]),
    );
    const node: FolderNode = {
      name: "Spell_Proj",
      label: "Spell Projectile",
      Section: "Spells",
      entryFilter: { field: "node_id", value: "SpellData" },
    };
    expect(getGroupCount(sm, EMPTY_MANUAL_COUNTS, node)).toBe(1);
  });

  it("sums children counts recursively", () => {
    const sm = makeSectionMap(
      makeSectionResult("Spells", [makeDiffEntry({ node_id: "SpellData" }), makeDiffEntry({ node_id: "SpellData" })]),
      makeSectionResult("Statuses", [makeDiffEntry()]),
    );
    const parent: FolderNode = {
      name: "_Stats",
      label: "Stats",
      isGroup: true,
      children: [
        { name: "_Spells", label: "Spells", Section: "Spells", entryFilter: { field: "node_id", value: "SpellData" } },
        { name: "_Statuses", label: "Statuses", Section: "Statuses" },
      ],
    };
    expect(getGroupCount(sm, EMPTY_MANUAL_COUNTS, parent)).toBe(3); // 2 + 1
  });

  it("prefers children over groupSections", () => {
    const sm = makeSectionMap(
      makeSectionResult("Spells", [
        makeDiffEntry({ node_id: "SpellData" }),
        makeDiffEntry({ node_id: "SpellData" }),
        makeDiffEntry({ node_id: "StatusData" }),
      ]),
    );
    // Node has both children and groupSections — children should win
    const node: FolderNode = {
      name: "_Spells",
      label: "Spells",
      groupSections: ["Spells"],
      children: [
        { name: "Proj", label: "Proj", Section: "Spells", entryFilter: { field: "node_id", value: "SpellData" } },
      ],
    };
    // children path: 1 child with filter = 2 SpellData entries
    // groupSections path would give 3 (unfiltered)
    expect(getGroupCount(sm, EMPTY_MANUAL_COUNTS, node)).toBe(2);
  });

  it("uses groupSections when no children or Section", () => {
    const sm = makeSectionMap(
      makeSectionResult("Spells", [makeDiffEntry()]),
      makeSectionResult("Statuses", [makeDiffEntry(), makeDiffEntry()]),
    );
    const node: FolderNode = {
      name: "_StatsOther",
      label: "Stats Other",
      isGroup: true,
      groupSections: ["Spells", "Statuses"],
    };
    expect(getGroupCount(sm, EMPTY_MANUAL_COUNTS, node)).toBe(3); // 1 + 2
  });
});

// ── hasModFiles ──────────────────────────────────────────────────────────

describe("hasModFiles", () => {
  it("returns false for empty section", () => {
    const sm = makeSectionMap(makeSectionResult("Races", []));
    const node: FolderNode = { name: "Races", label: "Races", Section: "Races" };
    expect(hasModFiles(sm, EMPTY_MANUAL_COUNTS, node)).toBe(false);
  });

  it("returns true when section has entries", () => {
    const sm = makeSectionMap(makeSectionResult("Races", [makeDiffEntry()]));
    const node: FolderNode = { name: "Races", label: "Races", Section: "Races" };
    expect(hasModFiles(sm, EMPTY_MANUAL_COUNTS, node)).toBe(true);
  });

  it("returns true when manual count makes section non-empty", () => {
    const mc = makeManualCounts({ Races: 1 });
    const node: FolderNode = { name: "Races", label: "Races", Section: "Races" };
    expect(hasModFiles(EMPTY_SECTION_MAP, mc, node)).toBe(true);
  });

  it("respects entryFilter", () => {
    const sm = makeSectionMap(
      makeSectionResult("Spells", [makeDiffEntry({ node_id: "StatusData" })]),
    );
    const node: FolderNode = {
      name: "Spell_Proj",
      label: "Spell Proj",
      Section: "Spells",
      entryFilter: { field: "node_id", value: "SpellData" },
    };
    expect(hasModFiles(sm, EMPTY_MANUAL_COUNTS, node)).toBe(false);
  });

  it("returns true if any child has mod files", () => {
    const sm = makeSectionMap(makeSectionResult("Races", [makeDiffEntry()]));
    const parent: FolderNode = {
      name: "_Group",
      label: "Group",
      children: [
        { name: "Empty", label: "Empty", Section: "Spells" },
        { name: "Races", label: "Races", Section: "Races" },
      ],
    };
    expect(hasModFiles(sm, EMPTY_MANUAL_COUNTS, parent)).toBe(true);
  });

  it("returns false if all children are empty", () => {
    const parent: FolderNode = {
      name: "_Group",
      label: "Group",
      children: [
        { name: "Empty1", label: "E1", Section: "Spells" },
        { name: "Empty2", label: "E2", Section: "Races" },
      ],
    };
    expect(hasModFiles(EMPTY_SECTION_MAP, EMPTY_MANUAL_COUNTS, parent)).toBe(false);
  });

  it("returns true via groupSections", () => {
    const sm = makeSectionMap(makeSectionResult("Spells", [makeDiffEntry()]));
    const node: FolderNode = {
      name: "_StatsOther",
      label: "Stats Other",
      groupSections: ["Spells", "Statuses"],
    };
    expect(hasModFiles(sm, EMPTY_MANUAL_COUNTS, node)).toBe(true);
  });

  it("returns false when no section, children, or groupSections", () => {
    const node: FolderNode = { name: "orphan", label: "Orphan" };
    expect(hasModFiles(EMPTY_SECTION_MAP, EMPTY_MANUAL_COUNTS, node)).toBe(false);
  });
});

// ── hasSection ───────────────────────────────────────────────────────────

describe("hasSection", () => {
  it("returns true for node with Section", () => {
    expect(hasSection({ name: "A", label: "A", Section: "Races" })).toBe(true);
  });

  it("returns true for node with groupSections", () => {
    expect(hasSection({ name: "A", label: "A", groupSections: ["Spells"] })).toBe(true);
  });

  it("returns true if any child has section", () => {
    const node: FolderNode = {
      name: "P",
      label: "P",
      children: [
        { name: "C1", label: "C1" },
        { name: "C2", label: "C2", Section: "Races" },
      ],
    };
    expect(hasSection(node)).toBe(true);
  });

  it("returns false for node with no section info", () => {
    expect(hasSection({ name: "A", label: "A" })).toBe(false);
  });

  it("returns false when children have no sections", () => {
    const node: FolderNode = {
      name: "P",
      label: "P",
      children: [
        { name: "C1", label: "C1" },
        { name: "C2", label: "C2" },
      ],
    };
    expect(hasSection(node)).toBe(false);
  });
});
