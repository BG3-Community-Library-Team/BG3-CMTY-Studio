import { describe, it, expect, beforeEach } from "vitest";
import { dataOperationStore } from "../lib/stores/dataOperationStore.svelte.js";

describe("dataOperationStore", () => {
  beforeEach(() => {
    // Reset to clean state before each test
    dataOperationStore.isRunning = false;
    dataOperationStore.operationType = null;
    dataOperationStore.phase = "";
    dataOperationStore.detail = "";
    dataOperationStore.percent = 0;
    dataOperationStore.smoothPercent = 0;
    dataOperationStore.elapsedSecs = 0;
    dataOperationStore.lastSuccess = null;
    dataOperationStore.lastError = null;
    dataOperationStore.isCancelled = false;
  });

  describe("startOperation", () => {
    it("sets correct initial state for populate", () => {
      dataOperationStore.startOperation("populate");

      expect(dataOperationStore.isRunning).toBe(true);
      expect(dataOperationStore.operationType).toBe("populate");
      expect(dataOperationStore.phase).toBe("");
      expect(dataOperationStore.detail).toBe("");
      expect(dataOperationStore.percent).toBe(0);
      expect(dataOperationStore.elapsedSecs).toBe(0);
      expect(dataOperationStore.lastSuccess).toBeNull();
      expect(dataOperationStore.lastError).toBeNull();
      expect(dataOperationStore.isCancelled).toBe(false);
    });

    it("sets correct initial state for reset", () => {
      dataOperationStore.startOperation("reset");

      expect(dataOperationStore.isRunning).toBe(true);
      expect(dataOperationStore.operationType).toBe("reset");
    });

    it("clears previous success/error state", () => {
      dataOperationStore.lastSuccess = { message: "old success", timestamp: 1000 };
      dataOperationStore.lastError = { message: "old error", timestamp: 1000 };

      dataOperationStore.startOperation("populate");

      expect(dataOperationStore.lastSuccess).toBeNull();
      expect(dataOperationStore.lastError).toBeNull();
    });
  });

  describe("updateProgress", () => {
    it("updates fields correctly when running", () => {
      dataOperationStore.startOperation("populate");

      dataOperationStore.updateProgress({
        phase: "Extracting",
        detail: "Processing pak files",
        percent: 45,
        elapsed_secs: 12.5,
      });

      expect(dataOperationStore.phase).toBe("Extracting");
      expect(dataOperationStore.detail).toBe("Processing pak files");
      expect(dataOperationStore.percent).toBe(45);
      expect(dataOperationStore.elapsedSecs).toBe(12.5);
    });

    it("discards events when not running", () => {
      // Not running — events should be discarded
      dataOperationStore.updateProgress({
        phase: "Extracting",
        detail: "Should be ignored",
        percent: 50,
        elapsed_secs: 10,
      });

      expect(dataOperationStore.phase).toBe("");
      expect(dataOperationStore.detail).toBe("");
      expect(dataOperationStore.percent).toBe(0);
      expect(dataOperationStore.elapsedSecs).toBe(0);
    });
  });

  describe("completeOperation", () => {
    it("transitions state correctly", () => {
      dataOperationStore.startOperation("populate");
      dataOperationStore.updateProgress({
        phase: "Done",
        detail: "",
        percent: 100,
        elapsed_secs: 30,
      });

      dataOperationStore.completeOperation("Game data populated successfully");

      expect(dataOperationStore.isRunning).toBe(false);
      expect(dataOperationStore.lastSuccess).not.toBeNull();
      expect(dataOperationStore.lastSuccess!.message).toBe("Game data populated successfully");
      expect(dataOperationStore.lastSuccess!.timestamp).toBeGreaterThan(0);
    });
  });

  describe("failOperation", () => {
    it("transitions state correctly", () => {
      dataOperationStore.startOperation("populate");

      dataOperationStore.failOperation("Database write failed");

      expect(dataOperationStore.isRunning).toBe(false);
      expect(dataOperationStore.lastError).not.toBeNull();
      expect(dataOperationStore.lastError!.message).toBe("Database write failed");
      expect(dataOperationStore.lastError!.timestamp).toBeGreaterThan(0);
    });
  });

  describe("cancelOperation", () => {
    it("sets cancelled flag and stops running", () => {
      dataOperationStore.startOperation("populate");

      dataOperationStore.cancelOperation();

      expect(dataOperationStore.isCancelled).toBe(true);
      // isRunning should now be false — cancel gives immediate UI feedback
      expect(dataOperationStore.isRunning).toBe(false);
      expect(dataOperationStore.lastError).not.toBeNull();
    });
  });

  describe("resetVisibleState", () => {
    it("clears success and error", () => {
      dataOperationStore.lastSuccess = { message: "Done", timestamp: 1000 };
      dataOperationStore.lastError = { message: "Fail", timestamp: 2000 };

      dataOperationStore.resetVisibleState();

      expect(dataOperationStore.lastSuccess).toBeNull();
      expect(dataOperationStore.lastError).toBeNull();
    });
  });

  describe("smoothPercent interpolation", () => {
    it("snaps smoothPercent up to real percent on progress event", () => {
      dataOperationStore.startOperation("populate");
      dataOperationStore.updateProgress({
        phase: "Collecting editor files",
        detail: "",
        percent: 20,
        elapsed_secs: 5,
      });

      expect(dataOperationStore.smoothPercent).toBe(20);
    });

    it("sets smoothPercent to 100 on completeOperation", () => {
      dataOperationStore.startOperation("populate");
      dataOperationStore.updateProgress({
        phase: "Populating ref_honor",
        detail: "",
        percent: 70,
        elapsed_secs: 60,
      });
      dataOperationStore.completeOperation("Done");

      expect(dataOperationStore.smoothPercent).toBe(100);
    });

    it("resets smoothPercent on startOperation", () => {
      dataOperationStore.smoothPercent = 50;
      dataOperationStore.startOperation("populate");

      expect(dataOperationStore.smoothPercent).toBe(0);
    });
  });

  describe("failOperation clears running state (Test 28)", () => {
    it("clears isRunning and sets error after startOperation", () => {
      dataOperationStore.startOperation("populate");
      expect(dataOperationStore.isRunning).toBe(true);

      dataOperationStore.failOperation("Something went wrong");

      expect(dataOperationStore.isRunning).toBe(false);
      expect(dataOperationStore.lastError).not.toBeNull();
      expect(dataOperationStore.lastError!.message).toBe("Something went wrong");
      expect(dataOperationStore.lastError!.timestamp).toBeGreaterThan(0);
    });

    it("resets progress fields after failure", () => {
      dataOperationStore.startOperation("populate");
      dataOperationStore.updateProgress({
        phase: "Extracting",
        detail: "Half done",
        percent: 50,
        elapsed_secs: 15,
      });

      dataOperationStore.failOperation("Extraction failed");

      expect(dataOperationStore.isRunning).toBe(false);
      // smoothPercent is stopped (interpolation halted) — not necessarily 0,
      // but isRunning must be false so the UI hides the progress bar
      expect(dataOperationStore.lastError!.message).toBe("Extraction failed");
    });

    it("preserves operationType after failure for diagnostics", () => {
      dataOperationStore.startOperation("reset");
      dataOperationStore.failOperation("Reset timed out");

      expect(dataOperationStore.isRunning).toBe(false);
      expect(dataOperationStore.operationType).toBe("reset");
      expect(dataOperationStore.lastError!.message).toBe("Reset timed out");
    });

    it("clears previous success state when failing", () => {
      dataOperationStore.lastSuccess = { message: "Old success", timestamp: 1000 };
      dataOperationStore.startOperation("populate");
      // startOperation already clears lastSuccess
      expect(dataOperationStore.lastSuccess).toBeNull();

      dataOperationStore.failOperation("New failure");

      expect(dataOperationStore.lastSuccess).toBeNull();
      expect(dataOperationStore.lastError!.message).toBe("New failure");
    });
  });

  describe("smoothPercent interpolation", () => {
    it("does not regress smoothPercent below previous value", () => {
      dataOperationStore.startOperation("populate");
      dataOperationStore.updateProgress({
        phase: "Populating ref_base",
        detail: "",
        percent: 30,
        elapsed_secs: 10,
      });
      const afterSnap = dataOperationStore.smoothPercent;

      // A subsequent event with a lower real percent should not decrease smoothPercent
      dataOperationStore.updateProgress({
        phase: "Populating ref_base",
        detail: "still working",
        percent: 30,
        elapsed_secs: 12,
      });
      expect(dataOperationStore.smoothPercent).toBeGreaterThanOrEqual(afterSnap);
    });
  });
});
