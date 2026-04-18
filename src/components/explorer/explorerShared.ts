/**
 * Shared types, constants, and utility functions for the Explorer sub-components.
 * Extracted from the FileExplorer monolith to avoid duplication.
 */
import { localeCompare } from "../../lib/utils/localeSort.js";
import { fuzzyScore } from "../../lib/utils/fuzzyScore.js";
import type { ModFileEntry } from "../../lib/utils/tauri.js";

// ── File Tree Types ──

/** A node in the mod file tree. */
export interface FileTreeNode {
  name: string;
  relPath: string;
  extension?: string;
  children?: FileTreeNode[];
  isFile: boolean;
}

// ── File type badge colors ──

export const EXT_BADGE_COLORS: Record<string, string> = {
  yaml: "var(--th-badge-yaml)", yml: "var(--th-badge-yaml)",
  json: "var(--th-badge-json)",
  lua: "var(--th-badge-lua)",
  md: "var(--th-badge-md)",
  txt: "var(--th-badge-txt)",
  xml: "var(--th-badge-xml)",
  xaml: "var(--th-badge-xml)",
  cfg: "var(--th-badge-cfg)",
  khn: "var(--th-badge-khn)",
  anc: "var(--th-badge-anubis)", ann: "var(--th-badge-anubis)", anm: "var(--th-badge-anubis)",
  clc: "var(--th-badge-constellations)", cln: "var(--th-badge-constellations)", clm: "var(--th-badge-constellations)",
};
export const EXT_BADGE_FALLBACK = "var(--th-badge-fallback)";

// ── Badge helpers ──

/** Detect if a file is an Osiris goal (*.txt under Story/RawFiles/Goals/) */
export function getOsirisBadge(relPath: string, ext?: string): { label: string; color: string } | null {
  if (ext !== 'txt') return null;
  const normalized = relPath.replace(/\\/g, '/');
  if (normalized.includes('Story/RawFiles/Goals')) {
    return { label: 'osi', color: 'var(--th-badge-osiris)' };
  }
  return null;
}

/** SE context detection for files under ScriptExtender/Lua/{Server|Client|Shared} */
export function getSeContextBadge(path: string): { label: string; color: string } | null {
  const parts = path.split('/');
  const seIdx = parts.indexOf('ScriptExtender');
  if (seIdx < 0) return null;
  const luaIdx = parts.indexOf('Lua', seIdx);
  if (luaIdx < 0) return null;
  const ctx = parts[luaIdx + 1];
  if (ctx === 'Server') return { label: 'SRV', color: 'var(--th-badge-server, var(--th-accent-500))' };
  if (ctx === 'Client') return { label: 'CLI', color: 'var(--th-badge-client, var(--th-accent-300))' };
  if (ctx === 'Shared') return { label: 'SHR', color: 'var(--th-badge-shared, var(--th-warning-500))' };
  return null;
}

// ── Script file type ──

const SCRIPT_EXTENSIONS = new Set(["lua", "khn", "anc", "ann", "anm", "clc", "cln", "clm", "json", "xaml"]);

/** Check if a file extension is a script type that opens in the editor */
export function isScriptFile(ext?: string): boolean {
  return !!ext && SCRIPT_EXTENSIONS.has(ext.toLowerCase());
}

// ── File tree building ──

/** Build a tree structure from flat ModFileEntry paths. */
export function buildFileTree(files: ModFileEntry[]): FileTreeNode[] {
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

  function sortTree(nodes: FileTreeNode[]) {
    nodes.sort((a, b) => {
      if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
      if (!a.isFile && !b.isFile) {
        if (a.name === 'ScriptExtender') return -1;
        if (b.name === 'ScriptExtender') return 1;
      }
      return localeCompare(a.name, b.name);
    });
    for (const n of nodes) {
      if (n.children) sortTree(n.children);
    }
  }
  if (root.children) sortTree(root.children);
  return root.children ?? [];
}

/** Filter a file tree to only include files with certain extensions (and parent folders). */
export function filterTree(nodes: FileTreeNode[], extensions: Set<string>): FileTreeNode[] {
  const result: FileTreeNode[] = [];
  for (const n of nodes) {
    if (n.isFile) {
      if (n.extension && extensions.has(n.extension)) {
        result.push(n);
      }
    } else if (n.children) {
      const filtered = filterTree(n.children, extensions);
      if (filtered.length > 0) {
        result.push({ ...n, children: filtered });
      }
    }
  }
  return result;
}

