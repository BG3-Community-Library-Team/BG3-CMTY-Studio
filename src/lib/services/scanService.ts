import { modStore } from "../stores/modStore.svelte.js";
import { projectStore, sectionToTable } from "../stores/projectStore.svelte.js";
import { settingsStore } from "../stores/settingsStore.svelte.js";
import { toastStore } from "../stores/toastStore.svelte.js";
import { schemaStore } from "../stores/schemaStore.svelte.js";
import { undoStore } from "../stores/undoStore.svelte.js";
import { uiStore } from "../stores/uiStore.svelte.js";
import { migrateLocalStorageProject } from "../utils/migration.js";
import { m } from "../../paraglide/messages.js";
import { buildVanillaLoaders, EAGER_REGION_IDS, isSyntheticCategory, type VanillaCategory } from "../data/vanillaRegistry.js";
import { scanMod, getStatEntries, getStatFieldNames, getValueLists, getLocalizationMap, getModLocalization, getModStatEntries, readExistingConfig, getEquipmentNames, listModFiles, listAvailableSections, querySectionEntries, recreateStaging, populateStagingFromMod, checkStagingIntegrity } from "../utils/tauri.js";
import { parseExistingConfig } from "../utils/configParser.js";
import { modSelectionService } from "./modSelectionService.svelte.js";
import { detectModFolders } from "../tauri/scanning.js";
import { ensureCmtystudioDir } from "../tauri/project-settings.js";
import { projectSettingsStore } from "../stores/projectSettingsStore.svelte.js";
import { nexusStore } from "../stores/nexusStore.svelte.js";
import type { DetectedMod } from "../types/modSelection.js";

/**
 * Rehydrate the staging database from a mod's on-disk files.
 * Recreates a fresh staging DB, populates it from the mod folder,
 * and runs an integrity check. Non-fatal: surfaces warnings via toasts.
 */
export async function rehydrateStaging(modPath: string, modName: string): Promise<void> {
  try {
    const stagingDbPath = await recreateStaging();
    try {
      const summary = await populateStagingFromMod(modPath, modName, stagingDbPath);
      if (summary.file_errors > 0 || summary.row_errors > 0) {
        toastStore.warning(
          m.scan_staging_warnings_title(),
          m.scan_staging_warnings_detail({ file_errors: String(summary.file_errors), row_errors: String(summary.row_errors) }),
        );
      }
    } catch (populateErr) {
      console.warn("[Staging] Failed to populate staging from mod:", populateErr);
      toastStore.warning(m.scan_staging_population_failed_title(), m.scan_staging_population_failed_detail({ error: String(populateErr) }));
      return;
    }

    // Integrity check (non-blocking diagnostic)
    try {
      const issues = await checkStagingIntegrity();
      if (issues) {
        console.warn("[Staging] Integrity check issues:", issues);
        toastStore.warning(m.scan_staging_integrity(), issues);
      }
    } catch (intErr) {
      console.warn("[Staging] Integrity check failed:", intErr);
    }
  } catch (recreateErr) {
    console.warn("[Staging] Failed to recreate staging DB:", recreateErr);
    toastStore.warning(m.scan_staging_recreation_failed(), String(recreateErr));
  }
}

/**
 * Load all vanilla data sources into modStore.
 * Uses per-category generation stamps to prevent interleaved writes from concurrent calls (DSM-001).
 */
const categoryGeneration = new Map<string, number>();
let vanillaLoadGeneration = 0;
let scanGeneration = 0;

function guardedWrite(category: string, gen: number, setter: () => void): void {
  if (gen >= (categoryGeneration.get(category) ?? 0)) {
    setter();
  }
}

// ── Lazy loading ────────────────────────────────────────────────────────────

/** Set of lazy section keys, populated after first loadVanillaData call discovers DB sections. */
let lazySectionKeys: ReadonlySet<string> = new Set();

