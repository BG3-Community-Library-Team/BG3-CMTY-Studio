<script lang="ts">
  import { modStore } from "../../lib/stores/modStore.svelte.js";
  import { uiStore } from "../../lib/stores/uiStore.svelte.js";
  import { toastStore } from "../../lib/stores/toastStore.svelte.js";
  import { projectStore, sectionToTable } from "../../lib/stores/projectStore.svelte.js";
  import { schemaStore } from "../../lib/stores/schemaStore.svelte.js";
  import { createDragReorderState, handleDragStart, handleDragOver, handleDrop, handleDragEnd, getPinContextMenuItems } from "./dragReorder.js";
  import {
    BG3_CORE_FOLDERS,
    BG3_ADDITIONAL_FOLDERS,
    STATIC_SIDEBAR_SECTIONS,
    SECTIONS_EXCLUDED_FROM_DISCOVERY,
    type FolderNode,
  } from "../../lib/data/bg3FolderStructure.js";
  import { openPath, revealPath, listModFiles } from "../../lib/utils/tauri.js";
  import { touchFile, createModDirectory, moveModFile, copyModFile, scriptDelete, scriptRename } from "../../lib/tauri/scripts.js";
  import { m } from "../../paraglide/messages.js";
  import {
    type FileTreeNode,
    buildFileTree,
    filterTree,
    isScriptFile,
    getOsirisBadge,
    getSeContextBadge,
    getComputedZoom,
    EXT_BADGE_COLORS,
    EXT_BADGE_FALLBACK,
    SCRIPT_MANAGED_ROOTS,
    explorerFilter,
    matchesFilter,
    folderNodeHasMatch,
    countFolderNodeMatches,
    filterSearchTree,
  } from "./explorerShared.js";
  import ContextMenu from "../ContextMenu.svelte";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import File from "@lucide/svelte/icons/file";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import Folder from "@lucide/svelte/icons/folder";
  import FileCode2 from "@lucide/svelte/icons/file-code-2";
  import Package from "@lucide/svelte/icons/package";
  import FilePlus2 from "@lucide/svelte/icons/file-plus-2";
  import FolderPlus from "@lucide/svelte/icons/folder-plus";
  import Plus from "@lucide/svelte/icons/plus";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Copy from "@lucide/svelte/icons/copy";
  import Scissors from "@lucide/svelte/icons/scissors";
  import ClipboardIcon from "@lucide/svelte/icons/clipboard";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Search from "@lucide/svelte/icons/search";
  import FileCode from "@lucide/svelte/icons/file-code";
  import PinIcon from "@lucide/svelte/icons/pin";
  import type { SectionResult, DiffEntry } from "../../lib/types/index.js";
  import type { ContextMenuItemDef } from "../../lib/types/contextMenu.js";

  let scanResult = $derived(modStore.scanResult);
  let modFolder = $derived(scanResult?.mod_meta?.folder ?? "");
  let sections = $derived(scanResult?.sections ?? []);
  let modsFilePrefix = $derived(modFolder ? `Mods/${modFolder}/` : "");

  // ── File tree data ──

  let modFileTree = $derived.by(() => {
    const folder = modStore.scanResult?.mod_meta?.folder;
    if (!folder) return buildFileTree(modStore.modFiles);
    const prefix = `Mods/${folder}/`;
    const filtered = modStore.modFiles
      .filter(f => f.rel_path.startsWith(prefix))
      .map(f => ({ ...f, rel_path: f.rel_path.slice(prefix.length) }))
      .filter(f => !f.rel_path.startsWith('Localization/') && f.rel_path !== 'Localization');
    return buildFileTree(filtered);
  });

  let modFileDisplayTree = $derived.by(() => {
    return modFileTree.filter(n => !SCRIPT_MANAGED_ROOTS.has(n.name));
  });

  // ── Section counting ──

  let sectionMap = $derived.by(() => {
    const m = new Map<string, SectionResult>();
    for (const s of sections) m.set(s.section, s);
    return m;
  });

  let manualCountBySection = $derived.by(() => {
    const m = new Map<string, number>();
    for (const s of projectStore.sections) {
      if (s.new_rows > 0) {
        const sectionName = s.table_name.startsWith("lsx__") ? s.table_name.slice(5) : s.table_name;
        m.set(sectionName, s.new_rows);
      }
    }
    return m;
  });

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

  function hasSection(node: FolderNode): boolean {
    if (node.Section) return true;
    if (node.groupSections) return true;
    if (node.children) return node.children.some(hasSection);
    return false;
  }

  // ── Discovered sections ──

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
      if (sectionKey.startsWith("stats:")) continue;
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
      if (sectionKey.startsWith("CharacterCreation")) cc.push(node);
      else if (/^Effect/i.test(sectionKey)) vfx.push(node);
      else if (/Bank/i.test(sectionKey) || /Visual/i.test(sectionKey)) content.push(node);
      else if (/^Sound/i.test(sectionKey) && sectionKey !== "Sound") sound.push(node);
      else general.push(node);
    }
    const sorter = (a: FolderNode, b: FolderNode) => a.label.localeCompare(b.label);
    cc.sort(sorter); content.sort(sorter); vfx.sort(sorter); sound.sort(sorter); general.sort(sorter);
    return { cc, content, vfx, sound, general };
  });

  let enrichedCoreFolders = $derived.by((): FolderNode[] => {
    const { cc: ccExtra, content: contentExtra, vfx: vfxExtra } = allDiscovered;
    if (ccExtra.length === 0 && contentExtra.length === 0 && vfxExtra.length === 0) return BG3_CORE_FOLDERS;
    return BG3_CORE_FOLDERS.map(f => {
      if (f.name === "_CharacterCreation" && f.children && ccExtra.length > 0) return { ...f, children: [...f.children, ...ccExtra] };
      if (f.name === "_Content" && f.children && contentExtra.length > 0) return { ...f, children: [...f.children, ...contentExtra] };
      if (f.name === "_VFX" && f.children && vfxExtra.length > 0) return { ...f, children: [...f.children, ...vfxExtra] };
      return f;
    });
  });

  let mergedAdditionalSections = $derived.by((): FolderNode[] => {
    const combined = [...BG3_ADDITIONAL_FOLDERS];
    const soundExtra = allDiscovered.sound;
    if (soundExtra.length > 0) {
      for (let i = 0; i < combined.length; i++) {
        const node = combined[i];
        if (node.name === "_Sound" && node.children && soundExtra.length > 0) {
          combined[i] = { ...node, children: [...node.children, ...soundExtra] };
        }
      }
    }
    combined.push(...allDiscovered.general);
    combined.sort((a, b) => a.label.localeCompare(b.label));
    return combined;
  });

  // ── Drag-to-reorder state ──

  let dragState = $state(createDragReorderState());

  /** All root-level node IDs: core folders + "_Additional_" separator + additional sections */
  let defaultNodeIds = $derived.by((): string[] => {
    const ids: string[] = [];
    for (const f of enrichedCoreFolders) ids.push(f.name);
    ids.push("_Additional_");
    for (const f of mergedAdditionalSections) ids.push(f.name);
    return ids;
  });

  /** Ordered root-level IDs respecting user pin/reorder state */
  let orderedNodeIds = $derived(uiStore.getOrderedNodes("data", defaultNodeIds));

  /** Quick lookup: node name → FolderNode for rendering in custom order */
  let nodeMap = $derived.by((): Map<string, FolderNode> => {
    const m = new Map<string, FolderNode>();
    for (const f of enrichedCoreFolders) m.set(f.name, f);
    for (const f of mergedAdditionalSections) m.set(f.name, f);
    return m;
  });

  /** Index of first non-pinned node (for divider rendering) */
  let firstUnpinnedIdx = $derived.by((): number => {
    for (let i = 0; i < orderedNodeIds.length; i++) {
      if (!uiStore.isNodePinned("data", orderedNodeIds[i])) return i;
    }
    return orderedNodeIds.length;
  });

  let hasPinnedNodes = $derived(firstUnpinnedIdx > 0);

  /** Set of core folder names (vs additional sections) for path resolution */
  let coreNodeNames = $derived(new Set(enrichedCoreFolders.map(f => f.name)));

  /** Whether an additional node should be hidden (not pinned, and _Additional_ is collapsed) */
  function isAdditionalHidden(nodeId: string): boolean {
    if (coreNodeNames.has(nodeId) || nodeId === "_Additional_") return false;
    if (uiStore.isNodePinned("data", nodeId)) return false;
    return !isAdditionalExpanded;
  }

  // ── Active node tracking ──

  let activeNodeKey = $derived.by(() => {
    const tab = uiStore.activeTab;
    if (!tab) return "";
    if (tab.type === "group") return tab.category ?? "";
    if (tab.type === "filteredSection") return tab.id.replace("filtered:", "");
    if (tab.type === "section") return tab.category ?? "";
    if (tab.type === "lsx-file") return tab.category ?? "";
    if (tab.type === "file-preview") return `file:${tab.filePath ?? ""}`;
    if (tab.type === "script-editor") return `file:${tab.filePath ?? ""}`;
    return "";
  });

  function isActiveNode(node: FolderNode): boolean {
    if (!activeNodeKey) return false;
    return node.name === activeNodeKey || node.Section === activeNodeKey;
  }

  function isActiveFile(relPath: string): boolean {
    return activeNodeKey === `file:${modsFilePrefix}${relPath}`;
  }

  // ── Node paths ──

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

  // ── Open node as tab ──

  function openNode(node: FolderNode, preview = true): void {
    if (node.isGroup && node.groupSections) {
      uiStore.openTab({ id: `group:${node.name}`, label: node.label, type: "group", category: node.name, groupSections: node.groupSections, icon: "📁", preview });
    } else if (node.Section && node.entryFilter) {
      uiStore.openTab({ id: `filtered:${node.name}`, label: node.label, type: "filteredSection", category: node.Section, entryFilter: node.entryFilter, icon: "📄", preview });
    } else if (node.Section) {
      const tabType = node.Section === "Localization" ? "localization" as const : "section" as const;
      uiStore.openTab({ id: `section:${node.Section}`, label: node.label, type: tabType, category: node.Section, icon: "📄", preview });
    } else {
      uiStore.openTab({ id: `folder:${node.name}`, label: node.label, type: "lsx-file", category: node.name, icon: "📄", preview });
    }
  }

  function quickAddEntry(e: MouseEvent, node: FolderNode): void {
    e.stopPropagation();
    openNode(node, false);
    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent("explorer-add-entry", { detail: { section: node.Section } }));
    });
  }

  // ── Expansion state ──

  let isPublicExpanded = $derived(uiStore.expandedNodes["Public"] !== false);
  let isAdditionalExpanded = $derived(uiStore.expandedNodes["_Additional"] ?? false);
  let isModsExpanded = $derived(uiStore.expandedNodes["Mods"] ?? false);

  // ── Data section context menu ──

  let ctxVisible = $state(false);
  let ctxX = $state(0);
  let ctxY = $state(0);
  let ctxPath = $state("");
  let ctxLabel = $state("");
  let ctxSection = $state<string | undefined>(undefined);
  let ctxNode = $state<FolderNode | undefined>(undefined);
  let ctxIsRootNode = $state(false);
  let ctxRootNodeId = $state("");

  function showContextMenu(e: MouseEvent, path: string, label: string, Section?: string, node?: FolderNode, isRootNode = false, rootNodeId = "") {
    e.preventDefault();
    e.stopPropagation();
    ctxPath = path;
    ctxLabel = label;
    ctxSection = Section;
    ctxNode = node;
    ctxIsRootNode = isRootNode;
    ctxRootNodeId = rootNodeId;
    const zoom = getComputedZoom(e.currentTarget as HTMLElement);
    ctxX = e.clientX / zoom;
    ctxY = e.clientY / zoom;
    ctxVisible = true;
  }

  function hideContextMenu() {
    ctxVisible = false;
    fileCtxVisible = false;
    fileCtxNode = null;
  }

  let ctxHasPath = $derived(!!ctxPath && !(ctxNode?.isGroup));
  let ctxHasSection = $derived(!!ctxSection);

  function ctxAddEntry() {
    hideContextMenu();
    if (!ctxNode) return;
    openNode(ctxNode, false);
    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent("explorer-add-entry", { detail: { section: ctxSection } }));
    });
  }

  function ctxViewVanillaData() {
    hideContextMenu();
    if (!ctxSection) return;
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
    try { await openPath(ctxPath); }
    catch (err: any) { toastStore.error(m.file_explorer_open_failed_title(), String(err?.message ?? err)); }
  }

  async function ctxCopyPath() {
    hideContextMenu();
    if (!ctxPath) return;
    try { await navigator.clipboard.writeText(ctxPath); toastStore.success(m.file_explorer_path_copied()); }
    catch { toastStore.error(m.file_explorer_copy_failed_title(), m.file_explorer_copy_failed_message()); }
  }

  /** Build context menu items array, prepending pin/unpin for root-level nodes */
  let ctxItems = $derived.by((): ContextMenuItemDef[] => {
    const items: ContextMenuItemDef[] = [];
    // Pin/unpin for root-level draggable nodes
    if (ctxIsRootNode && ctxRootNodeId) {
      const pinItems = getPinContextMenuItems("data", ctxRootNodeId, uiStore.isNodePinned("data", ctxRootNodeId));
      if (pinItems.length > 0) {
        pinItems[pinItems.length - 1].separator = "after";
        items.push(...pinItems);
      }
    }
    if (ctxHasPath) {
      items.push({ label: m.file_explorer_open_in_file_manager(), icon: FolderOpen, action: ctxOpenInFileManager });
    }
    if (ctxHasSection) {
      items.push({ label: m.file_explorer_add_entry(), icon: File, action: ctxAddEntry });
      items.push({ label: "Refresh Section", icon: RefreshCw, action: ctxRefreshSection });
      items.push({ label: m.file_explorer_view_vanilla(), icon: Package, action: ctxViewVanillaData });
    }
    if (ctxHasPath) {
      items.push({ label: m.file_explorer_copy_path(), icon: FileCode2, action: ctxCopyPath });
    }
    return items;
  });

  // ── File tree context menu ──

  let fileCtxVisible = $state(false);
  let fileCtxX = $state(0);
  let fileCtxY = $state(0);
  let fileCtxNode: FileTreeNode | null = $state(null);

  function showFileContextMenu(e: MouseEvent, node: FileTreeNode) {
    e.preventDefault();
    e.stopPropagation();
    const zoom = getComputedZoom(e.currentTarget as HTMLElement);
    fileCtxX = e.clientX / zoom;
    fileCtxY = e.clientY / zoom;
    fileCtxNode = node;
    fileCtxVisible = true;
  }

  // ── File hover state ──

  let hoveredNode: string | null = $state(null);

  // ── Inline create state ──

  let inlineCreateParent: string | null = $state(null);
  let inlineCreateType: 'file' | 'folder' | null = $state(null);
  let inlineCreateName = $state("");
  let inlineCreateInput: HTMLInputElement | null = $state(null);
  let isCommittingCreate = false;

  function startInlineCreate(parentRelPath: string, type: 'file' | 'folder') {
    inlineCreateParent = parentRelPath;
    inlineCreateType = type;
    inlineCreateName = '';
    uiStore.expandedNodes[`modfile:${parentRelPath}`] = true;
    requestAnimationFrame(() => { requestAnimationFrame(() => { inlineCreateInput?.focus(); }); });
  }

  function cancelInlineCreate() {
    inlineCreateParent = null;
    inlineCreateType = null;
    inlineCreateName = '';
  }

  async function commitInlineCreate() {
    if (isCommittingCreate) return;
    if (!inlineCreateName.trim() || !inlineCreateParent || !inlineCreateType) { cancelInlineCreate(); return; }
    isCommittingCreate = true;
    const name = inlineCreateName.trim();
    const modPath = modStore.selectedModPath;
    if (!modPath) { isCommittingCreate = false; cancelInlineCreate(); return; }
    if (inlineCreateType === 'file') {
      const relPath = `${modsFilePrefix}${inlineCreateParent}/${name}`;
      try { await touchFile(modPath, relPath); modStore.modFiles = await listModFiles(modPath); uiStore.openScriptTab(relPath); }
      catch (e) { toastStore.error("Failed to create file", String(e)); }
    } else {
      const relPath = `${modsFilePrefix}${inlineCreateParent}/${name}`;
      try { await createModDirectory(modPath, relPath); modStore.modFiles = await listModFiles(modPath); }
      catch (e) { toastStore.error("Failed to create folder", String(e)); }
    }
    isCommittingCreate = false;
    cancelInlineCreate();
  }

  // ── Inline rename state ──

  let inlineRenameNode: FileTreeNode | null = $state(null);
  let inlineRenameName = $state("");
  let inlineRenameInput: HTMLInputElement | null = $state(null);
  let isCommittingRename = false;

  function startInlineRename(node: FileTreeNode) {
    cancelInlineCreate();
    inlineRenameNode = node;
    inlineRenameName = node.name;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (inlineRenameInput) {
          inlineRenameInput.focus();
          const dotIdx = node.isFile ? node.name.lastIndexOf('.') : -1;
          if (dotIdx > 0) inlineRenameInput.setSelectionRange(0, dotIdx);
          else inlineRenameInput.select();
        }
      });
    });
  }

  function cancelInlineRename() { inlineRenameNode = null; inlineRenameName = ''; }

  async function commitInlineRename() {
    if (isCommittingRename) return;
    if (!inlineRenameNode || !inlineRenameName.trim()) { cancelInlineRename(); return; }
    isCommittingRename = true;
    const node = inlineRenameNode;
    const newName = inlineRenameName.trim();
    if (newName === node.name) { isCommittingRename = false; cancelInlineRename(); return; }
    const modPath = modStore.selectedModPath;
    if (!modPath) { isCommittingRename = false; cancelInlineRename(); return; }
    const oldRelPath = `${modsFilePrefix}${node.relPath}`;
    const parentPath = node.relPath.substring(0, node.relPath.lastIndexOf('/'));
    const newRelPath = `${modsFilePrefix}${parentPath}/${newName}`;
    try {
      if (isScriptFile(node.extension)) await scriptRename(modPath, oldRelPath, newRelPath);
      else await moveModFile(modPath, oldRelPath, newRelPath);
      const oldTabId = `script:${oldRelPath}`;
      if (uiStore.openTabs.some(t => t.id === oldTabId)) { uiStore.closeTab(oldTabId); uiStore.openScriptTab(newRelPath); }
      modStore.modFiles = await listModFiles(modPath);
      toastStore.success(m.file_explorer_renamed(), `${node.name} → ${newName}`);
    } catch (e) { toastStore.error("Rename failed", String(e)); }
    isCommittingRename = false;
    cancelInlineRename();
  }

  // ── Clipboard ──

  let clipboardNode: FileTreeNode | null = $state(null);
  let clipboardOp: 'cut' | 'copy' | null = $state(null);

  async function pasteClipboardNode(targetNode: FileTreeNode) {
    if (!clipboardNode || !clipboardOp) return;
    const modPath = modStore.selectedModPath;
    if (!modPath) return;
    const srcRelPath = `${modsFilePrefix}${clipboardNode.relPath}`;
    const destDir = targetNode.isFile ? targetNode.relPath.substring(0, targetNode.relPath.lastIndexOf('/')) : targetNode.relPath;
    const destRelPath = `${modsFilePrefix}${destDir}/${clipboardNode.name}`;
    try {
      if (clipboardOp === 'cut') await moveModFile(modPath, srcRelPath, destRelPath);
      else await copyModFile(modPath, srcRelPath, destRelPath);
      modStore.modFiles = await listModFiles(modPath);
      if (clipboardOp === 'cut') { clipboardNode = null; clipboardOp = null; }
    } catch (e) { toastStore.error("Paste failed", String(e)); }
  }

  async function deleteScriptFile(node: FileTreeNode) {
    if (!node.isFile || (!isScriptFile(node.extension) && node.extension !== 'json')) return;
    const fullPath = `${modsFilePrefix}${node.relPath}`;
    const modPath = modStore.selectedModPath;
    if (!modPath) return;
    try {
      await scriptDelete(modPath, fullPath);
      const tabId = `script:${fullPath}`;
      if (uiStore.openTabs.some(t => t.id === tabId)) uiStore.closeTab(tabId);
      modStore.modFiles = await listModFiles(modPath);
      toastStore.success(m.file_explorer_delete_script(), node.name);
    } catch (e) { toastStore.error(m.file_explorer_delete_script(), String(e)); }
  }

  // ── File open ──

  function openFilePreview(fileNode: FileTreeNode, preview = true): void {
    const fullRelPath = `${modsFilePrefix}${fileNode.relPath}`;
    if (isScriptFile(fileNode.extension)) { uiStore.openScriptTab(fullRelPath); return; }
    if (fileNode.extension === "txt" && fileNode.relPath.includes("Story/RawFiles/Goals/")) { uiStore.openScriptTab(fullRelPath); return; }
    if (fileNode.extension === "xml" && fileNode.relPath.startsWith("Localization/")) { uiStore.openScriptTab(fullRelPath); return; }
    uiStore.openTab({ id: `file:${fullRelPath}`, label: fileNode.name, type: "file-preview", filePath: fullRelPath, icon: "📄", preview });
  }

  // ── Filter helpers ──

  function folderFilterClass(label: string, children?: { label: string; children?: any[] }[]): string {
    const q = explorerFilter.query;
    if (!explorerFilter.active || !q) return '';
    if (matchesFilter(label, q, explorerFilter.fuzzy).matched) return 'filter-match';
    if (children && folderNodeHasMatch({ label, children }, q, explorerFilter.fuzzy)) return '';
    return explorerFilter.mode === 'filter' ? 'filter-hidden' : 'filter-dimmed';
  }

  function folderMatchCount(children?: { label: string; children?: any[] }[]): number {
    const q = explorerFilter.query;
    if (!explorerFilter.active || !q || !children) return 0;
    let count = 0;
    for (const c of children) count += countFolderNodeMatches(c, q, explorerFilter.fuzzy);
    return count;
  }

  function fileFilterClass(name: string, children?: FileTreeNode[]): string {
    const q = explorerFilter.query;
    if (!explorerFilter.active || !q) return '';
    if (matchesFilter(name, q, explorerFilter.fuzzy).matched) return 'filter-match';
    if (children && filterSearchTree(children, q, explorerFilter.fuzzy).length > 0) return '';
    return explorerFilter.mode === 'filter' ? 'filter-hidden' : 'filter-dimmed';
  }

  let filteredModFileDisplayTree = $derived.by(() => {
    if (!explorerFilter.active || !explorerFilter.query || explorerFilter.mode !== 'filter') return modFileDisplayTree;
    return filterSearchTree(modFileDisplayTree, explorerFilter.query, explorerFilter.fuzzy);
  });
