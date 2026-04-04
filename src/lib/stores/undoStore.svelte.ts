/**
 * IX-03A + ER-01 + PF-06: Command-pattern undo/redo system.
 *
 * Instead of deep-cloning full configStore state for each snapshot,
 * each undoable operation pushes a command with undo/redo closures
 * that capture only the minimal state delta needed to reverse/replay
 * the operation. This reduces memory from O(full-state × MAX_UNDO)
 * to O(delta × MAX_UNDO).
 *
 * Supports Ctrl+Z (undo) and Ctrl+Y / Ctrl+Shift+Z (redo).
 */

const MAX_UNDO = 50;

export interface UndoCommand {
  label: string;
  undo: () => void;
  redo: () => void;
}

class UndoStore {
  #undoStack: UndoCommand[] = $state([]);
  #redoStack: UndoCommand[] = $state([]);

  get canUndo(): boolean { return this.#undoStack.length > 0; }
  get canRedo(): boolean { return this.#redoStack.length > 0; }
  get undoLabel(): string { return this.#undoStack[this.#undoStack.length - 1]?.label ?? ""; }
  get redoLabel(): string { return this.#redoStack[this.#redoStack.length - 1]?.label ?? ""; }

  /** Push a reversible command onto the undo stack. */
  push(command: UndoCommand): void {
    this.#undoStack.push(command);
    if (this.#undoStack.length > MAX_UNDO) {
      this.#undoStack.splice(0, this.#undoStack.length - MAX_UNDO);
    }
    this.#redoStack = [];
  }

  /** Undo the last action. Returns the label of the undone action, or null. */
  undo(): string | null {
    const cmd = this.#undoStack.pop();
    if (!cmd) return null;
    cmd.undo();
    this.#redoStack.push(cmd);
    return cmd.label;
  }

  /** Redo the last undone action. Returns the label, or null. */
  redo(): string | null {
    const cmd = this.#redoStack.pop();
    if (!cmd) return null;
    cmd.redo();
    this.#undoStack.push(cmd);
    return cmd.label;
  }

  /** Clear all undo/redo history (e.g. on new scan import). */
  clear(): void {
    this.#undoStack = [];
    this.#redoStack = [];
  }
}

export const undoStore = new UndoStore();
