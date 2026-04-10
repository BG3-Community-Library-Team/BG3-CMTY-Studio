<!--
  SE Config.json Form Editor — Structured form for editing ScriptExtender/Config.json.
  Provides a form-based editor with ModTable, RequiredVersion, FeatureFlags, and Preload fields.
  Includes a toggle to switch to raw JSON editing via ScriptEditorPanel.
-->
<script lang="ts">
  import { scriptRead, scriptWrite } from "../lib/tauri/scripts.js";
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import { toastStore } from "../lib/stores/toastStore.svelte.js";
  import { uiStore } from "../lib/stores/uiStore.svelte.js";
  import ScriptEditorPanel from "./ScriptEditorPanel.svelte";
  import Loader2 from "@lucide/svelte/icons/loader-2";
  import AlertCircle from "@lucide/svelte/icons/alert-circle";
  import Save from "@lucide/svelte/icons/save";
  import { m } from "../paraglide/messages.js";

  interface Props {
    filePath: string;
  }

  let { filePath }: Props = $props();

  // ── Feature flag options ──
  const FEATURE_FLAG_OPTIONS = ["Lua", "Extender", "Osiris", "OsirisExtensions"] as const;

  // ── Lua identifier regex ──
  const LUA_IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

  // ── Form state ──
  let modTable = $state("");
  let requiredVersion = $state(1);
  let featureFlags: string[] = $state(["Lua"]);
  let preload = $state(false);

  // ── UI state ──
  let isLoading = $state(true);
  let error: string | null = $state(null);
  let rawMode = $state(false);
  let rawContent = $state("");
  let parseError: string | null = $state(null);
  let modTableTouched = $state(false);

  // ── Validation ──
  let modTableValid = $derived(modTable === "" ? !modTableTouched : LUA_IDENT_RE.test(modTable));

  // ── Defaults for new files ──
  const DEFAULTS = {
    RequiredVersion: 1,
    ModTable: "",
    FeatureFlags: ["Lua"],
    Preload: false,
  };

  // ── Build JSON from form state ──
  function formToJson(): string {
    const obj: Record<string, unknown> = {
      RequiredVersion: requiredVersion,
      ModTable: modTable,
      FeatureFlags: [...featureFlags],
    };
    if (preload) {
      obj.Preload = true;
    }
    return JSON.stringify(obj, null, 2);
  }

  // ── Parse JSON into form state ──
  function jsonToForm(json: string): boolean {
    try {
      const obj = JSON.parse(json);
      if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
        return false;
      }
      modTable = typeof obj.ModTable === "string" ? obj.ModTable : DEFAULTS.ModTable;
      requiredVersion = typeof obj.RequiredVersion === "number" && Number.isInteger(obj.RequiredVersion) && obj.RequiredVersion >= 1
        ? obj.RequiredVersion
        : DEFAULTS.RequiredVersion;
      featureFlags = Array.isArray(obj.FeatureFlags)
        ? obj.FeatureFlags.filter((f: unknown): f is string => typeof f === "string" && FEATURE_FLAG_OPTIONS.includes(f as typeof FEATURE_FLAG_OPTIONS[number]))
        : [...DEFAULTS.FeatureFlags];
      preload = typeof obj.Preload === "boolean" ? obj.Preload : DEFAULTS.Preload;
      modTableTouched = modTable !== "";
      return true;
    } catch {
      return false;
    }
  }

  // ── Load content on mount / filePath change ──
  $effect(() => {
    const path = filePath;
    const modPath = modStore.selectedModPath;
    if (!path || !modPath) {
      error = "No mod folder selected";
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
          // Unparseable — start in raw mode
          rawMode = true;
          parseError = m.se_config_invalid_json();
        }
      } else {
        // New file — use defaults
        modTable = DEFAULTS.ModTable;
        requiredVersion = DEFAULTS.RequiredVersion;
        featureFlags = [...DEFAULTS.FeatureFlags];
        preload = DEFAULTS.Preload;
        modTableTouched = false;
        rawContent = formToJson();
      }
      isLoading = false;
    }).catch(err => {
      error = String(err?.message ?? err);
      isLoading = false;
    });
  });

  // ── Save form to disk ──
  async function saveForm() {
    const modPath = modStore.selectedModPath;
    if (!modPath) return;
    const json = rawMode ? rawContent : formToJson();
    try {
      await scriptWrite(modPath, filePath, json);
      rawContent = json;
      const tab = uiStore.openTabs.find(t => t.id === `script:${filePath}`);
      if (tab) tab.dirty = false;
      toastStore.success(m.script_editor_saved_title(), m.script_editor_saved_message());
    } catch (err) {
      toastStore.error(m.script_editor_save_failed_title(), String(err));
    }
  }

  // ── Toggle between raw and form mode ──
  function toggleMode() {
    if (rawMode) {
      // Switching from raw → form: parse rawContent
      if (jsonToForm(rawContent)) {
        parseError = null;
        rawMode = false;
      } else {
        parseError = m.se_config_invalid_json();
      }
    } else {
      // Switching from form → raw: serialize form to JSON
      rawContent = formToJson();
      parseError = null;
      rawMode = true;
    }
  }

  // ── Handle feature flag toggle ──
  function toggleFlag(flag: string) {
    if (featureFlags.includes(flag)) {
      featureFlags = featureFlags.filter(f => f !== flag);
    } else {
      featureFlags = [...featureFlags, flag];
    }
  }

  // ── Auto-save on form change (debounced via effect) ──
  let saveTimeout: ReturnType<typeof setTimeout> | undefined;

  function scheduleAutoSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      saveForm();
    }, 500);
  }

  // ── Mark tab dirty on form edits ──
  function markDirty() {
    const tab = uiStore.openTabs.find(t => t.id === `script:${filePath}`);
    if (tab && !tab.dirty) tab.dirty = true;
    scheduleAutoSave();
  }
