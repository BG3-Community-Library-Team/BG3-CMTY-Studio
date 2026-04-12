/**
 * UI navigation state for the activity bar, file explorer, and editor tabs.
 * Manages which view is active, which files/tabs are open, and the active tab.
 */
import { m } from "../../paraglide/messages.js";

export type ActivityView = "project" | "explorer" | "editor" | "search" | "git" | "settings" | "loaded-data" | "help";
export type ExplorerDrawerId = "data" | "scripts" | "localization";

const ACTIVITY_BAR_STORAGE_KEY = "bg3-cmty-activity-bar-order";
const EXPLORER_DRAWERS_STORAGE_KEY = "bg3-cmty-explorer-drawers";
const EXPLORER_DRAWER_ORDER_STORAGE_KEY = "bg3-cmty-explorer-drawer-order";
const EXPLORER_NODE_ORDER_STORAGE_KEY = "bg3-cmty-explorer-node-order";
const EXPLORER_VIEW_MODE_STORAGE_KEY = "bg3-cmty-explorer-view-mode";
const DEFAULT_ACTIVITY_BAR_ORDER: ActivityView[] = ["project", "explorer", "search", "git", "loaded-data", "settings", "help"];
const DEFAULT_EXPLORER_DRAWER_ORDER: ExplorerDrawerId[] = ["data", "scripts", "localization"];

export type SettingsSection = "" | "theme" | "display" | "dataHandling" | "modConfig" | "schemas" | "notifications" | "scripts" | "git" | "publishing";

/** Data needed to render the summary drawer at the App layout level */
export interface SummaryDrawerState {
  section: string;
  displayName: string;
  uuids: string[];
  validationErrors: Array<{ key: string; msg: string; level: "warn" | "error" }>;
  fields: Record<string, string>;
  booleans: Array<{ key: string; value: boolean }>;
  strings: Array<{ action: string; type: string; values: string[] }>;
  rawAttributes: Record<string, string> | null;
  rawChildren: Record<string, string[]> | null;
  vanillaAttributes: Record<string, string> | null;
  autoEntryId: string | null;
  nodeId: string | null;
  rawAttributeTypes: Record<string, string> | null;
}

export interface EditorTab {
  /** Unique key for the tab — file path or special key */
  id: string;
  /** Display label for the tab */
  label: string;
  /** Icon hint (emoji or lucide icon name) */
  icon?: string;
  /** The BG3 folder category this tab represents (e.g., "Progressions", "Races") */
  category?: string;
  /** Whether this tab has unsaved changes */
  dirty?: boolean;
  /** Tab type — determines which editor component to render */
  type: "section" | "group" | "filteredSection" | "lsx-file" | "welcome" | "meta-lsx" | "localization" | "file-preview" | "settings" | "theme-gallery" | "script-editor" | "readme" | "git-diff" | "git-commit" | "forge-issue" | "texture-atlas";
  /** For group tabs: CF sections to render together */
  groupSections?: string[];
  /** For filteredSection tabs: filter entries by this field/value pair */
  entryFilter?: { field: string; value: string };
  /** Region ID for filtering entries in section/filteredSection tabs */
  regionId?: string;
  /** For file-preview tabs: the relative path within the mod directory */
  filePath?: string;
  /** When true, this tab is a temporary preview (italic label, replaced by next preview) */
  preview?: boolean;
  /** When true, tab is pinned to the left side of the tab bar (explicit user action) */
  pinned?: boolean;
  /** Script language for script-editor tabs */
  language?: string;
  /** For git-diff tabs: whether the diff is staged */
  staged?: boolean;
  /** For git-diff/git-commit tabs: the commit OID */
  commitOid?: string;
}

class UiStore {
  /** The currently active activity bar view */
  activeView: ActivityView = $state("explorer");

  /** The currently active settings section (when activeView === "settings") */
  settingsSection: SettingsSection = $state("");

  /** Whether the sidebar (explorer/search/settings) is visible */
  sidebarVisible: boolean = $state(true);

  /** Whether the output preview panel (right side) is collapsed */
  previewCollapsed: boolean = $state(true);

  /** All open editor tabs */
  openTabs: EditorTab[] = $state([
    { id: "welcome", label: m.ui_welcome_tab(), type: "welcome", icon: "🏠" },
  ]);

  /** ID of the currently active tab */
  activeTabId: string = $state("welcome");

