import { invoke } from "@tauri-apps/api/core";

// ── Git IPC Type Definitions ────────────────────────────────────

export interface GitRepoInfo {
  isRepo: boolean;
  headBranch: string | null;
  headOid: string | null;
  isDetached: boolean;
  hasRemotes: boolean;
  clean: boolean;
  ahead: number;
  behind: number;
}

export interface GitFileStatus {
  path: string;
  status: string;  // "modified" | "added" | "deleted" | "renamed" | "untracked" | "conflicted"
  staged: boolean;
  oldPath: string | null;
}

export interface GitFileDiff {
  path: string;
  hunks: GitDiffHunk[];
  isBinary: boolean;
  oldSize: number | null;
  newSize: number | null;
}

export interface GitDiffHunk {
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: GitDiffLine[];
}

export interface GitDiffLine {
  origin: string;  // "+" | "-" | " "
  content: string;
  oldLineno: number | null;
  newLineno: number | null;
}

export interface GitCommitInfo {
  oid: string;
  shortOid: string;
  message: string;
  authorName: string;
  authorEmail: string;
  timestamp: number;
  parentCount: number;
}

export interface GitCommitDetail {
  commit: GitCommitInfo;
  files: GitFileStatus[];
  diff: GitFileDiff[];
}

export interface GitBranchInfo {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
  upstream: string | null;
  ahead: number;
  behind: number;
  lastCommitOid: string | null;
}

export interface GitRemoteInfo {
  name: string;
  url: string;
  pushUrl: string | null;
}

export interface GitStashEntry {
  index: number;
  message: string;
  oid: string;
}

export interface GitMergeResult {
  fastForward: boolean;
  conflicts: string[];
  mergeCommit: string | null;
}

export interface GitPullResult {
  mergeResult: GitMergeResult;
  fetchedObjects: number;
}

export type ForgeType = "GitHub" | "GitLab" | "Gitea" | "Unknown";

export interface ForgeInfo {
  forgeType: ForgeType;
  host: string;
  apiBase: string;
  forgeId: string;
  owner: string | null;
  repo: string | null;
}

export interface ForgeUser {
  login: string;
  name: string | null;
  avatarUrl: string;
  forgeId: string;
}

export interface ForgeRepo {
  fullName: string;
  htmlUrl: string;
  cloneUrl: string;
  private: boolean;
  description: string | null;
  defaultBranch: string;
}

export interface ForgePR {
  number: number;
  title: string;
  state: string;
  author: string;
  createdAt: string;
  htmlUrl: string;
  headRef: string;
  baseRef: string;
}

export interface ForgeIssue {
  number: number;
  title: string;
  state: string;
  author: string;
  createdAt: string;
  htmlUrl: string;
  labels: string[];
}

// ── Repository Commands ─────────────────────────────────────────

export async function gitInit(modPath: string): Promise<GitRepoInfo> {
  return invoke("cmd_git_init", { modPath });
}

export async function gitClone(url: string, targetPath: string): Promise<GitRepoInfo> {
  return invoke("cmd_git_clone", { url, targetPath });
}

export async function gitRepoInfo(modPath: string): Promise<GitRepoInfo | null> {
  return invoke("cmd_git_repo_info", { modPath });
}

export async function gitOpen(modPath: string): Promise<GitRepoInfo> {
  return invoke("cmd_git_open", { modPath });
}

// ── Working Tree Commands ───────────────────────────────────────

export async function gitStatus(modPath: string): Promise<GitFileStatus[]> {
  return invoke("cmd_git_status", { modPath });
}

export async function gitStage(modPath: string, paths: string[]): Promise<void> {
  return invoke("cmd_git_stage", { modPath, paths });
}

export async function gitStageAll(modPath: string): Promise<void> {
  return invoke("cmd_git_stage_all", { modPath });
}

export async function gitUnstage(modPath: string, paths: string[]): Promise<void> {
  return invoke("cmd_git_unstage", { modPath, paths });
}

export async function gitDiscard(modPath: string, paths: string[]): Promise<void> {
  return invoke("cmd_git_discard", { modPath, paths });
}

export async function gitDiffFile(modPath: string, path: string, staged: boolean): Promise<GitFileDiff> {
  return invoke("cmd_git_diff_file", { modPath, path, staged });
}

// ── Commit Commands ─────────────────────────────────────────────

export async function gitCommit(modPath: string, message: string): Promise<GitCommitInfo> {
  return invoke("cmd_git_commit", { modPath, message });
}

export async function gitAmend(modPath: string, message?: string): Promise<GitCommitInfo> {
  return invoke("cmd_git_amend", { modPath, message: message ?? null });
}

export async function gitLog(modPath: string, limit: number, offset: number): Promise<GitCommitInfo[]> {
  return invoke("cmd_git_log", { modPath, limit, offset });
}

export async function gitShow(modPath: string, commitOid: string): Promise<GitCommitDetail> {
  return invoke("cmd_git_show", { modPath, commitOid });
}
