import type { DetectedMod } from "../types/modSelection.js";

class ModSelectionService {
  mods = $state<DetectedMod[]>([]);
  #resolver: ((mod: DetectedMod | null) => void) | null = null;

  get isOpen() {
    return this.mods.length > 0;
  }

  prompt(mods: DetectedMod[]): Promise<DetectedMod | null> {
    return new Promise((resolve) => {
      this.mods = mods;
      this.#resolver = resolve;
    });
  }

  select(mod: DetectedMod) {
    this.#resolver?.(mod);
    this.#resolver = null;
    this.mods = [];
  }

  cancel() {
    this.#resolver?.(null);
    this.#resolver = null;
    this.mods = [];
  }
}

export const modSelectionService = new ModSelectionService();
