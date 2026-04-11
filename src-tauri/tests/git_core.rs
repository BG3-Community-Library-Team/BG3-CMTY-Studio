//! Integration tests for core git operations using git2 directly.
//!
//! These tests exercise the same git2 patterns used by the Tauri commands
//! in `commands/git_core.rs`, without requiring an AppHandle.

use git2::{DiffOptions, Patch, Repository, Sort, StatusOptions};
use std::fs;
use tempfile::TempDir;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Create a test repo with one initial commit so HEAD is valid.
fn init_repo_with_commit(dir: &TempDir) -> Repository {
    let repo = Repository::init(dir.path()).unwrap();
    let sig = git2::Signature::now("Test User", "test@example.com").unwrap();

    // Write a seed file so the tree isn't empty
    fs::write(dir.path().join("README.md"), "# Test\n").unwrap();

    let mut index = repo.index().unwrap();
    index
        .add_all(["*"], git2::IndexAddOption::DEFAULT, None)
        .unwrap();
    index.write().unwrap();

    let tree_oid = index.write_tree().unwrap();

    {
        let tree = repo.find_tree(tree_oid).unwrap();
        repo.commit(Some("HEAD"), &sig, &sig, "Initial commit", &tree, &[])
            .unwrap();
    }

    repo
}

// ---------------------------------------------------------------------------
// Init + status
// ---------------------------------------------------------------------------

#[test]
fn init_fresh_repo_has_clean_status() {
    let dir = TempDir::new().unwrap();
    let repo = Repository::init(dir.path()).unwrap();

    let statuses = repo.statuses(None).unwrap();
    // A freshly-inited repo with no files has no status entries
    assert!(statuses.is_empty());
}

// ---------------------------------------------------------------------------
// Stage / unstage
// ---------------------------------------------------------------------------

#[test]
fn stage_and_unstage_file() {
    let dir = TempDir::new().unwrap();
    let repo = init_repo_with_commit(&dir);

    // Create a new file
    fs::write(dir.path().join("new.txt"), "hello").unwrap();

    // Before staging: file is untracked (WT_NEW)
    let mut opts = StatusOptions::new();
    opts.include_untracked(true);
    let statuses = repo.statuses(Some(&mut opts)).unwrap();
    assert!(!statuses.is_empty());

    // Stage it
    let mut index = repo.index().unwrap();
    index.add_path(std::path::Path::new("new.txt")).unwrap();
    index.write().unwrap();

    // After staging: should appear as INDEX_NEW
    let statuses = repo.statuses(Some(&mut opts)).unwrap();
    let entry = statuses
        .iter()
        .find(|e| e.path() == Some("new.txt"))
        .expect("new.txt should be in status");
    assert!(entry.status().intersects(git2::Status::INDEX_NEW));

    // Unstage: remove from index via reset_default
    let head_commit = repo.head().unwrap().peel_to_commit().unwrap();
    repo.reset_default(
        Some(head_commit.as_object()),
        &[std::path::Path::new("new.txt")],
    )
    .unwrap();

    // After unstage: file should appear as WT_NEW (untracked) again
    let statuses = repo.statuses(Some(&mut opts)).unwrap();
    let entry = statuses
        .iter()
        .find(|e| e.path() == Some("new.txt"))
        .expect("new.txt should still be in status");
    assert!(!entry.status().intersects(git2::Status::INDEX_NEW));
    assert!(entry.status().intersects(git2::Status::WT_NEW));
}

// ---------------------------------------------------------------------------
// Commit
// ---------------------------------------------------------------------------

#[test]
fn commit_creates_valid_head() {
    let dir = TempDir::new().unwrap();
    let repo = Repository::init(dir.path()).unwrap();
    let sig = git2::Signature::now("Test", "test@test.com").unwrap();

    fs::write(dir.path().join("file.txt"), "content").unwrap();

    let mut index = repo.index().unwrap();
    index
        .add_all(["*"], git2::IndexAddOption::DEFAULT, None)
        .unwrap();
    index.write().unwrap();

    let tree_oid = index.write_tree().unwrap();
    let tree = repo.find_tree(tree_oid).unwrap();

    let commit_oid = repo
        .commit(Some("HEAD"), &sig, &sig, "first commit", &tree, &[])
        .unwrap();

    // HEAD should resolve and point at our commit
    let head = repo.head().unwrap();
    assert_eq!(head.target().unwrap(), commit_oid);

    // Revwalk should find exactly 1 entry
    let mut revwalk = repo.revwalk().unwrap();
    revwalk.push(commit_oid).unwrap();
    let commits: Vec<_> = revwalk.collect::<Result<Vec<_>, _>>().unwrap();
    assert_eq!(commits.len(), 1);
}

// ---------------------------------------------------------------------------
// Diff
// ---------------------------------------------------------------------------