</script>

<div class="se-config-editor">
  {#if isLoading}
    <div class="editor-empty">
      <Loader2 size={24} class="text-[var(--th-text-600)] animate-spin" />
      <p class="text-xs text-[var(--th-text-500)] mt-2">{m.common_loading()}</p>
    </div>
  {:else if error}
    <div class="editor-empty">
      <AlertCircle size={24} class="text-red-400" />
      <p class="text-xs text-red-300 mt-2">{m.script_editor_load_failed()}</p>
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
            {m.se_config_form_mode()}
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
          <button
            class="save-btn"
            onclick={saveForm}
            aria-label={m.common_save()}
          >
            <Save size={12} />
            {m.common_save()}
          </button>
      </div>
    </div>

    {#if rawMode}
      <!-- Raw JSON editing via ScriptEditorPanel -->
      <div class="flex-1 min-h-0">
        <ScriptEditorPanel {filePath} language="json" />
      </div>
    {:else}
      <!-- Structured form -->
      <div class="form-body">
        <!-- ModTable -->
        <div class="form-field">
          <label for="se-mod-table" class="form-label">{m.se_config_mod_table()}</label>
          <input
            id="se-mod-table"
            type="text"
            class="form-input"
            class:invalid={modTableTouched && !modTableValid}
            value={modTable}
            oninput={(e) => { modTable = e.currentTarget.value; modTableTouched = true; markDirty(); }}
            placeholder="MyAwesomeMod"
            aria-describedby="se-mod-table-hint"
            aria-invalid={modTableTouched && !modTableValid}
            required
          />
          <p id="se-mod-table-hint" class="form-hint">{m.se_config_mod_table_hint()}</p>
          {#if modTableTouched && !modTableValid}
            <p class="form-error" role="alert">{m.se_config_mod_table_invalid()}</p>
          {/if}
        </div>

        <!-- RequiredVersion -->
        <div class="form-field">
          <label for="se-required-version" class="form-label">{m.se_config_required_version()}</label>
          <input
            id="se-required-version"
            type="number"
            class="form-input"
            value={requiredVersion}
            oninput={(e) => { const v = parseInt(e.currentTarget.value, 10); if (!isNaN(v) && v >= 1) { requiredVersion = v; markDirty(); } }}
            min="1"
            step="1"
            required
          />
        </div>

        <!-- FeatureFlags -->
        <fieldset class="form-field">
          <legend class="form-label">{m.se_config_feature_flags()}</legend>
          <div class="checkbox-group">
            {#each FEATURE_FLAG_OPTIONS as flag}
              <label class="checkbox-item">
                <input
                  type="checkbox"
                  checked={featureFlags.includes(flag)}
                  onchange={() => { toggleFlag(flag); markDirty(); }}
                />
                <span>{flag}</span>
              </label>
            {/each}
          </div>
        </fieldset>

        <!-- Preload -->
        <div class="form-field">
          <label class="checkbox-item">
            <input
              type="checkbox"
              checked={preload}
              onchange={() => { preload = !preload; markDirty(); }}
            />
            <span class="form-label" style="margin-bottom: 0;">{m.se_config_preload()}</span>
          </label>
          <p class="form-hint">{m.se_config_preload_hint()}</p>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .se-config-editor {
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
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    max-width: 560px;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    border: none;
    padding: 0;
    margin: 0;
  }

  .form-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--th-text-primary, var(--th-text-200));
    margin-bottom: 2px;
  }

  .form-input {
    padding: 6px 10px;
    font-size: 13px;
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

  .form-input.invalid {
    border-color: #f87171;
  }

  .form-input[type="number"] {
    max-width: 160px;
  }

  .form-hint {
    font-size: 11px;
    color: var(--th-text-secondary, var(--th-text-500));
    margin: 0;
  }

  .form-error {
    font-size: 11px;
    color: #f87171;
    margin: 0;
  }

  .checkbox-group {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
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
</style>
