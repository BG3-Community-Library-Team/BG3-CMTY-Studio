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
import { dataOperationStore } from "../stores/dataOperationStore.svelte.js";
import type { ModMetaInfo } from "../utils/tauri.js";
import {
  scanMod,
  dirSize,
  readModMeta,
  listLoadOrderPaks,
  getActiveModFolders,
  getModStatEntries,
  getDbPaths,
  populateModsDb,
  removeModFromModsDb,
  clearModsDb,
} from "../utils/tauri.js";
import { processModFolder } from "../tauri/mod-management.js";
import type { ScanResult, SectionResult } from "../types/index.js";
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
  isClearing: boolean = $state(false);
  loadOrderStatus: string = $state("");

  /** Set to true to abort an in-progress import loop. */
  #abortImport = false;

  /** All mod paths to display: committed (in modStore) + pending (being processed). */
  get allAdditionalModPaths(): string[] {
    return [...modStore.additionalModPaths, ...this.pendingModPaths];
  }

  // ── Utility helpers ────────────────────────────────────────────────

  /** Whether any import operation is in progress (individual or batch). */
  get isImporting(): boolean {
    return this.isImportingLoadOrder || this.pendingModPaths.length > 0;
  }

  /** Cancel any in-progress import loop. */
  abortImport(): void {
    this.#abortImport = true;
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
  }

  // ── Core import logic ──────────────────────────────────────────────

  /**
   * Restore a previously-persisted mod on startup. Lightweight: reads only
   * metadata from disk (or pak header), adds the path to the mod list
   * immediately, and fires non-blocking disk-size look-ups.
   *
   * Does NOT re-scan files, re-ingest into ref_mods, or touch staging.
   * The ref_mods data was populated during the original import and persists
   * across sessions. Staging is only for the primary mod.
   */
  async restoreModPath(p: string): Promise<void> {
    if (modStore.additionalModPaths.includes(p)) return;

    const isPak = p.toLowerCase().endsWith(".pak");
    const modName = p.split(/[\\/]/).pop()?.replace(/\.pak$/i, "") ?? "mod";
    let newMeta: ModMetaInfo | null = null;

    // Read metadata only — lightweight
    if (isPak) {
      try {
        newMeta = await readModMeta(p);
      } catch {
        // pak meta read may not be supported via readModMeta — that's fine
      }
    } else {
      try {
        newMeta = await readModMeta(p);
      } catch (e) {
        console.warn("Mod metadata read failed:", p, e);
      }
    }

    if (newMeta) {
      this.additionalModMeta = { ...this.additionalModMeta, [p]: newMeta };
    }

    // Build a minimal ScanResult for display (no disk scan needed)
    const result: ScanResult = {
      mod_meta: newMeta ?? {
        uuid: "", folder: modName, name: modName, author: "", version: "",
        version64: "", description: "", md5: "", mod_type: "", tags: "",
        num_players: "", gm_template: "", char_creation_level: "",
        lobby_level: "", menu_level: "", startup_level: "", photo_booth: "",
        main_menu_bg_video: "", publish_version: "", target_mode: "",
        dependencies: [],
      },
      sections: [],
      existing_config_path: null,
    };

    modStore.additionalModPaths = [...modStore.additionalModPaths, p];
    modStore.additionalModResults = [...modStore.additionalModResults, result];

    // Non-blocking: disk size look-up
    dirSize(p).then(bytes => {
      this.modDiskSizes = { ...this.modDiskSizes, [p]: this.formatBytes(bytes) };
    }).catch(e => {
      console.warn("Disk size check failed:", p, e);
      this.modDiskSizes = { ...this.modDiskSizes, [p]: m.import_disk_size_unavailable() };
    });

    // Non-blocking: stat entries for combobox population
    getModStatEntries(p).then(entries => {
      if (entries.length > 0) {
        const existing = new Set(modStore.modStatEntries.map(e => e.name));
        const novel = entries.filter(e => !existing.has(e.name));
        if (novel.length > 0) {
          modStore.modStatEntries = [...modStore.modStatEntries, ...novel];
        }
      }
    }).catch(err => console.warn("Failed to load additional mod stat entries:", err));
  }

  /**
   * Add a new mod via the scan/ingest pipeline.
   * ONLY called from explicit user actions (Add Folder, Add .pak, Import Load Order).
   */
  async addModPath(p: string, showDuplicatePrompt: DuplicatePromptFn): Promise<void> {
    if (modStore.additionalModPaths.includes(p) || this.pendingModPaths.includes(p)) return;

    const isPak = p.toLowerCase().endsWith(".pak");
    let newMeta: ModMetaInfo | null = null;

    // ── Read metadata (silent) ────────────────────────────────────────
    if (!isPak) {
      try {
        newMeta = await readModMeta(p);
      } catch (e) {
        console.warn("Mod metadata not found:", p, e);
      }
    }
    // For .pak files, meta is read later via processModFolder

    // ── Skip if identical to the active (primary) mod ─────────────────
    if (newMeta) {
      const activeMeta = modStore.scanResult?.mod_meta;
      if (activeMeta && activeMeta.uuid && newMeta.uuid && activeMeta.uuid === newMeta.uuid
        && activeMeta.folder && newMeta.folder && activeMeta.folder === newMeta.folder) {
        console.info("[modImport] Skipping additional mod — meta.lsx identical to active mod:", p);
        return;
      }
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

    // Drive the shared status bar spinner via dataOperationStore
    const ownOperation = !this.isImportingLoadOrder;
    const displayName = p.split(/[\\/]/).pop()?.replace(/\.pak$/i, "") ?? "mod";
    if (ownOperation && !dataOperationStore.isRunning) {
      dataOperationStore.startOperation("mod-import");
    }
    dataOperationStore.phase = "Scanning";
    dataOperationStore.detail = displayName;

    try {
      let result: ScanResult;

      if (isPak) {
        // .pak files: use processModFolder which reads from the pak natively
        // (PakReader for meta + data, ingests into ref_mods.sqlite)
        const modName = p.split(/[\\/]/).pop()?.replace(/\.pak$/i, "") ?? "mod";
        const processResult = await processModFolder(p, modName);

        // Extract meta from process result for duplicate check
        if (processResult.mod_meta && !newMeta) {
          newMeta = processResult.mod_meta;
          this.additionalModMeta = { ...this.additionalModMeta, [p]: newMeta };

          // Skip if identical to active mod
          const activeMeta = modStore.scanResult?.mod_meta;
          if (activeMeta && activeMeta.uuid && newMeta.uuid && activeMeta.uuid === newMeta.uuid
            && activeMeta.folder && newMeta.folder && activeMeta.folder === newMeta.folder) {
            console.info("[modImport] Skipping pak mod — meta.lsx identical to active mod:", p);
            this.pendingModPaths = this.pendingModPaths.filter(x => x !== p);
            const upd = { ...this.modImportStatus }; delete upd[p]; this.modImportStatus = upd;
            return;
          }

          // Late duplicate check for pak mods (meta only known after processing)
          const dupAction = await this.checkDuplicate(p, newMeta, showDuplicatePrompt);
          if (dupAction === "cancel") {
            this.pendingModPaths = this.pendingModPaths.filter(x => x !== p);
            const upd = { ...this.modImportStatus }; delete upd[p]; this.modImportStatus = upd;
            return;
          }
        }

        // Build a minimal ScanResult for display purposes
        const sections: SectionResult[] = [];
        result = {
          mod_meta: processResult.mod_meta ?? {
            uuid: "", folder: modName, name: modName, author: "", version: "",
            version64: "", description: "", md5: "", mod_type: "", tags: "",
            num_players: "", gm_template: "", char_creation_level: "",
            lobby_level: "", menu_level: "", startup_level: "", photo_booth: "",
            main_menu_bg_video: "", publish_version: "", target_mode: "",
            dependencies: [],
          },
          sections,
          existing_config_path: null,
        };
      } else {
        // Directory mods: full scan + separate ref_mods ingest
        result = await scanMod(p, undefined, false);

        // ── Ingest into ref_mods.sqlite ─────────────────────────────────
        {
          const modName = p.split(/[\\/]/).pop()?.replace(/\.pak$/i, "") ?? "mod";
          this.modImportStatus = { ...this.modImportStatus, [p]: "Ingesting" };
          dataOperationStore.phase = "Ingesting";
          dataOperationStore.detail = modName;
          try {
            const dbPaths = await getDbPaths();
            await populateModsDb(p, modName, dbPaths.mods, false);
          } catch (e) {
            console.warn("[ref_mods] Failed to ingest mod data:", modName, e);
          }
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
        this.modDiskSizes = { ...this.modDiskSizes, [p]: this.formatBytes(bytes) };
      }).catch(e => {
        console.warn("Disk size check failed:", p, e);
        this.modDiskSizes = { ...this.modDiskSizes, [p]: m.import_disk_size_unavailable() };
      });
    } catch (e: unknown) {
      console.warn("Failed to process additional mod:", e);
    } finally {
      this.pendingModPaths = this.pendingModPaths.filter(x => x !== p);
      const upd = { ...this.modImportStatus }; delete upd[p]; this.modImportStatus = upd;
      // Complete the shared spinner if this was a standalone (non-batch) import
      if (ownOperation && dataOperationStore.isRunning && dataOperationStore.operationType === "mod-import") {
        dataOperationStore.completeOperation(m.import_count_imported({ count: "1" }));
      }
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
    dataOperationStore.startOperation("mod-import");
    dataOperationStore.phase = m.import_scanning_mods_dir();
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
      let aborted = 0;
      for (const pakPath of filteredPaks) {
        if (this.#abortImport) {
          aborted = filteredPaks.length - imported - skipped - failed;
          break;
        }
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
      if (aborted > 0) parts.push(m.import_count_cancelled({ count: String(aborted) }));
      const inactive = paks.length - filteredPaks.length;
      if (activeFolders && inactive > 0) parts.push(m.import_count_inactive({ count: String(inactive) }));
      this.loadOrderStatus = m.import_load_order_complete({ summary: parts.join(", ") });
    } catch (e: unknown) {
      this.loadOrderStatus = m.import_load_order_error({ error: e instanceof Error ? e.message : String(e) });
      console.error("Import from load order failed:", e);
    } finally {
      this.isImportingLoadOrder = false;
      this.#abortImport = false;
      if (dataOperationStore.isRunning && dataOperationStore.operationType === "mod-import") {
        dataOperationStore.completeOperation(this.loadOrderStatus);
      }
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
  async clearAll(): Promise<void> {
    this.isClearing = true;
    try {
      // Clear all mod data from ref_mods.sqlite (await to avoid db-locked race)
      try {
        const dbPaths = await getDbPaths();
        await clearModsDb(dbPaths.mods);
      } catch (e) {
        console.warn("[ref_mods] Failed to clear mods DB:", e);
      }

      this.additionalModMeta = {};
      this.modDiskSizes = {};
      this.pendingModPaths = [];
      this.modImportStatus = {};
      this.loadOrderStatus = "";
      modStore.additionalModPaths = [];
      modStore.additionalModResults = [];
      modStore.modStatEntries = [];
      modStore.diffSource = "vanilla";
      modStore.diffOverrideSections = null;
      settingsStore.setAdditionalModPaths([]);
    } finally {
      this.isClearing = false;
    }
  }

  /**
   * Restore persisted additional mods on startup.
   * Validates each mod path still exists, unregisters invalid ones,
   * then restores all valid mods in parallel (lightweight metadata reads only).
   */
  async restorePersistedMods(): Promise<void> {
    const persisted = settingsStore.additionalModPaths;
    if (persisted.length === 0) return;

    // Validate paths exist in parallel
    const checks = await Promise.all(
      persisted.map(async (p): Promise<[string, boolean]> => {
        try {
          const bytes = await dirSize(p);
          return [p, bytes > 0];
        } catch {
          return [p, false];
        }
      }),
    );

    const stillValid = checks.filter(([, ok]) => ok).map(([p]) => p);
    const removed = checks.filter(([, ok]) => !ok).map(([p]) => p);
    if (removed.length > 0) {
      for (const p of removed) console.warn("Unregistering mod with missing path:", p);
      settingsStore.setAdditionalModPaths(stillValid);
    }

    // Restore all valid mods in parallel (lightweight — only reads metadata)
    await Promise.all(stillValid.map(p => this.restoreModPath(p)));
  }
}

export const modImportService = new ModImportService();
