/**
 * CQ-008: Centralized theme management module.
 *
 * Single source of truth for theme type definitions, option/command data,
 * and the DOM application logic. Palette token data remains in themeTokens.ts.
 */

import { applyThemeTokens, clearInlineThemeTokens } from "./themeTokens.js";

// Re-export token helpers for consumers that need direct access
export { applyThemeTokens, clearInlineThemeTokens };

export type ThemeId = "dark" | "light" | "solarized-dark" | "solarized-light" | "high-contrast" | "aubergine" | "balance" | "prototype" | "gruvbox-dark" | "gruvbox-light" | "custom";

/** Key customizable theme properties for the custom theme editor */
export interface CustomThemeValues {
  bgMain: string;
  bgSidebar: string;
  bgSection: string;
  bgInput: string;
  textPrimary: string;
  textSecondary: string;
  textAccent: string;
  titlebarText: string;
  borderColor: string;
  scrollThumb: string;
  accentPrimary: string;
  accentSuccess: string;
  accentWarning: string;
  accentDanger: string;
  yamlKey: string;
  yamlString: string;
  yamlComment: string;
  diffAdded: string;
  diffRemoved: string;
  diffChanged: string;
  sidebarBg: string;
  sidebarBgDeep: string;
  sidebarText: string;
  sidebarTextMuted: string;
  sidebarBorder: string;
  sidebarHighlight: string;
}

/** Default custom theme values (same as dark theme) */
export const DEFAULT_CUSTOM_THEME: CustomThemeValues = {
  bgMain: "#18181b",
  bgSidebar: "#27272a",
  bgSection: "#1f1f23",
  bgInput: "#27272a",
  textPrimary: "#f4f4f5",
  textSecondary: "#a1a1aa",
  textAccent: "#38bdf8",
  titlebarText: "#a1a1aa",
  borderColor: "#3f3f46",
  scrollThumb: "#4b5563",
  accentPrimary: "#0284c7",
  accentSuccess: "#4ade80",
  accentWarning: "#fbbf24",
  accentDanger: "#f87171",
  yamlKey: "#7dd3fc",
  yamlString: "#86efac",
  yamlComment: "#9ca3af",
  diffAdded: "#4ade80",
  diffRemoved: "#f87171",
  diffChanged: "#facc15",
  sidebarBg: "#18181b",
  sidebarBgDeep: "#09090b",
  sidebarText: "#f4f4f5",
  sidebarTextMuted: "#a1a1aa",
  sidebarBorder: "#3f3f46",
  sidebarHighlight: "#27272a",
};

export const THEME_OPTIONS: { id: ThemeId; label: string }[] = [
  { id: "high-contrast", label: "High Contrast" },
  { id: "balance", label: "Balance" },
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light" },
  { id: "solarized-dark", label: "Solarized Dark" },
  { id: "solarized-light", label: "Solarized Light" },
  { id: "aubergine", label: "Aubergine" },
  { id: "gruvbox-dark", label: "Gruvbox Dark" },
  { id: "gruvbox-light", label: "Gruvbox Light" },
  { id: "prototype", label: "Prototype" },
];

/** Theme command definitions for command palette registration */
export const THEME_COMMANDS: [ThemeId, string][] = [
  ["balance", "Balance"],
  ["dark", "Dark"],
  ["light", "Light"],
  ["solarized-dark", "Solarized Dark"],
  ["solarized-light", "Solarized Light"],
  ["high-contrast", "High Contrast"],
  ["aubergine", "Aubergine"],
  ["prototype", "Prototype"],
  ["gruvbox-dark", "Gruvbox Dark"],
];

/** Custom theme CSS property mapping (CustomThemeValues key → CSS custom property) */
export const CUSTOM_THEME_MAP: [keyof CustomThemeValues, string][] = [
  ["bgMain", "--custom-bg-main"],
  ["bgSidebar", "--custom-bg-sidebar"],
  ["bgInput", "--custom-bg-input"],
  ["textPrimary", "--custom-text-primary"],
  ["textSecondary", "--custom-text-secondary"],
  ["textAccent", "--custom-text-accent"],
  ["borderColor", "--custom-border-color"],
  ["accentPrimary", "--custom-accent-primary"],
  ["accentSuccess", "--custom-accent-success"],
  ["accentWarning", "--custom-accent-warning"],
  ["accentDanger", "--custom-accent-danger"],
  ["bgSection", "--custom-bg-section"],
  ["titlebarText", "--custom-titlebar-text"],
  ["scrollThumb", "--custom-scroll-thumb"],
  ["yamlKey", "--custom-yaml-key"],
  ["yamlString", "--custom-yaml-string"],
  ["yamlComment", "--custom-yaml-comment"],
  ["diffAdded", "--custom-diff-added"],
  ["diffRemoved", "--custom-diff-removed"],
  ["diffChanged", "--custom-diff-changed"],
  ["sidebarBg", "--custom-sidebar-bg"],
  ["sidebarBgDeep", "--custom-sidebar-bg-deep"],
  ["sidebarText", "--custom-sidebar-text"],
  ["sidebarTextMuted", "--custom-sidebar-text-muted"],
  ["sidebarBorder", "--custom-sidebar-border"],
  ["sidebarHighlight", "--custom-sidebar-highlight"],
];

/**
 * Apply a theme to the document root element.
 * Handles class switching, CSS variable application for built-in themes,
 * and custom theme CSS property mapping.
 */
export function applyTheme(themeId: ThemeId, customValues?: CustomThemeValues): void {
  const root = document.documentElement;
  const allThemes = THEME_OPTIONS.map(o => o.id).concat("custom");
  for (const t of allThemes) root.classList.remove(t);
  root.classList.add(themeId);

  if (themeId === "custom" && customValues) {
    clearInlineThemeTokens();
    for (const [key, cssVar] of CUSTOM_THEME_MAP) {
      root.style.setProperty(cssVar, customValues[key]);
    }
  } else if (themeId !== "custom") {
    applyThemeTokens(themeId);
  }
}
