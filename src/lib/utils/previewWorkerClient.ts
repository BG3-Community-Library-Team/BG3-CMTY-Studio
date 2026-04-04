/**
 * PF-023 / T2-4: Debounced Async Preview Generator with Abort Cancellation.
 *
 * Wraps the preview generation IPC pipeline with a debounced,
 * generation-counter–guarded async interface.  Each call to `generate()`
 * returns a Promise that resolves on the next animation frame after a
 * configurable debounce window (default 50 ms), batching rapid store
 * mutations (e.g. ten checkbox toggles in quick succession) into a
 * single generation pass.
 *
 * A monotonically-increasing generation counter ensures stale results
 * are silently discarded when a newer request supersedes them.
 *
 * T2-4 / PF-002: An AbortController races each IPC invocation so that
 * superseding requests immediately free the main-thread await instead
 * of blocking until the Rust side completes.  The Rust command itself
 * cannot be cancelled, but the frontend no longer waits for its result.
 *
 * The architecture is intentionally isomorphic: if/when a real Web Worker
 * becomes feasible (after decoupling `preview.ts` from `settingsStore`),
 * the public API (`generate()` / `terminate()`) stays identical — only
 * the internal scheduling strategy changes.
 */

import type { SelectedEntry } from "../types/index.js";
import type { ManualEntry } from "../stores/configStore.svelte.js";

export type GenerateFn = (
  entries: SelectedEntry[],
  manualEntries: ManualEntry[],
  overrides: Record<string, Record<string, string>>,
) => string | Promise<string>;

export type HighlightFn = (text: string) => string;

export interface PreviewResult {
  previewText: string;
  highlightedHtml: string;
  generationId: number;
}

export class PreviewWorkerClient {
  #debounceMs: number;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #generation = 0;
  #latestResult: PreviewResult | null = null;
  #abortController: AbortController | null = null;

  constructor(debounceMs = 50) {
    this.#debounceMs = debounceMs;
  }

  /**
   * Schedule a debounced preview generation.  If called again before
   * the debounce fires, the previous pending call is cancelled.
   *
   * @returns A Promise that resolves with the generated preview,
   *          or `null` if the result was superseded by a newer call.
   */
  generate(
    generateFn: GenerateFn,
    highlightFn: HighlightFn,
    entries: SelectedEntry[],
    manualEntries: ManualEntry[],
    autoEntryOverrides: Record<string, Record<string, string>>,
  ): Promise<PreviewResult | null> {
    // Increment counter — any in-flight request with a lower id is stale
    const id = ++this.#generation;

    // Cancel any pending debounce
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }

    // T2-4 / PF-002: Abort any in-flight IPC call so the main thread
    // doesn't block awaiting a stale response.
    if (this.#abortController) {
      this.#abortController.abort();
    }
    const controller = new AbortController();
    this.#abortController = controller;

    return new Promise<PreviewResult | null>((resolve) => {
      this.#timer = setTimeout(() => {
        this.#timer = null;

        // Stale check — a newer generate() call was made during the debounce
        if (id !== this.#generation || controller.signal.aborted) {
          resolve(null);
          return;
        }

        // Yield to the browser before the heavy computation so that
        // any pending paint / input events are processed first.
        requestAnimationFrame(async () => {
          // Double-check staleness after the rAF
          if (id !== this.#generation || controller.signal.aborted) {
            resolve(null);
            return;
          }

          try {
            // Race the IPC call against the abort signal so that a
            // superseding request immediately frees this await.
            const abortPromise = new Promise<never>((_, reject) => {
              if (controller.signal.aborted) {
                reject(new DOMException("Aborted", "AbortError"));
                return;
              }
              controller.signal.addEventListener(
                "abort",
                () => reject(new DOMException("Aborted", "AbortError")),
                { once: true },
              );
            });

            const previewText = await Promise.race([
              Promise.resolve(generateFn(entries, manualEntries, autoEntryOverrides)),
              abortPromise,
            ]);

            // Final stale check after async generation
            if (id !== this.#generation || controller.signal.aborted) {
              resolve(null);
              return;
            }
            const highlightedHtml = highlightFn(previewText);
            const result: PreviewResult = { previewText, highlightedHtml, generationId: id };
            this.#latestResult = result;
            resolve(result);
          } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") {
              resolve(null);
              return;
            }
            console.error("PF-023: preview generation failed", err);
            resolve(null);
          }
        });
      }, this.#debounceMs);
    });
  }

  /** Latest successfully generated result. */
  get latestResult(): PreviewResult | null {
    return this.#latestResult;
  }

  /** Current generation counter. */
  get generation(): number {
    return this.#generation;
  }

  /** Cancel any pending generation and abort in-flight IPC. */
  cancel(): void {
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
    if (this.#abortController) {
      this.#abortController.abort();
      this.#abortController = null;
    }
    this.#generation++;
  }

  /** Clean up (no-op for the debounced variant, keeps the API surface). */
  terminate(): void {
    this.cancel();
  }
}
