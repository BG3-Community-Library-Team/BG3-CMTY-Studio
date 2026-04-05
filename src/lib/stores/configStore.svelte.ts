import type {
  SelectedEntry,
  SerializeOptions,
  OutputFormat,
  DiffEntry,
  Change,
  SectionResult,
  AnchorGroup,
} from "../types/index.js";
import { SECTIONS_ORDERED } from "../types/index.js";
import { generateUuid } from "../utils/uuid.js";
import { modStore } from "./modStore.svelte.js";
import { toastStore } from "./toastStore.svelte.js";
import { undoStore } from "./undoStore.svelte.js";
import { m } from "../../paraglide/messages.js";
import { entryKey, fieldOverrideKey, projectKey } from "../data/fieldKeys.js";
import { validateEntry } from "../utils/validation.js";

const VALID_SECTIONS = new Set<string>(SECTIONS_ORDERED);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validate a stored project blob, stripping invalid entries.
 *  Returns a sanitised copy safe to load into the store. */
export function validateStoredProject(data: Record<string, unknown>): {
  disabled: Record<string, boolean>;
  manualEntries: ManualEntry[];
  autoEntryOverrides: Record<string, Record<string, string>>;
  autoEntryOrder: Record<string, string[]>;
  format: OutputFormat | null;
  locaEntries: LocaFileEntry[];
  autoLocaEntries: Map<string, { text: string; version: number }>;
  warnings: string[];
} {
  const warnings: string[] = [];

  // ── disabled map ────────────────────────────────────────────────────
  const disabled: Record<string, boolean> = {};
  if (data.disabled && typeof data.disabled === "object") {
    for (const [k, v] of Object.entries(data.disabled as Record<string, unknown>)) {
      const parts = k.split("::");
      if (parts.length === 2 && VALID_SECTIONS.has(parts[0]) && UUID_RE.test(parts[1]) && typeof v === "boolean") {
        if (v) disabled[k] = true;
      } else {
        warnings.push(`Dropped invalid disabled key: ${k}`);
      }
    }
  } else if (data.enabled && typeof data.enabled === "object") {
    // Migration: invert old enabled map → disabled map
    for (const [k, v] of Object.entries(data.enabled as Record<string, unknown>)) {
      const parts = k.split("::");
      if (parts.length === 2 && VALID_SECTIONS.has(parts[0]) && UUID_RE.test(parts[1]) && typeof v === "boolean") {
        if (!v) disabled[k] = true;
      }
    }
    if (Object.keys(disabled).length > 0) {
      warnings.push("Migrated legacy 'enabled' map to 'disabled' map.");
    }
  }

  // ── manual entries ──────────────────────────────────────────────────
  const manualEntries: ManualEntry[] = [];
  if (Array.isArray(data.manualEntries)) {
    for (const entry of data.manualEntries) {
      if (
        entry && typeof entry === "object" &&
        typeof entry.section === "string" && VALID_SECTIONS.has(entry.section) &&
        entry.fields && typeof entry.fields === "object" &&
        Object.values(entry.fields).every((v: unknown) => typeof v === "string")
      ) {
        manualEntries.push(entry as ManualEntry);
      } else {
        warnings.push(`Dropped invalid manual entry: ${JSON.stringify(entry)?.slice(0, 120)}`);
      }
    }
  }

  // ── auto entry overrides ────────────────────────────────────────────
  const autoEntryOverrides: Record<string, Record<string, string>> = {};
  if (data.autoEntryOverrides && typeof data.autoEntryOverrides === "object") {
    for (const [k, v] of Object.entries(data.autoEntryOverrides as Record<string, unknown>)) {
      const parts = k.split("::");
      if (parts.length === 2 && VALID_SECTIONS.has(parts[0]) && UUID_RE.test(parts[1]) && v && typeof v === "object") {
        if (Object.values(v as Record<string, unknown>).every(val => typeof val === "string")) {
          autoEntryOverrides[k] = v as Record<string, string>;
        } else {
          warnings.push(`Dropped override with non-string values: ${k}`);
        }
      } else {
        warnings.push(`Dropped invalid override key: ${k}`);
      }
    }
  }

  // ── auto entry order ────────────────────────────────────────────────
  const autoEntryOrder: Record<string, string[]> = {};
  if (data.autoEntryOrder && typeof data.autoEntryOrder === "object") {
    for (const [k, v] of Object.entries(data.autoEntryOrder as Record<string, unknown>)) {
      if (VALID_SECTIONS.has(k) && Array.isArray(v) && v.every(id => typeof id === "string")) {
        autoEntryOrder[k] = v as string[];
      } else {
        warnings.push(`Dropped invalid autoEntryOrder key: ${k}`);
      }
    }
  }

  // ── format ──────────────────────────────────────────────────────────
  let format: OutputFormat | null = null;
  if (data.format === "Yaml" || data.format === "Json") {
    format = data.format;
  } else if (data.format) {
    warnings.push(`Dropped invalid format: ${data.format}`);
  }

  // ── loca entries ────────────────────────────────────────────────────
  const locaEntries: LocaFileEntry[] = [];
  if (Array.isArray(data.locaEntries)) {
    for (const entry of data.locaEntries) {
      if (
        entry && typeof entry === "object" &&
        typeof entry.label === "string" &&
        Array.isArray(entry.values) &&
        entry.values.every((v: unknown) =>
          v && typeof v === "object" &&
          typeof (v as LocaValue).contentuid === "string" &&
          typeof (v as LocaValue).version === "number" &&
          typeof (v as LocaValue).text === "string"
        )
      ) {
        const migrated: LocaFileEntry = {
          id: typeof entry.id === "string" ? entry.id : generateUuid(),
          label: entry.label,
          values: (entry.values as LocaValue[]).map((v: LocaValue) => ({
            id: typeof v.id === "string" ? v.id : generateUuid(),
            contentuid: v.contentuid,
            version: v.version,
            text: v.text,
          })),
        };
        locaEntries.push(migrated);
      } else {
        warnings.push(`Dropped invalid loca entry: ${JSON.stringify(entry)?.slice(0, 120)}`);
      }
    }
  }

  // ── auto loca entries ─────────────────────────────────────────────
  const autoLocaEntries = new Map<string, { text: string; version: number }>();
  if (Array.isArray(data.autoLocaEntries)) {
    for (const entry of data.autoLocaEntries) {
      if (
        entry && typeof entry === "object" &&
        typeof entry.handle === "string" &&
        typeof entry.text === "string"
      ) {
        autoLocaEntries.set(entry.handle, {
          text: entry.text,
          version: typeof entry.version === "number" ? entry.version : 1,
        });
      } else {
        warnings.push(`Dropped invalid autoLoca entry: ${JSON.stringify(entry)?.slice(0, 120)}`);
      }
    }
  }

  return { disabled, manualEntries, autoEntryOverrides, autoEntryOrder, format, locaEntries, autoLocaEntries, warnings };
}

