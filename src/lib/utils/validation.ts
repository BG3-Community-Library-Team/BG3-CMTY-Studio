/**
 * Entry validation engine — validates entries and returns detailed issues
 * with human-readable messages for inline display.
 */
import type { SelectedEntry } from "../types/index.js";

/** A single validation issue for an entry. */
export interface ValidationIssue {
  level: "warning" | "error";
  message: string;
}

/** Result of validating an entry. */
export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Checks whether the entry's identity field is typed as a GUID (vs FixedString etc). */
function identityFieldIsGuid(entry: SelectedEntry): boolean {
  // Stats entries use string IDs (e.g. "Fireball"), not GUIDs
  if (entry.table_name?.startsWith("stats__")) return false;
  const types = entry.raw_attribute_types;
  if (!types) return true; // conservative default: assume GUID if no type info
  const idType = types["UUID"] ?? types["MapKey"];
  return !idType || idType.toLowerCase() === "guid";
}

/**
 * Validate an entry and return detailed issues.
 * Checks: actionable changes, raw attribute presence, UUID format, removal-only entries.
 */
export function validateEntry(entry: SelectedEntry): ValidationResult {
  const issues: ValidationIssue[] = [];

  // EntireEntryNew entries need raw_attributes
  if (entry.changes.length === 1 && entry.changes[0].change_type === "EntireEntryNew") {
    if (!entry.raw_attributes || Object.keys(entry.raw_attributes).length === 0) {
      issues.push({ level: "error", message: "New entry has no attributes \u2014 cannot serialize" });
      return { valid: false, issues };
    }
    // Valid new entry with attributes
    if (entry.uuid && identityFieldIsGuid(entry) && !UUID_RE.test(entry.uuid)) {
      issues.push({ level: "warning", message: `UUID format invalid: ${entry.uuid}` });
    }
    return { valid: true, issues };
  }

  // Entries with no changes are valid (may use raw_attributes/raw_children)
  if (entry.changes.length === 0) {
    if (entry.uuid && identityFieldIsGuid(entry) && !UUID_RE.test(entry.uuid)) {
      issues.push({ level: "warning", message: `UUID format invalid: ${entry.uuid}` });
    }
    return { valid: true, issues };
  }

  // UUID format check
  if (entry.uuid && identityFieldIsGuid(entry) && !UUID_RE.test(entry.uuid)) {
    issues.push({ level: "warning", message: `UUID format invalid: ${entry.uuid}` });
  }

  // Check for removed-only entries (no additions)
  const hasOnlyRemovals = entry.changes.every(c =>
    c.removed_values.length > 0 && c.added_values.length === 0 && c.mod_value == null
  );
  if (hasOnlyRemovals) {
    issues.push({ level: "warning", message: "Entry only removes values \u2014 ensure this is intentional" });
  }

  return { valid: true, issues };
}

/** Thin wrapper — returns just the boolean for backward compat. */
export function isEntryValid(entry: SelectedEntry): boolean {
  return validateEntry(entry).valid;
}
