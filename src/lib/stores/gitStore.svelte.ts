import {
  gitRepoInfo,
  gitStatus,
  gitInit,
  gitStage,
  gitStageAll,
  gitUnstage,
  gitDiscard,
  gitCommit,
  gitAmend,
  gitLog,
  gitDiffFile,
  gitBranches,
  gitCheckout,
  gitCreateBranch,
  gitDeleteBranch,
  gitMerge,
  gitShow,
  type GitRepoInfo,
  type GitFileStatus,
  type GitFileDiff,
  type GitCommitInfo,
  type GitBranchInfo,
  type GitCommitDetail,
  type GitMergeResult,
} from "../tauri/git.js";

class GitStore {
  // ── Repo state ────────────────────────────────────────────
  isRepo = $state(false);
  repoInfo = $state<GitRepoInfo | null>(null);
  isLoading = $state(false);

  // ── Working tree ──────────────────────────────────────────
  stagedFiles = $state<GitFileStatus[]>([]);
  unstagedFiles = $state<GitFileStatus[]>([]);
  untrackedFiles = $state<GitFileStatus[]>([]);
  conflictedFiles = $state<GitFileStatus[]>([]);

  // ── Commit ────────────────────────────────────────────────
  commitMessage = $state("");
  isCommitting = $state(false);

  // ── History ───────────────────────────────────────────────
  commits = $state<GitCommitInfo[]>([]);

  // ── Diff ──────────────────────────────────────────────────
  selectedFileDiff = $state<GitFileDiff | null>(null);
  diffViewMode = $state<"unified" | "split">("unified");

  // ── Branches ──────────────────────────────────────────────
  branches = $state<GitBranchInfo[]>([]);
  currentBranch = $state<string | null>(null);

  // ── History pagination ────────────────────────────────────
  commitsLoading = $state(false);
  commitsHasMore = $state(true);
  selectedCommit = $state<GitCommitDetail | null>(null);
  private _historyOffset = 0;
  private _historyLimit = 50;

  // ── Polling ───────────────────────────────────────────────
  private _pollActive = false;
  private _pollTimer: ReturnType<typeof setInterval> | null = null;
  private _refreshDebounce: ReturnType<typeof setTimeout> | null = null;

  /** Total count of changed files (staged + unstaged + untracked + conflicted) for badge */
  get changedFileCount(): number {
    return (
      this.stagedFiles.length +
      this.unstagedFiles.length +
      this.untrackedFiles.length +
      this.conflictedFiles.length
    );
  }

  /** Refresh repo info and file status for the given mod path */
  async refresh(modPath: string): Promise<void> {
    if (!modPath) return;
    this.isLoading = true;
    try {
      const info = await gitRepoInfo(modPath);
      if (!info || !info.isRepo) {
        this.isRepo = false;
        this.repoInfo = null;
        this._clearFiles();
        return;
      }
      this.isRepo = true;
      this.repoInfo = info;
      this.currentBranch = info.headBranch ?? null;

      const statuses = await gitStatus(modPath);
      this.stagedFiles = statuses.filter(
        (f) => f.staged && f.status !== "conflicted",
      );
      this.unstagedFiles = statuses.filter(
        (f) =>
          !f.staged &&
          f.status !== "untracked" &&
          f.status !== "conflicted",
      );
      this.untrackedFiles = statuses.filter(
        (f) => f.status === "untracked",
      );
      this.conflictedFiles = statuses.filter(
        (f) => f.status === "conflicted",
      );

      // Also refresh branch list
      this.refreshBranches(modPath);
    } catch (err) {
      console.error("Git refresh failed:", err);
      this.isRepo = false;
      this.repoInfo = null;
      this._clearFiles();
    } finally {
      this.isLoading = false;
    }
  }

  /** Initialize a new git repo */
  async init(modPath: string): Promise<void> {
    const info = await gitInit(modPath);
    this.isRepo = true;
    this.repoInfo = info;
    await this.refresh(modPath);
  }

  /** Stage specific files */
  async stage(modPath: string, paths: string[]): Promise<void> {
    await gitStage(modPath, paths);
    this._debouncedRefresh(modPath);
  }

  /** Stage all changes */
  async stageAll(modPath: string): Promise<void> {
    await gitStageAll(modPath);
    this._debouncedRefresh(modPath);
  }

  /** Unstage specific files */
  async unstage(modPath: string, paths: string[]): Promise<void> {
    await gitUnstage(modPath, paths);
    this._debouncedRefresh(modPath);
  }

  /** Discard changes to specific files */
  async discard(modPath: string, paths: string[]): Promise<void> {
    await gitDiscard(modPath, paths);
    this._debouncedRefresh(modPath);
  }

