<script lang="ts">
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import { projectStore, sectionToTable } from "../lib/stores/projectStore.svelte.js";
  import { uiStore } from "../lib/stores/uiStore.svelte.js";
  import { toastStore } from "../lib/stores/toastStore.svelte.js";
  import {
    BG3_CORE_FOLDERS,
    BG3_ADDITIONAL_FOLDERS,
    STATIC_SIDEBAR_SECTIONS,
    SECTIONS_EXCLUDED_FROM_DISCOVERY,
    type FolderNode,
  } from "../lib/data/bg3FolderStructure.js";
  import { openPath, revealPath, listModFiles } from "../lib/utils/tauri.js";
  import { localeCompare } from "../lib/utils/localeSort.js";
  import { schemaStore } from "../lib/stores/schemaStore.svelte.js";
  import ContextMenu from "./ContextMenu.svelte";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import File from "@lucide/svelte/icons/file";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import Folder from "@lucide/svelte/icons/folder";
  import FileCode2 from "@lucide/svelte/icons/file-code-2";
  import Cog from "@lucide/svelte/icons/cog";
  import Package from "@lucide/svelte/icons/package";
  import FilePlus2 from "@lucide/svelte/icons/file-plus-2";
  import FolderPlus from "@lucide/svelte/icons/folder-plus";
  import Search from "@lucide/svelte/icons/search";
  import Plus from "@lucide/svelte/icons/plus";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import BookOpen from "@lucide/svelte/icons/book-open";
  import Languages from "@lucide/svelte/icons/languages";
  import FileCode from "@lucide/svelte/icons/file-code";
  import type { SectionResult, DiffEntry } from "../lib/types/index.js";
  import type { ModFileEntry } from "../lib/utils/tauri.js";
  import { open } from "@tauri-apps/plugin-dialog";
  import { scanAndImport } from "../lib/services/scanService.js";
  import { m } from "../paraglide/messages.js";
  import { commandRegistry } from "../lib/utils/commandRegistry.svelte.js";
  import { scriptDelete, scriptRead, scriptWrite, touchFile, createModDirectory, moveModFile, copyModFile } from "../lib/tauri/scripts.js";
  import ScriptCreationModal from "./ScriptCreationModal.svelte";
  import Copy from "@lucide/svelte/icons/copy";
  import Scissors from "@lucide/svelte/icons/scissors";
  import ClipboardIcon from "@lucide/svelte/icons/clipboard";

  // ── File type badge colors ──
  const EXT_BADGE_COLORS: Record<string, string> = {
    yaml: "var(--th-badge-yaml)", yml: "var(--th-badge-yaml)",
    json: "var(--th-badge-json)",
    lua: "var(--th-badge-lua)",
    md: "var(--th-badge-md)",
    txt: "var(--th-badge-txt)",
    xml: "var(--th-badge-xml)",
    cfg: "var(--th-badge-cfg)",
    khn: "var(--th-badge-khn)",
    anc: "var(--th-badge-anubis)", ann: "var(--th-badge-anubis)", anm: "var(--th-badge-anubis)",
    clc: "var(--th-badge-constellations)", cln: "var(--th-badge-constellations)", clm: "var(--th-badge-constellations)",
  };
  const EXT_BADGE_FALLBACK = "var(--th-badge-fallback)";

  /** SE context detection for files under ScriptExtender/Lua/{Server|Client|Shared} */
  function getSeContextBadge(path: string): { label: string; color: string } | null {
    const parts = path.split('/');
    const seIdx = parts.indexOf('ScriptExtender');
    if (seIdx < 0) return null;
    const luaIdx = parts.indexOf('Lua', seIdx);
    if (luaIdx < 0) return null;
    const ctx = parts[luaIdx + 1];
    if (ctx === 'Server') return { label: 'SRV', color: 'var(--th-badge-server, var(--th-accent-500))' };
    if (ctx === 'Client') return { label: 'CLI', color: 'var(--th-badge-client, var(--th-accent-300))' };
    if (ctx === 'Shared') return { label: 'SHR', color: 'var(--th-badge-shared, var(--th-warning-500))' };
    return null;
  }

  /** Extensions that should open in the script editor instead of file preview */
  const SCRIPT_EXTENSIONS = new Set(["lua", "khn", "anc", "ann", "anm", "clc", "cln", "clm", "json"]);

  /** Check if a file extension is a script type that opens in the editor */
  function isScriptFile(ext?: string): boolean {
    return !!ext && SCRIPT_EXTENSIONS.has(ext.toLowerCase());
  }

  /** A node in the mod file tree. */
  interface FileTreeNode {
    name: string;
    relPath: string;
    extension?: string;
    children?: FileTreeNode[];
    isFile: boolean;
  }

  /** Build a tree structure from flat ModFileEntry paths. */
  function buildFileTree(files: ModFileEntry[]): FileTreeNode[] {
    const root: FileTreeNode = { name: "", relPath: "", children: [], isFile: false };

    for (const file of files) {
      const parts = file.rel_path.split("/");
      let current = root;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;
        if (!current.children) current.children = [];

        if (isLast) {
          current.children.push({
            name: part,
            relPath: file.rel_path,
            extension: file.extension,
            isFile: true,
          });
        } else {
          let dir = current.children.find(c => !c.isFile && c.name === part);
          if (!dir) {
            dir = { name: part, relPath: parts.slice(0, i + 1).join("/"), children: [], isFile: false };
            current.children.push(dir);
          }
          current = dir;
        }
      }
    }

    // Sort: folders first, then files, alphabetically. ScriptExtender sorts first among folders.
    function sortTree(nodes: FileTreeNode[]) {
      nodes.sort((a, b) => {
        if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
        // ScriptExtender folder sorts first
        if (!a.isFile && !b.isFile) {
          if (a.name === 'ScriptExtender') return -1;
          if (b.name === 'ScriptExtender') return 1;
        }
        return localeCompare(a.name, b.name);
      });
      for (const n of nodes) {
        if (n.children) sortTree(n.children);
      }
    }
    if (root.children) sortTree(root.children);
    return root.children ?? [];
  }

  /** Derived file tree from mod files — only files under Mods/{modFolder}/ */
  let modFileTree = $derived.by(() => {
    const folder = modStore.scanResult?.mod_meta?.folder;
    if (!folder) return buildFileTree(modStore.modFiles);
    const prefix = `Mods/${folder}/`;
    const filtered = modStore.modFiles
      .filter(f => f.rel_path.startsWith(prefix))
      .map(f => ({ ...f, rel_path: f.rel_path.slice(prefix.length) }));
    return buildFileTree(filtered);
  });

  let scanResult = $derived(modStore.scanResult);
  let refreshingAll = $state(false);

  /** Re-scan the mod directory to refresh file-based trees (Localization, Scripts, etc.). */
  async function refreshModFiles(): Promise<void> {
    const modPath = modStore.selectedModPath;
    if (!modPath) return;
    try {
      modStore.modFiles = await listModFiles(modPath);
    } catch (err) {
      console.warn("Failed to refresh mod files:", err);
    }
  }
  let modName = $derived(scanResult?.mod_meta?.name ?? m.file_explorer_no_mod());
  let modFolder = $derived(scanResult?.mod_meta?.folder ?? "");
  let sections = $derived(scanResult?.sections ?? []);

  // Pre-compute section lookup map and manual entry counts per section
  let sectionMap = $derived.by(() => {
    const m = new Map<string, SectionResult>();
    for (const s of sections) m.set(s.section, s);
    return m;
  });
  let manualCountBySection = $derived.by(() => {
    const m = new Map<string, number>();
    for (const s of projectStore.sections) {
      if (s.new_rows > 0) {
        // Convert table_name back to section name (strip "lsx__" prefix)
        const sectionName = s.table_name.startsWith("lsx__") ? s.table_name.slice(5) : s.table_name;
        m.set(sectionName, s.new_rows);
      }
    }
    return m;
  });

  // ── Context menu state ──
  let ctxVisible = $state(false);
  let ctxX = $state(0);
  let ctxY = $state(0);
  let ctxPath = $state("");
  let ctxLabel = $state("");
  let ctxSection = $state<string | undefined>(undefined);
  let ctxNode = $state<FolderNode | undefined>(undefined);

  /** Resolve a filesystem path for a tree node, relative to the mod root. */
  function resolveNodePath(nodeKey: string, kind: "root" | "public-folder" | "public-child" | "mods" | "meta" | "additional"): string {
    const base = modStore.selectedModPath;
    if (!base) return "";
    switch (kind) {
      case "root": return base;
      case "meta": return `${base}/Mods/${modFolder}`;
      case "public-folder": return `${base}/Public/${modFolder}/${nodeKey}`;
      case "public-child": return `${base}/Public/${modFolder}/${nodeKey}`;
      case "mods": return `${base}/Mods/${modFolder}`;
      case "additional": return `${base}/Public/${modFolder}/${nodeKey}`;
      default: return base;
    }
  }

  function showContextMenu(e: MouseEvent, path: string, label: string, Section?: string, node?: FolderNode) {
    e.preventDefault();
    e.stopPropagation();
    ctxPath = path;
    ctxLabel = label;
    ctxSection = Section;
    ctxNode = node;
    // Account for CSS zoom on ancestor containers
    const zoom = getComputedZoom(e.currentTarget as HTMLElement);
    ctxX = e.clientX / zoom;
    ctxY = e.clientY / zoom;
    ctxVisible = true;
  }

  /** Walk up the DOM to find the effective CSS zoom factor. */
  function getComputedZoom(el: HTMLElement): number {
    let zoom = 1;
    let current: HTMLElement | null = el;
    while (current) {
      const z = parseFloat(getComputedStyle(current).zoom || '1');
      if (z && z !== 1) zoom *= z;
      current = current.parentElement;
    }
    return zoom;
  }

  function hideContextMenu() {
    ctxVisible = false;
    fileCtxVisible = false;
    fileCtxNode = null;
    locaCtxVisible = false;
    scriptsCtxVisible = false;
  }

  // ── Localization / Scripts context menu state ──
  let locaCtxVisible = $state(false);
  let locaCtxX = $state(0);
  let locaCtxY = $state(0);
  let scriptsCtxVisible = $state(false);
  let scriptsCtxX = $state(0);
  let scriptsCtxY = $state(0);

  // ── File tree context menu state ──
  let fileCtxVisible = $state(false);
  let fileCtxX = $state(0);
  let fileCtxY = $state(0);
  let fileCtxNode: FileTreeNode | null = $state(null);

  /** Track which file/folder node is hovered for showing +file/+folder buttons */
  let hoveredNode: string | null = $state(null);

  function showFileContextMenu(e: MouseEvent, node: FileTreeNode) {
    e.preventDefault();
    e.stopPropagation();
    const zoom = getComputedZoom(e.currentTarget as HTMLElement);
    fileCtxX = e.clientX / zoom;
    fileCtxY = e.clientY / zoom;
    fileCtxNode = node;
    fileCtxVisible = true;
  }

  function hideFileContextMenu() {
    fileCtxVisible = false;
    fileCtxNode = null;
  }

  // ── Inline file/folder creation state ──
  let inlineCreateParent: string | null = $state(null);
  let inlineCreateType: 'file' | 'folder' | null = $state(null);
  let inlineCreateName = $state("");
  let inlineCreateInput: HTMLInputElement | null = $state(null);

  function startInlineCreate(parentRelPath: string, type: 'file' | 'folder') {
    inlineCreateParent = parentRelPath;
    inlineCreateType = type;
    inlineCreateName = '';
    uiStore.expandedNodes[`modfile:${parentRelPath}`] = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        inlineCreateInput?.focus();
      });
    });
  }

  function cancelInlineCreate() {
    inlineCreateParent = null;
    inlineCreateType = null;
    inlineCreateName = '';
  }

  async function commitInlineCreate() {
    if (!inlineCreateName.trim() || !inlineCreateParent || !inlineCreateType) {
      cancelInlineCreate();
      return;
    }
    const name = inlineCreateName.trim();
    const modPath = modStore.selectedModPath;
    if (!modPath) { cancelInlineCreate(); return; }

    if (inlineCreateType === 'file') {
      const relPath = `${modsFilePrefix}${inlineCreateParent}/${name}`;
      const dbPath = projectStore.stagingDbPath;
      try {
        await touchFile(modPath, relPath);
        if (dbPath) {
          await scriptWrite(dbPath, relPath, "");
        }
        await refreshModFiles();
        uiStore.openScriptTab(relPath);
      } catch (e) {
        toastStore.error("Failed to create file", String(e));
      }
    } else {
      const relPath = `${modsFilePrefix}${inlineCreateParent}/${name}`;
      try {
        await createModDirectory(modPath, relPath);
        await refreshModFiles();
      } catch (e) {
        toastStore.error("Failed to create folder", String(e));
      }
    }
    cancelInlineCreate();
  }

  // ── Clipboard state for cut/copy/paste ──
  let clipboardNode: FileTreeNode | null = $state(null);
  let clipboardOp: 'cut' | 'copy' | null = $state(null);

  async function pasteClipboardNode(targetNode: FileTreeNode) {
    if (!clipboardNode || !clipboardOp) return;
    const modPath = modStore.selectedModPath;
    if (!modPath) return;

    const srcRelPath = `${modsFilePrefix}${clipboardNode.relPath}`;
    const destDir = targetNode.isFile
      ? targetNode.relPath.substring(0, targetNode.relPath.lastIndexOf('/'))
      : targetNode.relPath;
    const destRelPath = `${modsFilePrefix}${destDir}/${clipboardNode.name}`;

    try {
      if (clipboardOp === 'cut') {
        await moveModFile(modPath, srcRelPath, destRelPath);
        const dbPath = projectStore.stagingDbPath;
        if (dbPath) {
          const content = await scriptRead(dbPath, srcRelPath);
          if (content !== null) {
            await scriptWrite(dbPath, destRelPath, content);
            await scriptDelete(dbPath, srcRelPath);
          }
        }
      } else {
        await copyModFile(modPath, srcRelPath, destRelPath);
        const dbPath = projectStore.stagingDbPath;
        if (dbPath) {
          const content = await scriptRead(dbPath, srcRelPath);
          if (content !== null) {
            await scriptWrite(dbPath, destRelPath, content);
          }
        }
      }
      await refreshModFiles();
      if (clipboardOp === 'cut') { clipboardNode = null; clipboardOp = null; }
    } catch (e) {
      toastStore.error("Paste failed", String(e));
    }
  }

  // ── Script creation modal state ──
  let showCreateScript = $state(false);
  let createScriptDefaultContext: 'Server' | 'Client' | 'Shared' | 'Other' = $state('Other');

  function deriveContextFromPath(relPath: string): 'Server' | 'Client' | 'Shared' | 'Other' {
    if (relPath.includes('Server')) return 'Server';
    if (relPath.includes('Client')) return 'Client';
    if (relPath.includes('Shared')) return 'Shared';
    return 'Other';
  }

  async function deleteScriptFile(node: FileTreeNode) {
    if (!node.isFile) return;
    if (!isScriptFile(node.extension) && node.extension !== 'json') return;
    const fullPath = `${modsFilePrefix}${node.relPath}`;
    const dbPath = projectStore.stagingDbPath;
    if (!dbPath) return;
    try {
      await scriptDelete(dbPath, fullPath);
      const tabId = `script:${fullPath}`;
      if (uiStore.openTabs.some(t => t.id === tabId)) uiStore.closeTab(tabId);
      await refreshModFiles();
      toastStore.success(m.file_explorer_delete_script(), node.name);
    } catch (e) {
      toastStore.error(m.file_explorer_delete_script(), String(e));
    }
  }

  /** Whether the context-menu target has a filesystem path that maps to a real directory */
  let ctxHasPath = $derived(!!ctxPath && !(ctxNode?.isGroup));

  /** Whether the context-menu target is a CF section that can receive entries */
  let ctxHasSection = $derived(!!ctxSection);

  function ctxAddEntry() {
    hideContextMenu();
    if (!ctxNode) return;
    openNode(ctxNode, false);
    // Dispatch a custom event so the opened SectionPanel can trigger "Add Entry"
    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent("explorer-add-entry", { detail: { section: ctxSection } }));
    });
  }

  function ctxViewVanillaData() {
    hideContextMenu();
    if (!ctxSection) return;
    // Open the section tab and dispatch event to switch to vanilla view
    if (ctxNode) openNode(ctxNode, false);
    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent("explorer-view-vanilla", { detail: { section: ctxSection } }));
    });
  }

  async function ctxRefreshSection() {
    hideContextMenu();
    if (!ctxSection) return;
    const table = sectionToTable(ctxSection);
    await projectStore.refreshSection(table);
    toastStore.success("Section refreshed");
  }

  async function ctxOpenInFileManager() {
    hideContextMenu();
    if (!ctxPath) return;
    try {
      await openPath(ctxPath);
    } catch (err: any) {
      toastStore.error(m.file_explorer_open_failed_title(), String(err?.message ?? err));
    }
  }

  async function ctxCopyPath() {
    hideContextMenu();
    if (!ctxPath) return;
    try {
      await navigator.clipboard.writeText(ctxPath);
      toastStore.success(m.file_explorer_path_copied());
    } catch {
      toastStore.error(m.file_explorer_copy_failed_title(), m.file_explorer_copy_failed_message());
    }
  }

  /** Count entries for a given CF section, optionally filtered */
  function getSectionCount(Section: string | undefined, entryFilter?: { field: string; value: string }): number {
    if (!Section) return 0;
    const sec = sectionMap.get(Section);
    let autoCount = 0;
    if (sec) {
      if (entryFilter) {
        autoCount = sec.entries.filter((e: DiffEntry) =>
          entryFilter.field === "node_id" ? e.node_id === entryFilter.value : e.raw_attributes?.[entryFilter.field] === entryFilter.value
        ).length;
      } else {
        autoCount = sec.entries.length;
      }
    }
    const manualCount = entryFilter ? 0 : (manualCountBySection.get(Section) ?? 0);
    return autoCount + manualCount;
  }

  /** Count entries across all CF sections in a group */
  function getGroupCount(node: FolderNode): number {
    if (node.groupSections) {
      return node.groupSections.reduce((sum, sec) => sum + getSectionCount(sec), 0);
    }
    if (node.Section) return getSectionCount(node.Section, node.entryFilter);
    if (node.children) {
      return node.children.reduce((sum, child) => sum + getGroupCount(child), 0);
    }
    return 0;
  }

  /** Check if a node (or any child) has scanned mod files */
  function hasModFiles(node: FolderNode): boolean {
    if (node.Section) {
      if (node.entryFilter) return getSectionCount(node.Section, node.entryFilter) > 0;
      return sections.some((s: SectionResult) => s.section === node.Section);
    }
    if (node.children) return node.children.some(hasModFiles);
    if (node.groupSections) {
      return node.groupSections.some(sec =>
        sections.some((s: SectionResult) => s.section === sec),
      );
    }
    return false;
  }

  /** Check if any child node has a CF section */
  function hasSection(node: FolderNode): boolean {
    if (node.Section) return true;
    if (node.groupSections) return true;
    if (node.children) return node.children.some(hasSection);
    return false;
  }

  /** Open a node as a tab */
  function openNode(node: FolderNode, preview = true): void {
    // Group folder → multi-section tab
    if (node.isGroup && node.groupSections) {
      uiStore.openTab({
        id: `group:${node.name}`,
        label: node.label,
        type: "group",
        category: node.name,
        groupSections: node.groupSections,
        icon: "📁",
        preview,
      });
    }
    // Filtered CF section (e.g., "Spell Lists" → Lists filtered by node_id=SpellList)
    else if (node.Section && node.entryFilter) {
      uiStore.openTab({
        id: `filtered:${node.name}`,
        label: node.label,
        type: "filteredSection",
        category: node.Section,
        entryFilter: node.entryFilter,
        icon: "📄",
        preview,
      });
    }
    // Single CF section → section tab
    else if (node.Section) {
      // Special handling for non-LSX sections
      const tabType = node.Section === "Localization" ? "localization" as const : "section" as const;
      uiStore.openTab({
        id: `section:${node.Section}`,
        label: node.label,
        type: tabType,
        category: node.Section,
        icon: "📄",
        preview,
      });
    }
    // LSX file or stats file → lsx-file tab
    else {
      uiStore.openTab({
        id: `folder:${node.name}`,
        label: node.label,
        type: "lsx-file",
        category: node.name,
        icon: "📄",
        preview,
      });
    }
  }

  function toggleOrOpen(node: FolderNode): void {
    if (node.children) {
      uiStore.toggleNode(node.name);
    } else {
      openNode(node);
    }
  }

  /** Open a section node and trigger "Add Entry" in the resulting tab. */
  function quickAddEntry(e: MouseEvent, node: FolderNode): void {
    e.stopPropagation();
    openNode(node, false);
    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent("explorer-add-entry", { detail: { section: node.Section } }));
    });
  }

  let isRootExpanded = $derived(uiStore.expandedNodes["root"] !== false);
  let isPublicExpanded = $derived(uiStore.expandedNodes["Public"] !== false);
  let isAdditionalExpanded = $derived(uiStore.expandedNodes["_Additional"] ?? false);
  let isModsExpanded = $derived(uiStore.expandedNodes["Mods"] ?? false);
  let isLocalizationExpanded = $derived(uiStore.expandedNodes["_Localization"] ?? false);
  let isScriptsExpanded = $derived(uiStore.expandedNodes["_Scripts"] ?? false);

  /** Filter a file tree to only include files with certain extensions (and parent folders). */
  function filterTree(nodes: FileTreeNode[], extensions: Set<string>): FileTreeNode[] {
    const result: FileTreeNode[] = [];
    for (const n of nodes) {
      if (n.isFile) {
        if (n.extension && extensions.has(n.extension)) {
          result.push(n);
        }
      } else if (n.children) {
        const filtered = filterTree(n.children, extensions);
        if (filtered.length > 0) {
          result.push({ ...n, children: filtered });
        }
      }
    }
    return result;
  }

  const LOCA_EXTENSIONS = new Set(["loca", "xml"]);
  const LUA_SE_EXTENSIONS = new Set(["lua", "yaml", "toml", "ini", "json"]);

  /** Localization tree: recursively filtered to .loca and .xml files. */
  let localizationTree = $derived.by((): FileTreeNode[] => {
    const locaDir = modFileTree.find(n => !n.isFile && n.name === "Localization");
    if (!locaDir?.children) return [];
    return filterTree(locaDir.children, LOCA_EXTENSIONS);
  });

  /** Lua SE tree: folder structure of ScriptExtender/ with script/config files. */
  let luaSeTree = $derived.by((): FileTreeNode[] => {
    const seDir = modFileTree.find(n => !n.isFile && n.name === "ScriptExtender");
    if (!seDir?.children) return [];
    return filterTree(seDir.children, LUA_SE_EXTENSIONS);
  });

  /** Script sub-categories derived from the mod file tree. */
  const SCRIPT_CATEGORIES = [
    { key: "lua-se", label: "Lua (SE)", dir: "ScriptExtender", extensions: LUA_SE_EXTENSIONS },
    { key: "osiris", label: "Osiris", dir: "Story/RawFiles/Goals", extensions: new Set(["txt"]) },
    { key: "khonsu", label: "Khonsu", dir: "Scripts", extensions: new Set(["khn"]) },
    { key: "anubis", label: "Anubis", dir: null, extensions: new Set(["anc", "ann", "anm"]) },
    { key: "constellations", label: "Constellations", dir: null, extensions: new Set(["clc", "cln", "clm"]) },
  ];

  /** Collect script files per category, counting files for badge. */
  let scriptCounts = $derived.by((): Map<string, number> => {
    const counts = new Map<string, number>();
    function countFiles(nodes: FileTreeNode[]): void {
      for (const n of nodes) {
        if (n.isFile && n.extension) {
          for (const cat of SCRIPT_CATEGORIES) {
            if (cat.dir) {
              if (cat.extensions.has(n.extension) && n.relPath.startsWith(cat.dir)) {
                counts.set(cat.key, (counts.get(cat.key) ?? 0) + 1);
              }
            } else if (cat.extensions.has(n.extension)) {
              counts.set(cat.key, (counts.get(cat.key) ?? 0) + 1);
            }
          }
        }
        if (n.children) countFiles(n.children);
      }
    }
    countFiles(modFileTree);
    return counts;
  });

  let totalScriptCount = $derived.by(() => {
    let sum = 0;
    for (const v of scriptCounts.values()) sum += v;
    return sum;
  });

  /**
   * DB-discovered sections not in the static sidebar tree.
   * Splits into routing categories for injection into specific groups:
   *  - cc: CharacterCreation-prefixed → injected into CC core folder
   *  - content: *Bank* patterns → injected into _Content core folder
   *  - vfx: Effect* patterns → injected into _VFX additional folder
   *  - sound: Sound* patterns (but not "Sound" itself) → injected into _Sound additional folder
   *  - general: everything else → merged into the Additional Data pool
   */
  let allDiscovered = $derived.by((): { cc: FolderNode[]; content: FolderNode[]; vfx: FolderNode[]; sound: FolderNode[]; general: FolderNode[] } => {
    if (!schemaStore.loaded) return { cc: [], content: [], vfx: [], sound: [], general: [] };
    const cc: FolderNode[] = [];
    const content: FolderNode[] = [];
    const vfx: FolderNode[] = [];
    const sound: FolderNode[] = [];
    const general: FolderNode[] = [];
    for (const [sectionKey, schemas] of schemaStore.sectionEntries()) {
      if (STATIC_SIDEBAR_SECTIONS.has(sectionKey)) continue;
      if (SECTIONS_EXCLUDED_FROM_DISCOVERY.has(sectionKey)) continue;
      // Stats schemas (stats:SpellData etc.) are represented by the Stats folder tree
      if (sectionKey.startsWith("stats:")) continue;
      // Skip sections where every schema has 0 attributes (no useful data structure)
      if (schemas.every(s => s.attributes.length === 0)) continue;
      const primary = schemas[0];
      if (!primary) continue;
      const node: FolderNode = {
        name: sectionKey,
        label: sectionKey.replace(/([A-Z])/g, " $1").trim(),
        nodeTypes: schemas.map(s => s.node_id),
        Section: sectionKey,
        regionId: sectionKey,
      };
      if (sectionKey.startsWith("CharacterCreation")) {
        cc.push(node);
      } else if (/^Effect/i.test(sectionKey)) {
        // Effect* (including EffectBanks) → VFX
        vfx.push(node);
      } else if (/Bank/i.test(sectionKey) || /Visual/i.test(sectionKey)) {
        content.push(node);
      } else if (/^Sound/i.test(sectionKey) && sectionKey !== "Sound") {
        sound.push(node);
      } else {
        general.push(node);
      }
    }
    const sorter = (a: FolderNode, b: FolderNode) => a.label.localeCompare(b.label);
    cc.sort(sorter);
    content.sort(sorter);
    vfx.sort(sorter);
    sound.sort(sorter);
    general.sort(sorter);
    return { cc, content, vfx, sound, general };
  });

  /** Core folders with discovered sections injected into matching groups. */
  let enrichedCoreFolders = $derived.by((): FolderNode[] => {
    const ccExtra = allDiscovered.cc;
    const contentExtra = allDiscovered.content;
    const vfxExtra = allDiscovered.vfx;
    if (ccExtra.length === 0 && contentExtra.length === 0 && vfxExtra.length === 0) return BG3_CORE_FOLDERS;
    return BG3_CORE_FOLDERS.map(f => {
      if (f.name === "_CharacterCreation" && f.children && ccExtra.length > 0) {
        return { ...f, children: [...f.children, ...ccExtra] };
      }
      if (f.name === "_Content" && f.children && contentExtra.length > 0) {
        return { ...f, children: [...f.children, ...contentExtra] };
      }
      if (f.name === "_VFX" && f.children && vfxExtra.length > 0) {
        return { ...f, children: [...f.children, ...vfxExtra] };
      }
      return f;
    });
  });

  /** Additional folders merged with general discovered sections, sorted alphabetically. */
  let mergedAdditionalSections = $derived.by((): FolderNode[] => {
    const combined = [...BG3_ADDITIONAL_FOLDERS];
    // Inject discovered sections into Sound group
    const soundExtra = allDiscovered.sound;
    if (soundExtra.length > 0) {
      for (let i = 0; i < combined.length; i++) {
        const node = combined[i];
        if (node.name === "_Sound" && node.children && soundExtra.length > 0) {
          combined[i] = { ...node, children: [...node.children, ...soundExtra] };
        }
      }
    }
    // Add remaining general discovered sections
    combined.push(...allDiscovered.general);
    combined.sort((a, b) => a.label.localeCompare(b.label));
    return combined;
  });

  /** Derive the active node name/section from the current tab */
  let activeNodeKey = $derived.by(() => {
    const tab = uiStore.activeTab;
    if (!tab) return "";
    if (tab.type === "group") return tab.category ?? "";
    if (tab.type === "filteredSection") return tab.id.replace("filtered:", "");
    if (tab.type === "section") return tab.category ?? "";
    if (tab.type === "lsx-file") return tab.category ?? "";
    if (tab.type === "meta-lsx") return "meta.lsx";
    if (tab.type === "readme") return "readme";
    if (tab.type === "localization") return "localization-root";
    if (tab.type === "file-preview") return `file:${tab.filePath ?? ""}`;
    if (tab.type === "script-editor") return `file:${tab.filePath ?? ""}`;
    return "";
  });

  /** Check if a node matches the active tab */
  function isActiveNode(node: FolderNode): boolean {
    if (!activeNodeKey) return false;
    if (node.name === activeNodeKey) return true;
    if (node.Section === activeNodeKey) return true;
    return false;
  }

  /** Check if a file tree node is the active file-preview tab */
  function isActiveFile(relPath: string): boolean {
    return activeNodeKey === `file:${modsFilePrefix}${relPath}`;
  }

  /** Prefix to re-add to stripped file tree relPaths for IPC calls. */
  let modsFilePrefix = $derived(modFolder ? `Mods/${modFolder}/` : "");

  /** Open a mod file in a file-preview tab */
  function openFilePreview(fileNode: FileTreeNode, preview = true): void {
    const fileName = fileNode.name;
    const fullRelPath = `${modsFilePrefix}${fileNode.relPath}`;

    // Script files open in the script editor
    if (isScriptFile(fileNode.extension)) {
      uiStore.openScriptTab(fullRelPath);
      return;
    }

    // Osiris goal files (.txt in Story/RawFiles/Goals/) open in script editor
    if (fileNode.extension === "txt" && fileNode.relPath.includes("Story/RawFiles/Goals/")) {
      uiStore.openScriptTab(fullRelPath);
      return;
    }

    uiStore.openTab({
      id: `file:${fullRelPath}`,
      label: fileName,
      type: "file-preview",
      filePath: fullRelPath,
      icon: "📄",
      preview,
    });
  }
