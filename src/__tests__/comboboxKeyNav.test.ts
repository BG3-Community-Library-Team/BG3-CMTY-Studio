import { describe, it, expect, vi } from "vitest";
import {
  handleComboboxKeydown,
  type KeyNavState,
  type KeyNavCallbacks,
} from "../lib/utils/comboboxKeyNav.js";

function makeState(overrides: Partial<KeyNavState> = {}): KeyNavState {
  return { activeIndex: -1, optionCount: 5, isOpen: false, ...overrides };
}

function makeCallbacks() {
  return {
    onOpen: vi.fn<(defaultIndex: "first" | "last") => void>(),
    onClose: vi.fn<() => void>(),
    onSelect: vi.fn<(index: number) => void>(),
    onIndexChange: vi.fn<(index: number) => void>(),
  };
}

function keyEvent(key: string): KeyboardEvent {
  return { key } as KeyboardEvent;
}

describe("handleComboboxKeydown", () => {
  describe("ArrowDown", () => {
    it("opens with 'first' when closed", () => {
      const state = makeState();
      const cb = makeCallbacks();
      const handled = handleComboboxKeydown(keyEvent("ArrowDown"), state, cb);
      expect(handled).toBe(true);
      expect(cb.onOpen).toHaveBeenCalledWith("first");
    });

    it("advances index when open", () => {
      const state = makeState({ isOpen: true, activeIndex: 2 });
      const cb = makeCallbacks();
      handleComboboxKeydown(keyEvent("ArrowDown"), state, cb);
      expect(cb.onIndexChange).toHaveBeenCalledWith(3);
    });

    it("wraps from last to first", () => {
      const state = makeState({ isOpen: true, activeIndex: 4, optionCount: 5 });
      const cb = makeCallbacks();
      handleComboboxKeydown(keyEvent("ArrowDown"), state, cb);
      expect(cb.onIndexChange).toHaveBeenCalledWith(0);
    });

    it("sets -1 when no options", () => {
      const state = makeState({ isOpen: true, optionCount: 0 });
      const cb = makeCallbacks();
      handleComboboxKeydown(keyEvent("ArrowDown"), state, cb);
      expect(cb.onIndexChange).toHaveBeenCalledWith(-1);
    });
  });

  describe("ArrowUp", () => {
    it("opens with 'last' when closed", () => {
      const state = makeState();
      const cb = makeCallbacks();
      const handled = handleComboboxKeydown(keyEvent("ArrowUp"), state, cb);
      expect(handled).toBe(true);
      expect(cb.onOpen).toHaveBeenCalledWith("last");
    });

    it("retreats index when open", () => {
      const state = makeState({ isOpen: true, activeIndex: 2 });
      const cb = makeCallbacks();
      handleComboboxKeydown(keyEvent("ArrowUp"), state, cb);
      expect(cb.onIndexChange).toHaveBeenCalledWith(1);
    });

    it("wraps from first to last", () => {
      const state = makeState({ isOpen: true, activeIndex: 0, optionCount: 5 });
      const cb = makeCallbacks();
      handleComboboxKeydown(keyEvent("ArrowUp"), state, cb);
      expect(cb.onIndexChange).toHaveBeenCalledWith(4);
    });
  });

  describe("Enter", () => {
    it("delegates to onSelect when active index valid", () => {
      const state = makeState({ isOpen: true, activeIndex: 2 });
      const cb = makeCallbacks();
      const handled = handleComboboxKeydown(keyEvent("Enter"), state, cb);
      expect(handled).toBe(true);
      expect(cb.onSelect).toHaveBeenCalledWith(2);
    });

    it("does not call onSelect when no active index", () => {
      const state = makeState({ isOpen: true, activeIndex: -1 });
      const cb = makeCallbacks();
      handleComboboxKeydown(keyEvent("Enter"), state, cb);
      expect(cb.onSelect).not.toHaveBeenCalled();
    });
  });

  describe("Escape", () => {
    it("calls onClose", () => {
      const state = makeState({ isOpen: true });
      const cb = makeCallbacks();
      const handled = handleComboboxKeydown(keyEvent("Escape"), state, cb);
      expect(handled).toBe(true);
      expect(cb.onClose).toHaveBeenCalled();
    });
  });

  describe("unhandled keys", () => {
    it("returns false for regular characters", () => {
      const state = makeState({ isOpen: true });
      const cb = makeCallbacks();
      const handled = handleComboboxKeydown(keyEvent("a"), state, cb);
      expect(handled).toBe(false);
    });

    it("returns false for Backspace", () => {
      const state = makeState({ isOpen: true });
      const cb = makeCallbacks();
      const handled = handleComboboxKeydown(keyEvent("Backspace"), state, cb);
      expect(handled).toBe(false);
    });
  });
});
