/**
 * Tests for explorer filter matching, tree filtering, and match counting.
 * Exercises matchesFilter, filterSearchTree, countFileTreeMatches,
 * folderNodeHasMatch, and countFolderNodeMatches from explorerShared.ts.
 */
import { describe, it, expect } from "vitest";
import {
  matchesFilter,
  filterSearchTree,
  countFileTreeMatches,
  folderNodeHasMatch,
  countFolderNodeMatches,
  type FileTreeNode,
} from "../components/explorer/explorerShared.js";

// ── Helpers ──────────────────────────────────────────────────

function makeFile(name: string, relPath?: string, ext?: string): FileTreeNode {
  return { name, relPath: relPath ?? name, isFile: true, extension: ext };
}

function makeDir(name: string, children: FileTreeNode[]): FileTreeNode {
  return { name, relPath: name, isFile: false, children };
}

// ── matchesFilter ───────────────────────────────────────────

describe("matchesFilter", () => {
  it("empty query matches everything", () => {
    const result = matchesFilter("anything", "", false);
    expect(result.matched).toBe(true);
    expect(result.indices).toEqual([]);
  });

  it("exact substring match (case-insensitive)", () => {
    const result = matchesFilter("MyComponent.svelte", "comp", false);
    expect(result.matched).toBe(true);
    expect(result.indices.length).toBeGreaterThan(0);
  });

  it("case-insensitive matching", () => {
    const result = matchesFilter("README.md", "readme", false);
    expect(result.matched).toBe(true);
  });

  it("no match returns matched=false", () => {
    const result = matchesFilter("package.json", "svelte", false);
    expect(result.matched).toBe(false);
    expect(result.indices).toEqual([]);
  });

  it("fuzzy match (characters in order)", () => {
    const result = matchesFilter("FileExplorer.svelte", "fexp", true);
    expect(result.matched).toBe(true);
    expect(result.indices.length).toBeGreaterThan(0);
  });

  it("fuzzy no match", () => {
    const result = matchesFilter("abc", "xyz", true);
    expect(result.matched).toBe(false);
  });

  it("substring match returns correct indices range", () => {
    const result = matchesFilter("hello world", "world", false);
    expect(result.matched).toBe(true);
    expect(result.indices).toEqual([6, 7, 8, 9, 10]);
  });
});

// ── filterSearchTree ────────────────────────────────────────

describe("filterSearchTree", () => {
  const tree: FileTreeNode[] = [
    makeDir("src", [
      makeFile("App.svelte", "src/App.svelte", "svelte"),
      makeFile("main.ts", "src/main.ts", "ts"),
      makeDir("lib", [
        makeFile("utils.ts", "src/lib/utils.ts", "ts"),
        makeFile("stores.ts", "src/lib/stores.ts", "ts"),
      ]),
    ]),
    makeDir("public", [
      makeFile("index.html", "public/index.html", "html"),
    ]),
    makeFile("package.json", "package.json", "json"),
  ];

  it("returns full tree when query is empty", () => {
    const result = filterSearchTree(tree, "", false);
    expect(result).toEqual(tree);
  });

  it("filters tree keeping matching files and parent chain", () => {
    const result = filterSearchTree(tree, "utils", false);
    // Should keep src > lib > utils.ts
    expect(result.length).toBeGreaterThanOrEqual(1);
    const srcNode = result.find((n) => n.name === "src");
    expect(srcNode).toBeTruthy();
    const libNode = srcNode!.children?.find((n) => n.name === "lib");
    expect(libNode).toBeTruthy();
    const utilsNode = libNode!.children?.find((n) => n.name === "utils.ts");
    expect(utilsNode).toBeTruthy();
  });

  it("no matches returns empty array", () => {
    const result = filterSearchTree(tree, "nonexistent-file-xyz", false);
    expect(result).toEqual([]);
  });

  it("deep match preserves all ancestors", () => {
    const result = filterSearchTree(tree, "stores", false);
    const srcNode = result.find((n) => n.name === "src");
    expect(srcNode).toBeDefined();
    const libNode = srcNode!.children?.find((n) => n.name === "lib");
    expect(libNode).toBeDefined();
  });

  it("matches folder name includes its children", () => {
    const result = filterSearchTree(tree, "lib", false);
    const srcNode = result.find((n) => n.name === "src");
    expect(srcNode).toBeTruthy();
    // When the folder itself matches, children are included
    const libNode = srcNode!.children?.find((n) => n.name === "lib");
    expect(libNode).toBeTruthy();
    expect(libNode!.children!.length).toBeGreaterThan(0);
  });

  it("matches root-level file", () => {
    const result = filterSearchTree(tree, "package", false);
    expect(result.find((n) => n.name === "package.json")).toBeTruthy();
  });

  it("fuzzy filtering works", () => {
    const result = filterSearchTree(tree, "uts", true);
    // Should fuzzy-match "utils.ts"
    expect(result.length).toBeGreaterThan(0);
  });
});

