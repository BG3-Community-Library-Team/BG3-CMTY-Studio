//! Steam library discovery on Linux: native, Flatpak and Snap clients.
#![cfg_attr(not(target_os = "linux"), allow(dead_code))]

use std::collections::HashSet;
use std::path::{Path, PathBuf};

use super::{contains_vanilla_paks, vdf, HostDirs};

pub const BG3_APP_ID: &str = "1086940";

/// Used when the app manifest is missing or has no `installdir`.
const DEFAULT_INSTALL_DIR: &str = "Baldurs Gate 3";

/// Steam client roots that exist on this machine, without duplicates
/// (`~/.steam/steam` is usually a symlink to `~/.local/share/Steam`).
pub fn steam_roots(host: &HostDirs) -> Vec<PathBuf> {
    let candidates = [
        host.home.join(".steam").join("steam"),
        host.data_home.join("Steam"),
        host.home.join(".local").join("share").join("Steam"),
        host.home.join(".var/app/com.valvesoftware.Steam/.local/share/Steam"),
        host.home.join("snap/steam/common/.local/share/Steam"),
    ];
    dedupe(candidates.into_iter().filter(|root| root.join("steamapps").is_dir()))
}

/// Steam libraries that contain BG3, according to `libraryfolders.vdf` or an
/// `appmanifest_1086940.acf`. Every root counts as a library of its own.
pub fn bg3_libraries(roots: &[PathBuf]) -> Vec<PathBuf> {
    let mut libraries: Vec<(PathBuf, bool)> = Vec::new();

    for root in roots {
        libraries.push((root.clone(), false));

        let vdf_path = root.join("steamapps").join("libraryfolders.vdf");
        let Ok(text) = std::fs::read_to_string(&vdf_path) else {
            continue;
        };
        let doc = match vdf::parse(&text) {
            Ok(doc) => doc,
            Err(e) => {
                tracing::warn!("Failed to parse {}: {e}", vdf_path.display());
                continue;
            }
        };
        let Some(folders) = doc.get_obj("libraryfolders") else {
            continue;
        };
        for (_, value) in folders.iter() {
            let Some(folder) = value.as_obj() else { continue };
            let Some(path) = folder.get_str("path") else { continue };
            let lists_bg3 = folder
                .get_obj("apps")
                .is_some_and(|apps| apps.get(BG3_APP_ID).is_some());
            libraries.push((PathBuf::from(path), lists_bg3));
        }
    }

    dedupe(
        libraries
            .into_iter()
            .filter(|(library, listed)| *listed || manifest_path(library).is_file())
            .map(|(library, _)| library),
    )
}

/// `<library>/steamapps/common/<installdir>` for BG3.
pub fn install_dir(library: &Path) -> PathBuf {
    let name = std::fs::read_to_string(manifest_path(library))
        .ok()
        .and_then(|text| vdf::parse(&text).ok())
        .and_then(|doc| {
            doc.get_obj("AppState")?
                .get_str("installdir")
                .map(str::to_owned)
        })
        .unwrap_or_else(|| DEFAULT_INSTALL_DIR.to_owned());
    library.join("steamapps").join("common").join(name)
}

/// The first BG3 `Data` folder containing the vanilla paks in any Steam library.
pub fn find_bg3_data_dir(host: &HostDirs) -> Option<PathBuf> {
    bg3_libraries(&steam_roots(host))
        .into_iter()
        .map(|library| install_dir(&library).join("Data"))
        .find(|data| contains_vanilla_paks(data))
}

/// BG3's Proton prefix inside a `steamapps` folder.
pub fn proton_prefix(steamapps: &Path) -> PathBuf {
    steamapps.join("compatdata").join(BG3_APP_ID).join("pfx")
}

/// Existing BG3 Proton prefixes, checking each BG3 library and every Steam root.
pub fn bg3_proton_prefixes(roots: &[PathBuf]) -> Vec<PathBuf> {
    let libraries = bg3_libraries(roots);
    dedupe(
        libraries
            .iter()
            .chain(roots)
            .map(|library| proton_prefix(&library.join("steamapps")))
            .filter(|prefix| prefix.is_dir()),
    )
}

fn manifest_path(library: &Path) -> PathBuf {
    library
        .join("steamapps")
        .join(format!("appmanifest_{BG3_APP_ID}.acf"))
}