  /** Whether the file explorer tree nodes are expanded (keyed by path) */
  expandedNodes: Record<string, boolean> = $state({});

  /** Whether the Create New Mod modal is visible */
  showCreateModModal: boolean = $state(false);

  /** Section accordion expansion state (keyed by section name, session-only) */
  expandedSections: Record<string, boolean> = $state({});

  /** Form navigation sections exposed by the currently open ManualEntryForm (if any).
   *  CommandPalette reads this to offer "Jump to: section" entries. */
  formNavSections: { id: string; label: string; children?: { id: string; label: string }[] }[] = $state([]);

  /** Summary drawer state — when non-null, the summary sidebar is visible in App.svelte */
  summaryDrawer: SummaryDrawerState | null = $state(null);

  /** Open the summary drawer with the given data */
  openSummaryDrawer(data: SummaryDrawerState): void {
    this.summaryDrawer = data;
  }

  /** Update the summary drawer data (no-op if closed) */
  updateSummaryDrawer(data: Partial<SummaryDrawerState>): void {
    if (this.summaryDrawer) {
      this.summaryDrawer = { ...this.summaryDrawer, ...data };
    }
  }

  /** Close the summary drawer */
  closeSummaryDrawer(): void {
    this.summaryDrawer = null;
  }

  /** Persisted activity bar icon order */
  activityBarOrder: ActivityView[] = $state(UiStore.#loadActivityBarOrder());

  static #loadActivityBarOrder(): ActivityView[] {
    try {
      const raw = localStorage.getItem(ACTIVITY_BAR_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        const known = new Set<string>(DEFAULT_ACTIVITY_BAR_ORDER);
        const valid = parsed.filter(id => known.has(id)) as ActivityView[];
        const missing = DEFAULT_ACTIVITY_BAR_ORDER.filter(id => !valid.includes(id));
        // Prepend newly added views (like "project") so they appear first
        const prepend = missing.filter(id => DEFAULT_ACTIVITY_BAR_ORDER.indexOf(id) === 0);
        const append = missing.filter(id => DEFAULT_ACTIVITY_BAR_ORDER.indexOf(id) !== 0);
        return [...prepend, ...valid, ...append];
      }
    } catch { /* fallback to defaults */ }
    return [...DEFAULT_ACTIVITY_BAR_ORDER];
  }

  setActivityBarOrder(order: ActivityView[]): void {
    this.activityBarOrder = order;
    localStorage.setItem(ACTIVITY_BAR_STORAGE_KEY, JSON.stringify(order));
  }

  /** Toggle sidebar visibility. If switching to same view, hide; otherwise show new view. */
  toggleSidebar(view?: ActivityView): void {
    if (view && view !== this.activeView) {
      this.activeView = view;
      this.sidebarVisible = true;
    } else {
      this.sidebarVisible = !this.sidebarVisible;
    }
  }

  /** Open a new tab or focus an existing one. Preview tabs replace the current preview. */
  openTab(tab: EditorTab): void {
    const existing = this.openTabs.find(t => t.id === tab.id);
    if (existing) {
      // If opening the same tab as permanent, promote it
      if (existing.preview && !tab.preview) {
        existing.preview = false;
      }
      this.activeTabId = tab.id;
      return;
    }

    if (tab.preview) {
      // Replace the current preview tab if one exists
      const previewIdx = this.openTabs.findIndex(t => t.preview && !t.pinned);
      if (previewIdx >= 0) {
        this.openTabs = [
          ...this.openTabs.slice(0, previewIdx),
          tab,
          ...this.openTabs.slice(previewIdx + 1),
        ];
        this.activeTabId = tab.id;
        return;
      }
    }

    this.openTabs = [...this.openTabs, tab];
    this.activeTabId = tab.id;
  }

  /** Promote a preview tab to a permanent (non-preview) tab. */
  promoteTab(tabId: string): void {
    const tab = this.openTabs.find(t => t.id === tabId);
    if (tab && tab.preview) tab.preview = false;
  }

  /** Pin a tab — moves it to the left zone and prevents closing without unpinning. */
  pinTab(tabId: string): void {
    const tab = this.openTabs.find(t => t.id === tabId);
    if (!tab || tab.type === "welcome") return;
    tab.pinned = true;
    tab.preview = false;
    // Re-sort: pinned tabs go right after welcome
    this._sortPinnedTabs();
  }

