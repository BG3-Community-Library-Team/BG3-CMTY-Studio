<!--
  MCM Blueprint Form Editor — Structured form for editing MCM_blueprint.json.
  Provides a form-based editor for building Mod Configuration Menu blueprints
  with tabs, sections, and settings. Includes a toggle to switch to raw JSON editing.
-->
<script lang="ts">
  import { scriptRead, scriptWrite } from "../lib/tauri/scripts.js";
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import { toastStore } from "../lib/stores/toastStore.svelte.js";
  import { uiStore } from "../lib/stores/uiStore.svelte.js";
  import { m } from "../paraglide/messages.js";
  import ScriptEditorPanel from "./ScriptEditorPanel.svelte";
  import Loader2 from "@lucide/svelte/icons/loader-2";
  import AlertCircle from "@lucide/svelte/icons/alert-circle";
  import Save from "@lucide/svelte/icons/save";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import GripVertical from "@lucide/svelte/icons/grip-vertical";

  interface Props {
    filePath: string;
  }

  let { filePath }: Props = $props();

  // ── MCM Widget types ──
  const WIDGET_TYPES = [
    "checkbox", "int", "float", "text", "enum", "radio",
    "slider_int", "slider_float", "drag_int", "drag_float",
    "list_v2", "color_picker", "color_edit", "keybinding_v2", "event_button",
  ] as const;

  type WidgetType = typeof WIDGET_TYPES[number];

  // ── Types for MCM blueprint structure ──
  interface McmSetting {
    Id: string;
    Name: string;
    Type: WidgetType;
    Default: unknown;
    Description: string;
    Tooltip: string;
    Options: Record<string, unknown>;
  }

  interface McmSection {
    SectionId: string;
    SectionName: string;
    Settings: McmSetting[];
  }

  interface McmTab {
    TabId: string;
    TabName: string;
    Sections: McmSection[];
    Settings: McmSetting[];
  }

  // ── Form state ──
  let schemaVersion = $state(1);
  let modName = $state("");
  let tabs: McmTab[] = $state([]);

  // ── UI state ──
  let isLoading = $state(true);
  let error: string | null = $state(null);
  let rawMode = $state(false);
  let rawContent = $state("");
  let parseError: string | null = $state(null);
  let expandedTabs: Record<string, boolean> = $state({});
  let expandedSections: Record<string, boolean> = $state({});
  let expandedSettings: Record<string, boolean> = $state({});

  // ── Defaults ──
  function defaultSetting(): McmSetting {
    return {
      Id: "",
      Name: "",
      Type: "checkbox",
      Default: false,
      Description: "",
      Tooltip: "",
      Options: {},
    };
  }

  function defaultSection(): McmSection {
    return { SectionId: "", SectionName: "", Settings: [] };
  }

  function defaultTab(): McmTab {
    return { TabId: "", TabName: "", Sections: [], Settings: [] };
  }

  /** Default value for a given widget type */
  function defaultForType(type: WidgetType): unknown {
    switch (type) {
      case "checkbox": return false;
      case "int": case "slider_int": case "drag_int": return 0;
      case "float": case "slider_float": case "drag_float": return 0.0;
      case "text": return "";
      case "enum": case "radio": return "";
      case "list_v2": return { Enabled: true, Elements: [] };
      case "color_picker": case "color_edit": return [1.0, 1.0, 1.0, 1.0];
      case "keybinding_v2": return { Keyboard: { Key: "", ModifierKeys: [] } };
      case "event_button": return undefined;
    }
  }

  /** Whether a type requires Options.Choices */
  function needsChoices(type: WidgetType): boolean {
    return type === "enum" || type === "radio";
  }

  /** Whether a type requires Options.Min/Max */
  function needsMinMax(type: WidgetType): boolean {
    return type === "slider_int" || type === "slider_float" || type === "drag_int" || type === "drag_float";
  }

  // ── JSON conversion ──
  function formToJson(): string {
    const obj: Record<string, unknown> = { SchemaVersion: schemaVersion };
    if (modName.trim()) obj.ModName = modName.trim();
    obj.Tabs = tabs.map(tab => {
      const t: Record<string, unknown> = { TabId: tab.TabId, TabName: tab.TabName };
      if (tab.Sections.length > 0) {
        t.Sections = tab.Sections.map(sec => {
          const s: Record<string, unknown> = { SectionId: sec.SectionId, SectionName: sec.SectionName };
          if (sec.Settings.length > 0) s.Settings = sec.Settings.map(settingToJson);
          return s;
        });
      }
      if (tab.Settings.length > 0) {
        t.Settings = tab.Settings.map(settingToJson);
      }
      return t;
    });
    return JSON.stringify(obj, null, 4);
  }

  function settingToJson(s: McmSetting): Record<string, unknown> {
    const out: Record<string, unknown> = {
      Id: s.Id,
      Name: s.Name,
      Type: s.Type,
    };
    if (s.Default !== undefined) out.Default = s.Default;
    if (s.Description.trim()) out.Description = s.Description;
    if (s.Tooltip.trim()) out.Tooltip = s.Tooltip;
    if (Object.keys(s.Options).length > 0) out.Options = { ...s.Options };
    return out;
  }

  function jsonToForm(json: string): boolean {
    try {
      const obj = JSON.parse(json);
      if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return false;
      schemaVersion = typeof obj.SchemaVersion === "number" ? obj.SchemaVersion : 1;
      modName = typeof obj.ModName === "string" ? obj.ModName : "";
      tabs = [];
      if (Array.isArray(obj.Tabs)) {
        tabs = obj.Tabs.map(parseTab);
      } else if (Array.isArray(obj.Settings)) {
        // Root-level settings without tabs
        const tab = defaultTab();
        tab.TabId = "general";
        tab.TabName = "General";
        tab.Settings = obj.Settings.map(parseSetting);
        tabs = [tab];
      }
      return true;
    } catch {
      return false;
    }
  }

  function parseTab(t: Record<string, unknown>): McmTab {
    const tab = defaultTab();
    tab.TabId = String(t.TabId ?? "");
    tab.TabName = String(t.TabName ?? "");
    if (Array.isArray(t.Sections)) {
      tab.Sections = t.Sections.map((s: Record<string, unknown>) => {
        const sec = defaultSection();
        sec.SectionId = String(s.SectionId ?? "");
        sec.SectionName = String(s.SectionName ?? "");
        if (Array.isArray(s.Settings)) sec.Settings = s.Settings.map(parseSetting);
        return sec;
      });
    }
    if (Array.isArray(t.Settings)) {
      tab.Settings = t.Settings.map(parseSetting);
    }
    return tab;
  }

  function parseSetting(s: Record<string, unknown>): McmSetting {
    const setting = defaultSetting();
    setting.Id = String(s.Id ?? "");
    setting.Name = String(s.Name ?? "");
    setting.Type = WIDGET_TYPES.includes(s.Type as WidgetType) ? (s.Type as WidgetType) : "checkbox";
    setting.Default = s.Default ?? defaultForType(setting.Type);
    setting.Description = String(s.Description ?? "");
    setting.Tooltip = String(s.Tooltip ?? "");
    if (typeof s.Options === "object" && s.Options !== null && !Array.isArray(s.Options)) {
      setting.Options = { ...(s.Options as Record<string, unknown>) };
    }
    return setting;
  }

  // ── Load content on mount / filePath change ──
  $effect(() => {
    const path = filePath;
    const modPath = modStore.selectedModPath;
    if (!path || !modPath) {
      error = m.mcm_editor_no_mod_folder();
      isLoading = false;
      return;
    }
    isLoading = true;
    error = null;
    parseError = null;
    scriptRead(modPath, path).then(text => {
      if (text && text.trim()) {
        rawContent = text;
        if (!jsonToForm(text)) {
          rawMode = true;
          parseError = m.mcm_editor_invalid_json();
        }
      } else {
        // New file defaults
        const folder = modStore.scanResult?.mod_meta?.folder ?? "";
        modName = folder;
        schemaVersion = 1;
        const tab = defaultTab();
        tab.TabId = "general";
        tab.TabName = "General";
        tabs = [tab];
        rawContent = formToJson();
      }
      isLoading = false;
    }).catch(err => {
      error = String(err?.message ?? err);
      isLoading = false;
    });
  });

  // ── Save ──
  async function saveForm() {
    const modPath = modStore.selectedModPath;
    if (!modPath) return;
    const json = rawMode ? rawContent : formToJson();
    try {
      await scriptWrite(modPath, filePath, json);
      rawContent = json;
      const tab = uiStore.openTabs.find(t => t.id === `script:${filePath}`);
      if (tab) tab.dirty = false;
      toastStore.success(m.mcm_editor_saved_title(), "MCM_blueprint.json");
    } catch (err) {
      toastStore.error(m.mcm_editor_save_failed(), String(err));
    }
  }

  function toggleMode() {
    if (rawMode) {
      if (jsonToForm(rawContent)) {
        parseError = null;
        rawMode = false;
      } else {
        parseError = m.mcm_editor_fix_json();
      }
    } else {
      rawContent = formToJson();
      parseError = null;
      rawMode = true;
    }
  }

  let saveTimeout: ReturnType<typeof setTimeout> | undefined;
  function scheduleAutoSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => { saveForm(); }, 500);
  }

  function markDirty() {
    const tab = uiStore.openTabs.find(t => t.id === `script:${filePath}`);
    if (tab && !tab.dirty) tab.dirty = true;
    scheduleAutoSave();
  }

  // ── Actions ──
  function addTab() {
    const id = `tab_${tabs.length + 1}`;
    const tab = defaultTab();
    tab.TabId = id;
    tab.TabName = `Tab ${tabs.length + 1}`;
    tabs = [...tabs, tab];
    expandedTabs[id] = true;
    markDirty();
  }

  function removeTab(idx: number) {
    tabs = tabs.filter((_, i) => i !== idx);
    markDirty();
  }

  function addSection(tabIdx: number) {
    const tab = tabs[tabIdx];
    const id = `section_${tab.Sections.length + 1}`;
    tab.Sections = [...tab.Sections, { ...defaultSection(), SectionId: id, SectionName: `Section ${tab.Sections.length + 1}` }];
    tabs = [...tabs];
    expandedSections[`${tabIdx}-${id}`] = true;
    markDirty();
  }

  function removeSection(tabIdx: number, secIdx: number) {
    tabs[tabIdx].Sections = tabs[tabIdx].Sections.filter((_, i) => i !== secIdx);
    tabs = [...tabs];
    markDirty();
  }

  function addSetting(tabIdx: number, secIdx: number | null) {
    const setting = defaultSetting();
    if (secIdx !== null) {
      tabs[tabIdx].Sections[secIdx].Settings = [...tabs[tabIdx].Sections[secIdx].Settings, setting];
    } else {
      tabs[tabIdx].Settings = [...tabs[tabIdx].Settings, setting];
    }
    tabs = [...tabs];
    markDirty();
  }

  function removeSetting(tabIdx: number, secIdx: number | null, settIdx: number) {
    if (secIdx !== null) {
      tabs[tabIdx].Sections[secIdx].Settings = tabs[tabIdx].Sections[secIdx].Settings.filter((_, i) => i !== settIdx);
    } else {
      tabs[tabIdx].Settings = tabs[tabIdx].Settings.filter((_, i) => i !== settIdx);
    }
    tabs = [...tabs];
    markDirty();
  }

  function onTypeChange(setting: McmSetting, newType: WidgetType) {
    setting.Type = newType;
    setting.Default = defaultForType(newType);
    // Initialize required options for the new type
    if (needsChoices(newType) && !Array.isArray(setting.Options.Choices)) {
      setting.Options = { ...setting.Options, Choices: ["Option 1", "Option 2"] };
      setting.Default = "Option 1";
    }
    if (needsMinMax(newType)) {
      if (setting.Options.Min === undefined) setting.Options = { ...setting.Options, Min: 0 };
      if (setting.Options.Max === undefined) setting.Options = { ...setting.Options, Max: 100 };
    }
    tabs = [...tabs];
    markDirty();
  }

  /** Helper to get a string option */
  function getChoices(setting: McmSetting): string[] {
    return Array.isArray(setting.Options.Choices) ? (setting.Options.Choices as string[]) : [];
  }

  function setChoices(setting: McmSetting, choices: string[]) {
    setting.Options = { ...setting.Options, Choices: choices };
    tabs = [...tabs];
    markDirty();
  }

  function toggleExpand(map: Record<string, boolean>, key: string) {
    map[key] = !(map[key] ?? false);
  }
