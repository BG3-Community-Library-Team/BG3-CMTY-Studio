// TODO (Sprint 15 I4): Call migrateLocalStorageProject(modPath)
// in scanService.ts after populateStagingFromMod completes,
// before projectStore.hydrate()

import {
  stagingUpsertRow,
  stagingMarkDeleted,
  stagingSetMeta,
  stagingListSections,
  type StagingSectionSummary,
} from "../tauri/staging.js";
import { getDbPaths } from "../tauri/db-management.js";
import { projectKey } from "../data/fieldKeys.js";

/** Shape of legacy localStorage project data from configStore. */
interface LegacyProjectData {
  disabled?: Record<string, boolean>;
  manualEntries?: LegacyManualEntry[];
  autoEntryOverrides?: Record<string, Record<string, string>>;
  autoEntryOrder?: Record<string, string[]>;
  format?: "Yaml" | "Json";
  locaEntries?: unknown[];
  autoLocaEntries?: Array<{ handle: string; text: string; version: number }>;
  osirisGoalEntries?: unknown[];
  osirisGoalFileUuid?: string;
}

interface LegacyManualEntry {
  section: string;
  fields: Record<string, string>;
  imported?: boolean;
  comment?: string;
}

/**
 * Migrate legacy localStorage project data into the staging DB.
 * Returns true if migration occurred, false if no legacy data found or already migrated.
 */
export async function migrateLocalStorageProject(modPath: string): Promise<boolean> {
  const key = projectKey(modPath);
  const migratedKey = key + "_migrated";

  // Already migrated
  if (localStorage.getItem(migratedKey)) return false;

  // No legacy data
  const raw = localStorage.getItem(key);
  if (!raw) return false;

  // Check if staging already has tracked changes
  const { staging: stagingDbPath } = await getDbPaths();
  const sections: StagingSectionSummary[] = await stagingListSections(stagingDbPath);
  const hasExistingChanges = sections.some(
    (s) => s.new_rows > 0 || s.modified_rows > 0 || s.deleted_rows > 0,
  );
  if (hasExistingChanges) {
    localStorage.setItem(migratedKey, "true");
    return false;
  }

  let data: LegacyProjectData;
  try {
    data = JSON.parse(raw) as LegacyProjectData;
  } catch {
    console.error("[migration] Failed to parse legacy project data for", modPath);
    return false;
  }

  try {
    // 1. manualEntries → new staging rows
    if (data.manualEntries?.length) {
      for (const entry of data.manualEntries) {
        const table = `lsx__${entry.section}`;
        await stagingUpsertRow(stagingDbPath, table, entry.fields, true);
      }
    }

    // 2. disabled → mark deleted
    if (data.disabled) {
      for (const [compositeKey, isDisabled] of Object.entries(data.disabled)) {
        if (!isDisabled) continue;
        const sepIdx = compositeKey.indexOf("::");
        if (sepIdx < 0) continue;
        const section = compositeKey.slice(0, sepIdx);
        const uuid = compositeKey.slice(sepIdx + 2);
        await stagingMarkDeleted(stagingDbPath, `lsx__${section}`, uuid);
      }
    }

    // 3. autoEntryOverrides → modified staging rows
    if (data.autoEntryOverrides) {
      for (const [compositeKey, overrideFields] of Object.entries(data.autoEntryOverrides)) {
        const sepIdx = compositeKey.indexOf("::");
        if (sepIdx < 0) continue;
        const section = compositeKey.slice(0, sepIdx);
        await stagingUpsertRow(stagingDbPath, `lsx__${section}`, overrideFields, false);
      }
    }

    // 4. locaEntries → meta blob
    if (data.locaEntries?.length) {
      await stagingSetMeta(stagingDbPath, "loca_entries", JSON.stringify(data.locaEntries));
    }

    // 5. autoLocaEntries → loca__english rows
    if (data.autoLocaEntries?.length) {
      for (const entry of data.autoLocaEntries) {
        await stagingUpsertRow(
          stagingDbPath,
          "loca__english",
          { contentuid: entry.handle, text: entry.text, version: String(entry.version) },
          true,
        );
      }
    }

    // 6. osirisGoalEntries + file UUID → meta blobs
    if (data.osirisGoalEntries?.length) {
      await stagingSetMeta(
        stagingDbPath,
        "osiris_goal_entries",
        JSON.stringify(data.osirisGoalEntries),
      );
    }
    if (data.osirisGoalFileUuid) {
      await stagingSetMeta(stagingDbPath, "osiris_goal_file_uuid", data.osirisGoalFileUuid);
    }

    // 7. format preference
    if (data.format) {
      await stagingSetMeta(stagingDbPath, "format", data.format);
    }

    // Mark migration complete
    localStorage.setItem(migratedKey, "true");
    return true;
  } catch (err) {
    console.error("[migration] Error migrating legacy project data:", err);
    return false;
  }
}