  /** Unpin a tab — returns it to the normal tab zone. */
  unpinTab(tabId: string): void {
    const tab = this.openTabs.find(t => t.id === tabId);
    if (tab) tab.pinned = false;
  }

  /** Sort tabs so pinned tabs are first (after welcome). */
  private _sortPinnedTabs(): void {
    const welcome = this.openTabs.filter(t => t.type === "welcome");
    const pinned = this.openTabs.filter(t => t.pinned && t.type !== "welcome");
    const rest = this.openTabs.filter(t => !t.pinned && t.type !== "welcome");
    this.openTabs = [...welcome, ...pinned, ...rest];
  }

  /** Close a tab by ID. If it was active, activate an adjacent tab. */
  closeTab(tabId: string): void {
    // Welcome tab cannot be closed
    if (tabId === "welcome") return;
    const idx = this.openTabs.findIndex(t => t.id === tabId);
    if (idx === -1) return;

    const wasActive = this.activeTabId === tabId;
    this.openTabs = this.openTabs.filter(t => t.id !== tabId);

    if (wasActive && this.openTabs.length > 0) {
      // Activate the tab to the left, or the first tab
      const newIdx = Math.min(idx, this.openTabs.length - 1);
      this.activeTabId = this.openTabs[newIdx].id;
    } else if (this.openTabs.length === 0) {
      this.openTabs = [{ id: "welcome", label: m.ui_welcome_tab(), type: "welcome", icon: "🏠" }];
      this.activeTabId = "welcome";
    }

    // If settings tab was closed, reset settings view
    if (tabId === "settings" && this.activeView === "settings") {
      this.activeView = "explorer";
      this.settingsSection = "";
    }
  }

