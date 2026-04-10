<script lang="ts">
  import { modStore } from "../../lib/stores/modStore.svelte.js";
  import { uiStore } from "../../lib/stores/uiStore.svelte.js";
  import { toastStore } from "../../lib/stores/toastStore.svelte.js";
  import { projectStore, sectionToTable } from "../../lib/stores/projectStore.svelte.js";
  import { schemaStore } from "../../lib/stores/schemaStore.svelte.js";
  import { createDragReorderState, handleDragStart, handleDragOver, handleDrop, handleDragEnd, getPinContextMenuItems, keyboardReorder, type DragReorderState } from "./dragReorder.js";
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
  import type { SectionResult } from "../../lib/types/index.js";
  import type { ContextMenuItemDef } from "../../lib/types/contextMenu.js";
  import {
    getSectionCount as _getSectionCount,
    getGroupCount as _getGroupCount,
    hasModFiles as _hasModFiles,
    hasSection,
  } from "../../lib/utils/sectionCounts.js";
  import {
    discoverSections,
    enrichCoreFolders,
    mergeAdditionalSections,
  } from "../../lib/utils/folderDiscovery.js";

  let scanResult = $derived(modStore.scanResult);
  let modFolder = $derived(scanResult?.mod_meta?.folder ?? "");
  let sections = $derived(scanResult?.sections ?? []);
  let modsFilePrefix = $derived(modStore.modFilesPrefix);

  // ── File tree data ──

  let modFileTree = $derived.by(() => {
    if (!modsFilePrefix) return buildFileTree(modStore.modFiles);
    const filtered = modStore.modFiles
      .filter(f => f.rel_path.startsWith(modsFilePrefix))
      .map(f => ({ ...f, rel_path: f.rel_path.slice(modsFilePrefix.length) }))
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

  function getSectionCount(section: string | undefined, entryFilter?: { field: string; value: string }): number {
    return _getSectionCount(sectionMap, manualCountBySection, section, entryFilter);
  }

  function getGroupCount(node: FolderNode): number {
    return _getGroupCount(sectionMap, manualCountBySection, node);
  }

  function hasModFiles(node: FolderNode): boolean {
    return _hasModFiles(sectionMap, manualCountBySection, node);
  }

  // ── Discovered sections ──

  let allDiscovered = $derived.by(() => {
    if (!schemaStore.loaded) return { cc: [], content: [], vfx: [], sound: [], general: [] };
    return discoverSections(schemaStore.sectionEntries(), STATIC_SIDEBAR_SECTIONS, SECTIONS_EXCLUDED_FROM_DISCOVERY);
  });

  let enrichedCoreFolders = $derived(enrichCoreFolders(BG3_CORE_FOLDERS, allDiscovered));

  let mergedAdditionalSections = $derived(mergeAdditionalSections(BG3_ADDITIONAL_FOLDERS, allDiscovered));

  // ── Drag-to-reorder state ──

  let dragState = $state(createDragReorderState());

  // Per-parent child drag states for sub-node reordering
  let childDragStates = $state<Record<string, DragReorderState>>({});

  // Eagerly create child drag states for each parent folder node
  $effect(() => {
    const allNodes = [...enrichedCoreFolders, ...mergedAdditionalSections];
    for (const n of allNodes) {
      if (n.children && !childDragStates[n.name]) {
        childDragStates[n.name] = createDragReorderState();
      }
    }
  });

  /** Read-only accessor — never mutates from template */
  const _fallbackDragState: DragReorderState = createDragReorderState();
  function getChildDragState(parentName: string): DragReorderState {
    return childDragStates[parentName] ?? _fallbackDragState;
  }

  function onChildReorder(parentName: string, draggedId: string, targetId: string, position: "before" | "after") {
    uiStore.reorderNode(`data:${parentName}`, draggedId, targetId, position);
  }

  function getOrderedChildren(parentName: string, children: FolderNode[]): FolderNode[] {
    if (!children || children.length === 0) return children;
    const defaultIds = children.map(c => c.name);
    const orderedIds = uiStore.getOrderedNodes(`data:${parentName}`, defaultIds);
    const childMap = new Map(children.map(c => [c.name, c]));
    return orderedIds.map(id => childMap.get(id)).filter((c): c is FolderNode => !!c);
  }

  /** All root-level node IDs: core folders + additional sections (flattened), sorted by has-entries then alphabetical */
  let defaultNodeIds = $derived.by((): string[] => {
    const all: FolderNode[] = [...enrichedCoreFolders, ...mergedAdditionalSections];
    all.sort((a, b) => {
      const aActive = hasModFiles(a) ? 0 : 1;
      const bActive = hasModFiles(b) ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return a.label.localeCompare(b.label);
    });
    return all.map(f => f.name);
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

  /** Whether an additional node should be hidden — always false now (flattened) */
  function isAdditionalHidden(_nodeId: string): boolean {
    return false;
  }

  // ── Keyboard reorder + announcements ──

  let announceMessage = $state("");

  function announce(msg: string): void {
    announceMessage = "";
    requestAnimationFrame(() => { announceMessage = msg; });
  }

  function handleNodeKeydown(e: KeyboardEvent, nodeId: string, idx: number): void {
    if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    e.preventDefault();
    e.stopPropagation();
    const direction = e.key === "ArrowUp" ? "up" : "down";
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= orderedNodeIds.length) return;
    const targetId = orderedNodeIds[targetIdx];
    const position = direction === "up" ? "before" : "after";
    uiStore.reorderNode("data", nodeId, targetId, position);
    const label = nodeMap.get(nodeId)?.label ?? nodeId;
    announce(m.explorer_reorder_announce({ name: label, position: String(targetIdx + 1) }));
    requestAnimationFrame(() => {
      const nodes = document.querySelectorAll<HTMLElement>('.data-content > [role="treeitem"]');
      nodes[targetIdx]?.focus();
    });
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
    const base = modStore.projectPath || modStore.selectedModPath;
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
      uiStore.openTab({ id: `filtered:${node.name}`, label: node.label, type: "filteredSection", category: node.Section, entryFilter: node.entryFilter, regionId: node.regionId, icon: "📄", preview });
    } else if (node.Section) {
      const tabType = node.Section === "Localization" ? "localization" as const : "section" as const;
      uiStore.openTab({ id: node.regionId ? `section:${node.Section}:${node.regionId}` : `section:${node.Section}`, label: node.label, type: tabType, category: node.Section, regionId: node.regionId, icon: "📄", preview });
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

  let isAdditionalExpanded = $derived(uiStore.expandedNodes["_Additional"] ?? false);

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
    toastStore.success(m.explorer_section_refreshed());
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
      items.push({ label: m.explorer_refresh_section(), icon: RefreshCw, action: ctxRefreshSection });
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
    const basePath = modStore.projectPath || modStore.selectedModPath;
    if (!basePath) { isCommittingCreate = false; cancelInlineCreate(); return; }
    if (inlineCreateType === 'file') {
      const relPath = `${modsFilePrefix}${inlineCreateParent}/${name}`;
      try { await touchFile(basePath, relPath); modStore.modFiles = await listModFiles(basePath); uiStore.openScriptTab(relPath); }
      catch (e) { toastStore.error(m.explorer_create_file_failed(), String(e)); }
    } else {
      const relPath = `${modsFilePrefix}${inlineCreateParent}/${name}`;
      try { await createModDirectory(basePath, relPath); modStore.modFiles = await listModFiles(basePath); }
      catch (e) { toastStore.error(m.explorer_create_folder_failed(), String(e)); }
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
    const basePath = modStore.projectPath || modStore.selectedModPath;
    if (!basePath) { isCommittingRename = false; cancelInlineRename(); return; }
    const oldRelPath = `${modsFilePrefix}${node.relPath}`;
    const parentPath = node.relPath.substring(0, node.relPath.lastIndexOf('/'));
    const newRelPath = `${modsFilePrefix}${parentPath}/${newName}`;
    try {
      if (isScriptFile(node.extension)) await scriptRename(basePath, oldRelPath, newRelPath);
      else await moveModFile(basePath, oldRelPath, newRelPath);
      const oldTabId = `script:${oldRelPath}`;
      if (uiStore.openTabs.some(t => t.id === oldTabId)) { uiStore.closeTab(oldTabId); uiStore.openScriptTab(newRelPath); }
      modStore.modFiles = await listModFiles(basePath);
      toastStore.success(m.file_explorer_renamed(), `${node.name} → ${newName}`);
    } catch (e) { toastStore.error(m.explorer_rename_failed(), String(e)); }
    isCommittingRename = false;
    cancelInlineRename();
  }

  // ── Clipboard ──

  let clipboardNode: FileTreeNode | null = $state(null);
  let clipboardOp: 'cut' | 'copy' | null = $state(null);

  async function pasteClipboardNode(targetNode: FileTreeNode) {
    if (!clipboardNode || !clipboardOp) return;
    const basePath = modStore.projectPath || modStore.selectedModPath;
    if (!basePath) return;
    const srcRelPath = `${modsFilePrefix}${clipboardNode.relPath}`;
    const destDir = targetNode.isFile ? targetNode.relPath.substring(0, targetNode.relPath.lastIndexOf('/')) : targetNode.relPath;
    const destRelPath = `${modsFilePrefix}${destDir}/${clipboardNode.name}`;
    try {
      if (clipboardOp === 'cut') await moveModFile(basePath, srcRelPath, destRelPath);
      else await copyModFile(basePath, srcRelPath, destRelPath);
      modStore.modFiles = await listModFiles(basePath);
      if (clipboardOp === 'cut') { clipboardNode = null; clipboardOp = null; }
    } catch (e) { toastStore.error(m.explorer_paste_failed(), String(e)); }
  }

  async function deleteScriptFile(node: FileTreeNode) {
    if (!node.isFile || (!isScriptFile(node.extension) && node.extension !== 'json')) return;
    const fullPath = `${modsFilePrefix}${node.relPath}`;
    const basePath = modStore.projectPath || modStore.selectedModPath;
    if (!basePath) return;
    try {
      await scriptDelete(basePath, fullPath);
      const tabId = `script:${fullPath}`;
      if (uiStore.openTabs.some(t => t.id === tabId)) uiStore.closeTab(tabId);
      modStore.modFiles = await listModFiles(basePath);
      announce(m.explorer_delete_announce({ name: node.name }));
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
              onkeydown={(e) => handleNodeKeydown(e, "_Additional_", idx)}
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
                  onkeydown={(e) => handleNodeKeydown(e, nodeId, idx)}
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
                    {#each getOrderedChildren(node.name, node.children) as child (child.name)}
                      {@const childCount = getGroupCount(child)}
                      {@const childActive = hasModFiles(child)}
                      {@const childExpanded = uiStore.expandedNodes[child.name] ?? false}
                      {@const childFCls = folderFilterClass(child.label, child.children)}
                      {@const cds = getChildDragState(node.name)}

                      {#if child.children}
                        <div class="tree-node {childFCls}" class:has-files={childActive} class:drop-before={cds.dropTargetId === child.name && cds.dropPosition === "before"} class:drop-after={cds.dropTargetId === child.name && cds.dropPosition === "after"} draggable={true} ondragstart={(e) => handleDragStart(e, child.name, node.name, cds)} ondragover={(e) => handleDragOver(e, child.name, node.name, cds)} ondrop={(e) => handleDrop(e, child.name, node.name, cds, (d, t, p) => onChildReorder(node.name, d, t, p))} ondragend={() => handleDragEnd(cds)} role="treeitem" tabindex="0" aria-selected={false} aria-expanded={childExpanded} oncontextmenu={(e) => showContextMenu(e, resolveNodePath(child.name, pathKind === 'additional' ? 'additional' : 'public-child'), child.label, child.Section, child)}>
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
                        <button class="tree-node {childFCls}" class:has-files={childActive} class:active-node={isActiveNode(child)} class:drop-before={cds.dropTargetId === child.name && cds.dropPosition === "before"} class:drop-after={cds.dropTargetId === child.name && cds.dropPosition === "after"} draggable={true} ondragstart={(e) => handleDragStart(e, child.name, node.name, cds)} ondragover={(e) => handleDragOver(e, child.name, node.name, cds)} ondrop={(e) => handleDrop(e, child.name, node.name, cds, (d, t, p) => onChildReorder(node.name, d, t, p))} ondragend={() => handleDragEnd(cds)} onclick={() => openNode(child)} ondblclick={() => openNode(child, false)} oncontextmenu={(e) => showContextMenu(e, resolveNodePath(child.name, pathKind === 'additional' ? 'additional' : 'public-child'), child.label, child.Section, child)}>
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
                  onkeydown={(e) => handleNodeKeydown(e, nodeId, idx)}
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

<!-- Section context menu -->
{#if ctxVisible}
  <ContextMenu x={ctxX} y={ctxY} header={ctxLabel} headerTitle={ctxPath || ctxLabel} onclose={hideContextMenu} items={ctxItems} />
{/if}

<div class="sr-only" aria-live="polite" aria-atomic="true">
  {announceMessage}
</div>

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
  :global(.tree-node.drop-before),
  :global(.tree-node.drop-after) {
    position: relative;
    background: color-mix(in srgb, var(--th-accent-500) 8%, transparent) !important;
  }

  :global(.tree-node.drop-before)::before {
    content: '';
    position: absolute;
    top: -1px;
    left: 8px;
    right: 0;
    height: 2px;
    background: var(--th-accent-500);
    box-shadow: 0 0 4px var(--th-accent-500);
    pointer-events: none;
    z-index: 1;
  }

  :global(.tree-node.drop-before)::after {
    content: '';
    position: absolute;
    top: -4px;
    left: 4px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 2px solid var(--th-accent-500);
    background: var(--th-bg-900, #1a1a2e);
    pointer-events: none;
    z-index: 2;
  }

  :global(.tree-node.drop-after)::before {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 8px;
    right: 0;
    height: 2px;
    background: var(--th-accent-500);
    box-shadow: 0 0 4px var(--th-accent-500);
    pointer-events: none;
    z-index: 1;
  }

  :global(.tree-node.drop-after)::after {
    content: '';
    position: absolute;
    bottom: -4px;
    left: 4px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 2px solid var(--th-accent-500);
    background: var(--th-bg-900, #1a1a2e);
    pointer-events: none;
    z-index: 2;
  }
</style>
