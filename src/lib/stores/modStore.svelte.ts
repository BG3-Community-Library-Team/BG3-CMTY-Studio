import type { ScanResult, SectionResult, VanillaEntryInfo } from "../types/index.js";
import type { StatEntryInfo, ValueListInfo, LocaEntry, ModFileEntry } from "../utils/tauri.js";
import type { VanillaCategory } from "../data/vanillaRegistry.js";
import type { IconAtlasEntry } from "../tauri/vanilla-data.js";
import { invoke } from "@tauri-apps/api/core";

export type { VanillaCategory };

/** Status of a mod being processed through the staged import pipeline. */
export type ModImportStatus = "Scanning" | "Ingesting" | "Ready" | "Error";

/** Global reactive state for scanned mod data. */
class ModStore {
  scanResult: ScanResult | null = $state(null);
  isScanning: boolean = $state(false);
  /** Current scan phase label — displayed in spinner overlay during scanning. */
  scanPhase: string = $state("");
  /** Optional detail text for the current scan phase (e.g. file count, section name). */
  scanDetail: string = $state("");
  selectedModPath: string = $state("");
  projectPath: string = $state("");    // ProjectFolder path (parent of ModFolder)
  vanillaPath: string = $state("");
  error: string = $state("");

  /** P-02: All vanilla entry data in a single typed record, keyed by category (region_id or synthetic key). */
  vanilla: Record<string, VanillaEntryInfo[]> = $state({});

  /** Vanilla equipment set names from Equipment.txt (for ClassEquipment / ClassEquipmentOverride comboboxes). */
  vanillaEquipment: string[] = $state([]);

  /** Vanilla icon MapKey names from all IconUVList tables (for Icon field combobox on stat entries). */
  vanillaIconNames: string[] = $state([]);

  /**
   * Resolved icon atlas entries (vanilla + active mod), keyed by MapKey.
   * Each entry carries pre-computed dds_path + project_dir ready for cmd_convert_dds_to_png.
   */
  iconAtlasData: Map<string, IconAtlasEntry> = $state(new Map());

  /** Cache of loaded atlas DDS images: "projectDir|ddsPath" → base64 PNG string. */
  loadedAtlasImages: Map<string, string> = $state(new Map());
  /** Internal set of cache keys currently being loaded (prevents concurrent duplicate loads). */
  #loadingAtlasImages = new Set<string>();

  /** All vanilla stat entries (SpellData, PassiveData, Armor, Weapon, Object, etc.) for combobox population. */
  vanillaStatEntries: StatEntryInfo[] = $state([]);
  /** Stat entries from the scanned mod (populated after scan_mod). */
  modStatEntries: StatEntryInfo[] = $state([]);
  /** Unique stat field names from all .txt files (data key names). */
  vanillaStatFieldNames: string[] = $state([]);
  /** ValueLists.txt data — lists of valid values for Ability, Skill, SpellCastingAbility, etc. */
  vanillaValueLists: ValueListInfo[] = $state([]);
  /** Localization data — handle UUID → display text mapping for DisplayName resolution. */
  localizationMap: Map<string, string> = $state(new Map());

  /** Auto-generated localization entries: contentuid → { text, version }.
   *  Created when users type plain text into loca: fields (migrated from configStore). */
  autoLocaEntries: Map<string, { text: string; version: number }> = $state(new Map());

  /** Vanilla data source names that failed to load during the last scan. */
  vanillaLoadFailures: string[] = $state([]);

  /** Additional loaded mod paths (for combobox population and diff comparison). */
  additionalModPaths: string[] = $state([]);
  /** Additional loaded mod scan results (for combobox and diff). */
  additionalModResults: ScanResult[] = $state([]);

  /** Diff comparison source: "vanilla" or an index into additionalModResults. */
  diffSource: "vanilla" | number = $state("vanilla");

  /**
   * When diffSource is not "vanilla", this holds re-diffed section results.
   * SectionPanel uses this for display instead of the original scanResult.sections.
   */
  diffOverrideSections: SectionResult[] | null = $state(null);

  /** Whether a re-diff is in progress. When true, SectionAccordion shows a loading indicator bar. */
  isRediffing: boolean = $state(false);

  /** PF-027: Global entry filter (searches across all sections). */
  globalFilter: string = $state("");

  /** Per-mod section data: maps mod path → array of folder names that pak contains. */
  modPakSections: Map<string, string[]> = $state(new Map());

  /** Expansion command: set by context menu, consumed by SectionPanel. */
  sectionExpandCommand: { section: string; expand: boolean } | null = $state(null);

  /** Previewable text files discovered in the mod directory. */
  modFiles: ModFileEntry[] = $state([]);

  /** PF-027: Accordion expanded state before global search (restored on clear). */
  #preSearchExpanded: string[] | null = null;

  /** PF-027: Set the global filter and store pre-search section state. */
  setGlobalFilter(value: string): void {
    this.globalFilter = value;
  }

  /** PF-027: Save accordion state before search. */
  savePreSearchState(expanded: Map<string, boolean>): void {
    if (!this.#preSearchExpanded) {
      this.#preSearchExpanded = [...expanded.entries()]
        .filter(([, v]) => v)
        .map(([k]) => k);
    }
  }

  /** PF-027: Retrieve and clear saved pre-search state. */
  popPreSearchState(): string[] | null {
    const state = this.#preSearchExpanded;
    this.#preSearchExpanded = null;
    return state;
  }

  /**
   * O(1) UUID → display name index. Built once after all vanilla data sources
   * are loaded, then used by lookupDisplayName() instead of linear scanning.
   * Replaces the previous O(n) approach that scanned ~8,000 entries per call.
   */
  #displayNameMap: Map<string, string> = new Map();
  #displayNameMapDirty: boolean = true;

