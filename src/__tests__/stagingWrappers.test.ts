/**
 * Test 29: staging.ts wrappers — rejected invoke → error propagates to caller
 *
 * Verifies that all staging IPC wrappers propagate invoke() rejections
 * to the caller (no silent try/catch swallowing errors).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock is hoisted — use vi.hoisted to create the mock function ahead of time
const mockInvoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

import {
  stagingUpsertRow,
  stagingMarkDeleted,
  stagingUnmarkDeleted,
  stagingBatchWrite,
  stagingListSections,
  stagingQuerySection,
} from "../lib/tauri/staging.js";

beforeEach(() => {
  vi.clearAllMocks();
});

const DB_PATH = "/tmp/staging.sqlite";
const IPC_ERROR = new Error("IPC channel closed");

describe("Test 29: staging.ts wrappers — rejected invoke propagates", () => {
  it("stagingUpsertRow propagates invoke rejection", async () => {
    mockInvoke.mockRejectedValueOnce(IPC_ERROR);

    await expect(
      stagingUpsertRow(DB_PATH, "Races", { UUID: "abc", Name: "Test" }, true),
    ).rejects.toThrow("IPC channel closed");
  });

  it("stagingMarkDeleted propagates invoke rejection", async () => {
    mockInvoke.mockRejectedValueOnce(IPC_ERROR);

    await expect(
      stagingMarkDeleted(DB_PATH, "Races", "abc"),
    ).rejects.toThrow("IPC channel closed");
  });

  it("stagingUnmarkDeleted propagates invoke rejection", async () => {
    mockInvoke.mockRejectedValueOnce(IPC_ERROR);

    await expect(
      stagingUnmarkDeleted(DB_PATH, "Races", "abc"),
    ).rejects.toThrow("IPC channel closed");
  });

  it("stagingBatchWrite propagates invoke rejection", async () => {
    mockInvoke.mockRejectedValueOnce(IPC_ERROR);

    await expect(
      stagingBatchWrite(DB_PATH, [
        { op: "Upsert", table: "Races", columns: { UUID: "abc" }, is_new: true },
      ]),
    ).rejects.toThrow("IPC channel closed");
  });

  it("stagingListSections propagates invoke rejection", async () => {
    mockInvoke.mockRejectedValueOnce(IPC_ERROR);

    await expect(
      stagingListSections(DB_PATH),
    ).rejects.toThrow("IPC channel closed");
  });

  it("stagingQuerySection propagates invoke rejection", async () => {
    mockInvoke.mockRejectedValueOnce(IPC_ERROR);

    await expect(
      stagingQuerySection(DB_PATH, "Races", false),
    ).rejects.toThrow("IPC channel closed");
  });
});
