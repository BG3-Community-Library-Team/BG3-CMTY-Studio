import { describe, it, expect } from "vitest";
import { keyboardReorder } from "../components/explorer/dragReorder.js";

describe("keyboardReorder", () => {
  it("moves item up", () => {
    const result = keyboardReorder(["a", "b", "c"], 1, "up");
    expect(result).toEqual(["b", "a", "c"]);
  });

  it("moves item down", () => {
    const result = keyboardReorder(["a", "b", "c"], 1, "down");
    expect(result).toEqual(["a", "c", "b"]);
  });

  it("returns null when moving first item up", () => {
    expect(keyboardReorder(["a", "b", "c"], 0, "up")).toBeNull();
  });

  it("returns null when moving last item down", () => {
    expect(keyboardReorder(["a", "b", "c"], 2, "down")).toBeNull();
  });

  it("does not mutate the original array", () => {
    const original = ["a", "b", "c"];
    keyboardReorder(original, 1, "up");
    expect(original).toEqual(["a", "b", "c"]);
  });

  it("works with single-element array", () => {
    expect(keyboardReorder(["a"], 0, "up")).toBeNull();
    expect(keyboardReorder(["a"], 0, "down")).toBeNull();
  });

  it("works with two-element array", () => {
    expect(keyboardReorder(["a", "b"], 0, "down")).toEqual(["b", "a"]);
    expect(keyboardReorder(["a", "b"], 1, "up")).toEqual(["b", "a"]);
  });

  it("works with complex objects", () => {
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const result = keyboardReorder(items, 0, "down");
    expect(result).toEqual([{ id: 2 }, { id: 1 }, { id: 3 }]);
  });
});