/// Remove paths that resolve to the same location, keeping the first.
fn dedupe(paths: impl IntoIterator<Item = PathBuf>) -> Vec<PathBuf> {
    let mut seen = HashSet::new();
    paths
        .into_iter()
        .filter(|path| seen.insert(path.canonicalize().unwrap_or_else(|_| path.clone())))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::game_locator::test_support::{host, write};

    fn library_folders_vdf(paths_with_bg3: &[(&Path, bool)]) -> String {
        let mut out = String::from("\"libraryfolders\"\n{\n");
        for (i, (path, has_bg3)) in paths_with_bg3.iter().enumerate() {
            let apps = if *has_bg3 { "\"1086940\" \"1\"" } else { "\"228980\" \"1\"" };
            out.push_str(&format!(
                "\"{i}\" {{ \"path\" \"{}\" \"apps\" {{ {apps} }} }}\n",
                path.display()
            ));
        }
        out.push('}');
        out
    }

    #[test]
    fn finds_data_dir_in_secondary_library() {
        let tmp = tempfile::tempdir().unwrap();
        let host = host(tmp.path());
        let root = host.data_home.join("Steam");
        let library = tmp.path().join("games/SteamLibrary");

        write(
            &root.join("steamapps/libraryfolders.vdf"),
            &library_folders_vdf(&[(&root, false), (&library, true)]),
        );
        write(
            &library.join("steamapps/appmanifest_1086940.acf"),
            r#""AppState" { "appid" "1086940" "installdir" "Baldurs Gate 3" }"#,
        );
        let data = library.join("steamapps/common/Baldurs Gate 3/Data");
        write(&data.join("Gustav.pak"), "");

        assert_eq!(find_bg3_data_dir(&host), Some(data));
    }

    #[test]
    fn finds_flatpak_install_from_manifest_without_vdf() {
        let tmp = tempfile::tempdir().unwrap();
        let host = host(tmp.path());
        let root = tmp.path().join(".var/app/com.valvesoftware.Steam/.local/share/Steam");

        write(&root.join("steamapps/appmanifest_1086940.acf"), r#""AppState" { }"#);
        let data = root.join("steamapps/common/Baldurs Gate 3/Data");
        write(&data.join("Shared.pak"), "");

        assert_eq!(steam_roots(&host), vec![root]);
        assert_eq!(find_bg3_data_dir(&host), Some(data));
    }

    #[test]
    fn finds_snap_root() {
        let tmp = tempfile::tempdir().unwrap();
        let host = host(tmp.path());
        let root = tmp.path().join("snap/steam/common/.local/share/Steam");
        std::fs::create_dir_all(root.join("steamapps")).unwrap();

        assert_eq!(steam_roots(&host), vec![root]);
    }

    #[cfg(unix)]
    #[test]
    fn symlinked_roots_are_deduplicated() {
        let tmp = tempfile::tempdir().unwrap();
        let host = host(tmp.path());
        let root = host.data_home.join("Steam");
        std::fs::create_dir_all(root.join("steamapps")).unwrap();
        std::fs::create_dir_all(tmp.path().join(".steam")).unwrap();
        std::os::unix::fs::symlink(&root, tmp.path().join(".steam/steam")).unwrap();

        assert_eq!(steam_roots(&host).len(), 1);
    }

    #[test]
    fn ignores_library_without_vanilla_paks() {
        let tmp = tempfile::tempdir().unwrap();
        let host = host(tmp.path());
        let root = host.data_home.join("Steam");
        write(
            &root.join("steamapps/libraryfolders.vdf"),
            &library_folders_vdf(&[(&root, true)]),
        );
        std::fs::create_dir_all(root.join("steamapps/common/Baldurs Gate 3/Data")).unwrap();

        assert_eq!(find_bg3_data_dir(&host), None);
    }

    #[test]
    fn install_dir_falls_back_to_default_name() {
        let library = Path::new("/nonexistent/library");
        assert_eq!(
            install_dir(library),
            library.join("steamapps/common/Baldurs Gate 3")
        );
    }

    #[test]
    fn proton_prefixes_cover_game_library_and_steam_root() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path().join("Steam");
        let library = tmp.path().join("SteamLibrary");
        write(
            &root.join("steamapps/libraryfolders.vdf"),
            &library_folders_vdf(&[(&root, false), (&library, true)]),
        );
        let library_prefix = proton_prefix(&library.join("steamapps"));
        let root_prefix = proton_prefix(&root.join("steamapps"));
        std::fs::create_dir_all(&library_prefix).unwrap();
        std::fs::create_dir_all(&root_prefix).unwrap();

        assert_eq!(
            bg3_proton_prefixes(&[root]),
            vec![library_prefix, root_prefix]
        );
    }
}
