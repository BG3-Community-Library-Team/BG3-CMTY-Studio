/**
 * Mod Import Service — manages additional mod import state and logic.
 *
 * Extracted from HamburgerMenu.svelte (CQ-C02).
 * Contains: addModPath, restoreModPath, importFromLoadOrder, checkDuplicate,
 * removeAdditionalMod, setAsPrimary, clearAll, and shared reactive state.
 *
 * All mod data is streamed directly from .pak files via PakReader and ingested
 * into ref_mods.sqlite — no files are extracted to disk.
 */
import { settingsStore } from "../stores/settingsStore.svelte.js";
import { m } from "../../paraglide/messages.js";
import { modStore } from "../stores/modStore.svelte.js";
import type { ModImportStatus } from "../stores/modStore.svelte.js";
import type { ModMetaInfo } from "../utils/tauri.js";
import {
  scanMod,
  dirSize,
  readModMeta,
  listLoadOrderPaks,
  getActiveModFolders,
  getModStatEntries,
  recreateStaging,
  populateStagingFromMod,
  checkStagingIntegrity,
  getDbPaths,
  populateModsDb,
  removeModFromModsDb,
  clearModsDb,
} from "../utils/tauri.js";
import { toastStore } from "../stores/toastStore.svelte.js";

/** Callback type for showing the duplicate mod prompt to the user. */
export type DuplicatePromptFn = (
  existingPath: string,
  existingMeta: ModMetaInfo | null,
  newPath: string,
  newMeta: ModMetaInfo | null,
) => Promise<"replace" | "keep-both" | "cancel">;

class ModImportService {
  // ── Shared reactive state ──────────────────────────────────────────
  gameDataValid: boolean | null = $state(null);
  additionalModMeta: Record<string, ModMetaInfo> = $state({});
  modDiskSizes: Record<string, string> = $state({});
  pendingModPaths: string[] = $state([]);
  modImportStatus: Record<string, ModImportStatus> = $state({});
  isImportingLoadOrder: boolean = $state(false);
  loadOrderStatus: string = $state("");

  /** All mod paths to display: committed (in modStore) + pending (being processed). */
  get allAdditionalModPaths(): string[] {
    return [...modStore.additionalModPaths, ...this.pendingModPaths];
  }

  // ── Utility helpers ────────────────────────────────────────────────

  formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
  }

  // ── Core import logic ──────────────────────────────────────────────

  /**
   * Restore a previously-persisted mod on startup. This function performs NO
   * disk mutations — no extraction, no conversion. It reads existing metadata
   * and scans the mod's files so they appear in the UI.
   *
   * If the mod's files are missing the onMount validation loop will have
   * already filtered it out, so this function can assume the paths exist.
   */
  async restoreModPath(p: string): Promise<void> {
    if (modStore.additionalModPaths.includes(p)) return;

    let newMeta: ModMetaInfo | null = null;
    try {
      newMeta = await readModMeta(p);
    } catch (e) {
      console.warn("Mod metadata read failed:", p, e);
    }

    if (newMeta) {
      this.additionalModMeta = { ...this.additionalModMeta, [p]: newMeta };
    }

    try {
      const result = await scanMod(p, undefined, false);
      modStore.additionalModPaths = [...modStore.additionalModPaths, p];
      modStore.additionalModResults = [...modStore.additionalModResults, result];

      // Rehydrate staging from restored mod's files (read-only, non-blocking on failure)
      const modName = p.split(/[\\/]/).pop()?.replace(/\.pak$/i, "") ?? "mod";
      try {
        const stagingDbPath = await recreateStaging();
        const summary = await populateStagingFromMod(p, modName, stagingDbPath);
        if (summary.file_errors > 0 || summary.row_errors > 0) {
          toastStore.warning(
            m.import_staging_warnings_title(),
            m.import_staging_warnings_detail({ file_errors: String(summary.file_errors), row_errors: String(summary.row_errors), mod_name: modName }),
          );
        }
        // Integrity check (diagnostic only)
        try {
          const issues = await checkStagingIntegrity();
          if (issues) {
            console.warn("[Staging] Integrity check issues after restore:", issues);
            toastStore.warning(m.import_staging_integrity(), issues);
          }
        } catch (intErr) {
          console.warn("[Staging] Integrity check failed:", intErr);
        }
      } catch (stagingErr) {
        console.warn("[Staging] Failed to rehydrate staging for restored mod:", p, stagingErr);
        toastStore.warning(m.import_staging_failed(), m.import_staging_population_failed({ mod_name: modName, error: String(stagingErr) }));
      }

      // Merge additional mod stat entries for combobox population (non-blocking)
      getModStatEntries(p).then(entries => {
        if (entries.length > 0) {
          const existing = new Set(modStore.modStatEntries.map(e => e.name));
          const novel = entries.filter(e => !existing.has(e.name));
          if (novel.length > 0) {
            modStore.modStatEntries = [...modStore.modStatEntries, ...novel];
          }
        }
      }).catch(err => console.warn("Failed to load additional mod stat entries:", err));

      // Re-ingest into ref_mods.sqlite on restore (non-blocking)
      {
        const modName = p.split(/[\\/]/).pop()?.replace(/\.pak$/i, "") ?? "mod";
        getDbPaths().then(dbPaths =>
          populateModsDb(p, modName, dbPaths.mods, false)
        ).catch(e => console.warn("[ref_mods] Failed to re-ingest on restore:", modName, e));
      }

      dirSize(p).then(bytes => {
        if (bytes > 0) this.modDiskSizes = { ...this.modDiskSizes, [p]: this.formatBytes(bytes) };
      }).catch(e => {
        console.warn("Disk size check failed:", p, e);
        this.modDiskSizes = { ...this.modDiskSizes, [p]: m.import_disk_size_unavailable() };
      });
    } catch (e: unknown) {
      console.warn("Failed to restore mod scan:", p, e);
      settingsStore.removeAdditionalModPath(p);
    }
  }

  /**
   * Add a new mod via the scan/ingest pipeline.
   * ONLY called from explicit user actions (Add Folder, Add .pak, Import Load Order).
   */
  async addModPath(p: string, showDuplicatePrompt: DuplicatePromptFn): Promise<void> {
    if (modStore.additionalModPaths.includes(p) || this.pendingModPaths.includes(p)) return;

    let newMeta: ModMetaInfo | null = null;

    // ── Read metadata (silent) ────────────────────────────────────────
    try {
      newMeta = await readModMeta(p);
    } catch (e) {
      console.warn("Mod metadata not found:", p, e);
    }

    // ── Duplicate check (silent) ──────────────────────────────────────
    if (newMeta) {
      const dupAction = await this.checkDuplicate(p, newMeta, showDuplicatePrompt);
      if (dupAction === "cancel") return;
    }

    this.pendingModPaths = [...this.pendingModPaths, p];
    if (newMeta) {
      this.additionalModMeta = { ...this.additionalModMeta, [p]: newMeta };
    }
    this.modImportStatus = { ...this.modImportStatus, [p]: "Scanning" };

    try {
      // Scan the mod for combobox and diff population.
      const result = await scanMod(p, undefined, false);

      // ── Ingest into ref_mods.sqlite ─────────────────────────────────
      {
        const modName = p.split(/[\\/]/).pop()?.replace(/\.pak$/i, "") ?? "mod";
        this.modImportStatus = { ...this.modImportStatus, [p]: "Ingesting" };
        try {
          const dbPaths = await getDbPaths();
          await populateModsDb(p, modName, dbPaths.mods, false);
        } catch (e) {
          console.warn("[ref_mods] Failed to ingest mod data:", modName, e);
        }
      }

      // Remove from pending BEFORE adding to committed store to prevent
      // the path appearing in both arrays simultaneously — which causes
      // Svelte each_key_duplicate errors in allAdditionalModPaths.
      this.pendingModPaths = this.pendingModPaths.filter(x => x !== p);
      const statusUpd = { ...this.modImportStatus }; delete statusUpd[p]; this.modImportStatus = statusUpd;

      modStore.additionalModPaths = [...modStore.additionalModPaths, p];
      modStore.additionalModResults = [...modStore.additionalModResults, result];
      settingsStore.addAdditionalModPath(p);

      // Merge additional mod stat entries for combobox population (non-blocking)
      getModStatEntries(p).then(entries => {
        if (entries.length > 0) {
          const existing = new Set(modStore.modStatEntries.map(e => e.name));
          const novel = entries.filter(e => !existing.has(e.name));
          if (novel.length > 0) {
            modStore.modStatEntries = [...modStore.modStatEntries, ...novel];
          }
        }
      }).catch(err => console.warn("Failed to load additional mod stat entries:", err));

      dirSize(p).then(bytes => {
        if (bytes > 0) this.modDiskSizes = { ...this.modDiskSizes, [p]: this.formatBytes(bytes) };
      }).catch(e => {
        console.warn("Disk size check failed:", p, e);
        this.modDiskSizes = { ...this.modDiskSizes, [p]: m.import_disk_size_unavailable() };
      });
    } catch (e: unknown) {
      console.warn("Failed to process additional mod:", e);
    } finally {
      this.pendingModPaths = this.pendingModPaths.filter(x => x !== p);
      const upd = { ...this.modImportStatus }; delete upd[p]; this.modImportStatus = upd;
    }
  }

  /** Check for duplicate UUID or name among loaded mods. Returns action taken. */
  async checkDuplicate(
    p: string,
    newMeta: ModMetaInfo,
    showDuplicatePrompt: DuplicatePromptFn,
  ): Promise<"replace" | "keep-both" | "cancel" | null> {
    for (const existingPath of modStore.additionalModPaths) {
      const existingMeta = this.additionalModMeta[existingPath] ?? null;
      if (!existingMeta) continue;
      const sameUuid = existingMeta.uuid && newMeta.uuid && existingMeta.uuid === newMeta.uuid;
      const sameName = existingMeta.name && newMeta.name && existingMeta.name === newMeta.name;
      if (sameUuid || sameName) {
        const action = await showDuplicatePrompt(existingPath, existingMeta, p, newMeta);
        if (action === "cancel") return "cancel";
        if (action === "replace") {
          const idx = modStore.additionalModPaths.indexOf(existingPath);
          if (idx >= 0) this.removeAdditionalMod(idx);
        }
        return action;
      }
    }
    return null;
  }

  removeAdditionalMod(index: number): void {
    const allPaths = this.allAdditionalModPaths;
    const removedPath = allPaths[index];
    if (!removedPath) return;

    // Clean up local metadata regardless of pending vs committed
    const metaUpd = { ...this.additionalModMeta }; delete metaUpd[removedPath]; this.additionalModMeta = metaUpd;
    const sizeUpd = { ...this.modDiskSizes }; delete sizeUpd[removedPath]; this.modDiskSizes = sizeUpd;

    // If it's a pending mod, just remove from pending
    const pendingIdx = this.pendingModPaths.indexOf(removedPath);
    if (pendingIdx >= 0) {
      this.pendingModPaths = this.pendingModPaths.filter(x => x !== removedPath);
      const upd = { ...this.modImportStatus }; delete upd[removedPath]; this.modImportStatus = upd;
      return;
    }

    // It's a committed mod in modStore — find its index there
    const storeIdx = modStore.additionalModPaths.indexOf(removedPath);
    if (storeIdx >= 0) {
      modStore.additionalModPaths = modStore.additionalModPaths.filter((_, i) => i !== storeIdx);
      modStore.additionalModResults = modStore.additionalModResults.filter((_, i) => i !== storeIdx);
      settingsStore.removeAdditionalModPath(removedPath);

      // Remove this mod's data from ref_mods.sqlite (non-blocking)
      const modName = removedPath.split(/[\\/]/).pop()?.replace(/\.pak$/i, "") ?? "mod";
      getDbPaths().then(dbPaths =>
        removeModFromModsDb(modName, dbPaths.mods)
      ).catch(e => console.warn("[ref_mods] Failed to remove mod data:", modName, e));

      // Adjust diffSource: if it pointed to the removed mod → reset to vanilla;
      // if it pointed to a later index → decrement to keep pointing at the same mod
      if (typeof modStore.diffSource === "number") {
        if (modStore.diffSource === storeIdx) {
          modStore.diffSource = "vanilla";
          modStore.diffOverrideSections = null;
        } else if (modStore.diffSource > storeIdx) {
          modStore.diffSource = modStore.diffSource - 1;
        }
      }
    }
  }

  /**
   * Import all .pak files from the BG3 Mods directory
   * (%LOCALAPPDATA%\Larian Studios\Baldur's Gate 3\Mods).
   */
  async importFromLoadOrder(showDuplicatePrompt: DuplicatePromptFn): Promise<void> {
    this.isImportingLoadOrder = true;
    this.loadOrderStatus = m.import_scanning_mods_dir();
    try {
      const paks = await listLoadOrderPaks();
      if (paks.length === 0) {
        this.loadOrderStatus = m.import_no_pak_files_load_order();
        return;
      }

      let activeFolders: Set<string> | null = null;
      try {
        const folders = await getActiveModFolders();
        if (folders.length > 0) {
          activeFolders = new Set(folders.map(f => f.toLowerCase()));
        }
      } catch (e) {
        console.warn("Could not read modsettings.lsx — importing all paks:", e);
      }

      const filteredPaks = activeFolders
        ? paks.filter(pakPath => {
            const stem = pakPath.split(/[\\/]/).pop()?.replace(/\.pak$/i, "").toLowerCase() ?? "";
            return activeFolders!.has(stem);
          })
        : paks;

      if (filteredPaks.length === 0) {
        this.loadOrderStatus = activeFolders
          ? m.import_no_active_mods({ total_paks: String(paks.length), active_count: String(activeFolders.size) })
          : m.import_no_pak_files();
        return;
      }

      let imported = 0;
      let skipped = 0;
      let failed = 0;
      for (const pakPath of filteredPaks) {
        if (modStore.additionalModPaths.includes(pakPath) || this.pendingModPaths.includes(pakPath)) {
          skipped++;
          continue;
        }
        this.loadOrderStatus = m.import_importing_status({ current: String(imported + skipped + failed + 1), total: String(filteredPaks.length), filename: pakPath.split(/[\\/]/).pop() ?? "" });
        try {
          await this.addModPath(pakPath, showDuplicatePrompt);
          imported++;
        } catch (e) {
          console.warn("Failed to import load order pak:", pakPath, e);
          failed++;
        }
      }
      const parts = [m.import_count_imported({ count: String(imported) })];
      if (skipped > 0) parts.push(m.import_count_already_loaded({ count: String(skipped) }));
      if (failed > 0) parts.push(m.import_count_failed({ count: String(failed) }));
      const inactive = paks.length - filteredPaks.length;
      if (activeFolders && inactive > 0) parts.push(m.import_count_inactive({ count: String(inactive) }));
      this.loadOrderStatus = m.import_load_order_complete({ summary: parts.join(", ") });
    } catch (e: unknown) {
      this.loadOrderStatus = m.import_load_order_error({ error: e instanceof Error ? e.message : String(e) });
      console.error("Import from load order failed:", e);
    } finally {
      this.isImportingLoadOrder = false;
    }
  }

  /**
   * Remove mod from additional mod list and return scan arguments for
   * switching it to the primary mod. Caller must invoke close() and
   * scanAndImport() after this returns.
   */
  setAsPrimary(modPath: string): { scanPath: string; extraPaths?: string[] } {
    const storeIdx = modStore.additionalModPaths.indexOf(modPath);
    if (storeIdx >= 0) {
      modStore.additionalModPaths = modStore.additionalModPaths.filter((_, i) => i !== storeIdx);
      modStore.additionalModResults = modStore.additionalModResults.filter((_, i) => i !== storeIdx);
      settingsStore.removeAdditionalModPath(modPath);
      if (typeof modStore.diffSource === "number") {
        if (modStore.diffSource === storeIdx) modStore.diffSource = "vanilla";
        else if (modStore.diffSource > storeIdx) modStore.diffSource = modStore.diffSource - 1;
      }
    }

    return { scanPath: modPath };
  }

  /** Clear all additional mods. */
  clearAll(): void {
    // Clear all mod data from ref_mods.sqlite (non-blocking)
    getDbPaths().then(dbPaths =>
      clearModsDb(dbPaths.mods)
    ).catch(e => console.warn("[ref_mods] Failed to clear mods DB:", e));

    this.additionalModMeta = {};
    this.modDiskSizes = {};
    modStore.additionalModPaths = [];
    modStore.additionalModResults = [];
    modStore.diffSource = "vanilla";
    modStore.diffOverrideSections = null;
    settingsStore.setAdditionalModPaths([]);
  }

  /**
   * Restore persisted additional mods on startup.
   * Validates each mod's files still exist, unregisters invalid ones.
   * NO disk operations — only read metadata and scan.
   */
  async restorePersistedMods(): Promise<void> {
    const persisted = settingsStore.additionalModPaths;

    const stillValid: string[] = [];
    for (const p of persisted) {
      try {
        const bytes = await dirSize(p);
        if (bytes <= 0) {
          console.warn("Unregistering mod with missing path:", p);
          continue;
        }
        stillValid.push(p);
      } catch {
        console.warn("Unregistering mod with missing path:", p);
      }
    }

    if (stillValid.length < persisted.length) {
      settingsStore.setAdditionalModPaths(stillValid);
    }

    for (const p of stillValid) await this.restoreModPath(p);
  }
}

export const modImportService = new ModImportService();
