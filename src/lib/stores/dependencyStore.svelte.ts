import { readProjectFile, writeProjectFile } from "../tauri/project-settings.js";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export interface ProjectDependency {
  name: string;
  metaUuid: string | null;
  nexusModId: string | null;
  modioModId: number | null;
  notes: string | null;
}

interface DependenciesFile {
  dependencies: ProjectDependency[];
}

class DependencyStore {
  dependencies: ProjectDependency[] = $state([]);
  projectPath: string | null = $state(null);
  #saveTimer: ReturnType<typeof setTimeout> | null = null;

  async loadDependencies(projectPath: string): Promise<void> {
    this.projectPath = projectPath;
    if (!projectPath || !isTauri()) {
      return;
    }
    try {
      const content = await readProjectFile(projectPath, "dependencies.json");
      const parsed: DependenciesFile = JSON.parse(content);
      if (parsed && Array.isArray(parsed.dependencies)) {
        this.dependencies = parsed.dependencies.map((d) => ({
          name: typeof d.name === "string" ? d.name : "",
          metaUuid: typeof d.metaUuid === "string" ? d.metaUuid : null,
          nexusModId: typeof d.nexusModId === "string" ? d.nexusModId : null,
          modioModId: typeof d.modioModId === "number" ? d.modioModId : null,
          notes: typeof d.notes === "string" ? d.notes : null,
        }));
      } else {
        this.dependencies = [];
      }
    } catch (e) {
      console.warn("[dependencyStore] Failed to load dependencies:", e);
      this.dependencies = [];
    }
  }

  saveDependencies(): void {
    if (!this.projectPath || !isTauri()) return;
    if (this.#saveTimer) clearTimeout(this.#saveTimer);
    this.#saveTimer = setTimeout(() => {
      this.#executeSave();
    }, 500);
  }

  async #executeSave(): Promise<void> {
    if (!this.projectPath) return;
    const file: DependenciesFile = {
      dependencies: this.dependencies,
    };
    try {
      await writeProjectFile(this.projectPath, "dependencies.json", JSON.stringify(file, null, 2));
    } catch (e) {
      console.warn("[dependencyStore] Failed to save dependencies:", e);
    }
  }

  addDependency(dep: ProjectDependency): void {
    this.dependencies = [...this.dependencies, dep];
    this.saveDependencies();
  }

  removeDependency(index: number): void {
    if (index < 0 || index >= this.dependencies.length) return;
    this.dependencies = this.dependencies.filter((_, i) => i !== index);
    this.saveDependencies();
  }

  updateDependency(index: number, updates: Partial<ProjectDependency>): void {
    if (index < 0 || index >= this.dependencies.length) return;
    this.dependencies = this.dependencies.map((d, i) =>
      i === index ? { ...d, ...updates } : d,
    );
    this.saveDependencies();
  }

  resetProject(): void {
    if (this.#saveTimer) {
      clearTimeout(this.#saveTimer);
      this.#saveTimer = null;
    }
    this.dependencies = [];
    this.projectPath = null;
  }
}

export const dependencyStore = new DependencyStore();
