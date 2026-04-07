//! Generic scan interface for file type handlers.
//!
//! Defines the [`ScanProvider`] trait and [`ScanResult`] type that all script
//! and config file handlers implement. Sprint 20 (SE Config, SE Lua) and
//! Sprint 21 (Osiris, Khonsu) will provide concrete implementations.

use std::path::Path;

/// Result of scanning a single file.
#[derive(Debug, Clone, serde::Serialize)]
pub struct ScanResult {
    /// Relative path within the mod directory (e.g., "Mods/MyMod/ScriptExtender/Lua/BootstrapServer.lua").
    pub rel_path: String,
    /// Detected language identifier (e.g., "lua", "osiris", "khn", "json").
    pub language: String,
    /// File size in bytes.
    pub size: u64,
    /// Whether this file was modified vs the original (if original exists).
    pub is_modified: bool,
    /// Whether this file is newly created (not in vanilla/original).
    pub is_new: bool,
}

/// Trait for file type scan providers.
///
/// Implementations discover and categorize files of a specific type within a
/// mod directory. Each handler knows its own file extensions and language ID,
/// and can scan a directory to find all matching files.
///
/// # Example
///
/// ```ignore
/// struct LuaScriptHandler;
///
/// impl ScanProvider for LuaScriptHandler {
///     fn scan_directory(&self, base_path: &Path) -> Result<Vec<ScanResult>, String> {
///         // Walk base_path, find .lua files, return ScanResults
///         todo!()
///     }
///
///     fn file_extensions(&self) -> &[&str] {
///         &["lua"]
///     }
///
///     fn language_id(&self) -> &str {
///         "lua"
///     }
/// }
/// ```
pub trait ScanProvider: Send + Sync {
    /// Scan a directory (typically a mod root) and return all files this handler recognizes.
    ///
    /// The `base_path` is the root of the mod directory. Implementations should
    /// walk relevant subdirectories and return `ScanResult` entries with paths
    /// relative to `base_path`.
    fn scan_directory(&self, base_path: &Path) -> Result<Vec<ScanResult>, String>;

    /// File extensions this handler recognizes (without the leading dot).
    ///
    /// Used for quick filtering before invoking the full scan. For example,
    /// `["lua"]` for Lua scripts, `["txt"]` for Osiris goals (in `Story/RawFiles/Goals/`).
    fn file_extensions(&self) -> &[&str];

    /// The language identifier string for files this handler manages.
    ///
    /// This matches the `ScriptLanguage` type on the frontend and is stored
    /// in `ScanResult::language`. Examples: `"lua"`, `"osiris"`, `"khn"`,
    /// `"anubis"`, `"constellations"`, `"json"`.
    fn language_id(&self) -> &str;
}