// ── Zoom helper ──

/** Walk up the DOM to find the effective CSS zoom factor. */
export function getComputedZoom(el: HTMLElement): number {
  let zoom = 1;
  let current: HTMLElement | null = el;
  while (current) {
    const z = parseFloat(getComputedStyle(current).zoom || '1');
    if (z && z !== 1) zoom *= z;
    current = current.parentElement;
  }
  return zoom;
}

// ── Path helpers ──

/** Determine default file extension based on parent directory context. */
export function getDefaultExtForPath(parentPath: string): string | null {
  const normalized = parentPath.replace(/\\/g, '/');
  if (normalized.includes('Scripts/anubis')) return '.anc';
  if (normalized.includes('Scripts/constellations')) return '.clc';
  if (normalized.startsWith('Story/RawFiles/Goals') || normalized.includes('/Story/RawFiles/Goals')) return '.txt';
  if (normalized.startsWith('Localization') || normalized.includes('/Localization')) return '.xml';
  if (normalized.startsWith('Scripts') || normalized.includes('/Scripts')) return '.khn';
  if (normalized.startsWith('ScriptExtender') || normalized.includes('/ScriptExtender')) return '.lua';
  return null;
}

export function detectSectionFromPath(relPath: string): string | null {
  if (relPath.startsWith('ScriptExtender') || relPath.includes('/ScriptExtender/')) return 'lua-se';
  if (relPath.startsWith('Story/RawFiles/Goals') || relPath.includes('/Story/RawFiles/Goals')) return 'osiris';
  if (relPath.startsWith('Scripts/anubis') || relPath.includes('/Scripts/anubis')) return 'anubis';
  if (relPath.startsWith('Scripts/constellations') || relPath.includes('/Scripts/constellations')) return 'constellations';
  if (relPath.startsWith('Scripts/thoth/helpers') || relPath.includes('/Scripts/thoth/helpers')) return 'khonsu';
  return null;
}

/** Folders managed by the Scripts tree — hidden from Mod Files to avoid duplication */
export const SCRIPT_MANAGED_ROOTS = new Set(['ScriptExtender', 'Scripts', 'Story']);

// ── Extension sets ──

export const LOCA_EXTENSIONS = new Set(["loca", "xml"]);
export const LUA_SE_EXTENSIONS = new Set(["lua", "yaml", "toml", "ini", "json"]);

/** Script sub-categories derived from the mod file tree. */
export const SCRIPT_CATEGORIES = [
  { key: "lua-se", label: "Lua (SE)", dir: "ScriptExtender", extensions: LUA_SE_EXTENSIONS },
  { key: "osiris", label: "Osiris", dir: "Story/RawFiles/Goals", extensions: new Set(["txt"]) },
  { key: "khonsu", label: "Khonsu", dir: "Scripts/thoth/helpers", extensions: new Set(["khn"]) },
  { key: "anubis", label: "Anubis", dir: "Scripts/anubis", extensions: new Set(["anc", "ann", "anm"]) },
  { key: "constellations", label: "Constellations", dir: "Scripts/constellations", extensions: new Set(["clc", "cln", "clm"]) },
] as const;

/** Context-aware templates per section */
export const SECTION_TEMPLATES: Record<string, Array<{ id: string; label: string }>> = {
  'lua-se': [
    { id: 'lua_empty', label: 'Empty Lua' },
    { id: 'lua_se_server_module', label: 'Server Module' },
    { id: 'lua_se_client_module', label: 'Client Module' },
    { id: 'lua_se_shared_module', label: 'Shared Module' },
    { id: 'se_bootstrap_server', label: 'Bootstrap Server' },
    { id: 'se_bootstrap_client', label: 'Bootstrap Client' },
    { id: 'se_config', label: 'SE Config' },
  ],
  'osiris': [
    { id: 'osiris_basic_goal', label: 'Basic Goal' },
    { id: 'osiris_state_machine', label: 'State Machine' },
    { id: 'osiris_quest_goal', label: 'Quest Goal' },
  ],
  'khonsu': [
    { id: 'khonsu_basic_condition', label: 'Basic Condition' },
    { id: 'khonsu_context_condition', label: 'Context Condition' },
  ],
  'anubis': [
    { id: 'anubis_config', label: 'Anubis Config' },
    { id: 'anubis_state', label: 'Anubis State' },
    { id: 'anubis_module', label: 'Anubis Module' },
  ],
  'constellations': [
    { id: 'constellations_config', label: 'Constellations Config' },
    { id: 'constellations_state', label: 'Constellations State' },
    { id: 'constellations_module', label: 'Constellations Module' },
  ],
};

