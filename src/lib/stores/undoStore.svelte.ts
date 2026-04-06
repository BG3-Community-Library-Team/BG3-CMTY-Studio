/**
 * IX-03A + ER-01 + PF-06: Command-pattern undo/redo system.
 *
 * Delegates to projectStore's staging-DB-backed undo/redo.
 * Legacy push() method kept for backward compatibility but
 * callers should prefer projectStore.snapshot(label) directly.
 *
 * Supports Ctrl+Z (undo) and Ctrl+Y / Ctrl+Shift+Z (redo).
 */

import { projectStore } from "./projectStore.svelte.js";

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

  /** Push a reversible command onto the undo stack.
   *  Also creates a staging-DB snapshot for the projectStore undo path. */
  push(command: UndoCommand): void {
    this.#undoStack.push(command);
    if (this.#undoStack.length > MAX_UNDO) {
      this.#undoStack.splice(0, this.#undoStack.length - MAX_UNDO);
    }
    this.#redoStack = [];
    projectStore.snapshot(command.label);
  }

  /** Undo the last action. Returns the label of the undone action, or null. */
  async undo(): Promise<string | null> {
    const cmd = this.#undoStack.pop();
    if (!cmd) {
      // Fallback: try projectStore staging undo even without a local command
      await projectStore.undo();
      return null;
    }
    cmd.undo();
    this.#redoStack.push(cmd);
    await projectStore.undo();
    return cmd.label;
  }

  /** Redo the last undone action. Returns the label, or null. */
  async redo(): Promise<string | null> {
    const cmd = this.#redoStack.pop();
    if (!cmd) {
      await projectStore.redo();
      return null;
    }
    cmd.redo();
    this.#undoStack.push(cmd);
    await projectStore.redo();
    return cmd.label;
  }

  /** Clear all undo/redo history (e.g. on new scan import). */
  clear(): void {
    this.#undoStack = [];
    this.#redoStack = [];
  }
}

export const undoStore = new UndoStore();
