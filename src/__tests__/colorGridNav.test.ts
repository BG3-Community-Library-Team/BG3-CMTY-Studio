import { describe, it, expect } from "vitest";
import { gridKeyNav, nextVisibleIndex } from "../lib/utils/colorGridNav.js";

// ---------------------------------------------------------------------------
// gridKeyNav — basic arrow navigation (no filter)
// ---------------------------------------------------------------------------
describe("gridKeyNav — arrow navigation", () => {
  const total = 20;
  const cols = 5;

  it("ArrowRight advances activeIndex by 1", () => {
    const r = gridKeyNav("ArrowRight", 3, total, cols);
    expect(r).toEqual({ handled: true, newIndex: 4 });
  });

  it("ArrowLeft decrements activeIndex by 1", () => {
    const r = gridKeyNav("ArrowLeft", 3, total, cols);
    expect(r).toEqual({ handled: true, newIndex: 2 });
  });

  it("ArrowDown advances by columnCount", () => {
    const r = gridKeyNav("ArrowDown", 3, total, cols);
    expect(r).toEqual({ handled: true, newIndex: 8 });
  });

  it("ArrowUp decrements by columnCount", () => {
    const r = gridKeyNav("ArrowUp", 8, total, cols);
    expect(r).toEqual({ handled: true, newIndex: 3 });
  });

  it("ArrowRight at last index stays at last", () => {
    const r = gridKeyNav("ArrowRight", 19, total, cols);
    expect(r).toEqual({ handled: true, newIndex: 19 });
  });

  it("ArrowLeft at index 0 stays at 0", () => {
    const r = gridKeyNav("ArrowLeft", 0, total, cols);
    expect(r).toEqual({ handled: true, newIndex: 0 });
  });

  it("ArrowDown clamps to last index", () => {
    const r = gridKeyNav("ArrowDown", 17, total, cols);
    expect(r).toEqual({ handled: true, newIndex: 19 });
  });

  it("ArrowUp clamps to 0", () => {
    const r = gridKeyNav("ArrowUp", 2, total, cols);
    expect(r).toEqual({ handled: true, newIndex: 0 });
  });

  it("Home sets activeIndex to 0", () => {
    const r = gridKeyNav("Home", 15, total, cols);
    expect(r).toEqual({ handled: true, newIndex: 0 });
  });

  it("End sets activeIndex to last index", () => {
    const r = gridKeyNav("End", 3, total, cols);
    expect(r).toEqual({ handled: true, newIndex: 19 });
  });
});

// ---------------------------------------------------------------------------
// gridKeyNav — selection toggle
// ---------------------------------------------------------------------------
describe("gridKeyNav — selection toggle", () => {
  it("Space triggers toggleSelection", () => {
    const r = gridKeyNav(" ", 5, 20, 5);
    expect(r).toEqual({ handled: true, toggleSelection: true });
  });

  it("Enter triggers toggleSelection", () => {
    const r = gridKeyNav("Enter", 5, 20, 5);
    expect(r).toEqual({ handled: true, toggleSelection: true });
  });

  it("unrecognized key returns handled: false", () => {
    const r = gridKeyNav("Tab", 5, 20, 5);
    expect(r).toEqual({ handled: false });
  });
});

// ---------------------------------------------------------------------------
// gridKeyNav — empty grid
// ---------------------------------------------------------------------------
describe("gridKeyNav — edge cases", () => {
  it("returns handled: false for empty grid", () => {
    const r = gridKeyNav("ArrowRight", 0, 0, 5);
    expect(r).toEqual({ handled: false });
  });

  it("ArrowRight from -1 goes to 0", () => {
    const r = gridKeyNav("ArrowRight", -1, 10, 5);
    expect(r).toEqual({ handled: true, newIndex: 0 });
  });
});

