import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/tauri/readme.js", () => ({
  listFilesByExt: vi.fn(),
  readTextFile: vi.fn(),
}));

vi.mock("../lib/stores/projectStore.svelte.js", () => ({
  projectStore: {
    loadSection: vi.fn(),
    sections: [],
  },
}));

vi.mock("../lib/tauri/lsx-export.js", () => ({
  previewLsx: vi.fn(),
}));

const { APP_NAME, APP_VERSION } = await import("../lib/version.js");
const { SECTION_HINTS } = await import("../lib/data/sectionHints.js");
const { markdownToBBCode } = await import("../lib/utils/bbcodeConverter.js");
const { PreviewWorkerClient } = await import("../lib/utils/previewWorkerClient.js");
const { createFormState } = await import("../lib/utils/useFormState.svelte.js");
const { modSelectionService } = await import("../lib/services/modSelectionService.svelte.js");
const { commandRegistry } = await import("../lib/utils/commandRegistry.svelte.js");
const { gitStore } = await import("../lib/stores/gitStore.svelte.js");
const { modStore } = await import("../lib/stores/modStore.svelte.js");
const { uiStore } = await import("../lib/stores/uiStore.svelte.js");
const { registerGitCommands, registerDynamicBranchCommands, unregisterGitCommands } = await import("../lib/plugins/gitCommands.svelte.js");
const { seApiPlugin } = await import("../lib/plugins/seApiPlugin.js");
const { loadIdeHelpers, reloadIdeHelpers, ideHelpersPlugin } = await import("../lib/plugins/ideHelpersPlugin.js");
const { extractPrefix, getCompletions } = await import("../lib/utils/luaCompletions.js");
const { completionRegistry } = await import("../lib/plugins/index.js");
const tauriUtils = await import("../lib/utils/tauri.js");
const { entryRowToLsxPreview, generateStagingPreview } = await import("../lib/utils/previewAdapter.js");
const { listFilesByExt, readTextFile } = await import("../lib/tauri/readme.js");
const { projectStore } = await import("../lib/stores/projectStore.svelte.js");
const { previewLsx } = await import("../lib/tauri/lsx-export.js");