// ── countFileTreeMatches ────────────────────────────────────

describe("countFileTreeMatches", () => {
  const tree: FileTreeNode[] = [
    makeDir("src", [
      makeFile("App.svelte", "src/App.svelte", "svelte"),
      makeFile("main.ts", "src/main.ts", "ts"),
    ]),
    makeFile("README.md", "README.md", "md"),
  ];

  it("returns 0 for empty query", () => {
    expect(countFileTreeMatches(tree, "", false)).toBe(0);
  });

  it("counts matching files in flat tree", () => {
    // "m" matches src (folder), main.ts, README.md
    const count = countFileTreeMatches(tree, "main", false);
    expect(count).toBe(1);
  });

  it("counts matches in nested tree", () => {
    // "a" matches src, App.svelte, main.ts, README.md
    const count = countFileTreeMatches(tree, "a", false);
    expect(count).toBeGreaterThan(0);
  });

  it("returns 0 when nothing matches", () => {
    expect(countFileTreeMatches(tree, "zzzznothing", false)).toBe(0);
  });

  it("counts directory name matches too", () => {
    const count = countFileTreeMatches(tree, "src", false);
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

// ── folderNodeHasMatch ──────────────────────────────────────

describe("folderNodeHasMatch", () => {
  const folderTree = {
    label: "Races",
    children: [
      { label: "Human", children: [{ label: "Subrace A" }] },
      { label: "Elf" },
    ],
  };

  it("matches the root label", () => {
    expect(folderNodeHasMatch(folderTree, "Races", false)).toBe(true);
  });

  it("matches a direct child label", () => {
    expect(folderNodeHasMatch(folderTree, "Elf", false)).toBe(true);
  });

  it("matches a deeply nested child", () => {
    expect(folderNodeHasMatch(folderTree, "Subrace", false)).toBe(true);
  });

  it("returns false when nothing matches", () => {
    expect(folderNodeHasMatch(folderTree, "Dwarf", false)).toBe(false);
  });

  it("handles node without children", () => {
    expect(folderNodeHasMatch({ label: "Leaf" }, "Leaf", false)).toBe(true);
    expect(folderNodeHasMatch({ label: "Leaf" }, "Other", false)).toBe(false);
  });
});

// ── countFolderNodeMatches ──────────────────────────────────

describe("countFolderNodeMatches", () => {
  const folderTree = {
    label: "Classes",
    children: [
      { label: "Wizard" },
      { label: "Cleric", children: [{ label: "Life Domain" }, { label: "Light Domain" }] },
    ],
  };

  it("counts root match", () => {
    const count = countFolderNodeMatches(folderTree, "Classes", false);
    expect(count).toBe(1);
  });

  it("counts nested matches", () => {
    // "Domain" matches "Life Domain" and "Light Domain"
    const count = countFolderNodeMatches(folderTree, "Domain", false);
    expect(count).toBe(2);
  });

  it("returns 0 when nothing matches", () => {
    expect(countFolderNodeMatches(folderTree, "Rogue", false)).toBe(0);
  });

  it("counts all matches across the tree", () => {
    // "l" appears in "Classes", "Cleric", "Life Domain", "Light Domain"
    const count = countFolderNodeMatches(folderTree, "l", false);
    expect(count).toBeGreaterThanOrEqual(3);
  });

  it("handles leaf node", () => {
    expect(countFolderNodeMatches({ label: "Solo" }, "Solo", false)).toBe(1);
    expect(countFolderNodeMatches({ label: "Solo" }, "Other", false)).toBe(0);
  });
});
