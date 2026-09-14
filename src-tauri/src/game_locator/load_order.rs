//! Reading the in-game mod setup from a Larian user data folder.

use std::path::{Path, PathBuf};
use std::sync::LazyLock;
use std::time::SystemTime;

use regex::Regex;

use crate::validation::{check_file_size, MAX_CONFIG_FILE_SIZE};

/// Sorted paths of the `.pak` files in `<user_dir>/Mods`.
/// Returns an empty Vec if the folder doesn't exist.
pub fn list_mod_paks(user_dir: &Path) -> Result<Vec<String>, String> {
    let mods_dir = user_dir.join("Mods");
    if !mods_dir.exists() {
        return Ok(Vec::new());
    }
    let mut paks: Vec<String> = std::fs::read_dir(&mods_dir)
        .map_err(|e| format!("Failed to read BG3 Mods directory: {e}"))?
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path()
                .extension()
                .is_some_and(|ext| ext.eq_ignore_ascii_case("pak"))
        })
        .map(|e| e.path().to_string_lossy().into_owned())
        .collect();
    paks.sort();
    Ok(paks)
}

/// The most recently modified `PlayerProfiles/*/modsettings.lsx`, with its mtime.
pub fn newest_modsettings(user_dir: &Path) -> Option<(PathBuf, SystemTime)> {
    std::fs::read_dir(user_dir.join("PlayerProfiles"))
        .ok()?
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let path = e.path().join("modsettings.lsx");
            let metadata = path.metadata().ok().filter(|m| m.is_file())?;
            let mtime = metadata.modified().unwrap_or(SystemTime::UNIX_EPOCH);
            Some((path, mtime))
        })
        .max_by_key(|(_, mtime)| *mtime)
}

/// Folder names of the active mods in the most recent `modsettings.lsx`.
/// Returns an empty Vec if there is no `PlayerProfiles` folder.
pub fn read_active_mod_folders(user_dir: &Path) -> Result<Vec<String>, String> {
    if !user_dir.join("PlayerProfiles").exists() {
        return Ok(Vec::new());
    }

    let (modsettings_path, _) = newest_modsettings(user_dir)
        .ok_or_else(|| "No modsettings.lsx found in any BG3 player profile".to_string())?;

    check_file_size(&modsettings_path, MAX_CONFIG_FILE_SIZE)
        .map_err(|e| format!("modsettings.lsx too large: {e}"))?;
    let content = std::fs::read_to_string(&modsettings_path)
        .map_err(|e| format!("Failed to read modsettings.lsx: {e}"))?;

    Ok(parse_active_mod_folders(&content))
}

/// Extract the `Folder` attribute of each mod under the `Mods` node,
/// skipping the base game modules.
pub fn parse_active_mod_folders(content: &str) -> Vec<String> {
    // modsettings.lsx has <node id="ModuleShortDesc"> entries under <node id="Mods">
    // Each has <attribute id="Folder" type="LSString" value="..." />
    static RE_FOLDER: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(r#"<attribute\s+id="Folder"\s+[^>]*value="([^"]+)""#).unwrap()
    });

    let mut folders: Vec<String> = Vec::new();
    let mut in_mods_section = false;
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.contains(r#"id="Mods""#) {
            in_mods_section = true;
        }
        if in_mods_section {
            if let Some(caps) = RE_FOLDER.captures(trimmed) {
                let folder = caps[1].to_string();
                // Skip the base game modules
                if folder != "Gustav" && folder != "GustavDev" {
                    folders.push(folder);
                }
            }
            // Stop when we exit the Mods section
            if trimmed == "</children>" && !folders.is_empty() {
                break;
            }
        }
    }
    folders
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::game_locator::test_support::{set_mtime, write};

    const MODSETTINGS: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<save>
  <region id="ModuleSettings">
    <node id="root">
      <children>
        <node id="Mods">
          <children>
            <node id="ModuleShortDesc">
              <attribute id="Folder" type="LSString" value="GustavDev"/>
            </node>
            <node id="ModuleShortDesc">
              <attribute id="Folder" type="LSString" value="MyMod_1234"/>
            </node>
          </children>
        </node>
      </children>
    </node>
  </region>
</save>"#;

    #[test]
    fn lists_paks_sorted_and_case_insensitive() {
        let tmp = tempfile::tempdir().unwrap();
        for name in ["b.pak", "A.PAK", "notes.txt"] {
            write(&tmp.path().join("Mods").join(name), "");
        }

        let paks = list_mod_paks(tmp.path()).unwrap();
        let names: Vec<_> = paks
            .iter()
            .map(|p| Path::new(p).file_name().unwrap().to_string_lossy().into_owned())
            .collect();
        assert_eq!(names, vec!["A.PAK", "b.pak"]);
    }

    #[test]
    fn missing_folders_return_empty() {
        let tmp = tempfile::tempdir().unwrap();
        assert!(list_mod_paks(tmp.path()).unwrap().is_empty());
        assert!(read_active_mod_folders(tmp.path()).unwrap().is_empty());
    }

    #[test]
    fn parses_active_mods_skipping_base_game() {
        assert_eq!(parse_active_mod_folders(MODSETTINGS), vec!["MyMod_1234"]);
    }

    #[test]
    fn reads_newest_profile() {
        let tmp = tempfile::tempdir().unwrap();
        let old = tmp.path().join("PlayerProfiles/Old/modsettings.lsx");
        let new = tmp.path().join("PlayerProfiles/New/modsettings.lsx");
        write(&old, &MODSETTINGS.replace("MyMod_1234", "OldMod"));
        write(&new, MODSETTINGS);
        set_mtime(&old, 1_000);
        set_mtime(&new, 2_000);

        assert_eq!(newest_modsettings(tmp.path()).unwrap().0, new);
        assert_eq!(read_active_mod_folders(tmp.path()).unwrap(), vec!["MyMod_1234"]);
    }

    #[test]
    fn profiles_without_modsettings_are_an_error() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(tmp.path().join("PlayerProfiles/Public")).unwrap();
        assert!(read_active_mod_folders(tmp.path()).is_err());
    }
}
