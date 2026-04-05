import type { OutputFormat } from "../types/index.js";
import { getSecureSetting, setSecureSetting } from "../utils/tauri.js";
import { modStore } from "./modStore.svelte.js";
import { THEME_OPTIONS, DEFAULT_CUSTOM_THEME, type ThemeId, type CustomThemeValues } from "../themes/themeManager.js";

// Re-export for consumers that still import from settingsStore
export { THEME_OPTIONS, DEFAULT_CUSTOM_THEME, type ThemeId, type CustomThemeValues };

const SETTINGS_KEY = "bg3-cmty-studio-settings";
const CUSTOM_THEME_KEY = "bg3-cmty-studio-custom-theme";

interface StoredSettings {
  vanillaPath: string;
  defaultFormat: OutputFormat;
  theme: ThemeId;
  gameDataPath: string;
  additionalModPaths: string[];
  enableSectionComments: boolean;
  enableEntryComments: boolean;
  sidebarWidth: number;
  leftPanelWidth: number;
  /** Reduced motion preference: "system" follows OS, "on" always reduces, "off" never reduces */
  reducedMotion: "system" | "on" | "off";
  /** Whether the global search bar is always visible (vs toggled with Ctrl+Shift+F) */
  alwaysShowSearchBar: boolean;
  /** Last scanned mod path — persisted across sessions */
  lastModPath: string;
  /** Text zoom level (percentage: 100 = default) */
  zoomLevel: number;
  /** Toast notification auto-dismiss duration in ms (0 = don't auto-dismiss) */
  toastDuration: number;
  /** Error toast auto-dismiss duration in ms (0 = don't auto-dismiss) */
  errorToastDuration: number;
  /** Show display names in combobox entry labels (e.g. [Name] before UUID) */
  showComboboxNames: boolean;
  /** Show mod-source prefix in combobox entry labels (e.g. [Vanilla], [ModName]) */
  showModNamePrefix: boolean;
  /** Enable MCM (Mod Configuration Menu) support in generated output */
  enableMcmSupport: boolean;
  /** Enable Compatibility Framework integration in generated output */
  enableCfIntegration: boolean;
  /** Enable MazzleDocs support in generated output */
  enableMazzleDocsSupport: boolean;
  /** Whether the user has dismissed the first-run onboarding modal (USE-03) */
  hasSeenFirstRunModal: boolean;
  /** Auto-hide the tab bar when not hovered */
  autoHideTabBar: boolean;
}

/** Default values for all persisted settings. Adding a new persisted field
 *  requires only adding it here and to the StoredSettings interface. */
const PERSISTED_DEFAULTS: StoredSettings = {
  vanillaPath: "",
  defaultFormat: "Yaml" as OutputFormat,
  theme: "balance" as ThemeId,
  gameDataPath: "",
  additionalModPaths: [],
  enableSectionComments: true,
  enableEntryComments: false,
  sidebarWidth: 420,
  leftPanelWidth: 240,
  reducedMotion: "system",
  alwaysShowSearchBar: false,
  lastModPath: "",
  zoomLevel: 100,
  toastDuration: 3000,
  errorToastDuration: 8000,
  showComboboxNames: true,
  showModNamePrefix: true,
  enableMcmSupport: false,
  enableCfIntegration: true,
  enableMazzleDocsSupport: false,
  hasSeenFirstRunModal: false,
  autoHideTabBar: false,
};

/** All keys that are persisted to localStorage (derived from PERSISTED_DEFAULTS). */
const PERSISTED_KEYS = Object.keys(PERSISTED_DEFAULTS) as (keyof StoredSettings)[];

/** Keys stored in OS keychain via Tauri secure storage rather than localStorage. */
const SECURE_KEYS: (keyof StoredSettings)[] = [
  "vanillaPath", "gameDataPath",
  "additionalModPaths", "lastModPath",
];
const SECURE_KEY_SET: ReadonlySet<string> = new Set(SECURE_KEYS);

