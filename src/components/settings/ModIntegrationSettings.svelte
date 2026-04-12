<!--
  Mod Integration — merged section (includes Configuration Schemas).
-->
<script lang="ts">
  import { m } from "../../paraglide/messages.js";
  import { settingsStore } from "../../lib/stores/settingsStore.svelte.js";
  import { projectSettingsStore } from "../../lib/stores/projectSettingsStore.svelte.js";
  import SettingsToggle from "./SettingsToggle.svelte";
  import SettingsPanel from "./SettingsPanel.svelte";

  const MCM_SCHEMA_DEFAULT_URL = "https://raw.githubusercontent.com/AtilioA/BG3-MCM/refs/heads/main/.vscode/schema.json";

  function resetMcmSchemaUrl() {
    settingsStore.mcmSchemaUrl = MCM_SCHEMA_DEFAULT_URL;
    settingsStore.persist();
  }
</script>

<h3 class="settings-section-title">{m.settings_mod_config_title()}</h3>

<div class="flex flex-col gap-4">

  <!-- Integration toggles -->
  <SettingsPanel title={m.settings_mod_config_title()} columns={2}>
    <SettingsToggle
      label={m.settings_mod_config_cf_label()}
      description={m.settings_mod_config_cf_desc()}
      checked={settingsStore.enableCfIntegration}
      onchange={(v) => { settingsStore.enableCfIntegration = v; settingsStore.persist(); }}
    />
    <SettingsToggle
      label={m.settings_mod_config_mcm_label()}
      description={m.settings_mod_config_mcm_desc()}
      checked={settingsStore.enableMcmSupport}
      onchange={(v) => { settingsStore.enableMcmSupport = v; settingsStore.persist(); }}
    />
    <SettingsToggle
      label={m.settings_mod_config_mazzle_label()}
      description={m.settings_mod_config_mazzle_desc()}
      checked={settingsStore.enableMazzleDocsSupport}
      onchange={(v) => { settingsStore.enableMazzleDocsSupport = v; settingsStore.persist(); }}
    />
  </SettingsPanel>

  {#if settingsStore.enableMcmSupport}
  <!-- Schemas (merged) — only shown when MCM is enabled -->
  <SettingsPanel title={m.settings_schemas_title()}>
    <div class="schema-field">
      <p class="field-label">{m.settings_schemas_mcm_heading()}</p>
      <p class="field-desc">{m.settings_schemas_mcm_desc()}</p>
      <div class="flex items-center gap-2 mt-1">
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
  </SettingsPanel>
  {/if}

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
    margin: 0;
    line-height: 1.4;
  }
  .schema-field {
    padding: 0.25rem 0;
  }
</style>
