<script lang="ts">
  import { uiStore } from "../../lib/stores/uiStore.svelte.js";
  import { modStore } from "../../lib/stores/modStore.svelte.js";
  import { toastStore } from "../../lib/stores/toastStore.svelte.js";
  import { revealPath } from "../../lib/utils/tauri.js";
  import { m } from "../../paraglide/messages.js";
  import {
    type FileTreeNode,
    isScriptFile,
    getOsirisBadge,
    getSeContextBadge,
    getComputedZoom,
    detectSectionFromPath,
    sectionCategoryToDir,
    EXT_BADGE_COLORS,
    EXT_BADGE_FALLBACK,
    SCRIPT_CATEGORIES,
    SECTION_DEFAULT_EXT,
    TEMPLATE_EXT,
    explorerFilter,
    matchesFilter,
    filterSearchTree,
    countFileTreeMatches,
  } from "./explorerShared.js";
  import { handleDragStart, handleDragOver, handleDrop, handleDragEnd } from "./dragReorder.js";
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

  interface InlineCreateState {
    parent: string | null;
    type: 'file' | 'folder' | null;
    name: string;
    pendingTemplateId: string | null;
    pendingTemplateCategory: string | null;
  }

  interface InlineRenameState {
    node: FileTreeNode | null;
    name: string;
  }

  type TemplateEntry = { id: string; label: string; sourcePath?: string; extension?: string };

  let {
    scriptCounts,
    getTreeData,
    getFilteredTreeData,
    getOrderedTree,
    getFilterMatchCount,
    getDragState,
    isActiveFile,
    modsFilePrefix,
    inlineCreate,
    inlineRename,
    mergedTemplates,
    onCommitCreate,
    onCommitRename,
    onDelete,
    onPaste,
    onScaffold,
    onRefresh,
    onReorder,
    onMove,
  }: {
    scriptCounts: Map<string, number>;
    getTreeData: (key: string) => FileTreeNode[];
    getFilteredTreeData: (key: string) => FileTreeNode[];
    getOrderedTree: (key: string, nodes: FileTreeNode[]) => FileTreeNode[];
    getFilterMatchCount: (key: string) => number;
    getDragState: (key: string) => DragReorderState;
    isActiveFile: (relPath: string) => boolean;
    modsFilePrefix: string;
    inlineCreate: InlineCreateState;
    inlineRename: InlineRenameState;
    mergedTemplates: Record<string, TemplateEntry[]>;
    onCommitCreate: () => Promise<void>;
    onCommitRename: () => Promise<void>;
    onDelete: (node: FileTreeNode, sectionKey?: string) => Promise<boolean>;
    onPaste: (clipNode: FileTreeNode, op: 'cut' | 'copy', target: FileTreeNode) => Promise<boolean>;
    onScaffold: (catKey: string) => Promise<void>;
    onRefresh: () => Promise<void>;
    onReorder: (sectionKey: string, draggedId: string, targetId: string, position: "before" | "after") => void;
    onMove: (sectionKey: string, draggedRelPath: string, targetRelPath: string) => void;
  } = $props();

  // ── Internal state ──

  let hoveredNode: string | null = $state(null);
  let announceMessage = $state("");
  let createInput: HTMLInputElement | null = $state(null);
  let renameInput: HTMLInputElement | null = $state(null);

  // Clipboard (local to tree)
  let clipboardNode: FileTreeNode | null = $state(null);
  let clipboardOp: 'cut' | 'copy' | null = $state(null);

  // Scripts context menu
  let scriptsCtxVisible = $state(false);
  let scriptsCtxX = $state(0);
  let scriptsCtxY = $state(0);
  let scriptsCtxCategory: string | null = $state(null);

  // File context menu
  let fileCtxVisible = $state(false);
  let fileCtxX = $state(0);
  let fileCtxY = $state(0);
  let fileCtxNode: FileTreeNode | null = $state(null);
  let fileCtxSectionKey: string | null = $state(null);
  let fileCtxIsTopLevel = $state(false);

  // ── Inline create ──

  function startInlineCreate(parentRelPath: string, type: 'file' | 'folder') {
    cancelInlineRename();
    inlineCreate.parent = parentRelPath;
    inlineCreate.type = type;
    inlineCreate.name = '';
    inlineCreate.pendingTemplateId = null;
    inlineCreate.pendingTemplateCategory = null;
    uiStore.expandedNodes[`script:${parentRelPath}`] = true;
    requestAnimationFrame(() => { requestAnimationFrame(() => { createInput?.focus(); }); });
  }

  function startInlineCreateFromTemplate(parentRelPath: string, templateId: string, category: string | null) {
    cancelInlineRename();
    inlineCreate.parent = parentRelPath;
    inlineCreate.type = 'file';
    inlineCreate.name = '';
    inlineCreate.pendingTemplateId = templateId;
    inlineCreate.pendingTemplateCategory = category;
    uiStore.expandedNodes[`script:${parentRelPath}`] = true;
    const parts = parentRelPath.split('/');
    for (let i = 1; i < parts.length; i++) {
      uiStore.expandedNodes[`script:${parts.slice(0, i).join('/')}`] = true;
    }
    requestAnimationFrame(() => { requestAnimationFrame(() => { createInput?.focus(); }); });
  }

  function cancelInlineCreate() {
    inlineCreate.parent = null;
    inlineCreate.type = null;
    inlineCreate.name = '';
    inlineCreate.pendingTemplateId = null;
    inlineCreate.pendingTemplateCategory = null;
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

  // ── Inline rename ──

  function startInlineRename(node: FileTreeNode) {
    cancelInlineCreate();
    inlineRename.node = node;
    inlineRename.name = node.name;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (renameInput) {
          renameInput.focus();
          const dotIdx = node.isFile ? node.name.lastIndexOf('.') : -1;
          if (dotIdx > 0) renameInput.setSelectionRange(0, dotIdx);
          else renameInput.select();
        }
      });
    });
  }

  function cancelInlineRename() {
    inlineRename.node = null;
    inlineRename.name = '';
  }

  // ── Context menus ──

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

  // ── Clipboard paste ──

  async function pasteClipboard(targetNode: FileTreeNode) {
    if (!clipboardNode || !clipboardOp) return;
    const cleared = await onPaste(clipboardNode, clipboardOp, targetNode);
    if (cleared && clipboardOp === 'cut') {
      clipboardNode = null;
      clipboardOp = null;
    }
  }

  // ── Helpers ──

  function announce(msg: string): void {
    announceMessage = "";
    requestAnimationFrame(() => { announceMessage = msg; });
  }

  function scriptFileFilterClass(name: string, children?: FileTreeNode[]): string {
    const q = explorerFilter.query;
    if (!explorerFilter.active || !q) return '';
    if (matchesFilter(name, q, explorerFilter.fuzzy).matched) return 'filter-match';
    if (children && filterSearchTree(children, q, explorerFilter.fuzzy).length > 0) return '';
    return explorerFilter.mode === 'filter' ? 'filter-hidden' : 'filter-dimmed';
  }

  function openFilePreview(fileNode: FileTreeNode, preview = true): void {
    const fullRelPath = `${modsFilePrefix}${fileNode.relPath}`;
    if (isScriptFile(fileNode.extension)) { uiStore.openScriptTab(fullRelPath); return; }
    if (fileNode.extension === "txt" && fileNode.relPath.includes("Story/RawFiles/Goals/")) { uiStore.openScriptTab(fullRelPath); return; }
    uiStore.openTab({ id: `file:${fullRelPath}`, label: fileNode.name, type: "file-preview", filePath: fullRelPath, icon: "📄", preview });
  }

  // ── Keyboard reorder ──

  function handleScriptNodeKeydown(e: KeyboardEvent, node: FileTreeNode, sectionKey: string): void {
    if (e.key === "Delete") { onDelete(node, sectionKey).then(ok => { if (ok) announce(m.explorer_delete_announce({ name: node.name })); }); return; }
    if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    if (!node.isFile) return;
    e.preventDefault();
    e.stopPropagation();
    const direction = e.key === "ArrowUp" ? "up" : "down";
    const orderedData = getOrderedTree(sectionKey, getTreeData(sectionKey));
    const currentIdx = orderedData.findIndex(n => n.relPath === node.relPath);
    if (currentIdx < 0) return;
    const targetIdx = direction === "up" ? currentIdx - 1 : currentIdx + 1;
    if (targetIdx < 0 || targetIdx >= orderedData.length) return;
    const targetNode = orderedData[targetIdx];
    const position = direction === "up" ? "before" : "after";
    onReorder(sectionKey, node.relPath, targetNode.relPath, position);
    announce(m.explorer_reorder_announce({ name: node.name, position: String(targetIdx + 1) }));
    requestAnimationFrame(() => {
      const container = document.querySelector('.scripts-content');
      const nodes = container?.querySelectorAll<HTMLElement>(`[data-section="${sectionKey}"] .tree-node.has-files`);
      nodes?.[targetIdx]?.focus();
    });
  }
