<!--
  Settings Content Pane — renders in the main content area (not sidebar).
  Reads uiStore.settingsSection to determine which section to display.
-->
<script lang="ts">
  import { m } from "../paraglide/messages.js";
  import { settingsStore, THEME_OPTIONS, DEFAULT_CUSTOM_THEME, type CustomThemeValues } from "../lib/stores/settingsStore.svelte.js";
  import { uiStore } from "../lib/stores/uiStore.svelte.js";
  import { open } from "@tauri-apps/plugin-dialog";
  import { configurationRegistry } from "../lib/plugins/configurationRegistry.svelte.js";
  import { projectSettingsStore, type ProjectSettings } from "../lib/stores/projectSettingsStore.svelte.js";
  import NexusSettingsSection from "./platform/nexus/NexusSettingsSection.svelte";
  import ModioSettingsSection from "./platform/modio/ModioSettingsSection.svelte";

  /** Map of configurationRegistry keys → projectSettingsStore keys for project-level persistence. */
  const CONFIG_TO_PROJECT: Record<string, keyof ProjectSettings> = {
    "git.userName": "gitUserName",
    "git.userEmail": "gitUserEmail",
    "git.autoFetchInterval": "gitAutoFetchInterval",
    "git.defaultRemote": "gitDefaultRemote",
  };

  /** Set a config value in the registry and also persist to project settings if applicable. */
  function setConfigValue(key: string, value: unknown): void {
    configurationRegistry.set(key, value);
    const projectKey = CONFIG_TO_PROJECT[key];
    if (projectKey) {
      projectSettingsStore.set(projectKey, value as any);
    }
  }

  let { stagingOverrideStyle = $bindable("") }: { stagingOverrideStyle?: string } = $props();

  async function browseIdeHelpers() {
    try {
      const selected = await open({
        title: m.settings_scripts_ide_helpers_browse_title(),
        multiple: false,
        directory: true,
      });
      if (selected) {
        if (projectSettingsStore.loaded) {
          projectSettingsStore.set("ideHelpersPath", selected);
        } else {
          settingsStore.ideHelpersPath = selected;
          settingsStore.persist();
        }
      }
    } catch { /* user cancelled */ }
  }

  async function browseTemplateFolder() {
    try {
      const selected = await open({
        title: "Select Template Folder",
        multiple: false,
        directory: true,
      });
      if (selected) {
        if (projectSettingsStore.loaded) {
          projectSettingsStore.set("templateFoldersPath", selected);
        } else {
          settingsStore.templateFoldersPath = selected;
          settingsStore.persist();
        }
      }
    } catch { /* user cancelled */ }
  }

  const MCM_SCHEMA_DEFAULT_URL = "https://raw.githubusercontent.com/AtilioA/BG3-MCM/refs/heads/main/.vscode/schema.json";

  function resetMcmSchemaUrl() {
    settingsStore.mcmSchemaUrl = MCM_SCHEMA_DEFAULT_URL;
    settingsStore.persist();
  }

  /** Maps CustomThemeValues keys → CSS custom property names for live preview overrides. */
  const STAGING_CSS_MAP: Record<keyof CustomThemeValues, string> = {
    bgMain: "--th-bg-900", bgSidebar: "--th-bg-800", bgSection: "--th-bg-850", bgInput: "--th-input-bg",
    textPrimary: "--th-text-100", textSecondary: "--th-text-400", textAccent: "--th-text-sky-400", titlebarText: "--th-titlebar-text",
    borderColor: "--th-border-700", scrollThumb: "--th-scroll-thumb",
    accentPrimary: "--th-bg-sky-600", accentSuccess: "--th-text-emerald-400", accentWarning: "--th-text-amber-400", accentDanger: "--th-text-red-400",
    yamlKey: "--th-yaml-key", yamlString: "--th-yaml-string", yamlComment: "--th-yaml-comment",
    diffAdded: "--th-diff-added", diffRemoved: "--th-diff-removed", diffChanged: "--th-diff-changed",
    sidebarBg: "--th-sidebar-bg", sidebarBgDeep: "--th-sidebar-bg-deep", sidebarText: "--th-sidebar-text",
    sidebarTextMuted: "--th-sidebar-text-muted", sidebarBorder: "--th-sidebar-border", sidebarHighlight: "--th-sidebar-highlight",
  };

  // Theme staging buffer
  let stagingTheme: CustomThemeValues = $state({ ...DEFAULT_CUSTOM_THEME });

  $effect(() => {
    stagingOverrideStyle = Object.entries(STAGING_CSS_MAP)
      .map(([key, cssVar]) => `${cssVar}: ${stagingTheme[key as keyof CustomThemeValues]}`)
      .join("; ");
  });

  // Data-driven color groups for the theme editor
  const THEME_COLOR_GROUPS: { title: () => string; fields: { key: keyof CustomThemeValues; label: () => string }[] }[] = [
    { title: () => m.settings_theme_backgrounds(), fields: [
      { key: "bgMain", label: () => m.settings_theme_bg_main() }, { key: "bgSidebar", label: () => m.settings_theme_bg_sidebar() },
      { key: "bgSection", label: () => m.settings_theme_bg_section() }, { key: "bgInput", label: () => m.settings_theme_bg_input() },
    ]},
    { title: () => m.settings_theme_text(), fields: [
      { key: "textPrimary", label: () => m.settings_theme_text_primary() }, { key: "textSecondary", label: () => m.settings_theme_text_secondary() },
      { key: "textAccent", label: () => m.settings_theme_text_accent() }, { key: "titlebarText", label: () => m.settings_theme_titlebar() },
    ]},
    { title: () => m.settings_theme_chrome(), fields: [
      { key: "borderColor", label: () => m.settings_theme_borders() }, { key: "scrollThumb", label: () => m.settings_theme_scroll() },
    ]},
    { title: () => m.settings_theme_sidebar(), fields: [
      { key: "sidebarBg", label: () => m.settings_theme_sidebar_bg() }, { key: "sidebarBgDeep", label: () => m.settings_theme_sidebar_bg_deep() },
      { key: "sidebarText", label: () => m.settings_theme_sidebar_text() }, { key: "sidebarTextMuted", label: () => m.settings_theme_sidebar_muted() },
      { key: "sidebarBorder", label: () => m.settings_theme_sidebar_border() }, { key: "sidebarHighlight", label: () => m.settings_theme_sidebar_highlight() },
    ]},
    { title: () => m.settings_theme_accents(), fields: [
      { key: "accentPrimary", label: () => m.settings_theme_accent_primary() }, { key: "accentSuccess", label: () => m.settings_theme_accent_success() },
      { key: "accentWarning", label: () => m.settings_theme_accent_warning() }, { key: "accentDanger", label: () => m.settings_theme_accent_danger() },
    ]},
    { title: () => m.settings_theme_syntax(), fields: [
      { key: "yamlKey", label: () => m.settings_theme_yaml_key() }, { key: "yamlString", label: () => m.settings_theme_yaml_string() },
      { key: "yamlComment", label: () => m.settings_theme_yaml_comment() },
    ]},
    { title: () => m.settings_theme_diff(), fields: [
      { key: "diffAdded", label: () => m.settings_theme_diff_added() }, { key: "diffRemoved", label: () => m.settings_theme_diff_removed() },
      { key: "diffChanged", label: () => m.settings_theme_diff_changed() },
    ]},
  ];

  $effect(() => {
    const currentTheme = settingsStore.theme;
    if (currentTheme === "custom") {
      stagingTheme = { ...settingsStore.customTheme };
    } else {
      queueMicrotask(() => {
        settingsStore.populateFromCurrentTheme();
        stagingTheme = { ...settingsStore.customTheme };
      });
    }
  });
