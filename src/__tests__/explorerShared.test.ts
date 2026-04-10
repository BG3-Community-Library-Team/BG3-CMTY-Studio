/**
 * Tests for explorerShared.ts pure utility functions:
 * buildFileTree, filterTree, isScriptFile, getDefaultExtForPath,
 * detectSectionFromPath, getOsirisBadge, getSeContextBadge.
 */
import { describe, it, expect } from "vitest";
import {
  buildFileTree,
  filterTree,
  isScriptFile,
  getDefaultExtForPath,
  detectSectionFromPath,
  getOsirisBadge,
  getSeContextBadge,
  EXT_BADGE_COLORS,
  EXT_BADGE_FALLBACK,
  SCRIPT_MANAGED_ROOTS,
  SECTION_DEFAULT_EXT,
  TEMPLATE_EXT,
  sectionCategoryToDir,
} from "../components/explorer/explorerShared.js";
import type { ModFileEntry } from "../lib/utils/tauri.js";

// ── buildFileTree ───────────────────────────────────────────

describe("buildFileTree", () => {
  it("builds a tree from flat file entries", () => {
    const files: ModFileEntry[] = [
      { rel_path: "src/main.ts", extension: "ts", size: 0 },
      { rel_path: "src/lib/utils.ts", extension: "ts", size: 0 },
      { rel_path: "README.md", extension: "md", size: 0 },
    ];
    const tree = buildFileTree(files as any);
    // Root level: src/ and README.md
    expect(tree.length).toBe(2);
    const src = tree.find((n) => n.name === "src");
    expect(src).toBeTruthy();
    expect(src!.isFile).toBe(false);
  });

  it("returns empty array for no files", () => {
    expect(buildFileTree([])).toEqual([]);
  });

  it("sorts folders before files", () => {
    const files: ModFileEntry[] = [
      { rel_path: "b.txt", extension: "txt", size: 0 },
      { rel_path: "a/file.txt", extension: "txt", size: 0 },
    ];
    const tree = buildFileTree(files as any);
    expect(tree[0].isFile).toBe(false); // folder "a" first
    expect(tree[1].isFile).toBe(true);  // file "b.txt" second
  });

  it("ScriptExtender folder sorts before other folders", () => {
    const files: ModFileEntry[] = [
      { rel_path: "Zebra/a.txt", extension: "txt", size: 0 },
      { rel_path: "ScriptExtender/b.txt", extension: "txt", size: 0 },
    ];
    const tree = buildFileTree(files as any);
    expect(tree[0].name).toBe("ScriptExtender");
  });
});

// ── filterTree ──────────────────────────────────────────────

describe("filterTree (extension-based)", () => {
  it("filters files by extension and keeps parent folders", () => {
    const files: ModFileEntry[] = [
      { rel_path: "src/file.lua", extension: "lua", size: 0 },
      { rel_path: "src/file.txt", extension: "txt", size: 0 },
    ];
    const tree = buildFileTree(files as any);
    const filtered = filterTree(tree, new Set(["lua"]));
    const src = filtered.find((n) => n.name === "src");
    expect(src).toBeTruthy();
    expect(src!.children!.every((c) => c.extension === "lua")).toBe(true);
  });

  it("returns empty when no files match extension", () => {
    const files: ModFileEntry[] = [
      { rel_path: "src/file.txt", extension: "txt", size: 0 },
    ];
    const tree = buildFileTree(files as any);
    const filtered = filterTree(tree, new Set(["lua"]));
    expect(filtered).toEqual([]);
  });
});

// ── isScriptFile ────────────────────────────────────────────

describe("isScriptFile", () => {
  it("returns true for lua", () => expect(isScriptFile("lua")).toBe(true));
  it("returns true for khn", () => expect(isScriptFile("khn")).toBe(true));
  it("returns true for anc", () => expect(isScriptFile("anc")).toBe(true));
  it("returns true for json", () => expect(isScriptFile("json")).toBe(true));
  it("returns false for md", () => expect(isScriptFile("md")).toBe(false));
  it("returns false for undefined", () => expect(isScriptFile(undefined)).toBe(false));
  it("returns false for empty string", () => expect(isScriptFile("")).toBe(false));
  it("is case-insensitive", () => expect(isScriptFile("LUA")).toBe(true));
});

// ── getDefaultExtForPath ────────────────────────────────────

describe("getDefaultExtForPath", () => {
  it("returns .lua for ScriptExtender paths", () => {
    expect(getDefaultExtForPath("ScriptExtender/Lua/Server")).toBe(".lua");
  });
  it("returns .txt for Story/RawFiles/Goals paths", () => {
    expect(getDefaultExtForPath("Story/RawFiles/Goals")).toBe(".txt");
  });
  it("returns .xml for Localization paths", () => {
    expect(getDefaultExtForPath("Localization/English")).toBe(".xml");
  });
  it("returns .anc for Scripts/anubis paths", () => {
    expect(getDefaultExtForPath("Scripts/anubis")).toBe(".anc");
  });
  it("returns .clc for Scripts/constellations paths", () => {
    expect(getDefaultExtForPath("Scripts/constellations")).toBe(".clc");
  });
  it("returns .khn for generic Scripts paths", () => {
    expect(getDefaultExtForPath("Scripts/something")).toBe(".khn");
  });
  it("returns null for unknown paths", () => {
    expect(getDefaultExtForPath("data/models")).toBeNull();
  });
});

