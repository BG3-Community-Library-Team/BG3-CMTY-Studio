/**
 * gitStore tests — validates Git repository state management, IPC calls,
 * forge detection/auto-refresh, and error handling with mocked Tauri backend.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockConsoleError, expectConsoleCalled } from "./helpers/suppressConsole.js";

import type {
  GitRepoInfo,
  GitFileStatus,
  GitBranchInfo,
  GitCommitInfo,
  GitRemoteInfo,
  ForgeInfo,
  ForgeUser,
  ForgePR,
  ForgeIssue,
  ForgeIssueDetail,
} from "../lib/tauri/git.js";

// Mock the tauri git IPC wrapper module
vi.mock("../lib/tauri/git.js", () => ({
  gitRepoInfo: vi.fn(),
  gitStatus: vi.fn(),
  gitInit: vi.fn(),
  gitStage: vi.fn(),
  gitStageAll: vi.fn(),
  gitUnstage: vi.fn(),
  gitDiscard: vi.fn(),
  gitCommit: vi.fn(),
  gitAmend: vi.fn(),
  gitLog: vi.fn(),
  gitDiffFile: vi.fn(),
  gitBranches: vi.fn(),
  gitCheckout: vi.fn(),
  gitCreateBranch: vi.fn(),
  gitDeleteBranch: vi.fn(),
  gitMerge: vi.fn(),
  gitShow: vi.fn(),
  gitFetch: vi.fn(),
  gitPull: vi.fn(),
  gitPush: vi.fn(),
  gitStash: vi.fn(),
  gitStashList: vi.fn(),
  gitStashApply: vi.fn(),
  gitStashDrop: vi.fn(),
  gitRemotes: vi.fn(),
  forgeDetect: vi.fn(),
  forgeAuthStatus: vi.fn(),
  forgeListPrs: vi.fn(),
  forgeListIssues: vi.fn(),
  forgeGetIssue: vi.fn(),
  forgeAssignIssue: vi.fn(),
}));

import { gitStore } from "../lib/stores/gitStore.svelte.js";
import {
  gitRepoInfo,
  gitStatus,
  gitStage,
  gitCommit,
  gitAmend,
  gitLog,
  gitBranches,
  gitStashList,
  gitRemotes,
  gitFetch,
  gitPush,
  forgeDetect,
  forgeAuthStatus,
  forgeListPrs,
  forgeListIssues,
  forgeGetIssue,
  forgeAssignIssue,
} from "../lib/tauri/git.js";

const MOD_PATH = "/home/user/mods/TestMod";

// ── Fixtures ────────────────────────────────────────────────

const MOCK_REPO_INFO: GitRepoInfo = {
  isRepo: true,
  headBranch: "main",
  headOid: "abc1234",
  isDetached: false,
  hasRemotes: true,
  clean: true,
  ahead: 0,
  behind: 0,
  shallow: false,
  bare: false,
  submodules: [],
};

const MOCK_STATUS: GitFileStatus[] = [
  { path: "src/main.rs", status: "modified", staged: true, oldPath: null },
  { path: "README.md", status: "modified", staged: false, oldPath: null },
  { path: "new_file.txt", status: "untracked", staged: false, oldPath: null },
];

const MOCK_BRANCHES: GitBranchInfo[] = [
  { name: "main", isCurrent: true, isRemote: false, upstream: "origin/main", ahead: 0, behind: 0, lastCommitOid: "abc1234" },
  { name: "feature", isCurrent: false, isRemote: false, upstream: null, ahead: 1, behind: 0, lastCommitOid: "def5678" },
];

const MOCK_COMMITS: GitCommitInfo[] = [
  { oid: "abc1234", shortOid: "abc1234", message: "Initial commit", authorName: "Test", authorEmail: "test@example.com", timestamp: 1700000000, parentCount: 0 },
  { oid: "def5678", shortOid: "def5678", message: "Add feature", authorName: "Test", authorEmail: "test@example.com", timestamp: 1700001000, parentCount: 1 },
];

const MOCK_REMOTE: GitRemoteInfo = { name: "origin", url: "https://github.com/user/repo.git", pushUrl: null };

const MOCK_FORGE_INFO: ForgeInfo = {
  forgeType: "GitHub",
  host: "github.com",
  apiBase: "https://api.github.com",
  forgeId: "github",
  owner: "user",
  repo: "repo",
};

const MOCK_FORGE_USER: ForgeUser = {
  login: "user",
  name: "Test User",
  avatarUrl: "https://github.com/user.png",
  forgeId: "github",
};

const MOCK_PR: ForgePR = {
  number: 1,
  title: "Fix bug",
  state: "open",
  author: "user",
  createdAt: "2025-01-01T00:00:00Z",
  htmlUrl: "https://github.com/user/repo/pull/1",
  headRef: "fix-bug",
  baseRef: "main",
  mergeable: true,
};

const MOCK_ISSUE: ForgeIssue = {
  number: 10,
  title: "Bug report",
  state: "open",
  author: "reporter",
  createdAt: "2025-01-01T00:00:00Z",
  htmlUrl: "https://github.com/user/repo/issues/10",
  labels: ["bug"],
  assignee: null,
};

// ── Setup / teardown ────────────────────────────────────────

/** Default mocks that let refresh() and its internal calls succeed. */
function setupDefaultMocks(): void {
  vi.mocked(gitRepoInfo).mockResolvedValue(MOCK_REPO_INFO);
  vi.mocked(gitStatus).mockResolvedValue(MOCK_STATUS);
  vi.mocked(gitBranches).mockResolvedValue(MOCK_BRANCHES);
  vi.mocked(gitStashList).mockResolvedValue([]);
  vi.mocked(gitRemotes).mockResolvedValue([MOCK_REMOTE]);
  // detectForge is fire-and-forget inside refresh — default to "Unknown" forge
  vi.mocked(forgeDetect).mockResolvedValue({ ...MOCK_FORGE_INFO, forgeType: "Unknown" });
  vi.mocked(forgeAuthStatus).mockResolvedValue(null);
  vi.mocked(forgeListPrs).mockResolvedValue([]);
  vi.mocked(forgeListIssues).mockResolvedValue([]);
  vi.mocked(gitLog).mockResolvedValue([]);
}