/** Whether the given category is lazily loaded (Tier D). */
export function isLazyCategory(category: VanillaCategory): boolean {
  // A category is lazy if it exists in the DB but is NOT in the eager set and NOT synthetic
  return lazySectionKeys.has(category);
}

// Track in-flight lazy loads to avoid duplicate concurrent requests
const lazyLoadInFlight = new Map<string, Promise<void>>();

/**
 * Load a single vanilla category on demand (for lazy Tier D sections).
 * Returns immediately if already loaded. Deduplicates concurrent calls.
 */
export async function loadCategory(category: VanillaCategory): Promise<void> {
  if ((modStore.vanilla[category]?.length ?? 0) > 0) return;

  const existing = lazyLoadInFlight.get(category);
  if (existing) return existing;

  const gen = ++vanillaLoadGeneration;
  categoryGeneration.set(category, gen);

  const promise = querySectionEntries(category)
    .then(entries => {
      guardedWrite(category, gen, () => { modStore.vanilla[category] = entries; });
    })
    .catch(e => {
      console.error(`[Vanilla] Failed to lazy-load ${category}:`, e);
    })
    .finally(() => {
      lazyLoadInFlight.delete(category);
    });

  lazyLoadInFlight.set(category, promise);
  return promise;
}

export async function loadVanillaData(): Promise<void> {
  const gen = ++vanillaLoadGeneration;

  function tracked<T>(name: string, p: Promise<T>): Promise<T> {
    categoryGeneration.set(name, gen);
    return p;
  }

  // 1. Discover available sections from the reference DB
  let loaderDefs;
  try {
    const sections = await listAvailableSections();
    loaderDefs = buildVanillaLoaders(sections);

    // Populate the lazy section key set for on-demand loading
    const lsxSections = sections.filter(s => s.source_type === "lsx");
    lazySectionKeys = new Set(
      lsxSections
        .filter(s => !EAGER_REGION_IDS.has(s.region_id))
        .map(s => s.region_id),
    );
  } catch (e) {
    console.error("[Vanilla] Failed to discover sections from DB:", e);
    modStore.vanillaLoadFailures = ["SectionDiscovery"];
    return;
  }

  // 2. Fire eager loaders in parallel — lazy (Tier D) sections load on first access
  const eagerDefs = loaderDefs.filter(d => d.eager);

  const namedLoads: { name: string; promise: Promise<void> }[] = [
    // DB-driven loaders (dynamically built from section list)
    ...eagerDefs.map(d => ({
      name: d.key,
      promise: tracked(d.key, d.loader()).then(entries => {
        guardedWrite(d.key, gen, () => { modStore.vanilla[d.key] = entries; });
      }),
    })),
    // Non-registry loaders: these don't produce VanillaEntryInfo[] and write to separate store properties
    { name: "StatEntries", promise: tracked("StatEntries", getStatEntries("")).then(entries => { guardedWrite("StatEntries", gen, () => { modStore.vanillaStatEntries = entries; }); }) },
    { name: "StatFieldNames", promise: tracked("StatFieldNames", getStatFieldNames("")).then(names => { guardedWrite("StatFieldNames", gen, () => { modStore.vanillaStatFieldNames = names; }); }) },
    { name: "ValueLists", promise: tracked("ValueLists", getValueLists("")).then(lists => { guardedWrite("ValueLists", gen, () => { modStore.vanillaValueLists = lists; }); }) },
    { name: "Equipment", promise: tracked("Equipment", getEquipmentNames()).then(names => { guardedWrite("Equipment", gen, () => { modStore.vanillaEquipment = names; }); }) },
    { name: "Localization", promise: tracked("Localization", getLocalizationMap()).then(result => {
      guardedWrite("Localization", gen, () => {
        const map = new Map<string, string>(modStore.localizationMap);
        for (const e of result.entries) {
          map.set(e.handle.toLowerCase(), e.text);
        }
        modStore.localizationMap = map;
        if (result.entries.length === 0) {
          console.warn("[Vanilla] Localization map is empty — loca comboboxes will have no vanilla suggestions. Ensure vanilla data has been unpacked.");
        }
        if (result.warnings.length > 0) {
          for (const w of result.warnings) console.warn("[Vanilla Loca]", w);
          toastStore.warning(m.scan_loca_parse_issues_title(), m.scan_loca_parse_issues_detail({ count: String(result.warnings.length) }));
        }
      });
    }) },
  ];

  // Await all, logging failures with source names
  const results = await Promise.allSettled(namedLoads.map(l => l.promise));
  const failedNames: string[] = [];
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      failedNames.push(namedLoads[i].name);
      console.error(`[Vanilla] Failed to load ${namedLoads[i].name}:`, r.reason);
    }
  });
  if (failedNames.length > 0) {
    console.warn(`${failedNames.length} vanilla data source(s) failed to load: ${failedNames.join(", ")}`);
  }
  modStore.vanillaLoadFailures = failedNames;

  // Load LSX schemas from the reference DB (needed for schema-tier form rendering)
  await schemaStore.load();

  // Invalidate the display name map so it rebuilds with the new data (P3)
  modStore.invalidateDisplayNameMap();
}