#[test]
fn diff_shows_modified_content() {
    let dir = TempDir::new().unwrap();
    let repo = init_repo_with_commit(&dir);

    // Modify the committed file
    fs::write(dir.path().join("README.md"), "# Changed\n").unwrap();

    let mut diff_opts = DiffOptions::new();
    diff_opts.pathspec("README.md");

    let diff = repo
        .diff_index_to_workdir(None, Some(&mut diff_opts))
        .unwrap();

    assert!(diff.deltas().len() > 0, "should have at least one delta");

    // Verify we can read hunk content via the Patch API
    let patch = Patch::from_diff(&diff, 0).unwrap().unwrap();
    assert!(patch.num_hunks() > 0, "should have at least one hunk");

    // Check that the diff contains our new content
    let (_, _) = patch.hunk(0).unwrap();
    let mut found_addition = false;
    for l in 0..patch.num_lines_in_hunk(0).unwrap() {
        let line = patch.line_in_hunk(0, l).unwrap();
        if line.origin() == '+' {
            let content = String::from_utf8_lossy(line.content());
            if content.contains("Changed") {
                found_addition = true;
            }
        }
    }
    assert!(found_addition, "diff should contain the changed line");
}

// ---------------------------------------------------------------------------
// Log pagination
// ---------------------------------------------------------------------------

#[test]
fn log_pagination_five_commits() {
    let dir = TempDir::new().unwrap();
    let repo = Repository::init(dir.path()).unwrap();
    let sig = git2::Signature::now("Test", "test@test.com").unwrap();

    // Create 5 sequential commits
    for i in 0..5 {
        fs::write(dir.path().join("file.txt"), format!("version {i}")).unwrap();

        let mut index = repo.index().unwrap();
        index
            .add_all(["*"], git2::IndexAddOption::DEFAULT, None)
            .unwrap();
        index.write().unwrap();
        let tree_oid = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_oid).unwrap();

        let parents: Vec<git2::Commit> = match repo.head() {
            Ok(head) => vec![head.peel_to_commit().unwrap()],
            Err(_) => vec![],
        };
        let parent_refs: Vec<&git2::Commit> = parents.iter().collect();

        repo.commit(
            Some("HEAD"),
            &sig,
            &sig,
            &format!("commit {i}"),
            &tree,
            &parent_refs,
        )
        .unwrap();
    }

    // Walk all revisions
    let head_oid = repo.head().unwrap().target().unwrap();
    let mut revwalk = repo.revwalk().unwrap();
    revwalk.push(head_oid).unwrap();
    revwalk.set_sorting(Sort::TIME).unwrap();

    let oids: Vec<_> = revwalk.collect::<Result<Vec<_>, _>>().unwrap();
    assert_eq!(oids.len(), 5);

    // Newest first: the first OID should be from the last commit
    let newest = repo.find_commit(oids[0]).unwrap();
    assert_eq!(newest.message().unwrap(), "commit 4");
}

// ---------------------------------------------------------------------------
// Empty repo (no commits)
// ---------------------------------------------------------------------------

#[test]
fn empty_repo_head_errors_gracefully() {
    let dir = TempDir::new().unwrap();
    let repo = Repository::init(dir.path()).unwrap();

    // repo.head() should error — no commits yet
    assert!(repo.head().is_err());

    // revwalk with no starting point yields 0 entries
    let revwalk = repo.revwalk().unwrap();
    let count = revwalk.count();
    assert_eq!(count, 0);
}

// ---------------------------------------------------------------------------
// Bare repo detection
// ---------------------------------------------------------------------------

#[test]
fn bare_repo_detected() {
    let dir = TempDir::new().unwrap();
    let repo = Repository::init_bare(dir.path()).unwrap();
    assert!(repo.is_bare());
}

// ---------------------------------------------------------------------------
// Shallow detection API
// ---------------------------------------------------------------------------

#[test]
fn non_shallow_repo() {
    let dir = TempDir::new().unwrap();
    let repo = Repository::init(dir.path()).unwrap();
    // A locally-inited repo is never shallow
    assert!(!repo.is_shallow());
}

// ---------------------------------------------------------------------------
// Multiple files in status
// ---------------------------------------------------------------------------

#[test]
fn status_tracks_multiple_files() {
    let dir = TempDir::new().unwrap();
    let repo = init_repo_with_commit(&dir);

    fs::write(dir.path().join("a.txt"), "aaa").unwrap();
    fs::write(dir.path().join("b.txt"), "bbb").unwrap();
    fs::write(dir.path().join("c.txt"), "ccc").unwrap();

    let mut opts = StatusOptions::new();
    opts.include_untracked(true).recurse_untracked_dirs(true);
    let statuses = repo.statuses(Some(&mut opts)).unwrap();

    // All 3 new files should appear
    let paths: Vec<String> = statuses
        .iter()
        .filter_map(|e| e.path().map(String::from))
        .collect();
    assert!(paths.contains(&"a.txt".to_string()));
    assert!(paths.contains(&"b.txt".to_string()));
    assert!(paths.contains(&"c.txt".to_string()));
}
