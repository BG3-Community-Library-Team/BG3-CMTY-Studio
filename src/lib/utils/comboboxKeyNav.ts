/**
 * Shared keyboard navigation for combobox components.
 * Handles cursor movement and escape; delegates selection to caller.
 */

export interface KeyNavState {
  activeIndex: number;
  optionCount: number;
  isOpen: boolean;
}

export interface KeyNavCallbacks {
  onOpen: (defaultIndex: "first" | "last") => void;
  onClose: () => void;
  onSelect: (index: number) => void;
  onIndexChange: (index: number) => void;
}

/**
 * Process a keydown event for combobox navigation.
 * Returns true if the event was handled (caller should preventDefault).
 */
export function handleComboboxKeydown(
  e: KeyboardEvent,
  state: KeyNavState,
  callbacks: KeyNavCallbacks,
): boolean {
  switch (e.key) {
    case "ArrowDown":
      if (!state.isOpen) {
        callbacks.onOpen("first");
      } else if (state.optionCount > 0) {
        callbacks.onIndexChange((state.activeIndex + 1) % state.optionCount);
      } else {
        callbacks.onIndexChange(-1);
      }
      return true;

    case "ArrowUp":
      if (!state.isOpen) {
        callbacks.onOpen("last");
      } else if (state.optionCount > 0) {
        callbacks.onIndexChange(
          (state.activeIndex - 1 + state.optionCount) % state.optionCount,
        );
      } else {
        callbacks.onIndexChange(-1);
      }
      return true;

    case "Enter":
      if (state.activeIndex >= 0 && state.activeIndex < state.optionCount) {
        callbacks.onSelect(state.activeIndex);
      }
      return true;

    case "Escape":
      callbacks.onClose();
      return true;

    default:
      return false;
  }
}
