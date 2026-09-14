//! Resolve the Larian user data folder, which holds `Mods/`, `PlayerProfiles/`
//! and `Script Extender Logs/`.
//!
//! | Platform | Location |
//! |---|---|
//! | Windows | `%LOCALAPPDATA%\Larian Studios\Baldur's Gate 3` |
//! | Linux, Proton or Wine | `<prefix>/drive_c/users/<user>/AppData/Local/Larian Studios/Baldur's Gate 3` |
//! | Linux, native build | `$XDG_DATA_HOME/Larian Studios/Baldur's Gate 3` |
#![cfg_attr(not(target_os = "linux"), allow(dead_code, unused_imports))]

use std::collections::HashSet;
use std::ffi::OsStr;
use std::path::{Path, PathBuf};

use serde::Serialize;
#[cfg(test)]
use ts_rs::TS;

use super::load_order::newest_modsettings;
use super::{steam, HostDirs};

const LARIAN_DIR: &str = "Larian Studios";
const GAME_DIR: &str = "Baldur's Gate 3";

/// Where a resolved user data folder came from.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[cfg_attr(test, derive(TS))]
#[cfg_attr(test, ts(export))]
pub enum UserDataSource {
    /// Set by the user in settings.
    Override,
    /// Steam Play (Proton) prefix: `steamapps/compatdata/1086940/pfx`.
    SteamProton,
    /// Wine prefix containing a manually selected install (`…/drive_c/…`).
    WinePrefix,
    /// Native Linux build, under the XDG data directory.
    NativeLinux,
    /// The platform's local app data directory (Windows, macOS).
    LocalAppData,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[cfg_attr(test, derive(TS))]
#[cfg_attr(test, ts(export))]
pub struct ResolvedUserDataDir {
    pub path: String,
    pub source: UserDataSource,
}

/// Resolve the user data folder for the current platform.
///
/// `override_dir` wins when it points at an existing directory. On Linux,
/// `game_data_path` (the configured `Data` folder) selects the matching Proton
/// or Wine prefix before falling back to every Steam library and the native
/// build's location. Returns `None` on Linux when no candidate exists.
pub fn resolve_user_data_dir(
    game_data_path: Option<&str>,
    override_dir: Option<&str>,
) -> Option<ResolvedUserDataDir> {
    let override_dir = override_dir
        .map(str::trim)
        .filter(|dir| !dir.is_empty())
        .map(PathBuf::from)
        .filter(|dir| dir.is_dir());
    if let Some(dir) = override_dir {
        return Some(to_resolved(dir, UserDataSource::Override));
    }

    #[cfg(target_os = "linux")]
    {
        let host = HostDirs::from_env()?;
        let game_data_path = game_data_path
            .map(str::trim)
            .filter(|path| !path.is_empty())
            .map(Path::new);
        pick_best(linux_candidates(&host, game_data_path))
            .map(|(dir, source)| to_resolved(dir, source))
    }

    #[cfg(not(target_os = "linux"))]
    {
        let _ = game_data_path;
        let dir = dirs::data_local_dir()?.join(LARIAN_DIR).join(GAME_DIR);
        Some(to_resolved(dir, UserDataSource::LocalAppData))
    }
}

fn to_resolved(dir: PathBuf, source: UserDataSource) -> ResolvedUserDataDir {
    ResolvedUserDataDir {
        path: dir.to_string_lossy().into_owned(),
        source,
    }
}

/// Existing user data folders on Linux, most specific first.
pub fn linux_candidates(
    host: &HostDirs,
    game_data_path: Option<&Path>,
) -> Vec<(PathBuf, UserDataSource)> {
    let mut candidates = Vec::new();

    if let Some(path) = game_data_path {
        if let Some(steamapps) = steamapps_ancestor(path) {
            push_prefix_user_dirs(
                &mut candidates,
                &steam::proton_prefix(steamapps),
                UserDataSource::SteamProton,
            );
        } else if let Some(prefix) = wine_prefix_ancestor(path) {
            push_prefix_user_dirs(&mut candidates, prefix, UserDataSource::WinePrefix);
        }
    }

    for prefix in steam::bg3_proton_prefixes(&steam::steam_roots(host)) {
        push_prefix_user_dirs(&mut candidates, &prefix, UserDataSource::SteamProton);
    }

    candidates.push((
        host.data_home.join(LARIAN_DIR).join(GAME_DIR),
        UserDataSource::NativeLinux,
    ));

    let mut seen = HashSet::new();
    candidates.retain(|(dir, _)| {
        dir.is_dir() && seen.insert(dir.canonicalize().unwrap_or_else(|_| dir.clone()))
    });
    candidates
}

/// Pick the candidate with the most recently written `modsettings.lsx`, i.e.
/// the install the player used last. Without any, keep priority order.
pub fn pick_best(
    candidates: Vec<(PathBuf, UserDataSource)>,
) -> Option<(PathBuf, UserDataSource)> {
    let index = candidates
        .iter()
        .enumerate()
        .filter_map(|(i, (dir, _))| newest_modsettings(dir).map(|(_, mtime)| (i, mtime)))
        .min_by_key(|&(i, mtime)| (std::cmp::Reverse(mtime), i))
        .map(|(i, _)| i)
        .unwrap_or(0);
    candidates.into_iter().nth(index)
}

/// `<library>/steamapps` for a path inside `<library>/steamapps/common/…`.
fn steamapps_ancestor(path: &Path) -> Option<&Path> {
    path.ancestors()
        .find(|dir| {
            dir.file_name() == Some(OsStr::new("common"))
                && dir.parent().and_then(Path::file_name) == Some(OsStr::new("steamapps"))
        })
        .and_then(Path::parent)
}

/// The Wine prefix for a path inside `<prefix>/drive_c/…`.
fn wine_prefix_ancestor(path: &Path) -> Option<&Path> {
    path.ancestors()
        .find(|dir| dir.file_name() == Some(OsStr::new("drive_c")))
        .and_then(Path::parent)
}

/// Add the user data folder of each user in a Wine prefix. Proton always
/// uses `steamuser`, so it goes first; plain Wine uses the login name.
fn push_prefix_user_dirs(
    out: &mut Vec<(PathBuf, UserDataSource)>,
    prefix: &Path,
    source: UserDataSource,
) {
    let Ok(entries) = std::fs::read_dir(prefix.join("drive_c").join("users")) else {
        return;
    };
    let mut users: Vec<PathBuf> = entries
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| {
            path.is_dir()
                && !path
                    .file_name()
                    .is_some_and(|name| name.eq_ignore_ascii_case("Public"))
        })
        .collect();
    users.sort_by_key(|user| (user.file_name() != Some(OsStr::new("steamuser")), user.clone()));

