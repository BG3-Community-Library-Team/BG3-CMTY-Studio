//! Integration tests for forge detection and URL parsing.
//!
//! The inline unit tests in `src/git/forge.rs` already cover the happy paths
//! for detect_forge (GitHub HTTPS/SSH, GitLab subgroups, Codeberg, unknown host)
//! and the forge_file_url / forge_commit_url helpers. These tests focus on
//! edge cases and additional scenarios not covered by the inline tests.

use bg3_cmty_studio_lib::git::forge::{detect_forge, forge_commit_url, forge_file_url};
use bg3_cmty_studio_lib::git::types::ForgeType;

// ---------------------------------------------------------------------------
// HTTPS without trailing .git
// ---------------------------------------------------------------------------

#[test]
fn github_https_without_dot_git() {
    let info = detect_forge("https://github.com/user/repo");
    assert!(matches!(info.forge_type, ForgeType::GitHub));
    assert_eq!(info.owner.as_deref(), Some("user"));
    assert_eq!(info.repo.as_deref(), Some("repo"));
}

#[test]
fn gitlab_https_without_dot_git() {
    let info = detect_forge("https://gitlab.com/group/project");
    assert!(matches!(info.forge_type, ForgeType::GitLab));
    assert_eq!(info.owner.as_deref(), Some("group"));
    assert_eq!(info.repo.as_deref(), Some("project"));
}

#[test]
fn codeberg_https_without_dot_git() {
    let info = detect_forge("https://codeberg.org/user/project");
    assert!(matches!(info.forge_type, ForgeType::Gitea));
    assert_eq!(info.owner.as_deref(), Some("user"));
    assert_eq!(info.repo.as_deref(), Some("project"));
}

// ---------------------------------------------------------------------------
// SSH URLs
// ---------------------------------------------------------------------------

#[test]
fn gitlab_ssh() {
    let info = detect_forge("git@gitlab.com:group/project.git");
    assert!(matches!(info.forge_type, ForgeType::GitLab));
    assert_eq!(info.host, "gitlab.com");
    assert_eq!(info.owner.as_deref(), Some("group"));
    assert_eq!(info.repo.as_deref(), Some("project"));
}

#[test]
fn gitlab_ssh_with_subgroup() {
    let info = detect_forge("git@gitlab.com:group/subgroup/project.git");
    assert!(matches!(info.forge_type, ForgeType::GitLab));
    assert_eq!(info.owner.as_deref(), Some("group/subgroup"));
    assert_eq!(info.repo.as_deref(), Some("project"));
}

#[test]
fn codeberg_ssh() {
    let info = detect_forge("git@codeberg.org:user/repo.git");
    assert!(matches!(info.forge_type, ForgeType::Gitea));
    assert_eq!(info.host, "codeberg.org");
    assert_eq!(info.owner.as_deref(), Some("user"));
    assert_eq!(info.repo.as_deref(), Some("repo"));
}

// ---------------------------------------------------------------------------
// GitLab deep subgroups
// ---------------------------------------------------------------------------

#[test]
fn gitlab_three_level_subgroup() {
    let info = detect_forge("https://gitlab.com/a/b/c/repo.git");
    assert!(matches!(info.forge_type, ForgeType::GitLab));
    assert_eq!(info.owner.as_deref(), Some("a/b/c"));
    assert_eq!(info.repo.as_deref(), Some("repo"));
}

#[test]
fn gitlab_deep_subgroup_ssh() {
    let info = detect_forge("git@gitlab.com:org/team/sub/project.git");
    assert!(matches!(info.forge_type, ForgeType::GitLab));
    assert_eq!(info.owner.as_deref(), Some("org/team/sub"));
    assert_eq!(info.repo.as_deref(), Some("project"));
}

// ---------------------------------------------------------------------------
// HTTP (non-HTTPS) URLs
// ---------------------------------------------------------------------------

#[test]
fn http_url_works() {
    let info = detect_forge("http://github.com/user/repo.git");
    assert!(matches!(info.forge_type, ForgeType::GitHub));
    assert_eq!(info.owner.as_deref(), Some("user"));
    assert_eq!(info.repo.as_deref(), Some("repo"));
}

// ---------------------------------------------------------------------------
// Unknown hosts
// ---------------------------------------------------------------------------