// ── detectSectionFromPath ───────────────────────────────────

describe("detectSectionFromPath", () => {
  it("detects lua-se for ScriptExtender paths", () => {
    expect(detectSectionFromPath("ScriptExtender/Lua/Server/main.lua")).toBe("lua-se");
  });
  it("detects osiris for Story/RawFiles/Goals paths", () => {
    expect(detectSectionFromPath("Story/RawFiles/Goals/MyGoal.txt")).toBe("osiris");
  });
  it("detects anubis for Scripts/anubis paths", () => {
    expect(detectSectionFromPath("Scripts/anubis/test.anc")).toBe("anubis");
  });
  it("detects constellations for Scripts/constellations paths", () => {
    expect(detectSectionFromPath("Scripts/constellations/test.clc")).toBe("constellations");
  });
  it("detects khonsu for Scripts/thoth/helpers paths", () => {
    expect(detectSectionFromPath("Scripts/thoth/helpers/helper.khn")).toBe("khonsu");
  });
  it("returns null for unrecognized paths", () => {
    expect(detectSectionFromPath("data/models/mesh.obj")).toBeNull();
  });
});

// ── getOsirisBadge ──────────────────────────────────────────

describe("getOsirisBadge", () => {
  it("returns badge for .txt in Story/RawFiles/Goals", () => {
    const badge = getOsirisBadge("Story/RawFiles/Goals/MyGoal.txt", "txt");
    expect(badge).toEqual({ label: "osi", color: "var(--th-badge-osiris)" });
  });
  it("returns null for non-txt extension", () => {
    expect(getOsirisBadge("Story/RawFiles/Goals/MyGoal.lua", "lua")).toBeNull();
  });
  it("returns null for .txt outside Goals", () => {
    expect(getOsirisBadge("notes/readme.txt", "txt")).toBeNull();
  });
  it("handles backslashes in path", () => {
    const badge = getOsirisBadge("Story\\RawFiles\\Goals\\Test.txt", "txt");
    expect(badge).toEqual({ label: "osi", color: "var(--th-badge-osiris)" });
  });
});

// ── getSeContextBadge ───────────────────────────────────────

describe("getSeContextBadge", () => {
  it("returns SRV badge for Server context", () => {
    expect(getSeContextBadge("ScriptExtender/Lua/Server/init.lua")).toEqual({
      label: "SRV",
      color: "var(--th-badge-server, var(--th-accent-500))",
    });
  });
  it("returns CLI badge for Client context", () => {
    expect(getSeContextBadge("ScriptExtender/Lua/Client/ui.lua")).toEqual({
      label: "CLI",
      color: "var(--th-badge-client, var(--th-accent-300))",
    });
  });
  it("returns SHR badge for Shared context", () => {
    expect(getSeContextBadge("ScriptExtender/Lua/Shared/utils.lua")).toEqual({
      label: "SHR",
      color: "var(--th-badge-shared, var(--th-warning-500))",
    });
  });
  it("returns null for non-SE paths", () => {
    expect(getSeContextBadge("Scripts/test.lua")).toBeNull();
  });
  it("returns null when SE path has no Lua subfolder", () => {
    expect(getSeContextBadge("ScriptExtender/Config/test.json")).toBeNull();
  });
});

// ── sectionCategoryToDir ────────────────────────────────────

describe("sectionCategoryToDir", () => {
  it("returns correct dir for osiris", () => {
    expect(sectionCategoryToDir("osiris")).toBe("Story/RawFiles/Goals");
  });
  it("returns correct dir for khonsu", () => {
    expect(sectionCategoryToDir("khonsu")).toBe("Scripts/thoth/helpers");
  });
  it("returns correct dir for anubis", () => {
    expect(sectionCategoryToDir("anubis")).toBe("Scripts/anubis");
  });
  it("returns correct dir for constellations", () => {
    expect(sectionCategoryToDir("constellations")).toBe("Scripts/constellations");
  });
  it("defaults to ScriptExtender/Lua for unknown or null", () => {
    expect(sectionCategoryToDir(null)).toBe("ScriptExtender/Lua");
    expect(sectionCategoryToDir("unknown")).toBe("ScriptExtender/Lua");
  });
});

// ── Constants ───────────────────────────────────────────────

describe("constants", () => {
  it("EXT_BADGE_COLORS has yaml/yml entries", () => {
    expect(EXT_BADGE_COLORS["yaml"]).toBeDefined();
    expect(EXT_BADGE_COLORS["yml"]).toBeDefined();
  });
  it("EXT_BADGE_FALLBACK is defined", () => {
    expect(EXT_BADGE_FALLBACK).toBe("var(--th-badge-fallback)");
  });
  it("SCRIPT_MANAGED_ROOTS contains expected roots", () => {
    expect(SCRIPT_MANAGED_ROOTS.has("ScriptExtender")).toBe(true);
    expect(SCRIPT_MANAGED_ROOTS.has("Scripts")).toBe(true);
    expect(SCRIPT_MANAGED_ROOTS.has("Story")).toBe(true);
  });
  it("SECTION_DEFAULT_EXT matches expected extensions", () => {
    expect(SECTION_DEFAULT_EXT["lua-se"]).toBe(".lua");
    expect(SECTION_DEFAULT_EXT["osiris"]).toBe(".txt");
  });
  it("TEMPLATE_EXT has overrides", () => {
    expect(TEMPLATE_EXT["se_config"]).toBe(".json");
  });
});