describe("Coverage gap regression tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    commandRegistry.commands = [];
    commandRegistry.recentIds = [];
    gitStore.isRepo = false;
    gitStore.branches = [];
    gitStore.commits = [];
    modStore.projectPath = "";
    modStore.selectedModPath = "";
    uiStore.activeView = "explorer";
    modSelectionService.cancel();
    (projectStore.loadSection as ReturnType<typeof vi.fn>).mockReset();
    (previewLsx as ReturnType<typeof vi.fn>).mockReset();
    (listFilesByExt as ReturnType<typeof vi.fn>).mockReset();
    (readTextFile as ReturnType<typeof vi.fn>).mockReset();
    projectStore.sections = [];
  });

  it("exports app version constants", () => {
    expect(APP_NAME).toBe("BG3 CMTY Studio");
    expect(APP_VERSION).toContain("ALPHA");
  });

  it("exposes section hints for major schema-driven sections", () => {
    expect(SECTION_HINTS.CharacterCreationPresets?.guidReferences?.RaceUUID).toBe("section:Races");
    expect(SECTION_HINTS.ColorDefinitions?.fieldGroups?.["Color Values"]).toContain("Color1");
  });

  it("converts markdown to bbcode across common constructs", () => {
    const bbcode = markdownToBBCode([
      "# Heading",
      "**bold** and *italic* and ~~gone~~",
      "[link](https://example.com)",
      "![img](https://example.com/a.png)",
      "- item one",
      "1. first",
      "> quoted",
      "```lua\nprint('hi')\n```",
      "---",
    ].join("\n"));

    expect(bbcode).toContain("[size=5][b]Heading[/b][/size]");
    expect(bbcode).toContain("[b]bold[/b]");
    expect(bbcode).toContain("[i]italic[/i]");
    expect(bbcode).toContain("[s]gone[/s]");
    expect(bbcode).toContain("[url=https://example.com]link[/url]");
    expect(bbcode).toContain("[img]https://example.com/a.png[/img]");
    expect(bbcode).toContain("[quote]quoted[/quote]");
    expect(bbcode).toContain("[code]print('hi')\n[/code]");
    expect(bbcode).toContain("[line]");
  });

  it("supports form state dirty/save/cancel and derived validation flags", () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    const formState = createFormState({
      validate: () => [
        { key: "warn", message: "warn", severity: "warning" },
        { key: "err", message: "err", severity: "error" },
      ],
      onSave,
      onCancel,
    });

    expect(formState.dirty).toBe(false);
    expect(formState.hasWarnings).toBe(true);
    expect(formState.hasErrors).toBe(true);
    formState.markDirty();
    expect(formState.dirty).toBe(true);
    formState.save({ ok: true });
    expect(onSave).toHaveBeenCalledWith({ ok: true });
    expect(formState.dirty).toBe(false);
    formState.cancel();
    expect(onCancel).toHaveBeenCalled();
  });

  it("resolves mod selection via select and cancel", async () => {
    const modA = { mod_path: "A", folder: "A", name: "Mod A", uuid: "1" };
    const modB = { mod_path: "B", folder: "B", name: "Mod B", uuid: "2" };

    const pending = modSelectionService.prompt([modA as any, modB as any]);
    expect(modSelectionService.isOpen).toBe(true);
    modSelectionService.select(modB as any);
    await expect(pending).resolves.toEqual(modB);
    expect(modSelectionService.isOpen).toBe(false);

    const cancelled = modSelectionService.prompt([modA as any]);
    modSelectionService.cancel();
    await expect(cancelled).resolves.toBeNull();
  });

  it("registers static and dynamic git palette commands", () => {
    gitStore.isRepo = true;
    gitStore.branches = [
      { name: "main", isRemote: false, isCurrent: true, ahead: 0, behind: 0 },
      { name: "feature", isRemote: false, isCurrent: false, ahead: 1, behind: 0 },
      { name: "origin/feature", isRemote: true, isCurrent: false, ahead: 0, behind: 0 },
    ] as any;
    gitStore.commits = [
      { oid: "abcdef123456", message: "Commit one" },
      { oid: "fedcba654321", message: "Commit two" },
    ] as any;
    modStore.projectPath = "H:/repo";

    registerGitCommands();
    registerDynamicBranchCommands();

    const ids = commandRegistry.getAll().map((cmd) => cmd.id);
    expect(ids).toContain("git:switchBranch");
    expect(ids).toContain("git:createBranch");
    expect(ids).toContain("git:branch/feature");
    expect(ids).toContain("git:delete/feature");
    expect(ids).toContain("git:branch/commit:abcdef123456");

    unregisterGitCommands();
    expect(commandRegistry.getAll().some((cmd) => cmd.id.startsWith("git:"))).toBe(false);
  });

  it("returns Script Extender completions for Ext, Osi, globals, and listener contexts", () => {
    expect(seApiPlugin.getCompletions({ typedPrefix: "Ext.Uti", lineTextBeforeCursor: "Ext.Uti", language: "lua" } as any)
      .some((item) => item.label === "Ext.Utils.Print")).toBe(true);
    expect(seApiPlugin.getCompletions({ typedPrefix: "Osi.Get", lineTextBeforeCursor: "Osi.Get", language: "lua" } as any)
      .some((item) => item.label === "Osi.GetHostCharacter")).toBe(true);
    expect(seApiPlugin.getCompletions({ typedPrefix: "Mo", lineTextBeforeCursor: "Mo", language: "lua" } as any)
      .some((item) => item.label === "ModuleUUID")).toBe(true);
    expect(seApiPlugin.getCompletions({ typedPrefix: "X", lineTextBeforeCursor: "Ext.Osiris.RegisterListener(\"", language: "lua" } as any).length).toBeGreaterThan(0);
  });

  it("loads IDE helper completions from Lua helper files", async () => {
    (listFilesByExt as ReturnType<typeof vi.fn>).mockResolvedValue(["a.lua", "b.lua"]);
    (readTextFile as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce("function Helper.DoThing() end\nGLOBAL_NAME = 1\nTable.Field = true\nlocal Module = {}")
      .mockResolvedValueOnce("function Helper.DoOther() end");

    await loadIdeHelpers("helpers");

    const results = ideHelpersPlugin.getCompletions({
      typedPrefix: "Helper.Do",
      lineTextBeforeCursor: "Helper.Do",
      language: "lua",
    } as any);
    expect(results.map((item) => item.label)).toContain("Helper.DoThing");
    expect(results.map((item) => item.label)).toContain("Helper.DoOther");

    await reloadIdeHelpers("helpers");
    expect(listFilesByExt).toHaveBeenCalledTimes(2);
  });

  it("extracts Lua completion prefixes and skips comments", () => {
    expect(extractPrefix("local x = Ext.Utils.Pr")).toBe("Ext.Utils.Pr");
    expect(getCompletions("-- Ext.Utils.Pr")).toEqual([]);
    expect(getCompletions("Ext.Utils.Pr").some((item) => item.label === "Ext.Utils.Print")).toBe(true);
    expect(completionRegistry.getRegisteredPlugins().length).toBeGreaterThan(0);
  });

  it("re-exports tauri helpers through the utils barrel", () => {
    expect(typeof tauriUtils.revealPath).toBe("function");
  });

  it("converts entry rows into preview entries while stripping meta columns", () => {
    const previewEntry = entryRowToLsxPreview({
      _pk: "uuid-1",
      _is_new: 1,
      Name: "Entry",
      Amount: 7,
      _table: "Races",
    } as any, "Race");

    expect(previewEntry).toEqual({
      uuid: "uuid-1",
      node_id: "Race",
      raw_attributes: { Name: "Entry", Amount: "7" },
      raw_attribute_types: {},
      raw_children: {},
    });
  });

  it("builds staging previews from active rows and summary metadata", async () => {
    (projectStore.loadSection as ReturnType<typeof vi.fn>).mockResolvedValue([
      { _pk: "1", DisplayName: "One", _is_deleted: 0 },
      { _pk: "2", DisplayName: "Two", _is_deleted: 1 },
    ]);
    projectStore.sections = [{ table_name: "Races", node_id: "Race", region_id: "Races" }] as any;
    (previewLsx as ReturnType<typeof vi.fn>).mockResolvedValue("<lsx />");

    await expect(generateStagingPreview("Races")).resolves.toBe("<lsx />");
    expect(previewLsx).toHaveBeenCalledWith([
      {
        uuid: "1",
        node_id: "Race",
        raw_attributes: { DisplayName: "One" },
        raw_attribute_types: {},
        raw_children: {},
      },
    ], "Races");
  });

  it("returns empty staging preview when no active rows remain", async () => {
    (projectStore.loadSection as ReturnType<typeof vi.fn>).mockResolvedValue([
      { _pk: "1", _is_deleted: 1 },
    ]);

    await expect(generateStagingPreview("Empty")).resolves.toBe("");
    expect(previewLsx).not.toHaveBeenCalled();
  });

  it("debounces preview generation and stores the latest successful result", async () => {
    vi.useFakeTimers();
    const originalRaf = globalThis.requestAnimationFrame;
    const rafImpl = vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("requestAnimationFrame", rafImpl);

    const client = new PreviewWorkerClient(10);
    const promise = client.generate(
      () => "preview",
      (text) => `<pre>${text}</pre>`,
      [] as any,
      [] as any,
      {},
    );

    await vi.advanceTimersByTimeAsync(11);

    await expect(promise).resolves.toEqual({
      previewText: "preview",
      highlightedHtml: "<pre>preview</pre>",
      generationId: 1,
    });
    expect(client.latestResult?.previewText).toBe("preview");
    if (originalRaf) {
      vi.stubGlobal("requestAnimationFrame", originalRaf);
    } else {
      vi.unstubAllGlobals();
    }
  });

  it("cancels superseded preview requests and increments generation on cancel", async () => {
    vi.useFakeTimers();
    const originalRaf = globalThis.requestAnimationFrame;
    const rafImpl = vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("requestAnimationFrame", rafImpl);

    const client = new PreviewWorkerClient(10);
    const first = client.generate(
      async () => "first",
      (text) => text,
      [] as any,
      [] as any,
      {},
    );
    const second = client.generate(
      async () => "second",
      (text) => text,
      [] as any,
      [] as any,
      {},
    );

    await vi.advanceTimersByTimeAsync(11);
    await expect(first).resolves.toBeNull();
    await expect(second).resolves.toEqual({
      previewText: "second",
      highlightedHtml: "second",
      generationId: 2,
    });

    client.cancel();
    expect(client.generation).toBe(3);
    if (originalRaf) {
      vi.stubGlobal("requestAnimationFrame", originalRaf);
    } else {
      vi.unstubAllGlobals();
    }
  });
});