/**
 * Two-step project opening: detect mod folders, optionally prompt for selection,
 * then dispatch to scanAndImport() with the chosen ModFolder path.
 */
export async function openProject(selectedPath: string): Promise<void> {
  // 1. Detect mod folders (may auto-correct if user selected a ModFolder)
  const result = await detectModFolders(selectedPath);
  const { project_path, mods } = result;

  if (mods.length === 0) {
    uiStore.setNoModsFound(true);
    toastStore.error(m.mod_select_no_mods());
    return;
  }

  // Clear any previous "no mods found" state
  uiStore.setNoModsFound(false);

  let selectedMod: DetectedMod;
  if (mods.length === 1) {
    selectedMod = mods[0];
  } else {
    // Show ModSelectionModal, await user choice
    const chosen = await modSelectionService.prompt(mods);
    if (!chosen) return; // User cancelled
    selectedMod = chosen;
  }

  // 2. Set project-level state
  modStore.projectPath = project_path;

  // 3. Proceed with existing scan pipeline (unchanged)
  await scanAndImport(selectedMod.mod_path);

  // Persist for next session
  settingsStore.lastProjectPath = project_path;
  settingsStore.persist();
}

/**
 * Scan a mod folder, import existing config, and load vanilla data.
 * Centralizes the scan workflow used by both Header and HamburgerMenu.
 * `extraScanPaths` allows scanning additional directories (e.g. unpacked data dir)
 * alongside the primary mod path.
 */
