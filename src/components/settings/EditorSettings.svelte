<!--
  Editor & Scripts settings — merged section.
  Covers code editor appearance, behavior, and script tool integration.
-->
<script lang="ts">
  import { m } from "../../paraglide/messages.js";
  import { settingsStore } from "../../lib/stores/settingsStore.svelte.js";
  import { projectSettingsStore } from "../../lib/stores/projectSettingsStore.svelte.js";
  import { open } from "@tauri-apps/plugin-dialog";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import SettingsToggle from "./SettingsToggle.svelte";
  import SettingsPanel from "./SettingsPanel.svelte";

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
        title: m.settings_scripts_template_folder_browse_title(),
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
</script>

<h3 class="settings-section-title">{m.settings_editor_title()}</h3>

<div class="space-y-4">

  <!-- Font settings row -->
  <div class="font-settings-grid">
    <div>
      <label class="field-label" for="editor-font-size">{m.settings_editor_font_size()}</label>
      <input
        id="editor-font-size"
        type="number"
        min="8"
        max="32"
        step="1"
        class="w-24 form-input bg-[var(--th-bg-800)] border border-[var(--th-border-600)] text-[var(--th-text-200)] rounded px-2 py-1.5 text-xs focus:border-[var(--th-accent-500,#0ea5e9)]"
        value={settingsStore.editorFontSize}
        onchange={(e) => { settingsStore.editorFontSize = Math.min(32, Math.max(8, Number((e.target as HTMLInputElement).value) || 12)); settingsStore.persist(); }}
      />
    </div>
    <div>
      <label class="field-label" for="editor-font-family">{m.settings_editor_font_family()}</label>
      <input
        id="editor-font-family"
        type="text"
        class="w-full form-input bg-[var(--th-bg-800)] border border-[var(--th-border-600)] text-[var(--th-text-200)] rounded px-2 py-1.5 text-xs focus:border-[var(--th-accent-500,#0ea5e9)]"
        value={settingsStore.editorFontFamily}
        onblur={(e) => { const v = (e.target as HTMLInputElement).value.trim(); if (v && v !== settingsStore.editorFontFamily) { settingsStore.editorFontFamily = v; settingsStore.persist(); } }}
      />
    </div>
  </div>

  <!-- Tab Size + Lint Delay side by side -->
  <div class="inline-fields-row">
    <div>
      <label class="field-label" for="editor-tab-size">{m.settings_editor_tab_size()}</label>
      <input
        id="editor-tab-size"
        type="number"
        min="1"
        max="16"
        step="1"
        class="w-20 form-input bg-[var(--th-bg-800)] border border-[var(--th-border-600)] text-[var(--th-text-200)] rounded px-2 py-1.5 text-xs focus:border-[var(--th-accent-500,#0ea5e9)]"
        value={settingsStore.editorTabSize}
        onchange={(e) => { settingsStore.editorTabSize = Math.min(16, Math.max(1, Number((e.target as HTMLInputElement).value) || 2)); settingsStore.persist(); }}
      />
    </div>
    <div>
      <label class="field-label" for="editor-lint-delay">{m.settings_editor_lint_delay()}</label>
      <input
        id="editor-lint-delay"
        type="number"
        min="100"
        max="5000"
        step="100"
        class="w-28 form-input bg-[var(--th-bg-800)] border border-[var(--th-border-600)] text-[var(--th-text-200)] rounded px-2 py-1.5 text-xs focus:border-[var(--th-accent-500,#0ea5e9)]"
        value={settingsStore.editorLintDelay}
        onchange={(e) => { settingsStore.editorLintDelay = Math.min(5000, Math.max(100, Number((e.target as HTMLInputElement).value) || 500)); settingsStore.persist(); }}
      />
    </div>
  </div>

  <!-- View toggles in 3-column grid -->
  <SettingsPanel title={m.settings_editor_view_panel_title()} columns={3}>
    <SettingsToggle
      label={m.settings_editor_word_wrap()}
      checked={settingsStore.editorWordWrap}
      onchange={(v) => { settingsStore.editorWordWrap = v; settingsStore.persist(); }}
    />
    <SettingsToggle
      label={m.settings_editor_line_numbers()}
      checked={settingsStore.editorLineNumbers}
      onchange={(v) => { settingsStore.editorLineNumbers = v; settingsStore.persist(); }}
    />
    <SettingsToggle
      label={m.settings_editor_bracket_matching()}
      checked={settingsStore.editorBracketMatching}
      onchange={(v) => { settingsStore.editorBracketMatching = v; settingsStore.persist(); }}
    />
    <SettingsToggle
      label={m.settings_editor_active_line()}
      checked={settingsStore.editorActiveLineHighlight}
      onchange={(v) => { settingsStore.editorActiveLineHighlight = v; settingsStore.persist(); }}
    />
    <SettingsToggle
      label={m.settings_editor_minimap()}
      checked={settingsStore.editorMinimap}
      onchange={(v) => { settingsStore.editorMinimap = v; settingsStore.persist(); }}
    />
  </SettingsPanel>

  <!-- Script Tools (merged from Scripts section) -->
  <SettingsPanel title={m.settings_editor_script_tools_title()}>
    <!-- IDE Helpers -->
    <div class="script-path-field">
      <p class="field-label">{m.settings_scripts_ide_helpers_heading()}</p>
      <p class="field-desc">{m.settings_scripts_ide_helpers_desc()}</p>
      <div class="flex items-center gap-2 mt-1">
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

    <!-- Template Folder -->
    <div class="script-path-field">
      <p class="field-label">{m.settings_scripts_template_folder_heading()}</p>
      <p class="field-desc">{m.settings_scripts_template_folder_desc()}</p>
      <div class="flex items-center gap-2 mt-1">
        <input
          type="text"
          class="flex-1 form-input bg-[var(--th-bg-800)] border border-[var(--th-border-600)] text-[var(--th-text-200)] rounded px-2 py-1.5 text-xs focus:border-[var(--th-accent-500,#0ea5e9)]"
          placeholder={m.settings_scripts_template_folder_placeholder()}
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
  </SettingsPanel>

  <!-- Reset -->
  <div class="pt-2 border-t border-[var(--th-border-700)]">
    <button
      class="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-[var(--th-bg-700)] hover:bg-[var(--th-bg-600)] text-[var(--th-text-300)] transition-colors"
      onclick={() => settingsStore.resetEditorSettings()}
    >
      <RotateCcw size={12} />
      {m.settings_editor_reset()}
    </button>
  </div>

</div>

<style>
  .settings-section-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--th-text-200);
    margin-bottom: 0.75rem;
  }
  .field-label {
    display: block;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--th-text-400);
    margin-bottom: 0.1rem;
  }
  .field-desc {
    font-size: 0.7rem;
    color: var(--th-text-500);
    margin: 0 0 0.25rem;
    line-height: 1.4;
  }
  .font-settings-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.75rem 1rem;
    align-items: end;
  }
  .inline-fields-row {
    display: flex;
    gap: 2rem;
    flex-wrap: wrap;
    align-items: flex-start;
  }
  .script-path-field {
    padding: 0.375rem 0;
  }
  .script-path-field + .script-path-field {
    border-top: 1px solid var(--th-border-700);
    padding-top: 0.625rem;
    margin-top: 0.25rem;
  }
</style>