/** @deprecated Use entryKey() from fieldKeys.ts. Kept as local alias for readability. */
const makeKey = entryKey;

/**
 * Check how fully an imported entry's fields cover an auto-detected entry's changes.
 * Semicolon-delimited values (e.g., PassivesAdded) are compared at the individual value level.
 */
function checkChangeCoverage(
  importedFields: Record<string, string>,
  autoChanges: Change[],
): { coverage: "full" | "partial" | "none"; uncoveredChanges: Change[] } {
  const uncoveredChanges: Change[] = [];
  // Cache parsed semicolon-delimited value sets per field to avoid re-splitting
  const parsedSets = new Map<string, Set<string>>();

  for (const change of autoChanges) {
    const impVal = importedFields[change.field];

    if (impVal === undefined || impVal === null) {
      uncoveredChanges.push(change);
      continue;
    }

    if (change.added_values.length > 0) {
      let impValues = parsedSets.get(change.field);
      if (!impValues) {
        impValues = new Set(impVal.split(";").map((v: string) => v.trim()).filter(Boolean));
        parsedSets.set(change.field, impValues);
      }
      const uncoveredAdded = change.added_values.filter(v => !impValues!.has(v));
      if (uncoveredAdded.length > 0) {
        uncoveredChanges.push({ ...change, added_values: uncoveredAdded });
      }
    } else {
      if (change.mod_value !== null && impVal !== change.mod_value) {
        uncoveredChanges.push(change);
      }
    }
  }

  if (uncoveredChanges.length === 0) return { coverage: "full", uncoveredChanges };
  if (uncoveredChanges.length < autoChanges.length) return { coverage: "partial", uncoveredChanges };
  return { coverage: "none", uncoveredChanges };
}

export interface ManualEntry {
  section: string;
  fields: Record<string, string>;
  /** True if this entry was imported from an existing config file (not manually created). */
  imported?: boolean;
  /** Optional YAML comment line above this entry (only emitted when entry comments are enabled). */
  comment?: string;
}

export interface EditOverride {
  /** section::entryId key */
  key: string;
  section: string;
  entryId: string;
  field: string;
  value: string;
}

/** A single <content> line inside a localization XML file. */
export interface LocaValue {
  id: string;
  contentuid: string;
  version: number;
  text: string;
}

/** A localization file entry — label becomes the XML filename. */
export interface LocaFileEntry {
  id: string;
  label: string;
  values: LocaValue[];
}

/** Reactive config-building state. */
class ConfigStore {
  /** Map of "section::entryId" → true for explicitly disabled entries.
   *  Entries NOT in this map (or with value false) are active. */
  disabled: Record<string, boolean> = $state({});

  /** Manual entries keyed by section */
  manualEntries: ManualEntry[] = $state([]);

  /** True when staging has unsaved mutations since last export/save. */
  isDirty: boolean = $state(false);

  /** Monotonically increasing count of staging mutations since last markClean(). */
  mutationCount: number = $state(0);

  /** Debounce timer for auto-persist */
  #persistTimer: ReturnType<typeof setTimeout> | null = null;

