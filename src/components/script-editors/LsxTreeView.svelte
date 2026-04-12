<!--
  LSX Tree View — Renders XML content as a collapsible, searchable tree.
  Standalone component: receives content string, parses via DOMParser, renders tree.
-->
<script lang="ts">
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Search from "@lucide/svelte/icons/search";
  import Copy from "@lucide/svelte/icons/copy";
  import Check from "@lucide/svelte/icons/check";
  import { m } from "../../paraglide/messages.js";

  interface Props {
    content: string;
    language: string;
    onnodeclick?: (info: { tagName: string; line: number }) => void;
  }

  let { content, language, onnodeclick }: Props = $props();

  interface TreeNode {
    tagName: string;
    attributes: Record<string, string>;
    children: TreeNode[];
    depth: number;
    path: string;
  }

  let searchQuery = $state("");
  let expandedPaths: Record<string, boolean> = $state({});
  let copiedPath = $state(false);
  let focusedIndex = $state(-1);
  let treeEl: HTMLDivElement | undefined = $state(undefined);

  function parseXml(xml: string): { nodes: TreeNode[]; error: string | null } {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, "application/xml");
      const errorNode = doc.querySelector("parsererror");
      if (errorNode) {
        return { nodes: [], error: m.lsx_tree_parse_error() };
      }
      return { nodes: elementToNodes(doc.documentElement, 0, ""), error: null };
    } catch {
      return { nodes: [], error: m.lsx_tree_parse_error() };
    }
  }

  function elementToNodes(el: Element, depth: number, parentPath: string): TreeNode[] {
    const nodes: TreeNode[] = [];
    const tagName = el.tagName;
    const path = parentPath ? `${parentPath}/${tagName}` : `/${tagName}`;

    const attributes: Record<string, string> = {};
    for (const attr of el.attributes) {
      attributes[attr.name] = attr.value;
    }

    const children: TreeNode[] = [];
    for (const child of el.children) {
      children.push(...elementToNodes(child, depth + 1, path));
    }

    nodes.push({ tagName, attributes, children, depth, path });
    return nodes;
  }

  let parseResult = $derived(language === "xml" ? parseXml(content) : { nodes: [], error: null });
  let tree = $derived(parseResult.nodes);
  let parseError = $derived(parseResult.error);

  function flattenVisible(nodes: TreeNode[]): TreeNode[] {
    const result: TreeNode[] = [];
    for (const node of nodes) {
      if (matchesSearch(node)) {
        result.push(node);
        if (expandedPaths[node.path]) {
          result.push(...flattenVisible(node.children));
        }
      }
    }
    return result;
  }

  let visibleNodes = $derived(flattenVisible(tree));

  function matchesSearch(node: TreeNode): boolean {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    if (node.tagName.toLowerCase().includes(q)) return true;
    for (const [key, val] of Object.entries(node.attributes)) {
      if (key.toLowerCase().includes(q) || val.toLowerCase().includes(q)) return true;
    }
    // Check children recursively
    return node.children.some(c => matchesSearch(c));
  }

  function toggle(path: string) {
    expandedPaths = { ...expandedPaths, [path]: !expandedPaths[path] };
  }

  function expandAll(nodes: TreeNode[]) {
    const next = { ...expandedPaths };
    function walk(ns: TreeNode[]) {
      for (const n of ns) {
        if (n.children.length > 0) next[n.path] = true;
        walk(n.children);
      }
    }
    walk(nodes);
    expandedPaths = next;
  }

  function collapseAll() {
    expandedPaths = {};
  }

  function getXPath(node: TreeNode): string {
    return node.path;
  }

  async function copyXPath(node: TreeNode) {
    const xpath = getXPath(node);
    await navigator.clipboard.writeText(xpath);
    copiedPath = true;
    setTimeout(() => { copiedPath = false; }, 1500);
  }

  function handleNodeClick(node: TreeNode) {
    onnodeclick?.({ tagName: node.tagName, line: 0 });
  }

  function handleKeydown(e: KeyboardEvent) {
    const nodes = visibleNodes;
    if (!nodes.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusedIndex = Math.min(focusedIndex + 1, nodes.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusedIndex = Math.max(focusedIndex - 1, 0);
    } else if (e.key === "ArrowRight" && focusedIndex >= 0) {
      e.preventDefault();
      const node = nodes[focusedIndex];
      if (node.children.length > 0 && !expandedPaths[node.path]) {
        toggle(node.path);
      }
    } else if (e.key === "ArrowLeft" && focusedIndex >= 0) {
      e.preventDefault();
      const node = nodes[focusedIndex];
      if (expandedPaths[node.path]) {
        toggle(node.path);
      }
    } else if (e.key === "Enter" && focusedIndex >= 0) {
      e.preventDefault();
      const node = nodes[focusedIndex];
      if (node.children.length > 0) {
        toggle(node.path);
      }
      handleNodeClick(node);
    }
  }
</script>

{#if language !== "xml"}
  <div class="tree-empty">
    <p class="text-xs text-[var(--th-text-500)]">Tree view is only available for XML files.</p>
  </div>
{:else}
  <div class="lsx-tree-view">
    <div class="tree-toolbar">
      <div class="tree-search">
        <Search size={12} class="text-[var(--th-text-500)]" />
        <input
          type="text"
          class="tree-search-input"
          placeholder={m.lsx_tree_search_placeholder()}
          bind:value={searchQuery}
          aria-label={m.lsx_tree_search_placeholder()}
        />
      </div>
      <button class="tree-tool-btn" onclick={() => expandAll(tree)} title="Expand all">+</button>
      <button class="tree-tool-btn" onclick={collapseAll} title="Collapse all">−</button>
    </div>

    {#if parseError}
      <div class="tree-empty">
        <p class="text-xs text-red-400">{parseError}</p>
      </div>
    {:else if visibleNodes.length === 0 && searchQuery}
      <div class="tree-empty">
        <p class="text-xs text-[var(--th-text-500)]">{m.lsx_tree_no_results()}</p>
      </div>
    {:else}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="tree-container"
        bind:this={treeEl}
        onkeydown={handleKeydown}
        tabindex="0"
        role="tree"
        aria-label="LSX Tree"
      >
        {#each visibleNodes as node, idx (node.path)}
          {@const isExpanded = !!expandedPaths[node.path]}
          {@const hasChildren = node.children.length > 0}
          {@const attrEntries = Object.entries(node.attributes)}
          <div
            class="tree-node"
            class:focused={focusedIndex === idx}
            style="padding-left: {node.depth * 16 + 4}px"
            role="treeitem"
            aria-expanded={hasChildren ? isExpanded : undefined}
            aria-selected={focusedIndex === idx}
            tabindex={focusedIndex === idx ? 0 : -1}
            onclick={() => { focusedIndex = idx; if (hasChildren) toggle(node.path); handleNodeClick(node); }}
            onkeydown={(e) => { if (e.key === "Enter") { if (hasChildren) toggle(node.path); handleNodeClick(node); } }}
          >
            <span class="tree-toggle">
              {#if hasChildren}
                {#if isExpanded}
                  <ChevronDown size={12} />
                {:else}
                  <ChevronRight size={12} />
                {/if}
              {:else}
                <span class="tree-spacer"></span>
              {/if}
            </span>
            <span class="tree-tag">{node.tagName}</span>
            {#if attrEntries.length > 0}
              {#each attrEntries.slice(0, 3) as [key, val]}
                <span class="tree-attr">
                  <span class="tree-attr-key">{key}</span>=<span class="tree-attr-val">"{val}"</span>
                </span>
              {/each}
              {#if attrEntries.length > 3}
                <span class="tree-attr-more">+{attrEntries.length - 3}</span>
              {/if}
            {/if}
            {#if hasChildren}
              <span class="tree-child-count">({node.children.length} {m.lsx_tree_children()})</span>
            {/if}
            <button
              class="tree-copy-btn"
              onclick={(e) => { e.stopPropagation(); copyXPath(node); }}
              title={m.lsx_tree_copy_xpath()}
              aria-label={m.lsx_tree_copy_xpath()}
            >
              {#if copiedPath}
                <Check size={10} />
              {:else}
                <Copy size={10} />
              {/if}
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .lsx-tree-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    font-size: 0.8rem;
    font-family: var(--th-font-mono, monospace);
  }

  .tree-toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: var(--th-bg-900);
    border-bottom: 1px solid var(--th-border-700);
    flex-shrink: 0;
  }

  .tree-search {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
    background: var(--th-bg-800);
    border: 1px solid var(--th-border-700);
    border-radius: 4px;
    padding: 2px 6px;
  }

  .tree-search-input {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--th-text-200);
    font-size: 0.75rem;
    outline: none;
  }

  .tree-tool-btn {
    padding: 2px 6px;
    border: none;
    background: transparent;
    color: var(--th-text-400);
    cursor: pointer;
    border-radius: 3px;
    font-size: 0.8rem;
    font-weight: bold;
  }

  .tree-tool-btn:hover {
    color: var(--th-text-200);
    background: var(--th-bg-700);
  }

  .tree-container {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
    outline: none;
  }

  .tree-node {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 4px;
    cursor: pointer;
    line-height: 1.5;
    white-space: nowrap;
  }

  .tree-node:hover {
    background: var(--th-bg-700);
  }

  .tree-node.focused {
    background: var(--th-bg-600);
    outline: 1px solid var(--th-accent-500);
  }

  .tree-toggle {
    display: flex;
    align-items: center;
    width: 14px;
    flex-shrink: 0;
    color: var(--th-text-500);
  }

  .tree-spacer {
    display: inline-block;
    width: 12px;
  }

  .tree-tag {
    color: var(--th-accent-400, #60a5fa);
    font-weight: 600;
  }

  .tree-attr {
    font-size: 0.7rem;
    color: var(--th-text-400);
  }

  .tree-attr-key {
    color: var(--th-text-300);
  }

  .tree-attr-val {
    color: var(--th-text-500);
  }

  .tree-attr-more {
    font-size: 0.65rem;
    color: var(--th-text-600);
    font-style: italic;
  }

  .tree-child-count {
    font-size: 0.7rem;
    color: var(--th-text-600);
    font-style: italic;
  }

  .tree-copy-btn {
    margin-left: auto;
    padding: 1px 4px;
    border: none;
    background: transparent;
    color: var(--th-text-600);
    cursor: pointer;
    border-radius: 3px;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .tree-node:hover .tree-copy-btn {
    opacity: 1;
  }

  .tree-copy-btn:hover {
    color: var(--th-text-200);
    background: var(--th-bg-600);
  }

  .tree-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 2rem;
  }
</style>
