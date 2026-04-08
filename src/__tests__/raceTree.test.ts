import { describe, it, expect } from "vitest";
import { buildRaceTree, type RaceEntryInput, type AdditionalModRaceEntry } from "../lib/utils/raceTree.js";

describe("buildRaceTree", () => {
  const emptyVanillaMap: Record<string, string> = {};

  it("returns empty array when all inputs are empty", () => {
    const result = buildRaceTree([], [], [], {}, [], null, []);
    expect(result).toEqual([]);
  });

  it("builds a single root node from active mod entries", () => {
    const active: RaceEntryInput[] = [
      { uuid: "root1", displayName: "Custom Race" },
    ];
    const result = buildRaceTree(active, [], [], {}, [], "/mods/test", []);
    expect(result).toHaveLength(1);
    expect(result[0].uuid).toBe("root1");
    expect(result[0].displayName).toBe("Custom Race");
    expect(result[0].source).toBe("active-mod");
    expect(result[0].depth).toBe(0);
  });

  it("creates parent-child relationship from active mod entries", () => {
    const active: RaceEntryInput[] = [
      { uuid: "parent1", displayName: "Parent Race" },
      { uuid: "child1", displayName: "Child Race", parentGuid: "parent1" },
    ];
    const result = buildRaceTree(active, [], [], {}, [], "/mods/test", []);
    expect(result).toHaveLength(1);
    expect(result[0].uuid).toBe("parent1");
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children[0].uuid).toBe("child1");
    expect(result[0].children[0].depth).toBe(1);
  });

  it("adds manual entries without duplicating active mod entries", () => {
    const active: RaceEntryInput[] = [
      { uuid: "a1", displayName: "Active" },
    ];
    const manual: RaceEntryInput[] = [
      { uuid: "a1", displayName: "Duplicate" }, // should be skipped
      { uuid: "m1", displayName: "Manual Only" },
    ];
    const result = buildRaceTree(active, manual, [], {}, [], "/mods/test", []);
    expect(result).toHaveLength(2);
    // a1 should keep the active-mod source (not manual)
    const a1Node = result.find(n => n.uuid === "a1");
    expect(a1Node?.source).toBe("active-mod");
    const m1Node = result.find(n => n.uuid === "m1");
    expect(m1Node?.source).toBe("manual");
  });

  it("pulls in vanilla ancestor context nodes", () => {
    const active: RaceEntryInput[] = [
      { uuid: "child1", displayName: "Custom Sub-Race", parentGuid: "vanilla-parent" },
    ];
    const vanillaEntries: RaceEntryInput[] = [
      { uuid: "vanilla-parent", displayName: "Human" },
    ];
    const vanillaParentMap: Record<string, string> = {};
    const result = buildRaceTree(active, [], [], vanillaParentMap, vanillaEntries, "/mods/test", []);
    expect(result).toHaveLength(1);
    expect(result[0].uuid).toBe("vanilla-parent");
    expect(result[0].source).toBe("vanilla");
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children[0].uuid).toBe("child1");
  });

  it("walks ancestor chain through multiple levels", () => {
    const active: RaceEntryInput[] = [
      { uuid: "leaf", displayName: "Leaf", parentGuid: "mid" },
    ];
    const vanillaEntries: RaceEntryInput[] = [
      { uuid: "mid", displayName: "Mid", parentGuid: "root" },
      { uuid: "root", displayName: "Root" },
    ];
    const vanillaParentMap: Record<string, string> = { mid: "root" };
    const result = buildRaceTree(active, [], [], vanillaParentMap, vanillaEntries, "/mods/test", []);
    expect(result).toHaveLength(1);
    expect(result[0].uuid).toBe("root");
    expect(result[0].children[0].uuid).toBe("mid");
    expect(result[0].children[0].children[0].uuid).toBe("leaf");
  });

  it("adds vanilla children of existing tree nodes", () => {
    const active: RaceEntryInput[] = [
      { uuid: "parent1", displayName: "Modded Race" },
    ];
    const vanillaEntries: RaceEntryInput[] = [
      { uuid: "vanilla-child", displayName: "Vanilla Sub", parentGuid: "parent1" },
    ];
    const vanillaParentMap: Record<string, string> = { "vanilla-child": "parent1" };
    const result = buildRaceTree(active, [], [], vanillaParentMap, vanillaEntries, "/mods/test", []);
    expect(result).toHaveLength(1);
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children[0].source).toBe("vanilla");
  });

  it("sorts children alphabetically", () => {
    const active: RaceEntryInput[] = [
      { uuid: "parent", displayName: "Parent" },
      { uuid: "c-zebra", displayName: "Zebra", parentGuid: "parent" },
      { uuid: "c-alpha", displayName: "Alpha", parentGuid: "parent" },
      { uuid: "c-mid", displayName: "Middle", parentGuid: "parent" },
    ];
    const result = buildRaceTree(active, [], [], {}, [], "/mods/test", []);
    expect(result[0].children[0].displayName).toBe("Alpha");
    expect(result[0].children[1].displayName).toBe("Middle");
    expect(result[0].children[2].displayName).toBe("Zebra");
  });

  it("skips additional mod entries when active mod path overlaps", () => {
    const active: RaceEntryInput[] = [
      { uuid: "a1", displayName: "Active" },
    ];
    const additional: AdditionalModRaceEntry[] = [
      { uuid: "add1", displayName: "Additional", modName: "OtherMod" },
    ];
    const result = buildRaceTree(
      active, [], additional, {}, [],
      "/mods/test",
      ["/mods/test"], // same as active path
    );
    // additional should be skipped because its source path matches active
    const addNode = result.find(n => n.uuid === "add1");
    expect(addNode).toBeUndefined();
  });

  it("includes additional mod entries when paths differ", () => {
    const active: RaceEntryInput[] = [
      { uuid: "a1", displayName: "Active" },
    ];
    const additional: AdditionalModRaceEntry[] = [
      { uuid: "add1", displayName: "Additional", modName: "OtherMod" },
    ];
    const result = buildRaceTree(
      active, [], additional, {}, [],
      "/mods/test",
      ["/mods/other"], // different from active path
    );
    const addNode = result.find(n => n.uuid === "add1");
    expect(addNode).toBeDefined();
    expect(addNode?.source).toBe("additional-mod");
    expect(addNode?.sourceModName).toBe("OtherMod");
  });

  it("handles null active mod path", () => {
    const active: RaceEntryInput[] = [
      { uuid: "a1", displayName: "Active" },
    ];
    const additional: AdditionalModRaceEntry[] = [
      { uuid: "add1", displayName: "Additional", modName: "Other" },
    ];
    const result = buildRaceTree(active, [], additional, {}, [], null, ["/other"]);
    expect(result).toHaveLength(2); // both included
  });

  it("sets isInteractive correctly for pure vanilla nodes", () => {
    const active: RaceEntryInput[] = [
      { uuid: "child1", displayName: "Custom", parentGuid: "vanilla1" },
    ];
    const vanillaEntries: RaceEntryInput[] = [
      { uuid: "vanilla1", displayName: "Vanilla" },
    ];
    const result = buildRaceTree(active, [], [], {}, vanillaEntries, "/test", []);
    // vanilla1 has a non-vanilla child, so should be interactive
    expect(result[0].isInteractive).toBe(true);
    // child1 is active-mod, so always interactive
    expect(result[0].children[0].isInteractive).toBe(true);
  });

  it("limits ancestor walking to prevent infinite loops", () => {
    // Create a circular reference scenario
    const active: RaceEntryInput[] = [
      { uuid: "a1", displayName: "Entry", parentGuid: "cycle1" },
    ];
    const vanillaEntries: RaceEntryInput[] = [
      { uuid: "cycle1", displayName: "Cycle1", parentGuid: "cycle2" },
      { uuid: "cycle2", displayName: "Cycle2", parentGuid: "cycle1" },
    ];
    const vanillaParentMap: Record<string, string> = { cycle1: "cycle2", cycle2: "cycle1" };
    // Should not infinite loop — the cycle guard stops ancestor walking
    const result = buildRaceTree(active, [], [], vanillaParentMap, vanillaEntries, "/test", []);
    // Function may return empty if cycle prevents resolving any root — the key assertion
    // is that it terminates (no infinite loop) and does not throw.
    expect(result).toBeInstanceOf(Array);
  });
});