function resetStoreState(): void {
  gitStore.isRepo = false;
  gitStore.repoInfo = null;
  gitStore.isLoading = false;
  gitStore.stagedFiles = [];
  gitStore.unstagedFiles = [];
  gitStore.untrackedFiles = [];
  gitStore.conflictedFiles = [];
  gitStore.commitMessage = "";
  gitStore.isCommitting = false;
  gitStore.commits = [];
  gitStore.branches = [];
  gitStore.currentBranch = null;
  gitStore.commitsLoading = false;
  gitStore.commitsHasMore = true;
  gitStore.selectedCommit = null;
  gitStore.selectedFileDiff = null;
  gitStore.syncProgress = null;
  gitStore.isSyncing = false;
  gitStore.stashes = [];
  gitStore.remotes = [];
  gitStore.forgeInfo = null;
  gitStore.forgeUser = null;
  gitStore.forgeConnected = false;
  gitStore.prs = [];
  gitStore.issues = [];
}

/** Flush fire-and-forget microtasks (e.g. unawaited refreshForge inside detectForge). */
function flushAsync(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

beforeEach(() => {
  vi.clearAllMocks();
  resetStoreState();
  setupDefaultMocks();
});

// ── Tests ───────────────────────────────────────────────────

describe("gitStore", () => {
  // ── Initial state ───────────────────────────────────────

  describe("initial state", () => {
    it("has correct defaults after reset", () => {
      expect(gitStore.isRepo).toBe(false);
      expect(gitStore.repoInfo).toBeNull();
      expect(gitStore.stagedFiles).toEqual([]);
      expect(gitStore.unstagedFiles).toEqual([]);
      expect(gitStore.untrackedFiles).toEqual([]);
      expect(gitStore.conflictedFiles).toEqual([]);
      expect(gitStore.commits).toEqual([]);
      expect(gitStore.branches).toEqual([]);
      expect(gitStore.currentBranch).toBeNull();
      expect(gitStore.forgeInfo).toBeNull();
      expect(gitStore.forgeUser).toBeNull();
      expect(gitStore.forgeConnected).toBe(false);
      expect(gitStore.prs).toEqual([]);
      expect(gitStore.issues).toEqual([]);
      expect(gitStore.changedFileCount).toBe(0);
    });
  });

  // ── refresh() ───────────────────────────────────────────

  describe("refresh()", () => {
    it("populates repo info and file status on success", async () => {
      await gitStore.refresh(MOD_PATH);

      expect(gitStore.isRepo).toBe(true);
      expect(gitStore.repoInfo).toEqual(MOCK_REPO_INFO);
      expect(gitStore.currentBranch).toBe("main");
      expect(gitStore.stagedFiles).toHaveLength(1);
      expect(gitStore.stagedFiles[0].path).toBe("src/main.rs");
      expect(gitStore.unstagedFiles).toHaveLength(1);
      expect(gitStore.unstagedFiles[0].path).toBe("README.md");
      expect(gitStore.untrackedFiles).toHaveLength(1);
      expect(gitStore.untrackedFiles[0].path).toBe("new_file.txt");
      expect(gitStore.isLoading).toBe(false);
    });

    it("sets isRepo=false when gitRepoInfo returns null", async () => {
      vi.mocked(gitRepoInfo).mockResolvedValueOnce(null);

      await gitStore.refresh(MOD_PATH);

      expect(gitStore.isRepo).toBe(false);
      expect(gitStore.repoInfo).toBeNull();
      expect(gitStore.stagedFiles).toEqual([]);
    });

    it("sets isRepo=false when repo info says not a repo", async () => {
      vi.mocked(gitRepoInfo).mockResolvedValueOnce({ ...MOCK_REPO_INFO, isRepo: false });

      await gitStore.refresh(MOD_PATH);

      expect(gitStore.isRepo).toBe(false);
    });

    it("no-ops when modPath is empty", async () => {
      await gitStore.refresh("");

      expect(gitRepoInfo).not.toHaveBeenCalled();
      expect(gitStore.isRepo).toBe(false);
    });

    it("handles IPC error gracefully without corrupting state", async () => {
      const spy = mockConsoleError();
      vi.mocked(gitRepoInfo).mockRejectedValueOnce(new Error("IPC failed"));

      await gitStore.refresh(MOD_PATH);

      expect(gitStore.isRepo).toBe(false);
      expect(gitStore.repoInfo).toBeNull();
      expect(gitStore.stagedFiles).toEqual([]);
      expect(gitStore.isLoading).toBe(false);
      expectConsoleCalled(spy, "Git refresh failed");
      spy.mockRestore();
    });

    it("correctly classifies conflicted files", async () => {
      vi.mocked(gitStatus).mockResolvedValueOnce([
        { path: "conflict.txt", status: "conflicted", staged: false, oldPath: null },
        ...MOCK_STATUS,
      ]);

      await gitStore.refresh(MOD_PATH);

      expect(gitStore.conflictedFiles).toHaveLength(1);
      expect(gitStore.conflictedFiles[0].path).toBe("conflict.txt");
    });
  });

  // ── stage() ─────────────────────────────────────────────

  describe("stage()", () => {
    it("calls gitStage with correct arguments", async () => {
      vi.mocked(gitStage).mockResolvedValueOnce(undefined);

      await gitStore.stage(MOD_PATH, ["src/main.rs"]);

      expect(gitStage).toHaveBeenCalledWith(MOD_PATH, ["src/main.rs"]);
    });
  });

  // ── commit() ────────────────────────────────────────────

  describe("commit()", () => {
    it("calls gitCommit and clears message on success", async () => {
      vi.mocked(gitCommit).mockResolvedValueOnce(MOCK_COMMITS[0]);
      gitStore.commitMessage = "Test commit message";

      await gitStore.commit(MOD_PATH);

      expect(gitCommit).toHaveBeenCalledWith(MOD_PATH, "Test commit message");
      expect(gitStore.commitMessage).toBe("");
      expect(gitStore.isCommitting).toBe(false);
    });

    it("does nothing when commit message is empty", async () => {
      gitStore.commitMessage = "";

      await gitStore.commit(MOD_PATH);

      expect(gitCommit).not.toHaveBeenCalled();
    });

    it("does nothing when commit message is only whitespace", async () => {
      gitStore.commitMessage = "   \t\n  ";

      await gitStore.commit(MOD_PATH);

      expect(gitCommit).not.toHaveBeenCalled();
    });

    it("resets isCommitting even on IPC failure", async () => {
      vi.mocked(gitCommit).mockRejectedValueOnce(new Error("commit failed"));
      gitStore.commitMessage = "Fail commit";

      await expect(gitStore.commit(MOD_PATH)).rejects.toThrow("commit failed");

      expect(gitStore.isCommitting).toBe(false);
    });
  });

  // ── amend() ─────────────────────────────────────────────

  describe("amend()", () => {
    it("calls gitAmend and refreshes", async () => {
      vi.mocked(gitAmend).mockResolvedValueOnce(MOCK_COMMITS[0]);

      await gitStore.amend(MOD_PATH, "Amended message");

      expect(gitAmend).toHaveBeenCalledWith(MOD_PATH, "Amended message");
      expect(gitStore.isCommitting).toBe(false);
    });
  });

  // ── loadHistory() ───────────────────────────────────────

  describe("loadHistory()", () => {
    it("populates commits on success", async () => {
      vi.mocked(gitLog).mockResolvedValueOnce(MOCK_COMMITS);

      await gitStore.loadHistory(MOD_PATH);

      expect(gitStore.commits).toEqual(MOCK_COMMITS);
      expect(gitStore.commitsLoading).toBe(false);
    });

    it("sets commitsHasMore=false when fewer results than limit", async () => {
      vi.mocked(gitLog).mockResolvedValueOnce([MOCK_COMMITS[0]]);

      await gitStore.loadHistory(MOD_PATH, 50);

      expect(gitStore.commitsHasMore).toBe(false);
    });

    it("sets commitsHasMore=true when results fill the page", async () => {
      const fullPage = Array.from({ length: 50 }, (_, i) => ({
        ...MOCK_COMMITS[0],
        oid: `oid_${i}`,
      }));
      vi.mocked(gitLog).mockResolvedValueOnce(fullPage);

      await gitStore.loadHistory(MOD_PATH, 50);

      expect(gitStore.commitsHasMore).toBe(true);
    });

    it("handles error gracefully", async () => {
      vi.mocked(gitLog).mockRejectedValueOnce(new Error("log failed"));

      await gitStore.loadHistory(MOD_PATH);

      expect(gitStore.commits).toEqual([]);
      expect(gitStore.commitsHasMore).toBe(false);
      expect(gitStore.commitsLoading).toBe(false);
    });
  });

  // ── detectForge() ───────────────────────────────────────

  describe("detectForge()", () => {
    it("populates forgeInfo when remote detected", async () => {
      vi.mocked(forgeDetect).mockResolvedValueOnce(MOCK_FORGE_INFO);
      vi.mocked(forgeAuthStatus).mockResolvedValueOnce(null);

      await gitStore.detectForge(MOD_PATH);

      expect(gitStore.forgeInfo).toEqual(MOCK_FORGE_INFO);
      expect(gitStore.forgeConnected).toBe(false);
      expect(gitStore.forgeUser).toBeNull();
    });

    it("clears forge state when no remotes exist", async () => {
      vi.mocked(gitRemotes).mockResolvedValueOnce([]);

      await gitStore.detectForge(MOD_PATH);

      expect(gitStore.forgeInfo).toBeNull();
      expect(gitStore.forgeUser).toBeNull();
      expect(gitStore.forgeConnected).toBe(false);
      expect(forgeDetect).not.toHaveBeenCalled();
    });

    it("sets forgeConnected=false for Unknown forge type", async () => {
      vi.mocked(forgeDetect).mockResolvedValueOnce({ ...MOCK_FORGE_INFO, forgeType: "Unknown" });

      await gitStore.detectForge(MOD_PATH);

      expect(gitStore.forgeConnected).toBe(false);
      expect(gitStore.forgeUser).toBeNull();
      expect(forgeAuthStatus).not.toHaveBeenCalled();
    });

    it("auto-refreshes PRs/issues when authenticated (Sprint 27 fix)", async () => {
      vi.mocked(forgeDetect).mockResolvedValueOnce(MOCK_FORGE_INFO);
      vi.mocked(forgeAuthStatus).mockResolvedValueOnce(MOCK_FORGE_USER);
      vi.mocked(forgeListPrs).mockResolvedValueOnce([MOCK_PR]);
      vi.mocked(forgeListIssues).mockResolvedValueOnce([MOCK_ISSUE]);

      await gitStore.detectForge(MOD_PATH);
      // refreshForge() is fire-and-forget inside detectForge — flush microtasks
      await flushAsync();

      expect(gitStore.forgeConnected).toBe(true);
      expect(gitStore.forgeUser).toEqual(MOCK_FORGE_USER);
      expect(gitStore.prs).toHaveLength(1);
      expect(gitStore.prs[0].title).toBe("Fix bug");
      expect(gitStore.issues).toHaveLength(1);
      expect(gitStore.issues[0].title).toBe("Bug report");
    });

    it("handles forge detection error gracefully", async () => {
      const spy = mockConsoleError();
      vi.mocked(gitRemotes).mockRejectedValueOnce(new Error("network error"));

      await gitStore.detectForge(MOD_PATH);

      expect(gitStore.forgeInfo).toBeNull();
      expect(gitStore.forgeConnected).toBe(false);
      expectConsoleCalled(spy, "Forge detection failed");
      spy.mockRestore();
    });
  });

  // ── refreshForge() ──────────────────────────────────────

  describe("refreshForge()", () => {
    it("populates PRs and issues when connected", async () => {
      gitStore.forgeInfo = MOCK_FORGE_INFO;
      gitStore.forgeConnected = true;

      vi.mocked(forgeListPrs).mockResolvedValueOnce([MOCK_PR]);
      vi.mocked(forgeListIssues).mockResolvedValueOnce([MOCK_ISSUE]);

      await gitStore.refreshForge();

      expect(gitStore.prs).toEqual([MOCK_PR]);
      expect(gitStore.issues).toEqual([MOCK_ISSUE]);
    });

    it("no-ops when not connected", async () => {
      gitStore.forgeInfo = MOCK_FORGE_INFO;
      gitStore.forgeConnected = false;

      await gitStore.refreshForge();

      expect(forgeListPrs).not.toHaveBeenCalled();
    });

    it("no-ops when forgeInfo is missing owner/repo", async () => {
      gitStore.forgeInfo = { ...MOCK_FORGE_INFO, owner: null, repo: null };
      gitStore.forgeConnected = true;

      await gitStore.refreshForge();

      expect(forgeListPrs).not.toHaveBeenCalled();
    });

    it("handles error without clearing existing data", async () => {
      const spy = mockConsoleError();
      gitStore.forgeInfo = MOCK_FORGE_INFO;
      gitStore.forgeConnected = true;
      gitStore.prs = [MOCK_PR];

      vi.mocked(forgeListPrs).mockRejectedValueOnce(new Error("API error"));

      await gitStore.refreshForge();

      // Existing data preserved on error (no assignment runs)
      expect(gitStore.prs).toEqual([MOCK_PR]);
      expectConsoleCalled(spy, "Forge refresh failed");
      spy.mockRestore();
    });
  });

  // ── Forge IPC wrappers ──────────────────────────────────

  describe("forge IPC wrappers", () => {
    it("forgeGetIssue returns full issue detail with body, labels, assignees, milestone", async () => {
      const mockDetail: ForgeIssueDetail = {
        number: 42,
        title: "UI Bug",
        state: "open",
        author: "reporter",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-02T00:00:00Z",
        htmlUrl: "https://github.com/user/repo/issues/42",
        body: "Steps to reproduce:\n1. Open app\n2. Click button",
        labels: ["bug", "ui"],
        assignees: ["dev1", "dev2"],
        milestone: "v1.0",
        closedAt: null,
      };
      vi.mocked(forgeGetIssue).mockResolvedValueOnce(mockDetail);

      const result = await forgeGetIssue(
        "github.com", "GitHub", "https://api.github.com", "user", "repo", 42,
      );

      expect(result).toEqual(mockDetail);
      expect(result.body).toContain("Steps to reproduce");
      expect(result.labels).toEqual(["bug", "ui"]);
      expect(result.assignees).toHaveLength(2);
      expect(result.milestone).toBe("v1.0");
    });

    it("forgeAssignIssue invokes with correct parameters", async () => {
      vi.mocked(forgeAssignIssue).mockResolvedValueOnce(undefined);

      await forgeAssignIssue(
        "github.com", "GitHub", "https://api.github.com", "user", "repo", 42, "contributor",
      );

      expect(forgeAssignIssue).toHaveBeenCalledWith(
        "github.com", "GitHub", "https://api.github.com", "user", "repo", 42, "contributor",
      );
    });
  });

  // ── Sync operations ─────────────────────────────────────

  describe("sync operations", () => {
    it("fetch() sets and clears isSyncing/syncProgress", async () => {
      vi.mocked(gitFetch).mockResolvedValueOnce(undefined as any);

      const promise = gitStore.fetch(MOD_PATH);
      expect(gitStore.isSyncing).toBe(true);
      expect(gitStore.syncProgress).toBe("Fetching…");

      await promise;
      await flushAsync();

      expect(gitStore.isSyncing).toBe(false);
      expect(gitStore.syncProgress).toBeNull();
    });

    it("push() clears sync state on completion", async () => {
      vi.mocked(gitPush).mockResolvedValueOnce(undefined);

      await gitStore.push(MOD_PATH);

      expect(gitStore.isSyncing).toBe(false);
      expect(gitStore.syncProgress).toBeNull();
    });
  });

  // ── changedFileCount ────────────────────────────────────

  describe("changedFileCount", () => {
    it("sums all changed file categories", () => {
      gitStore.stagedFiles = [MOCK_STATUS[0]];
      gitStore.unstagedFiles = [MOCK_STATUS[1]];
      gitStore.untrackedFiles = [MOCK_STATUS[2]];
      gitStore.conflictedFiles = [
        { path: "conflict.txt", status: "conflicted", staged: false, oldPath: null },
      ];

      expect(gitStore.changedFileCount).toBe(4);
    });

    it("returns 0 when all arrays are empty", () => {
      expect(gitStore.changedFileCount).toBe(0);
    });
  });
});