/** Whether Tauri IPC is available (false in browser/test environments). */
function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function loadFromStorage(): StoredSettings {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return { ...PERSISTED_DEFAULTS };
  try {
    const data = JSON.parse(raw);
    const result: StoredSettings = { ...PERSISTED_DEFAULTS };
    for (const key of PERSISTED_KEYS) {
      const val = data[key];
      if (val === undefined || val === null) continue;
      const defaultVal = PERSISTED_DEFAULTS[key];
      if (Array.isArray(defaultVal)) {
        if (Array.isArray(val)) (result as any)[key] = val;
      } else if (typeof defaultVal === "object") {
        if (typeof val === "object" && !Array.isArray(val)) (result as any)[key] = val;
      } else if (typeof val === typeof defaultVal) {
        (result as any)[key] = val;
      }
    }
    // Migration: "split" theme was renamed to "balance"
    if ((result.theme as string) === "split") result.theme = "balance";
    // Validation: theme must be a known ThemeId; fall back to "dark" if invalid (DSM-009)
    if (!THEME_OPTIONS.some(o => o.id === result.theme) && result.theme !== "custom") {
      result.theme = "dark";
    }
    // Validation: reducedMotion must be one of the allowed values
    if (result.reducedMotion !== "system" && result.reducedMotion !== "on" && result.reducedMotion !== "off") {
      result.reducedMotion = "system";
    }
    return result;
  } catch { return { ...PERSISTED_DEFAULTS }; }
}

function loadCustomTheme(): CustomThemeValues {
  try {
    const raw = localStorage.getItem(CUSTOM_THEME_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_CUSTOM_THEME, ...parsed };
    }
  } catch (e) { console.warn('Custom theme load failed:', e); }
  return { ...DEFAULT_CUSTOM_THEME };
}

function saveCustomTheme(theme: CustomThemeValues): void {
  try {
    localStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify(theme));
  } catch (e) { console.warn('Custom theme save failed:', e); }
}

/** Persistent user settings. */
class SettingsStore {
  #initial = loadFromStorage();
  #initialCustom = loadCustomTheme();

