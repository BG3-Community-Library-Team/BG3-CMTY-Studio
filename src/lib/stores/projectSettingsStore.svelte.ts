/**
 * Per-project settings store with `.cmtystudio/` folder persistence.
 *
 * Provides three-tier resolution: Project > Global > Default.
 * Project-level overrides are stored in `.cmtystudio/settings.json` via Tauri IPC.
 */
import { invoke } from "@tauri-apps/api/core";
import { settingsStore } from "./settingsStore.svelte.js";
import { modStore } from "./modStore.svelte.js";

export interface ProjectSettings {
  enableMcmSupport?: boolean;
  enableCfIntegration?: boolean;
  mcmSchemaUrl?: string;
  gitUserName?: string;
  gitUserEmail?: string;
  gitAutoFetchInterval?: string;
  gitDefaultRemote?: string;
  ideHelpersPath?: string;
  templateFoldersPath?: string;
  scriptEnginePreferences?: Record<string, unknown>;
}

/** Keys that can be overridden at project level. */
const PROJECT_SCOPED_KEYS = new Set<keyof ProjectSettings>([
  "enableMcmSupport",
  "enableCfIntegration",
  "mcmSchemaUrl",
  "gitUserName",
  "gitUserEmail",
  "gitAutoFetchInterval",
  "gitDefaultRemote",
  "ideHelpersPath",
  "templateFoldersPath",
  "scriptEnginePreferences",
]);

/** Default values for project-scoped settings (used as final fallback). */
const PROJECT_DEFAULTS: Required<ProjectSettings> = {
  enableMcmSupport: false,
  enableCfIntegration: true,
  mcmSchemaUrl: "",
  gitUserName: "",
  gitUserEmail: "",
  gitAutoFetchInterval: "off",
  gitDefaultRemote: "origin",
  ideHelpersPath: "",
  templateFoldersPath: "",
  scriptEnginePreferences: {},
};

const SETTINGS_FILENAME = "settings.json";

/** Whether Tauri IPC is available (false in browser/test environments). */
function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

class ProjectSettingsStore {
  /** The raw project-level overrides (only keys explicitly set at project level). */
  overrides: ProjectSettings = $state({});

  /** Whether project settings have been loaded for the current project. */
  loaded: boolean = $state(false);

  /** The project path these settings were loaded from. */
  #loadedProjectPath: string = "";

  #persistTimer: ReturnType<typeof setTimeout> | null = null;

  /** Get a project-level override value, or undefined if not set at project level. */
  get<K extends keyof ProjectSettings>(key: K): ProjectSettings[K] | undefined {
    return this.overrides[key];
  }

  /** Set a project-level override value. */
  set<K extends keyof ProjectSettings>(key: K, value: ProjectSettings[K]): void {
    if (!PROJECT_SCOPED_KEYS.has(key)) return;
    // Skip if the value is unchanged (avoid unnecessary persist cycles)
    const current = this.overrides[key];
    if (current === value) return;
    if (typeof current === "object" && typeof value === "object"
      && JSON.stringify(current) === JSON.stringify(value)) return;
    this.overrides = { ...this.overrides, [key]: value };
    if (!this.loaded) return; // Don't persist if store hasn't been loaded for a project
    this.#schedulePersist();
  }

  /** Clear a project-level override (revert to global). */
  clear(key: keyof ProjectSettings): void {
    if (!(key in this.overrides)) return;
    const next = { ...this.overrides };
    delete next[key];
    this.overrides = next;
    if (!this.loaded) return; // Don't persist if store hasn't been loaded for a project
    this.#schedulePersist();
  }

