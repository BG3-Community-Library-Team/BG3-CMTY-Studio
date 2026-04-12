<!--
  Display & Preferences — merged section (includes Notifications).
-->
<script lang="ts">
  import { m } from "../../paraglide/messages.js";
  import { settingsStore } from "../../lib/stores/settingsStore.svelte.js";
  import SettingsToggle from "./SettingsToggle.svelte";
  import SettingsPanel from "./SettingsPanel.svelte";
</script>

<h3 class="settings-section-title">{m.settings_display_title()}</h3>

<div class="space-y-4">

  <!-- Zoom + inline auto-hide toggle -->
  <div>
    <p class="field-label">{m.settings_display_zoom_heading()}</p>
    <p class="field-desc">{m.settings_display_zoom_instruction()}</p>
    <div class="zoom-controls">
      <button class="zoom-btn" onclick={() => settingsStore.zoomOut()} disabled={settingsStore.zoomLevel <= 50}>&#8722;</button>
      <span class="text-xs text-[var(--th-text-200)] min-w-[40px] text-center font-mono">{settingsStore.zoomLevel}%</span>
      <button class="zoom-btn" onclick={() => settingsStore.zoomIn()} disabled={settingsStore.zoomLevel >= 200}>+</button>
      <button class="px-2 py-1 text-xs rounded bg-[var(--th-bg-700)] hover:bg-[var(--th-bg-600)] text-[var(--th-text-400)] transition-colors disabled:opacity-40"
        onclick={() => settingsStore.zoomReset()} disabled={settingsStore.zoomLevel === 100}>{m.common_reset()}</button>
      <span class="zoom-divider" aria-hidden="true"></span>
      <SettingsToggle
        compact
        label={m.settings_display_auto_hide_tab_label()}
        checked={settingsStore.autoHideTabBar}
        onchange={(v) => { settingsStore.autoHideTabBar = v; settingsStore.persist(); }}
      />
    </div>
  </div>

  <!-- Motion + Combobox Display side by side -->
  <div class="panels-row">
    <SettingsPanel title={m.settings_display_motion_heading()}>
      {#each [
        { value: "system", label: m.settings_display_motion_system_label(), desc: m.settings_display_motion_system_desc() },
        { value: "on", label: m.settings_display_motion_on_label(), desc: m.settings_display_motion_on_desc() },
        { value: "off", label: m.settings_display_motion_off_label(), desc: m.settings_display_motion_off_desc() },
      ] as opt}
        <label class="motion-option">
          <input type="radio" name="settings-reduced-motion" class="w-3.5 h-3.5 accent-[var(--th-accent-500,#0ea5e9)] cursor-pointer flex-shrink-0"
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
    </SettingsPanel>

    <SettingsPanel title={m.settings_display_combobox_heading()}>
      <SettingsToggle
        label={m.settings_display_show_names_label()}
        description={m.settings_display_show_names_desc()}
        checked={settingsStore.showComboboxNames}
        onchange={(v) => { settingsStore.showComboboxNames = v; settingsStore.persist(); }}
      />
      <SettingsToggle
        label={m.settings_display_show_prefix_label()}
        description={m.settings_display_show_prefix_desc()}
        checked={settingsStore.showModNamePrefix}
        onchange={(v) => { settingsStore.showModNamePrefix = v; settingsStore.persist(); }}
      />
    </SettingsPanel>
  </div>

  <!-- Notifications (merged) -->
  <SettingsPanel title={m.settings_notifications_title()}>
    <div class="notif-grid">
      <div>
        <span class="field-label">{m.settings_notifications_success_label()}</span>
        <div class="space-y-0.5 mt-1">
          {#each [
            { value: 2000, label: m.settings_notifications_success_2s() },
            { value: 3000, label: m.settings_notifications_success_3s() },
            { value: 5000, label: m.settings_notifications_success_5s() },
            { value: 8000, label: m.settings_notifications_success_8s() },
            { value: 0, label: m.settings_notifications_no_dismiss() },
          ] as opt}
            <label class="flex items-center gap-2 cursor-pointer rounded px-2 py-1 -mx-2 hover:bg-[var(--th-bg-700)]/60 transition-colors">
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
        <span class="field-label">{m.settings_notifications_error_label()}</span>
        <div class="space-y-0.5 mt-1">
          {#each [
            { value: 5000, label: m.settings_notifications_error_5s() },
            { value: 8000, label: m.settings_notifications_error_8s() },
            { value: 15000, label: m.settings_notifications_error_15s() },
            { value: 0, label: m.settings_notifications_no_dismiss() },
          ] as opt}
            <label class="flex items-center gap-2 cursor-pointer rounded px-2 py-1 -mx-2 hover:bg-[var(--th-bg-700)]/60 transition-colors">
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
  </SettingsPanel>

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
  }
  .zoom-btn {
    padding: 0.25rem 0.5rem;
    font-size: 0.875rem;
    border-radius: 0.25rem;
    background: var(--th-bg-700);
    color: var(--th-text-200);
    border: none;
    cursor: pointer;
    transition: background-color 0.15s;
  }
  .zoom-btn:hover:not(:disabled) {
    background: var(--th-bg-600);
  }
  .zoom-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .zoom-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-top: 0.25rem;
  }
  .zoom-divider {
    display: inline-block;
    width: 1px;
    height: 1rem;
    background: var(--th-border-700);
    margin: 0 0.25rem;
    flex-shrink: 0;
  }
  .panels-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    align-items: start;
  }
  .motion-option {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    cursor: pointer;
    border-radius: 0.25rem;
    padding: 0.25rem;
    margin: 0 -0.25rem;
    transition: background-color 0.15s;
  }
  .motion-option:hover {
    background: color-mix(in srgb, var(--th-bg-700) 60%, transparent);
  }
  .notif-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem 1.5rem;
    padding: 0.25rem 0;
  }
</style>
