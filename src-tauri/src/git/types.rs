use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GitRepoInfo {
    pub is_repo: bool,
    pub head_branch: Option<String>,
    pub head_oid: Option<String>,
    pub is_detached: bool,
    pub has_remotes: bool,
    pub clean: bool,
    pub ahead: u32,
    pub behind: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GitFileStatus {
    pub path: String,
    pub status: String,
    pub staged: bool,
    pub old_path: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GitFileDiff {
    pub path: String,
    pub hunks: Vec<GitDiffHunk>,
    pub is_binary: bool,
    pub old_size: Option<u64>,
    pub new_size: Option<u64>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GitDiffHunk {
    pub header: String,
    pub old_start: u32,
    pub old_lines: u32,
    pub new_start: u32,
    pub new_lines: u32,
    pub lines: Vec<GitDiffLine>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GitDiffLine {
    pub origin: String,
    pub content: String,
    pub old_lineno: Option<u32>,
    pub new_lineno: Option<u32>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GitCommitInfo {
    pub oid: String,
    pub short_oid: String,
    pub message: String,
    pub author_name: String,
    pub author_email: String,
    pub timestamp: i64,
    pub parent_count: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GitCommitDetail {
    pub commit: GitCommitInfo,
    pub files: Vec<GitFileStatus>,
    pub diff: Vec<GitFileDiff>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GitBranchInfo {
    pub name: String,
    pub is_current: bool,
    pub is_remote: bool,
    pub upstream: Option<String>,
    pub ahead: u32,
    pub behind: u32,
    pub last_commit_oid: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GitRemoteInfo {
    pub name: String,
    pub url: String,
    pub push_url: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GitStashEntry {
    pub index: u32,
    pub message: String,
    pub oid: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GitMergeResult {
    pub fast_forward: bool,
    pub conflicts: Vec<String>,
    pub merge_commit: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GitPullResult {
    pub merge_result: GitMergeResult,
    pub fetched_objects: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum ForgeType {
    GitHub,
    GitLab,
    Gitea,
    Unknown,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ForgeInfo {
    pub forge_type: ForgeType,
    pub host: String,
    pub api_base: String,
    pub forge_id: String,
    pub owner: Option<String>,
    pub repo: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ForgeUser {
    pub login: String,
    pub name: Option<String>,
    pub avatar_url: String,
    pub forge_id: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ForgeRepo {
    pub full_name: String,
    pub html_url: String,
    pub clone_url: String,
    pub private: bool,
    pub description: Option<String>,
    pub default_branch: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ForgePR {
    pub number: u32,
    pub title: String,
    pub state: String,
    pub author: String,
    pub created_at: String,
    pub html_url: String,
    pub head_ref: String,
    pub base_ref: String,
    pub mergeable: Option<bool>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ForgeIssue {
    pub number: u32,
    pub title: String,
    pub state: String,
    pub author: String,
    pub created_at: String,
    pub html_url: String,
    pub labels: Vec<String>,
    pub assignee: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ForgeIssueDetail {
    pub number: u32,
    pub title: String,
    pub state: String,
    pub author: String,
    pub created_at: String,
    pub updated_at: String,
    pub html_url: String,
    pub body: String,
    pub labels: Vec<String>,
    pub assignees: Vec<String>,
    pub milestone: Option<String>,
    pub closed_at: Option<String>,
}
