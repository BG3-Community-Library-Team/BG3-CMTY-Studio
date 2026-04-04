/**
 * PF-037: Round-trip integrity checking.
 *
 * Compares an original config's semantic content against what
 * `parseExistingConfig()` actually captured (a `ManualEntry[]`).
 * Operates entirely at the semantic level — no re-serialization
 * through `preview.ts` required, so there is no store dependency.
 *
 * Usage:
 *   const { entries } = parseExistingConfig(raw, path);
 *   const report = checkRoundTrip(raw, path, entries);
 *   if (report.issues.length) showImportHealthDialog(report);
 */

import YAML from "yaml";
import { SECTIONS_ORDERED, type Section } from "../types/index.js";

// ── Types ───────────────────────────────────────────────────

export type IssueType =
  | "LOST_SECTION"
  | "LOST_ENTRY"
  | "LOST_FIELD"
  | "MUTATED_VALUE"
  | "LOST_COMMENT"
  | "UNKNOWN_SECTION";

export interface RoundTripIssue {
  type: IssueType;
  section?: string;
  /** UUID of the affected entry, if applicable. */
  uuid?: string;
  /** Field key that was lost or mutated. */
  field?: string;
  /** Value in the original file. */
  originalValue?: string;
  /** Value as captured by the parser. */
  importedValue?: string;
}

export interface RoundTripReport {
  /** All detected issues. */
  issues: RoundTripIssue[];
  /** Entries present in original file (across known sections). */
  totalEntriesOriginal: number;
  /** Entries produced by `parseExistingConfig`. */
  totalEntriesImported: number;
  /** 0-100 — percentage of entries with zero issues. */
  fidelityPercent: number;
  /** True when the original contained YAML comments. */
  hadComments: boolean;
  /** Section names in the original that aren't in KNOWN_SECTIONS. */
  unknownSections: string[];
}

// ── ManualEntry-shaped lite type (avoids .svelte.ts import) ─

interface ManualEntryLike {
  section: string;
  fields: Record<string, string>;
}

const KNOWN_SECTIONS = SECTIONS_ORDERED;

const KNOWN_SECTION_SET = new Set<string>(KNOWN_SECTIONS);

// ── Semantic Model ──────────────────────────────────────────

/**
 * A normalised representation of one config entry.
 * Only stores UUID (used for matching) — field-level comparison
 * is not reliable because the parser and the raw model use
 * fundamentally different key encodings (e.g. `Boolean:Key` vs
 * `Booleans.0.Key`). Instead we compare at the section + UUID
 * level which is the most actionable detection layer.
 */
interface SemanticEntry {
  uuid: string;
}

/** section-name → SemanticEntry[] */
type SemanticConfig = Map<string, SemanticEntry[]>;

// ── Public API ──────────────────────────────────────────────

/**
 * Compare what was in the original config file against what
 * `parseExistingConfig()` captured.
 *
 * @param originalContent Raw file text.
 * @param filePath        Used to pick YAML vs JSON parse path.
 * @param importedEntries The `ManualEntry[]` that `parseExistingConfig` returned.
 */
export function checkRoundTrip(
  originalContent: string,
  filePath: string,
  importedEntries: ManualEntryLike[],
): RoundTripReport {
  const isJson = filePath.endsWith(".json");

  const issues: RoundTripIssue[] = [];
  let original: SemanticConfig;
  let unknownSections: string[] = [];
  let hadComments = false;

  try {
    const parsed = parseRawToSemanticConfig(originalContent, isJson);
    original = parsed.config;
    unknownSections = parsed.unknownSections;
    hadComments = parsed.hadComments;
  } catch (e) {
    // If the file can't be re-parsed, we can't compare.
    return {
      issues: [{ type: "LOST_SECTION", section: "(all)", originalValue: `Parse failed: ${e instanceof Error ? e.message : String(e)}` }],
      totalEntriesOriginal: 0,
      totalEntriesImported: importedEntries.length,
      fidelityPercent: 0,
      hadComments: false,
      unknownSections: [],
    };
  }

  // Build imported semantic config
  const imported = entriesToSemanticConfig(importedEntries);

  // Track total entry counts
  let totalOriginal = 0;
  let entriesWithIssues = 0;

  // Report unknown sections
  for (const sec of unknownSections) {
    issues.push({ type: "UNKNOWN_SECTION", section: sec });
  }

  // Compare section-by-section
  for (const [section, originalEntries] of original) {
    totalOriginal += originalEntries.length;
    const importedEntryList = imported.get(section);

    if (!importedEntryList || importedEntryList.length === 0) {
      issues.push({
        type: "LOST_SECTION",
        section,
        originalValue: `${originalEntries.length} entries`,
      });
      entriesWithIssues += originalEntries.length;
      continue;
    }

    // Build UUID set from imported entries for this section
    const importedUuids = new Set(importedEntryList.map((e) => normalizeUuid(e.uuid)));

    for (const oe of originalEntries) {
      const normUuid = normalizeUuid(oe.uuid);

      if (normUuid && !importedUuids.has(normUuid)) {
        issues.push({
          type: "LOST_ENTRY",
          section,
          uuid: oe.uuid,
        });
        entriesWithIssues++;
      }
      // UUID-less entries (rare) — count them by position
      // We can't match them, so we compare counts instead
    }

    // If imported has fewer entries than original (UUID-less entries lost)
    const uuidLessOriginal = originalEntries.filter((e) => !e.uuid).length;
    const uuidLessImported = importedEntryList.filter((e) => !e.uuid).length;
    if (uuidLessImported < uuidLessOriginal) {
      const lost = uuidLessOriginal - uuidLessImported;
      for (let i = 0; i < lost; i++) {
        issues.push({ type: "LOST_ENTRY", section, uuid: "(no UUID)" });
        entriesWithIssues++;
      }
    }
  }

  // Comment advisory
  if (hadComments) {
    issues.push({ type: "LOST_COMMENT" });
  }

  const totalImported = importedEntries.length;
  const cleanEntries = Math.max(0, totalOriginal - entriesWithIssues);
  const fidelityPercent = totalOriginal > 0 ? Math.round((cleanEntries / totalOriginal) * 100) : 100;

  return {
    issues,
    totalEntriesOriginal: totalOriginal,
    totalEntriesImported: totalImported,
    fidelityPercent,
    hadComments,
    unknownSections,
  };
}

