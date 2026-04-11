import { listen } from "@tauri-apps/api/event";
import { m } from "../../paraglide/messages.js";
import type { PipelineProgress } from "../utils/tauri.js";

export type OperationType = "populate" | "reset" | "mod-import";

/** Default timeout ceiling in seconds (35 minutes — above backend's 30-min timeout). */
const DEFAULT_TIMEOUT_SECS = 35 * 60;

/**
 * Maps known pipeline phase names to the expected percent at the *next* phase boundary.
 * Used by the smooth interpolation to know where the bar should creep toward.
 */
const PHASE_NEXT_PERCENT: Record<string, number> = {
  "Streaming game data": 20,
  "Collecting editor files": 30,
  "Populating ref_base": 70,
  "Populating ref_honor": 95,
};

/** Asymptotic approach rate (1/sec). Higher = faster initial movement. */
const INTERP_RATE = 0.15;
/** Max fraction of the gap the bar can cover before the real update arrives. */
const INTERP_DAMPING = 0.92;

const raf = typeof requestAnimationFrame === "function"
  ? requestAnimationFrame
  : (fn: FrameRequestCallback) => setTimeout(fn, 16) as unknown as number;
const caf = typeof cancelAnimationFrame === "function"
  ? cancelAnimationFrame
  : (id: number) => clearTimeout(id);

class DataOperationStore {
  isRunning: boolean = $state(false);
  operationType: OperationType | null = $state(null);
  phase: string = $state("");
  detail: string = $state("");
  percent: number = $state(0);
  /** Smoothly interpolated percent (0–100) for UI progress bars. */
  smoothPercent: number = $state(0);
  elapsedSecs: number = $state(0);
  lastSuccess: { message: string; timestamp: number } | null = $state(null);
  lastError: { message: string; timestamp: number } | null = $state(null);
  isCancelled: boolean = $state(false);

  /** Timeout ceiling in seconds. */
  timeoutSecs: number = DEFAULT_TIMEOUT_SECS;

  /** Unlisten handle for the pipeline-progress event. */
  #unlisten: (() => void) | null = null;
  /** Cleanup handle for the timeout effect root. */
  #cleanupTimeout: (() => void) | null = null;

  // ── Interpolation state ──────────────────────────────────────────
  #interpStart = 0;
  #interpTarget = 0;
  #interpStartTime = 0;
  #animFrameId = 0;

  constructor() {
    this.#setupListener();
    this.#setupTimeoutWatch();
  }

  async #setupListener(): Promise<void> {
    this.#unlisten = await listen<PipelineProgress>("pipeline-progress", (event) => {
      this.updateProgress(event.payload);
    });
  }

  #setupTimeoutWatch(): void {
    this.#cleanupTimeout = $effect.root(() => {
      $effect(() => {
        const elapsed = this.elapsedSecs;
        if (this.isRunning && elapsed > this.timeoutSecs) {
          this.failOperation(m.data_op_timeout({ minutes: String(Math.round(elapsed / 60)) }));
        }
      });
    });
  }

  startOperation(type: OperationType): void {
    this.#stopInterpolation();
    this.isRunning = true;
    this.operationType = type;
    this.phase = "";
    this.detail = "";
    this.percent = 0;
    this.smoothPercent = 0;
    this.elapsedSecs = 0;
    this.lastSuccess = null;
    this.lastError = null;
    this.isCancelled = false;
  }

  updateProgress(event: PipelineProgress): void {
    if (!this.isRunning) return;
    this.phase = event.phase;
    this.detail = event.detail;
    this.percent = event.percent;
    this.elapsedSecs = event.elapsed_secs;
    this.#updateInterpolation(event.percent, event.phase);
  }

  completeOperation(message: string): void {
    this.#stopInterpolation();
    this.smoothPercent = 100;
    this.isRunning = false;
    this.lastSuccess = { message, timestamp: Date.now() };
  }

  failOperation(message: string): void {
    this.#stopInterpolation();
    this.isRunning = false;
    this.lastError = { message, timestamp: Date.now() };
  }

  cancelOperation(): void {
    this.#stopInterpolation();
    this.isCancelled = true;
    this.isRunning = false;
    this.lastError = { message: m.data_op_cancelled(), timestamp: Date.now() };
  }

  resetVisibleState(): void {
    this.lastSuccess = null;
    this.lastError = null;
  }

  /** Clean up the event listener, effect root, and animation loop. */
  destroy(): void {
    this.#stopInterpolation();
    this.#unlisten?.();
    this.#unlisten = null;
    this.#cleanupTimeout?.();
    this.#cleanupTimeout = null;
  }

  // ── Smooth progress interpolation ────────────────────────────────

  /**
   * Called on each real backend progress event.
   * Snaps smoothPercent up to the real value, then starts asymptotically
   * creeping toward the next expected phase boundary.
   */
  #updateInterpolation(realPercent: number, phase: string): void {
    const effective = Math.max(realPercent, 0);

    // Snap up if real progress exceeds current smooth value
    if (effective > this.smoothPercent) {
      this.smoothPercent = effective;
    }

    // 100% → done
    if (realPercent >= 100) {
      this.smoothPercent = 100;
      this.#stopInterpolation();
      return;
    }

    // Determine target from phase knowledge, else small fixed headroom
    this.#interpTarget = PHASE_NEXT_PERCENT[phase] ?? Math.min(effective + 15, 99);
    this.#interpStart = this.smoothPercent;
    this.#interpStartTime = performance.now();

    // Start animation loop if not already running
    if (!this.#animFrameId) {
      this.#animFrameId = raf(this.#tick);
    }
  }

  #tick = (): void => {
    if (!this.isRunning) {
      this.#animFrameId = 0;
      return;
    }

    const elapsed = (performance.now() - this.#interpStartTime) / 1000;
    const ratio = (1 - Math.exp(-elapsed * INTERP_RATE)) * INTERP_DAMPING;
    const next = this.#interpStart + (this.#interpTarget - this.#interpStart) * ratio;

    // Only update when value actually increases (avoid backward jitter)
    if (next > this.smoothPercent + 0.05) {
      this.smoothPercent = Math.round(next * 10) / 10;
    }

    this.#animFrameId = raf(this.#tick);
  };

  #stopInterpolation(): void {
    if (this.#animFrameId) {
      caf(this.#animFrameId);
      this.#animFrameId = 0;
    }
  }
}

export const dataOperationStore = new DataOperationStore();