  /** Mark the display name index as needing a rebuild. */
  invalidateDisplayNameMap(): void {
    this.#displayNameMapDirty = true;
  }

  /** Rebuild the display name map from all known data sources. */
  #rebuildDisplayNameMap(): void {
    const map = new Map<string, string>();
    // P-02: iterate the typed vanilla record instead of a manual array
    for (const arr of Object.values(this.vanilla)) {
      for (const v of arr) {
        if (v.uuid && v.display_name) map.set(v.uuid.toLowerCase(), v.display_name);
      }
    }
    for (const section of this.sectionResults) {
      for (const e of section.entries) {
        if (e.uuid && e.display_name) map.set(e.uuid.toLowerCase(), e.display_name);
      }
    }
    this.#displayNameMap = map;
    this.#displayNameMapDirty = false;
  }

  get sectionResults(): SectionResult[] {
    return this.scanResult?.sections ?? [];
  }

  /** Section results for diff display — uses override when diffSource is not vanilla. */
  get diffSectionResults(): SectionResult[] {
    return this.diffOverrideSections ?? this.sectionResults;
  }

  get totalEntries(): number {
    return this.sectionResults.reduce(
      (sum, s) => sum + s.entries.length,
      0
    );
  }

  get modName(): string {
    return this.scanResult?.mod_meta.name ?? "";
  }

  get modFolder(): string {
    return this.scanResult?.mod_meta.folder ?? "";
  }

  get metaDependencies() {
    return this.scanResult?.mod_meta.dependencies ?? [];
  }

  /**
   * The prefix for mod files relative to the listing root (projectPath or selectedModPath).
   * When projectPath is set, selectedModPath is a subdirectory of projectPath,
   * so listed file paths include the relative segment, e.g. "MyMod/Mods/MyModName/".
   * When only selectedModPath is set, listing starts there so prefix is "Mods/MyModName/".
   */
  get modFilesPrefix(): string {
    const folder = this.scanResult?.mod_meta?.folder;
    if (!folder) return "";
    if (this.projectPath && this.selectedModPath && this.selectedModPath.startsWith(this.projectPath)) {
      const rel = this.selectedModPath.slice(this.projectPath.length).replace(/^[/\\]+/, "");
      return rel ? `${rel}/Mods/${folder}/` : `Mods/${folder}/`;
    }
    return `Mods/${folder}/`;
  }

  get hasExistingConfig(): boolean {
    return this.scanResult?.existing_config_path != null;
  }

  /** UUID → parent UUID map for vanilla race entries. */
  get raceParentMap(): Record<string, string> {
    const map: Record<string, string> = {};
    for (const v of this.vanilla.Races ?? []) {
      if (v.parent_guid) map[v.uuid] = v.parent_guid;
    }
    return map;
  }

  reset(): void {
    this.scanResult = null;
    this.error = "";
    // P-02: single assignment replaces 18 individual clears
    this.vanilla = {};
    this.vanillaEquipment = [];
    this.vanillaIconNames = [];
    this.iconAtlasData = new Map();
    this.loadedAtlasImages = new Map();
    this.#loadingAtlasImages.clear();
    this.vanillaStatEntries = [];
    this.vanillaStatFieldNames = [];
    this.vanillaValueLists = [];
    this.localizationMap = new Map();
    this.autoLocaEntries = new Map();
    this.vanillaLoadFailures = [];
    this.additionalModPaths = [];
    this.additionalModResults = [];
    this.diffSource = "vanilla";
    this.diffOverrideSections = null;
    this.isRediffing = false;
    this.modPakSections = new Map();
    this.sectionExpandCommand = null;
  }

  /**
   * Look up a display name given a UUID. Uses an O(1) Map index that is
   * lazily rebuilt when vanilla data changes.
   */
  lookupDisplayName(uuid: string): string | undefined {
    if (!uuid) return undefined;
    if (this.#displayNameMapDirty) this.#rebuildDisplayNameMap();
    return this.#displayNameMap.get(uuid.toLowerCase());
  }

  /**
   * Look up a localized string by its handle UUID.
   * Useful for resolving DisplayName handles to actual text (e.g. Background names).
   */
  lookupLocalizedString(handle: string): string | undefined {
    if (!handle) return undefined;
    return this.localizationMap.get(handle.toLowerCase());
  }

  /**
   * Lazily load a texture atlas DDS as a base64 PNG and cache it in `loadedAtlasImages`.
   * `ddsPath` is the relative path to pass to cmd_convert_dds_to_png.
   * `projectDir` is the base directory that contains `ddsPath`.
   * Silently no-ops if projectDir is not configured or loading fails.
   */
  async loadAtlasImage(ddsPath: string, projectDir: string): Promise<void> {
    if (!ddsPath || !projectDir) return;
    const cacheKey = `${projectDir}|${ddsPath}`;
    if (this.loadedAtlasImages.has(cacheKey)) return;
    if (this.#loadingAtlasImages.has(cacheKey)) return;
    this.#loadingAtlasImages.add(cacheKey);
    try {
      const base64 = await invoke<string>("cmd_convert_dds_to_png", {
        path: ddsPath,
        projectDir,
      });
      this.loadedAtlasImages = new Map(this.loadedAtlasImages);
      this.loadedAtlasImages.set(cacheKey, base64);
    } catch {
      // Atlas load failed — no preview available; fail silently.
    } finally {
      this.#loadingAtlasImages.delete(cacheKey);
    }
  }
}

export const modStore = new ModStore();