</script>

<div class="mcm-editor">
  {#if isLoading}
    <div class="editor-empty">
      <Loader2 size={24} class="text-[var(--th-text-600)] animate-spin" />
      <p class="text-xs text-[var(--th-text-500)] mt-2">{m.mcm_editor_loading()}</p>
    </div>
  {:else if error}
    <div class="editor-empty">
      <AlertCircle size={24} class="text-red-400" />
      <p class="text-xs text-red-300 mt-2">{m.mcm_editor_load_failed()}</p>
      <p class="text-[10px] text-[var(--th-text-600)] mt-1 max-w-[300px]">{error}</p>
    </div>
  {:else}
    <!-- Header bar -->
    <div class="editor-header">
      <span class="text-xs font-medium text-[var(--th-text-200)] truncate">{filePath.split("/").pop()}</span>
      <div class="ml-auto flex items-center gap-2">
        {#if parseError}
          <span class="text-[10px] text-amber-400 flex items-center gap-1">
            <AlertCircle size={12} />
            {parseError}
          </span>
        {/if}
        <div class="mode-pill" role="tablist" aria-label="View mode">
          <button
            class="mode-pill-option"
            class:active={!rawMode}
            onclick={() => { if (rawMode) toggleMode(); }}
            role="tab"
            aria-selected={!rawMode}
          >
            {m.mcm_editor_form()}
          </button>
          <button
            class="mode-pill-option"
            class:active={rawMode}
            onclick={() => { if (!rawMode) toggleMode(); }}
            role="tab"
            aria-selected={rawMode}
          >
            Raw JSON
          </button>
        </div>
          <button class="save-btn" onclick={saveForm}>
            <Save size={12} />
            {m.mcm_editor_save()}
          </button>
      </div>
    </div>

    {#if rawMode}
      <div class="flex-1 min-h-0">
        <ScriptEditorPanel {filePath} language="json" />
      </div>
    {:else}
      <div class="form-body">
        <!-- Root fields -->
        <div class="form-row">
          <div class="form-field" style="flex: 0 0 120px;">
            <label class="form-label">{m.mcm_editor_schema_version()}
              <input type="number" class="form-input" value={schemaVersion} min="1" step="1"
                oninput={(e) => { schemaVersion = parseInt(e.currentTarget.value, 10) || 1; markDirty(); }} />
            </label>
          </div>
          <div class="form-field" style="flex: 1;">
            <label class="form-label"><span>{m.mcm_editor_mod_name()} <span class="text-[var(--th-text-600)]">{m.mcm_editor_optional()}</span></span>
              <input type="text" class="form-input" value={modName} placeholder={m.mcm_editor_mod_name_placeholder()}
                oninput={(e) => { modName = e.currentTarget.value; markDirty(); }} />
            </label>
          </div>
        </div>

        <!-- Tabs -->
        <div class="tabs-section">
          <div class="section-header">
            <span class="section-title">{m.mcm_editor_tabs()}</span>
            <button class="add-btn" onclick={addTab}>
              <Plus size={12} /> {m.mcm_editor_add_tab()}
            </button>
          </div>

          {#each tabs as tab, tabIdx (tab.TabId || tabIdx)}
            {@const tabKey = `tab-${tabIdx}`}
            {@const tabExpanded = expandedTabs[tabKey] ?? true}
            <div class="card">
              <div class="card-header" role="button" tabindex="0" onclick={() => toggleExpand(expandedTabs, tabKey)} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleExpand(expandedTabs, tabKey); }}>
                <ChevronRight size={14} class="chevron {tabExpanded ? 'expanded' : ''}" />
                <span class="card-title">{tab.TabName || m.mcm_editor_untitled_tab()}</span>
                <span class="card-badge">{m.mcm_editor_tab_badge({ index: tabIdx + 1 })}</span>
                <button class="remove-btn" onclick={(e) => { e.stopPropagation(); removeTab(tabIdx); }} title={m.mcm_editor_remove_tab()}>
                  <Trash2 size={12} />
                </button>
              </div>

              {#if tabExpanded}
                <div class="card-body">
                  <div class="form-row">
                    <div class="form-field" style="flex: 1;">
                      <label class="form-label">{m.mcm_editor_tab_id()}
                        <input type="text" class="form-input" value={tab.TabId} placeholder="unique_tab_id"
                          oninput={(e) => { tab.TabId = e.currentTarget.value; tabs = [...tabs]; markDirty(); }} />
                      </label>
                    </div>
                    <div class="form-field" style="flex: 1;">
                      <label class="form-label">{m.mcm_editor_tab_name()}
                        <input type="text" class="form-input" value={tab.TabName} placeholder="Display Name"
                          oninput={(e) => { tab.TabName = e.currentTarget.value; tabs = [...tabs]; markDirty(); }} />
                      </label>
                    </div>
                  </div>

                  <!-- Sections within tab -->
                  <div class="subsection">
                    <div class="section-header">
                      <span class="subsection-title">{m.mcm_editor_sections()}</span>
                      <button class="add-btn small" onclick={() => addSection(tabIdx)}>
                        <Plus size={10} /> {m.mcm_editor_add_section()}
                      </button>
                    </div>

                    {#each tab.Sections as section, secIdx (section.SectionId || secIdx)}
                      {@const secKey = `${tabIdx}-sec-${secIdx}`}
                      {@const secExpanded = expandedSections[secKey] ?? true}
                      <div class="card nested">
                        <div class="card-header" role="button" tabindex="0" onclick={() => toggleExpand(expandedSections, secKey)} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleExpand(expandedSections, secKey); }}>
                          <ChevronRight size={12} class="chevron {secExpanded ? 'expanded' : ''}" />
                          <span class="card-title small">{section.SectionName || m.mcm_editor_untitled_section()}</span>
                          <button class="remove-btn" onclick={(e) => { e.stopPropagation(); removeSection(tabIdx, secIdx); }} title={m.mcm_editor_remove_section()}>
                            <Trash2 size={10} />
                          </button>
                        </div>

                        {#if secExpanded}
                          <div class="card-body">
                            <div class="form-row">
                              <div class="form-field" style="flex: 1;">
                                <label class="form-label">{m.mcm_editor_section_id()}
                                  <input type="text" class="form-input" value={section.SectionId} placeholder="section_id"
                                    oninput={(e) => { section.SectionId = e.currentTarget.value; tabs = [...tabs]; markDirty(); }} />
                                </label>
                              </div>
                              <div class="form-field" style="flex: 1;">
                                <label class="form-label">{m.mcm_editor_section_name()}
                                  <input type="text" class="form-input" value={section.SectionName} placeholder="Section Name"
                                    oninput={(e) => { section.SectionName = e.currentTarget.value; tabs = [...tabs]; markDirty(); }} />
                                </label>
                              </div>
                            </div>

                            <!-- Settings in section -->
                            {#each section.Settings as setting, settIdx (setting.Id || `${secIdx}-${settIdx}`)}
                              {@render settingForm(setting, tabIdx, secIdx, settIdx)}
                            {/each}
                            <button class="add-btn small" onclick={() => addSetting(tabIdx, secIdx)}>
                              <Plus size={10} /> {m.mcm_editor_add_setting()}
                            </button>
                          </div>
                        {/if}
                      </div>
                    {/each}
                  </div>

                  <!-- Tab-level settings (without sections) -->
                  <div class="subsection">
                    <div class="section-header">
                      <span class="subsection-title">{m.mcm_editor_settings()}</span>
                      <button class="add-btn small" onclick={() => addSetting(tabIdx, null)}>
                        <Plus size={10} /> {m.mcm_editor_add_setting()}
                      </button>
                    </div>
                    {#each tab.Settings as setting, settIdx (setting.Id || `tab-${tabIdx}-${settIdx}`)}
                      {@render settingForm(setting, tabIdx, null, settIdx)}
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>

{#snippet settingForm(setting: McmSetting, tabIdx: number, secIdx: number | null, settIdx: number)}
  {@const settKey = `${tabIdx}-${secIdx ?? 'tab'}-${settIdx}`}
  {@const settExpanded = expandedSettings[settKey] ?? true}
  <div class="setting-card">
    <div class="card-header setting" role="button" tabindex="0" onclick={() => toggleExpand(expandedSettings, settKey)} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleExpand(expandedSettings, settKey); }}>
      <ChevronRight size={12} class="chevron {settExpanded ? 'expanded' : ''}" />
      <span class="setting-type-badge">{setting.Type}</span>
      <span class="card-title small">{setting.Name || setting.Id || m.mcm_editor_new_setting()}</span>
      <button class="remove-btn" onclick={(e) => { e.stopPropagation(); removeSetting(tabIdx, secIdx, settIdx); }} title={m.mcm_editor_remove_setting()}>
        <Trash2 size={10} />
      </button>
    </div>

    {#if settExpanded}
      <div class="setting-body">
        <div class="form-row">
          <div class="form-field" style="flex: 1;">
            <label class="form-label">{m.mcm_editor_setting_id()}
              <input type="text" class="form-input" value={setting.Id} placeholder="unique_setting_id"
                oninput={(e) => { setting.Id = e.currentTarget.value; tabs = [...tabs]; markDirty(); }} />
            </label>
          </div>
          <div class="form-field" style="flex: 1;">
            <label class="form-label">{m.mcm_editor_setting_name()}
              <input type="text" class="form-input" value={setting.Name} placeholder="Setting Name"
                oninput={(e) => { setting.Name = e.currentTarget.value; tabs = [...tabs]; markDirty(); }} />
            </label>
          </div>
          <div class="form-field" style="flex: 0 0 150px;">
            <label class="form-label">{m.mcm_editor_setting_type()}
              <select class="form-input" value={setting.Type}
                onchange={(e) => onTypeChange(setting, e.currentTarget.value as WidgetType)}>
                {#each WIDGET_TYPES as wt}
                  <option value={wt}>{wt}</option>
                {/each}
              </select>
            </label>
          </div>
        </div>

        <!-- Default value -->
        {#if setting.Type !== "event_button"}
          <div class="form-field">
            <span class="form-label">{m.mcm_editor_default()}</span>
            {#if setting.Type === "checkbox"}
              <label class="checkbox-item">
                <input type="checkbox" checked={setting.Default === true}
                  onchange={() => { setting.Default = !setting.Default; tabs = [...tabs]; markDirty(); }} />
                <span>{setting.Default ? 'true' : 'false'}</span>
              </label>
            {:else if setting.Type === "int" || setting.Type === "slider_int" || setting.Type === "drag_int"}
              <input type="number" class="form-input" style="max-width: 160px;" value={setting.Default}
                oninput={(e) => { setting.Default = parseInt(e.currentTarget.value, 10) || 0; tabs = [...tabs]; markDirty(); }} />
            {:else if setting.Type === "float" || setting.Type === "slider_float" || setting.Type === "drag_float"}
              <input type="number" class="form-input" style="max-width: 160px;" step="0.1" value={setting.Default}
                oninput={(e) => { setting.Default = parseFloat(e.currentTarget.value) || 0; tabs = [...tabs]; markDirty(); }} />
            {:else if setting.Type === "text"}
              <input type="text" class="form-input" value={setting.Default ?? ""} placeholder="Default text"
                oninput={(e) => { setting.Default = e.currentTarget.value; tabs = [...tabs]; markDirty(); }} />
            {:else if setting.Type === "enum" || setting.Type === "radio"}
              <select class="form-input" style="max-width: 240px;" value={setting.Default ?? ""}>
                {#each getChoices(setting) as choice}
                  <option value={choice}>{choice}</option>
                {/each}
              </select>
            {:else}
              <input type="text" class="form-input" value={JSON.stringify(setting.Default ?? null)} placeholder="JSON value"
                oninput={(e) => { try { setting.Default = JSON.parse(e.currentTarget.value); } catch { /* keep raw */ } tabs = [...tabs]; markDirty(); }} />
            {/if}
          </div>
        {/if}

        <!-- Description / Tooltip -->
        <div class="form-row">
          <div class="form-field" style="flex: 1;">
            <label class="form-label">{m.mcm_editor_description()}
              <input type="text" class="form-input" value={setting.Description} placeholder={m.mcm_editor_description_placeholder()}
                oninput={(e) => { setting.Description = e.currentTarget.value; tabs = [...tabs]; markDirty(); }} />
            </label>
          </div>
          <div class="form-field" style="flex: 1;">
            <label class="form-label">{m.mcm_editor_tooltip()}
              <input type="text" class="form-input" value={setting.Tooltip} placeholder={m.mcm_editor_tooltip_placeholder()}
                oninput={(e) => { setting.Tooltip = e.currentTarget.value; tabs = [...tabs]; markDirty(); }} />
            </label>
          </div>
        </div>

        <!-- Type-specific options -->
        {#if needsChoices(setting.Type)}
          <div class="form-field">
            <span class="form-label">{m.mcm_editor_choices()}</span>
            <div class="choices-list">
              {#each getChoices(setting) as choice, cIdx}
                <div class="choice-row">
                  <GripVertical size={10} class="text-[var(--th-text-700)]" />
                  <input type="text" class="form-input choice-input" value={choice}
                    oninput={(e) => { const c = getChoices(setting); c[cIdx] = e.currentTarget.value; setChoices(setting, c); }} />
                  <button class="remove-btn" onclick={() => { const c = getChoices(setting); c.splice(cIdx, 1); setChoices(setting, [...c]); }}>
                    <Trash2 size={10} />
                  </button>
                </div>
              {/each}
              <button class="add-btn small" onclick={() => { setChoices(setting, [...getChoices(setting), `Option ${getChoices(setting).length + 1}`]); }}>
                <Plus size={10} /> {m.mcm_editor_add_choice()}
              </button>
            </div>
          </div>
        {/if}

        {#if needsMinMax(setting.Type)}
          <div class="form-row">
            <div class="form-field" style="flex: 0 0 120px;">
              <label class="form-label">{m.mcm_editor_min()}
                <input type="number" class="form-input" value={setting.Options.Min ?? 0}
                  step={setting.Type.includes('float') ? '0.1' : '1'}
                  oninput={(e) => { setting.Options = { ...setting.Options, Min: parseFloat(e.currentTarget.value) || 0 }; tabs = [...tabs]; markDirty(); }} />
              </label>
            </div>
            <div class="form-field" style="flex: 0 0 120px;">
              <label class="form-label">{m.mcm_editor_max()}
                <input type="number" class="form-input" value={setting.Options.Max ?? 100}
                  step={setting.Type.includes('float') ? '0.1' : '1'}
                  oninput={(e) => { setting.Options = { ...setting.Options, Max: parseFloat(e.currentTarget.value) || 100 }; tabs = [...tabs]; markDirty(); }} />
              </label>
            </div>
          </div>
        {/if}

        {#if setting.Type === "text"}
          <div class="form-field">
            <label class="checkbox-item">
              <input type="checkbox" checked={setting.Options.Multiline === true}
                onchange={() => { setting.Options = { ...setting.Options, Multiline: !setting.Options.Multiline }; tabs = [...tabs]; markDirty(); }} />
              <span>{m.mcm_editor_multiline()}</span>
            </label>
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/snippet}

<style>
  .mcm-editor {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .editor-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    padding: 2rem;
  }

  .editor-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 16px;
    background: var(--th-bg-900);
    border-bottom: 1px solid var(--th-border-800);
    flex-shrink: 0;
  }

  .mode-pill {
    display: inline-flex;
    border-radius: 9999px;
    border: 1px solid var(--th-border-700);
    background: var(--th-bg-800);
    overflow: hidden;
  }

  .mode-pill-option {
    font-size: 10px;
    padding: 2px 10px;
    border: none;
    background: transparent;
    color: var(--th-text-400);
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
    white-space: nowrap;
  }

  .mode-pill-option:hover {
    color: var(--th-text-200);
  }

  .mode-pill-option.active {
    background: var(--th-accent, #4a9eff);
    color: var(--th-text-on-accent, #fff);
  }

  .save-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 4px;
    color: var(--th-text-400);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
  }

  .save-btn:hover {
    color: var(--th-text-200);
    background: var(--th-bg-700);
  }

  .form-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .form-row {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .form-label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 11px;
    font-weight: 600;
    color: var(--th-text-primary, var(--th-text-300));
  }

  .form-input {
    padding: 5px 8px;
    font-size: 12px;
    border-radius: 4px;
    border: 1px solid var(--th-input-border, var(--th-border-700));
    background: var(--th-input-bg, var(--th-bg-800));
    color: var(--th-text-primary, var(--th-text-200));
    outline: none;
    transition: border-color 0.15s;
  }

  .form-input:focus {
    border-color: var(--th-accent-500, #38bdf8);
  }

  select.form-input {
    cursor: pointer;
  }

  .checkbox-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--th-text-primary, var(--th-text-200));
    cursor: pointer;
  }

  .checkbox-item input[type="checkbox"] {
    accent-color: var(--th-accent-500, #38bdf8);
    width: 14px;
    height: 14px;
  }

  /* ── Section / Card layout ── */
  .tabs-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  .section-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--th-text-200);
  }

  .subsection-title {
    font-size: 11px;
    font-weight: 600;
    color: var(--th-text-400);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .subsection {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 8px;
  }

  .card {
    border: 1px solid var(--th-border-700);
    border-radius: 6px;
    background: var(--th-bg-800);
    overflow: hidden;
  }

  .card.nested {
    border-color: var(--th-border-800);
    background: var(--th-bg-900);
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    width: 100%;
    font-size: 12px;
    color: var(--th-text-200);
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
  }

  .card-header:hover {
    background: var(--th-bg-700);
  }

  .card-header.setting {
    padding: 4px 10px;
  }

  .card-title {
    flex: 1;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-title.small {
    font-size: 11px;
  }

  .card-badge {
    font-size: 9px;
    padding: 1px 6px;
    border-radius: 3px;
    background: var(--th-bg-600);
    color: var(--th-text-500);
    flex-shrink: 0;
  }

  .card-body {
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    border-top: 1px solid var(--th-border-800);
  }

  .setting-card {
    border: 1px solid var(--th-border-800);
    border-radius: 4px;
    background: var(--th-bg-800);
    overflow: hidden;
  }

  .setting-type-badge {
    font-size: 9px;
    padding: 1px 5px;
    border-radius: 3px;
    background: var(--th-accent-500, #38bdf8);
    color: #000;
    font-weight: 600;
    flex-shrink: 0;
  }

  .setting-body {
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    border-top: 1px solid var(--th-border-800);
  }

  .add-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    padding: 3px 10px;
    border-radius: 4px;
    color: var(--th-text-400);
    background: transparent;
    border: 1px dashed var(--th-border-700);
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }

  .add-btn:hover {
    color: var(--th-text-200);
    border-color: var(--th-accent-500, #38bdf8);
  }

  .add-btn.small {
    font-size: 10px;
    padding: 2px 8px;
  }

  .remove-btn {
    display: flex;
    align-items: center;
    padding: 2px;
    border-radius: 3px;
    color: var(--th-text-600);
    background: transparent;
    border: none;
    cursor: pointer;
    flex-shrink: 0;
    transition: color 0.15s;
  }

  .remove-btn:hover {
    color: #f87171;
  }

  :global(.chevron) {
    transition: transform 0.15s;
    flex-shrink: 0;
  }

  :global(.chevron.expanded) {
    transform: rotate(90deg);
  }

  /* ── Choices list ── */
  .choices-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .choice-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .choice-input {
    flex: 1;
    max-width: 280px;
  }
</style>