</script>

<div class="data-content" onclick={hideContextMenu} role="none">
  <!-- ── Public/{ModFolder} ── -->
  <div class="tree-section">
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
        {#each orderedNodeIds as nodeId, idx (nodeId)}
          {#if idx === firstUnpinnedIdx && hasPinnedNodes}
            <div class="pin-divider"></div>
          {/if}

          {#if nodeId === "_Additional_"}
            <!-- Additional Data separator -->
            <div
              class="tree-node separator-node"
              class:drop-before={dragState.dropTargetId === "_Additional_" && dragState.dropPosition === "before"}
              class:drop-after={dragState.dropTargetId === "_Additional_" && dragState.dropPosition === "after"}
              draggable={true}
              ondragstart={(e) => handleDragStart(e, "_Additional_", "data", dragState)}
              ondragover={(e) => handleDragOver(e, "_Additional_", "data", dragState)}
              ondrop={(e) => handleDrop(e, "_Additional_", "data", dragState, (src, tgt, pos) => uiStore.reorderNode("data", src, tgt, pos))}
              ondragend={() => handleDragEnd(dragState)}
              oncontextmenu={(e) => showContextMenu(e, "", "Additional Data", undefined, undefined, true, "_Additional_")}
              role="treeitem"
              tabindex="0"
              aria-selected={false}
            >
              {#if uiStore.isNodePinned("data", "_Additional_")}
                <PinIcon size={10} class="pin-indicator" />
              {/if}
              <button class="tree-node-label" onclick={() => uiStore.toggleNode("_Additional")}>
                <ChevronRight size={14} class="chevron {isAdditionalExpanded ? 'expanded' : ''}" />
                {#if isAdditionalExpanded}
                  <FolderOpen size={14} class="text-[var(--th-text-600)] opacity-50" />
                {:else}
                  <Folder size={14} class="text-[var(--th-text-600)] opacity-50" />
                {/if}
                <span class="node-label text-[var(--th-text-600)] text-[10px] uppercase tracking-wider">Additional Data</span>
              </button>
            </div>
          {:else}
            {@const node = nodeMap.get(nodeId)}
            {#if node && !isAdditionalHidden(nodeId)}
              {@const count = getGroupCount(node)}
              {@const active = hasModFiles(node)}
              {@const isExpanded = uiStore.expandedNodes[node.name] ?? false}
              {@const fCls = folderFilterClass(node.label, node.children)}
              {@const fCount = folderMatchCount(node.children)}
              {@const pathKind = coreNodeNames.has(nodeId) ? 'public-folder' : 'additional'}
              {@const isPinned = uiStore.isNodePinned("data", nodeId)}

              {#if node.children}
                <div
                  class="tree-node {fCls}"
                  class:has-files={active}
                  class:active-node={isActiveNode(node)}
                  class:drop-before={dragState.dropTargetId === nodeId && dragState.dropPosition === "before"}
                  class:drop-after={dragState.dropTargetId === nodeId && dragState.dropPosition === "after"}
                  draggable={true}
                  ondragstart={(e) => handleDragStart(e, nodeId, "data", dragState)}
                  ondragover={(e) => handleDragOver(e, nodeId, "data", dragState)}
                  ondrop={(e) => handleDrop(e, nodeId, "data", dragState, (src, tgt, pos) => uiStore.reorderNode("data", src, tgt, pos))}
                  ondragend={() => handleDragEnd(dragState)}
                  oncontextmenu={(e) => showContextMenu(e, resolveNodePath(node.name, pathKind), node.label, node.Section, node, true, nodeId)}
                  role="treeitem"
                  tabindex="0"
                  aria-selected={false}
                  aria-expanded={isExpanded}
                >
                  {#if isPinned}
                    <PinIcon size={10} class="pin-indicator" />
                  {/if}
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
                    {#if fCount > 0}
                      <span class="filter-match-count">{fCount}</span>
                    {:else if count > 0}
                      <span class="entry-count">{count}</span>
                    {/if}
                  </button>
                </div>

                {#if isExpanded}
                  <div class="tree-children">
                    {#each node.children as child (child.name)}
                      {@const childCount = getGroupCount(child)}
                      {@const childActive = hasModFiles(child)}
                      {@const childExpanded = uiStore.expandedNodes[child.name] ?? false}
                      {@const childFCls = folderFilterClass(child.label, child.children)}

                      {#if child.children}
                        <div class="tree-node {childFCls}" class:has-files={childActive} role="treeitem" aria-selected={false} aria-expanded={childExpanded}>
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
                              {@const gcFCls = folderFilterClass(grandchild.label)}
                              <button class="tree-node {gcFCls}" class:has-files={hasModFiles(grandchild)} onclick={() => openNode(grandchild)} ondblclick={() => openNode(grandchild, false)} oncontextmenu={(e) => showContextMenu(e, resolveNodePath(grandchild.name, 'public-child'), grandchild.label, grandchild.Section, grandchild)}>
                                <span class="w-3.5 shrink-0"></span>
                                <File size={14} class={hasModFiles(grandchild) ? "text-[var(--th-text-sky-400)]" : "text-[var(--th-text-600)] opacity-40"} />
                                <span class="node-label truncate" class:text-muted={!hasModFiles(grandchild)}>{grandchild.label}</span>
                              </button>
                            {/each}
                          </div>
                        {/if}
                      {:else}
                        <button class="tree-node {childFCls}" class:has-files={childActive} class:active-node={isActiveNode(child)} onclick={() => openNode(child)} ondblclick={() => openNode(child, false)} oncontextmenu={(e) => showContextMenu(e, resolveNodePath(child.name, pathKind === 'additional' ? 'additional' : 'public-child'), child.label, child.Section, child)}>
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
                <button
                  class="tree-node {fCls}"
                  class:has-files={active}
                  class:active-node={isActiveNode(node)}
                  class:drop-before={dragState.dropTargetId === nodeId && dragState.dropPosition === "before"}
                  class:drop-after={dragState.dropTargetId === nodeId && dragState.dropPosition === "after"}
                  draggable={true}
                  ondragstart={(e) => handleDragStart(e, nodeId, "data", dragState)}
                  ondragover={(e) => handleDragOver(e, nodeId, "data", dragState)}
                  ondrop={(e) => handleDrop(e, nodeId, "data", dragState, (src, tgt, pos) => uiStore.reorderNode("data", src, tgt, pos))}
                  ondragend={() => handleDragEnd(dragState)}
                  onclick={() => openNode(node)}
                  ondblclick={() => openNode(node, false)}
                  oncontextmenu={(e) => showContextMenu(e, resolveNodePath(node.name, pathKind), node.label, node.Section, node, true, nodeId)}
                >
                  {#if isPinned}
                    <PinIcon size={10} class="pin-indicator" />
                  {/if}
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
            {/if}
          {/if}
        {/each}
      </div>
    {/if}
  </div>

  <!-- ── Mods/{ModFolder} ── -->
  <div class="tree-section">
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
        {#if modFileDisplayTree.length > 0}
          {#snippet modFileNode(node: FileTreeNode)}
            {@const nodeFCls = fileFilterClass(node.name, node.children)}
            {#if node.isFile}
              <button
                class="tree-node has-files {nodeFCls}"
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
                    <span role="button" tabindex="0" class="hover-action-btn" title="New File" onclick={(e) => { e.stopPropagation(); const p = node.relPath.substring(0, node.relPath.lastIndexOf('/')); startInlineCreate(p, 'file'); }} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); const p = node.relPath.substring(0, node.relPath.lastIndexOf('/')); startInlineCreate(p, 'file'); } }}>
                      <FilePlus2 size={12} />
                    </span>
                    <span role="button" tabindex="0" class="hover-action-btn" title="New Folder" onclick={(e) => { e.stopPropagation(); const p = node.relPath.substring(0, node.relPath.lastIndexOf('/')); startInlineCreate(p, 'folder'); }} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); const p = node.relPath.substring(0, node.relPath.lastIndexOf('/')); startInlineCreate(p, 'folder'); } }}>
                      <FolderPlus size={12} />
                    </span>
                  </span>
                {:else}
                  {#if getOsirisBadge(node.relPath, node.extension)}
                    {@const osiBadge = getOsirisBadge(node.relPath, node.extension)!}
                    <span class="ext-badge" style="background: {osiBadge.color}">{osiBadge.label}</span>
                  {:else if node.extension}
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
              <button class="tree-node has-files {nodeFCls}"
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
                    <span role="button" tabindex="0" class="hover-action-btn" title="New File" onclick={(e) => { e.stopPropagation(); startInlineCreate(node.relPath, 'file'); }} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); startInlineCreate(node.relPath, 'file'); } }}>
                      <FilePlus2 size={12} />
                    </span>
                    <span role="button" tabindex="0" class="hover-action-btn" title="New Folder" onclick={(e) => { e.stopPropagation(); startInlineCreate(node.relPath, 'folder'); }} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); startInlineCreate(node.relPath, 'folder'); } }}>
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
                        onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitInlineCreate(); } if (e.key === 'Escape') { e.preventDefault(); cancelInlineCreate(); } }}
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
          {#each filteredModFileDisplayTree as treeNode (treeNode.relPath)}
            {@render modFileNode(treeNode)}
          {/each}
        {:else}
          <span class="tree-node text-muted" style="padding-left: 28px; cursor: default; font-size: 11px; opacity: 0.5;">No text files found</span>
        {/if}
      </div>
    {/if}
  </div>
</div>

<!-- Section context menu -->
{#if ctxVisible}
  <ContextMenu x={ctxX} y={ctxY} header={ctxLabel} headerTitle={ctxPath || ctxLabel} onclose={hideContextMenu} items={ctxItems} />
{/if}

<!-- File tree context menu -->
{#if fileCtxVisible && fileCtxNode}
  <ContextMenu x={fileCtxX} y={fileCtxY} header={fileCtxNode.name} onclose={hideContextMenu}>
    {#if isScriptFile(fileCtxNode.extension)}
      <button class="ctx-item" onclick={() => { const fullPath = `${modsFilePrefix}${fileCtxNode!.relPath}`; uiStore.openScriptTab(fullPath); hideContextMenu(); }} role="menuitem">
        <Pencil size={12} class="shrink-0" />
        {m.file_explorer_edit_script()}
      </button>
      <button class="ctx-item" onclick={async () => { const node = fileCtxNode; if (!node) return; await deleteScriptFile(node); hideContextMenu(); }} role="menuitem">
        <Trash2 size={12} class="shrink-0" />
        {m.file_explorer_delete_script()}
      </button>
    {/if}
    <button class="ctx-item" onclick={() => { if (!fileCtxNode) return; const node = fileCtxNode; hideContextMenu(); startInlineRename(node); }} role="menuitem">
      <Pencil size={12} class="shrink-0" />
      Rename
    </button>
    {#if !fileCtxNode.isFile}
      <button class="ctx-item" onclick={() => { startInlineCreate(fileCtxNode!.relPath, 'file'); hideContextMenu(); }} role="menuitem">
        <FilePlus2 size={12} class="shrink-0" />
        New File
      </button>
      <button class="ctx-item" onclick={() => { startInlineCreate(fileCtxNode!.relPath, 'folder'); hideContextMenu(); }} role="menuitem">
        <FolderPlus size={12} class="shrink-0" />
        New Folder
      </button>
      <button class="ctx-item" onclick={() => { const folderPath = `${modsFilePrefix}${fileCtxNode!.relPath}`; uiStore.searchFilesInclude = folderPath; uiStore.showSearchPanel = true; uiStore.activeView = "search"; hideContextMenu(); }} role="menuitem">
        <Search size={12} class="shrink-0" />
        Find in Folder...
      </button>
    {:else}
      <div class="ctx-separator"></div>
      <button class="ctx-item" onclick={() => { const parentPath = fileCtxNode!.relPath.substring(0, fileCtxNode!.relPath.lastIndexOf('/')); startInlineCreate(parentPath, 'file'); hideContextMenu(); }} role="menuitem">
        <FilePlus2 size={12} class="shrink-0" />
        New File
      </button>
    {/if}
    <div class="ctx-separator"></div>
    <button class="ctx-item" onclick={() => { clipboardNode = fileCtxNode; clipboardOp = 'cut'; hideContextMenu(); }} role="menuitem">
      <Scissors size={12} class="shrink-0" />
      Cut
    </button>
    <button class="ctx-item" onclick={() => { clipboardNode = fileCtxNode; clipboardOp = 'copy'; hideContextMenu(); }} role="menuitem">
      <Copy size={12} class="shrink-0" />
      Copy
    </button>
    {#if clipboardNode}
      <button class="ctx-item" onclick={async () => { await pasteClipboardNode(fileCtxNode!); hideContextMenu(); }} role="menuitem">
        <ClipboardIcon size={12} class="shrink-0" />
        Paste
      </button>
    {/if}
    <div class="ctx-separator"></div>
    <button class="ctx-item" onclick={async () => { const modPath = modStore.selectedModPath; if (modPath && fileCtxNode) { try { await revealPath(`${modPath}/${modsFilePrefix}${fileCtxNode.relPath}`); } catch (e) { toastStore.error(m.file_explorer_open_failed_title(), String(e)); } } hideContextMenu(); }} role="menuitem">
      <FolderOpen size={12} class="shrink-0" />
      Reveal in File Manager
    </button>
    <button class="ctx-item" onclick={async () => { const modPath = modStore.selectedModPath; if (modPath && fileCtxNode) { const fullPath = `${modPath}/${modsFilePrefix}${fileCtxNode.relPath}`; await navigator.clipboard.writeText(fullPath.replace(/\//g, '\\')); } hideContextMenu(); }} role="menuitem">
      <Copy size={12} class="shrink-0" />
      Copy Path
    </button>
    <button class="ctx-item" onclick={async () => { if (fileCtxNode) { await navigator.clipboard.writeText(`${modsFilePrefix}${fileCtxNode.relPath}`); } hideContextMenu(); }} role="menuitem">
      <Copy size={12} class="shrink-0" />
      Copy Relative Path
    </button>
  </ContextMenu>
{/if}

<style>
  .data-content {
    padding: 0 4px;
  }

  .tree-section {
    padding-left: 12px;
  }

  /* ── Pin indicator ── */
  :global(.pin-indicator) {
    color: var(--th-accent-400);
    opacity: 0.6;
    flex-shrink: 0;
    margin-right: -2px;
  }

  /* ── Pin divider between pinned and unpinned groups ── */
  .pin-divider {
    height: 1px;
    margin: 4px 8px 4px 16px;
    background: var(--th-border-300, var(--th-bg-700));
    opacity: 0.4;
  }

  /* ── Drop indicators ── */
  :global(.tree-node.drop-before) {
    box-shadow: inset 0 2px 0 0 var(--th-accent-500);
  }

  :global(.tree-node.drop-after) {
    box-shadow: inset 0 -2px 0 0 var(--th-accent-500);
  }
</style>
