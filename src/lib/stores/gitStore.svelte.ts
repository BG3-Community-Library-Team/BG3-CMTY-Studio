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
  type GitRepoInfo,
  type GitFileStatus,
  type GitFileDiff,
  type GitCommitInfo,
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

  /** Load commit history */
  async loadHistory(
    modPath: string,
    limit = 50,
    offset = 0,
  ): Promise<void> {
    try {
      this.commits = await gitLog(modPath, limit, offset);
    } catch {
      this.commits = [];
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

  // ── Polling control ───────────────────────────────────────

  /** Start polling status (call when Git panel mounts) */
  startPolling(modPath: string): void {
    if (this._pollActive) return;
    this._pollActive = true;
    this._pollTimer = setInterval(() => {
      if (this._pollActive && !this.isLoading) {
        this.refresh(modPath);
      }
    }, 3000);
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
