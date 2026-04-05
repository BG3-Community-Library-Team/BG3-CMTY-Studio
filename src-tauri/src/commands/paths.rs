//! Path, filesystem, and section-classification helpers.
//!
//! These functions were originally in `divine.rs` but have no relationship
//! to the Divine.exe subprocess. They provide general-purpose path resolution,
//! directory sizing, mod metadata reading, and pak section classification.

use std::collections::HashMap;
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

/// Relevant subfolders under the public roots for vanilla extraction.
const VANILLA_SUBFOLDERS: &[&str] = &[
    "ActionResourceDefinitions",
    "ActionResourceGroupDefinitions",
    "Animation",
    "AnimationOverrides",
    "Backgrounds",
    "BackgroundGoals",
    "Calendar",
    "CharacterCreation",
    "CharacterCreationPresets",
    "CinematicArenaFrequencyGroups",
    "ClassDescriptions",
    "ColorDefinitions",
    "CombatCameraGroups",
    "Content",
    "CustomDice",
    "DefaultValues",
    "DifficultyClasses",
    "Disturbances",
    "Encumbrance",
    "EquipmentTypes",
    "Factions",
    "FeatDescriptions",
    "Feats",
    "Flags",
    "FixedHotBarSlots",
    "Gods",
    "GUI",
    "ItemThrowParams",
    "Levelmaps",
    "LimbsMapping",
    "Lists",
    "MultiEffectInfos",
    "Origins",
    "Progressions",
    "ProjectileDefaults",
    "Races",
    "RandomCasts",
    "RootTemplates",
    "Ruleset",
    "Shapeshift",
    "Sound",
    "Spell",
    "Status",
    "Surface",
    "Tags",
    "TooltipExtras",
    "TrajectoryRules",
    "Tutorials",
    "VFX",
    "Visuals",
    "Voices",
    "WeaponAnimationSetData",
];

/// Get the full VANILLA_SUBFOLDERS list (for use from other modules).
pub fn vanilla_subfolders() -> &'static [&'static str] {
    VANILLA_SUBFOLDERS
}

/// Compute the total size (in bytes) of all files in a directory tree.
pub fn dir_size_bytes(dir_path: &str) -> Result<u64, String> {
    let root = Path::new(dir_path);
    if !root.exists() {
        return Ok(0);
    }
    let total: u64 = WalkDir::new(root)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter_map(|e| e.metadata().ok())
        .map(|m| m.len())
        .sum();
    Ok(total)
}

/// Read a mod's meta.lsx or meta.yaml file given a mod path (directory).
/// Looks for meta.lsx first, then meta.yaml, in the standard BG3 mod layout.
pub fn read_mod_meta(mod_path: &str) -> Result<crate::models::ModMeta, String> {
    let base = Path::new(mod_path);
    // Walk for meta.lsx first (original format)
    if let Some(entry) = WalkDir::new(base)
        .into_iter()
        .filter_map(|e| e.ok())
        .find(|e| {
            e.file_type().is_file()
                && e.path()
                    .file_name()
                    .is_some_and(|n| n.eq_ignore_ascii_case("meta.lsx"))
        })
    {
        let content = fs::read_to_string(entry.path())
            .map_err(|e| format!("Failed to read meta.lsx: {}", e))?;
        return crate::parsers::meta::parse_meta_lsx(&content);
    }
    // Fall back to meta.yaml (converted format)
    if let Some(entry) = WalkDir::new(base)
        .into_iter()
        .filter_map(|e| e.ok())
        .find(|e| {
            e.file_type().is_file()
                && e.path()
                    .file_name()
                    .is_some_and(|n| n.eq_ignore_ascii_case("meta.yaml"))
        })
    {
        let content = fs::read_to_string(entry.path())
            .map_err(|e| format!("Failed to read meta.yaml: {}", e))?;
        return crate::parsers::meta::parse_meta_yaml(&content);
    }
    Err("meta.lsx not found".to_string())
}

/// Information about which data sections a pak file contains.
#[derive(Debug, Clone, serde::Serialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[cfg_attr(test, ts(export))]
pub struct PakSectionInfo {
    /// The section folder name (e.g. "Progressions", "Races").
    pub folder: String,
    /// Number of files in this section.
    pub file_count: usize,
}

/// Categorize a list of file paths from a pak into data sections.
/// Returns section info for each detected section folder.
pub fn categorize_pak_sections(file_paths: &[String]) -> Vec<PakSectionInfo> {
    let mut section_counts: HashMap<String, usize> = HashMap::new();

    for path in file_paths {
        // Normalize path separators
        let normalized = path.replace('\\', "/");

        // Match Public/<root>/<SectionFolder>/... pattern
        if let Some(public_idx) = normalized.find("Public/") {
            let after_public = &normalized[public_idx + 7..]; // skip "Public/"
            // Skip the root name (e.g. "Shared/", "ModName/")
            if let Some(slash_idx) = after_public.find('/') {
                let after_root = &after_public[slash_idx + 1..];
                // Get the section folder name
                if let Some(folder_end) = after_root.find('/') {
                    let folder = &after_root[..folder_end];
                    // Check if it matches a known subfolder
                    if VANILLA_SUBFOLDERS.contains(&folder) || folder == "Stats" {
                        *section_counts.entry(folder.to_string()).or_insert(0) += 1;
                    }
                }
            }
        }

        // Also check for Localization files
        if normalized.starts_with("Localization/") || normalized.contains("/Localization/") {
            *section_counts.entry("Localization".to_string()).or_insert(0) += 1;
        }

        // Check for meta files
        if normalized.contains("Mods/") && (normalized.ends_with("meta.lsx") || normalized.ends_with("meta.lsf")) {
            *section_counts.entry("Meta".to_string()).or_insert(0) += 1;
        }
    }

    let mut results: Vec<PakSectionInfo> = section_counts
        .into_iter()
        .map(|(folder, file_count)| PakSectionInfo { folder, file_count })
        .collect();

    results.sort_by(|a, b| a.folder.cmp(&b.folder));
    results
}