export async function scanAndImport(modPath: string, extraScanPaths?: string[]): Promise<void> {
  const gen = ++scanGeneration;

  // Reset UI and stale mod data before starting a new scan to prevent
  // duplicate-key errors and stale state when switching between mods.
  uiStore.reset();
  modStore.reset();

  modStore.isScanning = true;
  modStore.scanPhase = m.scan_phase_reading_files();
  modStore.scanDetail = "";
  modStore.error = "";
  modStore.selectedModPath = modPath;

  try {
    // Ensure .cmtystudio project dir exists at project root
    const projectRoot = modStore.projectPath || modPath;
    if (projectRoot) {
      try { await ensureCmtystudioDir(projectRoot); } catch (e) {
        console.warn("[scanAndImport] Failed to create .cmtystudio dir:", e);
      }
      await projectSettingsStore.load(projectRoot);
      await nexusStore.loadProjectConfig(projectRoot);
    }

    const result = await scanMod(modPath, extraScanPaths, true);
    if (gen !== scanGeneration) return; // A newer scan was started; discard stale result
    modStore.scanResult = result;

    undoStore.clear();

    // Rehydrate staging DB from mod's on-disk files (before UI becomes interactive)
    modStore.scanPhase = m.scan_phase_staging_db();
    modStore.scanDetail = "";
    const modName = modPath.split(/[\\/]/).pop()?.replace(/\.pak$/i, "") ?? "mod";
    await rehydrateStaging(modPath, modName);

    // Migrate legacy localStorage project data into staging DB (I4/I6)
    modStore.scanPhase = m.scan_phase_migrating();
    await migrateLocalStorageProject(modPath);

    // Hydrate projectStore from the freshly-populated staging DB
    modStore.scanPhase = m.scan_phase_loading_project();
    await projectStore.hydrate();

    // Import existing config entries into the staging DB
    // Skip if migration already brought in persisted data
    if (result.existing_config_path) {
      modStore.scanPhase = m.scan_phase_importing_config();
      try {
        const configContent = await readExistingConfig(result.existing_config_path);
        const { entries: existingEntries, warnings } = parseExistingConfig(configContent, result.existing_config_path);
        if (warnings.length > 0) {
          console.warn("Config parse warnings:", warnings);
          toastStore.warning(m.scan_config_import_warnings_title(), m.scan_config_import_warnings_detail({ warnings: warnings.join("; ") }));
        }
        for (const entry of existingEntries) {
          await projectStore.addEntry(sectionToTable(entry.section), entry.fields);
        }
        if (existingEntries.length > 0) {
          toastStore.info(m.scan_config_imported_title(), m.scan_config_imported_detail({ count: String(existingEntries.length) }));
        }
      } catch (configErr) {
        console.warn("Failed to import existing config:", configErr);
        toastStore.error(m.scan_config_import_failed(), String(configErr));
      }
    }

    // Load previewable text files from project directory (or mod directory as fallback)
    modStore.scanPhase = m.scan_phase_indexing_files();
    try {
      modStore.modFiles = await listModFiles(modStore.projectPath || modPath);
    } catch (err) {
      console.warn("Failed to list mod files:", err);
    }

    // Load mod-specific localization entries and merge into the shared map
    try {
      const locaResult = await getModLocalization(modPath);
      if (locaResult.entries.length > 0) {
        const map = new Map(modStore.localizationMap);
        for (const e of locaResult.entries) {
          map.set(e.handle.toLowerCase(), e.text);
        }
        modStore.localizationMap = map;
      }
      if (locaResult.warnings.length > 0) {
        for (const w of locaResult.warnings) console.warn("[Mod Loca]", w);
        toastStore.warning(m.scan_mod_loca_parse_title(), m.scan_mod_loca_parse_detail({ count: String(locaResult.warnings.length) }));
      }
    } catch (err) {
      console.warn("Failed to load mod localization:", err);
    }

    // Load mod stat entries for combobox population
    try {
      modStore.modStatEntries = await getModStatEntries(modPath);
    } catch (err) {
      console.warn("Failed to load mod stat entries:", err);
    }

    // Load vanilla entries for combobox population
    modStore.scanPhase = m.scan_phase_loading_project();
    await loadVanillaData();

    // Fire completion toast after ALL async operations have finished
    const totalEntries = result.sections.reduce((sum, s) => sum + s.entries.length, 0);
    toastStore.success(m.scan_complete_title(), m.scan_complete_detail({ section_count: String(result.sections.length), entry_count: String(totalEntries) }));
  } catch (e: unknown) {
    console.error("[scanAndImport] Scan failed — full error:", e);
    const msg = typeof e === "string"
      ? e
      : e instanceof Error
        ? e.message
        : e != null && typeof e === "object" && "message" in e
          ? String((e as Record<string, unknown>).message)
          : "Load failed";
    modStore.error = msg;
    modStore.scanResult = null;
    modStore.modStatEntries = [];
    toastStore.error(m.scan_failed(), msg);
  } finally {
    modStore.isScanning = false;
    modStore.scanPhase = "";
    modStore.scanDetail = "";
  }
}
