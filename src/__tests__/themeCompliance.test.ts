/**
 * Theme compliance lint — catches hardcoded Tailwind zinc color classes and
 * verifies theme token key completeness across all built-in themes.
 *
 * Part 1: Scans .svelte files in src/components/ and src/app.css for
 *         hardcoded `bg-zinc-*`, `text-zinc-*`, `border-zinc-*` classes
 *         that should use `var(--th-*)` tokens instead.
 *
 * Part 2: Verifies every theme in THEME_TOKENS has the exact same key set.
 */
/// <reference types="node" />
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { THEME_TOKENS } from "../lib/themes/themeTokens.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const COMPONENTS_DIR = path.join(WORKSPACE_ROOT, "src", "components");
const APP_CSS_PATH = path.join(WORKSPACE_ROOT, "src", "app.css");

/** Recursively collect all .svelte files under a directory. */
function walkSvelte(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkSvelte(full));
    } else if (entry.name.endsWith(".svelte")) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Strip HTML comments (<!-- ... -->) and Svelte {@html ...} blocks from
 * content so we don't flag zinc classes inside them.
 */
function stripCommentsAndHtmlBlocks(content: string): string {
  // Remove HTML/Svelte comments
  let stripped = content.replace(/<!--[\s\S]*?-->/g, "");
  // Remove {@html ...} blocks (non-greedy)
  stripped = stripped.replace(/\{@html\s[\s\S]*?\}/g, "");
  return stripped;
}

/**
 * Matches hardcoded Tailwind zinc color classes: bg-zinc-NNN, text-zinc-NNN,
 * border-zinc-NNN (including hover:/dark:/focus: prefixed variants).
 * Does NOT match inside `[var(--th-*)]` arbitrary-value syntax.
 */
const ZINC_CLASS_REGEX = /\b(?:bg|text|border)-zinc-\d+/g;

/** Return all zinc class violations in the given file content. */
function findZincViolations(content: string): string[] {
  const cleaned = stripCommentsAndHtmlBlocks(content);
  return Array.from(cleaned.matchAll(ZINC_CLASS_REGEX), (m) => m[0]);
}

// ---------------------------------------------------------------------------
// Part 1 — Hardcoded Tailwind zinc color lint
// ---------------------------------------------------------------------------

describe("Theme compliance: hardcoded zinc color lint", () => {
  /**
   * Legacy allowlist — documents known files with hardcoded zinc classes.
   * Keys are workspace-relative paths (forward-slash normalized).
   * Values are the maximum allowed violation count.
   *
   * When violations are fixed, reduce the count. When all violations in a
   * file are fixed, remove it from this map entirely. If a file not in this
   * map gains violations, the test fails — preventing regression.
   *
   * Counts were baselined from the codebase as of Sprint 11.
   */
  const LEGACY_ALLOWLIST: Record<string, number> = {
    // --- Top-level components ---
    "src/components/EntryDiff.svelte": 6,
    "src/components/EntryRow.svelte": 16,
    "src/components/FormatToggle.svelte": 10,
    "src/components/ManualEntryForm.svelte": 2,
    "src/components/ManualEntryCard.svelte": 5,
    "src/components/SchemaForm.svelte": 4,
    "src/components/SectionAccordion.svelte": 6,
    "src/components/OutputSidebar.svelte": 1,
    "src/components/SectionPanel.svelte": 1,
    "src/components/MultiSelectCombobox.svelte": 10,
    "src/components/SingleSelectCombobox.svelte": 8,
    "src/components/TagBadge.svelte": 4,
    // --- manual-entry sub-components ---
    "src/components/manual-entry/FieldsFieldset.svelte": 2,
    "src/components/manual-entry/FormBody.svelte": 1,
    "src/components/manual-entry/FormFooter.svelte": 2,
    "src/components/manual-entry/FormChildrenGroups.svelte": 3,
    "src/components/manual-entry/FormIdentity.svelte": 5,
    "src/components/manual-entry/FormSelectors.svelte": 1,
    "src/components/manual-entry/SelectorFieldset.svelte": 2,
    "src/components/manual-entry/RaceTagPanel.svelte": 1,
    // --- app.css: theme override rules that remap zinc → var(--th-*) ---
    // These are NOT violations — they are the theme system itself — but
    // they match the regex, so we allowlist them to avoid false positives.
    "src/app.css": 51,
  };

  /** Normalize a file path to workspace-relative, forward-slash form. */
  function relPath(absPath: string): string {
    return path.relative(WORKSPACE_ROOT, absPath).replace(/\\/g, "/");
  }

  it("should not have new hardcoded zinc color classes in component files", () => {
    const svelteFiles = walkSvelte(COMPONENTS_DIR);
    const allFiles = [...svelteFiles, APP_CSS_PATH];

    const failures: string[] = [];

    for (const file of allFiles) {
      const content = fs.readFileSync(file, "utf-8");
      const violations = findZincViolations(content);
      const rel = relPath(file);
      const allowed = LEGACY_ALLOWLIST[rel] ?? 0;

      if (violations.length > allowed) {
        failures.push(
          `${rel}: found ${violations.length} zinc violations (allowed: ${allowed}).\n` +
          `  New violations: ${violations.slice(allowed).join(", ")}`,
        );
      }
    }

    expect(failures, "New hardcoded zinc color classes detected:\n" + failures.join("\n")).toHaveLength(0);
  });

  it("should have up-to-date allowlist (no stale entries for missing files)", () => {
    const svelteFiles = walkSvelte(COMPONENTS_DIR);
    const allFiles = new Set([...svelteFiles.map((f) => relPath(f)), relPath(APP_CSS_PATH)]);

    const stale = Object.keys(LEGACY_ALLOWLIST).filter((f) => !allFiles.has(f));
    expect(stale, "Allowlist references files that no longer exist").toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Part 2 — Theme token key completeness
// ---------------------------------------------------------------------------

describe("Theme compliance: token key completeness", () => {
  const themeIds = Object.keys(THEME_TOKENS) as Array<keyof typeof THEME_TOKENS>;

  it("should have exactly 10 built-in themes (excludes custom)", () => {
    expect(themeIds).toHaveLength(10);
  });

  it("should have identical key sets across all themes", () => {
    const referenceId = themeIds[0];
    const referenceKeys = Object.keys(THEME_TOKENS[referenceId]).sort();

    const mismatches: string[] = [];

    for (const id of themeIds.slice(1)) {
      const keys = Object.keys(THEME_TOKENS[id]).sort();
      const missing = referenceKeys.filter((k) => !keys.includes(k));
      const extra = keys.filter((k) => !referenceKeys.includes(k));

      if (missing.length > 0) {
        mismatches.push(`${id} is missing keys vs ${referenceId}: ${missing.join(", ")}`);
      }
      if (extra.length > 0) {
        mismatches.push(`${id} has extra keys vs ${referenceId}: ${extra.join(", ")}`);
      }
    }

    expect(mismatches, "Theme key mismatches:\n" + mismatches.join("\n")).toHaveLength(0);
  });
});
