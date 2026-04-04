/**
 * PF-032: Entry Grouping Engine.
 *
 * Pure-function grouping of DiffEntry[] by various criteria.
 * The results are used by SectionPanel to render collapsible
 * group headers with entry counts and select-all checkboxes.
 */

import type { DiffEntry, Section } from "../types/index.js";
import { localeCompare } from "./localeSort.js";

// ── Types ───────────────────────────────────────────────────

export type GroupCriterion =
  | "flat"
  | "tag"
  | "alphabetical"
  | "level"
  | "listType";

export interface EntryGroup {
  /** Group identifier (e.g. "Level 3", "SpellList", "A") */
  key: string;
  /** Display label */
  label: string;
  /** Entries belonging to this group */
  entries: DiffEntry[];
  /** Original indices in the source array — for stable key mapping */
  originalIndices: number[];
}

// ── Section → available grouping modes ──────────────────────

export const SECTION_GROUP_MODES: Partial<Record<Section, GroupCriterion[]>> = {
  Progressions: ["flat", "tag", "level", "alphabetical"],
  Lists: ["flat", "tag", "alphabetical"],
  Races: ["flat", "tag", "alphabetical"],
  Feats: ["flat", "tag", "alphabetical"],
  Origins: ["flat", "tag", "alphabetical"],
  Backgrounds: ["flat", "tag", "alphabetical"],
  BackgroundGoals: ["flat", "tag", "alphabetical"],
  ActionResources: ["flat", "tag", "alphabetical"],
  ActionResourceGroups: ["flat", "tag", "alphabetical"],
  ClassDescriptions: ["flat", "tag", "alphabetical"],
  Spells: ["flat", "tag", "alphabetical"],
};

export const GROUP_LABELS: Record<GroupCriterion, string> = {
  flat: "Flat",
  tag: "By Tag",
  alphabetical: "A–Z",
  level: "By Level",
  listType: "By List Type",
};

// ── Grouping engine ─────────────────────────────────────────

/**
 * Group entries according to the chosen criterion.
 * Returns an empty array for "flat" mode (caller renders ungrouped).
 */
export function groupEntries(
  entries: DiffEntry[],
  criterion: GroupCriterion,
  sectionName: string,
  isEnabled?: (section: string, uuid: string) => boolean,
): EntryGroup[] {
  if (criterion === "flat" || entries.length === 0) return [];

  switch (criterion) {
    case "tag":
      return groupByTag(entries, sectionName, isEnabled);
    case "alphabetical":
      return groupByAlphabetical(entries);
    case "level":
      return groupByLevel(entries);
    case "listType":
      return groupByListType(entries);
    default:
      return [];
  }
}

// ── Groupers ────────────────────────────────────────────────

/** Tag order for display: ADDED first, then NEW (not yet added), then AUTO (modified, not yet added). */
const TAG_ORDER = ["ADDED", "NEW", "AUTO"];
const TAG_DISPLAY: Record<string, string> = {
  ADDED: "ADDED — entries added to config",
  NEW: "NEW — new entries (not yet added)",
  AUTO: "AUTO — modified entries (not yet added)",
};

function groupByTag(entries: DiffEntry[], sectionName?: string, isEnabledFn?: (section: string, uuid: string) => boolean): EntryGroup[] {
  const buckets = new Map<string, { entries: DiffEntry[]; indices: number[] }>();

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const isEnabled = (sectionName && isEnabledFn) ? isEnabledFn(sectionName, e.uuid) : false;
    let tag: string;
    if (isEnabled) {
      tag = "ADDED";
    } else if (e.entry_kind === "New") {
      tag = "NEW";
    } else {
      tag = "AUTO";
    }
    let bucket = buckets.get(tag);
    if (!bucket) {
      bucket = { entries: [], indices: [] };
      buckets.set(tag, bucket);
    }
    bucket.entries.push(e);
    bucket.indices.push(i);
  }

  const result: EntryGroup[] = [];
  for (const key of TAG_ORDER) {
    const bucket = buckets.get(key);
    if (bucket) {
      result.push({
        key,
        label: `${TAG_DISPLAY[key] ?? key} (${bucket.entries.length})`,
        entries: bucket.entries,
        originalIndices: bucket.indices,
      });
    }
  }
  return result;
}

function groupByAlphabetical(entries: DiffEntry[]): EntryGroup[] {
  const buckets = new Map<string, { entries: DiffEntry[]; indices: number[] }>();

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const name = e.display_name || e.uuid;
    const firstChar = name.charAt(0).toUpperCase();
    const key = /[A-Z]/.test(firstChar) ? firstChar : "#";
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { entries: [], indices: [] };
      buckets.set(key, bucket);
    }
    bucket.entries.push(e);
    bucket.indices.push(i);
  }

  // Sort alphabetically
  return Array.from(buckets.entries())
    .sort(([a], [b]) => (a === "#" ? 1 : b === "#" ? -1 : localeCompare(a, b)))
    .map(([key, bucket]) => ({
      key,
      label: `${key} (${bucket.entries.length})`,
      entries: bucket.entries,
      originalIndices: bucket.indices,
    }));
}

const LEVEL_RE = /Level\s+(\d+)/i;

function groupByLevel(entries: DiffEntry[]): EntryGroup[] {
  const buckets = new Map<string, { entries: DiffEntry[]; indices: number[]; sortKey: number }>();

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    // Prefer raw_attributes.Level (actual LSX field), fall back to display_name regex
    const rawLevel = e.raw_attributes?.["Level"];
    let level = -1;
    if (rawLevel != null && rawLevel !== "") {
      level = parseInt(rawLevel, 10);
      if (Number.isNaN(level)) level = -1;
    }
    if (level < 0) {
      const match = (e.display_name || "").match(LEVEL_RE);
      level = match ? parseInt(match[1], 10) : -1;
    }
    const key = level >= 0 ? `Level ${level}` : "Unknown Level";
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { entries: [], indices: [], sortKey: level };
      buckets.set(key, bucket);
    }
    bucket.entries.push(e);
    bucket.indices.push(i);
  }

  return Array.from(buckets.entries())
    .sort(([, a], [, b]) => a.sortKey - b.sortKey)
    .map(([key, bucket]) => ({
      key,
      label: `${key} (${bucket.entries.length})`,
      entries: bucket.entries,
      originalIndices: bucket.indices,
    }));
}

/** Human-readable labels for list type node_ids */
const LIST_TYPE_LABELS: Record<string, string> = {
  SpellList: "Spell Lists",
  PassiveList: "Passive Lists",
  SkillList: "Skill Lists",
  AbilityList: "Ability Lists",
  EquipmentList: "Equipment Lists",
  ColorDefinitions: "Color Definitions",
};

function groupByListType(entries: DiffEntry[]): EntryGroup[] {
  const buckets = new Map<string, { entries: DiffEntry[]; indices: number[] }>();

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const listType = e.node_id || "Other";
    let bucket = buckets.get(listType);
    if (!bucket) {
      bucket = { entries: [], indices: [] };
      buckets.set(listType, bucket);
    }
    bucket.entries.push(e);
    bucket.indices.push(i);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => localeCompare(a, b))
    .map(([key, bucket]) => ({
      key,
      label: `${LIST_TYPE_LABELS[key] ?? key} (${bucket.entries.length})`,
      entries: bucket.entries,
      originalIndices: bucket.indices,
    }));
}