    for user in users {
        out.push((
            user.join("AppData").join("Local").join(LARIAN_DIR).join(GAME_DIR),
            source,
        ));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::game_locator::test_support::{host, set_mtime, write};

    fn prefix_user_dir(prefix: &Path, user: &str) -> PathBuf {
        prefix.join("drive_c/users").join(user).join("AppData/Local/Larian Studios/Baldur's Gate 3")
    }

    fn add_profile(user_dir: &Path, mtime: u64) {
        let file = user_dir.join("PlayerProfiles/Public/modsettings.lsx");
        write(&file, "<save />");
        set_mtime(&file, mtime);
    }

    #[test]
    fn override_wins_when_it_exists() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().to_string_lossy().into_owned();

        let resolved = resolve_user_data_dir(Some("/does/not/matter"), Some(&dir)).unwrap();
        assert_eq!(resolved, ResolvedUserDataDir { path: dir, source: UserDataSource::Override });
    }

    #[test]
    fn missing_override_is_ignored() {
        let resolved = resolve_user_data_dir(None, Some("/nonexistent/cmty-override"));
        assert_ne!(resolved.map(|r| r.source), Some(UserDataSource::Override));
    }

    #[test]
    fn derives_proton_prefix_from_steam_game_path() {
        let tmp = tempfile::tempdir().unwrap();
        let host = host(tmp.path());
        let steamapps = tmp.path().join("SteamLibrary/steamapps");
        let game_data = steamapps.join("common/Baldurs Gate 3/Data");
        let user_dir = prefix_user_dir(&steam::proton_prefix(&steamapps), "steamuser");
        std::fs::create_dir_all(&user_dir).unwrap();

        assert_eq!(
            linux_candidates(&host, Some(&game_data)),
            vec![(user_dir, UserDataSource::SteamProton)]
        );
    }

