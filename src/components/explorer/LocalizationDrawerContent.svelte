<script lang="ts">
  import { modStore } from "../../lib/stores/modStore.svelte.js";
  import { uiStore } from "../../lib/stores/uiStore.svelte.js";
  import { toastStore } from "../../lib/stores/toastStore.svelte.js";
  import { revealPath, listModFiles } from "../../lib/utils/tauri.js";
  import { scriptDelete, moveModFile, touchFile, createModDirectory, scriptRename, scriptCreateFromTemplate } from "../../lib/tauri/scripts.js";
  import { m } from "../../paraglide/messages.js";
  import {
    type FileTreeNode,
    buildFileTree,
    filterTree,
    isScriptFile,
    getComputedZoom,
    EXT_BADGE_COLORS,
    EXT_BADGE_FALLBACK,
    LOCA_EXTENSIONS,
    explorerFilter,
    matchesFilter,
    filterSearchTree,
    countFileTreeMatches,
  } from "./explorerShared.js";
  import { fileExists } from "../../lib/tauri/mod-management.js";
  import { createDragReorderState, handleDragStart, handleDragOver, handleDrop, handleDragEnd, getPinContextMenuItems, keyboardReorder } from "./dragReorder.js";
  import ContextMenu from "../ContextMenu.svelte";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import File from "@lucide/svelte/icons/file";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import Folder from "@lucide/svelte/icons/folder";
  import FilePlus2 from "@lucide/svelte/icons/file-plus-2";
  import FolderPlus from "@lucide/svelte/icons/folder-plus";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Copy from "@lucide/svelte/icons/copy";
  import Languages from "@lucide/svelte/icons/languages";

  let scanResult = $derived(modStore.scanResult);
  let modFolder = $derived(scanResult?.mod_meta?.folder ?? "");
  let modsFilePrefix = $derived(modStore.modFilesPrefix);

  let activeNodeKey = $derived.by(() => {
    const tab = uiStore.activeTab;
    if (!tab) return "";
    if (tab.type === "localization") return "localization-root";
    if (tab.type === "file-preview") return `file:${tab.filePath ?? ""}`;
    if (tab.type === "script-editor") return `file:${tab.filePath ?? ""}`;
    return "";
  });

  function isActiveFile(relPath: string): boolean {
    return activeNodeKey === `file:${modsFilePrefix}${relPath}`;
  }

  // ── Localization tree ──

  let localizationTree = $derived.by((): FileTreeNode[] => {
    if (!modsFilePrefix) return [];
    const locaFiles = modStore.modFiles
      .filter(f => f.rel_path.startsWith(modsFilePrefix + 'Localization/'))
      .map(f => ({ ...f, rel_path: f.rel_path.slice(modsFilePrefix.length) }));
    if (locaFiles.length === 0) return [];
    const tree = buildFileTree(locaFiles);
    const locaDir = tree.find(n => !n.isFile && n.name === 'Localization');
    if (!locaDir?.children) return [];
    return filterTree(locaDir.children, LOCA_EXTENSIONS);
  });

  // ── Ordered tree (pin-to-top) ──

  let orderedLocalizationTree = $derived.by((): FileTreeNode[] => {
    if (localizationTree.length === 0) return [];
    const defaultIds = localizationTree.map(n => n.relPath);
    const ordered = uiStore.getOrderedNodes("localization", defaultIds);
    const byPath = new Map(localizationTree.map(n => [n.relPath, n]));
    return ordered.map(id => byPath.get(id)).filter((n): n is FileTreeNode => !!n);
  });

  let filteredLocalizationTree = $derived.by(() => {
    if (!explorerFilter.active || !explorerFilter.query || explorerFilter.mode !== 'filter') return orderedLocalizationTree;
    return filterSearchTree(orderedLocalizationTree, explorerFilter.query, explorerFilter.fuzzy);
  });

  function locaFileFilterClass(name: string, children?: FileTreeNode[]): string {
    const q = explorerFilter.query;
    if (!explorerFilter.active || !q) return '';
    if (matchesFilter(name, q, explorerFilter.fuzzy).matched) return 'filter-match';
    if (children && filterSearchTree(children, q, explorerFilter.fuzzy).length > 0) return '';
    return explorerFilter.mode === 'filter' ? 'filter-hidden' : 'filter-dimmed';
  }

  // ── Drag-to-move state ──

  let dragState = $state(createDragReorderState());

  function getNodeFolder(relPath: string): string {
    // relPath is like "Localization/English/foo.xml" or "Localization/bar.xml"
    const idx = relPath.lastIndexOf('/');
    return idx > 0 ? relPath.substring(0, idx) : 'Localization';
  }

  async function handleFileMoveToFolder(draggedRelPath: string, targetRelPath: string): Promise<void> {
    const basePath = modStore.projectPath || modStore.selectedModPath;
    if (!basePath) return;

    const draggedName = draggedRelPath.substring(draggedRelPath.lastIndexOf('/') + 1);
    const targetFolder = getNodeFolder(targetRelPath);
    const newRelPath = `${targetFolder}/${draggedName}`;

    if (draggedRelPath === newRelPath) return;

    const srcFull = `${modsFilePrefix}${draggedRelPath}`;
    const destFull = `${modsFilePrefix}${newRelPath}`;

    // Check if file exists at destination
    const destAbsolute = `${basePath}/${destFull}`;
    const exists = await fileExists(destAbsolute);
    if (exists) {
      if (!confirm(m.explorer_confirm_overwrite({ name: draggedName, folder: targetFolder }))) return;
    }

    try {
      await moveModFile(basePath, srcFull, destFull);
      // Update tab if the moved file was open
      const oldTabId = `script:${srcFull}`;
      if (uiStore.openTabs.some(t => t.id === oldTabId)) {
        uiStore.closeTab(oldTabId);
        uiStore.openScriptTab(destFull);
      }
      await refreshModFiles();
      toastStore.success(m.explorer_file_moved(), m.explorer_file_moved_desc({ name: draggedName, folder: targetFolder }));
    } catch (e) {
      toastStore.error(m.explorer_move_failed(), String(e));
    }
  }

  async function handleFileMoveToRoot(draggedRelPath: string): Promise<void> {
    const basePath = modStore.projectPath || modStore.selectedModPath;
    if (!basePath) return;

    const draggedName = draggedRelPath.substring(draggedRelPath.lastIndexOf('/') + 1);
    const newRelPath = `Localization/${draggedName}`;

    if (draggedRelPath === newRelPath) return;

    const srcFull = `${modsFilePrefix}${draggedRelPath}`;
    const destFull = `${modsFilePrefix}${newRelPath}`;

    const destAbsolute = `${basePath}/${destFull}`;
    const exists = await fileExists(destAbsolute);
    if (exists) {
      if (!confirm(m.explorer_confirm_overwrite({ name: draggedName, folder: "Localization" }))) return;
    }

    try {
      await moveModFile(basePath, srcFull, destFull);
      const oldTabId = `script:${srcFull}`;
      if (uiStore.openTabs.some(t => t.id === oldTabId)) {
        uiStore.closeTab(oldTabId);
        uiStore.openScriptTab(destFull);
      }
      await refreshModFiles();
      toastStore.success(m.explorer_file_moved(), m.explorer_file_moved_desc({ name: draggedName, folder: "Localization/" }));
    } catch (e) {
      toastStore.error(m.explorer_move_failed(), String(e));
    }
  }

  function onLocaReorder(draggedId: string, targetId: string, position: "before" | "after"): void {
    uiStore.reorderNode("localization", draggedId, targetId, position);
  }

  function onLocaCrossMove(draggedId: string, targetId: string): void {
    // draggedId is a file relPath, targetId is where it was dropped
    // Find the target node to determine the destination folder
    handleFileMoveToFolder(draggedId, targetId);
  }

  // ── Keyboard reorder + announcements ──

  let announceMessage = $state("");

  function announce(msg: string): void {
    announceMessage = "";
    requestAnimationFrame(() => { announceMessage = msg; });
  }

  function handleLocaNodeKeydown(e: KeyboardEvent, node: FileTreeNode): void {
    if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    e.preventDefault();
    e.stopPropagation();
    const direction = e.key === "ArrowUp" ? "up" : "down";
    const currentIdx = orderedLocalizationTree.findIndex(n => n.relPath === node.relPath);
    if (currentIdx < 0) return;
    const targetIdx = direction === "up" ? currentIdx - 1 : currentIdx + 1;
    if (targetIdx < 0 || targetIdx >= orderedLocalizationTree.length) return;
    const targetNode = orderedLocalizationTree[targetIdx];
    const position = direction === "up" ? "before" : "after";
    onLocaReorder(node.relPath, targetNode.relPath, position);
    announce(m.explorer_reorder_announce({ name: node.name, position: String(targetIdx + 1) }));
    requestAnimationFrame(() => {
      const container = document.querySelector('.loca-content');
      const nodes = container?.querySelectorAll<HTMLElement>('.tree-node.has-files, .tree-node[draggable="true"]');
      nodes?.[targetIdx]?.focus();
    });
  }

  // ── Context menus ──

  let locaCtxVisible = $state(false);
  let locaCtxX = $state(0);
  let locaCtxY = $state(0);

  let locaFileCtxVisible = $state(false);
  let locaFileCtxX = $state(0);
  let locaFileCtxY = $state(0);
  let locaFileCtxNode: FileTreeNode | null = $state(null);

  function hideContextMenu() {
    locaCtxVisible = false;
    locaFileCtxVisible = false;
    locaFileCtxNode = null;
  }

  async function refreshModFiles(): Promise<void> {
    const basePath = modStore.projectPath || modStore.selectedModPath;
    if (!basePath) return;
    try { modStore.modFiles = await listModFiles(basePath); }
    catch (err) { console.warn("Failed to refresh mod files:", err); }
  }

  // ── Inline create ──

  let inlineCreateParent: string | null = $state(null);
  let inlineCreateType: 'file' | 'folder' | null = $state(null);
  let inlineCreateName = $state("");
  let inlineCreateInput: HTMLInputElement | null = $state(null);
  let pendingTemplateId: string | null = $state(null);
  let isCommittingCreate = false;

  function startInlineCreate(parentRelPath: string, type: 'file' | 'folder') {
    cancelInlineRename();
    inlineCreateParent = parentRelPath;
    inlineCreateType = type;
    inlineCreateName = '';
    pendingTemplateId = null;
    uiStore.expandNode('_Localization');
    requestAnimationFrame(() => { requestAnimationFrame(() => { inlineCreateInput?.focus(); }); });
  }

  function cancelInlineCreate() {
    inlineCreateParent = null;
    inlineCreateType = null;
    inlineCreateName = '';
    pendingTemplateId = null;
  }

  function createLocalizationTemplate(): void {
    cancelInlineRename();
    inlineCreateParent = 'Localization';
    inlineCreateType = 'file';
    inlineCreateName = '';
    pendingTemplateId = 'localization_contentlist';
    uiStore.expandNode('_Localization');
    requestAnimationFrame(() => { requestAnimationFrame(() => { inlineCreateInput?.focus(); }); });
  }

  async function commitInlineCreate() {
    if (isCommittingCreate) return;
    if (!inlineCreateName.trim() || !inlineCreateParent || !inlineCreateType) { cancelInlineCreate(); return; }
    isCommittingCreate = true;
    let name = inlineCreateName.trim();
    const basePath = modStore.projectPath || modStore.selectedModPath;
    if (!basePath) { isCommittingCreate = false; cancelInlineCreate(); return; }

    // Default .xml extension for loca files
    if (inlineCreateType === 'file' && !name.includes('.')) {
      name = name + '.xml';
    }

    if (pendingTemplateId && inlineCreateType === 'file') {
      const targetDir = `${modsFilePrefix}${inlineCreateParent}`;
      const relPath = `${targetDir}/${name}`;
      const variables: Record<string, string> = {
        FILE_NAME: name,
        MOD_NAME: modFolder,
        MOD_TABLE: modFolder.replace(/[^a-zA-Z0-9_]/g, '_'),
      };
      if (pendingTemplateId === 'localization_contentlist') {
        const now = new Date();
        variables.DATE = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        variables.CONTENT_UID = `h${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`;
        variables.VERSION = '1';
      }
      try {
        await scriptCreateFromTemplate(basePath, relPath, pendingTemplateId, variables);
        await refreshModFiles();
        uiStore.openScriptTab(relPath);
        toastStore.success(m.explorer_template_created(), name);
      } catch (e) {
        toastStore.error(m.explorer_template_creation_failed(), String(e));
      }
    } else if (inlineCreateType === 'file') {
      const relPath = `${modsFilePrefix}${inlineCreateParent}/${name}`;
      try { await touchFile(basePath, relPath); await refreshModFiles(); uiStore.openScriptTab(relPath); }
      catch (e) { toastStore.error(m.explorer_create_file_failed(), String(e)); }
    } else {
      const relPath = `${modsFilePrefix}${inlineCreateParent}/${name}`;
      try { await createModDirectory(basePath, relPath); await refreshModFiles(); }
      catch (e) { toastStore.error(m.explorer_create_folder_failed(), String(e)); }
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
      await refreshModFiles();
      toastStore.success(m.file_explorer_renamed(), `${node.name} → ${newName}`);
    } catch (e) { toastStore.error(m.explorer_rename_failed(), String(e)); }
    isCommittingRename = false;
    cancelInlineRename();
  }

  // ── File open ──

  function openFilePreview(fileNode: FileTreeNode, preview = true): void {
    const fullRelPath = `${modsFilePrefix}${fileNode.relPath}`;
    if (fileNode.extension === "xml" && fileNode.relPath.startsWith("Localization/")) {
      uiStore.openScriptTab(fullRelPath);
      return;
    }
    if (isScriptFile(fileNode.extension)) { uiStore.openScriptTab(fullRelPath); return; }
    uiStore.openTab({ id: `file:${fullRelPath}`, label: fileNode.name, type: "file-preview", filePath: fullRelPath, icon: "📄", preview });
  }
