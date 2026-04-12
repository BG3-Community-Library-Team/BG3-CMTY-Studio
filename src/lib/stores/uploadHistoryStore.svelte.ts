export interface UploadHistoryEntry {
  id: string;
  platform: "Nexus" | "Modio";
  modName: string;
  fileName: string;
  version: string;
  timestamp: number;
  status: "success" | "failed";
  /** Platform-specific URL to view the upload, if known */
  url?: string;
}

const STORAGE_KEY = "cmty-upload-history";
const MAX_ENTRIES = 100;

class UploadHistoryStore {
  entries: UploadHistoryEntry[] = $state([]);

  constructor() {
    this.#load();
  }

  /** Add a new entry and persist */
  addEntry(entry: Omit<UploadHistoryEntry, "id" | "timestamp">) {
    const full: UploadHistoryEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    this.entries = [full, ...this.entries].slice(0, MAX_ENTRIES);
    this.#save();
  }

  /** Clear all history */
  clear() {
    this.entries = [];
    this.#save();
  }

  /** Remove a single entry */
  removeEntry(id: string) {
    this.entries = this.entries.filter((e) => e.id !== id);
    this.#save();
  }

  #load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.entries = JSON.parse(raw);
      }
    } catch {
      // Ignore parse errors
    }
  }

  #save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries));
    } catch {
      // Ignore storage errors
    }
  }
}

export const uploadHistoryStore = new UploadHistoryStore();
