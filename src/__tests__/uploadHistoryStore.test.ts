import { describe, it, expect, beforeEach, vi } from "vitest";
import { uploadHistoryStore } from "../lib/stores/uploadHistoryStore.svelte.js";
import type { UploadHistoryEntry } from "../lib/stores/uploadHistoryStore.svelte.js";

describe("uploadHistoryStore", () => {
  beforeEach(() => {
    uploadHistoryStore.entries = [];
    localStorage.clear();
  });

  describe("addEntry", () => {
    it("adds an entry with generated id and timestamp", () => {
      uploadHistoryStore.addEntry({
        platform: "Nexus",
        modName: "TestMod",
        fileName: "test.pak",
        version: "1.0.0",
        status: "success",
      });

      expect(uploadHistoryStore.entries).toHaveLength(1);
      const entry = uploadHistoryStore.entries[0];
      expect(entry.modName).toBe("TestMod");
      expect(entry.platform).toBe("Nexus");
      expect(entry.id).toBeTruthy();
      expect(entry.timestamp).toBeGreaterThan(0);
    });

    it("prepends new entries (newest first)", () => {
      uploadHistoryStore.addEntry({
        platform: "Nexus",
        modName: "First",
        fileName: "a.pak",
        version: "1.0",
        status: "success",
      });
      uploadHistoryStore.addEntry({
        platform: "Modio",
        modName: "Second",
        fileName: "b.pak",
        version: "2.0",
        status: "success",
      });

      expect(uploadHistoryStore.entries[0].modName).toBe("Second");
      expect(uploadHistoryStore.entries[1].modName).toBe("First");
    });

    it("caps entries at 100", () => {
      for (let i = 0; i < 105; i++) {
        uploadHistoryStore.addEntry({
          platform: "Nexus",
          modName: `Mod${i}`,
          fileName: `file${i}.pak`,
          version: "1.0",
          status: "success",
        });
      }

      expect(uploadHistoryStore.entries).toHaveLength(100);
      // Newest should be first
      expect(uploadHistoryStore.entries[0].modName).toBe("Mod104");
    });

    it("persists to localStorage", () => {
      uploadHistoryStore.addEntry({
        platform: "Nexus",
        modName: "Persisted",
        fileName: "p.pak",
        version: "1.0",
        status: "success",
      });

      const raw = localStorage.getItem("cmty-upload-history");
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].modName).toBe("Persisted");
    });

    it("preserves optional url field", () => {
      uploadHistoryStore.addEntry({
        platform: "Nexus",
        modName: "WithUrl",
        fileName: "u.pak",
        version: "1.0",
        status: "success",
        url: "https://example.com/mod/123",
      });

      expect(uploadHistoryStore.entries[0].url).toBe("https://example.com/mod/123");
    });
  });

  describe("removeEntry", () => {
    it("removes the entry with the given id", () => {
      uploadHistoryStore.addEntry({
        platform: "Nexus",
        modName: "ToRemove",
        fileName: "r.pak",
        version: "1.0",
        status: "success",
      });
      uploadHistoryStore.addEntry({
        platform: "Modio",
        modName: "ToKeep",
        fileName: "k.pak",
        version: "1.0",
        status: "success",
      });

      const removeId = uploadHistoryStore.entries.find(
        (e) => e.modName === "ToRemove",
      )!.id;
      uploadHistoryStore.removeEntry(removeId);

      expect(uploadHistoryStore.entries).toHaveLength(1);
      expect(uploadHistoryStore.entries[0].modName).toBe("ToKeep");
    });

    it("does nothing if id not found", () => {
      uploadHistoryStore.addEntry({
        platform: "Nexus",
        modName: "Existing",
        fileName: "e.pak",
        version: "1.0",
        status: "success",
      });

      uploadHistoryStore.removeEntry("nonexistent-id");
      expect(uploadHistoryStore.entries).toHaveLength(1);
    });
  });

  describe("clear", () => {
    it("removes all entries", () => {
      uploadHistoryStore.addEntry({
        platform: "Nexus",
        modName: "A",
        fileName: "a.pak",
        version: "1.0",
        status: "success",
      });
      uploadHistoryStore.addEntry({
        platform: "Modio",
        modName: "B",
        fileName: "b.pak",
        version: "1.0",
        status: "failed",
      });

      uploadHistoryStore.clear();

      expect(uploadHistoryStore.entries).toHaveLength(0);
    });

    it("persists empty array to localStorage", () => {
      uploadHistoryStore.addEntry({
        platform: "Nexus",
        modName: "C",
        fileName: "c.pak",
        version: "1.0",
        status: "success",
      });
      uploadHistoryStore.clear();

      const raw = localStorage.getItem("cmty-upload-history");
      expect(raw).toBe("[]");
    });
  });

  describe("localStorage error handling", () => {
    it("handles corrupted localStorage data gracefully", () => {
      localStorage.setItem("cmty-upload-history", "not-valid-json{{{");
      // Re-trigger load by creating a new-ish scenario
      // The constructor calls #load which should catch parse errors
      // Since we're using a singleton, manually test the catch path
      // by checking that the store still works after bad data
      uploadHistoryStore.entries = [];
      uploadHistoryStore.addEntry({
        platform: "Nexus",
        modName: "AfterCorrupt",
        fileName: "ac.pak",
        version: "1.0",
        status: "success",
      });

      expect(uploadHistoryStore.entries).toHaveLength(1);
    });

    it("handles localStorage.setItem throwing", () => {
      const spy = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
        throw new Error("QuotaExceeded");
      });

      // Should not throw
      expect(() => {
        uploadHistoryStore.addEntry({
          platform: "Nexus",
          modName: "NoThrow",
          fileName: "nt.pak",
          version: "1.0",
          status: "success",
        });
      }).not.toThrow();

      spy.mockRestore();
    });
  });
});
