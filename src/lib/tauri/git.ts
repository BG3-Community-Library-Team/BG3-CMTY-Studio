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

// ── Branch Commands ─────────────────────────────────────────

export async function gitBranches(modPath: string): Promise<GitBranchInfo[]> {
  return invoke("cmd_git_branches", { modPath });
}

export async function gitCheckout(modPath: string, branch: string): Promise<void> {
  return invoke("cmd_git_checkout", { modPath, branch });
}

export async function gitCreateBranch(modPath: string, name: string, from?: string): Promise<GitBranchInfo> {
  return invoke("cmd_git_create_branch", { modPath, name, from: from ?? null });
}

export async function gitDeleteBranch(modPath: string, name: string): Promise<void> {
  return invoke("cmd_git_delete_branch", { modPath, name });
}

export async function gitMerge(modPath: string, branch: string): Promise<GitMergeResult> {
  return invoke("cmd_git_merge", { modPath, branch });
}

// ── Commit Detail Command ───────────────────────────────────

export async function gitShow(modPath: string, commitOid: string): Promise<GitCommitDetail> {
  return invoke("cmd_git_show", { modPath, commitOid });
}

// ── Remote Commands ─────────────────────────────────────────

export async function gitRemotes(modPath: string): Promise<GitRemoteInfo[]> {
  return invoke("cmd_git_remotes", { modPath });
}

export async function gitAddRemote(modPath: string, name: string, url: string): Promise<void> {
  return invoke("cmd_git_add_remote", { modPath, name, url });
}

export async function gitRemoveRemote(modPath: string, name: string): Promise<void> {
  return invoke("cmd_git_remove_remote", { modPath, name });
}

export async function gitFetch(modPath: string, remoteName?: string): Promise<number> {
  return invoke("cmd_git_fetch", { modPath, remoteName: remoteName ?? null });
}

export async function gitPull(modPath: string, remoteName?: string): Promise<GitPullResult> {
  return invoke("cmd_git_pull", { modPath, remoteName: remoteName ?? null });
}

export async function gitPush(modPath: string, remoteName?: string, force?: boolean): Promise<void> {
  return invoke("cmd_git_push", { modPath, remoteName: remoteName ?? null, force: force ?? null });
}

// ── Stash Commands ──────────────────────────────────────────

export async function gitStash(modPath: string, message?: string): Promise<void> {
  return invoke("cmd_git_stash", { modPath, message: message ?? null });
}

export async function gitStashList(modPath: string): Promise<GitStashEntry[]> {
  return invoke("cmd_git_stash_list", { modPath });
}

export async function gitStashApply(modPath: string, index: number): Promise<void> {
  return invoke("cmd_git_stash_apply", { modPath, index });
}

export async function gitStashDrop(modPath: string, index: number): Promise<void> {
  return invoke("cmd_git_stash_drop", { modPath, index });
}

// ── Forge Commands ──────────────────────────────────────────

export async function forgeDetect(remoteUrl: string): Promise<ForgeInfo> {
  return invoke("cmd_forge_detect", { remoteUrl });
}

export async function forgeAuthStatus(host: string, forgeType: ForgeType, apiBase: string): Promise<ForgeUser | null> {
  return invoke("cmd_forge_auth_status", { host, forgeType, apiBase });
}

export async function forgeSetToken(host: string, forgeType: ForgeType, apiBase: string, token: string): Promise<ForgeUser> {
  return invoke("cmd_forge_set_token", { host, forgeType, apiBase, token });
}

export async function forgeClearToken(host: string): Promise<void> {
  return invoke("cmd_forge_clear_token", { host });
}

export async function forgeListRepos(host: string, forgeType: ForgeType, apiBase: string, page: number): Promise<ForgeRepo[]> {
  return invoke("cmd_forge_list_repos", { host, forgeType, apiBase, page });
}

export async function forgeCreateRepo(host: string, forgeType: ForgeType, apiBase: string, name: string, description: string, isPrivate: boolean): Promise<ForgeRepo> {
  return invoke("cmd_forge_create_repo", { host, forgeType, apiBase, name, description, "private": isPrivate });
}

export async function forgeListPrs(host: string, forgeType: ForgeType, apiBase: string, owner: string, repo: string, state: string): Promise<ForgePR[]> {
  return invoke("cmd_forge_list_prs", { host, forgeType, apiBase, owner, repo, state });
}

export async function forgeCreatePr(host: string, forgeType: ForgeType, apiBase: string, owner: string, repo: string, title: string, body: string, head: string, base: string): Promise<ForgePR> {
  return invoke("cmd_forge_create_pr", { host, forgeType, apiBase, owner, repo, title, body, head, base });
}

export async function forgeListIssues(host: string, forgeType: ForgeType, apiBase: string, owner: string, repo: string, state: string): Promise<ForgeIssue[]> {
  return invoke("cmd_forge_list_issues", { host, forgeType, apiBase, owner, repo, state });
}

export async function forgeCreateIssue(host: string, forgeType: ForgeType, apiBase: string, owner: string, repo: string, title: string, body: string): Promise<ForgeIssue> {
  return invoke("cmd_forge_create_issue", { host, forgeType, apiBase, owner, repo, title, body });
}