    #[test]
    fn derives_wine_prefix_from_drive_c_path_and_skips_public() {
        let tmp = tempfile::tempdir().unwrap();
        let host = host(tmp.path());
        let prefix = tmp.path().join("Games/bg3-prefix");
        let game_data = prefix.join("drive_c/GOG Games/Baldurs Gate 3/Data");
        let user_dir = prefix_user_dir(&prefix, "alice");
        std::fs::create_dir_all(&user_dir).unwrap();
        std::fs::create_dir_all(prefix_user_dir(&prefix, "Public")).unwrap();

        assert_eq!(
            linux_candidates(&host, Some(&game_data)),
            vec![(user_dir, UserDataSource::WinePrefix)]
        );
    }

    #[test]
    fn finds_proton_prefix_via_steam_libraries() {
        let tmp = tempfile::tempdir().unwrap();
        let host = host(tmp.path());
        let steamapps = host.data_home.join("Steam/steamapps");
        write(&steamapps.join("appmanifest_1086940.acf"), r#""AppState" { }"#);
        let user_dir = prefix_user_dir(&steam::proton_prefix(&steamapps), "steamuser");
        std::fs::create_dir_all(&user_dir).unwrap();

        assert_eq!(
            linux_candidates(&host, None),
            vec![(user_dir, UserDataSource::SteamProton)]
        );
    }

    #[test]
    fn native_build_uses_xdg_data_home() {
        let tmp = tempfile::tempdir().unwrap();
        let host = host(tmp.path());
        let native = host.data_home.join("Larian Studios/Baldur's Gate 3");
        std::fs::create_dir_all(&native).unwrap();

        assert_eq!(
            linux_candidates(&host, None),
            vec![(native, UserDataSource::NativeLinux)]
        );
    }

    #[test]
    fn newest_modsettings_picks_between_native_and_proton() {
        let tmp = tempfile::tempdir().unwrap();
        let proton = tmp.path().join("proton");
        let native = tmp.path().join("native");
        let candidates = || {
            vec![
                (proton.clone(), UserDataSource::SteamProton),
                (native.clone(), UserDataSource::NativeLinux),
            ]
        };

        add_profile(&proton, 1_000);
        add_profile(&native, 2_000);
        assert_eq!(pick_best(candidates()).unwrap().1, UserDataSource::NativeLinux);

        add_profile(&proton, 3_000);
        assert_eq!(pick_best(candidates()).unwrap().1, UserDataSource::SteamProton);
    }

    #[test]
    fn keeps_priority_order_without_modsettings() {
        let tmp = tempfile::tempdir().unwrap();
        let first = tmp.path().join("first");
        let second = tmp.path().join("second");

        let best = pick_best(vec![
            (first.clone(), UserDataSource::WinePrefix),
            (second, UserDataSource::NativeLinux),
        ]);
        assert_eq!(best, Some((first, UserDataSource::WinePrefix)));
        assert_eq!(pick_best(Vec::new()), None);
    }

    #[test]
    fn no_candidates_on_empty_home() {
        let tmp = tempfile::tempdir().unwrap();
        assert!(linux_candidates(&host(tmp.path()), None).is_empty());
    }
}