// ── Explorer filter store ──

export { explorerFilter, type FilterMode } from "./explorerFilterStore.svelte.js";

export interface FilterMatch {
  matched: boolean;
  indices: number[];
}

/** Check if a text string matches the current filter query. */
export function matchesFilter(text: string, query: string, useFuzzy: boolean): FilterMatch {
  if (!query) return { matched: true, indices: [] };
  if (useFuzzy) {
    const result = fuzzyScore(query, text);
    return result ? { matched: true, indices: result.matches } : { matched: false, indices: [] };
  }
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerText.indexOf(lowerQuery);
  if (idx < 0) return { matched: false, indices: [] };
  const indices: number[] = [];
  for (let i = idx; i < idx + lowerQuery.length; i++) indices.push(i);
  return { matched: true, indices };
}

/** Filter a file tree to only nodes matching the query (and their parent chain). */
export function filterSearchTree(nodes: FileTreeNode[], query: string, useFuzzy: boolean): FileTreeNode[] {
  if (!query) return nodes;
  const result: FileTreeNode[] = [];
  for (const node of nodes) {
    const selfMatch = matchesFilter(node.name, query, useFuzzy).matched;
    if (node.isFile) {
      if (selfMatch) result.push(node);
    } else {
      const filteredChildren = node.children ? filterSearchTree(node.children, query, useFuzzy) : [];
      if (selfMatch || filteredChildren.length > 0) {
        result.push({ ...node, children: filteredChildren.length > 0 ? filteredChildren : node.children });
      }
    }
  }
  return result;
}

/** Count matching files in a file tree. */
export function countFileTreeMatches(nodes: FileTreeNode[], query: string, useFuzzy: boolean): number {
  if (!query) return 0;
  let count = 0;
  for (const node of nodes) {
    if (matchesFilter(node.name, query, useFuzzy).matched) count++;
    if (node.children) count += countFileTreeMatches(node.children, query, useFuzzy);
  }
  return count;
}

/** Check if a FolderNode or any descendant matches the filter. */
export function folderNodeHasMatch(
  node: { label: string; children?: { label: string; children?: any[] }[] },
  query: string,
  useFuzzy: boolean,
): boolean {
  if (matchesFilter(node.label, query, useFuzzy).matched) return true;
  if (node.children) return node.children.some(c => folderNodeHasMatch(c, query, useFuzzy));
  return false;
}

/** Count matching descendants in a FolderNode tree. */
export function countFolderNodeMatches(
  node: { label: string; children?: { label: string; children?: any[] }[] },
  query: string,
  useFuzzy: boolean,
): number {
  let count = matchesFilter(node.label, query, useFuzzy).matched ? 1 : 0;
  if (node.children) for (const c of node.children) count += countFolderNodeMatches(c, query, useFuzzy);
  return count;
}

/** Default file extensions per section for template creation */
export const SECTION_DEFAULT_EXT: Record<string, string> = {
  'lua-se': '.lua',
  'osiris': '.txt',
  'khonsu': '.khn',
  'anubis': '.anc',
  'constellations': '.clc',
  'localization': '.xml',
};

/** Per-template extension overrides (where template ext differs from section default) */
export const TEMPLATE_EXT: Record<string, string> = {
  'se_config': '.json',
  'anubis_state': '.ann',
  'anubis_module': '.anm',
  'constellations_state': '.cln',
  'constellations_module': '.clm',
};

/** Map from section category to the parent dir used for inline create */
export function sectionCategoryToDir(sectionCategory: string | null): string {
  switch (sectionCategory) {
    case 'osiris': return 'Story/RawFiles/Goals';
    case 'khonsu': return 'Scripts/thoth/helpers';
    case 'anubis': return 'Scripts/anubis';
    case 'constellations': return 'Scripts/constellations';
    default: return 'ScriptExtender/Lua';
  }
}
