<script lang="ts">
  import { uiStore } from "../lib/stores/uiStore.svelte.js";
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import { projectStore, sectionToTable, sectionHasNewEntries } from "../lib/stores/projectStore.svelte.js";
  import type { SectionResult, Section, DiffEntry } from "../lib/types/index.js";
  import type { ScriptLanguage } from "../lib/utils/syntaxHighlight.js";
  import { SECTIONS_ORDERED } from "../lib/types/index.js";
  import { BG3_CORE_FOLDERS, type FolderNode } from "../lib/data/bg3FolderStructure.js";
  import { settingsStore } from "../lib/stores/settingsStore.svelte.js";
  import SectionPanel from "./SectionPanel.svelte";
  import MetaLsxForm from "./MetaLsxForm.svelte";
  import LocalizationPanel from "./LocalizationPanel.svelte";
  import FilePreviewPanel from "./FilePreviewPanel.svelte";
  import ScriptEditorPanel from "./ScriptEditorPanel.svelte";
  import ThemeGallery from "./dev/ThemeGallery.svelte";
  import SettingsContentPane from "./SettingsContentPane.svelte";
  import ThemePreview from "./ThemePreview.svelte";
  import ErrorBoundary from "./ErrorBoundary.svelte";
  import TabBar from "./TabBar.svelte";
  import Settings from "@lucide/svelte/icons/settings";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import FileCode from "@lucide/svelte/icons/file-code";
  import FolderPlus from "@lucide/svelte/icons/folder-plus";
  import FilePlus2 from "@lucide/svelte/icons/file-plus-2";
  import { open } from "@tauri-apps/plugin-dialog";
  import { scanAndImport } from "../lib/services/scanService.js";
  import { toastStore } from "../lib/stores/toastStore.svelte.js";
  import { createModScaffold } from "../lib/utils/tauri.js";
  import { getErrorMessage } from "../lib/types/index.js";
  import { m } from "../paraglide/messages.js";
  import { APP_VERSION } from "../lib/version.js";

  // ── Welcome page ──

  let showNewModForm = $state(false);
  let newModName = $state("");
  let newModAuthor = $state("");
  let newModDescription = $state("");
  let newModVersion = $state("1.0.0.0");
  let newModFolder = $state("");
  let newModUseSE = $state(false);
  let isCreatingMod = $state(false);

  function resetNewModForm() {
    showNewModForm = false;
    newModName = "";
    newModAuthor = "";
    newModDescription = "";
    newModVersion = "1.0.0.0";
    newModFolder = "";
    newModUseSE = false;
  }

  async function handleCreateMod() {
    if (!newModName.trim()) return;
    const selected = await open({ directory: true, title: m.create_mod_dialog_title() });
    if (selected == null) return;
    const targetDir = Array.isArray(selected) ? selected[0] : String(selected);
    isCreatingMod = true;
    try {
      const result = await createModScaffold(
        targetDir, newModName.trim(), newModAuthor.trim(), newModDescription.trim(), newModUseSE,
        newModFolder.trim(), newModVersion.trim(),
      );
      await scanAndImport(result.mod_root);
      resetNewModForm();
    } catch (e: unknown) {
      toastStore.error(m.create_mod_failed_title(), getErrorMessage(e));
    } finally {
      isCreatingMod = false;
    }
  }

  async function welcomeOpenProject() {
    try {
      const selected = await open({ directory: true, title: m.header_select_mod_folder() });
      if (selected == null) return;
      const p = Array.isArray(selected) ? selected[0] : String(selected);
      await scanAndImport(p);
    } catch (e) {
      console.error("Dialog error:", e);
    }
  }

  let activeTab = $derived(uiStore.activeTab);
  let sections = $derived(modStore.scanResult?.sections ?? []);

  /** Staging theme CSS overrides from SettingsContentPane (for live ThemePreview). */
  let themeStagingStyle = $state("");

  /**
   * Resolve the SectionResult for a tab with type "section".
   * Creates stub results when a mod is loaded so the Add Entry form is always available.
   */
  function getSectionResult(category: string): SectionResult | null {
    const sec = sections.find((s: SectionResult) => s.section === category);
    if (sec) return sec;

    // Check if there are manual entries for this section
    const hasManual = sectionHasNewEntries(category);
    if (hasManual) {
      return { section: category as Section, entries: [] };
    }

    // Check diff override sections
    const overrides = modStore.diffOverrideSections;
    if (overrides) {
      const overrideSec = overrides.find((s: SectionResult) => s.section === category);
      if (overrideSec) return overrideSec;
    }

    // When a mod is loaded, return a stub so the Add Entry button is available
    if (modStore.scanResult) {
      return { section: category as Section, entries: [] };
    }

    return null;
  }

  /**
   * Get a filtered SectionResult where entries match the given filter.
   * Matches against node_id first, then falls back to raw_attributes[field].
   */
  function getFilteredSectionResult(
    category: string,
    filter: { field: string; value: string },
  ): SectionResult | null {
    const base = getSectionResult(category);
    if (!base) return null;

    const filtered = base.entries.filter((e: DiffEntry) => {
      if (filter.field === "node_id") return e.node_id === filter.value;
      if (filter.field === "region_id") return e.region_id === filter.value;
      return e.raw_attributes?.[filter.field] === filter.value;
    });

    return { section: base.section, entries: filtered };
  }

  /** Find a core folder node by its name (for group tab rendering). */
  function findGroupNode(name: string): FolderNode | undefined {
    function search(nodes: FolderNode[]): FolderNode | undefined {
      for (const node of nodes) {
        if (node.name === name) return node;
        if (node.children) {
          const found = search(node.children);
          if (found) return found;
        }
      }
    }
    return search(BG3_CORE_FOLDERS);
  }

  /** Get group children with resolved section results (uses entry filters from folder structure). */
  function getGroupChildren(groupName: string): { node: FolderNode; result: SectionResult | null }[] {
    const groupNode = findGroupNode(groupName);
    if (!groupNode?.children) return [];

    // Recursively flatten: nodes with children and entryFilter on children
    // get expanded to their children instead of themselves.
    function flattenChildren(nodes: FolderNode[]): FolderNode[] {
      const out: FolderNode[] = [];
      for (const child of nodes) {
        if (child.children && child.children.some(gc => gc.entryFilter)) {
          // Expand nested filter children (e.g., CC Presets → per-type panels)
          out.push(...flattenChildren(child.children));
        } else {
          out.push(child);
        }
      }
      return out;
    }

    return flattenChildren(groupNode.children)
      .filter(child => child.Section)
      .map(child => ({
        node: child,
        result: child.entryFilter
          ? getFilteredSectionResult(child.Section!, child.entryFilter)
          : getSectionResult(child.Section!),
      }));
  }

  /** Simple syntax highlighting for YAML/JSON config preview lines. */
  function highlightLine(line: string, format: string): string {
    // Escape HTML entities
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const escaped = esc(line);

    if (format === "Yaml") {
      // Comment lines
      if (/^\s*#/.test(line)) {
        return `<span class="hl-comment">${escaped}</span>`;
      }
      // Key: value lines
      const kvMatch = escaped.match(/^(\s*)([\w\-]+)(:)(.*)/);
      if (kvMatch) {
        const [, indent, key, colon, rest] = kvMatch;
        let valHtml = rest;
        // Highlight quoted strings in the value
        valHtml = valHtml.replace(/(&quot;[^&]*&quot;|"[^"]*")/g, '<span class="hl-string">$1</span>');
        // Highlight booleans/numbers in the value
        valHtml = valHtml.replace(/\b(true|false)\b/gi, '<span class="hl-bool">$1</span>');
        return `${indent}<span class="hl-key">${key}</span><span class="hl-punct">${colon}</span>${valHtml}`;
      }
      // List items
      const listMatch = escaped.match(/^(\s*)(- )(.*)/);
      if (listMatch) {
        const [, indent, dash, val] = listMatch;
        let valHtml = val.replace(/(&quot;[^&]*&quot;|"[^"]*")/g, '<span class="hl-string">$1</span>');
        return `${indent}<span class="hl-punct">${dash}</span>${valHtml}`;
      }
      return escaped;
    }

    // JSON
    let result = escaped;
    // Keys
    result = result.replace(/(&quot;[^&]*?&quot;|"[^"]*?")(\s*:)/g, '<span class="hl-key">$1</span><span class="hl-punct">$2</span>');
    // Remaining strings (values)
    result = result.replace(/(?<!<span class="hl-key">)(&quot;[^&]*?&quot;|"[^"]*?")/g, '<span class="hl-string">$1</span>');
    // Booleans/null
    result = result.replace(/\b(true|false|null)\b/g, '<span class="hl-bool">$1</span>');
    // Numbers
    result = result.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="hl-num">$1</span>');
    // Braces/brackets
    result = result.replace(/([{}\[\]])/g, '<span class="hl-punct">$1</span>');
    return result;
  }
</script>

<div class="editor-area">
  <div class="tab-bar-wrapper" class:auto-hide={settingsStore.autoHideTabBar}>
    <TabBar />
  </div>

  <div class="editor-content">
    {#if !activeTab || activeTab.type === "welcome"}
      <!-- Welcome / Getting Started -->
      <div class="welcome-view">
        {#if showNewModForm && !modStore.scanResult}
          <!-- Full-page New Project flow -->
          <div class="w-full max-w-lg mx-auto py-8 px-4">
            <button
              class="flex items-center gap-1 text-xs text-[var(--th-text-400)] hover:text-[var(--th-text-200)] mb-6 transition-colors"
              onclick={resetNewModForm}
            >
              ← {m.common_back()}
            </button>

            <h2 class="text-lg font-semibold text-[var(--th-text-100)] mb-1">{m.create_mod_title()}</h2>
            <p class="text-xs text-[var(--th-text-500)] mb-6">{m.create_mod_subtitle()}</p>

            <div class="space-y-4">
              <label class="flex flex-col gap-1 text-xs">
                <span class="text-[var(--th-text-400)] font-medium">{m.create_mod_name_label()} <span class="text-red-400">{m.create_mod_name_required()}</span></span>
                <input
                  type="text"
                  class="bg-[var(--th-input-bg)] border border-[var(--th-input-border)] rounded px-3 py-2 text-sm text-[var(--th-input-text)] focus:border-[var(--th-focus-ring,#0ea5e9)]"
                  bind:value={newModName}
                  placeholder={m.create_mod_name_placeholder()}
                />
              </label>

              <div class="grid grid-cols-2 gap-4">
                <label class="flex flex-col gap-1 text-xs">
                  <span class="text-[var(--th-text-400)] font-medium">{m.create_mod_author_label()}</span>
                  <input
                    type="text"
                    class="bg-[var(--th-input-bg)] border border-[var(--th-input-border)] rounded px-3 py-2 text-sm text-[var(--th-input-text)] focus:border-[var(--th-focus-ring,#0ea5e9)]"
                    bind:value={newModAuthor}
                    placeholder={m.create_mod_author_placeholder()}
                  />
                </label>
                <label class="flex flex-col gap-1 text-xs">
                  <span class="text-[var(--th-text-400)] font-medium">{m.create_mod_version_label()}</span>
                  <input
                    type="text"
                    class="bg-[var(--th-input-bg)] border border-[var(--th-input-border)] rounded px-3 py-2 text-sm text-[var(--th-input-text)] focus:border-[var(--th-focus-ring,#0ea5e9)]"
                    bind:value={newModVersion}
                    placeholder={m.create_mod_version_placeholder()}
                  />
                </label>
              </div>

              <label class="flex flex-col gap-1 text-xs">
                <span class="text-[var(--th-text-400)] font-medium">{m.create_mod_folder_label()} <span class="text-[var(--th-text-600)]">{m.create_mod_folder_hint()}</span></span>
                <input
                  type="text"
                  class="bg-[var(--th-input-bg)] border border-[var(--th-input-border)] rounded px-3 py-2 text-sm text-[var(--th-input-text)] focus:border-[var(--th-focus-ring,#0ea5e9)]"
                  bind:value={newModFolder}
                  placeholder={newModName.trim() || m.create_mod_folder_placeholder()}
                />
              </label>

              <label class="flex flex-col gap-1 text-xs">
                <span class="text-[var(--th-text-400)] font-medium">{m.create_mod_description_label()}</span>
                <textarea
                  class="bg-[var(--th-input-bg)] border border-[var(--th-input-border)] rounded px-3 py-2 text-sm text-[var(--th-input-text)] focus:border-[var(--th-focus-ring,#0ea5e9)] resize-y min-h-[64px]"
                  bind:value={newModDescription}
                  rows="3"
                  placeholder={m.create_mod_description_placeholder()}
                ></textarea>
              </label>

              <label class="flex items-center gap-2 text-xs text-[var(--th-text-300)] cursor-pointer">
                <input type="checkbox" class="accent-[var(--th-accent-500)]" bind:checked={newModUseSE} />
                {m.create_mod_script_extender_checkbox()}
              </label>

              <div class="flex justify-end gap-3 pt-2 border-t border-[var(--th-border-700)]">
                <button
                  class="px-4 py-2 text-xs rounded text-[var(--th-text-400)] hover:text-[var(--th-text-200)] hover:bg-[var(--th-bg-700)] transition-colors"
                  onclick={resetNewModForm}
                >{m.common_cancel()}</button>
                <button
                  class="px-5 py-2 text-xs rounded font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  onclick={handleCreateMod}
                  disabled={isCreatingMod || !newModName.trim()}
                >{isCreatingMod ? m.create_mod_button_creating() : m.create_mod_button_create()}</button>
              </div>
            </div>
          </div>
        {:else}
        <div class="welcome-card">
          <h1 class="text-lg font-semibold text-[var(--th-text-100)] mb-1">{m.welcome_app_title()}</h1>
          <p class="text-xs text-[var(--th-text-500)] mb-6">{m.welcome_app_subtitle()}</p>

          {#if modStore.isScanning}
            <!-- Scanning in progress — buttons hidden -->
          {:else if modStore.scanResult}
            <div class="mb-6 p-3 rounded-md bg-[var(--th-bg-700)]/50 border border-[var(--th-border-700)]">
              <p class="text-sm text-[var(--th-text-200)] font-medium">{modStore.scanResult.mod_meta.name}</p>
              <p class="text-xs text-[var(--th-text-500)] mt-1">by {modStore.scanResult.mod_meta.author}</p>
              <p class="text-xs text-[var(--th-text-500)] mt-0.5">{sections.length} sections · {sections.reduce((n: number, s: SectionResult) => n + s.entries.length, 0)} entries detected</p>
            </div>
            <p class="text-xs text-[var(--th-text-500)]">{m.welcome_select_section()}</p>
          {:else}
            <!-- Action Buttons -->
            <div class="flex flex-col gap-3 w-full max-w-[280px] mx-auto mb-6">
              <button
                class="flex items-center gap-2.5 w-full px-4 py-3 rounded-lg text-left
                       bg-[var(--th-bg-700)]/60 border border-[var(--th-border-700)]
                       hover:bg-[var(--th-bg-600)]/80 hover:border-[var(--th-border-600)] transition-colors"
                onclick={welcomeOpenProject}
              >
                <FolderOpen size={18} class="text-[var(--th-accent-500,#0ea5e9)] shrink-0" />
                <div>
                  <div class="text-xs font-medium text-[var(--th-text-200)]">{m.command_label_open_project()}</div>
                  <div class="text-[10px] text-[var(--th-text-500)] mt-0.5">{m.welcome_open_desc()}</div>
                </div>
              </button>

              <button
                class="flex items-center gap-2.5 w-full px-4 py-3 rounded-lg text-left
                       bg-[var(--th-bg-700)]/60 border border-[var(--th-border-700)]
                       hover:bg-[var(--th-bg-600)]/80 hover:border-[var(--th-border-600)] transition-colors"
                onclick={() => showNewModForm = true}
              >
                <FilePlus2 size={18} class="text-emerald-400 shrink-0" />
                <div>
                  <div class="text-xs font-medium text-[var(--th-text-200)]">{m.command_label_new_project()}</div>
                  <div class="text-[10px] text-[var(--th-text-500)] mt-0.5">{m.welcome_new_desc()}</div>
                </div>
              </button>
            </div>

            <p class="text-[10px] text-[var(--th-text-600)] mt-4">v{APP_VERSION}</p>
          {/if}
        </div>
        {/if}
      </div>

    {:else if activeTab.type === "group"}
      <!-- Group tab: multiple sections, with per-child entry filters -->
      {@const groupChildren = getGroupChildren(activeTab.category ?? "")}
      {@const fallbackSections = activeTab.groupSections ?? []}
      <div class="section-tab-content">
        {#if groupChildren.length > 0}
          {#each groupChildren as { node, result } (node.name)}
            {#if result}
              <div class="group-section">
                <SectionPanel sectionResult={result} globalFilter={modStore.globalFilter} displayLabel={node.label} entryFilter={node.entryFilter} regionId={node.regionId} />
              </div>
            {/if}
          {/each}
          {#if groupChildren.every(({ result }) => !result)}
            <div class="empty-tab">
              <FolderOpen size={32} class="text-[var(--th-text-600)] opacity-30" />
              <p class="text-sm text-[var(--th-text-500)] mt-2">No entries found for this group.</p>
              <p class="text-xs text-[var(--th-text-600)]">Scan a mod to populate entries, or add manual entries.</p>
            </div>
          {/if}
        {:else}
          <!-- Fallback: use groupSections without filters (groups without folder structure children) -->
          {#each fallbackSections as sectionName (sectionName)}
            {@const sectionResult = getSectionResult(sectionName)}
            {#if sectionResult}
              <div class="group-section">
                <SectionPanel {sectionResult} globalFilter={modStore.globalFilter} />
              </div>
            {/if}
          {/each}
          {#if fallbackSections.every(s => !getSectionResult(s))}
            <div class="empty-tab">
              <FolderOpen size={32} class="text-[var(--th-text-600)] opacity-30" />
              <p class="text-sm text-[var(--th-text-500)] mt-2">No entries found for this group.</p>
              <p class="text-xs text-[var(--th-text-600)]">Scan a mod to populate entries, or add manual entries.</p>
            </div>
          {/if}
        {/if}
      </div>

    {:else if activeTab.type === "filteredSection"}
      <!-- Filtered section: shows only entries matching a filter -->
      {@const filteredResult = getFilteredSectionResult(activeTab.category ?? "", activeTab.entryFilter ?? { field: "", value: "" })}
      {#if filteredResult}
        <div class="section-tab-content">
          <SectionPanel sectionResult={filteredResult} globalFilter={modStore.globalFilter} displayLabel={activeTab.label} entryFilter={activeTab.entryFilter} />
        </div>
      {:else}
        <div class="empty-tab">
          <FolderOpen size={32} class="text-[var(--th-text-600)] opacity-30" />
          <p class="text-sm text-[var(--th-text-500)] mt-2">No {activeTab.label} entries found.</p>
          <p class="text-xs text-[var(--th-text-600)]">Scan a mod to populate entries, or add manual entries.</p>
        </div>
      {/if}

    {:else if activeTab.type === "section"}
      <!-- Section editor tab -->
      {@const sectionResult = getSectionResult(activeTab.category ?? "")}
      {#if sectionResult}
        <div class="section-tab-content">
          <SectionPanel {sectionResult} globalFilter={modStore.globalFilter} />
        </div>
      {:else}
        <div class="empty-tab">
          <FolderOpen size={32} class="text-[var(--th-text-600)] opacity-30" />
          <p class="text-sm text-[var(--th-text-500)] mt-2">No entries found for this section.</p>
          <p class="text-xs text-[var(--th-text-600)]">Scan a mod to populate entries, or add manual entries.</p>
        </div>
      {/if}

    {:else if activeTab.type === "meta-lsx"}
      <!-- Meta.lsx form -->
      <MetaLsxForm />

    {:else if activeTab.type === "lsx-file"}
      <!-- Additional Data / non-CF LSX folder editor -->
      {@const lsxCategory = activeTab.category ?? ""}
      {@const lsxResult = getSectionResult(lsxCategory) ?? { section: lsxCategory as Section, entries: [] }}
      <div class="section-tab-content">
        <SectionPanel sectionResult={lsxResult} globalFilter={modStore.globalFilter} />
      </div>

    {:else if activeTab.type === "localization"}
      <LocalizationPanel />

    {:else if activeTab.type === "settings"}
      <div class="flex flex-1 min-h-0 h-full">
        <div class="flex-1 overflow-y-auto scrollbar-thin">
          <ErrorBoundary name="Settings Content">
            <SettingsContentPane bind:stagingOverrideStyle={themeStagingStyle} />
          </ErrorBoundary>
        </div>
        {#if uiStore.settingsSection === "theme"}
          <div class="w-80 border-l border-[var(--th-border-700)] overflow-y-auto scrollbar-thin shrink-0">
            <ThemePreview overrideStyle={themeStagingStyle} />
          </div>
        {/if}
      </div>

    {:else if activeTab.type === "file-preview"}
      {#if activeTab.filePath}
        <FilePreviewPanel filePath={activeTab.filePath} />
      {/if}
    {:else if activeTab.type === "script-editor"}
      {#if activeTab.filePath}
        <ScriptEditorPanel
          filePath={activeTab.filePath}
          language={(activeTab.language ?? "lua") as ScriptLanguage}
          readonly={false}
        />
      {/if}
    {:else if import.meta.env.DEV && activeTab.type === "theme-gallery"}
      <ThemeGallery onclose={() => uiStore.closeTab("theme-gallery")} />
    {/if}
  </div>
</div>

<style>
  .editor-area {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .tab-bar-wrapper {
    position: relative;
    z-index: 10;
  }

  .tab-bar-wrapper.auto-hide {
    max-height: 4px;
    overflow: hidden;
    transition: max-height 200ms ease;
  }

  .tab-bar-wrapper.auto-hide:hover,
  .tab-bar-wrapper.auto-hide:focus-within {
    max-height: 40px;
    overflow: visible;
  }

  .editor-content {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }

  .welcome-view {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 2rem;
  }

  .welcome-card {
    max-width: 360px;
    text-align: center;
  }

  .section-tab-content {
    padding: 1rem 1rem 1rem 0.5rem;
  }

  .group-section {
    margin-bottom: 1rem;
  }

  .group-section:last-child {
    margin-bottom: 0;
  }

  .empty-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    padding: 2rem;
  }

  /* Config preview syntax highlighting */
  :global(.config-preview-code) {
    margin: 0;
    padding: 0.75rem 1rem;
    font-family: "Cascadia Code", "Fira Code", "JetBrains Mono", monospace;
    font-size: 12px;
    line-height: 1.3;
    color: var(--th-text-300);
    background: transparent;
    tab-size: 2;
    white-space: pre;
  }
  :global(.line-number) {
    display: inline-block;
    color: var(--th-text-700, #444);
    user-select: none;
    text-align: right;
    min-width: 2.5em;
  }
  :global(.hl-key) { color: #7dcfff; }
  :global(.hl-string) { color: #a9dc76; }
  :global(.hl-comment) { color: #6a6a7a; font-style: italic; }
  :global(.hl-bool) { color: #ff9e64; }
  :global(.hl-num) { color: #ff9e64; }
  :global(.hl-punct) { color: #89929b; }
</style>
