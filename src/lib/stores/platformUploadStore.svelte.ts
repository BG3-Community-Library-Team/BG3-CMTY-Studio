import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { UploadProgress } from "../types/platform.js";

class PlatformUploadStore {
  currentUpload: UploadProgress | null = $state(null);
  #unlisten: UnlistenFn | null = null;

  get isUploading(): boolean {
    const stage = this.currentUpload?.stage;
    return (
      stage != null &&
      stage !== "Complete" &&
      stage !== "Error"
    );
  }

  constructor() {
    this.#setupListener();
  }

  async #setupListener(): Promise<void> {
    this.#unlisten = await listen<UploadProgress>(
      "platform-upload-progress",
      (event) => {
        this.currentUpload = event.payload;
      },
    );
  }

  reset(): void {
    this.currentUpload = null;
  }

  destroy(): void {
    this.#unlisten?.();
    this.#unlisten = null;
  }
}

export const platformUploadStore = new PlatformUploadStore();