// ── modStore.modFilesPrefix branches ──────────────────────────────────

describe("modStore.modFilesPrefix", () => {
  beforeEach(() => {
    modStore.projectPath = "";
    modStore.selectedModPath = "";
    modStore.scanResult = null;
  });

  it("returns empty when no scan result", () => {
    expect(modStore.modFilesPrefix).toBe("");
  });

  it("returns Mods/folder/ when only selectedModPath is set", () => {
    modStore.scanResult = { mod_meta: { folder: "TestMod", name: "T", author: "", description: "", version: "" }, sections: [] } as any;
    modStore.selectedModPath = "/some/path";
    expect(modStore.modFilesPrefix).toBe("Mods/TestMod/");
  });

  it("returns relative prefix when projectPath and selectedModPath are set", () => {
    modStore.scanResult = { mod_meta: { folder: "TestMod", name: "T", author: "", description: "", version: "" }, sections: [] } as any;
    modStore.projectPath = "/project";
    modStore.selectedModPath = "/project/Mods/TestMod";
    expect(modStore.modFilesPrefix).toBe("Mods/TestMod/Mods/TestMod/");
  });

  it("returns Mods/folder/ when projectPath equals selectedModPath", () => {
    modStore.scanResult = { mod_meta: { folder: "TestMod", name: "T", author: "", description: "", version: "" }, sections: [] } as any;
    modStore.projectPath = "/project";
    modStore.selectedModPath = "/project";
    expect(modStore.modFilesPrefix).toBe("Mods/TestMod/");
  });
});