</script>

<div class="scripts-content" onclick={hideContextMenu} role="none">
  {#snippet scriptNode(node: FileTreeNode, sectionKey: string, isTopLevel: boolean)}
    {@const sFCls = scriptFileFilterClass(node.name, node.children)}
    {@const ds = getDragState(sectionKey)}
    {@const isDragOver = ds.dropTargetId === node.relPath}
    {@const dropPos = ds.dropPosition}
    {@const pinned = isTopLevel && uiStore.isNodePinned(`scripts:${sectionKey}`, node.relPath)}
    {#if node.isFile}
      {#if inlineRename.node?.relPath === node.relPath}
        <div class="tree-node inline-create has-files">
          <span class="w-3.5 shrink-0"></span>
          <File size={14} class="text-[var(--th-text-emerald-400)]" />
          <input bind:this={renameInput} bind:value={inlineRename.name} class="inline-create-input"
            onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onCommitRename(); } if (e.key === 'Escape') { e.preventDefault(); cancelInlineRename(); } }}
            onblur={() => { if (inlineRename.name.trim()) onCommitRename(); else cancelInlineRename(); }}
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
            (d, t, p) => onReorder(sectionKey, d, t, p),
            (d, t) => onMove(sectionKey, d, t))}
          ondragend={() => handleDragEnd(ds)}
          onclick={() => openFilePreview(node)}
          ondblclick={() => openFilePreview(node, false)}
          oncontextmenu={(e) => showFileContextMenu(e, node, sectionKey, isTopLevel)}
          onkeydown={(e) => handleScriptNodeKeydown(e, node, sectionKey)}
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
              <span role="button" tabindex="0" class="hover-action-btn" title={m.explorer_new_file()} onclick={(e) => { e.stopPropagation(); const p = node.relPath.substring(0, node.relPath.lastIndexOf('/')); startInlineCreate(p, 'file'); }} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); const p = node.relPath.substring(0, node.relPath.lastIndexOf('/')); startInlineCreate(p, 'file'); } }}>
                <FilePlus2 size={12} />
              </span>
              <span role="button" tabindex="0" class="hover-action-btn" title={m.explorer_new_folder()} onclick={(e) => { e.stopPropagation(); const p = node.relPath.substring(0, node.relPath.lastIndexOf('/')); startInlineCreate(p, 'folder'); }} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); const p = node.relPath.substring(0, node.relPath.lastIndexOf('/')); startInlineCreate(p, 'folder'); } }}>
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
      {#if inlineRename.node?.relPath === node.relPath}
        <div class="tree-node inline-create has-files">
          <ChevronRight size={14} class="chevron {expanded ? 'expanded' : ''}" />
          <Folder size={14} class="text-[var(--th-text-emerald-400)]" />
          <input bind:this={renameInput} bind:value={inlineRename.name} class="inline-create-input"
            onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onCommitRename(); } if (e.key === 'Escape') { e.preventDefault(); cancelInlineRename(); } }}
            onblur={() => { if (inlineRename.name.trim()) onCommitRename(); else cancelInlineRename(); }}
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
            (d, t, p) => onReorder(sectionKey, d, t, p),
            (d, t) => onMove(sectionKey, d, t))}
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
              <span role="button" tabindex="0" class="hover-action-btn" title={m.explorer_new_file()} onclick={(e) => { e.stopPropagation(); startInlineCreate(node.relPath, 'file'); }} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); startInlineCreate(node.relPath, 'file'); } }}>
                <FilePlus2 size={12} />
              </span>
              <span role="button" tabindex="0" class="hover-action-btn" title={m.explorer_new_folder()} onclick={(e) => { e.stopPropagation(); startInlineCreate(node.relPath, 'folder'); }} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); startInlineCreate(node.relPath, 'folder'); } }}>
                <FolderPlus size={12} />
              </span>
            </span>
          {/if}
        </button>
      {/if}
      {#if expanded && node.children}
        <div class="tree-children">
          {#if inlineCreate.parent === node.relPath}
            <div class="tree-node inline-create">
              <span class="w-3.5 shrink-0"></span>
              {#if inlineCreate.type === 'folder'}
                <Folder size={14} class="text-[var(--th-text-emerald-400)]" />
              {:else}
                <File size={14} class="text-[var(--th-text-emerald-400)]" />
              {/if}
              <input bind:this={createInput} bind:value={inlineCreate.name} class="inline-create-input"
                placeholder={inlineCreate.type === 'folder' ? 'folder name' : 'filename.lua'}
                onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onCommitCreate(); } if (e.key === 'Escape') { e.preventDefault(); cancelInlineCreate(); } }}
                onblur={() => { if (inlineCreate.name.trim()) onCommitCreate(); else cancelInlineCreate(); }}
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
    {@const filteredTreeData = getFilteredTreeData(cat.key)}
    {@const filterMatchCount = getFilterMatchCount(cat.key)}
    {@const nodeKey = `_Scripts_${cat.key}`}
    {@const isExpanded = uiStore.expandedNodes[nodeKey] ?? false}
    {@const catDir = cat.dir}
    <div data-section={cat.key}>
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
          {#if catDir && inlineCreate.parent === catDir}
            <div class="tree-node inline-create">
              <span class="w-3.5 shrink-0"></span>
              {#if inlineCreate.type === 'folder'}
                <Folder size={14} class="text-[var(--th-text-emerald-400)]" />
              {:else}
                <File size={14} class="text-[var(--th-text-emerald-400)]" />
              {/if}
              <input bind:this={createInput} bind:value={inlineCreate.name} class="inline-create-input"
                placeholder={inlineCreate.type === 'folder' ? 'folder name' : `filename${((inlineCreate.pendingTemplateId && TEMPLATE_EXT[inlineCreate.pendingTemplateId]) || SECTION_DEFAULT_EXT[cat.key]) ?? ''}`}
                onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onCommitCreate(); } if (e.key === 'Escape') { e.preventDefault(); cancelInlineCreate(); } }}
                onblur={() => { if (inlineCreate.name.trim()) onCommitCreate(); else cancelInlineCreate(); }}
              />
            </div>
          {/if}
          {#if filteredTreeData.length > 0}
            {@const orderedData = getOrderedTree(cat.key, filteredTreeData)}
            {#each orderedData as node (node.relPath)}
              {@render scriptNode(node, cat.key, true)}
            {/each}
          {:else if count === 0 && !(catDir && inlineCreate.parent === catDir)}
            <button class="tree-node text-muted" onclick={() => onScaffold(cat.key)}>
              <span class="w-3.5 shrink-0"></span>
              <Plus size={14} class="text-[var(--th-text-500)]" />
              <span class="node-label truncate text-[var(--th-text-500)] italic">{m.explorer_initialize_section({ name: cat.label })}</span>
            </button>
          {/if}
        </div>
      {/if}
    </div>
  {/each}
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
      {m.explorer_new_file()}
    </button>
    <button class="ctx-item" onclick={() => { startInlineCreate(ctxDir, 'folder'); scriptsCtxVisible = false; uiStore.expandNode('_Scripts'); uiStore.expandNode(ctxNodeKey); }} role="menuitem">
      <FolderPlus size={12} class="shrink-0" />
      {m.explorer_new_folder()}
    </button>
    {#if templates.length > 0}
      <div class="ctx-separator"></div>
      <span class="ctx-group-label">{m.explorer_templates()}</span>
      {#each templates as tmpl (tmpl.id)}
        <button class="ctx-item" onclick={() => { scriptsCtxVisible = false; createFromSectionTemplate(tmpl.id, scriptsCtxCategory); }} role="menuitem">
          <FileCode size={12} class="shrink-0" />
          {tmpl.label}
        </button>
      {/each}
    {/if}
    <div class="ctx-separator"></div>
    <button class="ctx-item" onclick={async () => { scriptsCtxVisible = false; await onRefresh(); }} role="menuitem">
      <RefreshCw size={12} class="shrink-0" />
      {m.explorer_refresh()}
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
      <button class="ctx-item" onclick={async () => { if (fileCtxNode) { const node = fileCtxNode; const ok = await onDelete(node, fileCtxSectionKey ?? undefined); if (ok) announce(m.explorer_delete_announce({ name: node.name })); hideContextMenu(); } }} role="menuitem">
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
      {m.file_explorer_rename()}
    </button>
    {#if !fileCtxNode.isFile}
      <button class="ctx-item" onclick={() => { startInlineCreate(fileCtxNode!.relPath, 'file'); hideContextMenu(); }} role="menuitem">
        <FilePlus2 size={12} class="shrink-0" />
        {m.explorer_new_file()}
      </button>
      <button class="ctx-item" onclick={() => { startInlineCreate(fileCtxNode!.relPath, 'folder'); hideContextMenu(); }} role="menuitem">
        <FolderPlus size={12} class="shrink-0" />
        {m.explorer_new_folder()}
      </button>
      {@const folderSection = detectSectionFromPath(fileCtxNode!.relPath)}
      {@const folderTemplates = mergedTemplates[folderSection ?? 'lua-se'] ?? []}
      {#if folderTemplates.length > 0}
        <div class="ctx-separator"></div>
        <span class="ctx-group-label">{m.explorer_templates()}</span>
        {#each folderTemplates as tmpl (tmpl.id)}
          <button class="ctx-item" onclick={() => { const folderPath = fileCtxNode!.relPath; hideContextMenu(); createFromSectionTemplate(tmpl.id, folderSection, folderPath); }} role="menuitem">
            <FileCode size={12} class="shrink-0" />
            {tmpl.label}
          </button>
        {/each}
      {/if}
      <button class="ctx-item" onclick={() => { const folderPath = `${modsFilePrefix}${fileCtxNode!.relPath}`; uiStore.searchFilesInclude = folderPath; uiStore.showSearchPanel = true; uiStore.activeView = "search"; hideContextMenu(); }} role="menuitem">
        <Search size={12} class="shrink-0" />
        {m.explorer_find_in_folder()}
      </button>
    {:else}
      <div class="ctx-separator"></div>
      <button class="ctx-item" onclick={() => { const parentPath = fileCtxNode!.relPath.substring(0, fileCtxNode!.relPath.lastIndexOf('/')); startInlineCreate(parentPath, 'file'); hideContextMenu(); }} role="menuitem">
        <FilePlus2 size={12} class="shrink-0" />
        {m.explorer_new_file()}
      </button>
      {#if detectSectionFromPath(fileCtxNode!.relPath)}
        {@const fileSection = detectSectionFromPath(fileCtxNode!.relPath)}
        {@const fileTemplates = mergedTemplates[fileSection ?? 'lua-se'] ?? []}
        {#if fileTemplates.length > 0}
          <div class="ctx-separator"></div>
          <span class="ctx-group-label">{m.explorer_templates()}</span>
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
      {m.explorer_cut()}
    </button>
    <button class="ctx-item" onclick={() => { clipboardNode = fileCtxNode; clipboardOp = 'copy'; hideContextMenu(); }} role="menuitem">
      <Copy size={12} class="shrink-0" />
      {m.explorer_copy()}
    </button>
    {#if clipboardNode}
      <button class="ctx-item" onclick={async () => { await pasteClipboard(fileCtxNode!); hideContextMenu(); }} role="menuitem">
        <ClipboardIcon size={12} class="shrink-0" />
        {m.explorer_paste()}
      </button>
    {/if}
    <div class="ctx-separator"></div>
    <button class="ctx-item" onclick={async () => { const modPath = modStore.selectedModPath; if (modPath && fileCtxNode) { try { await revealPath(`${modPath}/${modsFilePrefix}${fileCtxNode.relPath}`); } catch (e) { toastStore.error(m.file_explorer_open_failed_title(), String(e)); } } hideContextMenu(); }} role="menuitem">
      <FolderOpen size={12} class="shrink-0" />
      {m.explorer_context_menu_reveal_in_file_explorer()}
    </button>
    <button class="ctx-item" onclick={async () => { const modPath = modStore.selectedModPath; if (modPath && fileCtxNode) { const fullPath = `${modPath}/${modsFilePrefix}${fileCtxNode.relPath}`; await navigator.clipboard.writeText(fullPath.replace(/\//g, '\\')); } hideContextMenu(); }} role="menuitem">
      <Copy size={12} class="shrink-0" />
      {m.file_explorer_copy_path()}
    </button>
    <button class="ctx-item" onclick={async () => { if (fileCtxNode) { await navigator.clipboard.writeText(`${modsFilePrefix}${fileCtxNode.relPath}`); } hideContextMenu(); }} role="menuitem">
      <Copy size={12} class="shrink-0" />
      {m.file_explorer_copy_relative_path()}
    </button>
  </ContextMenu>
{/if}

<div class="sr-only" aria-live="polite" aria-atomic="true">
  {announceMessage}
</div>

<style>
  .scripts-content {
    padding: 0 4px;
  }

  :global(.tree-node).drop-before {
    box-shadow: inset 0 2px 0 0 var(--th-accent-500, #3b82f6);
  }
  :global(.tree-node).drop-after {
    box-shadow: inset 0 -2px 0 0 var(--th-accent-500, #3b82f6);
  }
  :global(.tree-node).dragging {
    opacity: 0.4;
  }

  :global(.pin-indicator) {
    color: var(--th-text-400);
    flex-shrink: 0;
    margin-right: -2px;
  }
</style>