</script>

<div class="settings-content-pane scrollbar-thin">
  {#if uiStore.settingsSection === "theme"}
    <h3 class="settings-section-title">{m.settings_theme_title()}</h3>
    <fieldset class="space-y-2 mb-4">
      <legend class="text-xs text-[var(--th-text-300)] font-semibold">{m.settings_theme_title()}</legend>
      <select
        class="w-full form-input bg-[var(--th-bg-800)] border border-[var(--th-border-600)] text-[var(--th-text-200)] rounded px-2 py-1.5 text-xs focus:border-[var(--th-accent-500,#0ea5e9)] cursor-pointer"
        value={settingsStore.theme}
        onchange={(e) => settingsStore.setTheme((e.target as HTMLSelectElement).value as any)}
      >
        {#if settingsStore.hasCustomTheme}
          <option value="custom">{m.settings_theme_custom()}</option>
        {/if}
        {#each THEME_OPTIONS as opt}
          {#if opt.id !== "custom"}
            <option value={opt.id}>{opt.label}</option>
          {/if}
        {/each}
      </select>
    </fieldset>

    <!-- Custom theme editor -->
    <div class="space-y-3 mt-4">
      <p class="text-[10px] uppercase tracking-wider text-[var(--th-text-500)] font-semibold">{m.settings_theme_editor_heading()}</p>
      <p class="text-xs text-[var(--th-text-500)]">{m.settings_theme_editor_instruction()}</p>

      {#each THEME_COLOR_GROUPS as group}
        <p class="text-[10px] uppercase tracking-wider text-[var(--th-text-500)] font-semibold">{group.title()}</p>
        <div class="grid grid-cols-2 gap-2">
          {#each group.fields as field}
            <label class="flex items-center gap-1.5 text-xs text-[var(--th-text-400)]">
              <input type="color" class="w-5 h-5 rounded cursor-pointer border-0"
                value={stagingTheme[field.key]}
                oninput={(e) => { stagingTheme[field.key] = (e.target as HTMLInputElement).value; }}
              /> {field.label()}
            </label>
          {/each}
        </div>
      {/each}

      <div class="flex gap-2 pt-1">
        <button
          class="flex-1 px-3 py-1.5 text-xs rounded bg-[var(--th-accent-500,#0ea5e9)] hover:opacity-90 text-white transition-colors"
          onclick={() => { settingsStore.customTheme = { ...stagingTheme }; settingsStore.saveCustomTheme(); }}
        >{m.settings_theme_apply()}</button>
        <button
          class="px-3 py-1.5 text-xs rounded bg-[var(--th-bg-700)] hover:bg-[var(--th-bg-600)] text-[var(--th-text-300)] transition-colors"
          onclick={() => { settingsStore.populateFromCurrentTheme(); stagingTheme = { ...settingsStore.customTheme }; }}
        >{m.common_reset()}</button>
      </div>
    </div>

  {:else if uiStore.settingsSection === "display"}
    <h3 class="settings-section-title">{m.settings_display_title()}</h3>

    <p class="text-[10px] uppercase tracking-wider text-[var(--th-text-500)] font-semibold mb-1">{m.settings_display_zoom_heading()}</p>
    <p class="text-xs text-[var(--th-text-500)] mb-2">{m.settings_display_zoom_instruction()}</p>
    <div class="flex items-center gap-3 mb-4">
      <button class="px-2 py-1 text-sm rounded bg-[var(--th-bg-700)] hover:bg-[var(--th-bg-600)] text-[var(--th-text-200)] transition-colors disabled:opacity-40"
        onclick={() => settingsStore.zoomOut()} disabled={settingsStore.zoomLevel <= 50}>&#8722;</button>
      <span class="text-xs text-[var(--th-text-200)] min-w-[40px] text-center font-mono">{settingsStore.zoomLevel}%</span>
      <button class="px-2 py-1 text-sm rounded bg-[var(--th-bg-700)] hover:bg-[var(--th-bg-600)] text-[var(--th-text-200)] transition-colors disabled:opacity-40"
        onclick={() => settingsStore.zoomIn()} disabled={settingsStore.zoomLevel >= 200}>+</button>
      <button class="px-2 py-1 text-xs rounded bg-[var(--th-bg-700)] hover:bg-[var(--th-bg-600)] text-[var(--th-text-400)] transition-colors disabled:opacity-40"
        onclick={() => settingsStore.zoomReset()} disabled={settingsStore.zoomLevel === 100}>{m.common_reset()}</button>
    </div>

    <p class="text-[10px] uppercase tracking-wider text-[var(--th-text-500)] font-semibold mb-1">{m.settings_display_motion_heading()}</p>
    <div class="space-y-2 mb-4">
      {#each [
        { value: "system", label: m.settings_display_motion_system_label(), desc: m.settings_display_motion_system_desc() },
        { value: "on", label: m.settings_display_motion_on_label(), desc: m.settings_display_motion_on_desc() },
        { value: "off", label: m.settings_display_motion_off_label(), desc: m.settings_display_motion_off_desc() },
      ] as opt}
        <label class="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 -mx-2 hover:bg-[var(--th-bg-700)]/60 transition-colors">
          <input type="radio" name="settings-reduced-motion" class="w-4 h-4 accent-[var(--th-accent-500,#0ea5e9)] cursor-pointer"
            value={opt.value}
            checked={settingsStore.reducedMotion === opt.value}
            onchange={() => { settingsStore.reducedMotion = opt.value as "system" | "on" | "off"; settingsStore.persist(); }}
          />
          <div>
            <span class="text-xs text-[var(--th-text-200)]">{opt.label}</span>
            <p class="text-xs text-[var(--th-text-500)]">{opt.desc}</p>
          </div>
        </label>
      {/each}
    </div>

    <p class="text-[10px] uppercase tracking-wider text-[var(--th-text-500)] font-semibold mb-1">{m.settings_display_combobox_heading()}</p>
    <div class="space-y-3">
      <label class="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 -mx-2 hover:bg-[var(--th-bg-700)]/60 transition-colors">
        <input type="checkbox" class="w-4 h-4 rounded accent-[var(--th-accent-500,#0ea5e9)] cursor-pointer"
          checked={settingsStore.showComboboxNames}
          onchange={(e) => { settingsStore.showComboboxNames = (e.target as HTMLInputElement).checked; settingsStore.persist(); }}
        />
        <div>
          <span class="text-xs text-[var(--th-text-200)]">{m.settings_display_show_names_label()}</span>
          <p class="text-xs text-[var(--th-text-500)]">{m.settings_display_show_names_desc()}</p>
        </div>
      </label>
      <label class="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 -mx-2 hover:bg-[var(--th-bg-700)]/60 transition-colors">
        <input type="checkbox" class="w-4 h-4 rounded accent-[var(--th-accent-500,#0ea5e9)] cursor-pointer"
          checked={settingsStore.showModNamePrefix}
          onchange={(e) => { settingsStore.showModNamePrefix = (e.target as HTMLInputElement).checked; settingsStore.persist(); }}
        />
        <div>
          <span class="text-xs text-[var(--th-text-200)]">{m.settings_display_show_prefix_label()}</span>
          <p class="text-xs text-[var(--th-text-500)]">{m.settings_display_show_prefix_desc()}</p>
        </div>
      </label>
    </div>

    <p class="text-[10px] uppercase tracking-wider text-[var(--th-text-500)] font-semibold mt-4 mb-1">{m.settings_display_tab_bar_heading()}</p>
    <div class="space-y-3">
      <label class="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 -mx-2 hover:bg-[var(--th-bg-700)]/60 transition-colors">
        <input type="checkbox" class="w-4 h-4 rounded accent-[var(--th-accent-500,#0ea5e9)] cursor-pointer"
          checked={settingsStore.autoHideTabBar}
          onchange={(e) => { settingsStore.autoHideTabBar = (e.target as HTMLInputElement).checked; settingsStore.persist(); }}
        />
        <div>
          <span class="text-xs text-[var(--th-text-200)]">{m.settings_display_auto_hide_tab_label()}</span>
          <p class="text-xs text-[var(--th-text-500)]">{m.settings_display_auto_hide_tab_desc()}</p>
        </div>
      </label>
    </div>

  {:else if uiStore.settingsSection === "modConfig"}
    <h3 class="settings-section-title">{m.settings_mod_config_title()}</h3>
    <div class="space-y-3">
      <label class="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 -mx-2 hover:bg-[var(--th-bg-700)]/60 transition-colors">
        <input type="checkbox" class="w-4 h-4 rounded accent-[var(--th-accent-500,#0ea5e9)] cursor-pointer"
          checked={settingsStore.enableCfIntegration}
          onchange={(e) => { settingsStore.enableCfIntegration = (e.target as HTMLInputElement).checked; settingsStore.persist(); }}
        />
        <div>
          <span class="text-xs text-[var(--th-text-200)]">{m.settings_mod_config_cf_label()}</span>
          <p class="text-xs text-[var(--th-text-500)]">{m.settings_mod_config_cf_desc()}</p>
        </div>
      </label>
      <label class="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 -mx-2 hover:bg-[var(--th-bg-700)]/60 transition-colors">
        <input type="checkbox" class="w-4 h-4 rounded accent-[var(--th-accent-500,#0ea5e9)] cursor-pointer"
          checked={settingsStore.enableMcmSupport}
          onchange={(e) => { settingsStore.enableMcmSupport = (e.target as HTMLInputElement).checked; settingsStore.persist(); }}
        />
        <div>
          <span class="text-xs text-[var(--th-text-200)]">{m.settings_mod_config_mcm_label()}</span>
          <p class="text-xs text-[var(--th-text-500)]">{m.settings_mod_config_mcm_desc()}</p>
        </div>
      </label>
      <label class="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 -mx-2 hover:bg-[var(--th-bg-700)]/60 transition-colors">
        <input type="checkbox" class="w-4 h-4 rounded accent-[var(--th-accent-500,#0ea5e9)] cursor-pointer"
          checked={settingsStore.enableMazzleDocsSupport}
          onchange={(e) => { settingsStore.enableMazzleDocsSupport = (e.target as HTMLInputElement).checked; settingsStore.persist(); }}
        />
        <div>
          <span class="text-xs text-[var(--th-text-200)]">{m.settings_mod_config_mazzle_label()}</span>
          <p class="text-xs text-[var(--th-text-500)]">{m.settings_mod_config_mazzle_desc()}</p>
        </div>
      </label>
    </div>

  {:else if uiStore.settingsSection === "schemas"}
    <h3 class="settings-section-title">{m.settings_schemas_title()}</h3>
    <div class="space-y-3">
      <div>
        <p class="text-[10px] uppercase tracking-wider text-[var(--th-text-500)] font-semibold mb-1">{m.settings_schemas_mcm_heading()}</p>
        <p class="text-xs text-[var(--th-text-500)] mb-2">{m.settings_schemas_mcm_desc()}</p>
        <div class="flex items-center gap-2">
          <input
            type="text"
            class="flex-1 form-input bg-[var(--th-bg-800)] border border-[var(--th-border-600)] text-[var(--th-text-200)] rounded px-2 py-1.5 text-xs focus:border-[var(--th-accent-500,#0ea5e9)]"
            placeholder={m.settings_schemas_mcm_placeholder()}
            value={projectSettingsStore.loaded ? (projectSettingsStore.getEffective("mcmSchemaUrl") || "") : settingsStore.mcmSchemaUrl}
            onblur={(e) => { const v = (e.target as HTMLInputElement).value; if (projectSettingsStore.loaded) { projectSettingsStore.set("mcmSchemaUrl", v); } else if (v !== settingsStore.mcmSchemaUrl) { settingsStore.mcmSchemaUrl = v; settingsStore.persist(); } }}
          />
          <button
            class="px-3 py-1.5 text-xs rounded bg-[var(--th-bg-700)] hover:bg-[var(--th-bg-600)] text-[var(--th-text-300)] transition-colors"
            onclick={resetMcmSchemaUrl}
          >{m.settings_schemas_reset()}</button>
        </div>
        {#if settingsStore.mcmSchemaUrl}
          <p class="text-[10px] text-[var(--th-text-600)] mt-1 truncate">{settingsStore.mcmSchemaUrl}</p>
        {/if}
      </div>
    </div>

  {:else if uiStore.settingsSection === "notifications"}
    <h3 class="settings-section-title">{m.settings_notifications_title()}</h3>
    <div class="space-y-3">
      <div>
        <span class="text-xs font-medium text-[var(--th-text-300)]">{m.settings_notifications_success_label()}</span>
        <div class="space-y-1.5 mt-1">
          {#each [
            { value: 2000, label: m.settings_notifications_success_2s() },
            { value: 3000, label: m.settings_notifications_success_3s() },
            { value: 5000, label: m.settings_notifications_success_5s() },
            { value: 8000, label: m.settings_notifications_success_8s() },
            { value: 0, label: m.settings_notifications_no_dismiss() },
          ] as opt}
            <label class="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 -mx-2 hover:bg-[var(--th-bg-700)]/60 transition-colors">
              <input type="radio" name="settings-toast-duration" class="w-4 h-4 accent-[var(--th-accent-500,#0ea5e9)] cursor-pointer"
                value={opt.value} checked={settingsStore.toastDuration === opt.value}
                onchange={() => { settingsStore.toastDuration = opt.value; settingsStore.persist(); }}
              />
              <span class="text-xs text-[var(--th-text-200)]">{opt.label}</span>
            </label>
          {/each}
        </div>
      </div>
      <div>
        <span class="text-xs font-medium text-[var(--th-text-300)]">{m.settings_notifications_error_label()}</span>
        <div class="space-y-1.5 mt-1">
          {#each [
            { value: 5000, label: m.settings_notifications_error_5s() },
            { value: 8000, label: m.settings_notifications_error_8s() },
            { value: 15000, label: m.settings_notifications_error_15s() },
            { value: 0, label: m.settings_notifications_no_dismiss() },
          ] as opt}
            <label class="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 -mx-2 hover:bg-[var(--th-bg-700)]/60 transition-colors">
              <input type="radio" name="settings-error-toast-duration" class="w-4 h-4 accent-[var(--th-accent-500,#0ea5e9)] cursor-pointer"
                value={opt.value} checked={settingsStore.errorToastDuration === opt.value}
                onchange={() => { settingsStore.errorToastDuration = opt.value; settingsStore.persist(); }}
              />
              <span class="text-xs text-[var(--th-text-200)]">{opt.label}</span>
            </label>
          {/each}
        </div>
      </div>
    </div>
  {:else if uiStore.settingsSection === "scripts"}
    <h3 class="settings-section-title">{m.settings_scripts_title()}</h3>
    <div class="space-y-3">
      <div>
        <p class="text-[10px] uppercase tracking-wider text-[var(--th-text-500)] font-semibold mb-1">{m.settings_scripts_ide_helpers_heading()}</p>
        <p class="text-xs text-[var(--th-text-500)] mb-2">{m.settings_scripts_ide_helpers_desc()}</p>
        <div class="flex items-center gap-2">
          <input
            type="text"
            class="flex-1 form-input bg-[var(--th-bg-800)] border border-[var(--th-border-600)] text-[var(--th-text-200)] rounded px-2 py-1.5 text-xs focus:border-[var(--th-accent-500,#0ea5e9)]"
            placeholder={m.settings_scripts_ide_helpers_placeholder()}
            value={projectSettingsStore.loaded ? (projectSettingsStore.getEffective("ideHelpersPath") || "") : settingsStore.ideHelpersPath}
            onblur={(e) => { const v = (e.target as HTMLInputElement).value; if (projectSettingsStore.loaded) { projectSettingsStore.set("ideHelpersPath", v); } else if (v !== settingsStore.ideHelpersPath) { settingsStore.ideHelpersPath = v; settingsStore.persist(); } }}
          />
          <button
            class="px-3 py-1.5 text-xs rounded bg-[var(--th-bg-700)] hover:bg-[var(--th-bg-600)] text-[var(--th-text-300)] transition-colors"
            onclick={browseIdeHelpers}
          >{m.common_browse()}</button>
        </div>
        {#if settingsStore.ideHelpersPath}
          <p class="text-[10px] text-[var(--th-text-600)] mt-1 truncate">{settingsStore.ideHelpersPath}</p>
        {/if}
      </div>

      <div>
        <p class="text-[10px] uppercase tracking-wider text-[var(--th-text-500)] font-semibold mb-1">Template Folder</p>
        <p class="text-xs text-[var(--th-text-500)] mb-2">Path to a folder containing additional script templates organized by category subdirectories (lua, khonsu, anubis, constellations).</p>
        <div class="flex items-center gap-2">
          <input
            type="text"
            class="flex-1 form-input bg-[var(--th-bg-800)] border border-[var(--th-border-600)] text-[var(--th-text-200)] rounded px-2 py-1.5 text-xs focus:border-[var(--th-accent-500,#0ea5e9)]"
            placeholder="Select a template folder..."
            value={projectSettingsStore.loaded ? (projectSettingsStore.getEffective("templateFoldersPath") || "") : settingsStore.templateFoldersPath}
            onblur={(e) => { const v = (e.target as HTMLInputElement).value; if (projectSettingsStore.loaded) { projectSettingsStore.set("templateFoldersPath", v); } else if (v !== settingsStore.templateFoldersPath) { settingsStore.templateFoldersPath = v; settingsStore.persist(); } }}
          />
          <button
            class="px-3 py-1.5 text-xs rounded bg-[var(--th-bg-700)] hover:bg-[var(--th-bg-600)] text-[var(--th-text-300)] transition-colors"
            onclick={browseTemplateFolder}
          >{m.common_browse()}</button>
        </div>
        {#if settingsStore.templateFoldersPath}
          <p class="text-[10px] text-[var(--th-text-600)] mt-1 truncate">{settingsStore.templateFoldersPath}</p>
        {/if}
      </div>
    </div>
  {:else if uiStore.settingsSection === "git"}
    {#each configurationRegistry.getSections().filter(s => s.title === "Git") as section (section.title)}
      <h3 class="settings-section-title">{section.title}</h3>
      <div class="space-y-3">
        {#each Object.entries(section.properties).sort((a, b) => (a[1].order ?? 0) - (b[1].order ?? 0)) as [key, prop] (key)}
          {#if configurationRegistry.getCustomRenderer(key)}
            {@const CustomComponent = configurationRegistry.getCustomRenderer(key)}
            {#if CustomComponent}
              <CustomComponent />
            {/if}
          {:else}
          <div>
            <label class="text-xs font-medium text-[var(--th-text-300)] mb-1 block" for="plugin-{key}">{prop.description}</label>
            {#if prop.type === "boolean"}
              <input
                id="plugin-{key}"
                type="checkbox"
                class="form-checkbox"
                checked={!!configurationRegistry.get(key)}
                onchange={(e) => setConfigValue(key, (e.target as HTMLInputElement).checked)}
              />
            {:else if prop.type === "number"}
              <input
                id="plugin-{key}"
                type="number"
                class="w-full form-input bg-[var(--th-bg-800)] border border-[var(--th-border-600)] text-[var(--th-text-200)] rounded px-2 py-1.5 text-xs focus:border-[var(--th-accent-500,#0ea5e9)]"
                value={configurationRegistry.get(key) ?? ""}
                onblur={(e) => { const v = Number((e.target as HTMLInputElement).value); if (v !== configurationRegistry.get(key)) setConfigValue(key, v); }}
              />
            {:else if prop.enum}
              <select
                id="plugin-{key}"
                class="w-full form-input bg-[var(--th-bg-800)] border border-[var(--th-border-600)] text-[var(--th-text-200)] rounded px-2 py-1.5 text-xs focus:border-[var(--th-accent-500,#0ea5e9)]"
                value={configurationRegistry.get(key) ?? prop.default}
                onchange={(e) => setConfigValue(key, (e.target as HTMLSelectElement).value)}
              >
                {#each prop.enum as opt, idx}
                  <option value={opt}>{prop.enumDescriptions?.[idx] ?? String(opt)}</option>
                {/each}
              </select>
            {:else}
              <input
                id="plugin-{key}"
                type="text"
                autocomplete="off"
                class="w-full form-input bg-[var(--th-bg-800)] border border-[var(--th-border-600)] text-[var(--th-text-200)] rounded px-2 py-1.5 text-xs focus:border-[var(--th-accent-500,#0ea5e9)]"
                value={configurationRegistry.get(key) ?? ""}
                onblur={(e) => { const v = (e.target as HTMLInputElement).value; if (v !== configurationRegistry.get(key)) setConfigValue(key, v); }}
              />
            {/if}
          </div>
          {/if}
        {/each}
      </div>
    {/each}
  {:else if uiStore.settingsSection === "publishing"}
    <h3 class="settings-section-title">{m.publishingSection()}</h3>
    <div class="space-y-6">
      <NexusSettingsSection />
      <hr class="border-[var(--th-border-700)]" />
      <ModioSettingsSection />
    </div>
  {:else}
    <div class="flex flex-col items-center justify-center h-full text-center">
      <p class="text-sm text-[var(--th-text-400)]">{m.settings_empty_state()}</p>
    </div>
  {/if}
</div>

<style>
  .settings-content-pane {
    padding: 1.5rem 2rem;
    max-width: 640px;
    overflow-y: auto;
    height: 100%;
  }
  .settings-section-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--th-text-200);
    margin-bottom: 0.75rem;
  }
</style>