  /**
   * Resolve the effective value for a key: Project > Global > Default.
   *
   * Reads the project-level override first. If not set, falls back to the
   * global settingsStore value (for keys that exist there), then to the
   * built-in default.
   */
  getEffective<K extends keyof ProjectSettings>(key: K): NonNullable<ProjectSettings[K]> {
    // 1. Project-level override
    const projectVal = this.overrides[key];
    if (projectVal !== undefined && projectVal !== null) {
      return projectVal as NonNullable<ProjectSettings[K]>;
    }

    // 2. Global settingsStore fallback (for keys that exist on both stores)
    const globalVal = (settingsStore as unknown as Record<string, unknown>)[key];
    if (globalVal !== undefined && globalVal !== null) {
      return globalVal as NonNullable<ProjectSettings[K]>;
    }

    // 3. Built-in default
    return PROJECT_DEFAULTS[key] as NonNullable<ProjectSettings[K]>;
  }

  /** Whether a specific key is overridden at project level. */
  isSetAtProject(key: keyof ProjectSettings): boolean {
    return key in this.overrides && this.overrides[key] !== undefined;
  }

  /**
   * Load project settings from `.cmtystudio/settings.json`.
   * Call when a project is opened or the project path changes.
   */
  async load(projectPath: string): Promise<void> {
    if (!projectPath || !isTauri()) {
      this.overrides = {};
      this.loaded = false;
      this.#loadedProjectPath = "";
      return;
    }

    try {
      // Ensure `.cmtystudio/` directory exists
      await invoke("cmd_ensure_cmtystudio_dir", { projectPath });

      let parsed: Record<string, unknown> = {};
      try {
        const content = await invoke<string>("cmd_read_project_file", {
          projectPath,
          filename: SETTINGS_FILENAME,
        });
        parsed = JSON.parse(content);
      } catch {
        // File doesn't exist yet — that's fine, start with empty overrides
      }

      // Only keep keys that are in the project-scoped set
      const filtered: ProjectSettings = {};
      for (const key of PROJECT_SCOPED_KEYS) {
        if (key in parsed && parsed[key] !== undefined) {
          (filtered as Record<string, unknown>)[key] = parsed[key];
        }
      }
      this.overrides = filtered;
      this.#loadedProjectPath = projectPath;
      this.loaded = true;
    } catch (e) {
      console.warn("Failed to load project settings:", e);
      this.overrides = {};
      this.loaded = false;
      this.#loadedProjectPath = "";
    }
  }

  /** Reset all project settings and remove the file. */
  async reset(): Promise<void> {
    this.overrides = {};
    if (this.#loadedProjectPath && isTauri()) {
      try {
        await invoke("cmd_write_project_file", {
          projectPath: this.#loadedProjectPath,
          filename: SETTINGS_FILENAME,
          content: "{}",
        });
      } catch (e) {
        console.warn("Failed to reset project settings file:", e);
      }
    }
  }

  /** Unload project settings (e.g., when project is closed). */
  unload(): void {
    if (this.#persistTimer) {
      clearTimeout(this.#persistTimer);
      this.#persistTimer = null;
    }
    this.overrides = {};
    this.loaded = false;
    this.#loadedProjectPath = "";
  }

  #schedulePersist(): void {
    if (this.#persistTimer) clearTimeout(this.#persistTimer);
    this.#persistTimer = setTimeout(() => this.#executePersist(), 500);
  }

  /** Flush any pending debounced save immediately. Call on blur / before unload. */
  async saveNow(): Promise<void> {
    if (this.#persistTimer) {
      clearTimeout(this.#persistTimer);
      this.#persistTimer = null;
    }
    await this.#executePersist();
  }

  async #executePersist(): Promise<void> {
    this.#persistTimer = null;
    if (!this.loaded) return; // Store not loaded — nowhere to persist
    const projectPath = this.#loadedProjectPath || modStore.projectPath;
    if (!projectPath || !isTauri()) return;

    try {
      const content = JSON.stringify(this.overrides, null, 2);
      await invoke("cmd_write_project_file", {
        projectPath,
        filename: SETTINGS_FILENAME,
        content,
      });
    } catch (e) {
      console.warn("Failed to persist project settings:", e);
    }
  }
}

export const projectSettingsStore = new ProjectSettingsStore();