  /** Commit staged changes */
  async commit(modPath: string): Promise<void> {
    if (!this.commitMessage.trim()) return;
    this.isCommitting = true;
    try {
      await gitCommit(modPath, this.commitMessage);
      this.commitMessage = "";
      await this.refresh(modPath);
      await this.loadHistory(modPath);
    } finally {
      this.isCommitting = false;
    }
  }

  /** Amend the last commit */
  async amend(modPath: string, message?: string): Promise<void> {
    this.isCommitting = true;
    try {
      await gitAmend(modPath, message);
      await this.refresh(modPath);
      await this.loadHistory(modPath);
    } finally {
      this.isCommitting = false;
    }
  }

  /** Load commit history (resets pagination) */
  async loadHistory(
    modPath: string,
    limit = 50,
    offset = 0,
  ): Promise<void> {
    this.commitsLoading = true;
    this._historyOffset = offset;
    this._historyLimit = limit;
    try {
      this.commits = await gitLog(modPath, limit, offset);
      this.commitsHasMore = this.commits.length >= limit;
    } catch {
      this.commits = [];
      this.commitsHasMore = false;
    } finally {
      this.commitsLoading = false;
    }
  }

  /** Load diff for a specific file */
  async loadFileDiff(
    modPath: string,
    path: string,
    staged: boolean,
  ): Promise<void> {
    try {
      this.selectedFileDiff = await gitDiffFile(modPath, path, staged);
    } catch (err) {
      console.error("Failed to load diff:", err);
      this.selectedFileDiff = null;
    }
  }

  // ── Branch operations ─────────────────────────────────────

  /** Refresh the branch list and current branch */
  async refreshBranches(modPath: string): Promise<void> {
    try {
      this.branches = await gitBranches(modPath);
      const current = this.branches.find(b => b.isCurrent && !b.isRemote);
      this.currentBranch = current?.name ?? this.repoInfo?.headBranch ?? null;
    } catch (err) {
      console.error("Failed to refresh branches:", err);
      this.branches = [];
    }
  }

  /** Switch to a different branch */
  async checkout(modPath: string, branch: string): Promise<void> {
    await gitCheckout(modPath, branch);
    await this.refresh(modPath);
    await this.refreshBranches(modPath);
    await this.loadHistory(modPath);
  }

  /** Create a new branch, optionally from a specific commit */
  async createBranch(modPath: string, name: string, from?: string): Promise<GitBranchInfo> {
    const info = await gitCreateBranch(modPath, name, from);
    await this.refreshBranches(modPath);
    return info;
  }

  /** Delete a branch */
  async deleteBranch(modPath: string, name: string): Promise<void> {
    await gitDeleteBranch(modPath, name);
    await this.refreshBranches(modPath);
  }

  /** Merge a branch into the current branch */
  async merge(modPath: string, branch: string): Promise<GitMergeResult> {
    const result = await gitMerge(modPath, branch);
    await this.refresh(modPath);
    await this.refreshBranches(modPath);
    await this.loadHistory(modPath);
    return result;
  }

  // ── History with pagination ───────────────────────────────

  /** Load more history (append to existing commits) */
  async loadMore(modPath: string): Promise<void> {
    if (this.commitsLoading || !this.commitsHasMore) return;
    this.commitsLoading = true;
    try {
      this._historyOffset += this._historyLimit;
      const more = await gitLog(modPath, this._historyLimit, this._historyOffset);
      if (more.length < this._historyLimit) {
        this.commitsHasMore = false;
      }
      this.commits = [...this.commits, ...more];
    } catch {
      this.commitsHasMore = false;
    } finally {
      this.commitsLoading = false;
    }
  }

  /** Select a commit and load its full detail */
  async selectCommit(modPath: string, oid: string): Promise<void> {
    try {
      this.selectedCommit = await gitShow(modPath, oid);
    } catch (err) {
      console.error("Failed to load commit detail:", err);
      this.selectedCommit = null;
    }
  }

  // ── Polling control ───────────────────────────────────────

  /** Start polling status (call when Git panel mounts).
   *  Polls every 30s — mutations call refresh() directly for instant feedback. */
  startPolling(modPath: string): void {
    if (this._pollActive) return;
    this._pollActive = true;
    this._pollTimer = setInterval(() => {
      if (this._pollActive && !this.isLoading) {
        this.refresh(modPath);
      }
    }, 30_000);
  }

  /** Stop polling status (call when Git panel unmounts) */
  stopPolling(): void {
    this._pollActive = false;
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  // ── Private helpers ───────────────────────────────────────

  private _clearFiles(): void {
    this.stagedFiles = [];
    this.unstagedFiles = [];
    this.untrackedFiles = [];
    this.conflictedFiles = [];
  }

  private _debouncedRefresh(modPath: string): void {
    if (this._refreshDebounce) clearTimeout(this._refreshDebounce);
    this._refreshDebounce = setTimeout(() => {
      this.refresh(modPath);
    }, 300);
  }
}

export const gitStore = new GitStore();
