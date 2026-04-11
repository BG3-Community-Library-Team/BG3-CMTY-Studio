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
  import TextureAtlasPanel from "./TextureAtlasPanel.svelte";
  import MetaLsxForm from "./MetaLsxForm.svelte";
  import LocalizationPanel from "./LocalizationPanel.svelte";
  import FilePreviewPanel from "./FilePreviewPanel.svelte";
  import ScriptEditorPanel from "./ScriptEditorPanel.svelte";
  import SeConfigEditor from "./SeConfigEditor.svelte";
  import McmBlueprintEditor from "./McmBlueprintEditor.svelte";
  import LocalizationFileEditor from "./LocalizationFileEditor.svelte";
  import ReadmeEditor from "./ReadmeEditor.svelte";
  import GitDiffView from "./git/GitDiffView.svelte";
  import GitCommitDetailView from "./git/GitCommitDetailView.svelte";
  import ForgeIssueView from "./git/ForgeIssueView.svelte";
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
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import AlertTriangle from "@lucide/svelte/icons/alert-triangle";
  import Lightbulb from "@lucide/svelte/icons/lightbulb";
  import X from "@lucide/svelte/icons/x";
  import Save from "@lucide/svelte/icons/save";
  import { open } from "@tauri-apps/plugin-dialog";
  import { scanAndImport, openProject } from "../lib/services/scanService.js";
  import { toastStore } from "../lib/stores/toastStore.svelte.js";
  import { createModScaffold } from "../lib/utils/tauri.js";
  import { getErrorMessage } from "../lib/types/index.js";
  import { parseLsxContentToSections } from "../lib/utils/lsxRegionParser.js";
  import { scriptRead } from "../lib/tauri/scripts.js";
  import { readTextFile } from "../lib/tauri/readme.js";
  import { m } from "../paraglide/messages.js";
  import { APP_VERSION } from "../lib/version.js";

  // ── Welcome page ──

  let showNewModForm = $state(false);
  let folderHelpExpanded = $state(false);
  let newModName = $state("");
  let newModAuthor = $state("");
  let newModDescription = $state("");
  let newModVersion = $state("1.0.0.0");
  let newModFolder = $state("");
  let newModUseSE = $state(false);
  let isCreatingMod = $state(false);
  let lsxTabViewMode = $state<Record<string, "form" | "raw">>({});
  let lsxRawEditorRef: any = $state(undefined);

  /** Cache of parsed LSX file sections for File Tree form view, keyed by tab ID. */
  let fileParsedSections = $state<Record<string, SectionResult[]>>({});

  /** Load and parse an LSX file's sections for the form view. Returns from cache if available. */
  async function loadFileParsedSections(tabId: string, filePath: string): Promise<SectionResult[]> {
    if (fileParsedSections[tabId]) return fileParsedSections[tabId];
    const basePath = modStore.projectPath || modStore.selectedModPath;
    if (!basePath) {
      // Don't cache — basePath may become available later
      return [];
    }
    try {
      // Detect absolute paths (drive letter or UNC path on Windows, / on Unix)
      const isAbsolute = /^[A-Za-z]:[\\/]/.test(filePath) || filePath.startsWith("/") || filePath.startsWith("\\\\");

      let content: string | null = null;
      if (isAbsolute) {
        // File is already an absolute path — read directly
        content = await readTextFile(filePath);
      } else {
        content = await scriptRead(basePath, filePath);
        // Fallback: read via joined absolute path
        if (!content) {
          const abs = basePath.replace(/[\\/]$/, "") + "/" + filePath;
          content = await readTextFile(abs);
        }
      }
      if (!content) {
        // Don't cache — file may appear later or basePath may change
        console.warn("[loadFileParsedSections] No content for:", filePath);
        return [];
      }
      const parsed = parseLsxContentToSections(content);
      fileParsedSections = { ...fileParsedSections, [tabId]: parsed };
      return parsed;
    } catch (e) {
      // Don't cache errors — allow retry on next attempt
      console.warn("[loadFileParsedSections] Failed to load:", filePath, e);
      return [];
    }
  }

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
      await openProject(result.project_root);
      resetNewModForm();
    } catch (e: unknown) {
      toastStore.error(m.create_mod_failed_title(), getErrorMessage(e));
    } finally {
      isCreatingMod = false;
    }
  }

  async function welcomeOpenProject() {
    try {
      const selected = await open({ directory: true, title: m.app_select_project_folder() });
      if (selected == null) return;
      const p = Array.isArray(selected) ? selected[0] : String(selected);
      await openProject(p);
    } catch (e) {
      console.error("Dialog error:", e);
    }
  }

  function getLsxTabViewMode(tabId: string): "form" | "raw" {
    return lsxTabViewMode[tabId] ?? "form";
  }

  function setLsxTabViewMode(tabId: string, mode: "form" | "raw"): void {
    lsxTabViewMode = { ...lsxTabViewMode, [tabId]: mode };
  }

  // Clean up lsxTabViewMode and fileParsedSections entries when tabs are closed
  $effect(() => {
    const openIds = new Set(uiStore.openTabs.map(t => t.id));
    const staleKeys = Object.keys(lsxTabViewMode).filter(k => !openIds.has(k));
    const staleParsed = Object.keys(fileParsedSections).filter(k => !openIds.has(k));
    if (staleKeys.length > 0) {
      const next = { ...lsxTabViewMode };
      for (const k of staleKeys) delete next[k];
      lsxTabViewMode = next;
    }
    if (staleParsed.length > 0) {
      const next = { ...fileParsedSections };
      for (const k of staleParsed) delete next[k];
      fileParsedSections = next;
    }
  });

  let activeTab = $derived(uiStore.activeTab);
  let sections = $derived(modStore.scanResult?.sections ?? []);

  /** Staging theme CSS overrides from SettingsContentPane (for live ThemePreview). */
  let themeStagingStyle = $state("");

  // Eagerly load file-parsed sections when a lsx-file tab is in form view
  $effect(() => {
    const tab = activeTab;
    if (!tab || tab.type !== "lsx-file" || !tab.filePath) return;
    const mode = getLsxTabViewMode(tab.id);
    if (mode !== "form") return;
    if (fileParsedSections[tab.id]) return;
    // Track basePath so the effect re-runs when a project is loaded
    const _basePath = modStore.projectPath || modStore.selectedModPath;
    if (!_basePath) return;
    loadFileParsedSections(tab.id, tab.filePath);
  });

  /**
   * Resolve the SectionResult for a File Tree lsx-file tab.
   * Uses file-parsed sections (from parsing the actual file content) if available,
   * otherwise falls back to the scan result.
   */
  function getFileSectionResult(tabId: string, sectionName: string): SectionResult | null {
    const parsed = fileParsedSections[tabId];
    if (parsed) {
      const sec = parsed.find(s => s.section === sectionName);
      if (sec) return sec;
    }
    // Fall back to scan result filtered by source
    return getSectionResult(sectionName);
  }

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
                  <div class="text-xs font-medium text-[var(--th-text-200)]">{m.welcome_open_title()}</div>
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
                  <div class="text-xs font-medium text-[var(--th-text-200)]">{m.welcome_new_title()}</div>
                  <div class="text-[10px] text-[var(--th-text-500)] mt-0.5">{m.welcome_new_desc()}</div>
                </div>
              </button>
            </div>

            <p class="text-[10px] text-[var(--th-text-600)] mt-4">v{APP_VERSION}</p>

            <!-- No mods found alert -->
            {#if uiStore.noModsFound}
              <div class="w-full max-w-[320px] mx-auto mt-4 p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-left" role="alert">
                <div class="flex items-start gap-2">
                  <AlertTriangle size={16} class="text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <div class="flex-1 min-w-0">
                    <p class="text-xs font-medium text-[var(--th-text-200)]">{m.welcome_no_mods_title()}</p>
                    <p class="text-[11px] text-[var(--th-text-400)] mt-1">{m.welcome_no_mods_body()}</p>
                    <p class="text-[11px] text-[var(--th-text-300)] mt-1.5 font-medium">{m.welcome_no_mods_hint()}</p>
                    <div class="flex gap-2 mt-2.5">
                      <button
                        class="px-2.5 py-1 text-[11px] rounded font-medium bg-sky-600 hover:bg-sky-500 text-white transition-colors cursor-pointer"
                        onclick={() => { uiStore.setNoModsFound(false); welcomeOpenProject(); }}
                      >{m.welcome_no_mods_try_again()}</button>
                      <button
                        class="px-2.5 py-1 text-[11px] rounded text-[var(--th-text-400)] hover:text-[var(--th-text-200)] hover:bg-[var(--th-bg-700)] transition-colors cursor-pointer"
                        onclick={() => uiStore.setNoModsFound(false)}
                      >{m.welcome_no_mods_dismiss()}</button>
                    </div>
                  </div>
                  <button
                    class="p-0.5 rounded hover:bg-[var(--th-bg-700)] text-[var(--th-text-500)] cursor-pointer shrink-0"
                    onclick={() => uiStore.setNoModsFound(false)}
                    aria-label={m.welcome_no_mods_dismiss()}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            {/if}

            <!-- Collapsible folder help -->
            <div class="flex flex-col items-center w-full max-w-[320px] mx-auto mt-4">
              <button
                class="flex items-center gap-1.5 text-[11px] text-[var(--th-text-500)] hover:text-[var(--th-text-300)] transition-colors cursor-pointer"
                onclick={() => folderHelpExpanded = !folderHelpExpanded}
                aria-expanded={folderHelpExpanded}
                aria-controls="folder-help-content"
              >
                <span class="shrink-0 inline-flex transition-transform duration-150" style:transform={folderHelpExpanded ? "rotate(90deg)" : ""}><ChevronRight size={14} /></span>
                {m.welcome_folder_help_title()}
              </button>

              {#if folderHelpExpanded}
                <div id="folder-help-content" class="self-stretch mt-2 p-3 rounded-lg border border-[var(--th-border-700)] bg-[var(--th-bg-800)]/60 text-left">
                  <p class="text-[11px] text-[var(--th-text-300)] mb-2">{m.welcome_folder_help_body()}</p>
                  <pre class="text-[10px] leading-relaxed text-[var(--th-text-400)] bg-[var(--th-bg-900)]/60 rounded p-2 mb-2 overflow-x-auto" aria-label={m.welcome_folder_help_body()}>{
`📁 MyProject/          ← ${m.welcome_folder_help_select_hint()}
   📁 MyMod/
      📁 Mods/
         📁 MyMod/
            📄 meta.lsx
      📁 Public/
         📁 MyMod/
   📄 .gitignore
   📄 README.md`
                  }</pre>
                  <p class="text-[11px] text-[var(--th-text-400)] mb-1.5">{m.welcome_folder_help_auto_correct()}</p>
                  <p class="text-[11px] text-[var(--th-text-300)] flex items-start gap-1.5">
                    <Lightbulb size={13} class="shrink-0 text-amber-400 mt-0.5" aria-hidden="true" />
                    {m.welcome_folder_help_new_mod()}
                  </p>
                </div>
              {/if}
            </div>
          {/if}
        </div>
        {/if}
      </div>

    {:else if activeTab.type === "group"}
      <!-- Group tab: multiple sections, with per-child entry filters -->
      {@const groupChildren = getGroupChildren(activeTab.category ?? "")}
      {@const fallbackSections = activeTab.groupSections ?? []}
      {#if activeTab.category === "_TextureAtlas"}
        <!-- Texture Atlas: specialized combined form -->
        {@const atlasInfoResult = getSectionResult("TextureAtlasInfo") ?? { section: "TextureAtlasInfo", entries: [] }}
        {@const atlasUvResult = getSectionResult("IconUVList") ?? { section: "IconUVList", entries: [] }}
        <TextureAtlasPanel infoResult={atlasInfoResult} uvResult={atlasUvResult} globalFilter={modStore.globalFilter} />
      {:else}
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
      {/if}

    {:else if activeTab.type === "filteredSection"}
      <!-- Filtered section: shows only entries matching a filter -->
      {@const filteredResult = getFilteredSectionResult(activeTab.category ?? "", activeTab.entryFilter ?? { field: "", value: "" })}
      {#if filteredResult}
        <div class="section-tab-content">
          <SectionPanel sectionResult={filteredResult} globalFilter={modStore.globalFilter} displayLabel={activeTab.label} entryFilter={activeTab.entryFilter} regionId={activeTab.regionId} />
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
          <SectionPanel {sectionResult} globalFilter={modStore.globalFilter} regionId={activeTab.regionId} />
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
      {@const lsxCategory = activeTab.category ?? ""}
      {@const lsxGroupSections = activeTab.groupSections ?? []}
      {@const lsxViewMode = getLsxTabViewMode(activeTab.id)}
      <div class="lsx-file-tab">
        {#if activeTab.filePath}
          <div class="editor-header">
            <FileCode size={14} class="text-[var(--th-text-400)] flex-shrink-0" />
            <span class="text-xs font-medium text-[var(--th-text-200)] truncate">
              {activeTab.filePath.split("/").pop() ?? activeTab.filePath.split("\\").pop() ?? activeTab.filePath}
            </span>
            {#if activeTab.dirty}
              <span class="text-[10px] text-amber-400">{m.script_editor_unsaved()}</span>
            {/if}
            <span class="flex-1"></span>
            {#if lsxViewMode === 'raw'}
              <button
                class="text-[10px] px-1.5 py-0.5 rounded text-[var(--th-text-400)] hover:text-[var(--th-text-200)] hover:bg-[var(--th-bg-700)] transition-colors flex items-center gap-1"
                onclick={() => lsxRawEditorRef?.save()}
                aria-label={m.script_editor_save_label()}
              >
                <Save size={12} />
                {m.common_save()}
              </button>
            {/if}
            <div class="mode-pill" role="tablist" aria-label="View mode">
              <button
                class="mode-pill-option"
                class:active={lsxViewMode === 'form'}
                onclick={() => setLsxTabViewMode(activeTab.id, 'form')}
                role="tab"
                aria-selected={lsxViewMode === 'form'}
                onkeydown={(e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { setLsxTabViewMode(activeTab.id, lsxViewMode === 'form' ? 'raw' : 'form'); e.preventDefault(); }}}
              >
                {m.lsx_editor_form_mode()}
              </button>
              <button
                class="mode-pill-option"
                class:active={lsxViewMode === 'raw'}
                onclick={() => setLsxTabViewMode(activeTab.id, 'raw')}
                role="tab"
                aria-selected={lsxViewMode === 'raw'}
                onkeydown={(e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { setLsxTabViewMode(activeTab.id, lsxViewMode === 'form' ? 'raw' : 'form'); e.preventDefault(); }}}
              >
                {m.lsx_editor_raw_mode()}
              </button>
            </div>
            <span class="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-[var(--th-bg-700)] text-[var(--th-text-500)]">.LSX</span>
          </div>
        {/if}

        <div class="lsx-file-content">
          {#if lsxViewMode === 'raw' && activeTab.filePath}
            <ScriptEditorPanel filePath={activeTab.filePath} language={"xml"} readonly={false} hideHeader tabId={activeTab.id} bind:this={lsxRawEditorRef} />
          {:else if lsxGroupSections.length > 1}
            <div class="section-tab-content">
              {#each lsxGroupSections as sectionName (sectionName)}
                {@const sectionResult = (activeTab.filePath ? getFileSectionResult(activeTab.id, sectionName) : getSectionResult(sectionName)) ?? { section: sectionName as Section, entries: [] }}
                <div class="group-section">
                  <SectionPanel sectionResult={sectionResult} globalFilter={modStore.globalFilter} displayLabel={sectionName} />
                </div>
              {/each}
            </div>
          {:else if lsxCategory}
            {@const lsxResult = activeTab.filePath ? getFileSectionResult(activeTab.id, lsxCategory) : getSectionResult(lsxCategory)}
            {#if activeTab.filePath && fileParsedSections[activeTab.id]?.length}
              <!-- Always prefer file-parsed sections for external files -->
              <div class="section-tab-content">
                {#each fileParsedSections[activeTab.id] as parsedSection (parsedSection.section)}
                  <div class="group-section">
                    <SectionPanel sectionResult={parsedSection} globalFilter={modStore.globalFilter} displayLabel={parsedSection.section} />
                  </div>
                {/each}
              </div>
            {:else if lsxResult && lsxResult.entries.length > 0}
              <div class="section-tab-content">
                <SectionPanel sectionResult={lsxResult} globalFilter={modStore.globalFilter} />
              </div>
            {:else}
              <div class="section-tab-content">
                <SectionPanel sectionResult={lsxResult ?? { section: lsxCategory as Section, entries: [] }} globalFilter={modStore.globalFilter} />
              </div>
            {/if}
          {:else if activeTab.filePath}
            <ScriptEditorPanel filePath={activeTab.filePath} language={"xml"} readonly={false} hideHeader tabId={activeTab.id} bind:this={lsxRawEditorRef} />
          {:else}
            <div class="empty-tab">
              <FolderOpen size={32} class="text-[var(--th-text-600)] opacity-30" />
              <p class="text-sm text-[var(--th-text-500)] mt-2">No form view is available for this LSX file.</p>
            </div>
          {/if}
        </div>
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
        {#if activeTab.filePath.endsWith("ScriptExtender/Config.json")}
          <SeConfigEditor filePath={activeTab.filePath} />
        {:else if activeTab.filePath.includes("MCM_blueprint") && activeTab.filePath.endsWith(".json")}
          <McmBlueprintEditor filePath={activeTab.filePath} />
        {:else if activeTab.filePath.includes("Localization/") && activeTab.filePath.endsWith(".xml")}
          <LocalizationFileEditor filePath={activeTab.filePath} />
        {:else}
          <ScriptEditorPanel
            filePath={activeTab.filePath}
            language={(activeTab.language ?? "lua") as ScriptLanguage}
            readonly={false}
            hideHeader
          />
        {/if}
      {/if}
    {:else if activeTab.type === "readme"}
      <ReadmeEditor filePath={activeTab.filePath} />
    {:else if activeTab.type === "git-diff"}
      {#if activeTab.filePath}
        <GitDiffView
          filePath={activeTab.filePath}
          modPath={modStore.projectPath || modStore.selectedModPath || ""}
          staged={activeTab.staged}
          commitOid={activeTab.commitOid}
        />
      {/if}
    {:else if activeTab.type === "git-commit"}
      {#if activeTab.commitOid}
        <GitCommitDetailView
          commitOid={activeTab.commitOid}
          modPath={modStore.projectPath || modStore.selectedModPath || ""}
          ondiffopen={(detail) => {
            uiStore.openTab({
              id: `git-diff:${detail.path}:${detail.commitOid}`,
              label: `${detail.path.split("/").pop() ?? detail.path} (${detail.commitOid.slice(0, 7)})`,
              type: "git-diff",
              filePath: detail.path,
              commitOid: detail.commitOid,
              icon: "📝",
            });
          }}
        />
      {/if}
    {:else if activeTab.type === "forge-issue"}
      {#if activeTab.filePath}
        <ForgeIssueView issueNumber={Number(activeTab.filePath)} />
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

  .lsx-file-tab {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    padding: 0;
  }

  .lsx-file-content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
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
</style>