  /** Move a tab from one position to another (drag-to-reorder). */
  moveTab(fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || toIndex < 0) return;
    if (fromIndex >= this.openTabs.length || toIndex >= this.openTabs.length) return;
    // Welcome tab is pinned to position 0 — cannot be moved or displaced
    if (this.openTabs[fromIndex]?.type === "welcome") return;
    if (toIndex === 0 && this.openTabs[0]?.type === "welcome") return;
    const tabs = [...this.openTabs];
    const [moved] = tabs.splice(fromIndex, 1);
    tabs.splice(toIndex, 0, moved);
    this.openTabs = tabs;
  }

  /** Get the currently active tab object */
  get activeTab(): EditorTab | undefined {
    return this.openTabs.find(t => t.id === this.activeTabId);
  }

  /** Toggle a file explorer node's expanded state */
  toggleNode(path: string): void {
    this.expandedNodes = {
      ...this.expandedNodes,
      [path]: !this.expandedNodes[path],
    };
  }

  /** Expand a file explorer node (no-op if already expanded) */
  expandNode(path: string): void {
    if (!this.expandedNodes[path]) {
      this.expandedNodes = { ...this.expandedNodes, [path]: true };
    }
  }

  /** Auto-detect script language from file path and extension */
  detectScriptLanguage(filePath: string): string {
    const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
    // Osiris goal files: .txt in Story/RawFiles/Goals/
    if (ext === "txt" && filePath.includes("Story/RawFiles/Goals/")) return "osiris";
    switch (ext) {
      case "lua": return "lua";
      case "khn": return "khn";
      case "anc": case "ann": case "anm": return "anubis";
      case "clc": case "cln": case "clm": return "constellations";
      case "json": return "json";
      case "yaml": case "yml": return "yaml";
      case "xml": case "lsx": case "lsefx": return "xml";
      case "md": case "markdown": return "markdown";
      case "txt": return "plaintext";
      default: return "plaintext";
    }
  }

  /** Open a script file in a script-editor tab */
  openScriptTab(filePath: string, language?: string): void {
    const lang = language ?? this.detectScriptLanguage(filePath);
    const fileName = filePath.split("/").pop() ?? filePath;
    this.openTab({
      id: `script:${filePath}`,
      label: fileName,
      type: "script-editor",
      filePath,
      language: lang,
      icon: "📝",
      preview: true,
    });
  }

  /** Search panel: pre-populated "files to include" filter (set by Find in Folder) */
  searchFilesInclude = $state("");

  /** Whether the search panel should be shown */
  showSearchPanel = $state(false);

  /** Whether the last "Open Project" attempt found no mods (shown in welcome area) */
  noModsFound: boolean = $state(false);

  /** Set the no-mods-found state (called by openProject flow) */
  setNoModsFound(value: boolean): void {
    this.noModsFound = value;
  }

  /** Close all open tabs and clear related navigation state (e.g., on mod switch). */
  closeAllTabs(): void {
    this.openTabs = [];
    this.activeTabId = "";
    this.expandedNodes = {};
  }

  /** Reset UI state (e.g., when closing a mod) */
  reset(): void {
    this.openTabs = [
      { id: "welcome", label: m.ui_welcome_tab(), type: "welcome", icon: "🏠" },
    ];
    this.activeTabId = "welcome";
    this.expandedNodes = {};
    this.expandedSections = {};
    this.formNavSections = [];
    this.summaryDrawer = null;
    this.noModsFound = false;
    this.activeView = "explorer";
    this.settingsSection = "";
    this.sidebarVisible = true;
    this.explorerViewMode = "studio";
    this.explorerDrawers = {};
    this.explorerDrawerOrder = [...DEFAULT_EXPLORER_DRAWER_ORDER];
    this.explorerNodeOrder = {};
  }

  // ── Explorer Drawer System ────────────────────────────────────
  /** Explorer sidebar view mode */
  explorerViewMode: "studio" | "file-tree" = $state(UiStore.#loadExplorerViewMode());

  /** Per-drawer collapsed/height state (keyed by drawer id) */
  explorerDrawers: Record<string, { collapsed: boolean; height: number | null }> = $state(UiStore.#loadExplorerDrawers());

  /** Persisted explorer drawer order */
  explorerDrawerOrder: ExplorerDrawerId[] = $state(UiStore.#loadExplorerDrawerOrder());

  static #loadExplorerViewMode(): "studio" | "file-tree" {
    try {
      const raw = localStorage.getItem(EXPLORER_VIEW_MODE_STORAGE_KEY);
      if (raw === "studio" || raw === "file-tree") return raw;
    } catch { /* fallback */ }
    return "studio";
  }

  static #loadExplorerDrawerOrder(): ExplorerDrawerId[] {
    try {
      const raw = localStorage.getItem(EXPLORER_DRAWER_ORDER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        const known = new Set<string>(DEFAULT_EXPLORER_DRAWER_ORDER);
        const valid = parsed.filter((id): id is ExplorerDrawerId => known.has(id));
        const missing = DEFAULT_EXPLORER_DRAWER_ORDER.filter(id => !valid.includes(id));
        return [...valid, ...missing];
      }
    } catch { /* fallback */ }
    return [...DEFAULT_EXPLORER_DRAWER_ORDER];
  }

  static #loadExplorerDrawers(): Record<string, { collapsed: boolean; height: number | null }> {
    try {
      const raw = localStorage.getItem(EXPLORER_DRAWERS_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* fallback */ }
    return {};
  }

  setExplorerViewMode(mode: "studio" | "file-tree"): void {
    this.explorerViewMode = mode;
    localStorage.setItem(EXPLORER_VIEW_MODE_STORAGE_KEY, mode);
  }

  /** IDs of drawers that should start collapsed when no stored preference exists. */
  static readonly COLLAPSED_BY_DEFAULT: ReadonlySet<string> = new Set([
    "git-stashes",
    "git-remotes",
  ]);

  /** Returns whether a drawer is collapsed, using a sensible default for first visit. */
  isDrawerCollapsed(drawerId: string): boolean {
    const state = this.explorerDrawers[drawerId];
    if (state !== undefined) return !!state.collapsed;
    return UiStore.COLLAPSED_BY_DEFAULT.has(drawerId);
  }

  toggleDrawer(drawerId: string): void {
    const current = this.explorerDrawers[drawerId];
    if (current) {
      this.explorerDrawers[drawerId] = { ...current, collapsed: !current.collapsed };
    } else {
      // Initialize from effective default so the toggle actually reverses the visual state
      const wasCollapsed = this.isDrawerCollapsed(drawerId);
      this.explorerDrawers[drawerId] = { collapsed: !wasCollapsed, height: null };
    }
    this.#persistExplorerDrawers();
  }

  setDrawerHeight(drawerId: string, height: number): void {
    const current = this.explorerDrawers[drawerId];
    this.explorerDrawers[drawerId] = { ...(current || { collapsed: false }), height };
    this.#persistExplorerDrawers();
  }

  setExplorerDrawerOrder(order: ExplorerDrawerId[]): void {
    const valid = order.filter((id, index, list) =>
      DEFAULT_EXPLORER_DRAWER_ORDER.includes(id) && list.indexOf(id) === index,
    );
    const missing = DEFAULT_EXPLORER_DRAWER_ORDER.filter(id => !valid.includes(id));
    this.explorerDrawerOrder = [...valid, ...missing];
    try {
      localStorage.setItem(EXPLORER_DRAWER_ORDER_STORAGE_KEY, JSON.stringify(this.explorerDrawerOrder));
    } catch { /* quota exceeded — silently ignore */ }
  }

  #persistExplorerDrawers(): void {
    try {
      localStorage.setItem(EXPLORER_DRAWERS_STORAGE_KEY, JSON.stringify(this.explorerDrawers));
    } catch { /* quota exceeded — silently ignore */ }
  }

  // ── Drawer Hide / Pin ────────────────────────────────────────

  /** Hidden drawer IDs — persisted per-session in localStorage */
  hiddenDrawers: Set<string> = $state(UiStore.#loadHiddenDrawers());
  /** Pinned drawer IDs — pinned drawers always appear at top and can't be hidden */
  pinnedDrawers: Set<string> = $state(UiStore.#loadPinnedDrawers());

  static #loadHiddenDrawers(): Set<string> {
    try {
      const raw = localStorage.getItem("bg3-cmty-hidden-drawers");
      if (raw) return new Set(JSON.parse(raw));
    } catch { /* fallback */ }
    return new Set();
  }

  static #loadPinnedDrawers(): Set<string> {
    try {
      const raw = localStorage.getItem("bg3-cmty-pinned-drawers");
      if (raw) return new Set(JSON.parse(raw));
    } catch { /* fallback */ }
    return new Set();
  }

  isDrawerHidden(drawerId: string): boolean {
    return this.hiddenDrawers.has(drawerId);
  }

  isDrawerPinned(drawerId: string): boolean {
    return this.pinnedDrawers.has(drawerId);
  }

  /** Hide a drawer. Pinned drawers can't be hidden. Must keep at least 1 visible. */
  hideDrawer(drawerId: string, allDrawerIds: string[]): void {
    if (this.pinnedDrawers.has(drawerId)) return;
    const visibleCount = allDrawerIds.filter(id => !this.hiddenDrawers.has(id)).length;
    if (visibleCount <= 1) return; // must keep at least 1 visible
    this.hiddenDrawers = new Set([...this.hiddenDrawers, drawerId]);
    this.#persistHiddenDrawers();
  }

  showDrawer(drawerId: string): void {
    const next = new Set(this.hiddenDrawers);
    next.delete(drawerId);
    this.hiddenDrawers = next;
    this.#persistHiddenDrawers();
  }

  pinDrawer(drawerId: string): void {
    // Pinning also un-hides
    this.pinnedDrawers = new Set([...this.pinnedDrawers, drawerId]);
    const next = new Set(this.hiddenDrawers);
    next.delete(drawerId);
    this.hiddenDrawers = next;
    this.#persistPinnedDrawers();
    this.#persistHiddenDrawers();
  }

  unpinDrawer(drawerId: string): void {
    const next = new Set(this.pinnedDrawers);
    next.delete(drawerId);
    this.pinnedDrawers = next;
    this.#persistPinnedDrawers();
  }

  #persistHiddenDrawers(): void {
    try {
      localStorage.setItem("bg3-cmty-hidden-drawers", JSON.stringify([...this.hiddenDrawers]));
    } catch { /* quota exceeded */ }
  }

  #persistPinnedDrawers(): void {
    try {
      localStorage.setItem("bg3-cmty-pinned-drawers", JSON.stringify([...this.pinnedDrawers]));
    } catch { /* quota exceeded */ }
  }

  // ── Explorer Node Ordering & Pin-to-Top ──────────────────────

  /** Node ordering and pin state per drawer */
  explorerNodeOrder: Record<string, { pinned: string[]; order: string[] }> = $state(UiStore.#loadNodeOrder());

  static #loadNodeOrder(): Record<string, { pinned: string[]; order: string[] }> {
    try {
      const raw = localStorage.getItem(EXPLORER_NODE_ORDER_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* fallback */ }
    return {};
  }

  pinNode(drawerId: string, nodeId: string): void {
    const current = this.explorerNodeOrder[drawerId] || { pinned: [], order: [] };
    if (!current.pinned.includes(nodeId)) {
      this.explorerNodeOrder = {
        ...this.explorerNodeOrder,
        [drawerId]: { ...current, pinned: [...current.pinned, nodeId] },
      };
    }
    this.#persistNodeOrder();
  }

  unpinNode(drawerId: string, nodeId: string): void {
    const current = this.explorerNodeOrder[drawerId];
    if (current) {
      this.explorerNodeOrder = {
        ...this.explorerNodeOrder,
        [drawerId]: { ...current, pinned: current.pinned.filter(id => id !== nodeId) },
      };
      this.#persistNodeOrder();
    }
  }

  reorderNode(drawerId: string, draggedId: string, targetId: string, position: "before" | "after", defaultIds?: string[]): void {
    const current = this.explorerNodeOrder[drawerId] || { pinned: [], order: [] };
    const isPinnedDrag = current.pinned.includes(draggedId);
    const isPinnedTarget = current.pinned.includes(targetId);

    if (isPinnedDrag && isPinnedTarget) {
      // Reorder within pinned list
      const pinned = current.pinned.filter(id => id !== draggedId);
      const targetIdx = pinned.indexOf(targetId);
      const insertIdx = position === "before" ? targetIdx : targetIdx + 1;
      pinned.splice(insertIdx, 0, draggedId);
      this.explorerNodeOrder = {
        ...this.explorerNodeOrder,
        [drawerId]: { ...current, pinned },
      };
    } else if (!isPinnedDrag && !isPinnedTarget) {
      // Reorder within unpinned order list
      let order = current.order.filter(id => id !== draggedId);
      const targetIdx = order.indexOf(targetId);
      if (targetIdx >= 0) {
        const insertIdx = position === "before" ? targetIdx : targetIdx + 1;
        order.splice(insertIdx, 0, draggedId);
      } else if (defaultIds) {
        // Seed the order list with all default IDs to preserve natural positions,
        // then insert draggedId relative to targetId.
        const existingSet = new Set(order);
        for (const id of defaultIds) {
          if (!existingSet.has(id) && id !== draggedId) {
            order.push(id);
          }
        }
        const newTargetIdx = order.indexOf(targetId);
        if (newTargetIdx >= 0) {
          const insertIdx = position === "before" ? newTargetIdx : newTargetIdx + 1;
          order.splice(insertIdx, 0, draggedId);
        } else {
          order.push(draggedId);
        }
      } else {
        // No defaultIds available — place both to maintain relative adjacency
        if (position === "before") {
          order.push(draggedId, targetId);
        } else {
          order.push(targetId, draggedId);
        }
      }
      this.explorerNodeOrder = {
        ...this.explorerNodeOrder,
        [drawerId]: { ...current, order },
      };
    }
    // Cross-zone (pinned↔unpinned) drag is a no-op — use pin/unpin instead

    this.#persistNodeOrder();
  }

  isNodePinned(drawerId: string, nodeId: string): boolean {
    return this.explorerNodeOrder[drawerId]?.pinned.includes(nodeId) ?? false;
  }

  getOrderedNodes(drawerId: string, defaultIds: string[]): string[] {
    const state = this.explorerNodeOrder[drawerId];
    if (!state) return defaultIds;
    const pinned = state.pinned.filter(id => defaultIds.includes(id));
    const remaining = defaultIds.filter(id => !pinned.includes(id));
    if (state.order.length === 0) return [...pinned, ...remaining];
    const ordered = state.order.filter(id => remaining.includes(id));
    const unordered = remaining.filter(id => !ordered.includes(id));
    return [...pinned, ...ordered, ...unordered];
  }

  #persistNodeOrder(): void {
    try {
      localStorage.setItem(EXPLORER_NODE_ORDER_STORAGE_KEY, JSON.stringify(this.explorerNodeOrder));
    } catch { /* quota exceeded — silently ignore */ }
  }

  // ── Command Palette programmatic open ─────────────────────────
  /** Whether the command palette is currently open */
  commandPaletteOpen: boolean = $state(false);
  /** Initial query to pre-fill when opening the command palette programmatically */
  commandPaletteInitialQuery: string = $state("");

  /** Open the command palette, optionally pre-filled with a query string. */
  openCommandPalette(query = ""): void {
    this.commandPaletteInitialQuery = query;
    this.commandPaletteOpen = true;
  }
}

export const uiStore = new UiStore();
