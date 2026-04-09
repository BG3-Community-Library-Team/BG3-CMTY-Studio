<script lang="ts">
  import { modStore } from "../../lib/stores/modStore.svelte.js";
  import { uiStore } from "../../lib/stores/uiStore.svelte.js";
  import { settingsStore } from "../../lib/stores/settingsStore.svelte.js";
  import { toastStore } from "../../lib/stores/toastStore.svelte.js";
  import { listModFiles } from "../../lib/utils/tauri.js";
  import { revealPath } from "../../lib/utils/tauri.js";
  import {
    scriptDelete, touchFile, createModDirectory, moveModFile, copyModFile,
    scaffoldSeStructure, scaffoldKhonsuStructure, scaffoldOsirisStructure,
    scriptCreateFromTemplate, scriptRename, listExternalTemplates, createFromExternalTemplate,
  } from "../../lib/tauri/scripts.js";
  import type { ExternalTemplateInfo } from "../../lib/tauri/scripts.js";
  import { m } from "../../paraglide/messages.js";
  import {
    type FileTreeNode,
    buildFileTree,
    filterTree,
    isScriptFile,
    getOsirisBadge,
    getSeContextBadge,
    getComputedZoom,
    getDefaultExtForPath,
    detectSectionFromPath,
    sectionCategoryToDir,
    EXT_BADGE_COLORS,
    EXT_BADGE_FALLBACK,
    SCRIPT_MANAGED_ROOTS,
    LUA_SE_EXTENSIONS,
    SCRIPT_CATEGORIES,
    SECTION_TEMPLATES,
    SECTION_DEFAULT_EXT,
    TEMPLATE_EXT,
    explorerFilter,
    matchesFilter,
    filterSearchTree,
    countFileTreeMatches,
  } from "./explorerShared.js";
  import { createDragReorderState, handleDragStart, handleDragOver, handleDrop, handleDragEnd } from "./dragReorder.js";
  import type { DragReorderState } from "./dragReorder.js";
  import ContextMenu from "../ContextMenu.svelte";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import File from "@lucide/svelte/icons/file";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import Folder from "@lucide/svelte/icons/folder";
  import FileCode from "@lucide/svelte/icons/file-code";
  import FilePlus2 from "@lucide/svelte/icons/file-plus-2";
  import FolderPlus from "@lucide/svelte/icons/folder-plus";
  import Plus from "@lucide/svelte/icons/plus";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Copy from "@lucide/svelte/icons/copy";
  import Scissors from "@lucide/svelte/icons/scissors";
  import ClipboardIcon from "@lucide/svelte/icons/clipboard";
  import Search from "@lucide/svelte/icons/search";
  import Pin from "@lucide/svelte/icons/pin";
  import PinOff from "@lucide/svelte/icons/pin-off";

  let scanResult = $derived(modStore.scanResult);
  let modFolder = $derived(scanResult?.mod_meta?.folder ?? "");
  let modsFilePrefix = $derived(modFolder ? `Mods/${modFolder}/` : "");

  let isScriptsExpanded = $derived(uiStore.expandedNodes["_Scripts"] ?? false);

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

  async function onSectionMove(sectionKey: string, draggedRelPath: string, targetRelPath: string) {
    const modPath = modStore.selectedModPath;
    if (!modPath) return;
    const fromPath = `${modsFilePrefix}${draggedRelPath}`;
    const targetDir = targetRelPath.substring(0, targetRelPath.lastIndexOf('/'));
    const fileName = draggedRelPath.substring(draggedRelPath.lastIndexOf('/') + 1);
    const toPath = `${modsFilePrefix}${targetDir}/${fileName}`;
    if (fromPath === toPath) return;
    try {
      await moveModFile(modPath, fromPath, toPath);
      await refreshModFiles();
      toastStore.success("File moved", fileName);
    } catch (e) {
      toastStore.error("Move failed", String(e));
    }
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

  function scriptFileFilterClass(name: string, children?: FileTreeNode[]): string {
    const q = explorerFilter.query;
    if (!explorerFilter.active || !q) return '';
    if (matchesFilter(name, q, explorerFilter.fuzzy).matched) return 'filter-match';
    if (children && filterSearchTree(children, q, explorerFilter.fuzzy).length > 0) return '';
    return explorerFilter.mode === 'filter' ? 'filter-hidden' : 'filter-dimmed';
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

  let totalScriptCount = $derived.by(() => {
    let sum = 0;
    for (const v of scriptCounts.values()) sum += v;
    return sum;
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

  // ── Context menu ──

  let scriptsCtxVisible = $state(false);
  let scriptsCtxX = $state(0);
  let scriptsCtxY = $state(0);
  let scriptsCtxCategory: string | null = $state(null);

  let fileCtxVisible = $state(false);
  let fileCtxX = $state(0);
  let fileCtxY = $state(0);
  let fileCtxNode: FileTreeNode | null = $state(null);
  let fileCtxSectionKey: string | null = $state(null);
  let fileCtxIsTopLevel = $state(false);

  function showFileContextMenu(e: MouseEvent, node: FileTreeNode, sectionKey?: string, isTopLevel?: boolean) {
    e.preventDefault();
    e.stopPropagation();
    const zoom = getComputedZoom(e.currentTarget as HTMLElement);
    fileCtxX = e.clientX / zoom;
    fileCtxY = e.clientY / zoom;
    fileCtxNode = node;
    fileCtxSectionKey = sectionKey ?? null;
    fileCtxIsTopLevel = isTopLevel ?? false;
    fileCtxVisible = true;
  }

  function hideContextMenu() {
    scriptsCtxVisible = false;
    fileCtxVisible = false;
    fileCtxNode = null;
    fileCtxSectionKey = null;
    fileCtxIsTopLevel = false;
  }

  // ── Hover ──

  let hoveredNode: string | null = $state(null);

  // ── Inline create ──

  let inlineCreateParent: string | null = $state(null);
  let inlineCreateType: 'file' | 'folder' | null = $state(null);
  let inlineCreateName = $state("");
  let inlineCreateInput: HTMLInputElement | null = $state(null);
  let pendingTemplateId: string | null = $state(null);
  let pendingTemplateCategory: string | null = $state(null);
  let isCommittingCreate = false;

  function startInlineCreate(parentRelPath: string, type: 'file' | 'folder') {
    cancelInlineRename();
    inlineCreateParent = parentRelPath;
    inlineCreateType = type;
    inlineCreateName = '';
    pendingTemplateId = null;
    pendingTemplateCategory = null;
    uiStore.expandedNodes[`script:${parentRelPath}`] = true;
    requestAnimationFrame(() => { requestAnimationFrame(() => { inlineCreateInput?.focus(); }); });
  }

  function startInlineCreateFromTemplate(parentRelPath: string, templateId: string, category: string | null) {
    cancelInlineRename();
    inlineCreateParent = parentRelPath;
    inlineCreateType = 'file';
    inlineCreateName = '';
    pendingTemplateId = templateId;
    pendingTemplateCategory = category;
    uiStore.expandedNodes[`script:${parentRelPath}`] = true;
    const parts = parentRelPath.split('/');
    for (let i = 1; i < parts.length; i++) {
      uiStore.expandedNodes[`script:${parts.slice(0, i).join('/')}`] = true;
    }
    requestAnimationFrame(() => { requestAnimationFrame(() => { inlineCreateInput?.focus(); }); });
  }

  function cancelInlineCreate() {
    inlineCreateParent = null;
    inlineCreateType = null;
    inlineCreateName = '';
    pendingTemplateId = null;
    pendingTemplateCategory = null;
  }

  function createFromSectionTemplate(templateId: string, sectionCategory: string | null, parentDirOverride?: string): void {
    const parentDir = parentDirOverride ?? sectionCategoryToDir(sectionCategory);
    const nodeKey = `_Scripts_${sectionCategory ?? 'lua-se'}`;
    uiStore.expandNode('_Scripts');
    uiStore.expandNode(nodeKey);
    if (parentDirOverride) {
      uiStore.expandedNodes[`modfile:${parentDirOverride}`] = true;
    }
    startInlineCreateFromTemplate(parentDir, templateId, sectionCategory);
  }

  async function commitInlineCreate() {
    if (isCommittingCreate) return;
    if (!inlineCreateName.trim() || !inlineCreateParent || !inlineCreateType) { cancelInlineCreate(); return; }
    isCommittingCreate = true;
    let finalName = inlineCreateName.trim();
    const modPath = modStore.selectedModPath;
    if (!modPath) { isCommittingCreate = false; cancelInlineCreate(); return; }

    if (inlineCreateType === 'file' && !finalName.includes('.') && inlineCreateParent) {
      const defaultExt = getDefaultExtForPath(inlineCreateParent);
      if (defaultExt) finalName = finalName + defaultExt;
    }

    if (pendingTemplateId && pendingTemplateCategory) {
      let templateExt = TEMPLATE_EXT[pendingTemplateId];
      if (!templateExt) {
        const extInfo = externalTemplates.find(e => e.id === pendingTemplateId);
        if (extInfo) templateExt = extInfo.extension;
      }
      if (!templateExt) templateExt = SECTION_DEFAULT_EXT[pendingTemplateCategory];
      if (templateExt) {
        const baseName = finalName.includes('.') ? finalName.substring(0, finalName.lastIndexOf('.')) : finalName;
        finalName = baseName + templateExt;
      }
    }

    if (pendingTemplateId && inlineCreateType === 'file') {
      const targetDir = `${modsFilePrefix}${inlineCreateParent}`;
      const relPath = `${targetDir}/${finalName}`;
      const variables: Record<string, string> = {
        FILE_NAME: finalName,
        MOD_NAME: modFolder,
        MOD_TABLE: modFolder.replace(/[^a-zA-Z0-9_]/g, '_'),
      };
      try {
        const sourcePath = externalSourcePaths[pendingTemplateId];
        if (sourcePath) await createFromExternalTemplate(modPath, relPath, sourcePath, variables);
        else await scriptCreateFromTemplate(modPath, relPath, pendingTemplateId, variables);
        await refreshModFiles();
        uiStore.openScriptTab(relPath);
        toastStore.success("Template created", finalName);
      } catch (e) { toastStore.error("Template creation failed", String(e)); }
    } else if (inlineCreateType === 'file') {
      const relPath = `${modsFilePrefix}${inlineCreateParent}/${finalName}`;
      try { await touchFile(modPath, relPath); await refreshModFiles(); uiStore.openScriptTab(relPath); }
      catch (e) { toastStore.error("Failed to create file", String(e)); }
    } else {
      const relPath = `${modsFilePrefix}${inlineCreateParent}/${inlineCreateName.trim()}`;
      try { await createModDirectory(modPath, relPath); await refreshModFiles(); }
      catch (e) { toastStore.error("Failed to create folder", String(e)); }
    }
    isCommittingCreate = false;
    cancelInlineCreate();
  }

  // ── Inline rename ──

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
      await refreshModFiles();
      toastStore.success(m.file_explorer_renamed(), `${node.name} → ${newName}`);
      if (isScriptFile(node.extension)) toastStore.info(m.file_explorer_rename_xref_warning_title(), m.file_explorer_rename_xref_warning());
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
      await refreshModFiles();
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
      await refreshModFiles();
      toastStore.success(m.file_explorer_delete_script(), node.name);
    } catch (e) { toastStore.error(m.file_explorer_delete_script(), String(e)); }
  }

  // ── Scaffold ──

  async function scaffoldCategory(catKey: string): Promise<void> {
    const modPath = modStore.selectedModPath;
    const folder = modFolder;
    if (!modPath || !folder) return;
    try {
      let created: string[];
      if (catKey === 'lua-se') {
        created = await scaffoldSeStructure(modPath, folder, true, true);
      } else if (catKey === 'khonsu') {
        created = await scaffoldKhonsuStructure(modPath, folder);
      } else if (catKey === 'osiris') {
        created = await scaffoldOsirisStructure(modPath, folder);
      } else if (catKey === 'anubis') {
        const dirPath = `Mods/${folder}/Scripts/anubis`;
        await createModDirectory(modPath, dirPath);
        const relPath = `${dirPath}/config.anc`;
        const variables = { FILE_NAME: 'config.anc', MOD_NAME: folder, MOD_TABLE: folder.replace(/[^a-zA-Z0-9_]/g, '_') };
        await scriptCreateFromTemplate(modPath, relPath, 'anubis_config', variables);
        created = [relPath];
      } else if (catKey === 'constellations') {
        const dirPath = `Mods/${folder}/Scripts/constellations`;
        await createModDirectory(modPath, dirPath);
        const relPath = `${dirPath}/config.clc`;
        const variables = { FILE_NAME: 'config.clc', MOD_NAME: folder, MOD_TABLE: folder.replace(/[^a-zA-Z0-9_]/g, '_') };
        await scriptCreateFromTemplate(modPath, relPath, 'constellations_config', variables);
        created = [relPath];
      } else { return; }
      if (created.length > 0) {
        await refreshModFiles();
        toastStore.success("Scaffold created", `${created.length} file(s) added`);
        uiStore.openScriptTab(created[0]);
      }
    } catch (e) { toastStore.error("Scaffold failed", String(e)); }
  }

  // ── File open ──

  function openFilePreview(fileNode: FileTreeNode, preview = true): void {
    const fullRelPath = `${modsFilePrefix}${fileNode.relPath}`;
    if (isScriptFile(fileNode.extension)) { uiStore.openScriptTab(fullRelPath); return; }
    if (fileNode.extension === "txt" && fileNode.relPath.includes("Story/RawFiles/Goals/")) { uiStore.openScriptTab(fullRelPath); return; }
    uiStore.openTab({ id: `file:${fullRelPath}`, label: fileNode.name, type: "file-preview", filePath: fullRelPath, icon: "📄", preview });
  }
</script>

<div class="scripts-content" onclick={hideContextMenu} role="none">
  <!-- Scripts root node -->
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
      scriptsCtxCategory = null;
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
      {#snippet scriptNode(node: FileTreeNode, sectionKey: string, isTopLevel: boolean)}
        {@const sFCls = scriptFileFilterClass(node.name, node.children)}
        {@const ds = getDragState(sectionKey)}
        {@const isDragOver = ds.dropTargetId === node.relPath}
        {@const dropPos = ds.dropPosition}
        {@const pinned = isTopLevel && uiStore.isNodePinned(`scripts:${sectionKey}`, node.relPath)}
        {#if node.isFile}
          {#if inlineRenameNode?.relPath === node.relPath}
            <div class="tree-node inline-create has-files">
              <span class="w-3.5 shrink-0"></span>
              <File size={14} class="text-[var(--th-text-emerald-400)]" />
              <input bind:this={inlineRenameInput} bind:value={inlineRenameName} class="inline-create-input"
                onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitInlineRename(); } if (e.key === 'Escape') { e.preventDefault(); cancelInlineRename(); } }}
                onblur={() => { if (inlineRenameName.trim()) commitInlineRename(); else cancelInlineRename(); }}
              />
            </div>
          {:else}
            <button
              class="tree-node has-files {sFCls}"
              class:active-node={isActiveFile(node.relPath)}
              class:drop-before={isDragOver && dropPos === 'before'}
              class:drop-after={isDragOver && dropPos === 'after'}
              class:dragging={ds.draggedId === node.relPath}
              draggable={true}
              ondragstart={(e) => handleDragStart(e, node.relPath, sectionKey, ds)}
              ondragover={(e) => handleDragOver(e, node.relPath, sectionKey, ds)}
              ondrop={(e) => handleDrop(e, node.relPath, sectionKey, ds,
                (d, t, p) => onSectionReorder(sectionKey, d, t, p),
                (d, t) => onSectionMove(sectionKey, d, t))}
              ondragend={() => handleDragEnd(ds)}
              onclick={() => openFilePreview(node)}
              ondblclick={() => openFilePreview(node, false)}
              oncontextmenu={(e) => showFileContextMenu(e, node, sectionKey, isTopLevel)}
              onkeydown={(e) => { if (e.key === 'Delete') { deleteScriptFile(node); } }}
              onmouseenter={() => { hoveredNode = node.relPath; }}
              onmouseleave={() => { hoveredNode = null; }}
            >
              {#if pinned}
                <Pin size={10} class="pin-indicator" />
              {/if}
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
                {#if node.extension}
                  {@const osirisBadge = getOsirisBadge(node.relPath, node.extension)}
                  {#if osirisBadge}
                    <span class="ext-badge" style="background: {osirisBadge.color}">{osirisBadge.label}</span>
                  {:else}
                    <span class="ext-badge" style="background: {EXT_BADGE_COLORS[node.extension] ?? EXT_BADGE_FALLBACK}">.{node.extension}</span>
                  {/if}
                {/if}
                {#if getSeContextBadge(node.relPath)}
                  {@const seBadge = getSeContextBadge(node.relPath)!}
                  <span class="se-ctx-badge" style="background: {seBadge.color}">{seBadge.label}</span>
                {/if}
              {/if}
            </button>
          {/if}
        {:else}
          {@const expanded = uiStore.expandedNodes[`script:${node.relPath}`] ?? false}
          {#if inlineRenameNode?.relPath === node.relPath}
            <div class="tree-node inline-create has-files">
              <ChevronRight size={14} class="chevron {expanded ? 'expanded' : ''}" />
              <Folder size={14} class="text-[var(--th-text-emerald-400)]" />
              <input bind:this={inlineRenameInput} bind:value={inlineRenameName} class="inline-create-input"
                onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitInlineRename(); } if (e.key === 'Escape') { e.preventDefault(); cancelInlineRename(); } }}
                onblur={() => { if (inlineRenameName.trim()) commitInlineRename(); else cancelInlineRename(); }}
              />
            </div>
          {:else}
            <button class="tree-node has-files {sFCls}"
              class:drop-before={isDragOver && dropPos === 'before'}
              class:drop-after={isDragOver && dropPos === 'after'}
              class:dragging={ds.draggedId === node.relPath}
              draggable={true}
              ondragstart={(e) => handleDragStart(e, node.relPath, sectionKey, ds)}
              ondragover={(e) => handleDragOver(e, node.relPath, sectionKey, ds)}
              ondrop={(e) => handleDrop(e, node.relPath, sectionKey, ds,
                (d, t, p) => onSectionReorder(sectionKey, d, t, p),
                (d, t) => onSectionMove(sectionKey, d, t))}
              ondragend={() => handleDragEnd(ds)}
              onclick={() => uiStore.toggleNode(`script:${node.relPath}`)}
              oncontextmenu={(e) => showFileContextMenu(e, node, sectionKey, isTopLevel)}
              onmouseenter={() => { hoveredNode = node.relPath; }}
              onmouseleave={() => { hoveredNode = null; }}
            >
              {#if pinned}
                <Pin size={10} class="pin-indicator" />
              {/if}
              <ChevronRight size={14} class="chevron {expanded ? 'expanded' : ''}" />
              {#if expanded}
                <FolderOpen size={14} class="text-[var(--th-text-emerald-400)]" />
              {:else}
                <Folder size={14} class="text-[var(--th-text-emerald-400)]" />
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
          {/if}
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
                  <input bind:this={inlineCreateInput} bind:value={inlineCreateName} class="inline-create-input"
                    placeholder={inlineCreateType === 'folder' ? 'folder name' : 'filename.lua'}
                    onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitInlineCreate(); } if (e.key === 'Escape') { e.preventDefault(); cancelInlineCreate(); } }}
                    onblur={() => { if (inlineCreateName.trim()) commitInlineCreate(); else cancelInlineCreate(); }}
                  />
                </div>
              {/if}
              {#each node.children as child (child.relPath)}
                {@render scriptNode(child, sectionKey, false)}
              {/each}
            </div>
          {/if}
        {/if}
      {/snippet}

      {#each SCRIPT_CATEGORIES as cat (cat.key)}
        {@const count = scriptCounts.get(cat.key) ?? 0}
        {@const treeData = getTreeData(cat.key)}
        {@const filteredTreeData = getFilteredTreeData(cat.key)}
        {@const filterMatchCount = explorerFilter.active && explorerFilter.query ? countFileTreeMatches(treeData, explorerFilter.query, explorerFilter.fuzzy) : 0}
        {@const nodeKey = `_Scripts_${cat.key}`}
        {@const isExpanded = uiStore.expandedNodes[nodeKey] ?? false}
        {@const catDir = cat.dir}
        <div>
          <div class="tree-node" class:has-files={count > 0} role="treeitem" tabindex="-1" aria-selected={false} aria-expanded={isExpanded}
            oncontextmenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const zoom = getComputedZoom(e.currentTarget as HTMLElement);
              scriptsCtxX = e.clientX / zoom;
              scriptsCtxY = e.clientY / zoom;
              scriptsCtxCategory = cat.key;
              scriptsCtxVisible = true;
            }}
          >
            <span class="chevron-hit" onclick={(e) => { e.stopPropagation(); uiStore.toggleNode(nodeKey); }} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); uiStore.toggleNode(nodeKey); } }} role="button" tabindex="0" aria-label="Toggle {cat.label}">
              <ChevronRight size={14} class="chevron {isExpanded ? 'expanded' : ''}" />
            </span>
            <button class="tree-node-label" onclick={() => uiStore.toggleNode(nodeKey)}>
              <FileCode size={14} class={count > 0 ? "text-[var(--th-text-emerald-400)]" : "text-[var(--th-text-600)] opacity-40"} />
              <span class="node-label truncate" class:text-muted={count === 0}>{cat.label}</span>
              {#if filterMatchCount > 0}
                <span class="filter-match-count">{filterMatchCount}</span>
              {:else if count > 0}
                <span class="entry-count">{count}</span>
              {/if}
            </button>
          </div>
          {#if isExpanded}
            <div class="tree-children">
              {#if catDir && inlineCreateParent === catDir}
                <div class="tree-node inline-create">
                  <span class="w-3.5 shrink-0"></span>
                  {#if inlineCreateType === 'folder'}
                    <Folder size={14} class="text-[var(--th-text-emerald-400)]" />
                  {:else}
                    <File size={14} class="text-[var(--th-text-emerald-400)]" />
                  {/if}
                  <input bind:this={inlineCreateInput} bind:value={inlineCreateName} class="inline-create-input"
                    placeholder={inlineCreateType === 'folder' ? 'folder name' : `filename${((pendingTemplateId && TEMPLATE_EXT[pendingTemplateId]) || SECTION_DEFAULT_EXT[cat.key]) ?? ''}`}
                    onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitInlineCreate(); } if (e.key === 'Escape') { e.preventDefault(); cancelInlineCreate(); } }}
                    onblur={() => { if (inlineCreateName.trim()) commitInlineCreate(); else cancelInlineCreate(); }}
                  />
                </div>
              {/if}
              {#if filteredTreeData.length > 0}
                {@const orderedData = getOrderedTree(cat.key, filteredTreeData)}
                {#each orderedData as node (node.relPath)}
                  {@render scriptNode(node, cat.key, true)}
                {/each}
              {:else if count === 0 && !(catDir && inlineCreateParent === catDir)}
                <button class="tree-node text-muted" onclick={() => scaffoldCategory(cat.key)}>
                  <span class="w-3.5 shrink-0"></span>
                  <Plus size={14} class="text-[var(--th-text-500)]" />
                  <span class="node-label truncate text-[var(--th-text-500)] italic">Initialize {cat.label}...</span>
                </button>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Scripts context menu -->
{#if scriptsCtxVisible}
  {@const ctxDir = scriptsCtxCategory === 'khonsu' ? 'Scripts/thoth/helpers'
    : scriptsCtxCategory === 'osiris' ? 'Story/RawFiles/Goals'
    : scriptsCtxCategory === 'anubis' ? 'Scripts/anubis'
    : scriptsCtxCategory === 'constellations' ? 'Scripts/constellations'
    : 'ScriptExtender'}
  {@const templates = mergedTemplates[scriptsCtxCategory ?? 'lua-se'] ?? []}
  {@const ctxNodeKey = scriptsCtxCategory ? `_Scripts_${scriptsCtxCategory}` : '_Scripts_lua-se'}
  {@const ctxLbl = scriptsCtxCategory === 'khonsu' ? 'Khonsu'
    : scriptsCtxCategory === 'osiris' ? 'Osiris'
    : 'Scripts'}
  <ContextMenu x={scriptsCtxX} y={scriptsCtxY} header={ctxLbl} onclose={hideContextMenu}>
    <button class="ctx-item" onclick={() => { startInlineCreate(ctxDir, 'file'); scriptsCtxVisible = false; uiStore.expandNode('_Scripts'); uiStore.expandNode(ctxNodeKey); }} role="menuitem">
      <FilePlus2 size={12} class="shrink-0" />
      New File
    </button>
    <button class="ctx-item" onclick={() => { startInlineCreate(ctxDir, 'folder'); scriptsCtxVisible = false; uiStore.expandNode('_Scripts'); uiStore.expandNode(ctxNodeKey); }} role="menuitem">
      <FolderPlus size={12} class="shrink-0" />
      New Folder
    </button>
    {#if templates.length > 0}
      <div class="ctx-separator"></div>
      <span class="ctx-group-label">Templates</span>
      {#each templates as tmpl (tmpl.id)}
        <button class="ctx-item" onclick={() => { scriptsCtxVisible = false; createFromSectionTemplate(tmpl.id, scriptsCtxCategory); }} role="menuitem">
          <FileCode size={12} class="shrink-0" />
          {tmpl.label}
        </button>
      {/each}
    {/if}
    <div class="ctx-separator"></div>
    <button class="ctx-item" onclick={async () => { scriptsCtxVisible = false; await refreshModFiles(); }} role="menuitem">
      <RefreshCw size={12} class="shrink-0" />
      Refresh
    </button>
  </ContextMenu>
{/if}

<!-- File context menu -->
{#if fileCtxVisible && fileCtxNode}
  <ContextMenu x={fileCtxX} y={fileCtxY} header={fileCtxNode.name} onclose={hideContextMenu}>
    {#if isScriptFile(fileCtxNode.extension)}
      <button class="ctx-item" onclick={() => { const fullPath = `${modsFilePrefix}${fileCtxNode!.relPath}`; uiStore.openScriptTab(fullPath); hideContextMenu(); }} role="menuitem">
        <Pencil size={12} class="shrink-0" />
        {m.file_explorer_edit_script()}
      </button>
      <button class="ctx-item" onclick={async () => { if (fileCtxNode) { await deleteScriptFile(fileCtxNode); hideContextMenu(); } }} role="menuitem">
        <Trash2 size={12} class="shrink-0" />
        {m.file_explorer_delete_script()}
      </button>
    {/if}
    {#if fileCtxIsTopLevel && fileCtxSectionKey}
      {@const isPinned = uiStore.isNodePinned(`scripts:${fileCtxSectionKey}`, fileCtxNode.relPath)}
      <button class="ctx-item" onclick={() => {
        if (!fileCtxNode || !fileCtxSectionKey) return;
        const drawerId = `scripts:${fileCtxSectionKey}`;
        if (isPinned) uiStore.unpinNode(drawerId, fileCtxNode.relPath);
        else uiStore.pinNode(drawerId, fileCtxNode.relPath);
        hideContextMenu();
      }} role="menuitem">
        {#if isPinned}
          <PinOff size={12} class="shrink-0" />
          {m.explorer_context_menu_unpin()}
        {:else}
          <Pin size={12} class="shrink-0" />
          {m.explorer_context_menu_pin_to_top()}
        {/if}
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
      {@const folderSection = detectSectionFromPath(fileCtxNode!.relPath)}
      {@const folderTemplates = mergedTemplates[folderSection ?? 'lua-se'] ?? []}
      {#if folderTemplates.length > 0}
        <div class="ctx-separator"></div>
        <span class="ctx-group-label">Templates</span>
        {#each folderTemplates as tmpl (tmpl.id)}
          <button class="ctx-item" onclick={() => { const folderPath = fileCtxNode!.relPath; hideContextMenu(); createFromSectionTemplate(tmpl.id, folderSection, folderPath); }} role="menuitem">
            <FileCode size={12} class="shrink-0" />
            {tmpl.label}
          </button>
        {/each}
      {/if}
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
      {#if detectSectionFromPath(fileCtxNode!.relPath)}
        {@const fileSection = detectSectionFromPath(fileCtxNode!.relPath)}
        {@const fileTemplates = mergedTemplates[fileSection ?? 'lua-se'] ?? []}
        {#if fileTemplates.length > 0}
          <div class="ctx-separator"></div>
          <span class="ctx-group-label">Templates</span>
          {#each fileTemplates as tmpl (tmpl.id)}
            <button class="ctx-item" onclick={() => { const parentPath = fileCtxNode!.relPath.substring(0, fileCtxNode!.relPath.lastIndexOf('/')); hideContextMenu(); createFromSectionTemplate(tmpl.id, fileSection, parentPath); }} role="menuitem">
              <FileCode size={12} class="shrink-0" />
              {tmpl.label}
            </button>
          {/each}
        {/if}
      {/if}
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
  .scripts-content {
    padding: 0 4px;
  }

  /* Drag-to-reorder visual indicators */
  :global(.tree-node).drop-before {
    box-shadow: inset 0 2px 0 0 var(--th-accent-500, #3b82f6);
  }
  :global(.tree-node).drop-after {
    box-shadow: inset 0 -2px 0 0 var(--th-accent-500, #3b82f6);
  }
  :global(.tree-node).dragging {
    opacity: 0.4;
  }

  /* Pin indicator */
  :global(.pin-indicator) {
    color: var(--th-text-400);
    flex-shrink: 0;
    margin-right: -2px;
  }
</style>
