import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/** Create a mock HTMLElement with the minimum interface needed by focusTrap */
function mockElement(overrides: Record<string, unknown> = {}): HTMLElement {
  return {
    focus: vi.fn(),
    blur: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    querySelectorAll: vi.fn(() => []),
    ...overrides,
  } as unknown as HTMLElement;
}

/** Build a mock container that returns the given focusable children */
function mockContainer(children: HTMLElement[]): HTMLElement {
  return mockElement({
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    querySelectorAll: vi.fn(() => children),
  });
}

// Stub document globally before importing focusTrap (it accesses document at call time)
const mockBody = { contains: vi.fn(() => true) };
const mockDoc = {
  activeElement: null as unknown,
  body: mockBody,
};
vi.stubGlobal("document", mockDoc);
vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { cb(0); return 0; });

// Import AFTER global stubs are in place
const { focusTrap } = await import("../lib/utils/focusTrap.js");

describe("focusTrap", () => {
  beforeEach(() => {
    mockDoc.activeElement = null;
    mockBody.contains = vi.fn(() => true);
  });

  // ── Initialization ─────────────────────────────────────

  describe("initialization", () => {
    it("attaches a keydown listener to the node", () => {
      const node = mockContainer([]);
      focusTrap(node);
      expect(node.addEventListener).toHaveBeenCalledWith("keydown", expect.any(Function));
    });

    it("focuses the first focusable child on activation", () => {
      const child1 = mockElement();
      const child2 = mockElement();
      const node = mockContainer([child1, child2]);
      focusTrap(node);
      expect(child1.focus).toHaveBeenCalledOnce();
      expect(child2.focus).not.toHaveBeenCalled();
    });

    it("does not throw when there are no focusable children", () => {
      const node = mockContainer([]);
      expect(() => focusTrap(node)).not.toThrow();
    });
  });

  // ── Tab wrapping ───────────────────────────────────────

  describe("Tab wrapping", () => {
    function simulateKeydown(node: HTMLElement, event: Partial<KeyboardEvent>) {
      // Extract the keydown handler that was registered
      const addListenerMock = node.addEventListener as ReturnType<typeof vi.fn>;
      const call = addListenerMock.mock.calls.find(
        (c: unknown[]) => c[0] === "keydown",
      );
      if (!call) throw new Error("keydown listener not registered");
      const handler = call[1] as (e: KeyboardEvent) => void;
      const ev = {
        key: "Tab",
        shiftKey: false,
        preventDefault: vi.fn(),
        ...event,
      } as unknown as KeyboardEvent;
      handler(ev);
      return ev;
    }

    it("wraps to last element on Shift+Tab at first element", () => {
      const first = mockElement();
      const last = mockElement();
      const node = mockContainer([first, last]);
      focusTrap(node);

      // Simulate activeElement being the first child
      mockDoc.activeElement = first;

      const ev = simulateKeydown(node, { key: "Tab", shiftKey: true });
      expect((ev as any).preventDefault).toHaveBeenCalled();
      expect(last.focus).toHaveBeenCalled();
    });

    it("wraps to first element on Tab at last element", () => {
      const first = mockElement();
      const last = mockElement();
      const node = mockContainer([first, last]);
      focusTrap(node);

      mockDoc.activeElement = last;

      const ev = simulateKeydown(node, { key: "Tab", shiftKey: false });
      expect((ev as any).preventDefault).toHaveBeenCalled();
      // first.focus is called once during init (requestAnimationFrame) + once for wrap
      expect(first.focus).toHaveBeenCalledTimes(2);
    });

    it("does nothing special for Tab in the middle of the list", () => {
      const first = mockElement();
      const middle = mockElement();
      const last = mockElement();
      const node = mockContainer([first, middle, last]);
      focusTrap(node);

      mockDoc.activeElement = middle;

      const ev = simulateKeydown(node, { key: "Tab", shiftKey: false });
      expect((ev as any).preventDefault).not.toHaveBeenCalled();
    });

    it("does not prevent default for non-Tab keys", () => {
      const child = mockElement();
      const node = mockContainer([child]);
      focusTrap(node);

      mockDoc.activeElement = child;

      const ev = simulateKeydown(node, { key: "Escape", shiftKey: false });
      expect((ev as any).preventDefault).not.toHaveBeenCalled();
    });

    it("does nothing when focusable list is empty", () => {
      const node = mockContainer([]);
      focusTrap(node);

      const ev = simulateKeydown(node, { key: "Tab", shiftKey: false });
      expect((ev as any).preventDefault).not.toHaveBeenCalled();
    });

    it("handles a single focusable element (Shift+Tab wraps to itself)", () => {
      const only = mockElement();
      const node = mockContainer([only]);
      focusTrap(node);

      mockDoc.activeElement = only;

      // Tab forward at last (which is also first) => wraps to first (itself)
      const ev1 = simulateKeydown(node, { key: "Tab", shiftKey: false });
      expect((ev1 as any).preventDefault).toHaveBeenCalled();

      // Shift+Tab at first (which is also last) => wraps to last (itself)
      const ev2 = simulateKeydown(node, { key: "Tab", shiftKey: true });
      expect((ev2 as any).preventDefault).toHaveBeenCalled();
    });
  });

  // ── destroy() ──────────────────────────────────────────

  describe("destroy()", () => {
    it("removes the keydown listener", () => {
      const node = mockContainer([]);
      const result = focusTrap(node);
      result.destroy();
      expect(node.removeEventListener).toHaveBeenCalledWith("keydown", expect.any(Function));
    });

    it("restores focus to the previously focused element", () => {
      const previouslyFocused = mockElement();
      mockDoc.activeElement = previouslyFocused;

      const node = mockContainer([]);
      const result = focusTrap(node);
      result.destroy();
      expect(previouslyFocused.focus).toHaveBeenCalled();
    });

    it("does not restore focus if the previous element is no longer in the DOM", () => {
      const previouslyFocused = mockElement();
      mockDoc.activeElement = previouslyFocused;
      // body.contains returns false — element was removed
      mockBody.contains = vi.fn(() => false);

      const node = mockContainer([]);
      const result = focusTrap(node);
      result.destroy();
      expect(previouslyFocused.focus).not.toHaveBeenCalled();
    });

    it("handles null previousFocus gracefully", () => {
      mockDoc.activeElement = null;

      const node = mockContainer([]);
      const result = focusTrap(node);
      expect(() => result.destroy()).not.toThrow();
    });
  });
});
