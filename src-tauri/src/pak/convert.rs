use std::path::Path;

use crate::pak::error::{PakError, PakResult};
use crate::pak::path::PakPath;

/// Directories under Public/ whose .lsx files the game expects as binary .lsf.
const LSF_REQUIRED_DIRS: &[&str] = &[
    "RootTemplates",
    "GameObjects",
    "TimelineTemplates",
];

/// Determine whether a pak entry should be converted from LSX to LSF binary.
///
/// Returns true if:
/// - The file has a `.lsx` extension
/// - The file is NOT `meta.lsx`
/// - The pak path contains one of the LSF_REQUIRED_DIRS segments
pub fn should_convert_to_lsf(pak_path: &PakPath) -> bool {
    // Only .lsx files can be converted
    if pak_path.extension() != Some("lsx") {
        return false;
    }

    // meta.lsx is NEVER converted — it stays as .lsx
    let name = pak_path.file_name().to_ascii_lowercase();
    if name == "meta.lsx" {
        return false;
    }

    // Check if the file is under a directory that requires binary format
    let lower = pak_path.as_str().to_ascii_lowercase();
    for dir in LSF_REQUIRED_DIRS {
        if lower.contains(&format!("/{}/", dir.to_ascii_lowercase())) {
            return true;
        }
    }

    false
}

/// Convert a .lsx pak path to .lsf extension.
pub fn convert_pak_path_to_lsf(pak_path: &PakPath) -> PakResult<PakPath> {
    let s = pak_path.as_str();
    if !s.ends_with(".lsx") {
        return Err(PakError::invalid_path(format!(
            "cannot convert non-.lsx path to .lsf: {s}"
        )));
    }
    let new_path = format!("{}.lsf", &s[..s.len() - 4]);
    PakPath::parse(&new_path)
}

/// Read an LSX file from disk and convert it to LSF binary bytes.
///
/// Returns the LSF binary data suitable for adding to a pak archive.
/// Errors include the file path for diagnostics.
pub fn convert_lsx_file_to_lsf_bytes(disk_path: &Path) -> Result<Vec<u8>, String> {
    let content = std::fs::read_to_string(disk_path)
        .map_err(|e| format!("Failed to read {}: {}", disk_path.display(), e))?;

    let resource = crate::parsers::lsx::parse_lsx_resource(&content)
        .map_err(|e| format!("Failed to parse LSX {}: {}", disk_path.display(), e))?;

    let mut buf = Vec::new();
    crate::parsers::lsf::write_lsf(&mut buf, &resource)
        .map_err(|e| format!("Failed to write LSF for {}: {}", disk_path.display(), e))?;

    Ok(buf)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn should_convert_root_templates() {
        let path = PakPath::parse("Public/MyMod/RootTemplates/foo.lsx").unwrap();
        assert!(should_convert_to_lsf(&path));
    }

    #[test]
    fn should_convert_game_objects() {
        let path = PakPath::parse("Public/MyMod/GameObjects/bar.lsx").unwrap();
        assert!(should_convert_to_lsf(&path));
    }

    #[test]
    fn should_convert_timeline_templates() {
        let path = PakPath::parse("Public/MyMod/TimelineTemplates/baz.lsx").unwrap();
        assert!(should_convert_to_lsf(&path));
    }

    #[test]
    fn should_not_convert_meta_lsx() {
        let path = PakPath::parse("Mods/MyMod/meta.lsx").unwrap();
        assert!(!should_convert_to_lsf(&path));
    }

    #[test]
    fn should_not_convert_non_lsx() {
        let path = PakPath::parse("Public/MyMod/RootTemplates/foo.xml").unwrap();
        assert!(!should_convert_to_lsf(&path));
    }

    #[test]
    fn should_not_convert_races_lsx() {
        let path = PakPath::parse("Public/MyMod/Races/Races.lsx").unwrap();
        assert!(!should_convert_to_lsf(&path));
    }

    #[test]
    fn convert_path_lsx_to_lsf() {
        let path = PakPath::parse("Public/MyMod/RootTemplates/foo.lsx").unwrap();
        let converted = convert_pak_path_to_lsf(&path).unwrap();
        assert_eq!(converted.as_str(), "Public/MyMod/RootTemplates/foo.lsf");
    }

    #[test]
    fn convert_path_non_lsx_fails() {
        let path = PakPath::parse("Public/MyMod/RootTemplates/foo.xml").unwrap();
        assert!(convert_pak_path_to_lsf(&path).is_err());
    }
}
