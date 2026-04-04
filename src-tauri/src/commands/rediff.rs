use crate::commands::diff::{diff_section, diff_stats};
use crate::models::*;
use crate::reference_db::queries;
use std::collections::HashMap;
use std::path::Path;
use std::sync::{Arc, Mutex};

/// Cached parsed entries for a mod, keyed by mod path.
pub struct ParsedModEntries {
    pub lsx_entries: HashMap<Section, Vec<LsxEntry>>,
    pub stats_entries: Vec<StatsEntry>,
    pub source_files: HashMap<Section, String>,
}

/// Global cache of parsed mod entries. Uses Arc for O(1) cloning when reading.
static MOD_ENTRY_CACHE: std::sync::LazyLock<Mutex<HashMap<String, Arc<ParsedModEntries>>>> =
    std::sync::LazyLock::new(|| Mutex::new(HashMap::new()));

/// Clear the mod entry cache.
pub fn clear_cache() {
    if let Ok(mut cache) = MOD_ENTRY_CACHE.lock() {
        cache.clear();
    }
}

/// Get stat entry names/types from the cached mod data (populated by scan_mod).
pub fn get_mod_stat_entries(mod_path: &str) -> Vec<crate::StatEntryInfo> {
    let cache = match MOD_ENTRY_CACHE.lock() {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };
    let Some(entries) = cache.get(mod_path) else {
        return Vec::new();
    };
    let mut results: Vec<crate::StatEntryInfo> = entries.stats_entries.iter()
        .map(|e| crate::StatEntryInfo {
            name: e.name.clone(),
            entry_type: e.entry_type.clone(),
        })
        .collect();
    results.sort_by(|a, b| a.name.cmp(&b.name));
    results
}

/// Store parsed entries for a mod in the global cache.
/// Keeps all scanned mods so they can be used as comparison targets for re-diff.
pub fn cache_mod_entries(
    mod_path: &str,
    lsx_entries: HashMap<Section, Vec<LsxEntry>>,
    stats_entries: Vec<StatsEntry>,
    source_files: HashMap<Section, String>,
) -> Result<(), String> {
    let mut cache = MOD_ENTRY_CACHE.lock().map_err(|e| format!("Cache lock poisoned: {e}"))?;
    cache.insert(
        mod_path.to_string(),
        Arc::new(ParsedModEntries {
            lsx_entries,
            stats_entries,
            source_files,
        }),
    );
    Ok(())
}

/// Re-diff a primary mod against a different comparison source.
/// If `compare_mod_path` is empty, diffs against vanilla.
///
/// Vanilla comparison data is loaded from the reference DB at `vanilla_db_path`.
pub fn rediff_mod(
    primary_mod_path: &str,
    compare_mod_path: &str,
    vanilla_db_path: &Path,
) -> Result<Vec<SectionResult>, String> {
    // Arc-clone data out of the Mutex lock to release it before computation (M2)
    let (primary, compare_mod) = {
        let cache = MOD_ENTRY_CACHE.lock().map_err(|e| format!("Cache lock poisoned: {e}"))?;

        let primary = Arc::clone(
            cache
                .get(primary_mod_path)
                .ok_or_else(|| "Primary mod not found in entry cache".to_string())?,
        );

        let cmp = if !compare_mod_path.is_empty() {
            Some(Arc::clone(
                cache
                    .get(compare_mod_path)
                    .ok_or_else(|| "Comparison mod not found in entry cache".to_string())?,
            ))
        } else {
            None
        };

        (primary, cmp)
    }; // Lock dropped here

    // Load vanilla comparison data from DB
    let (vanilla_lsx_sections, vanilla_stats): (
        HashMap<Section, HashMap<String, LsxEntry>>,
        HashMap<String, StatsEntry>,
    ) = {
        let mut sections = HashMap::new();
        for section in Section::all_ordered() {
            if *section == Section::Meta || *section == Section::Spells {
                continue;
            }
            match queries::query_vanilla_lsx_for_scan(vanilla_db_path, section) {
                Ok(entries) if !entries.is_empty() => {
                    sections.insert(*section, entries);
                }
                Ok(_) => {}
                Err(e) => {
                    tracing::warn!(section = ?section, error = %e, "Failed to load vanilla LSX from DB for rediff");
                }
            }
        }
        let stats = queries::query_vanilla_stats_for_scan(vanilla_db_path).unwrap_or_default();
        (sections, stats)
    };

    if let Some(ref compare) = compare_mod {
        // Diff against vanilla + comparison mod.
        // Baseline is vanilla data overlaid with comparison mod entries.
        let mut sections = Vec::new();
        for &section in Section::all_ordered() {
            if section == Section::Spells {
                // Merge vanilla stats with comparison stats (comparison overrides vanilla)
                let mut merged_stats = vanilla_stats.clone();
                for comp_entry in &compare.stats_entries {
                    merged_stats.insert(comp_entry.name.clone(), comp_entry.clone());
                }
                let diffs = diff_stats(&primary.stats_entries, &merged_stats);
                sections.push(SectionResult {
                    section,
                    entries: diffs,
                });
            } else {
                let mod_entries = primary.lsx_entries.get(&section).cloned().unwrap_or_default();
                // Start with vanilla entries as baseline
                let mut merged_map: HashMap<String, LsxEntry> = vanilla_lsx_sections
                    .get(&section)
                    .cloned()
                    .unwrap_or_default();
                // Overlay comparison mod entries on top of vanilla
                if let Some(comp_entries) = compare.lsx_entries.get(&section) {
                    for entry in comp_entries {
                        if !entry.uuid.is_empty() {
                            merged_map.insert(entry.uuid.clone(), entry.clone());
                        }
                    }
                }
                let source = primary.source_files
                    .get(&section)
                    .cloned()
                    .unwrap_or_default();
                let diffs = diff_section(section, &mod_entries, &merged_map, &source);
                sections.push(SectionResult {
                    section,
                    entries: diffs,
                });
            }
        }
        Ok(sections)
    } else {
        // Diff against vanilla
        let mut sections = Vec::new();
        for &section in Section::all_ordered() {
            if section == Section::Spells {
                let diffs = diff_stats(&primary.stats_entries, &vanilla_stats);
                sections.push(SectionResult {
                    section,
                    entries: diffs,
                });
            } else {
                let mod_entries = primary.lsx_entries.get(&section).cloned().unwrap_or_default();
                let vanilla_entries = vanilla_lsx_sections
                    .get(&section)
                    .cloned()
                    .unwrap_or_default();
                let source = primary.source_files
                    .get(&section)
                    .cloned()
                    .unwrap_or_default();
                let diffs = diff_section(section, &mod_entries, &vanilla_entries, &source);
                sections.push(SectionResult {
                    section,
                    entries: diffs,
                });
            }
        }
        Ok(sections)
    }
}
