<script lang="ts">
  import { modStore } from "../lib/stores/modStore.svelte.js";
  import { configStore } from "../lib/stores/configStore.svelte.js";
  import { uiStore } from "../lib/stores/uiStore.svelte.js";
  import { toastStore } from "../lib/stores/toastStore.svelte.js";
  import {
    BG3_CORE_FOLDERS,
    BG3_ADDITIONAL_FOLDERS,
    BG3_STATS_FOLDERS,
    type FolderNode,
  } from "../lib/data/bg3FolderStructure.js";
  import { openPath } from "../lib/utils/tauri.js";
  import { localeCompare } from "../lib/utils/localeSort.js";
  import ContextMenu from "./ContextMenu.svelte";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import File from "@lucide/svelte/icons/file";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import Folder from "@lucide/svelte/icons/folder";
  import FileCode2 from "@lucide/svelte/icons/file-code-2";
  import Cog from "@lucide/svelte/icons/cog";
  import Package from "@lucide/svelte/icons/package";
  import FilePlus2 from "@lucide/svelte/icons/file-plus-2";
  import Plus from "@lucide/svelte/icons/plus";
  import type { SectionResult, DiffEntry } from "../lib/types/index.js";
  import type { ModFileEntry } from "../lib/utils/tauri.js";
  import { open } from "@tauri-apps/plugin-dialog";
  import { scanAndImport } from "../lib/services/scanService.js";
  import { m } from "../paraglide/messages.js";

  // ── File type badge colors ──
  const EXT_BADGE_COLORS: Record<string, string> = {
    yaml: "#22c55e", yml: "#22c55e",
    json: "#3b82f6",
    lua: "#a855f7",
    md: "#6b7280",
    txt: "#6b7280",
    xml: "#f97316",
    cfg: "#eab308",
  };
  const CF_BADGE_COLOR = "#0ea5e9";
  const EXT_BADGE_FALLBACK = "#6b7280";

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

    // Sort: folders first, then files, alphabetically
    function sortTree(nodes: FileTreeNode[]) {
      nodes.sort((a, b) => {
        if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
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
    for (const e of configStore.manualEntries) {
      m.set(e.section, (m.get(e.section) ?? 0) + 1);
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
  function resolveNodePath(nodeKey: string, kind: "root" | "public-folder" | "public-child" | "stats" | "stats-child" | "mods" | "meta" | "cf-config" | "additional"): string {
    const base = modStore.selectedModPath;
    if (!base) return "";
    switch (kind) {
      case "root": return base;
      case "meta": return `${base}/Mods/${modFolder}`;
      case "public-folder": return `${base}/Public/${modFolder}/${nodeKey}`;
      case "public-child": return `${base}/Public/${modFolder}/${nodeKey}`;
      case "stats": return `${base}/Public/${modFolder}/Stats/Generated/Data`;
      case "stats-child": return `${base}/Public/${modFolder}/Stats/Generated/Data/${nodeKey}`;
      case "mods": return `${base}/Mods/${modFolder}`;
      case "cf-config": return `${base}/Mods/${modFolder}/ScriptExtender`;
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
  let isStatsExpanded = $derived(uiStore.expandedNodes["Stats"] ?? false);
  let isModsExpanded = $derived(uiStore.expandedNodes["Mods"] ?? false);

  /** Derive the active node name/section from the current tab */
  let activeNodeKey = $derived.by(() => {
    const tab = uiStore.activeTab;
    if (!tab) return "";
    if (tab.type === "group") return tab.category ?? "";
    if (tab.type === "filteredSection") return tab.id.replace("filtered:", "");
    if (tab.type === "section") return tab.category ?? "";
    if (tab.type === "lsx-file") return tab.category ?? "";
    if (tab.type === "meta-lsx") return "meta.lsx";
    if (tab.type === "cf-config") return "cf-config";
    if (tab.type === "file-preview") return `file:${tab.filePath ?? ""}`;
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

  const CF_CONFIG_RE = /^CompatibilityFrameworkConfig\.(yaml|yml|json)$/i;

  /** Open a mod file in a file-preview tab */
  function openFilePreview(fileNode: FileTreeNode, preview = true): void {
    const fileName = fileNode.name;
    const fullRelPath = `${modsFilePrefix}${fileNode.relPath}`;
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
        title="Open a different project"
        aria-label="Open project folder"
        onclick={async () => {
          try {
            const selected = await open({ directory: true, title: "Select Mod Folder" });
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
              const selected = await open({ directory: true, title: "Select Mod Folder" });
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
    <div class="tree-root">
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
              {#each BG3_CORE_FOLDERS as node (node.name)}
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
                          >
                            <span class="chevron-hit" onclick={(e) => { e.stopPropagation(); uiStore.toggleNode(child.name); }} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); uiStore.toggleNode(child.name); } }} role="button" tabindex="0" aria-label="Toggle {child.label}">
                              <ChevronRight size={14} class="chevron {childExpanded ? 'expanded' : ''}" />
                            </span>
                            <button class="tree-node-label" onclick={() => uiStore.toggleNode(child.name)}>
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

              <!-- Additional Data separator -->
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
                  {#each BG3_ADDITIONAL_FOLDERS as node (node.name)}
                    {@const adCount = getSectionCount(node.name)}
                    <button class="tree-node" class:has-files={adCount > 0} class:active-node={isActiveNode(node)} onclick={() => openNode(node)} ondblclick={() => openNode(node, false)} oncontextmenu={(e) => showContextMenu(e, resolveNodePath(node.name, 'additional'), node.label, node.Section, node)}>
                      <span class="w-3.5 shrink-0"></span>
                      <File size={14} class={adCount > 0 ? "text-[var(--th-text-sky-400)]" : "text-[var(--th-text-600)] opacity-40"} />
                      <span class="node-label truncate" class:text-muted={adCount === 0}>{node.label}</span>
                      {#if adCount > 0}
                        <span class="entry-count">{adCount}</span>
                      {/if}
                    </button>
                  {/each}
                </div>
              {/if}

              <!-- ── Stats/Generated/Data (nested under Public) ── -->
              <button class="tree-node separator-node" onclick={() => uiStore.toggleNode("Stats")}>
                <ChevronRight size={14} class="chevron {isStatsExpanded ? 'expanded' : ''}" />
                {#if isStatsExpanded}
                  <FolderOpen size={14} class="text-[var(--th-text-violet-400)]" />
                {:else}
                  <Folder size={14} class="text-[var(--th-text-violet-400)]" />
                {/if}
                <span class="node-label">Stats</span>
              </button>

              {#if isStatsExpanded}
                <div class="tree-children">
                  {#each BG3_STATS_FOLDERS[0]?.children ?? [] as node (node.name)}
                    {@const active = node.Section ? hasModFiles(node) : false}
                    {@const isExpanded = uiStore.expandedNodes[node.name] ?? false}

                    {#if node.children}
                      <div
                        class="tree-node"
                        class:has-files={active}
                        oncontextmenu={(e) => showContextMenu(e, resolveNodePath(node.name, 'stats-child'), node.label, node.Section, node)}
                        role="treeitem"
                        tabindex="0"
                        aria-selected="false"
                        aria-expanded={isExpanded}
                      >
                        <span class="chevron-hit" onclick={(e) => { e.stopPropagation(); uiStore.toggleNode(node.name); }} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); uiStore.toggleNode(node.name); } }} role="button" tabindex="0" aria-label="Toggle {node.label}">
                          <ChevronRight size={14} class="chevron {isExpanded ? 'expanded' : ''}" />
                        </span>
                        <button class="tree-node-label" onclick={() => openNode(node)}>
                          {#if isExpanded}
                            <FolderOpen size={14} class={active ? "text-[var(--th-text-sky-400)]" : "text-[var(--th-text-600)] opacity-40"} />
                          {:else}
                            <Folder size={14} class={active ? "text-[var(--th-text-sky-400)]" : "text-[var(--th-text-600)] opacity-40"} />
                          {/if}
                          <span class="node-label truncate" class:text-muted={!active}>{node.label}</span>
                        </button>
                      </div>

                      {#if isExpanded}
                        <div class="tree-children">
                          {#each node.children as child (child.name)}
                            <button class="tree-node" onclick={() => openNode(child)} ondblclick={() => openNode(child, false)} oncontextmenu={(e) => showContextMenu(e, resolveNodePath(child.name, 'stats-child'), child.label, child.Section, child)}>
                              <span class="w-3.5 shrink-0"></span>
                              <FileCode2 size={14} class="text-[var(--th-text-600)] opacity-50" />
                              <span class="node-label truncate text-muted">{child.label}</span>
                              {#if child.statsFile}
                                <span class="text-[9px] text-[var(--th-text-600)] opacity-50">.txt</span>
                              {/if}
                            </button>
                          {/each}
                        </div>
                      {/if}
                    {:else}
                      <button class="tree-node" onclick={() => openNode(node)} ondblclick={() => openNode(node, false)} oncontextmenu={(e) => showContextMenu(e, resolveNodePath(node.name, 'stats-child'), node.label, node.Section, node)}>
                        <span class="w-3.5 shrink-0"></span>
                        <FileCode2 size={14} class="text-[var(--th-text-600)] opacity-50" />
                        <span class="node-label truncate text-muted">{node.label}</span>
                        {#if node.statsFile}
                          <span class="text-[9px] text-[var(--th-text-600)] opacity-50">.txt</span>
                        {/if}
                      </button>
                    {/if}
                  {/each}
                </div>
              {/if}
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
                    >
                      <span class="w-3.5 shrink-0"></span>
                      <File size={14} class="text-[var(--th-text-emerald-400)]" />
                      <span class="node-label truncate">{node.name}</span>
                      {#if CF_CONFIG_RE.test(node.name)}
                        <span class="ext-badge" style="background: {CF_BADGE_COLOR}">CF</span>
                      {/if}
                      {#if node.extension}
                        <span class="ext-badge" style="background: {EXT_BADGE_COLORS[node.extension] ?? EXT_BADGE_FALLBACK}">.{node.extension}</span>
                      {/if}
                    </button>
                  {:else}
                    {@const expanded = uiStore.expandedNodes[`modfile:${node.relPath}`] ?? false}
                    <button class="tree-node has-files" onclick={() => uiStore.toggleNode(`modfile:${node.relPath}`)}>
                      <ChevronRight size={14} class="chevron {expanded ? 'expanded' : ''}" />
                      {#if expanded}
                        <FolderOpen size={14} class="text-[var(--th-text-indigo-400)]" />
                      {:else}
                        <Folder size={14} class="text-[var(--th-text-indigo-400)]" />
                      {/if}
                      <span class="node-label truncate">{node.name}</span>
                    </button>
                    {#if expanded && node.children}
                      <div class="tree-children">
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
</style>