// ---------------------------------------------------------------------------
// gridKeyNav — with visibility filter
// ---------------------------------------------------------------------------
describe("gridKeyNav — filtered navigation", () => {
  // Items 0-9; only even indices are visible
  const isEvenVisible = (i: number) => i % 2 === 0;
  const total = 10;
  const cols = 5;

  it("ArrowRight skips hidden items", () => {
    const r = gridKeyNav("ArrowRight", 0, total, cols, isEvenVisible);
    expect(r.handled).toBe(true);
    expect(r.newIndex).toBe(2);
  });

  it("ArrowLeft skips hidden items", () => {
    const r = gridKeyNav("ArrowLeft", 4, total, cols, isEvenVisible);
    expect(r.handled).toBe(true);
    expect(r.newIndex).toBe(2);
  });

  it("ArrowRight stays in place when no visible item ahead", () => {
    const r = gridKeyNav("ArrowRight", 8, total, cols, isEvenVisible);
    expect(r.handled).toBe(true);
    expect(r.newIndex).toBe(8); // 9 is hidden, stays at 8
  });

  it("Home finds first visible item", () => {
    const r = gridKeyNav("Home", 6, total, cols, isEvenVisible);
    expect(r.handled).toBe(true);
    expect(r.newIndex).toBe(0);
  });

  it("End finds last visible item", () => {
    const r = gridKeyNav("End", 0, total, cols, isEvenVisible);
    expect(r.handled).toBe(true);
    expect(r.newIndex).toBe(8);
  });

  it("ArrowDown finds nearest visible item near target row", () => {
    // From 0, down by 5 → target 5 (hidden) → nearest visible is 4 or 6
    const r = gridKeyNav("ArrowDown", 0, total, cols, isEvenVisible);
    expect(r.handled).toBe(true);
    expect(typeof r.newIndex).toBe("number");
    expect(isEvenVisible(r.newIndex!)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// nextVisibleIndex — stand-alone
// ---------------------------------------------------------------------------
describe("nextVisibleIndex", () => {
  it("returns next index when no filter", () => {
    expect(nextVisibleIndex(3, 1, 10)).toBe(4);
  });

  it("returns previous index when no filter", () => {
    expect(nextVisibleIndex(3, -1, 10)).toBe(2);
  });

  it("skips hidden items forward", () => {
    const vis = (i: number) => i === 5;
    expect(nextVisibleIndex(0, 1, 10, vis)).toBe(5);
  });

  it("skips hidden items backward", () => {
    const vis = (i: number) => i === 2;
    expect(nextVisibleIndex(8, -1, 10, vis)).toBe(2);
  });

  it("returns from when no visible item found", () => {
    const vis = () => false;
    expect(nextVisibleIndex(3, 1, 10, vis)).toBe(3);
  });

  it("returns from when at boundary going forward", () => {
    expect(nextVisibleIndex(9, 1, 10)).toBe(9);
  });

  it("returns from when at boundary going backward", () => {
    expect(nextVisibleIndex(0, -1, 10)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// gridKeyNav — nearestVisibleIndex backward fallback
// ---------------------------------------------------------------------------
describe("gridKeyNav — backward search fallback", () => {
  it("falls back to backward search when forward has no visible items", () => {
    // Grid: 10 items, 5 cols. Active=0, press ArrowDown → target=5
    // Items 5-9 are all hidden; items 0-4 are visible.
    // Forward search from 5: 5,6,7,8,9 all hidden → backward from 4: finds 4
    const vis = (i: number) => i < 5;
    const r = gridKeyNav("ArrowDown", 0, 10, 5, vis);
    expect(r).toEqual({ handled: true, newIndex: 4 });
  });

  it("returns activeIndex when no visible items at all", () => {
    // All items hidden → nearestVisibleIndex returns undefined → fallback to activeIndex
    const vis = () => false;
    const r = gridKeyNav("ArrowDown", 2, 10, 5, vis);
    expect(r).toEqual({ handled: true, newIndex: 2 });
  });
});