  vanillaPath: string = $state(this.#initial.vanillaPath);
  defaultFormat: OutputFormat = $state(this.#initial.defaultFormat);
  theme: ThemeId = $state(this.#initial.theme);
  gameDataPath: string = $state(this.#initial.gameDataPath);
  additionalModPaths: string[] = $state(this.#initial.additionalModPaths);
  enableSectionComments: boolean = $state(this.#initial.enableSectionComments);
  enableEntryComments: boolean = $state(this.#initial.enableEntryComments);
  sidebarWidth: number = $state(this.#initial.sidebarWidth);
  leftPanelWidth: number = $state(this.#initial.leftPanelWidth);
  /** Reduced motion preference: "system" follows OS, "on" always reduces, "off" never reduces */
  reducedMotion: "system" | "on" | "off" = $state(this.#initial.reducedMotion);
  /** Whether the global search bar is always visible (vs toggled with Ctrl+Shift+F) */
  alwaysShowSearchBar: boolean = $state(this.#initial.alwaysShowSearchBar);
  /** Last scanned mod path — restored on app restart */
  lastModPath: string = $state(this.#initial.lastModPath);

  /** Text zoom level (percentage: 100 = default, min 50, max 200) */
  zoomLevel: number = $state(this.#initial.zoomLevel);

  /** Toast notification auto-dismiss duration in ms (0 = don't auto-dismiss) */
  toastDuration: number = $state(this.#initial.toastDuration);

  /** Error toast auto-dismiss duration in ms (0 = don't auto-dismiss) */
  errorToastDuration: number = $state(this.#initial.errorToastDuration);

  /** Show display names in combobox entry labels */
  showComboboxNames: boolean = $state(this.#initial.showComboboxNames);

  /** Show mod-source prefix in combobox entry labels */
  showModNamePrefix: boolean = $state(this.#initial.showModNamePrefix);

  /** Enable MCM (Mod Configuration Menu) support */
  enableMcmSupport: boolean = $state(this.#initial.enableMcmSupport);

  /** Enable Compatibility Framework integration */
  enableCfIntegration: boolean = $state(this.#initial.enableCfIntegration);

  /** Enable MazzleDocs support */
  enableMazzleDocsSupport: boolean = $state(this.#initial.enableMazzleDocsSupport);

  /** Whether the user has dismissed the first-run onboarding modal (USE-03) */
  hasSeenFirstRunModal: boolean = $state(this.#initial.hasSeenFirstRunModal);

  /** Auto-hide the tab bar when not hovered */
  autoHideTabBar: boolean = $state(this.#initial.autoHideTabBar);

  /** Custom theme values — editable in the settings panel */
  customTheme: CustomThemeValues = $state(this.#initialCustom);

  /** Whether a saved custom theme exists */
  hasCustomTheme: boolean = $state(localStorage.getItem(CUSTOM_THEME_KEY) !== null);

  /** Persist current values to localStorage (non-sensitive) and OS keychain (sensitive paths). */
  #persistTimer: ReturnType<typeof setTimeout> | null = null;
  #dirtyKeys = new Set<string>();

  #schedulePersist(key: string): void {
    this.#dirtyKeys.add(key);
    if (this.#persistTimer) clearTimeout(this.#persistTimer);
    this.#persistTimer = setTimeout(() => this.#executePersist(), 500);
  }

  #executePersist(): void {
    this.#persistTimer = null;
    const data: Record<string, unknown> = {};
    for (const key of PERSISTED_KEYS) {
      if (SECURE_KEY_SET.has(key)) continue;
      data[key] = this[key];
    }
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
    } catch (e) { console.warn('Settings persistence failed:', e); }

    if (isTauri()) {
      for (const key of this.#dirtyKeys) {
        if (!SECURE_KEY_SET.has(key)) continue;
        setSecureSetting(key, JSON.stringify(this[key as keyof this])).catch((e: unknown) =>
          console.warn(`Secure setting '${key}' save failed:`, e)
        );
      }
    }
    this.#dirtyKeys.clear();
  }

  persist(): void {
    this.#schedulePersist("_generic");
  }

  persistNow(): void {
    if (this.#persistTimer) {
      clearTimeout(this.#persistTimer);
    }
    this.#executePersist();
  }

  /**
   * Load sensitive path settings from OS keychain. On first run after upgrade,
   * migrates values from localStorage to the keychain and cleans localStorage.
   * Call once during app startup (e.g. in App.svelte onMount).
   */
  async hydrateSecureKeys(): Promise<void> {
    if (!isTauri()) return;

    // ── Migration: move legacy localStorage values to keychain ──
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        let migrated = false;
        for (const key of SECURE_KEYS) {
          const val = data[key];
          if (val === undefined || val === null) continue;
          // Skip empty defaults (empty string, empty array, empty object)
          if (val === "") continue;
          if (Array.isArray(val) && val.length === 0) continue;
          if (typeof val === "object" && !Array.isArray(val) && Object.keys(val).length === 0) continue;
          await setSecureSetting(key, JSON.stringify(val));
          migrated = true;
        }
        if (migrated) {
          // Remove secure keys from localStorage
          for (const key of SECURE_KEYS) delete data[key];
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
        }
      }
    } catch (e) { console.warn("Secure settings migration failed:", e); }

    // ── Load secure values from keychain ──
    for (const key of SECURE_KEYS) {
      try {
        const raw = await getSecureSetting(key);
        if (!raw) continue;
        const val = JSON.parse(raw);
        (this as any)[key] = val;
      } catch (e) { console.warn(`Secure setting '${key}' load failed:`, e); }
    }
  }

  setVanillaPath(path: string): void {
    this.vanillaPath = path;
    this.#schedulePersist("vanillaPath");
  }

  setDefaultFormat(format: OutputFormat): void {
    this.defaultFormat = format;
    this.#schedulePersist("defaultFormat");
  }

  toggleTheme(): void {
    this.theme = this.theme === "dark" ? "light" : "dark";
    this.#schedulePersist("theme");
  }

  setTheme(theme: ThemeId): void {
    this.theme = theme;
    this.#schedulePersist("theme");
  }

  /** Save the current customTheme values as the "custom" theme and switch to it */
  saveCustomTheme(): void {
    saveCustomTheme(this.customTheme);
    this.hasCustomTheme = true;
    // Add "Custom" to the front of the dropdown if not already present
    if (!THEME_OPTIONS.find(o => o.id === "custom")) {
      THEME_OPTIONS.unshift({ id: "custom", label: "Custom" });
    }
    this.setTheme("custom");
  }

  /** Populate custom theme editor with values from the currently active theme's CSS variables */
  populateFromCurrentTheme(): void {
    const root = document.documentElement;
    const computed = getComputedStyle(root);

    // Helper to read a CSS variable and convert to hex if needed
    const getVar = (name: string): string => {
      const val = computed.getPropertyValue(name).trim();
      // Handle rgba values by extracting just the color part
      if (val.startsWith("rgba") || val.startsWith("rgb")) {
        // Skip rgba/rgb — use fallback
        return "";
      }
      return val || "";
    };

    // Map CSS variables to CustomThemeValues
    this.customTheme = {
      bgMain: getVar("--th-bg-900") || DEFAULT_CUSTOM_THEME.bgMain,
      bgSidebar: getVar("--th-bg-800") || DEFAULT_CUSTOM_THEME.bgSidebar,
      bgSection: getVar("--th-bg-850") || DEFAULT_CUSTOM_THEME.bgSection,
      bgInput: getVar("--th-input-bg") || DEFAULT_CUSTOM_THEME.bgInput,
      textPrimary: getVar("--th-text-100") || DEFAULT_CUSTOM_THEME.textPrimary,
      textSecondary: getVar("--th-text-400") || DEFAULT_CUSTOM_THEME.textSecondary,
      textAccent: getVar("--th-text-sky-400") || DEFAULT_CUSTOM_THEME.textAccent,
      titlebarText: getVar("--th-titlebar-text") || DEFAULT_CUSTOM_THEME.titlebarText,
      borderColor: getVar("--th-border-700") || DEFAULT_CUSTOM_THEME.borderColor,
      scrollThumb: getVar("--th-scroll-thumb") || DEFAULT_CUSTOM_THEME.scrollThumb,
      accentPrimary: getVar("--th-bg-sky-600") || DEFAULT_CUSTOM_THEME.accentPrimary,
      accentSuccess: getVar("--th-text-emerald-400") || DEFAULT_CUSTOM_THEME.accentSuccess,
      accentWarning: getVar("--th-text-amber-400") || DEFAULT_CUSTOM_THEME.accentWarning,
      accentDanger: getVar("--th-text-red-400") || DEFAULT_CUSTOM_THEME.accentDanger,
      yamlKey: getVar("--th-yaml-key") || DEFAULT_CUSTOM_THEME.yamlKey,
      yamlString: getVar("--th-yaml-string") || DEFAULT_CUSTOM_THEME.yamlString,
      yamlComment: getVar("--th-yaml-comment") || DEFAULT_CUSTOM_THEME.yamlComment,
      diffAdded: getVar("--th-diff-added") || DEFAULT_CUSTOM_THEME.diffAdded,
      diffRemoved: getVar("--th-diff-removed") || DEFAULT_CUSTOM_THEME.diffRemoved,
      diffChanged: getVar("--th-diff-changed") || DEFAULT_CUSTOM_THEME.diffChanged,
      sidebarBg: getVar("--th-sidebar-bg") || DEFAULT_CUSTOM_THEME.sidebarBg,
      sidebarBgDeep: getVar("--th-sidebar-bg-deep") || DEFAULT_CUSTOM_THEME.sidebarBgDeep,
      sidebarText: getVar("--th-sidebar-text") || DEFAULT_CUSTOM_THEME.sidebarText,
      sidebarTextMuted: getVar("--th-sidebar-text-muted") || DEFAULT_CUSTOM_THEME.sidebarTextMuted,
      sidebarBorder: getVar("--th-sidebar-border") || DEFAULT_CUSTOM_THEME.sidebarBorder,
      sidebarHighlight: getVar("--th-sidebar-highlight") || DEFAULT_CUSTOM_THEME.sidebarHighlight,
    };
  }

  /** Reset custom theme editor to default values */
  resetCustomThemeToDefaults(): void {
    this.customTheme = { ...DEFAULT_CUSTOM_THEME };
  }

  setGameDataPath(path: string): void {
    this.gameDataPath = path;
    this.#schedulePersist("gameDataPath");
  }

  addAdditionalModPath(path: string): void {
    if (!this.additionalModPaths.includes(path)) {
      this.additionalModPaths = [...this.additionalModPaths, path];
      this.#schedulePersist("additionalModPaths");
    }
  }

  removeAdditionalModPath(path: string): void {
    this.additionalModPaths = this.additionalModPaths.filter(p => p !== path);
    this.#schedulePersist("additionalModPaths");
  }

  setAdditionalModPaths(paths: string[]): void {
    this.additionalModPaths = paths.filter(Boolean);
    this.#schedulePersist("additionalModPaths");
  }

  /** Increase text zoom by 10%, capped at 200% */
  zoomIn(): void {
    this.zoomLevel = Math.min(200, this.zoomLevel + 10);
    this.#schedulePersist("zoomLevel");
  }

  /** Decrease text zoom by 10%, floored at 50% */
  zoomOut(): void {
    this.zoomLevel = Math.max(50, this.zoomLevel - 10);
    this.#schedulePersist("zoomLevel");
  }

  /** Reset text zoom to 100% */
  zoomReset(): void {
    this.zoomLevel = 100;
    this.#schedulePersist("zoomLevel");
  }
}

export const settingsStore = new SettingsStore();
