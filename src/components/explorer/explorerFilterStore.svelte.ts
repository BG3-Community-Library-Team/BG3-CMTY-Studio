/**
 * Explorer tree filter store — reactive state for the Ctrl+Alt+F filter input.
 * Separated into .svelte.ts to support $state runes.
 */

export type FilterMode = "highlight" | "filter";

class ExplorerFilterStore {
  active: boolean = $state(false);
  query: string = $state("");
  mode: FilterMode = $state("highlight");
  fuzzy: boolean = $state(false);

  open() { this.active = true; }
  close() { this.active = false; this.query = ""; }
  toggleMode() { this.mode = this.mode === "highlight" ? "filter" : "highlight"; }
  toggleFuzzy() { this.fuzzy = !this.fuzzy; }
}

export const explorerFilter = new ExplorerFilterStore();
