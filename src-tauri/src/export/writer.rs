//! Atomic file writer for the export pipeline.
//!
//! Implements a 5-phase strategy: validate → write temps → backup → rename → delete.

use std::fs;
use std::path::PathBuf;

use crate::error::AppError;

use super::delta::{DeltaEntry, FileSystemDelta};

/// Summary of a single file operation.
#[derive(Debug, Clone, serde::Serialize)]
pub struct FileReport {
    pub path: String,
    pub handler: String,
    pub entry_count: usize,
    pub bytes_written: usize,
    pub backed_up: bool,
}

/// Summary of all write operations performed.
#[derive(Debug, Clone, serde::Serialize)]
pub struct WriteReport {
    pub files_created: Vec<FileReport>,
    pub files_updated: Vec<FileReport>,
    pub files_deleted: Vec<FileReport>,
    pub files_unchanged: usize,
    pub total_entries: usize,
    pub errors: Vec<String>,
}

/// Best-effort removal of temporary files.
fn cleanup_temp_files(temp_paths: &[PathBuf]) {
    for path in temp_paths {
        let _ = fs::remove_file(path);
    }
}

/// Compute the `.cmty_tmp` temp path for a given absolute path.
fn temp_path_for(absolute_path: &PathBuf) -> PathBuf {
    let mut name = absolute_path
        .as_os_str()
        .to_os_string();
    name.push(".cmty_tmp");
    PathBuf::from(name)
}

/// Count total entries across a slice of delta entries.
fn count_entries(entries: &[DeltaEntry]) -> usize {
    entries.iter().map(|e| e.unit.entry_count).sum()
}