</script>

<div class="loca-content" onclick={hideContextMenu} role="none">
    <div
      class="tree-children"
      role="group"
      ondragover={(e) => {
        if (!dragState.draggedId) return;
        // Allow dropping files to localization root
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      }}
      ondrop={(e) => {
        e.preventDefault();
        const draggedId = dragState.draggedId;
        if (draggedId) {
          handleFileMoveToRoot(draggedId);
        }
        handleDragEnd(dragState);
      }}>
      {#snippet locaNode(node: FileTreeNode)}
        {@const lFCls = locaFileFilterClass(node.name, node.children)}
        {#if node.isFile}
          {#if inlineRenameNode?.relPath === node.relPath}
            <div class="tree-node inline-create has-files">
              <span class="w-3.5 shrink-0"></span>
              <File size={14} class="text-[var(--th-text-amber-400)]" />
              <input
                bind:this={inlineRenameInput}
                bind:value={inlineRenameName}
                class="inline-create-input"
                onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitInlineRename(); } if (e.key === 'Escape') { e.preventDefault(); cancelInlineRename(); } }}
                onblur={() => { if (inlineRenameName.trim()) commitInlineRename(); else cancelInlineRename(); }}
              />
            </div>
          {:else}
            {@const nodeFolder = getNodeFolder(node.relPath)}
            <button
              class="tree-node has-files {lFCls}"
              class:active-node={isActiveFile(node.relPath)}
              class:drop-before={dragState.dropTargetId === node.relPath && dragState.dropPosition === "before" && dragState.draggedId !== node.relPath}
              class:drop-after={dragState.dropTargetId === node.relPath && dragState.dropPosition === "after" && dragState.draggedId !== node.relPath}
              draggable="true"
              ondragstart={(e) => handleDragStart(e, node.relPath, nodeFolder, dragState)}
              ondragover={(e) => handleDragOver(e, node.relPath, nodeFolder, dragState, true)}
              ondrop={(e) => handleDrop(e, node.relPath, nodeFolder, dragState, onLocaReorder, onLocaCrossMove)}
              ondragend={() => handleDragEnd(dragState)}
              onclick={() => openFilePreview(node)}
              ondblclick={() => openFilePreview(node, false)}
              onkeydown={(e) => handleLocaNodeKeydown(e, node)}
              oncontextmenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const zoom = getComputedZoom(e.currentTarget as HTMLElement);
                locaFileCtxX = e.clientX / zoom;
                locaFileCtxY = e.clientY / zoom;
                locaFileCtxNode = node;
                locaFileCtxVisible = true;
              }}
            >
              <span class="w-3.5 shrink-0"></span>
              <File size={14} class="text-[var(--th-text-amber-400)]" />
              <span class="node-label truncate">{node.name}</span>
              {#if node.extension}
                <span class="ext-badge" style="background: {EXT_BADGE_COLORS[node.extension] ?? EXT_BADGE_FALLBACK}">.{node.extension}</span>
              {/if}
            </button>
          {/if}
        {:else}
          {@const expanded = uiStore.expandedNodes[`loca:${node.relPath}`] ?? false}
          {#if inlineRenameNode?.relPath === node.relPath}
            <div class="tree-node inline-create has-files">
              <ChevronRight size={14} class="chevron {expanded ? 'expanded' : ''}" />
              <Folder size={14} class="text-[var(--th-text-amber-400)]" />
              <input
                bind:this={inlineRenameInput}
                bind:value={inlineRenameName}
                class="inline-create-input"
                onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitInlineRename(); } if (e.key === 'Escape') { e.preventDefault(); cancelInlineRename(); } }}
                onblur={() => { if (inlineRenameName.trim()) commitInlineRename(); else cancelInlineRename(); }}
              />
            </div>
          {:else}
            <button
              class="tree-node has-files {lFCls}"
              class:drag-over={dragState.dropTargetId === node.relPath && dragState.draggedId !== node.relPath}
              ondragover={(e) => {
                if (!dragState.draggedId) return;
                // Only accept file drops onto folders
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
                dragState.dropTargetId = node.relPath;
                dragState.dropPosition = "inside";
              }}
              ondrop={(e) => {
                e.preventDefault();
                const draggedId = dragState.draggedId;
                if (draggedId) {
                  handleFileMoveToFolder(draggedId, `${node.relPath}/`);
                }
                handleDragEnd(dragState);
              }}
              ondragleave={() => {
                if (dragState.dropTargetId === node.relPath) {
                  dragState.dropTargetId = null;
                  dragState.dropPosition = null;
                }
              }}
              onclick={() => uiStore.toggleNode(`loca:${node.relPath}`)}
              oncontextmenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const zoom = getComputedZoom(e.currentTarget as HTMLElement);
                locaFileCtxX = e.clientX / zoom;
                locaFileCtxY = e.clientY / zoom;
                locaFileCtxNode = node;
                locaFileCtxVisible = true;
              }}
            >
              <ChevronRight size={14} class="chevron {expanded ? 'expanded' : ''}" />
              {#if expanded}
                <FolderOpen size={14} class="text-[var(--th-text-amber-400)]" />
              {:else}
                <Folder size={14} class="text-[var(--th-text-amber-400)]" />
              {/if}
              <span class="node-label truncate">{node.name}</span>
            </button>
          {/if}
          {#if expanded && node.children}
            <div class="tree-children">
              {#each node.children as child (child.relPath)}
                {@render locaNode(child)}
              {/each}
            </div>
          {/if}
        {/if}
      {/snippet}

      {#if inlineCreateParent === 'Localization'}
        <div class="tree-node inline-create">
          <span class="w-3.5 shrink-0"></span>
          {#if inlineCreateType === 'folder'}
            <Folder size={14} class="text-[var(--th-text-amber-400)]" />
          {:else}
            <File size={14} class="text-[var(--th-text-amber-400)]" />
          {/if}
          <input
            bind:this={inlineCreateInput}
            bind:value={inlineCreateName}
            class="inline-create-input"
            placeholder={inlineCreateType === 'folder' ? m.explorer_placeholder_folder_name() : m.explorer_placeholder_filename({ ext: '.xml' })}
            onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitInlineCreate(); } if (e.key === 'Escape') { e.preventDefault(); cancelInlineCreate(); } }}
            onblur={() => { if (inlineCreateName.trim()) commitInlineCreate(); else cancelInlineCreate(); }}
          />
        </div>
      {/if}
      {#if filteredLocalizationTree.length > 0}
        {#each filteredLocalizationTree as treeNode (treeNode.relPath)}
          {@render locaNode(treeNode)}
        {/each}
      {:else if inlineCreateParent !== 'Localization'}
        <span class="tree-node text-muted" style="padding-left: 28px; cursor: default; font-size: 11px; opacity: 0.5;">{m.explorer_no_localization_files()}</span>
      {/if}
    </div>
</div>

<!-- Localization root context menu -->
{#if locaCtxVisible}
  <ContextMenu x={locaCtxX} y={locaCtxY} header="Localization" onclose={hideContextMenu}>
    <button class="ctx-item" onclick={() => { startInlineCreate('Localization', 'file'); locaCtxVisible = false; }} role="menuitem">
      <FilePlus2 size={12} class="shrink-0" />
      {m.explorer_new_file()}
    </button>
    <button class="ctx-item" onclick={() => { startInlineCreate('Localization', 'folder'); locaCtxVisible = false; }} role="menuitem">
      <FolderPlus size={12} class="shrink-0" />
      {m.explorer_new_folder()}
    </button>
    <button class="ctx-item" onclick={() => { createLocalizationTemplate(); locaCtxVisible = false; }} role="menuitem">
      <FilePlus2 size={12} class="shrink-0" />
      {m.explorer_new_contentlist_xml()}
    </button>
    <div class="ctx-separator"></div>
    <button class="ctx-item" onclick={async () => { const basePath = modStore.projectPath || modStore.selectedModPath; if (basePath && modsFilePrefix) { try { await revealPath(`${basePath}/${modsFilePrefix}Localization`); } catch (e) { toastStore.error(m.explorer_open_failed(), String(e)); } } locaCtxVisible = false; }} role="menuitem">
      <FolderOpen size={12} class="shrink-0" />
      {m.file_explorer_open_in_file_manager()}
    </button>
    <button class="ctx-item" onclick={async () => { locaCtxVisible = false; await refreshModFiles(); }} role="menuitem">
      <RefreshCw size={12} class="shrink-0" />
      {m.explorer_refresh()}
    </button>
  </ContextMenu>
{/if}

<!-- Localization file context menu -->
{#if locaFileCtxVisible && locaFileCtxNode}
  {@const ctxNodeIsRoot = !locaFileCtxNode.relPath.includes('/') || locaFileCtxNode.relPath.split('/').length <= 2}
  {@const ctxNodePinId = locaFileCtxNode.relPath}
  {@const ctxNodeIsPinned = uiStore.isNodePinned("localization", ctxNodePinId)}
  <ContextMenu x={locaFileCtxX} y={locaFileCtxY} header={locaFileCtxNode.name} onclose={hideContextMenu}>
    {#if ctxNodeIsRoot}
      {#each getPinContextMenuItems("localization", ctxNodePinId, ctxNodeIsPinned) as pinItem}
        <button class="ctx-item" onclick={() => { pinItem.action?.(); locaFileCtxVisible = false; }} role="menuitem">
          {#if pinItem.icon}
            {@const PinIcon = pinItem.icon}
            <PinIcon size={12} class="shrink-0" />
          {/if}
          {pinItem.label}
        </button>
      {/each}
      <div class="ctx-separator"></div>
    {/if}
    <button class="ctx-item" onclick={() => { if (!locaFileCtxNode) return; const node = locaFileCtxNode; locaFileCtxVisible = false; startInlineRename(node); }} role="menuitem">
      <Pencil size={12} class="shrink-0" />
      {m.file_explorer_rename()}
    </button>
    <button
      class="ctx-item"
      onclick={async () => {
        if (!locaFileCtxNode) return;
        const node = locaFileCtxNode;
        const fullPath = `${modsFilePrefix}${node.relPath}`;
        const basePath = modStore.projectPath || modStore.selectedModPath;
        if (!basePath) return;

        // Capture focus target before deletion
        const idx = orderedLocalizationTree.findIndex(n => n.relPath === node.relPath);
        const container = document.querySelector('.loca-content');
        const siblings = container?.querySelectorAll<HTMLElement>('.tree-node.has-files');
        let focusTarget: HTMLElement | null = null;
        if (siblings && idx >= 0) {
          if (idx < siblings.length - 1) focusTarget = siblings[idx + 1] as HTMLElement;
          else if (idx > 0) focusTarget = siblings[idx - 1] as HTMLElement;
        }

        try {
          await scriptDelete(basePath, fullPath);
          const tabId = `script:${fullPath}`;
          if (uiStore.openTabs.some(t => t.id === tabId)) uiStore.closeTab(tabId);
          await refreshModFiles();
          announce(m.explorer_delete_announce({ name: node.name }));
          toastStore.success(m.explorer_file_deleted(), node.name);
          if (focusTarget) requestAnimationFrame(() => focusTarget.focus());
        } catch (e) { toastStore.error(m.explorer_delete_failed(), String(e)); }
        locaFileCtxVisible = false;
      }}
      role="menuitem"
    >
      <Trash2 size={12} class="shrink-0" />
      {m.file_explorer_delete()}
    </button>
    <div class="ctx-separator"></div>
    <button class="ctx-item" onclick={async () => { const basePath = modStore.projectPath || modStore.selectedModPath; if (basePath && locaFileCtxNode) { try { await revealPath(`${basePath}/${modsFilePrefix}${locaFileCtxNode.relPath}`); } catch (e) { toastStore.error(m.explorer_open_failed(), String(e)); } } locaFileCtxVisible = false; }} role="menuitem">
      <FolderOpen size={12} class="shrink-0" />
      {m.file_explorer_open_in_file_manager()}
    </button>
    <button class="ctx-item" onclick={async () => { if (locaFileCtxNode) { await navigator.clipboard.writeText(`${modsFilePrefix}${locaFileCtxNode.relPath}`); toastStore.success(m.explorer_copied(), m.explorer_relative_path_copied()); } locaFileCtxVisible = false; }} role="menuitem">
      <Copy size={12} class="shrink-0" />
      {m.file_explorer_copy_path()}
    </button>
  </ContextMenu>
{/if}

<div class="sr-only" aria-live="polite" aria-atomic="true">
  {announceMessage}
</div>

<style>
  .loca-content {
    padding: 0 4px;
  }
  .loca-content :global(.drop-before) {
    box-shadow: inset 0 2px 0 0 var(--th-accent-500);
  }
  .loca-content :global(.drop-after) {
    box-shadow: inset 0 -2px 0 0 var(--th-accent-500);
  }
</style>