</script>

<div class="file-explorer" onclick={hideContextMenu} role="none">
  <div class="explorer-header">
    <span class="text-[10px] font-semibold tracking-widest uppercase text-[var(--th-text-500)]">Explorer</span>
    {#if scanResult}
      <button
        class="ml-auto p-1 rounded text-[var(--th-text-500)] hover:text-[var(--th-text-200)] hover:bg-[var(--th-bg-700)] transition-colors"
        title="Refresh all sections"
        aria-label="Refresh all sections"
        onclick={async () => {
          refreshingAll = true;
          try { await Promise.all([projectStore.refreshAllSections(), refreshModFiles()]); }
          finally { refreshingAll = false; }
        }}
      >
        <RefreshCw size={14} class={refreshingAll ? 'animate-spin' : ''} />
      </button>
      <button
        class="p-1 rounded text-[var(--th-text-500)] hover:text-[var(--th-text-200)] hover:bg-[var(--th-bg-700)] transition-colors"
        title="Package project"
        aria-label="Package project"
        onclick={() => commandRegistry.execute('action.packageProject')}
      >
        <Package size={14} />
      </button>
      <button
        class="p-1 rounded text-[var(--th-text-500)] hover:text-[var(--th-text-200)] hover:bg-[var(--th-bg-700)] transition-colors"
        title="Open a different project"
        aria-label="Open project folder"
        onclick={async () => {
          try {
            const selected = await open({ directory: true, title: m.header_select_mod_folder() });
            if (selected == null) return;
            const p = Array.isArray(selected) ? selected[0] : String(selected);
            await scanAndImport(p);
          } catch (e) { console.error("Dialog error:", e); }
        }}
      >
        <FolderOpen size={14} />
      </button>
    {/if}
  </div>

  {#if !scanResult}
    <div class="empty-state">
      <p class="text-xs text-[var(--th-text-500)] mb-4">No mod loaded.</p>
      <div class="flex flex-col gap-2 px-4">
        <button
          class="flex items-center gap-2 w-full px-3 py-2 rounded text-left text-xs
                 bg-[var(--th-bg-700)]/60 border border-[var(--th-border-700)]
                 hover:bg-[var(--th-bg-600)]/80 hover:border-[var(--th-border-600)] transition-colors"
          onclick={async () => {
            try {
              const selected = await open({ directory: true, title: m.header_select_mod_folder() });
              if (selected == null) return;
              const p = Array.isArray(selected) ? selected[0] : String(selected);
              await scanAndImport(p);
            } catch (e) { console.error("Dialog error:", e); }
          }}
        >
          <FolderOpen size={14} class="text-[var(--th-accent-500,#0ea5e9)] shrink-0" />
          <span class="text-[var(--th-text-200)]">Open Project</span>
        </button>
        <button
          class="flex items-center gap-2 w-full px-3 py-2 rounded text-left text-xs
                 bg-[var(--th-bg-700)]/60 border border-[var(--th-border-700)]
                 hover:bg-[var(--th-bg-600)]/80 hover:border-[var(--th-border-600)] transition-colors"
          onclick={() => uiStore.showCreateModModal = true}
        >
          <FilePlus2 size={14} class="text-emerald-400 shrink-0" />
          <span class="text-[var(--th-text-200)]">New Project</span>
        </button>
      </div>
    </div>
  {:else}
    <div class="tree-root" class:scanning={modStore.isScanning} role="tree" aria-busy={modStore.isScanning} inert={modStore.isScanning ? true : undefined}>
      <!-- Root: Mod name -->
      <button class="tree-node root-node" onclick={() => { uiStore.expandNode("root"); uiStore.openTab({ id: "meta.lsx", label: "meta.lsx", type: "meta-lsx", category: "meta", icon: "⚙" }); }} oncontextmenu={(e) => showContextMenu(e, resolveNodePath("", "root"), modName)}>
        <ChevronRight size={14} class="chevron {isRootExpanded ? 'expanded' : ''}" />
        <Cog size={14} class="text-[var(--th-text-emerald-400)]" />
        <span class="node-label font-semibold truncate">{modName}</span>
      </button>

      {#if isRootExpanded}
        <!-- ── Public/{ModFolder} ── -->
        <div class="tree-children">
          <button class="tree-node" onclick={() => uiStore.toggleNode("Public")} oncontextmenu={(e) => showContextMenu(e, `${modStore.selectedModPath}/Public/${modFolder}`, `Public/${modFolder}`)}>
            <ChevronRight size={14} class="chevron {isPublicExpanded ? 'expanded' : ''}" />
            {#if isPublicExpanded}
              <FolderOpen size={14} class="text-[var(--th-text-amber-400)]" />
            {:else}
              <Folder size={14} class="text-[var(--th-text-amber-400)]" />
            {/if}
            <span class="node-label">Public/{modFolder}</span>
          </button>

          {#if isPublicExpanded}
            <div class="tree-children">
              <!-- Core modding folders (with groupings) -->
              {#each enrichedCoreFolders as node (node.name)}
                {@const count = getGroupCount(node)}
                {@const active = hasModFiles(node)}
                {@const isExpanded = uiStore.expandedNodes[node.name] ?? false}
                {@const isCf = hasSection(node)}

                {#if node.children}
                  <!-- Group/folder node with children -->
                  <div
                    class="tree-node"
                    class:has-files={active}
                    class:active-node={isActiveNode(node)}
                    oncontextmenu={(e) => showContextMenu(e, resolveNodePath(node.name, 'public-folder'), node.label, node.Section, node)}
                    role="treeitem"
                    tabindex="0"
                    aria-selected="false"
                    aria-expanded={isExpanded}
                    aria-level={3}
                  >
                    <span class="chevron-hit" onclick={(e) => { e.stopPropagation(); uiStore.toggleNode(node.name); }} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); uiStore.toggleNode(node.name); } }} role="button" tabindex="0" aria-label="Toggle {node.label}">
                      <ChevronRight size={14} class="chevron {isExpanded ? 'expanded' : ''}" />
                    </span>
                    <button class="tree-node-label" onclick={() => { if (node.isGroup && node.groupSections) openNode(node); else uiStore.toggleNode(node.name); }} ondblclick={() => { if (node.isGroup && node.groupSections) openNode(node, false); }}>
                      {#if isExpanded}
                        <FolderOpen size={14} class={active ? "text-[var(--th-text-sky-400)]" : "text-[var(--th-text-600)] opacity-40"} />
                      {:else}
                        <Folder size={14} class={active ? "text-[var(--th-text-sky-400)]" : "text-[var(--th-text-600)] opacity-40"} />
                      {/if}
                      <span class="node-label truncate" class:text-muted={!active}>{node.label}</span>
                      {#if count > 0}
                        <span class="entry-count">{count}</span>
                      {/if}
                    </button>
                  </div>

                  {#if isExpanded}
                    <div class="tree-children">
                      {#each node.children as child (child.name)}
                        {@const childCount = getGroupCount(child)}
                        {@const childActive = hasModFiles(child)}
                        {@const childCf = hasSection(child)}
                        {@const childExpanded = uiStore.expandedNodes[child.name] ?? false}

                        {#if child.children}
                          <!-- Nested group (e.g., sub-categorized lists) -->
                          <div
                            class="tree-node"
                            class:has-files={childActive}
                            role="treeitem"
                            aria-selected="false"
                            aria-expanded={childExpanded}
                            aria-level={4}
                          >
                            <span class="chevron-hit" onclick={(e) => { e.stopPropagation(); uiStore.toggleNode(child.name); }} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); uiStore.toggleNode(child.name); } }} role="button" tabindex="0" aria-label="Toggle {child.label}">
                              <ChevronRight size={14} class="chevron {childExpanded ? 'expanded' : ''}" />
                            </span>
                            <button class="tree-node-label" onclick={() => { if (child.isGroup && child.groupSections) { openNode(child); uiStore.expandNode(child.name); } else uiStore.toggleNode(child.name); }} ondblclick={() => { if (child.isGroup && child.groupSections) openNode(child, false); }}>
                              <Folder size={14} class={childActive ? "text-[var(--th-text-sky-400)] opacity-60" : "text-[var(--th-text-600)] opacity-30"} />
                              <span class="node-label truncate" class:text-muted={!childActive}>{child.label}</span>
                              {#if childCount > 0}
                                <span class="entry-count">{childCount}</span>
                              {/if}
                            </button>
                          </div>
                          {#if childExpanded}
                            <div class="tree-children">
                              {#each child.children as grandchild (grandchild.name)}
                                <button class="tree-node" class:has-files={hasModFiles(grandchild)} onclick={() => openNode(grandchild)} ondblclick={() => openNode(grandchild, false)} oncontextmenu={(e) => showContextMenu(e, resolveNodePath(grandchild.name, 'public-child'), grandchild.label, grandchild.Section, grandchild)}>
                                  <span class="w-3.5 shrink-0"></span>
                                  <File size={14} class={hasModFiles(grandchild) ? "text-[var(--th-text-sky-400)]" : "text-[var(--th-text-600)] opacity-40"} />
                                  <span class="node-label truncate" class:text-muted={!hasModFiles(grandchild)}>{grandchild.label}</span>
                                </button>
                              {/each}
                            </div>
                          {/if}
                        {:else}
                          <!-- Leaf child -->
                          <button class="tree-node" class:has-files={childActive} class:active-node={isActiveNode(child)} onclick={() => openNode(child)} ondblclick={() => openNode(child, false)} oncontextmenu={(e) => showContextMenu(e, resolveNodePath(child.name, 'public-child'), child.label, child.Section, child)}>
                            <span class="w-3.5 shrink-0"></span>
                            <File size={14} class={childActive ? "text-[var(--th-text-sky-400)]" : "text-[var(--th-text-600)] opacity-40"} />
                            <span class="node-label truncate" class:text-muted={!childActive}>{child.label}</span>
                            {#if childCount > 0}
                              <span class="entry-count">{childCount}</span>
                            {/if}
                            {#if child.Section}
                              <span class="add-entry-btn" onclick={(e) => quickAddEntry(e, child)} onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); quickAddEntry(e as any, child); } }} role="button" tabindex="0" aria-label="Add entry to {child.label}">
                                <Plus size={12} />
                              </span>
                            {/if}
                          </button>
                        {/if}
                      {/each}
                    </div>
                  {/if}

                {:else}
                  <!-- Leaf node (no children) -->
                  <button
                    class="tree-node"
                    class:has-files={active}
                    class:active-node={isActiveNode(node)}
                    onclick={() => openNode(node)}
                    ondblclick={() => openNode(node, false)}
                    oncontextmenu={(e) => showContextMenu(e, resolveNodePath(node.name, 'public-folder'), node.label, node.Section, node)}
                  >
                    <span class="w-3.5 shrink-0"></span>
                    <File size={14} class={active ? "text-[var(--th-text-sky-400)]" : "text-[var(--th-text-600)] opacity-40"} />
                    <span class="node-label truncate" class:text-muted={!active}>{node.label}</span>
                    {#if count > 0}
                      <span class="entry-count">{count}</span>
                    {/if}
                    {#if node.Section}
                      <span class="add-entry-btn" onclick={(e) => quickAddEntry(e, node)} onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); quickAddEntry(e as any, node); } }} role="button" tabindex="0" aria-label="Add entry to {node.label}">
                        <Plus size={12} />
                      </span>
                    {/if}
                  </button>
                {/if}
              {/each}

              <!-- Additional Data separator (merges static + DB-discovered) -->
              <button
                class="tree-node separator-node"
                onclick={() => uiStore.toggleNode("_Additional")}
              >
                <ChevronRight size={14} class="chevron {isAdditionalExpanded ? 'expanded' : ''}" />
                {#if isAdditionalExpanded}
                  <FolderOpen size={14} class="text-[var(--th-text-600)] opacity-50" />
                {:else}
                  <Folder size={14} class="text-[var(--th-text-600)] opacity-50" />
                {/if}
                <span class="node-label text-[var(--th-text-600)] text-[10px] uppercase tracking-wider">Additional Data</span>
              </button>

              {#if isAdditionalExpanded}
                <div class="tree-children">
                  {#each mergedAdditionalSections as node (node.name)}
                    {#if node.children}
                      <!-- Group node (e.g., Ruleset, Controller) -->
                      {@const grpCount = getGroupCount(node)}
                      {@const grpActive = node.children.some(c => hasModFiles(c))}
                      {@const grpExpanded = uiStore.expandedNodes[node.name] ?? false}
                      <div
                        class="tree-node"
                        class:has-files={grpActive}
                        role="treeitem"
                        tabindex="0"
                        aria-selected="false"
                        aria-expanded={grpExpanded}
                      >
                        <span class="chevron-hit" onclick={(e) => { e.stopPropagation(); uiStore.toggleNode(node.name); }} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); uiStore.toggleNode(node.name); } }} role="button" tabindex="0" aria-label="Toggle {node.label}">
                          <ChevronRight size={14} class="chevron {grpExpanded ? 'expanded' : ''}" />
                        </span>
                        <button class="tree-node-label" onclick={() => { if (node.isGroup && node.groupSections) openNode(node); else uiStore.toggleNode(node.name); }}>
                          {#if grpExpanded}
                            <FolderOpen size={14} class={grpActive ? "text-[var(--th-text-sky-400)]" : "text-[var(--th-text-600)] opacity-40"} />
                          {:else}
                            <Folder size={14} class={grpActive ? "text-[var(--th-text-sky-400)]" : "text-[var(--th-text-600)] opacity-40"} />
                          {/if}
                          <span class="node-label truncate" class:text-muted={!grpActive}>{node.label}</span>
                          {#if grpCount > 0}
                            <span class="entry-count">{grpCount}</span>
                          {/if}
                        </button>
                      </div>
                      {#if grpExpanded}
                        <div class="tree-children">
                          {#each node.children as child (child.name)}
                            {@const childCount = getSectionCount(child.Section ?? child.name)}
                            <button class="tree-node" class:has-files={childCount > 0} class:active-node={isActiveNode(child)} onclick={() => openNode(child)} ondblclick={() => openNode(child, false)} oncontextmenu={(e) => showContextMenu(e, resolveNodePath(child.name, 'additional'), child.label, child.Section, child)}>
                              <span class="w-3.5 shrink-0"></span>
                              <File size={14} class={childCount > 0 ? "text-[var(--th-text-sky-400)]" : "text-[var(--th-text-600)] opacity-40"} />
                              <span class="node-label truncate" class:text-muted={childCount === 0}>{child.label}</span>
                              {#if childCount > 0}
                                <span class="entry-count">{childCount}</span>
                              {/if}
                            </button>
                          {/each}
                        </div>
                      {/if}
                    {:else}
                      <!-- Leaf node -->
                      {@const adCount = getSectionCount(node.Section ?? node.name)}
                      <button class="tree-node" class:has-files={adCount > 0} class:active-node={isActiveNode(node)} onclick={() => openNode(node)} ondblclick={() => openNode(node, false)} oncontextmenu={(e) => showContextMenu(e, resolveNodePath(node.name, 'additional'), node.label, node.Section, node)}>
                        <span class="w-3.5 shrink-0"></span>
                        <File size={14} class={adCount > 0 ? "text-[var(--th-text-sky-400)]" : "text-[var(--th-text-600)] opacity-40"} />
                        <span class="node-label truncate" class:text-muted={adCount === 0}>{node.label}</span>
                        {#if adCount > 0}
                          <span class="entry-count">{adCount}</span>
                        {/if}
                      </button>
                    {/if}
                  {/each}
                </div>
              {/if}

              <!-- ── Stats/Generated/Data (merged into core via _Stats group) ── -->
            </div>
          {/if}
        </div>

        <!-- ── Mods/{ModFolder} ── -->
        <div class="tree-children">
          <button class="tree-node" onclick={() => uiStore.toggleNode("Mods")} oncontextmenu={(e) => showContextMenu(e, resolveNodePath("", "mods"), `Mods/${modFolder}`)}>
            <ChevronRight size={14} class="chevron {isModsExpanded ? 'expanded' : ''}" />
            {#if isModsExpanded}
              <FolderOpen size={14} class="text-[var(--th-text-indigo-400)]" />
            {:else}
              <Folder size={14} class="text-[var(--th-text-indigo-400)]" />
            {/if}
            <span class="node-label">Mods/{modFolder}</span>
          </button>

          {#if isModsExpanded}
            <div class="tree-children">
              {#if modFileTree.length > 0}
                {#snippet modFileNode(node: FileTreeNode)}
                  {#if node.isFile}
                    <button
                      class="tree-node has-files"
                      class:active-node={isActiveFile(node.relPath)}
                      onclick={() => openFilePreview(node)}
                      ondblclick={() => openFilePreview(node, false)}
                      oncontextmenu={(e) => showFileContextMenu(e, node)}
                      onkeydown={(e) => { if (e.key === 'Delete') { deleteScriptFile(node); } }}
                      onmouseenter={() => { hoveredNode = node.relPath; }}
                      onmouseleave={() => { hoveredNode = null; }}
                    >
                      <span class="w-3.5 shrink-0"></span>
                      <File size={14} class="text-[var(--th-text-emerald-400)]" />
                      <span class="node-label truncate">{node.name}</span>
                      {#if hoveredNode === node.relPath}
                        <span class="hover-actions">
                          <span
                            role="button"
                            tabindex="0"
                            class="hover-action-btn"
                            title="New File"
                            onclick={(e) => { e.stopPropagation(); const parentPath = node.relPath.substring(0, node.relPath.lastIndexOf('/')); startInlineCreate(parentPath, 'file'); }}
                            onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); const parentPath = node.relPath.substring(0, node.relPath.lastIndexOf('/')); startInlineCreate(parentPath, 'file'); } }}
                          >
                            <FilePlus2 size={12} />
                          </span>
                          <span
                            role="button"
                            tabindex="0"
                            class="hover-action-btn"
                            title="New Folder"
                            onclick={(e) => { e.stopPropagation(); const parentPath = node.relPath.substring(0, node.relPath.lastIndexOf('/')); startInlineCreate(parentPath, 'folder'); }}
                            onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); const parentPath = node.relPath.substring(0, node.relPath.lastIndexOf('/')); startInlineCreate(parentPath, 'folder'); } }}
                          >
                            <FolderPlus size={12} />
                          </span>
                        </span>
                      {:else}
                        {#if node.extension}
                          <span class="ext-badge" style="background: {EXT_BADGE_COLORS[node.extension] ?? EXT_BADGE_FALLBACK}">.{node.extension}</span>
                        {/if}
                        {#if getSeContextBadge(node.relPath)}
                          {@const seBadge = getSeContextBadge(node.relPath)!}
                          <span class="se-ctx-badge" style="background: {seBadge.color}">{seBadge.label}</span>
                        {/if}
                      {/if}
                    </button>
                  {:else}
                    {@const expanded = uiStore.expandedNodes[`modfile:${node.relPath}`] ?? false}
                    <button class="tree-node has-files"
                      onclick={() => uiStore.toggleNode(`modfile:${node.relPath}`)}
                      oncontextmenu={(e) => showFileContextMenu(e, node)}
                      onmouseenter={() => { hoveredNode = node.relPath; }}
                      onmouseleave={() => { hoveredNode = null; }}
                    >
                      <ChevronRight size={14} class="chevron {expanded ? 'expanded' : ''}" />
                      {#if expanded}
                        <FolderOpen size={14} class="text-[var(--th-text-indigo-400)]" />
                      {:else}
                        <Folder size={14} class="text-[var(--th-text-indigo-400)]" />
                      {/if}
                      <span class="node-label truncate">{node.name}</span>
                      {#if hoveredNode === node.relPath}
                        <span class="hover-actions">
                          <span
                            role="button"
                            tabindex="0"
                            class="hover-action-btn"
                            title="New File"
                            onclick={(e) => { e.stopPropagation(); startInlineCreate(node.relPath, 'file'); }}
                            onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); startInlineCreate(node.relPath, 'file'); } }}
                          >
                            <FilePlus2 size={12} />
                          </span>
                          <span
                            role="button"
                            tabindex="0"
                            class="hover-action-btn"
                            title="New Folder"
                            onclick={(e) => { e.stopPropagation(); startInlineCreate(node.relPath, 'folder'); }}
                            onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); startInlineCreate(node.relPath, 'folder'); } }}
                          >
                            <FolderPlus size={12} />
                          </span>
                        </span>
                      {/if}
                    </button>
                    {#if expanded && node.children}
                      <div class="tree-children">
                        {#if inlineCreateParent === node.relPath}
                          <div class="tree-node inline-create">
                            <span class="w-3.5 shrink-0"></span>
                            {#if inlineCreateType === 'folder'}
                              <Folder size={14} class="text-[var(--th-text-indigo-400)]" />
                            {:else}
                              <File size={14} class="text-[var(--th-text-emerald-400)]" />
                            {/if}
                            <input
                              bind:this={inlineCreateInput}
                              bind:value={inlineCreateName}
                              class="inline-create-input"
                              placeholder={inlineCreateType === 'folder' ? 'folder name' : 'filename.lua'}
                              onkeydown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); commitInlineCreate(); }
                                if (e.key === 'Escape') { e.preventDefault(); cancelInlineCreate(); }
                              }}
                              onblur={() => { if (inlineCreateName.trim()) commitInlineCreate(); else cancelInlineCreate(); }}
                            />
                          </div>
                        {/if}
                        {#each node.children as child (child.relPath)}
                          {@render modFileNode(child)}
                        {/each}
                      </div>
                    {/if}
                  {/if}
                {/snippet}
                {#each modFileTree as treeNode (treeNode.relPath)}
                  {@render modFileNode(treeNode)}
                {/each}
              {:else}
                <span class="tree-node text-muted" style="padding-left: 28px; cursor: default; font-size: 11px; opacity: 0.5;">No text files found</span>
              {/if}
            </div>
          {/if}
        </div>

        <!-- ── Root-level: Readme ── -->
        <button
          class="tree-node"
          class:active-node={activeNodeKey === 'readme'}
          onclick={() => uiStore.openTab({ id: "readme", label: "README.md", type: "readme", icon: "📝" })}
        >
          <span class="w-3.5 shrink-0"></span>
          <BookOpen size={14} class="text-[var(--th-text-sky-400)]" />
          <span class="node-label">Readme</span>
        </button>

        <!-- ── Root-level: Localization ── -->
        <div>
          <div
            class="tree-node"
            class:active-node={activeNodeKey === 'localization-root'}
            role="treeitem"
            tabindex="-1"
            aria-selected={activeNodeKey === 'localization-root'}
            aria-expanded={isLocalizationExpanded}
            oncontextmenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const zoom = getComputedZoom(e.currentTarget as HTMLElement);
              locaCtxX = e.clientX / zoom;
              locaCtxY = e.clientY / zoom;
              locaCtxVisible = true;
            }}
          >
            <span class="chevron-hit" onclick={(e) => { e.stopPropagation(); uiStore.toggleNode('_Localization'); }} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); uiStore.toggleNode('_Localization'); } }} role="button" tabindex="0" aria-label="Toggle Localization">
              <ChevronRight size={14} class="chevron {isLocalizationExpanded ? 'expanded' : ''}" />
            </span>
            <button class="tree-node-label" onclick={() => uiStore.openTab({ id: "section:Localization", label: "Localization", type: "localization", category: "Localization", icon: "🌐" })}>
              <Languages size={14} class="text-[var(--th-text-amber-400)]" />
              <span class="node-label">Localization</span>
            </button>
          </div>
          {#if isLocalizationExpanded}
            <div class="tree-children">
              {#snippet locaNode(node: FileTreeNode)}
                {#if node.isFile}
                  <button
                    class="tree-node has-files"
                    class:active-node={isActiveFile(node.relPath)}
                    onclick={() => openFilePreview(node)}
                    ondblclick={() => openFilePreview(node, false)}
                  >
                    <span class="w-3.5 shrink-0"></span>
                    <File size={14} class="text-[var(--th-text-amber-400)]" />
                    <span class="node-label truncate">{node.name}</span>
                    {#if node.extension}
                      <span class="ext-badge" style="background: {EXT_BADGE_COLORS[node.extension] ?? EXT_BADGE_FALLBACK}">.{node.extension}</span>
                    {/if}
                  </button>
                {:else}
                  {@const expanded = uiStore.expandedNodes[`loca:${node.relPath}`] ?? false}
                  <button class="tree-node has-files" onclick={() => uiStore.toggleNode(`loca:${node.relPath}`)}>
                    <ChevronRight size={14} class="chevron {expanded ? 'expanded' : ''}" />
                    {#if expanded}
                      <FolderOpen size={14} class="text-[var(--th-text-amber-400)]" />
                    {:else}
                      <Folder size={14} class="text-[var(--th-text-amber-400)]" />
                    {/if}
                    <span class="node-label truncate">{node.name}</span>
                  </button>
                  {#if expanded && node.children}
                    <div class="tree-children">
                      {#each node.children as child (child.relPath)}
                        {@render locaNode(child)}
                      {/each}
                    </div>
                  {/if}
                {/if}
              {/snippet}
              {#if localizationTree.length > 0}
                {#each localizationTree as treeNode (treeNode.relPath)}
                  {@render locaNode(treeNode)}
                {/each}
              {:else}
                <span class="tree-node text-muted" style="padding-left: 28px; cursor: default; font-size: 11px; opacity: 0.5;">No localization files</span>
              {/if}
            </div>
          {/if}
        </div>

        <!-- ── Root-level: Scripts ── -->
        <div>
          <div
            class="tree-node"
            role="treeitem"
            tabindex="-1"
            aria-selected={false}
            aria-expanded={isScriptsExpanded}
            oncontextmenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const zoom = getComputedZoom(e.currentTarget as HTMLElement);
              scriptsCtxX = e.clientX / zoom;
              scriptsCtxY = e.clientY / zoom;
              scriptsCtxVisible = true;
            }}
          >
            <span class="chevron-hit" onclick={(e) => { e.stopPropagation(); uiStore.toggleNode('_Scripts'); }} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); uiStore.toggleNode('_Scripts'); } }} role="button" tabindex="0" aria-label="Toggle Scripts">
              <ChevronRight size={14} class="chevron {isScriptsExpanded ? 'expanded' : ''}" />
            </span>
            <button class="tree-node-label" onclick={() => uiStore.toggleNode('_Scripts')}>
              <FileCode size={14} class="text-[var(--th-text-emerald-400)]" />
              <span class="node-label">Scripts</span>
              {#if totalScriptCount > 0}
                <span class="entry-count">{totalScriptCount}</span>
              {/if}
            </button>
          </div>
          {#if isScriptsExpanded}
            <div class="tree-children">
              {#snippet scriptNode(node: FileTreeNode)}
                {#if node.isFile}
                  <button
                    class="tree-node has-files"
                    class:active-node={isActiveFile(node.relPath)}
                    onclick={() => openFilePreview(node)}
                    ondblclick={() => openFilePreview(node, false)}
                    oncontextmenu={(e) => showFileContextMenu(e, node)}
                    onkeydown={(e) => { if (e.key === 'Delete') { deleteScriptFile(node); } }}
                    onmouseenter={() => { hoveredNode = node.relPath; }}
                    onmouseleave={() => { hoveredNode = null; }}
                  >
                    <span class="w-3.5 shrink-0"></span>
                    <File size={14} class="text-[var(--th-text-emerald-400)]" />
                    <span class="node-label truncate">{node.name}</span>
                    {#if hoveredNode === node.relPath}
                      <span class="hover-actions">
                        <span
                          role="button"
                          tabindex="0"
                          class="hover-action-btn"
                          title="New File"
                          onclick={(e) => { e.stopPropagation(); const parentPath = node.relPath.substring(0, node.relPath.lastIndexOf('/')); startInlineCreate(parentPath, 'file'); }}
                          onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); const parentPath = node.relPath.substring(0, node.relPath.lastIndexOf('/')); startInlineCreate(parentPath, 'file'); } }}
                        >
                          <FilePlus2 size={12} />
                        </span>
                        <span
                          role="button"
                          tabindex="0"
                          class="hover-action-btn"
                          title="New Folder"
                          onclick={(e) => { e.stopPropagation(); const parentPath = node.relPath.substring(0, node.relPath.lastIndexOf('/')); startInlineCreate(parentPath, 'folder'); }}
                          onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); const parentPath = node.relPath.substring(0, node.relPath.lastIndexOf('/')); startInlineCreate(parentPath, 'folder'); } }}
                        >
                          <FolderPlus size={12} />
                        </span>
                      </span>
                    {:else}
                      {#if node.extension}
                        <span class="ext-badge" style="background: {EXT_BADGE_COLORS[node.extension] ?? EXT_BADGE_FALLBACK}">.{node.extension}</span>
                      {/if}
                      {#if getSeContextBadge(node.relPath)}
                        {@const seBadge = getSeContextBadge(node.relPath)!}
                        <span class="se-ctx-badge" style="background: {seBadge.color}">{seBadge.label}</span>
                      {/if}
                    {/if}
                  </button>
                {:else}
                  {@const expanded = uiStore.expandedNodes[`script:${node.relPath}`] ?? false}
                  <button class="tree-node has-files"
                    onclick={() => uiStore.toggleNode(`script:${node.relPath}`)}
                    oncontextmenu={(e) => showFileContextMenu(e, node)}
                    onmouseenter={() => { hoveredNode = node.relPath; }}
                    onmouseleave={() => { hoveredNode = null; }}
                  >
                    <ChevronRight size={14} class="chevron {expanded ? 'expanded' : ''}" />
                    {#if expanded}
                      <FolderOpen size={14} class="text-[var(--th-text-emerald-400)]" />
                    {:else}
                      <Folder size={14} class="text-[var(--th-text-emerald-400)]" />
                    {/if}
                    <span class="node-label truncate">{node.name}</span>
                    {#if hoveredNode === node.relPath}
                      <span class="hover-actions">
                        <span
                          role="button"
                          tabindex="0"
                          class="hover-action-btn"
                          title="New File"
                          onclick={(e) => { e.stopPropagation(); startInlineCreate(node.relPath, 'file'); }}
                          onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); startInlineCreate(node.relPath, 'file'); } }}
                        >
                          <FilePlus2 size={12} />
                        </span>
                        <span
                          role="button"
                          tabindex="0"
                          class="hover-action-btn"
                          title="New Folder"
                          onclick={(e) => { e.stopPropagation(); startInlineCreate(node.relPath, 'folder'); }}
                          onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); startInlineCreate(node.relPath, 'folder'); } }}
                        >
                          <FolderPlus size={12} />
                        </span>
                      </span>
                    {/if}
                  </button>
                  {#if expanded && node.children}
                    <div class="tree-children">
                      {#if inlineCreateParent === node.relPath}
                        <div class="tree-node inline-create">
                          <span class="w-3.5 shrink-0"></span>
                          {#if inlineCreateType === 'folder'}
                            <Folder size={14} class="text-[var(--th-text-emerald-400)]" />
                          {:else}
                            <File size={14} class="text-[var(--th-text-emerald-400)]" />
                          {/if}
                          <input
                            bind:this={inlineCreateInput}
                            bind:value={inlineCreateName}
                            class="inline-create-input"
                            placeholder={inlineCreateType === 'folder' ? 'folder name' : 'filename.lua'}
                            onkeydown={(e) => {
                              if (e.key === 'Enter') { e.preventDefault(); commitInlineCreate(); }
                              if (e.key === 'Escape') { e.preventDefault(); cancelInlineCreate(); }
                            }}
                            onblur={() => { if (inlineCreateName.trim()) commitInlineCreate(); else cancelInlineCreate(); }}
                          />
                        </div>
                      {/if}
                      {#each node.children as child (child.relPath)}
                        {@render scriptNode(child)}
                      {/each}
                    </div>
                  {/if}
                {/if}
              {/snippet}
              {#each SCRIPT_CATEGORIES as cat (cat.key)}
                {@const count = scriptCounts.get(cat.key) ?? 0}
                {#if cat.key === 'lua-se'}
                  <!-- Lua (SE) - expandable folder tree -->
                  {@const luaExpanded = uiStore.expandedNodes['_Scripts_lua-se'] ?? false}
                  <div>
                    <div class="tree-node" class:has-files={count > 0} role="treeitem" tabindex="-1" aria-selected={false} aria-expanded={luaExpanded}>
                      <span class="chevron-hit" onclick={(e) => { e.stopPropagation(); uiStore.toggleNode('_Scripts_lua-se'); }} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); uiStore.toggleNode('_Scripts_lua-se'); } }} role="button" tabindex="0" aria-label="Toggle Lua (SE)">
                        <ChevronRight size={14} class="chevron {luaExpanded ? 'expanded' : ''}" />
                      </span>
                      <button class="tree-node-label" onclick={() => uiStore.toggleNode('_Scripts_lua-se')}>
                        <FileCode size={14} class={count > 0 ? "text-[var(--th-text-emerald-400)]" : "text-[var(--th-text-600)] opacity-40"} />
                        <span class="node-label truncate" class:text-muted={count === 0}>{cat.label}</span>
                        {#if count > 0}
                          <span class="entry-count">{count}</span>
                        {/if}
                      </button>
                    </div>
                    {#if luaExpanded && luaSeTree.length > 0}
                      <div class="tree-children">
                        {#each luaSeTree as node (node.relPath)}
                          {@render scriptNode(node)}
                        {/each}
                      </div>
                    {/if}
                  </div>
                {:else}
                  <button
                    class="tree-node"
                    class:has-files={count > 0}
                    onclick={() => {
                      if (count > 0) {
                        uiStore.expandNode('root');
                        uiStore.expandNode('Mods');
                        if (cat.dir) {
                          const dirParts = cat.dir.split('/');
                          let path = '';
                          for (const part of dirParts) {
                            path = path ? `${path}/${part}` : part;
                            uiStore.expandNode(`modfile:${path}`);
                          }
                        }
                      }
                    }}
                  >
                    <span class="w-3.5 shrink-0"></span>
                    <FileCode size={14} class={count > 0 ? "text-[var(--th-text-emerald-400)]" : "text-[var(--th-text-600)] opacity-40"} />
                    <span class="node-label truncate" class:text-muted={count === 0}>{cat.label}</span>
                    {#if count > 0}
                      <span class="entry-count">{count}</span>
                    {/if}
                  </button>
                {/if}
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- Context menu (portal-style, fixed position) -->
{#if ctxVisible}
  <ContextMenu x={ctxX} y={ctxY} header={ctxLabel} headerTitle={ctxPath || ctxLabel} onclose={hideContextMenu}>
    {#if ctxHasPath}
      <button
        class="ctx-item"
        onclick={ctxOpenInFileManager}
        role="menuitem"
      >
        <FolderOpen size={12} class="shrink-0" />
        {m.file_explorer_open_in_file_manager()}
      </button>
    {/if}
    {#if ctxHasSection}
      <button
        class="ctx-item"
        onclick={ctxAddEntry}
        role="menuitem"
      >
        <File size={12} class="shrink-0" />
        {m.file_explorer_add_entry()}
      </button>
      <button
        class="ctx-item"
        onclick={ctxRefreshSection}
        role="menuitem"
      >
        <RefreshCw size={12} class="shrink-0" />
        Refresh Section
      </button>
      <button
        class="ctx-item"
        onclick={ctxViewVanillaData}
        role="menuitem"
      >
        <Package size={12} class="shrink-0" />
        {m.file_explorer_view_vanilla()}
      </button>
    {/if}
    {#if ctxHasPath}
      <button
        class="ctx-item"
        onclick={ctxCopyPath}
        role="menuitem"
      >
        <FileCode2 size={12} class="shrink-0" />
        {m.file_explorer_copy_path()}
      </button>
    {/if}
  </ContextMenu>
{/if}

<!-- Localization root context menu -->
{#if locaCtxVisible}
  <ContextMenu x={locaCtxX} y={locaCtxY} header="Localization" onclose={hideContextMenu}>
    <button
      class="ctx-item"
      onclick={async () => { locaCtxVisible = false; await refreshModFiles(); }}
      role="menuitem"
    >
      <RefreshCw size={12} class="shrink-0" />
      Refresh
    </button>
  </ContextMenu>
{/if}

<!-- Scripts root context menu -->
{#if scriptsCtxVisible}
  <ContextMenu x={scriptsCtxX} y={scriptsCtxY} header="Scripts" onclose={hideContextMenu}>
    <button
      class="ctx-item"
      onclick={() => { startInlineCreate('ScriptExtender', 'file'); scriptsCtxVisible = false; uiStore.expandNode('_Scripts'); uiStore.expandNode('_Scripts_lua-se'); }}
      role="menuitem"
    >
      <FilePlus2 size={12} class="shrink-0" />
      New File
    </button>
    <button
      class="ctx-item"
      onclick={() => { startInlineCreate('ScriptExtender', 'folder'); scriptsCtxVisible = false; uiStore.expandNode('_Scripts'); uiStore.expandNode('_Scripts_lua-se'); }}
      role="menuitem"
    >
      <FolderPlus size={12} class="shrink-0" />
      New Folder
    </button>
    <button
      class="ctx-item"
      onclick={() => {
        showCreateScript = true;
        createScriptDefaultContext = 'Other';
        scriptsCtxVisible = false;
      }}
      role="menuitem"
    >
      <FileCode size={12} class="shrink-0" />
      New File from Template...
    </button>
    <div class="ctx-separator"></div>
    <button
      class="ctx-item"
      onclick={async () => { scriptsCtxVisible = false; await refreshModFiles(); }}
      role="menuitem"
    >
      <RefreshCw size={12} class="shrink-0" />
      Refresh
    </button>
  </ContextMenu>
{/if}

<!-- File tree context menu -->
{#if fileCtxVisible && fileCtxNode}
  <ContextMenu x={fileCtxX} y={fileCtxY} header={fileCtxNode.name} onclose={hideFileContextMenu}>
    {#if isScriptFile(fileCtxNode.extension)}
      <button
        class="ctx-item"
        onclick={() => { const fullPath = `${modsFilePrefix}${fileCtxNode!.relPath}`; uiStore.openScriptTab(fullPath); hideFileContextMenu(); }}
        role="menuitem"
      >
        <Pencil size={12} class="shrink-0" />
        {m.file_explorer_edit_script()}
      </button>
      <button
        class="ctx-item"
        onclick={async () => {
          const node = fileCtxNode;
          if (!node) return;
          await deleteScriptFile(node);
          hideFileContextMenu();
        }}
        role="menuitem"
      >
        <Trash2 size={12} class="shrink-0" />
        {m.file_explorer_delete_script()}
      </button>
    {/if}
    {#if !fileCtxNode.isFile}
      <button
        class="ctx-item"
        onclick={() => { startInlineCreate(fileCtxNode!.relPath, 'file'); hideFileContextMenu(); }}
        role="menuitem"
      >
        <FilePlus2 size={12} class="shrink-0" />
        New File
      </button>
      <button
        class="ctx-item"
        onclick={() => { startInlineCreate(fileCtxNode!.relPath, 'folder'); hideFileContextMenu(); }}
        role="menuitem"
      >
        <FolderPlus size={12} class="shrink-0" />
        New Folder
      </button>
      <button
        class="ctx-item"
        onclick={() => {
          showCreateScript = true;
          createScriptDefaultContext = deriveContextFromPath(fileCtxNode!.relPath);
          hideFileContextMenu();
        }}
        role="menuitem"
      >
        <FileCode size={12} class="shrink-0" />
        New File from Template...
      </button>
      <button
        class="ctx-item"
        onclick={() => {
          const folderPath = `${modsFilePrefix}${fileCtxNode!.relPath}`;
          uiStore.searchFilesInclude = folderPath;
          uiStore.showSearchPanel = true;
          uiStore.activeView = "search";
          hideFileContextMenu();
        }}
        role="menuitem"
      >
        <Search size={12} class="shrink-0" />
        Find in Folder...
      </button>
    {:else}
      <div class="ctx-separator"></div>
      <button
        class="ctx-item"
        onclick={() => {
          const parentPath = fileCtxNode!.relPath.substring(0, fileCtxNode!.relPath.lastIndexOf('/'));
          startInlineCreate(parentPath, 'file');
          hideFileContextMenu();
        }}
        role="menuitem"
      >
        <FilePlus2 size={12} class="shrink-0" />
        New File
      </button>
    {/if}
    <div class="ctx-separator"></div>
    <button
      class="ctx-item"
      onclick={() => { clipboardNode = fileCtxNode; clipboardOp = 'cut'; hideFileContextMenu(); }}
      role="menuitem"
    >
      <Scissors size={12} class="shrink-0" />
      Cut
    </button>
    <button
      class="ctx-item"
      onclick={() => { clipboardNode = fileCtxNode; clipboardOp = 'copy'; hideFileContextMenu(); }}
      role="menuitem"
    >
      <Copy size={12} class="shrink-0" />
      Copy
    </button>
    {#if clipboardNode}
      <button
        class="ctx-item"
        onclick={async () => { await pasteClipboardNode(fileCtxNode!); hideFileContextMenu(); }}
        role="menuitem"
      >
        <ClipboardIcon size={12} class="shrink-0" />
        Paste
      </button>
    {/if}
    <div class="ctx-separator"></div>
    <button
      class="ctx-item"
      onclick={async () => {
        const modPath = modStore.selectedModPath;
        if (modPath && fileCtxNode) {
          try { await revealPath(`${modPath}/${modsFilePrefix}${fileCtxNode.relPath}`); }
          catch (e) { toastStore.error(m.file_explorer_open_failed_title(), String(e)); }
        }
        hideFileContextMenu();
      }}
      role="menuitem"
    >
      <FolderOpen size={12} class="shrink-0" />
      Reveal in File Manager
    </button>
    <button
      class="ctx-item"
      onclick={async () => {
        const modPath = modStore.selectedModPath;
        if (modPath && fileCtxNode) {
          const fullPath = `${modPath}/${modsFilePrefix}${fileCtxNode.relPath}`;
          await navigator.clipboard.writeText(fullPath.replace(/\//g, '\\'));
        }
        hideFileContextMenu();
      }}
      role="menuitem"
    >
      <Copy size={12} class="shrink-0" />
      Copy Path
    </button>
    <button
      class="ctx-item"
      onclick={async () => {
        if (fileCtxNode) {
          await navigator.clipboard.writeText(`${modsFilePrefix}${fileCtxNode.relPath}`);
        }
        hideFileContextMenu();
      }}
      role="menuitem"
    >
      <Copy size={12} class="shrink-0" />
      Copy Relative Path
    </button>
  </ContextMenu>
{/if}

{#if showCreateScript && modFolder}
  <ScriptCreationModal
    {modFolder}
    defaultContext={createScriptDefaultContext}
    onClose={() => { showCreateScript = false; }}
    onCreated={async () => { showCreateScript = false; await refreshModFiles(); }}
  />
{/if}

<style>
  .file-explorer {
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    padding-bottom: 1rem;
  }

  .explorer-header {
    display: flex;
    align-items: center;
    padding: 8px 12px 4px;
    user-select: none;
  }

  .empty-state {
    padding: 2rem 1rem;
    text-align: center;
  }

  .tree-root {
    padding: 0 4px;
  }

  .tree-root.scanning {
    opacity: 0.4;
    cursor: progress;
  }

  .tree-node {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    padding: 2px 8px 2px 4px;
    border: none;
    background: transparent;
    color: var(--th-sidebar-text-muted, var(--th-text-300));
    font-size: 12px;
    cursor: pointer;
    border-radius: 3px;
    text-align: left;
    min-height: 24px;
    user-select: none;
    position: relative;
  }

  .tree-node:hover {
    background: var(--th-bg-700);
  }

  .tree-node.has-files {
    color: var(--th-text-100);
  }

  .tree-node.active-node {
    background: var(--th-accent-500, #0ea5e9) / 15%;
    background: color-mix(in srgb, var(--th-accent-500, #0ea5e9) 12%, transparent);
    color: var(--th-text-100);
  }

  .tree-node.active-node::before {
    content: "";
    position: absolute;
    left: 0;
    top: 2px;
    bottom: 2px;
    width: 2px;
    border-radius: 1px;
    background: var(--th-accent-500, #0ea5e9);
  }

  .root-node {
    font-size: 12px;
    padding: 4px 8px 4px 4px;
  }

  .tree-children {
    padding-left: 12px;
  }

  .node-label {
    flex: 1;
    min-width: 0;
  }

  .node-label.text-muted {
    color: var(--th-text-500);
    opacity: 0.7;
  }

  .entry-count {
    font-size: 10px;
    padding: 0 5px;
    border-radius: 8px;
    background: var(--th-bg-600);
    color: var(--th-text-300);
    font-weight: 500;
    line-height: 16px;
    flex-shrink: 0;
  }

  .ext-badge {
    font-size: 9px;
    padding: 0 4px;
    border-radius: 3px;
    color: white;
    font-weight: 600;
    line-height: 14px;
    flex-shrink: 0;
    opacity: 0.7;
  }

  .se-ctx-badge {
    font-size: 8px;
    padding: 0 3px;
    border-radius: 2px;
    color: white;
    font-weight: 700;
    line-height: 13px;
    flex-shrink: 0;
    opacity: 0.8;
    letter-spacing: 0.5px;
  }

  .separator-node {
    margin-top: 4px;
    padding-top: 4px;
    border-top: 1px solid var(--th-bg-700);
  }

  :global(.chevron) {
    transition: transform 0.15s;
    flex-shrink: 0;
  }

  :global(.chevron.expanded) {
    transform: rotate(90deg);
  }

  .add-entry-btn {
    display: none;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 3px;
    flex-shrink: 0;
    color: var(--th-text-500);
    cursor: pointer;
  }

  .add-entry-btn:hover {
    color: var(--th-text-100);
    background: var(--th-bg-600);
  }

  .tree-node:hover .add-entry-btn {
    display: inline-flex;
  }

  .chevron-hit {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    cursor: pointer;
    border-radius: 3px;
    border: none;
    background: transparent;
  }

  .chevron-hit:hover {
    background: var(--th-bg-600);
  }

  .tree-node-label {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    color: inherit;
    font-size: inherit;
    cursor: pointer;
    text-align: left;
    padding: 0;
  }

  .hover-actions {
    display: flex;
    gap: 2px;
    margin-left: auto;
    flex-shrink: 0;
  }

  .hover-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border: none;
    background: transparent;
    color: var(--th-text-400);
    cursor: pointer;
    border-radius: 3px;
    padding: 0;
  }

  .hover-action-btn:hover {
    background: var(--th-bg-600);
    color: var(--th-text-200);
  }

  .inline-create {
    gap: 4px;
  }

  .inline-create-input {
    flex: 1;
    background: var(--th-bg-700);
    border: 1px solid var(--th-accent-500);
    border-radius: 2px;
    color: var(--th-text-200);
    font-size: 11px;
    padding: 1px 4px;
    outline: none;
    font-family: inherit;
  }

  .inline-create-input:focus {
    border-color: var(--th-accent-400);
  }

  :global(.ctx-separator) {
    height: 1px;
    background: var(--th-border-700);
    margin: 4px 8px;
  }
</style>