#[test]
fn self_hosted_gitlab_is_unknown() {
    // Self-hosted instances aren't in the hard-coded host list
    let info = detect_forge("https://gitlab.mycompany.com/team/app.git");
    assert!(matches!(info.forge_type, ForgeType::Unknown));
    assert_eq!(info.host, "gitlab.mycompany.com");
    assert_eq!(info.owner.as_deref(), Some("team"));
    assert_eq!(info.repo.as_deref(), Some("app"));
}

#[test]
fn bitbucket_is_unknown() {
    let info = detect_forge("https://bitbucket.org/user/repo.git");
    assert!(matches!(info.forge_type, ForgeType::Unknown));
    assert_eq!(info.host, "bitbucket.org");
}

// ---------------------------------------------------------------------------
// Edge cases — empty / malformed input
// ---------------------------------------------------------------------------

#[test]
fn empty_url_returns_unknown_with_empty_fields() {
    let info = detect_forge("");
    assert!(matches!(info.forge_type, ForgeType::Unknown));
    assert!(info.host.is_empty());
    assert!(info.owner.is_none());
    assert!(info.repo.is_none());
}

#[test]
fn garbage_input_returns_unknown() {
    let info = detect_forge("not-a-url-at-all");
    assert!(matches!(info.forge_type, ForgeType::Unknown));
    assert!(info.host.is_empty());
}

// ---------------------------------------------------------------------------
// URL with port number (HTTPS)
// ---------------------------------------------------------------------------

#[test]
fn https_url_with_port() {
    // Port appears as part of the "host" portion
    let info = detect_forge("https://github.com:443/user/repo.git");
    // The host will include the port since parse_remote_url splits on first /
    assert_eq!(info.host, "github.com:443");
    // owner/repo should still parse from path
    assert_eq!(info.owner.as_deref(), Some("user"));
    assert_eq!(info.repo.as_deref(), Some("repo"));
}

// ---------------------------------------------------------------------------
// Forge ID consistency
// ---------------------------------------------------------------------------

#[test]
fn forge_id_format_github() {
    let info = detect_forge("https://github.com/user/repo");
    assert_eq!(info.forge_id, "github:github.com");
}

#[test]
fn forge_id_format_gitlab() {
    let info = detect_forge("https://gitlab.com/group/repo");
    assert_eq!(info.forge_id, "gitlab:gitlab.com");
}

#[test]
fn forge_id_format_gitea() {
    let info = detect_forge("https://codeberg.org/user/repo");
    assert_eq!(info.forge_id, "gitea:codeberg.org");
}

// ---------------------------------------------------------------------------
// forge_file_url with subgroups
// ---------------------------------------------------------------------------

#[test]
fn file_url_gitlab_with_subgroup() {
    let info = detect_forge("https://gitlab.com/group/sub/repo.git");
    let url = forge_file_url(&info, "main", "src/lib.rs");
    assert_eq!(
        url.as_deref(),
        Some("https://gitlab.com/group/sub/repo/-/blob/main/src/lib.rs")
    );
}

// ---------------------------------------------------------------------------
// forge_commit_url with subgroups
// ---------------------------------------------------------------------------

#[test]
fn commit_url_gitlab_with_subgroup() {
    let info = detect_forge("https://gitlab.com/group/sub/repo.git");
    let url = forge_commit_url(&info, "abc123");
    assert_eq!(
        url.as_deref(),
        Some("https://gitlab.com/group/sub/repo/-/commit/abc123")
    );
}

// ---------------------------------------------------------------------------
// URL helpers return None when owner/repo missing
// ---------------------------------------------------------------------------

#[test]
fn file_url_none_for_missing_owner_repo() {
    let info = detect_forge("");
    assert!(forge_file_url(&info, "main", "file.txt").is_none());
}

#[test]
fn commit_url_none_for_missing_owner_repo() {
    let info = detect_forge("");
    assert!(forge_commit_url(&info, "abc").is_none());
}

// ---------------------------------------------------------------------------
// Only owner, no repo (single-path segment)
// ---------------------------------------------------------------------------

#[test]
fn single_segment_path_gives_owner_only() {
    let info = detect_forge("https://github.com/user");
    assert_eq!(info.owner.as_deref(), Some("user"));
    assert!(info.repo.is_none());
    // forge_file_url requires both owner and repo
    assert!(forge_file_url(&info, "main", "f.txt").is_none());
}