  /** Schedule a debounced auto-persist (500ms). Called after mutations. */
  #scheduleAutoPersist(): void {
    if (this.#persistTimer) clearTimeout(this.#persistTimer);
    this.#persistTimer = setTimeout(() => {
      const modPath = modStore.selectedModPath;
      if (modPath) this.persistProject(modPath);
    }, 500);
  }

  /** Mark preview stale, track dirty state, and schedule auto-persist. */
  #markDirty(): void {
    this.previewStale = true;
    this.isDirty = true;
    this.mutationCount++;
    this.#scheduleAutoPersist();
  }

  /** Reset dirty-state tracking (call after successful export/save). */
  markClean(): void {
    this.isDirty = false;
    this.mutationCount = 0;
  }

  /**
   * Snapshot of imported entries at scan time.
   * Used by resetSection to restore deleted imported entries.
   */
  #importedSnapshot: ManualEntry[] = [];

  /** Per-section auto-entry ordering. Maps section ? ordered UUIDs.
   *  When set, auto entries in that section appear in this order in both
   *  the section panel and the serialized output. */
  autoEntryOrder: Record<string, string[]> = $state({});

  /** Field-level overrides keyed by "section::entryId::field" */
  editOverrides: EditOverride[] = $state([]);

  /** Full-entry overrides for auto-detected entries: "section::uuid" ? fields.
   *  When set, the auto entry uses these manual fields instead of its diff-based changes. */
  autoEntryOverrides: Record<string, Record<string, string>> = $state({});

  /** Current output format. Changing this triggers preview regeneration via the $effect in OutputSidebar. */
  format: OutputFormat = $state("Yaml");

  /** Anchor detection results */
  anchorGroups: AnchorGroup[] = $state([]);

  /** Generated preview text */
  previewText: string = $state("");

  /** Pre-highlighted HTML for the preview (avoids re-highlighting on every reactive read) */
  highlightedPreviewHtml: string = $state("");

  /** Whether the preview needs regeneration. */
  previewStale: boolean = $state(false);

  /** Localization file entries (user-authored). Each entry becomes a Localization XML file. */
  locaEntries: LocaFileEntry[] = $state([]);

  /** Auto-generated localization entries: contentuid → { text, version }.
   *  Created when users type plain text into loca: fields. */
  autoLocaEntries: Map<string, { text: string; version: number }> = $state(new Map());

  /** Race tag → REALLY tag UUID pairs for Osiris goal file generation.
   *  Keyed by race entry UUID so pairs can be removed when a race is deleted. */
  osirisGoalEntries: Map<string, { raceTagName: string; raceTagUuid: string; reallyTagName: string; reallyTagUuid: string }> = $state(new Map());

  /** Stable per-project UUID for the Osiris goal filename. Generated once on first pair registration. */
  osirisGoalFileUuid: string = $state('');

  // ---- Derived (memoized — recomputed only when reactive deps change) ----

  readonly selectedBySection: Record<string, SelectedEntry[]> = $derived.by(() => {
    const result: Record<string, SelectedEntry[]> = {};
    const scanResult = modStore.scanResult;
    if (!scanResult) return result;

    for (const section of scanResult.sections) {
      const order = this.autoEntryOrder[section.section];
      let sectionEntries = section.entries;

      if (order && order.length > 0) {
        const entryMap = new Map(section.entries.map(e => [e.uuid, e]));
        const ordered: typeof section.entries = [];
        const seen = new Set<string>();
        for (const uuid of order) {
          const e = entryMap.get(uuid);
          if (e) { ordered.push(e); seen.add(uuid); }
        }
        for (const e of section.entries) {
          if (!seen.has(e.uuid)) ordered.push(e);
        }
        sectionEntries = ordered;
      }

      const entries: SelectedEntry[] = [];
      for (const diff of sectionEntries) {
        const key = makeKey(section.section, diff.uuid);
        if (this.disabled[key] !== true) {
          entries.push({
            section: section.section,
            uuid: diff.uuid,
            display_name: diff.display_name,
            changes: diff.changes,
            manual: false,
            list_type: section.section === "Lists" && diff.node_id ? diff.node_id : undefined,
            raw_attributes: diff.raw_attributes,
            raw_children: diff.raw_children,
            raw_attribute_types: diff.raw_attribute_types,
          });
        }
      }
      if (entries.length > 0) {
        result[section.section] = entries;
      }
    }

    return result;
  });

  readonly selectedEntries: SelectedEntry[] = $derived.by(() => {
    const sections = this.selectedBySection;
    const entries: SelectedEntry[] = [];
    for (const key of Object.keys(sections)) {
      entries.push(...sections[key]);
    }
    return entries;
  });

  readonly selectedCount: number = $derived(this.selectedEntries.length);

  /** Aggregated validation across all selected entries */
  readonly validationSummary = $derived.by(() => {
    const errors: { section: string; uuid: string; displayName: string; message: string }[] = [];
    const warnings: { section: string; uuid: string; displayName: string; message: string }[] = [];
    for (const entry of this.selectedEntries) {
      const result = validateEntry(entry);
      for (const issue of result.issues) {
        const item = { section: entry.section, uuid: entry.uuid, displayName: entry.display_name ?? entry.uuid, message: issue.message };
        if (issue.level === "error") errors.push(item);
        else warnings.push(item);
      }
    }
    return { errors, warnings, errorCount: errors.length, warningCount: warnings.length };
  });

  get serializeOptions(): SerializeOptions {
    return {
      format: this.format,
      use_anchors: this.anchorGroups.length > 0,
      include_comments: true,
    };
  }

  // ---- Actions ----

  /** Toggle a specific entry between active and disabled */
  toggleEntry(section: string, entryId: string): void {
    const key = makeKey(section, entryId);
    const wasDisabled = this.disabled[key] === true;
    if (wasDisabled) {
      delete this.disabled[key];
    } else {
      this.disabled[key] = true;
    }
    this.#markDirty();
    // SAFETY: clone — undo closures must capture by value (see gotchas #13)
    undoStore.push({
      label: wasDisabled ? "Enable entry" : "Disable entry",
      undo: () => {
        if (wasDisabled) { this.disabled[key] = true; } else { delete this.disabled[key]; }
        this.#markDirty();
      },
      redo: () => {
        if (wasDisabled) { delete this.disabled[key]; } else { this.disabled[key] = true; }
        this.#markDirty();
      },
    });
  }

  /** Enable all entries in a section (remove from disabled map) */
  enableSection(section: string): void {
    const scanResult = modStore.scanResult;
    if (!scanResult) return;
    const sectionResult = scanResult.sections.find(s => s.section === section);
    if (!sectionResult) return;
    const oldDisabled: Record<string, boolean> = {};
    for (const entry of sectionResult.entries) {
      const key = makeKey(section, entry.uuid);
      if (this.disabled[key] === true) oldDisabled[key] = true;
      delete this.disabled[key];
    }
    this.#markDirty();
    undoStore.push({
      label: "Enable all in section",
      undo: () => {
        for (const k of Object.keys(oldDisabled)) this.disabled[k] = true;
        this.#markDirty();
      },
      redo: () => {
        for (const k of Object.keys(oldDisabled)) delete this.disabled[k];
        this.#markDirty();
      },
    });
  }

  /** Disable all entries in a section */
  disableSection(section: string): void {
    const scanResult = modStore.scanResult;
    if (!scanResult) return;
    const sectionResult = scanResult.sections.find(s => s.section === section);
    if (!sectionResult) return;
    const oldDisabled: Record<string, boolean> = {};
    for (const entry of sectionResult.entries) {
      const key = makeKey(section, entry.uuid);
      oldDisabled[key] = this.disabled[key] === true;
      this.disabled[key] = true;
    }
    this.#markDirty();
    undoStore.push({
      label: "Disable all in section",
      undo: () => {
        for (const [k, wasDisabled] of Object.entries(oldDisabled)) {
          if (wasDisabled) { this.disabled[k] = true; } else { delete this.disabled[k]; }
        }
        this.#markDirty();
      },
      redo: () => {
        for (const k of Object.keys(oldDisabled)) this.disabled[k] = true;
        this.#markDirty();
      },
    });
  }

  /** Internal: disable auto entries without creating a separate undo snapshot. */
  #disableSectionEntries(section: string): void {
    const scanResult = modStore.scanResult;
    if (!scanResult) return;
    const sectionResult = scanResult.sections.find(s => s.section === section);
    if (!sectionResult) return;
    for (const entry of sectionResult.entries) {
      this.disabled[makeKey(section, entry.uuid)] = true;
    }
    this.#markDirty();
  }

  /** Remove ALL entries from a section: disable auto entries + delete all manual/imported entries */
  clearSection(section: string): void {
    // Capture state for undo
    const scanResult = modStore.scanResult;
    const oldDisabled: Record<string, boolean> = {};
    if (scanResult) {
      const sectionResult = scanResult.sections.find(s => s.section === section);
      if (sectionResult) {
        for (const entry of sectionResult.entries) {
          const key = makeKey(section, entry.uuid);
          oldDisabled[key] = this.disabled[key] === true;
        }
      }
    }
    const removedManual = this.manualEntries
      .filter(e => e.section === section)
      .map(e => ({ ...e, fields: { ...e.fields } }));
    const removedOverrides: Record<string, Record<string, string>> = {};
    for (const key of Object.keys(this.autoEntryOverrides)) {
      if (key.startsWith(section + "::")) {
        removedOverrides[key] = { ...this.autoEntryOverrides[key] };
      }
    }

    // Perform mutation
    this.#disableSectionEntries(section);
    this.manualEntries = this.manualEntries.filter(e => e.section !== section);
    for (const key of Object.keys(this.autoEntryOverrides)) {
      if (key.startsWith(section + "::")) {
        delete this.autoEntryOverrides[key];
      }
    }
    this.#markDirty();

    undoStore.push({
      label: "Clear section",
      undo: () => {
        for (const [k, wasDisabled] of Object.entries(oldDisabled)) {
          if (wasDisabled) { this.disabled[k] = true; } else { delete this.disabled[k]; }
        }
        for (const entry of removedManual) {
          this.manualEntries.push({ ...entry, fields: { ...entry.fields } });
        }
        for (const [k, fields] of Object.entries(removedOverrides)) {
          this.autoEntryOverrides[k] = { ...fields };
        }
        this.#markDirty();
      },
      redo: () => {
        this.#disableSectionEntries(section);
        this.manualEntries = this.manualEntries.filter(e => e.section !== section);
        for (const k of Object.keys(this.autoEntryOverrides)) {
          if (k.startsWith(section + "::")) delete this.autoEntryOverrides[k];
        }
        this.#markDirty();
      },
    });
  }

  /** Check whether an entry is enabled (active, not disabled) */
  isEnabled(section: string, entryId: string): boolean {
    const key = makeKey(section, entryId);
    return this.disabled[key] !== true;
  }

  /** Check whether all entries in a section are enabled (none disabled) */
  isSectionFullyEnabled(section: string): boolean {
    const scanResult = modStore.scanResult;
    if (!scanResult) return false;
    const sectionResult = scanResult.sections.find(s => s.section === section);
    if (!sectionResult) return true;
    return sectionResult.entries.every(e =>
      this.disabled[makeKey(section, e.uuid)] !== true
    );
  }

  /** Add a manual entry */
  addManualEntry(section: string, fields: Record<string, string>, imported = false, comment = ""): void {
    const entry: ManualEntry = { section, fields: { ...fields }, imported, comment: comment || undefined };
    this.manualEntries.push(entry);
    this.#markDirty();
    undoStore.push({
      label: "Add entry",
      undo: () => {
        this.manualEntries.pop();
        this.#markDirty();
      },
      redo: () => {
        this.manualEntries.push({ ...entry, fields: { ...entry.fields } });
        this.#markDirty();
      },
    });
  }

  /** Update an existing manual entry by index */
  updateManualEntry(index: number, section: string, fields: Record<string, string>, comment = ""): void {
    if (index < 0 || index >= this.manualEntries.length) return;
    const oldEntry = { ...this.manualEntries[index], fields: { ...this.manualEntries[index].fields } };
    const wasImported = this.manualEntries[index].imported;
    const newEntry: ManualEntry = { section, fields: { ...fields }, imported: wasImported, comment: comment || undefined };
    this.manualEntries[index] = newEntry;
    this.#markDirty();
    undoStore.push({
      label: "Edit entry",
      undo: () => {
        this.manualEntries[index] = { ...oldEntry, fields: { ...oldEntry.fields } };
        this.#markDirty();
      },
      redo: () => {
        this.manualEntries[index] = { ...newEntry, fields: { ...newEntry.fields } };
        this.#markDirty();
      },
    });
  }

  /** Remove a manual entry by index */
  removeManualEntry(index: number): void {
    if (index < 0 || index >= this.manualEntries.length) return;
    const removed = { ...this.manualEntries[index], fields: { ...this.manualEntries[index].fields } };
    this.manualEntries.splice(index, 1);
    this.#markDirty();
    undoStore.push({
      label: "Remove entry",
      undo: () => {
        this.manualEntries.splice(index, 0, { ...removed, fields: { ...removed.fields } });
        this.#markDirty();
      },
      redo: () => {
        this.manualEntries.splice(index, 1);
        this.#markDirty();
      },
    });
  }

  /** Batch-create manual entries across any number of sections as a single atomic undo step.
   *  Callers generate UUIDs before calling — no return value needed. */
  addManualEntries(
    entries: { section: string; fields: Record<string, string>; comment?: string }[],
    label = "Add entries"
  ): void {
    if (entries.length === 0) return;

    // Clone all entries for undo isolation (matches addManualEntry pattern)
    const cloned: ManualEntry[] = entries.map(e => ({
      section: e.section,
      fields: { ...e.fields },
      comment: e.comment || undefined,
    }));

    const insertIndex = this.manualEntries.length;

    // Push all at once — single reactive update, single markDirty
    this.manualEntries.push(...cloned);
    this.#markDirty();

    undoStore.push({
      label,
      undo: () => {
        this.manualEntries.splice(insertIndex, cloned.length);
        this.#markDirty();
      },
      redo: () => {
        this.manualEntries.push(
          ...cloned.map(e => ({ ...e, fields: { ...e.fields } }))
        );
        this.#markDirty();
      },
    });
  }

  /** Remove all manual entries matching a set of UUIDs across any sections.
   *  Single atomic undo step. */
  removeManualEntriesByUuid(uuids: Set<string>, label = "Remove entries"): void {
    // Capture entries + indices in reverse order for stable splice
    const toRemove: { index: number; entry: ManualEntry }[] = [];
    for (let i = this.manualEntries.length - 1; i >= 0; i--) {
      const uuid = this.manualEntries[i].fields.UUID;
      if (uuid && uuids.has(uuid)) {
        toRemove.push({
          index: i,
          entry: { ...this.manualEntries[i], fields: { ...this.manualEntries[i].fields } },
        });
      }
    }

    if (toRemove.length === 0) return;

    // Remove highest indices first to avoid index shifting
    for (const { index } of toRemove) {
      this.manualEntries.splice(index, 1);
    }
    this.#markDirty();

    undoStore.push({
      label,
      undo: () => {
        // Re-insert in forward index order (lowest first)
        const forward = [...toRemove].reverse();
        for (const { index, entry } of forward) {
          this.manualEntries.splice(index, 0, { ...entry, fields: { ...entry.fields } });
        }
        this.#markDirty();
      },
      redo: () => {
        // Re-remove in reverse index order (highest first)
        for (const { index } of toRemove) {
          this.manualEntries.splice(index, 1);
        }
        this.#markDirty();
      },
    });
  }

  /** Move an auto entry within a section's display/output order.
   *  `fromIdx` and `toIdx` are indices into the section's entry list. */
  moveAutoEntry(section: string, fromIdx: number, toIdx: number): void {
    const scanResult = modStore.scanResult;
    if (!scanResult) return;
    const sec = scanResult.sections.find(s => s.section === section);
    if (!sec) return;

    const hadOrder = !!this.autoEntryOrder[section];
    const oldOrder = hadOrder ? [...this.autoEntryOrder[section]] : null;

    // Get current order (or initialize from scan order)
    const order = this.autoEntryOrder[section]
      ? [...this.autoEntryOrder[section]]
      : sec.entries.map(e => e.uuid);

    if (fromIdx < 0 || fromIdx >= order.length || toIdx < 0 || toIdx >= order.length) return;
    if (fromIdx === toIdx) return;

    const [item] = order.splice(fromIdx, 1);
    order.splice(toIdx, 0, item);
    this.autoEntryOrder[section] = order;
    this.#markDirty();

    const newOrder = [...order];
    undoStore.push({
      label: "Reorder entry",
      undo: () => {
        if (oldOrder) {
          this.autoEntryOrder[section] = [...oldOrder];
        } else {
          delete this.autoEntryOrder[section];
        }
        this.#markDirty();
      },
      redo: () => {
        this.autoEntryOrder[section] = [...newOrder];
        this.#markDirty();
      },
    });
  }

  /** Move a manual entry within its section (by local section index, not global). */
  moveManualEntryInSection(section: string, fromLocalIdx: number, toLocalIdx: number): void {
    const sectionEntries = this.getManualEntriesForSection(section);
    if (fromLocalIdx < 0 || fromLocalIdx >= sectionEntries.length) return;
    if (toLocalIdx < 0 || toLocalIdx >= sectionEntries.length) return;
    if (fromLocalIdx === toLocalIdx) return;

    const fromGlobal = sectionEntries[fromLocalIdx].globalIndex;
    const toGlobal = sectionEntries[toLocalIdx].globalIndex;

    const [entry] = this.manualEntries.splice(fromGlobal, 1);
    const adjustedTo = toGlobal > fromGlobal ? toGlobal - 1 : toGlobal;
    this.manualEntries.splice(adjustedTo, 0, entry);
    this.#markDirty();

    undoStore.push({
      label: "Reorder entry",
      undo: () => {
        const [e] = this.manualEntries.splice(adjustedTo, 1);
        this.manualEntries.splice(fromGlobal, 0, e);
        this.#markDirty();
      },
      redo: () => {
        const [e] = this.manualEntries.splice(fromGlobal, 1);
        this.manualEntries.splice(adjustedTo, 0, e);
        this.#markDirty();
      },
    });
  }

  /** Get manual entries for a specific section */
  getManualEntriesForSection(section: string): { entry: ManualEntry; globalIndex: number }[] {
    return this.manualEntries
      .map((entry, i) => ({ entry, globalIndex: i }))
      .filter(({ entry }) => entry.section === section);
  }

  /** Get all manual entries referencing a specific Race UUID (satellite entries).
   *  Checks RaceUUID, Race, ParentGuid, SubRaceUUID fields, and
   *  Progression entries matching by TableUUID. */
  getManualEntriesForRace(
    raceUuid: string,
    progressionTableUuid?: string
  ): { entry: ManualEntry; index: number }[] {
    const results: { entry: ManualEntry; index: number }[] = [];
    for (let i = 0; i < this.manualEntries.length; i++) {
      const e = this.manualEntries[i];
      const f = e.fields;
      // Match by direct Race UUID reference
      if (
        f.RaceUUID === raceUuid ||
        f.Race === raceUuid ||
        f.ParentGuid === raceUuid ||
        f.SubRaceUUID === raceUuid
      ) {
        results.push({ entry: e, index: i });
        continue;
      }
      // Match Progressions by TableUUID (guarded by section to avoid false positives)
      if (
        progressionTableUuid &&
        f.TableUUID === progressionTableUuid &&
        e.section === "Progressions"
      ) {
        results.push({ entry: e, index: i });
      }
    }
    return results;
  }

  /** Set a field override on a diff entry */
  setEditOverride(section: string, entryId: string, field: string, value: string): void {
    const existing = this.editOverrides.find(
      o => o.section === section && o.entryId === entryId && o.field === field
    );
    if (existing) {
      const oldValue = existing.value;
      existing.value = value;
      this.#markDirty();
      undoStore.push({
        label: "Edit field",
        undo: () => {
          const eo = this.editOverrides.find(
            o => o.section === section && o.entryId === entryId && o.field === field
          );
          if (eo) eo.value = oldValue;
          this.#markDirty();
        },
        redo: () => {
          const eo = this.editOverrides.find(
            o => o.section === section && o.entryId === entryId && o.field === field
          );
          if (eo) eo.value = value;
          this.#markDirty();
        },
      });
    } else {
      this.editOverrides.push({
        key: fieldOverrideKey(section, entryId, field),
        section,
        entryId,
        field,
        value,
      });
      this.#markDirty();
      undoStore.push({
        label: "Edit field",
        undo: () => {
          const idx = this.editOverrides.findIndex(
            o => o.section === section && o.entryId === entryId && o.field === field
          );
          if (idx >= 0) this.editOverrides.splice(idx, 1);
          this.#markDirty();
        },
        redo: () => {
          this.editOverrides.push({
            key: fieldOverrideKey(section, entryId, field),
            section, entryId, field, value,
          });
          this.#markDirty();
        },
      });
    }
  }

  /** Remove a field override */
  removeEditOverride(section: string, entryId: string, field: string): void {
    const idx = this.editOverrides.findIndex(
      o => o.section === section && o.entryId === entryId && o.field === field
    );
    if (idx >= 0) {
      const removed = { ...this.editOverrides[idx] };
      this.editOverrides.splice(idx, 1);
      this.#markDirty();
      undoStore.push({
        label: "Remove field edit",
        undo: () => {
          this.editOverrides.splice(idx, 0, { ...removed });
          this.#markDirty();
        },
        redo: () => {
          const i = this.editOverrides.findIndex(
            o => o.section === section && o.entryId === entryId && o.field === field
          );
          if (i >= 0) this.editOverrides.splice(i, 1);
          this.#markDirty();
        },
      });
    }
  }

  /** Set a full-entry override on an auto-detected entry (replaces diff output). */
  setAutoEntryOverride(section: string, entryId: string, fields: Record<string, string>): void {
    const key = makeKey(section, entryId);
    const oldFields = this.autoEntryOverrides[key] ? { ...this.autoEntryOverrides[key] } : undefined;
    this.autoEntryOverrides[key] = fields;
    this.#markDirty();
    undoStore.push({
      label: "Override entry",
      undo: () => {
        if (oldFields) {
          this.autoEntryOverrides[key] = { ...oldFields };
        } else {
          delete this.autoEntryOverrides[key];
        }
        this.#markDirty();
      },
      redo: () => {
        this.autoEntryOverrides[key] = { ...fields };
        this.#markDirty();
      },
    });
  }

  /** Get override fields for an auto entry, if any. */
  getAutoEntryOverride(section: string, entryId: string): Record<string, string> | undefined {
    return this.autoEntryOverrides[makeKey(section, entryId)];
  }

  /** Clear an auto-entry override. */
  clearAutoEntryOverride(section: string, entryId: string): void {
    const key = makeKey(section, entryId);
    const oldFields = this.autoEntryOverrides[key] ? { ...this.autoEntryOverrides[key] } : undefined;
    delete this.autoEntryOverrides[key];
    this.#markDirty();
    undoStore.push({
      label: "Clear override",
      undo: () => {
        if (oldFields) {
          this.autoEntryOverrides[key] = { ...oldFields };
        }
        this.#markDirty();
      },
      redo: () => {
        delete this.autoEntryOverrides[key];
        this.#markDirty();
      },
    });
  }

  /** Toggle output format */
  toggleFormat(): void {
    this.format = this.format === "Yaml" ? "Json" : "Yaml";
    this.#markDirty();
  }

  /** Set preview text and highlighted HTML, mark as fresh */
  setPreview(text: string, highlightedHtml = ""): void {
    this.previewText = text;
    this.highlightedPreviewHtml = highlightedHtml;
    this.previewStale = false;
  }

  /** Reset all config state */
  reset(): void {
    if (this.#persistTimer) clearTimeout(this.#persistTimer);
    this.disabled = {};
    this.manualEntries = [];
    this.#importedSnapshot = [];
    this.editOverrides = [];
    this.autoEntryOverrides = {};
    this.autoEntryOrder = {};
    this.anchorGroups = [];
    this.previewText = "";
    this.previewStale = false;
    this.isDirty = false;
    this.mutationCount = 0;
    this.autoLocaEntries = new Map();
    this.locaEntries = [];
    this.osirisGoalEntries = new Map();
    this.osirisGoalFileUuid = '';
  }

  /** Take a snapshot of all current imported entries.
   *  Called once after existing-config import is complete. */
  snapshotImports(): void {
    this.#importedSnapshot = this.manualEntries
      .filter(e => e.imported === true)
      .map(e => ({ section: e.section, fields: { ...e.fields }, imported: true }));
  }

  /**
   * Merge imported entries with auto-detected entries.
   * - If an imported entry matches an auto entry on UUID+section and fully covers its changes,
   *   the auto entry is disabled (the imported entry supersedes it).
   * - If partially covered, the auto entry is kept but only with the uncovered changes
   *   (via an auto-entry override that strips covered values).
   */
  mergeImportedWithAuto(): void {
    const scanResult = modStore.scanResult;
    if (!scanResult) return;

    const toRemove = new Set<number>();

    for (let i = 0; i < this.manualEntries.length; i++) {
      const imp = this.manualEntries[i];
      if (!imp.imported) continue;

      const uuid = imp.fields["UUID"];
      if (!uuid) continue;

      const sectionResult: SectionResult | undefined = scanResult.sections.find(s => s.section === imp.section);
      if (!sectionResult) continue;

      const autoEntry: DiffEntry | undefined = sectionResult.entries.find((e: DiffEntry) => e.uuid === uuid);
      if (!autoEntry) continue;

      const key = makeKey(imp.section, uuid);

      const { coverage, uncoveredChanges } = checkChangeCoverage(imp.fields, autoEntry.changes);

      if (coverage === "full") {
        // Imported entry is redundant — auto entry already provides this data.
        // Remove the manual entry; keep the auto entry active (not disabled).
        toRemove.add(i);
      } else if (coverage === "partial") {
        // Partially covered: build override fields from uncovered changes only
        const overrideFields: Record<string, string> = { UUID: uuid };
        for (const ch of uncoveredChanges) {
          if (ch.added_values.length > 0) {
            overrideFields[ch.field] = ch.added_values.join(";");
          } else if (ch.mod_value !== null) {
            overrideFields[ch.field] = ch.mod_value;
          }
        }
        this.autoEntryOverrides[key] = overrideFields;
        // Remove the manual entry; auto entry + overrides handle it.
        toRemove.add(i);
      }
    }

    // Remove redundant imported entries (iterate in reverse to preserve indices)
    if (toRemove.size > 0) {
      this.manualEntries = this.manualEntries.filter((_, i) => !toRemove.has(i));
    }

    this.#markDirty();
  }

  /** Reset a single section to its initial scan state:
   *  - Re-enable all auto entries
   *  - Remove all manual entries for the section
   *  - Restore imported entries from the snapshot
   *  - Remove all edit overrides for the section
   */
  resetSection(section: string): void {
    const scanResult = modStore.scanResult;
    if (!scanResult) return;

    // Capture state for undo
    const sectionResult = scanResult.sections.find(s => s.section === section);
    const oldDisabled: Record<string, boolean> = {};
    if (sectionResult) {
      for (const entry of sectionResult.entries) {
        const key = makeKey(section, entry.uuid);
        oldDisabled[key] = this.disabled[key] === true;
      }
    }
    const oldManualEntries = this.manualEntries
      .filter(e => e.section === section)
      .map(e => ({ ...e, fields: { ...e.fields } }));
    const oldEditOverrides = this.editOverrides
      .filter(o => o.section === section)
      .map(o => ({ ...o }));
    const oldAutoEntryOverrides: Record<string, Record<string, string>> = {};
    for (const key of Object.keys(this.autoEntryOverrides)) {
      if (key.startsWith(section + "::")) {
        oldAutoEntryOverrides[key] = { ...this.autoEntryOverrides[key] };
      }
    }
    const oldAutoLocaEntries = new Map(this.autoLocaEntries);

    // Perform mutation: enable all (remove from disabled map)
    if (sectionResult) {
      for (const entry of sectionResult.entries) {
        delete this.disabled[makeKey(section, entry.uuid)];
      }
    }
    for (let i = this.manualEntries.length - 1; i >= 0; i--) {
      if (this.manualEntries[i].section === section) {
        this.manualEntries.splice(i, 1);
      }
    }
    const snapshotEntries = this.#importedSnapshot
      .filter(e => e.section === section)
      .map(e => ({ section: e.section, fields: { ...e.fields }, imported: true as const }));
    for (const entry of snapshotEntries) {
      this.manualEntries.push(entry);
    }
    for (let i = this.editOverrides.length - 1; i >= 0; i--) {
      if (this.editOverrides[i].section === section) {
        this.editOverrides.splice(i, 1);
      }
    }
    for (const key of Object.keys(this.autoEntryOverrides)) {
      if (key.startsWith(section + "::")) {
        delete this.autoEntryOverrides[key];
      }
    }
    this.#markDirty();

    // Capture post-reset state for redo
    const resetAutoLocaEntries = new Map(this.autoLocaEntries);
    const resetManualEntries = this.manualEntries
      .filter(e => e.section === section)
      .map(e => ({ ...e, fields: { ...e.fields } }));

    undoStore.push({
      label: "Reset section",
      undo: () => {
        // Restore disabled states
        for (const [k, wasDisabled] of Object.entries(oldDisabled)) {
          if (wasDisabled) { this.disabled[k] = true; } else { delete this.disabled[k]; }
        }
        // Remove current section manual entries and restore old ones
        for (let i = this.manualEntries.length - 1; i >= 0; i--) {
          if (this.manualEntries[i].section === section) this.manualEntries.splice(i, 1);
        }
        for (const entry of oldManualEntries) {
          this.manualEntries.push({ ...entry, fields: { ...entry.fields } });
        }
        // Restore edit overrides
        for (const eo of oldEditOverrides) {
          this.editOverrides.push({ ...eo });
        }
        // Restore auto entry overrides
        for (const [k, fields] of Object.entries(oldAutoEntryOverrides)) {
          this.autoEntryOverrides[k] = { ...fields };
        }
        // Restore auto loca entries
        this.autoLocaEntries = oldAutoLocaEntries;
        this.#markDirty();
      },
      redo: () => {
        // Re-apply the reset: enable all (remove from disabled)
        if (sectionResult) {
          for (const entry of sectionResult.entries) {
            delete this.disabled[makeKey(section, entry.uuid)];
          }
        }
        for (let i = this.manualEntries.length - 1; i >= 0; i--) {
          if (this.manualEntries[i].section === section) this.manualEntries.splice(i, 1);
        }
        for (const entry of resetManualEntries) {
          this.manualEntries.push({ ...entry, fields: { ...entry.fields } });
        }
        for (let i = this.editOverrides.length - 1; i >= 0; i--) {
          if (this.editOverrides[i].section === section) this.editOverrides.splice(i, 1);
        }
        for (const k of Object.keys(this.autoEntryOverrides)) {
          if (k.startsWith(section + "::")) delete this.autoEntryOverrides[k];
        }
        this.autoLocaEntries = resetAutoLocaEntries;
        this.#markDirty();
      },
    });
  }

  /** Initialize from scan results — entries are active by default (they exist in .lsx files). */
  initFromScan(): void {
    undoStore.clear();
    this.reset();
  }

  /** Check whether a section has user-made changes that can be reset.
   *  Imported entries in their original state do NOT count as changes.
   *  Only returns true when the user has actively modified this section. */
  hasSectionChanges(section: string): boolean {
    // 1. Any auto entry explicitly disabled by user?
    const scanResult = modStore.scanResult;
    if (scanResult) {
      const sectionResult = scanResult.sections.find(s => s.section === section);
      if (sectionResult) {
        for (const entry of sectionResult.entries) {
          if (this.disabled[makeKey(section, entry.uuid)] === true) return true;
        }
      }
    }

    // 2. Any non-imported manual entry?
    const sectionManual = this.manualEntries.filter(e => e.section === section);
    if (sectionManual.some(e => !e.imported)) return true;

    // 3. Any imported entry was removed? (compare against snapshot)
    const snapshotCount = this.#importedSnapshot.filter(e => e.section === section).length;
    const currentImportedCount = sectionManual.filter(e => e.imported).length;
    if (currentImportedCount < snapshotCount) return true;

    // 4. Any auto-entry override exists for this section?
    for (const key of Object.keys(this.autoEntryOverrides)) {
      if (key.startsWith(section + "::")) return true;
    }

    // 5. Any edit override exists for this section?
    if (this.editOverrides.some(o => o.section === section)) return true;

    return false;
  }

  // ---- Osiris Goal File Tracking ----

  /** Register a race tag → REALLY tag pair for Osiris goal file generation. */
  registerOsirisRaceTagPair(
    raceEntryUuid: string,
    raceTagName: string,
    raceTagUuid: string,
    reallyTagName: string,
    reallyTagUuid: string,
  ): void {
    const updated = new Map(this.osirisGoalEntries);
    updated.set(raceEntryUuid, { raceTagName, raceTagUuid, reallyTagName, reallyTagUuid });
    this.osirisGoalEntries = updated;
    if (!this.osirisGoalFileUuid) {
      this.osirisGoalFileUuid = generateUuid();
    }
    this.#markDirty();
  }

  /** Remove the Osiris race tag pair associated with a race entry. */
  removeOsirisRaceTagPair(raceEntryUuid: string): void {
    if (!this.osirisGoalEntries.has(raceEntryUuid)) return;
    const updated = new Map(this.osirisGoalEntries);
    updated.delete(raceEntryUuid);
    this.osirisGoalEntries = updated;
    this.#markDirty();
  }

  // ---- Persistence ----

  /** Persist current project state to localStorage, keyed by mod path. */
  persistProject(modPath: string): void {
    if (!modPath) return;
    const autoLocaArray = Array.from(this.autoLocaEntries.entries())
      .map(([handle, { text, version }]) => ({ handle, text, version }));
    const data = {
      disabled: this.disabled,
      manualEntries: this.manualEntries,
      autoEntryOverrides: this.autoEntryOverrides,
      autoEntryOrder: this.autoEntryOrder,
      format: this.format,
      locaEntries: this.locaEntries,
      autoLocaEntries: autoLocaArray,
      osirisGoalEntries: Array.from(this.osirisGoalEntries.entries())
        .map(([raceUuid, pair]) => ({ raceUuid, ...pair })),
      osirisGoalFileUuid: this.osirisGoalFileUuid,
    };
    try {
      const key = projectKey(modPath);
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn("Project persistence failed:", e);
      toastStore.error(m.app_persist_failed(), m.app_persist_failed_desc());
    }
  }

  /** Restore project state from localStorage for a given mod path.
   *  Returns true if state was restored, false if no saved state exists. */
  restoreProject(modPath: string): boolean {
    if (!modPath) return false;
    try {
      const raw = localStorage.getItem(projectKey(modPath));
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object") return false;

      const validated = validateStoredProject(data);
      if (validated.warnings.length > 0) {
        console.warn("Project restore warnings for", modPath, validated.warnings);
      }

      if (Object.keys(validated.disabled).length > 0) {
        this.disabled = validated.disabled;
      }
      if (validated.manualEntries.length > 0) {
        this.manualEntries = validated.manualEntries;
      }
      if (Object.keys(validated.autoEntryOverrides).length > 0) {
        this.autoEntryOverrides = validated.autoEntryOverrides;
      }
      if (Object.keys(validated.autoEntryOrder).length > 0) {
        this.autoEntryOrder = validated.autoEntryOrder;
      }
      if (validated.format) {
        this.format = validated.format;
      }
      if (validated.locaEntries.length > 0) {
        this.locaEntries = validated.locaEntries;
      }
      if (validated.autoLocaEntries.size > 0) {
        this.autoLocaEntries = validated.autoLocaEntries;
        // Inject into modStore.localizationMap for immediate display resolution
        // Wholesale replacement ensures Svelte 5 reactivity triggers
        const updated = new Map(modStore.localizationMap);
        for (const [handle, { text }] of validated.autoLocaEntries) {
          updated.set(handle, text);
        }
        modStore.localizationMap = updated;
      }
      // ── Osiris goal entries ─────────────────────────────────────────
      if (Array.isArray(data.osirisGoalEntries)) {
        const restored = new Map<string, { raceTagName: string; raceTagUuid: string; reallyTagName: string; reallyTagUuid: string }>();
        for (const entry of data.osirisGoalEntries as any[]) {
          if (
            entry && typeof entry === 'object' &&
            typeof entry.raceUuid === 'string' &&
            typeof entry.raceTagName === 'string' &&
            typeof entry.raceTagUuid === 'string' &&
            typeof entry.reallyTagName === 'string' &&
            typeof entry.reallyTagUuid === 'string'
          ) {
            restored.set(entry.raceUuid, {
              raceTagName: entry.raceTagName,
              raceTagUuid: entry.raceTagUuid,
              reallyTagName: entry.reallyTagName,
              reallyTagUuid: entry.reallyTagUuid,
            });
          }
        }
        if (restored.size > 0) {
          this.osirisGoalEntries = restored;
        }
      }
      if (typeof data.osirisGoalFileUuid === 'string' && data.osirisGoalFileUuid) {
        this.osirisGoalFileUuid = data.osirisGoalFileUuid;
      }

      this.previewStale = true;
      return true;
    } catch { return false; }
  }
}

export const configStore = new ConfigStore();
