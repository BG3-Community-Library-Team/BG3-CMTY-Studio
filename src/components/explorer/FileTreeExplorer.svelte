<script lang="ts">
  import { m } from "../../paraglide/messages.js";
  import { modStore } from "../../lib/stores/modStore.svelte.js";
  import { uiStore } from "../../lib/stores/uiStore.svelte.js";
  import { toastStore } from "../../lib/stores/toastStore.svelte.js";
  import { revealPath, listModFiles } from "../../lib/utils/tauri.js";
  import { touchFile, createModDirectory, deleteModPath, moveModFile } from "../../lib/tauri/scripts.js";
  import { buildFileTree, isScriptFile, getComputedZoom } from "./explorerShared.js";
  import type { FileTreeNode } from "./explorerShared.js";
  import type { ContextMenuItemDef } from "../../lib/types/contextMenu.js";
  import ContextMenu from "../ContextMenu.svelte";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import FolderClosed from "@lucide/svelte/icons/folder-closed";
  import FileIcon from "@lucide/svelte/icons/file";
  import FileText from "@lucide/svelte/icons/file-text";
  import FileCode from "@lucide/svelte/icons/file-code";

  const PREFIX = "filetree:";

  let tree = $derived(buildFileTree(modStore.modFiles));

  /** Active node key derived from the current tab */
  let activeNodeKey = $derived.by(() => {
    const tab = uiStore.activeTab;
    if (!tab) return "";
    if (tab.type === "script-editor" && tab.filePath) return tab.filePath;
    if (tab.type === "file-preview" && tab.filePath) return tab.filePath;
    if (tab.type === "readme") return "readme";
    if (tab.type === "localization") return "localization";
    if (tab.type === "meta-lsx") return "meta.lsx";
    return "";
  });

  // ── Expansion helpers ──

  function isExpanded(relPath: string): boolean {
    return uiStore.expandedNodes[PREFIX + relPath] === true;
  }

  function toggleExpand(relPath: string): void {
    uiStore.toggleNode(PREFIX + relPath);
  }

  // ── File opening ──

  function openFile(node: FileTreeNode): void {
    const ext = node.extension?.toLowerCase() ?? "";
    const relPath = node.relPath;

    // Script files → script editor
    if (isScriptFile(ext)) {
      uiStore.openScriptTab(relPath);
      return;
    }

    // Osiris goal .txt files → script editor
    if (ext === "txt" && relPath.includes("Story/RawFiles/Goals/")) {
      uiStore.openScriptTab(relPath);
      return;
    }

    // .lsx / .lsefx → lsx-file tab
    if (ext === "lsx" || ext === "lsefx") {
      // meta.lsx gets its own tab type
      if (node.name === "meta.lsx") {
        uiStore.openTab({ id: "meta.lsx", label: "meta.lsx", type: "meta-lsx", category: "meta", icon: "⚙" });
        return;
      }
      uiStore.openTab({ id: `file:${relPath}`, label: node.name, type: "file-preview", filePath: relPath, icon: "📄", preview: true });
      return;
    }

    // .xml → file preview (could be loca or other xml)
    if (ext === "xml") {
      uiStore.openTab({ id: `file:${relPath}`, label: node.name, type: "file-preview", filePath: relPath, icon: "📄", preview: true });
      return;
    }

    // .md → readme tab
    if (ext === "md") {
      uiStore.openTab({ id: "readme", label: node.name, type: "readme", icon: "📝" });
      return;
    }

    // Other text files → file preview
    uiStore.openTab({ id: `file:${relPath}`, label: node.name, type: "file-preview", filePath: relPath, icon: "📄", preview: true });
  }

  // ── Context menu ──

  let ctxVisible = $state(false);
  let ctxX = $state(0);
  let ctxY = $state(0);
  let ctxNode: FileTreeNode | null = $state(null);
  let ctxItems: ContextMenuItemDef[] = $state([]);

  function showContextMenu(e: MouseEvent, node: FileTreeNode): void {
    e.preventDefault();
    e.stopPropagation();
    const zoom = getComputedZoom(e.currentTarget as HTMLElement);
    ctxX = e.clientX / zoom;
    ctxY = e.clientY / zoom;
    ctxNode = node;
    ctxItems = node.isFile ? buildFileMenu(node) : buildFolderMenu(node);
    ctxVisible = true;
  }

  function hideContextMenu(): void {
    ctxVisible = false;
    ctxNode = null;
    ctxItems = [];
  }

  function buildFolderMenu(node: FileTreeNode): ContextMenuItemDef[] {
    return [
      { label: m.explorer_context_menu_new_file?.() ?? "New File…", action: () => startInlineCreate("file", node.relPath) },
      { label: m.explorer_context_menu_new_folder?.() ?? "New Folder…", action: () => startInlineCreate("folder", node.relPath), separator: "after" },
      { label: m.file_explorer_rename?.() ?? "Rename", shortcut: "F2", action: () => startRename(node) },
      { label: m.file_explorer_delete?.() ?? "Delete", action: () => confirmDelete(node), separator: "after" },
      { label: m.file_explorer_copy_path(), action: () => copyAbsolutePath(node) },
      { label: m.file_explorer_copy_relative_path?.() ?? "Copy Relative Path", action: () => copyRelativePath(node) },
      { label: m.explorer_context_menu_reveal_in_file_explorer(), action: () => revealInFileManager(node) },
    ];
  }

  function buildFileMenu(node: FileTreeNode): ContextMenuItemDef[] {
    return [
      { label: m.file_explorer_rename?.() ?? "Rename", shortcut: "F2", action: () => startRename(node) },
      { label: m.file_explorer_delete?.() ?? "Delete", action: () => confirmDelete(node), separator: "after" },
      { label: m.file_explorer_copy_path(), action: () => copyAbsolutePath(node) },
      { label: m.file_explorer_copy_relative_path?.() ?? "Copy Relative Path", action: () => copyRelativePath(node) },
      { label: m.explorer_context_menu_reveal_in_file_explorer(), action: () => revealInFileManager(node) },
    ];
  }

  // ── Clipboard / Reveal helpers ──

  async function copyAbsolutePath(node: FileTreeNode): Promise<void> {
    const modPath = modStore.selectedModPath;
    if (!modPath) return;
    const fullPath = `${modPath}/${node.relPath}`.replace(/\//g, "\\");
    try {
      await navigator.clipboard.writeText(fullPath);
      toastStore.success(m.file_explorer_copy_path?.() ?? "Path copied");
    } catch { /* clipboard may fail in some contexts */ }
    hideContextMenu();
  }

  async function copyRelativePath(node: FileTreeNode): Promise<void> {
    try {
      await navigator.clipboard.writeText(node.relPath);
      toastStore.success(m.file_explorer_copy_relative_path?.() ?? "Relative path copied");
    } catch { /* clipboard may fail */ }
    hideContextMenu();
  }

  async function revealInFileManager(node: FileTreeNode): Promise<void> {
    const modPath = modStore.selectedModPath;
    if (!modPath) return;
    const fullPath = `${modPath}/${node.relPath}`;
    try { await revealPath(fullPath); }
    catch (err) { console.warn("Failed to reveal path:", err); }
    hideContextMenu();
  }

  // ── Tree refresh ──

  async function refreshTree(): Promise<void> {
    const modPath = modStore.selectedModPath;
    if (!modPath) return;
    try {
      modStore.modFiles = await listModFiles(modPath);
    } catch (err) {
      console.warn("Failed to refresh file tree:", err);
    }
  }

  // ── Inline Create ──

  let inlineCreate: { mode: "file" | "folder"; parentPath: string } | null = $state(null);
  let inlineCreateName = $state("");

  function startInlineCreate(mode: "file" | "folder", parentPath: string): void {
    hideContextMenu();
    // Expand the parent folder so user sees the inline input
    uiStore.expandNode(PREFIX + parentPath);
    inlineCreate = { mode, parentPath };
    inlineCreateName = "";
  }

  async function commitInlineCreate(): Promise<void> {
    if (!inlineCreate || !inlineCreateName.trim()) {
      inlineCreate = null;
      return;
    }
    const modPath = modStore.selectedModPath;
    if (!modPath) { inlineCreate = null; return; }

    const relPath = inlineCreate.parentPath
      ? `${inlineCreate.parentPath}/${inlineCreateName.trim()}`
      : inlineCreateName.trim();

    try {
      if (inlineCreate.mode === "file") {
        await touchFile(modPath, relPath);
      } else {
        await createModDirectory(modPath, relPath);
      }
      toastStore.success(m.file_tree_created?.({ name: inlineCreateName.trim() }) ?? `Created ${inlineCreateName.trim()}`);
      await refreshTree();
    } catch (err) {
      toastStore.error("Error", String(err));
    }
    inlineCreate = null;
    inlineCreateName = "";
  }

  function cancelInlineCreate(): void {
    inlineCreate = null;
    inlineCreateName = "";
  }

  // ── Inline Rename ──

  let inlineRename: { relPath: string; originalName: string } | null = $state(null);
  let inlineRenameName = $state("");

  function startRename(node: FileTreeNode): void {
    hideContextMenu();
    inlineRename = { relPath: node.relPath, originalName: node.name };
    inlineRenameName = node.name;
  }

  async function commitRename(): Promise<void> {
    if (!inlineRename || !inlineRenameName.trim() || inlineRenameName.trim() === inlineRename.originalName) {
      inlineRename = null;
      return;
    }
    const modPath = modStore.selectedModPath;
    if (!modPath) { inlineRename = null; return; }

    const parentPath = inlineRename.relPath.includes("/")
      ? inlineRename.relPath.substring(0, inlineRename.relPath.lastIndexOf("/"))
      : "";
    const newRelPath = parentPath
      ? `${parentPath}/${inlineRenameName.trim()}`
      : inlineRenameName.trim();

    try {
      await moveModFile(modPath, inlineRename.relPath, newRelPath);
      toastStore.success(m.file_tree_renamed?.({ name: inlineRenameName.trim() }) ?? `Renamed to ${inlineRenameName.trim()}`);
      await refreshTree();
    } catch (err) {
      toastStore.error("Error", String(err));
    }
    inlineRename = null;
    inlineRenameName = "";
  }

  function cancelRename(): void {
    inlineRename = null;
    inlineRenameName = "";
  }

  // ── Delete with confirmation ──

  async function confirmDelete(node: FileTreeNode): Promise<void> {
    hideContextMenu();
    const modPath = modStore.selectedModPath;
    if (!modPath) return;
    const name = node.name;
    if (!confirm(m.file_tree_delete_confirm?.({ name }) ?? `Delete "${name}"?`)) return;
    try {
      await deleteModPath(modPath, node.relPath);
      toastStore.success(m.file_tree_deleted?.({ name }) ?? `Deleted ${name}`);
      await refreshTree();
    } catch (err) {
      toastStore.error("Error", String(err));
    }
  }

  // ── Keyboard shortcut (F2 for rename) ──

  function handleTreeKeydown(e: KeyboardEvent): void {
    if (e.key === "F2" && activeNodeKey) {
      e.preventDefault();
      // Find the node matching activeNodeKey
      const node = findNode(tree, activeNodeKey);
      if (node) startRename(node);
    }
  }

  function findNode(nodes: FileTreeNode[], relPath: string): FileTreeNode | null {
    for (const n of nodes) {
      if (n.relPath === relPath) return n;
      if (n.children) {
        const found = findNode(n.children, relPath);
        if (found) return found;
      }
    }
    return null;
  }

  // ── Icon helper ──

  function fileIcon(ext?: string) {
    if (!ext) return FileIcon;
    const lower = ext.toLowerCase();
    if (lower === "lua" || lower === "khn" || lower === "anc" || lower === "ann" || lower === "anm" || lower === "clc" || lower === "cln" || lower === "clm") return FileCode;
    if (lower === "txt" || lower === "md" || lower === "xml" || lower === "lsx" || lower === "lsefx" || lower === "yaml" || lower === "yml" || lower === "json" || lower === "toml" || lower === "ini" || lower === "cfg") return FileText;
    return FileIcon;
  }

  // ── Depth indentation ──

  function depthPx(relPath: string): number {
    const depth = relPath.split("/").length - 1;
    return depth * 16;
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="filetree-content" onclick={hideContextMenu} onkeydown={handleTreeKeydown} role="tree" tabindex="-1">
  {#each tree as node (node.relPath)}
    {#if node.isFile}
      {@const Icon = fileIcon(node.extension)}
      {#if inlineRename && inlineRename.relPath === node.relPath}
        <div class="tree-node inline-input-row" style="padding-left: {depthPx(node.relPath) + 4}px">
          <span class="w-3.5 shrink-0"></span>
          <Icon size={14} class="text-[var(--th-text-400)] shrink-0" />
          <!-- svelte-ignore a11y_autofocus -->
          <input
            class="inline-input"
            type="text"
            bind:value={inlineRenameName}
            onkeydown={(e) => { if (e.key === "Enter") commitRename(); else if (e.key === "Escape") cancelRename(); }}
            onblur={commitRename}
            autofocus
          />
        </div>
      {:else}
        <button
          class="tree-node"
          class:active-node={activeNodeKey === node.relPath}
          style="padding-left: {depthPx(node.relPath) + 4}px"
          onclick={() => openFile(node)}
          ondblclick={() => { const tab = uiStore.openTabs.find(t => t.preview && (t.filePath === node.relPath || t.id === `file:${node.relPath}`)); if (tab) uiStore.pinTab(tab.id); }}
          oncontextmenu={(e) => showContextMenu(e, node)}
          role="treeitem"
          tabindex="-1"
          aria-selected={activeNodeKey === node.relPath}
        >
          <span class="w-3.5 shrink-0"></span>
          <Icon size={14} class="text-[var(--th-text-400)] shrink-0" />
          <span class="node-label truncate">{node.name}</span>
        </button>
      {/if}
    {:else}
      {@const expanded = isExpanded(node.relPath)}
      {#if inlineRename && inlineRename.relPath === node.relPath}
        <div class="tree-node inline-input-row" style="padding-left: {depthPx(node.relPath) + 4}px">
          <ChevronRight size={14} class="chevron {expanded ? 'expanded' : ''}" />
          {#if expanded}
            <FolderOpen size={14} class="text-[var(--th-text-400)] shrink-0" />
          {:else}
            <FolderClosed size={14} class="text-[var(--th-text-400)] shrink-0" />
          {/if}
          <!-- svelte-ignore a11y_autofocus -->
          <input
            class="inline-input"
            type="text"
            bind:value={inlineRenameName}
            onkeydown={(e) => { if (e.key === "Enter") commitRename(); else if (e.key === "Escape") cancelRename(); }}
            onblur={commitRename}
            autofocus
          />
        </div>
      {:else}
        <button
          class="tree-node"
          style="padding-left: {depthPx(node.relPath) + 4}px"
          onclick={() => toggleExpand(node.relPath)}
          oncontextmenu={(e) => showContextMenu(e, node)}
          role="treeitem"
          tabindex="-1"
          aria-expanded={expanded}
          aria-selected={false}
        >
          <ChevronRight size={14} class="chevron {expanded ? 'expanded' : ''}" />
          {#if expanded}
            <FolderOpen size={14} class="text-[var(--th-text-400)] shrink-0" />
          {:else}
            <FolderClosed size={14} class="text-[var(--th-text-400)] shrink-0" />
          {/if}
          <span class="node-label truncate">{node.name}</span>
        </button>
      {/if}
      {#if expanded}
        {#if inlineCreate && inlineCreate.parentPath === node.relPath}
          <div class="tree-node inline-input-row" style="padding-left: {(depthPx(node.relPath) / 16 + 1) * 16 + 4}px">
            <span class="w-3.5 shrink-0"></span>
            {#if inlineCreate.mode === "folder"}
              <FolderClosed size={14} class="text-[var(--th-text-400)] shrink-0" />
            {:else}
              <FileIcon size={14} class="text-[var(--th-text-400)] shrink-0" />
            {/if}
            <!-- svelte-ignore a11y_autofocus -->
            <input
              class="inline-input"
              type="text"
              bind:value={inlineCreateName}
              placeholder={inlineCreate.mode === "file" ? "filename" : "folder name"}
              onkeydown={(e) => { if (e.key === "Enter") commitInlineCreate(); else if (e.key === "Escape") cancelInlineCreate(); }}
              onblur={commitInlineCreate}
              autofocus
            />
          </div>
        {/if}
        {#if node.children}
          {#each node.children as child (child.relPath)}
            {#snippet renderNode(n: FileTreeNode, depth: number)}
              {#if n.isFile}
                {@const FIcon = fileIcon(n.extension)}
                {#if inlineRename && inlineRename.relPath === n.relPath}
                  <div class="tree-node inline-input-row" style="padding-left: {depth * 16 + 4}px">
                    <span class="w-3.5 shrink-0"></span>
                    <FIcon size={14} class="text-[var(--th-text-400)] shrink-0" />
                    <!-- svelte-ignore a11y_autofocus -->
                    <input
                      class="inline-input"
                      type="text"
                      bind:value={inlineRenameName}
                      onkeydown={(e) => { if (e.key === "Enter") commitRename(); else if (e.key === "Escape") cancelRename(); }}
                      onblur={commitRename}
                      autofocus
                    />
                  </div>
                {:else}
                  <button
                    class="tree-node"
                    class:active-node={activeNodeKey === n.relPath}
                    style="padding-left: {depth * 16 + 4}px"
                    onclick={() => openFile(n)}
                    ondblclick={() => { const tab = uiStore.openTabs.find(t => t.preview && (t.filePath === n.relPath || t.id === `file:${n.relPath}`)); if (tab) uiStore.pinTab(tab.id); }}
                    oncontextmenu={(e) => showContextMenu(e, n)}
                    role="treeitem"
                    tabindex="-1"
                    aria-selected={activeNodeKey === n.relPath}
                  >
                    <span class="w-3.5 shrink-0"></span>
                    <FIcon size={14} class="text-[var(--th-text-400)] shrink-0" />
                    <span class="node-label truncate">{n.name}</span>
                  </button>
                {/if}
              {:else}
                {@const childExpanded = isExpanded(n.relPath)}
                {#if inlineRename && inlineRename.relPath === n.relPath}
                  <div class="tree-node inline-input-row" style="padding-left: {depth * 16 + 4}px">
                    <ChevronRight size={14} class="chevron {childExpanded ? 'expanded' : ''}" />
                    {#if childExpanded}
                      <FolderOpen size={14} class="text-[var(--th-text-400)] shrink-0" />
                    {:else}
                      <FolderClosed size={14} class="text-[var(--th-text-400)] shrink-0" />
                    {/if}
                    <!-- svelte-ignore a11y_autofocus -->
                    <input
                      class="inline-input"
                      type="text"
                      bind:value={inlineRenameName}
                      onkeydown={(e) => { if (e.key === "Enter") commitRename(); else if (e.key === "Escape") cancelRename(); }}
                      onblur={commitRename}
                      autofocus
                    />
                  </div>
                {:else}
                  <button
                    class="tree-node"
                    style="padding-left: {depth * 16 + 4}px"
                    onclick={() => toggleExpand(n.relPath)}
                    oncontextmenu={(e) => showContextMenu(e, n)}
                    role="treeitem"
                    tabindex="-1"
                    aria-expanded={childExpanded}
                    aria-selected={false}
                  >
                    <ChevronRight size={14} class="chevron {childExpanded ? 'expanded' : ''}" />
                    {#if childExpanded}
                      <FolderOpen size={14} class="text-[var(--th-text-400)] shrink-0" />
                    {:else}
                      <FolderClosed size={14} class="text-[var(--th-text-400)] shrink-0" />
                    {/if}
                    <span class="node-label truncate">{n.name}</span>
                  </button>
                {/if}
                {#if childExpanded}
                  {#if inlineCreate && inlineCreate.parentPath === n.relPath}
                    <div class="tree-node inline-input-row" style="padding-left: {(depth + 1) * 16 + 4}px">
                      <span class="w-3.5 shrink-0"></span>
                      {#if inlineCreate.mode === "folder"}
                        <FolderClosed size={14} class="text-[var(--th-text-400)] shrink-0" />
                      {:else}
                        <FileIcon size={14} class="text-[var(--th-text-400)] shrink-0" />
                      {/if}
                      <!-- svelte-ignore a11y_autofocus -->
                      <input
                        class="inline-input"
                        type="text"
                        bind:value={inlineCreateName}
                        placeholder={inlineCreate.mode === "file" ? "filename" : "folder name"}
                        onkeydown={(e) => { if (e.key === "Enter") commitInlineCreate(); else if (e.key === "Escape") cancelInlineCreate(); }}
                        onblur={commitInlineCreate}
                        autofocus
                      />
                    </div>
                  {/if}
                  {#if n.children}
                    {#each n.children as grandchild (grandchild.relPath)}
                      {@render renderNode(grandchild, depth + 1)}
                    {/each}
                  {/if}
                {/if}
              {/if}
            {/snippet}
            {@render renderNode(child, depthPx(node.relPath) / 16 + 1)}
          {/each}
        {/if}
      {/if}
    {/if}
  {/each}
</div>

{#if ctxVisible && ctxNode}
  <ContextMenu x={ctxX} y={ctxY} header={ctxNode.name} items={ctxItems} onclose={hideContextMenu} />
{/if}

<style>
  .filetree-content {
    padding: 0 4px;
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

  .tree-node.active-node {
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

  .node-label {
    flex: 1;
    min-width: 0;
  }

  .inline-input-row {
    cursor: default;
  }

  .inline-input {
    flex: 1;
    min-width: 0;
    background: var(--th-bg-800, #1e1e1e);
    color: var(--th-text-100);
    border: 1px solid var(--th-accent-500, #0ea5e9);
    border-radius: 2px;
    font-size: 12px;
    padding: 0 4px;
    height: 20px;
    outline: none;
  }

  .inline-input::placeholder {
    color: var(--th-text-500);
  }
</style>
