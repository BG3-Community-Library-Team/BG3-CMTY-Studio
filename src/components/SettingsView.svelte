<!--
  Settings View — Sidebar navigation for the settings activity view.
  Content is rendered in SettingsContentPane (main content area).
-->
<script lang="ts">
  import { m } from "../paraglide/messages.js";
  import { uiStore, type SettingsSection } from "../lib/stores/uiStore.svelte.js";

  const navSections: { id: SettingsSection; label: () => string }[] = [
    { id: "theme", label: () => m.settings_nav_theme() },
    { id: "display", label: () => m.settings_nav_display() },
    { id: "editor", label: () => m.settings_editor_title() },
    { id: "modConfig", label: () => m.settings_nav_mod_config() },
    { id: "schemas", label: () => m.settings_nav_schemas() },
    { id: "notifications", label: () => m.settings_nav_notifications() },
    { id: "scripts", label: () => m.settings_nav_scripts() },
    { id: "git", label: () => m.settings_nav_git() },
    { id: "publishing", label: () => m.settings_nav_publishing() },
  ];
  function selectSection(id: SettingsSection) {
    uiStore.settingsSection = id;
    uiStore.openTab({ id: "settings", label: m.settings_heading(), type: "settings", icon: "⚙" });
  }
</script>

<div class="settings-layout">
  <h3 class="px-4 py-2 text-xs font-bold text-[var(--th-text-400)] uppercase tracking-wider">{m.settings_heading()}</h3>

  <nav class="settings-nav scrollbar-thin" aria-label="Settings categories">
    {#each navSections as s}
      <button
        class="settings-node"
        class:active={uiStore.settingsSection === s.id}
        onclick={() => selectSection(s.id)}
        aria-current={uiStore.settingsSection === s.id ? "page" : undefined}
      >{s.label()}</button>
    {/each}
  </nav>
</div>

<style>
  .settings-layout {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }
  .settings-nav {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 6px 0;
    flex-shrink: 0;
    overflow-y: auto;
  }
  .settings-node {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.35rem 0.75rem;
    font-size: 0.7rem;
    color: var(--th-sidebar-text-muted, var(--th-text-400));
    background: transparent;
    border: none;
    border-left: 2px solid transparent;
    cursor: pointer;
    transition: color 0.15s, background-color 0.15s;
    text-align: left;
    white-space: nowrap;
  }
  .settings-node:hover {
    color: var(--th-sidebar-text, var(--th-text-200));
    background: var(--th-sidebar-highlight, var(--th-bg-800));
  }
  .settings-node.active {
    color: var(--th-sidebar-text, var(--th-text-100));
    border-left-color: var(--th-accent-500, #0ea5e9);
    background: var(--th-sidebar-highlight, var(--th-bg-800));
  }
</style>
