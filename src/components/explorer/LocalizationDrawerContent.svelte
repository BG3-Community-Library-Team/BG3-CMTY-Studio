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
  import { createDragReorderState, handleDragStart, handleDragOver, handleDrop, handleDragEnd, getPinContextMenuItems } from "./dragReorder.js";
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
  let modsFilePrefix = $derived(modFolder ? `Mods/${modFolder}/` : "");

  let isLocalizationExpanded = $derived(uiStore.expandedNodes["_Localization"] ?? false);

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
    const folder = modStore.scanResult?.mod_meta?.folder;
    if (!folder) return [];
    const prefix = `Mods/${folder}/`;
    const locaFiles = modStore.modFiles
      .filter(f => f.rel_path.startsWith(prefix + 'Localization/'))
      .map(f => ({ ...f, rel_path: f.rel_path.slice(prefix.length) }));
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

  let locaFilterMatchCount = $derived.by(() => {
    if (!explorerFilter.active || !explorerFilter.query) return 0;
    return countFileTreeMatches(localizationTree, explorerFilter.query, explorerFilter.fuzzy);
  });

  function locaFileFilterClass(name: string, children?: FileTreeNode[]): string {
    const q = explorerFilter.query;
    if (!explorerFilter.active || !q) return '';
    if (matchesFilter(name, q, explorerFilter.fuzzy).matched) return 'filter-match';
    if (children && filterSearchTree(children, q, explorerFilter.fuzzy).length > 0) return '';
    return explorerFilter.mode === 'filter' ? 'filter-hidden' : 'filter-dimmed';
  }

  // ── Drag-to-move state ──

  let dragState = createDragReorderState();

  function getNodeFolder(relPath: string): string {
    // relPath is like "Localization/English/foo.xml" or "Localization/bar.xml"
    const idx = relPath.lastIndexOf('/');
    return idx > 0 ? relPath.substring(0, idx) : 'Localization';
  }

  async function handleFileMoveToFolder(draggedRelPath: string, targetRelPath: string): Promise<void> {
    const modPath = modStore.selectedModPath;
    if (!modPath) return;

    const draggedName = draggedRelPath.substring(draggedRelPath.lastIndexOf('/') + 1);
    const targetFolder = getNodeFolder(targetRelPath);
    const newRelPath = `${targetFolder}/${draggedName}`;

    if (draggedRelPath === newRelPath) return;

    const srcFull = `${modsFilePrefix}${draggedRelPath}`;
    const destFull = `${modsFilePrefix}${newRelPath}`;

    // Check if file exists at destination
    const destAbsolute = `${modPath}/${destFull}`;
    const exists = await fileExists(destAbsolute);
    if (exists) {
      if (!confirm(`"${draggedName}" already exists in ${targetFolder}. Overwrite?`)) return;
    }

    try {
      await moveModFile(modPath, srcFull, destFull);
      // Update tab if the moved file was open
      const oldTabId = `script:${srcFull}`;
      if (uiStore.openTabs.some(t => t.id === oldTabId)) {
        uiStore.closeTab(oldTabId);
        uiStore.openScriptTab(destFull);
      }
      await refreshModFiles();
      toastStore.success("File moved", `${draggedName} → ${targetFolder}`);
    } catch (e) {
      toastStore.error("Move failed", String(e));
    }
  }

  async function handleFileMoveToRoot(draggedRelPath: string): Promise<void> {
    const modPath = modStore.selectedModPath;
    if (!modPath) return;

    const draggedName = draggedRelPath.substring(draggedRelPath.lastIndexOf('/') + 1);
    const newRelPath = `Localization/${draggedName}`;

    if (draggedRelPath === newRelPath) return;

    const srcFull = `${modsFilePrefix}${draggedRelPath}`;
    const destFull = `${modsFilePrefix}${newRelPath}`;

    const destAbsolute = `${modPath}/${destFull}`;
    const exists = await fileExists(destAbsolute);
    if (exists) {
      if (!confirm(`"${draggedName}" already exists in Localization root. Overwrite?`)) return;
    }

    try {
      await moveModFile(modPath, srcFull, destFull);
      const oldTabId = `script:${srcFull}`;
      if (uiStore.openTabs.some(t => t.id === oldTabId)) {
        uiStore.closeTab(oldTabId);
        uiStore.openScriptTab(destFull);
      }
      await refreshModFiles();
      toastStore.success("File moved", `${draggedName} → Localization/`);
    } catch (e) {
      toastStore.error("Move failed", String(e));
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
    const modPath = modStore.selectedModPath;
    if (!modPath) return;
    try { modStore.modFiles = await listModFiles(modPath); }
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
    const modPath = modStore.selectedModPath;
    if (!modPath) { isCommittingCreate = false; cancelInlineCreate(); return; }

    // Default .xml extension for loca files
    if (inlineCreateType === 'file' && !name.includes('.')) {
      name = name + '.xml';
    }

    if (pendingTemplateId && inlineCreateType === 'file') {
      const targetDir = `Mods/${modFolder}/${inlineCreateParent}`;
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
        await scriptCreateFromTemplate(modPath, relPath, pendingTemplateId, variables);
        await refreshModFiles();
        uiStore.openScriptTab(relPath);
        toastStore.success("Template created", name);
      } catch (e) {
        toastStore.error("Template creation failed", String(e));
      }
    } else if (inlineCreateType === 'file') {
      const relPath = `Mods/${modFolder}/${inlineCreateParent}/${name}`;
      try { await touchFile(modPath, relPath); await refreshModFiles(); uiStore.openScriptTab(relPath); }
      catch (e) { toastStore.error("Failed to create file", String(e)); }
    } else {
      const relPath = `Mods/${modFolder}/${inlineCreateParent}/${name}`;
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
    } catch (e) { toastStore.error("Rename failed", String(e)); }
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
  <!-- Header row (Localization label + open tab) -->
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
      {#if locaFilterMatchCount > 0}
        <span class="filter-match-count">{locaFilterMatchCount}</span>
      {/if}
    </button>
  </div>

  {#if isLocalizationExpanded}
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
              class:drag-over={dragState.dropTargetId === node.relPath && dragState.draggedId !== node.relPath}
              draggable="true"
              ondragstart={(e) => handleDragStart(e, node.relPath, nodeFolder, dragState)}
              ondragover={(e) => handleDragOver(e, node.relPath, nodeFolder, dragState, true)}
              ondrop={(e) => handleDrop(e, node.relPath, nodeFolder, dragState, onLocaReorder, onLocaCrossMove)}
              ondragend={() => handleDragEnd(dragState)}
              onclick={() => openFilePreview(node)}
              ondblclick={() => openFilePreview(node, false)}
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
            placeholder={inlineCreateType === 'folder' ? 'folder name' : 'filename.xml'}
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
        <span class="tree-node text-muted" style="padding-left: 28px; cursor: default; font-size: 11px; opacity: 0.5;">No localization files</span>
      {/if}
    </div>
  {/if}
</div>

<!-- Localization root context menu -->
{#if locaCtxVisible}
  <ContextMenu x={locaCtxX} y={locaCtxY} header="Localization" onclose={hideContextMenu}>
    <button class="ctx-item" onclick={() => { startInlineCreate('Localization', 'file'); locaCtxVisible = false; }} role="menuitem">
      <FilePlus2 size={12} class="shrink-0" />
      New File
    </button>
    <button class="ctx-item" onclick={() => { startInlineCreate('Localization', 'folder'); locaCtxVisible = false; }} role="menuitem">
      <FolderPlus size={12} class="shrink-0" />
      New Folder
    </button>
    <button class="ctx-item" onclick={() => { createLocalizationTemplate(); locaCtxVisible = false; }} role="menuitem">
      <FilePlus2 size={12} class="shrink-0" />
      New Contentlist XML
    </button>
    <div class="ctx-separator"></div>
    <button class="ctx-item" onclick={async () => { const modPath = modStore.selectedModPath; if (modPath && modFolder) { try { await revealPath(`${modPath}/Mods/${modFolder}/Localization`); } catch (e) { toastStore.error("Open failed", String(e)); } } locaCtxVisible = false; }} role="menuitem">
      <FolderOpen size={12} class="shrink-0" />
      Open in File Manager
    </button>
    <button class="ctx-item" onclick={async () => { locaCtxVisible = false; await refreshModFiles(); }} role="menuitem">
      <RefreshCw size={12} class="shrink-0" />
      Refresh
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
      Rename
    </button>
    <button
      class="ctx-item"
      onclick={async () => {
        if (!locaFileCtxNode) return;
        const fullPath = `${modsFilePrefix}${locaFileCtxNode.relPath}`;
        const modPath = modStore.selectedModPath;
        if (!modPath) return;
        try {
          await scriptDelete(modPath, fullPath);
          const tabId = `script:${fullPath}`;
          if (uiStore.openTabs.some(t => t.id === tabId)) uiStore.closeTab(tabId);
          await refreshModFiles();
          toastStore.success("File deleted", locaFileCtxNode.name);
        } catch (e) { toastStore.error("Delete failed", String(e)); }
        locaFileCtxVisible = false;
      }}
      role="menuitem"
    >
      <Trash2 size={12} class="shrink-0" />
      Delete
    </button>
    <div class="ctx-separator"></div>
    <button class="ctx-item" onclick={async () => { const modPath = modStore.selectedModPath; if (modPath && locaFileCtxNode) { try { await revealPath(`${modPath}/${modsFilePrefix}${locaFileCtxNode.relPath}`); } catch (e) { toastStore.error("Open failed", String(e)); } } locaFileCtxVisible = false; }} role="menuitem">
      <FolderOpen size={12} class="shrink-0" />
      Open in File Manager
    </button>
    <button class="ctx-item" onclick={async () => { if (locaFileCtxNode) { await navigator.clipboard.writeText(`${modsFilePrefix}${locaFileCtxNode.relPath}`); toastStore.success("Copied", "Relative path copied to clipboard"); } locaFileCtxVisible = false; }} role="menuitem">
      <Copy size={12} class="shrink-0" />
      Copy Path
    </button>
  </ContextMenu>
{/if}

<style>
  .loca-content {
    padding: 0 4px;
  }
  .loca-content :global(.drag-over) {
    outline: 1px dashed var(--th-accent-500);
    outline-offset: -1px;
    background: color-mix(in srgb, var(--th-accent-500) 10%, transparent);
  }
</style>