/// Write the file-system delta to disk using an atomic 5-phase strategy.
///
/// On success, `unit.content` is cleared to free memory.
pub fn write_files_atomic(
    delta: &mut FileSystemDelta,
    backup: bool,
) -> Result<WriteReport, AppError> {
    let mut report = WriteReport {
        files_created: Vec::new(),
        files_updated: Vec::new(),
        files_deleted: Vec::new(),
        files_unchanged: delta.unchanged.len(),
        total_entries: 0,
        errors: Vec::new(),
    };

    // Count total entries across all categories.
    report.total_entries = count_entries(&delta.creates)
        + count_entries(&delta.updates)
        + count_entries(&delta.deletes)
        + count_entries(&delta.unchanged);

    // Early return: nothing to do.
    if delta.creates.is_empty() && delta.updates.is_empty() && delta.deletes.is_empty() {
        return Ok(report);
    }

    // If there are only deletes, skip straight to Phase 5.
    let has_writes = !delta.creates.is_empty() || !delta.updates.is_empty();

    if has_writes {
        // ── Phase 1: Validate ──────────────────────────────────────────
        for entry in delta.creates.iter().chain(delta.updates.iter()) {
            if entry.unit.content.is_none() {
                return Err(AppError::invalid_input(format!(
                    "Export unit '{}' ({}) has no content — cannot write",
                    entry.unit.output_path.display(),
                    entry.unit.handler_name,
                )));
            }
        }

        // ── Phase 2: Write temp files ──────────────────────────────────
        let mut temp_paths: Vec<PathBuf> = Vec::new();

        for entry in delta.creates.iter().chain(delta.updates.iter()) {
            let tmp = temp_path_for(&entry.absolute_path);

            // Ensure parent directory exists.
            if let Some(parent) = entry.absolute_path.parent() {
                if let Err(e) = fs::create_dir_all(parent) {
                    cleanup_temp_files(&temp_paths);
                    return Err(AppError::io_error(format!(
                        "Failed to create directory '{}': {}",
                        parent.display(),
                        e,
                    )));
                }
            }

            // content is guaranteed Some by Phase 1 validation.
            let content = entry.unit.content.as_ref().unwrap();
            if let Err(e) = fs::write(&tmp, content) {
                cleanup_temp_files(&temp_paths);
                return Err(AppError::io_error(format!(
                    "Failed to write temp file '{}': {}",
                    tmp.display(),
                    e,
                )));
            }

            temp_paths.push(tmp);
        }

        // ── Phase 3: Backup originals ──────────────────────────────────
        if backup {
            for entry in delta.updates.iter() {
                if entry.absolute_path.exists() {
                    let bak = backup_path_for(&entry.absolute_path);
                    if let Err(e) = fs::copy(&entry.absolute_path, &bak) {
                        // Non-fatal for backup; log as warning.
                        report.errors.push(format!(
                            "Backup failed for '{}': {}",
                            entry.absolute_path.display(),
                            e,
                        ));
                    }
                }
            }

            for entry in delta.deletes.iter() {
                if entry.absolute_path.exists() {
                    let bak = backup_path_for(&entry.absolute_path);
                    if let Err(e) = fs::copy(&entry.absolute_path, &bak) {
                        report.errors.push(format!(
                            "Backup failed for '{}': {}",
                            entry.absolute_path.display(),
                            e,
                        ));
                    }
                }
            }
        }

        // ── Phase 4: Rename temp → final (atomic) ─────────────────────
        let write_entries: Vec<&DeltaEntry> =
            delta.creates.iter().chain(delta.updates.iter()).collect();

        // temp_paths[i] corresponds to write_entries[i].
        let mut remaining_temps: Vec<PathBuf> = Vec::new();
        for (i, entry) in write_entries.iter().enumerate() {
            let tmp = &temp_paths[i];

            // Track remaining temps for cleanup on failure.
            // We collect the ones after the current index.
            let rename_result = fs::rename(tmp, &entry.absolute_path);
            if rename_result.is_err() {
                // Fallback: copy + delete (cross-filesystem).
                let fallback = fs::copy(tmp, &entry.absolute_path)
                    .and_then(|_| fs::remove_file(tmp));

                if fallback.is_err() {
                    // Clean up remaining temps (current one + all after).
                    remaining_temps.push(tmp.clone());
                    for j in (i + 1)..temp_paths.len() {
                        remaining_temps.push(temp_paths[j].clone());
                    }
                    cleanup_temp_files(&remaining_temps);
                    return Err(AppError::io_error(format!(
                        "Failed to rename/copy temp file to '{}': rename={}, copy={}",
                        entry.absolute_path.display(),
                        rename_result.unwrap_err(),
                        fallback.unwrap_err(),
                    )));
                }
            }
        }
    } else if backup {
        // Only deletes, but backup is requested — backup before deleting.
        for entry in delta.deletes.iter() {
            if entry.absolute_path.exists() {
                let bak = backup_path_for(&entry.absolute_path);
                if let Err(e) = fs::copy(&entry.absolute_path, &bak) {
                    report.errors.push(format!(
                        "Backup failed for '{}': {}",
                        entry.absolute_path.display(),
                        e,
                    ));
                }
            }
        }
    }

    // ── Phase 5: Delete removed files ──────────────────────────────────
    for entry in delta.deletes.iter() {
        if entry.absolute_path.exists() {
            if let Err(e) = fs::remove_file(&entry.absolute_path) {
                report.errors.push(format!(
                    "Failed to delete '{}': {}",
                    entry.absolute_path.display(),
                    e,
                ));
            }
        }
    }

    // ── Build reports & free memory ────────────────────────────────────
    for entry in delta.creates.iter_mut() {
        let bytes = entry
            .unit
            .content
            .as_ref()
            .map_or(0, |c| c.len());
        report.files_created.push(FileReport {
            path: entry.unit.output_path.display().to_string(),
            handler: entry.unit.handler_name.clone(),
            entry_count: entry.unit.entry_count,
            bytes_written: bytes,
            backed_up: false,
        });
        entry.unit.content = None;
    }

    for entry in delta.updates.iter_mut() {
        let bytes = entry
            .unit
            .content
            .as_ref()
            .map_or(0, |c| c.len());
        report.files_updated.push(FileReport {
            path: entry.unit.output_path.display().to_string(),
            handler: entry.unit.handler_name.clone(),
            entry_count: entry.unit.entry_count,
            bytes_written: bytes,
            backed_up: backup,
        });
        entry.unit.content = None;
    }

    for entry in delta.deletes.iter_mut() {
        report.files_deleted.push(FileReport {
            path: entry.unit.output_path.display().to_string(),
            handler: entry.unit.handler_name.clone(),
            entry_count: entry.unit.entry_count,
            bytes_written: 0,
            backed_up: backup,
        });
        entry.unit.content = None;
    }

    // Also clear content on unchanged entries.
    for entry in delta.unchanged.iter_mut() {
        entry.unit.content = None;
    }

    Ok(report)
}

/// Compute the `.bak` backup path for a given absolute path.
fn backup_path_for(absolute_path: &PathBuf) -> PathBuf {
    let mut name = absolute_path
        .as_os_str()
        .to_os_string();
    name.push(".bak");
    PathBuf::from(name)
}