// ── Internal: Parse raw content to SemanticConfig ───────────

interface RawParseResult {
  config: SemanticConfig;
  unknownSections: string[];
  hadComments: boolean;
}

function parseRawToSemanticConfig(content: string, isJson: boolean): RawParseResult {
  if (isJson) return parseJsonToSemantic(content);
  return parseYamlToSemantic(content);
}

function parseJsonToSemantic(content: string): RawParseResult {
  const data = JSON.parse(content);
  const config: SemanticConfig = new Map();
  const unknownSections: string[] = [];

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { config, unknownSections, hadComments: false };
  }

  for (const [key, value] of Object.entries(data)) {
    if (key === "FileVersion") continue;
    if (!KNOWN_SECTION_SET.has(key)) {
      unknownSections.push(key);
      continue;
    }
    if (!Array.isArray(value)) continue;

    const entries: SemanticEntry[] = [];
    for (const item of value) {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        entries.push(objectToSemanticEntry(item));
      }
    }
    if (entries.length) config.set(key, entries);
  }

  return { config, unknownSections, hadComments: false };
}

function parseYamlToSemantic(content: string): RawParseResult {
  const normalized = content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const hadComments = /^\s*#/m.test(normalized);

  const doc = YAML.parse(normalized, { schema: "failsafe" }) ?? {};
  const config: SemanticConfig = new Map();
  const unknownSections: string[] = [];

  if (typeof doc !== "object" || Array.isArray(doc)) {
    return { config, unknownSections, hadComments };
  }

  for (const [key, value] of Object.entries(doc as Record<string, unknown>)) {
    if (key === "FileVersion") continue;
    if (!KNOWN_SECTION_SET.has(key)) {
      unknownSections.push(key);
      continue;
    }
    if (!Array.isArray(value)) continue;

    const entries: SemanticEntry[] = [];
    for (const item of value) {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        entries.push(objectToSemanticEntry(item as Record<string, unknown>));
      }
    }
    if (entries.length) config.set(key, entries);
  }

  return { config, unknownSections, hadComments };
}

/**
 * Extract UUID from a raw parsed object for identity matching.
 */
function objectToSemanticEntry(obj: Record<string, unknown>): SemanticEntry {
  const uuidsRaw = obj["UUIDs"] ?? obj["UUID"];
  let uuid = "";
  if (Array.isArray(uuidsRaw)) {
    uuid = uuidsRaw.map(String).join("|");
  } else if (uuidsRaw != null) {
    uuid = String(uuidsRaw);
  }

  return { uuid };
}

// ── Internal: ManualEntry[] → SemanticConfig ────────────────

function entriesToSemanticConfig(entries: ManualEntryLike[]): SemanticConfig {
  const config: SemanticConfig = new Map();

  for (const entry of entries) {
    const uuid = entry.fields["UUID"] ?? "";

    let list = config.get(entry.section);
    if (!list) {
      list = [];
      config.set(entry.section, list);
    }
    list.push({ uuid });
  }

  return config;
}

// ── Normalization helpers ───────────────────────────────────

function normalizeUuid(uuid: string): string {
  return uuid.toLowerCase().trim();
}

// ── Report formatting ───────────────────────────────────────

/**
 * Format a `RoundTripReport` as human-readable text suitable
 * for display or saving to a `.txt` file.
 */
export function formatReport(report: RoundTripReport): string {
  const lines: string[] = [];
  lines.push("═══ Import Fidelity Report ═══");
  lines.push("");
  lines.push(`Entries in original: ${report.totalEntriesOriginal}`);
  lines.push(`Entries imported:    ${report.totalEntriesImported}`);
  lines.push(`Fidelity:            ${report.fidelityPercent}%`);
  lines.push("");

  if (report.unknownSections.length) {
    lines.push(`Unknown sections skipped: ${report.unknownSections.join(", ")}`);
    lines.push("");
  }

  if (report.issues.length === 0) {
    lines.push("✓ No issues detected — import is fully faithful.");
    return lines.join("\n");
  }

  const grouped = new Map<IssueType, RoundTripIssue[]>();
  for (const issue of report.issues) {
    let list = grouped.get(issue.type);
    if (!list) {
      list = [];
      grouped.set(issue.type, list);
    }
    list.push(issue);
  }

  for (const [type, issues] of grouped) {
    lines.push(`── ${type} (${issues.length}) ──`);
    for (const i of issues) {
      const parts: string[] = [];
      if (i.section) parts.push(`section: ${i.section}`);
      if (i.uuid) parts.push(`uuid: ${i.uuid}`);
      if (i.field) parts.push(`field: ${i.field}`);
      if (i.originalValue !== undefined) parts.push(`original: ${i.originalValue}`);
      if (i.importedValue !== undefined) parts.push(`imported: ${i.importedValue}`);
      lines.push(`  • ${parts.join(" | ")}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
