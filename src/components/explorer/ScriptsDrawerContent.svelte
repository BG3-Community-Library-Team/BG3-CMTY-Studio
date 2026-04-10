<script lang="ts">
  import { modStore } from "../../lib/stores/modStore.svelte.js";
  import { uiStore } from "../../lib/stores/uiStore.svelte.js";
  import { settingsStore } from "../../lib/stores/settingsStore.svelte.js";
  import { toastStore } from "../../lib/stores/toastStore.svelte.js";
  import { listModFiles } from "../../lib/utils/tauri.js";
  import { scriptDelete, moveModFile, listExternalTemplates } from "../../lib/tauri/scripts.js";
  import type { ExternalTemplateInfo } from "../../lib/tauri/scripts.js";
  import { m } from "../../paraglide/messages.js";
  import {
    type FileTreeNode,
    buildFileTree,
    filterTree,
    isScriptFile,
    LUA_SE_EXTENSIONS,
    SCRIPT_CATEGORIES,
    SECTION_TEMPLATES,
    explorerFilter,
    filterSearchTree,
    countFileTreeMatches,
  } from "./explorerShared.js";
  import { createDragReorderState } from "./dragReorder.js";
  import type { DragReorderState } from "./dragReorder.js";
  import { commitScriptCreate, commitScriptRename, scaffoldScriptCategory, pasteScriptNode } from "./scriptFileOps.js";
  import ScriptCategoryTree from "./ScriptCategoryTree.svelte";

  let scanResult = $derived(modStore.scanResult);
  let modFolder = $derived(scanResult?.mod_meta?.folder ?? "");
  let modsFilePrefix = $derived(modFolder ? `Mods/${modFolder}/` : "");

  let activeNodeKey = $derived.by(() => {
    const tab = uiStore.activeTab;
    if (!tab) return "";
    if (tab.type === "file-preview") return `file:${tab.filePath ?? ""}`;
    if (tab.type === "script-editor") return `file:${tab.filePath ?? ""}`;
    return "";
  });

  function isActiveFile(relPath: string): boolean {
    return activeNodeKey === `file:${modsFilePrefix}${relPath}`;
  }

  // ── Section-bounded drag state ──

  let dragStates = $state<Record<string, DragReorderState>>({
    "lua-se": createDragReorderState(),
    "khonsu": createDragReorderState(),
    "osiris": createDragReorderState(),
    "anubis": createDragReorderState(),
    "constellations": createDragReorderState(),
  });

  function getDragState(key: string): DragReorderState {
    return dragStates[key] ?? (dragStates[key] = createDragReorderState());
  }

  function onSectionReorder(sectionKey: string, draggedId: string, targetId: string, position: "before" | "after") {
    uiStore.reorderNode(`scripts:${sectionKey}`, draggedId, targetId, position);
  }

  function onSectionMove(sectionKey: string, draggedRelPath: string, targetRelPath: string) {
    const modPath = modStore.selectedModPath;
    if (!modPath) return;
    const fromPath = `${modsFilePrefix}${draggedRelPath}`;
    const targetDir = targetRelPath.substring(0, targetRelPath.lastIndexOf('/'));
    const fileName = draggedRelPath.substring(draggedRelPath.lastIndexOf('/') + 1);
    const toPath = `${modsFilePrefix}${targetDir}/${fileName}`;
    if (fromPath === toPath) return;
    moveModFile(modPath, fromPath, toPath).then(async () => {
      await refreshModFiles();
      toastStore.success(m.explorer_file_moved(), fileName);
    }).catch((e) => {
      toastStore.error(m.explorer_move_failed(), String(e));
    });
  }

  function getOrderedTree(sectionKey: string, nodes: FileTreeNode[]): FileTreeNode[] {
    if (nodes.length === 0) return nodes;
    const defaultIds = nodes.map(n => n.relPath);
    const orderedIds = uiStore.getOrderedNodes(`scripts:${sectionKey}`, defaultIds);
    const nodeMap = new Map(nodes.map(n => [n.relPath, n]));
    const ordered: FileTreeNode[] = [];
    for (const id of orderedIds) {
      const node = nodeMap.get(id);
      if (node) ordered.push(node);
    }
    return ordered;
  }

  // ── File trees ──

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

  let luaSeTree = $derived.by((): FileTreeNode[] => {
    const seDir = modFileTree.find(n => !n.isFile && n.name === "ScriptExtender");
    if (!seDir?.children) return [];
    return filterTree(seDir.children, LUA_SE_EXTENSIONS);
  });

  let khonsuTree = $derived.by((): FileTreeNode[] => {
    const scriptsDir = modFileTree.find(n => !n.isFile && n.name === "Scripts");
    if (!scriptsDir?.children) return [];
    const thothDir = scriptsDir.children.find(n => !n.isFile && n.name === "thoth");
    if (!thothDir?.children) return [];
    const helpersDir = thothDir.children.find(n => !n.isFile && n.name === "helpers");
    if (!helpersDir?.children) return [];
    return filterTree(helpersDir.children, new Set(["khn"]));
  });

  let osirisTree = $derived.by((): FileTreeNode[] => {
    const storyDir = modFileTree.find(n => !n.isFile && n.name === "Story");
    if (!storyDir?.children) return [];
    const rawDir = storyDir.children.find(n => !n.isFile && n.name === "RawFiles");
    if (!rawDir?.children) return [];
    const goalsDir = rawDir.children.find(n => !n.isFile && n.name === "Goals");
    if (!goalsDir?.children) return [];
    return filterTree(goalsDir.children, new Set(["txt"]));
  });

  let anubisTree = $derived.by((): FileTreeNode[] => {
    const scriptsDir = modFileTree.find(n => !n.isFile && n.name === "Scripts");
    if (!scriptsDir?.children) return [];
    const anubisDir = scriptsDir.children.find(n => !n.isFile && n.name === "anubis");
    if (!anubisDir?.children) return [];
    return filterTree(anubisDir.children, new Set(["anc", "ann", "anm"]));
  });

  let constellationsTree = $derived.by((): FileTreeNode[] => {
    const scriptsDir = modFileTree.find(n => !n.isFile && n.name === "Scripts");
    if (!scriptsDir?.children) return [];
    const constDir = scriptsDir.children.find(n => !n.isFile && n.name === "constellations");
    if (!constDir?.children) return [];
    return filterTree(constDir.children, new Set(["clc", "cln", "clm"]));
  });

  function getTreeData(key: string): FileTreeNode[] {
    switch (key) {
      case 'lua-se': return luaSeTree;
      case 'khonsu': return khonsuTree;
      case 'osiris': return osirisTree;
      case 'anubis': return anubisTree;
      case 'constellations': return constellationsTree;
      default: return [];
    }
  }

  function getFilteredTreeData(key: string): FileTreeNode[] {
    const tree = getTreeData(key);
    if (!explorerFilter.active || !explorerFilter.query || explorerFilter.mode !== 'filter') return tree;
    return filterSearchTree(tree, explorerFilter.query, explorerFilter.fuzzy);
  }

  function getFilterMatchCount(key: string): number {
    if (!explorerFilter.active || !explorerFilter.query) return 0;
    return countFileTreeMatches(getTreeData(key), explorerFilter.query, explorerFilter.fuzzy);
  }

  let scriptCounts = $derived.by((): Map<string, number> => {
    const counts = new Map<string, number>();
    function countFiles(nodes: FileTreeNode[]): void {
      for (const n of nodes) {
        if (n.isFile && n.extension) {
          for (const cat of SCRIPT_CATEGORIES) {
            if (cat.extensions.has(n.extension) && n.relPath.startsWith(cat.dir)) {
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

  // ── External templates ──

  type TemplateEntry = { id: string; label: string; sourcePath?: string; extension?: string };

  let externalTemplates: ExternalTemplateInfo[] = $state([]);

  $effect(() => {
    const folderPath = settingsStore.templateFoldersPath;
    if (folderPath) {
      listExternalTemplates(folderPath).then(
        (templates) => { externalTemplates = templates; },
        () => { externalTemplates = []; },
      );
    } else {
      externalTemplates = [];
    }
  });

  let mergedTemplates = $derived.by(() => {
    const result: Record<string, TemplateEntry[]> = {};
    for (const [cat, templates] of Object.entries(SECTION_TEMPLATES)) {
      result[cat] = templates.map(t => ({ ...t }));
    }
    for (const ext of externalTemplates) {
      if (!result[ext.category]) result[ext.category] = [];
      result[ext.category].push({ id: ext.id, label: ext.label, sourcePath: ext.source_path, extension: ext.extension });
    }
    return result;
  });

  let externalSourcePaths = $derived.by(() => {
    const map: Record<string, string> = {};
    for (const ext of externalTemplates) map[ext.id] = ext.source_path;
    return map;
  });

  // ── Refresh ──

  async function refreshModFiles(): Promise<void> {
    const modPath = modStore.selectedModPath;
    if (!modPath) return;
    try { modStore.modFiles = await listModFiles(modPath); }
    catch (err) { console.warn("Failed to refresh mod files:", err); }
  }

  // ── Inline create/rename shared state ──

  let inlineCreate = $state({
    parent: null as string | null,
    type: null as 'file' | 'folder' | null,
    name: "",
    pendingTemplateId: null as string | null,
    pendingTemplateCategory: null as string | null,
  });

  let inlineRename = $state({
    node: null as FileTreeNode | null,
    name: "",
  });

  let isCommittingCreate = false;
  let isCommittingRename = false;

  function resetInlineCreate() {
    inlineCreate.parent = null;
    inlineCreate.type = null;
    inlineCreate.name = '';
    inlineCreate.pendingTemplateId = null;
    inlineCreate.pendingTemplateCategory = null;
  }

  function resetInlineRename() {
    inlineRename.node = null;
    inlineRename.name = '';
  }

  async function handleCommitCreate(): Promise<void> {
    if (isCommittingCreate) return;
    if (!inlineCreate.name.trim() || !inlineCreate.parent || !inlineCreate.type) { resetInlineCreate(); return; }
    isCommittingCreate = true;
    try {
      await commitScriptCreate({
        name: inlineCreate.name,
        parent: inlineCreate.parent,
        type: inlineCreate.type,
        modsFilePrefix,
        modFolder,
        templateId: inlineCreate.pendingTemplateId,
        templateCategory: inlineCreate.pendingTemplateCategory,
        externalTemplates,
        externalSourcePaths,
        refreshModFiles,
      });
    } finally {
      isCommittingCreate = false;
      resetInlineCreate();
    }
  }

  async function handleCommitRename(): Promise<void> {
    if (isCommittingRename) return;
    if (!inlineRename.node || !inlineRename.name.trim()) { resetInlineRename(); return; }
    isCommittingRename = true;
    const node = inlineRename.node;
    const newName = inlineRename.name.trim();
    if (newName === node.name) { isCommittingRename = false; resetInlineRename(); return; }
    try {
      await commitScriptRename({ node, newName, modsFilePrefix, refreshModFiles });
    } finally {
      isCommittingRename = false;
      resetInlineRename();
    }
  }

  // ── Delete ──

  async function deleteScriptFile(node: FileTreeNode, sectionKey?: string): Promise<boolean> {
    if (!node.isFile || (!isScriptFile(node.extension) && node.extension !== 'json')) return false;
    const fullPath = `${modsFilePrefix}${node.relPath}`;
    const modPath = modStore.selectedModPath;
    if (!modPath) return false;

    let focusTarget: HTMLElement | null = null;
    if (sectionKey) {
      const orderedData = getOrderedTree(sectionKey, getTreeData(sectionKey));
      const idx = orderedData.findIndex(n => n.relPath === node.relPath);
      const container = document.querySelector(`[data-section="${sectionKey}"]`);
      const siblings = container?.querySelectorAll<HTMLElement>('.tree-node.has-files');
      if (siblings && idx >= 0) {
        if (idx < siblings.length - 1) focusTarget = siblings[idx + 1];
        else if (idx > 0) focusTarget = siblings[idx - 1];
        else focusTarget = container?.querySelector<HTMLElement>('.tree-node') ?? null;
      }
    }

    try {
      await scriptDelete(modPath, fullPath);
      const tabId = `script:${fullPath}`;
      if (uiStore.openTabs.some(t => t.id === tabId)) uiStore.closeTab(tabId);
      await refreshModFiles();
      toastStore.success(m.file_explorer_delete_script(), node.name);
      if (focusTarget) requestAnimationFrame(() => focusTarget.focus());
      return true;
    } catch (e) { toastStore.error(m.file_explorer_delete_script(), String(e)); return false; }
  }

  // ── Paste ──

  async function handlePaste(clipNode: FileTreeNode, op: 'cut' | 'copy', target: FileTreeNode): Promise<boolean> {
    return pasteScriptNode({ clipboardNode: clipNode, clipboardOp: op, targetNode: target, modsFilePrefix, refreshModFiles });
  }

  // ── Scaffold ──

  async function handleScaffold(catKey: string): Promise<void> {
    await scaffoldScriptCategory({ catKey, modFolder, refreshModFiles });
  }

  // ── Keyboard reorder ──
  // Handled by ScriptCategoryTree (owns announce and aria-live region)
</script>

<ScriptCategoryTree
  {scriptCounts}
  {getTreeData}
  {getFilteredTreeData}
  {getOrderedTree}
  {getFilterMatchCount}
  {getDragState}
  {isActiveFile}
  {modsFilePrefix}
  {inlineCreate}
  {inlineRename}
  {mergedTemplates}
  onCommitCreate={handleCommitCreate}
  onCommitRename={handleCommitRename}
  onDelete={deleteScriptFile}
  onPaste={handlePaste}
  onScaffold={handleScaffold}
  onRefresh={refreshModFiles}
  onReorder={onSectionReorder}
  onMove={onSectionMove}
/>
