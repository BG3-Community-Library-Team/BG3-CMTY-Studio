//! Locating a Baldur's Gate 3 install and the Larian user data folder
//! (`Mods/`, `PlayerProfiles/`, Script Extender logs) across platforms.
//!
//! Linux discovery covers Steam (native, Flatpak and Snap clients) for both
//! the native Linux build and Proton. Other launchers rely on a manually
//! selected game path or a user data folder override.

pub mod load_order;
pub mod steam;
pub mod user_data;
pub mod vdf;

use std::path::{Path, PathBuf};

pub use user_data::{resolve_user_data_dir, ResolvedUserDataDir, UserDataSource};

/// Vanilla paks; any one of them marks a folder as the game's `Data` directory.
const VANILLA_PAKS: [&str; 3] = ["Gustav.pak", "GustavX.pak", "Shared.pak"];

/// Whether `dir` contains at least one of the vanilla game paks.
pub fn contains_vanilla_paks(dir: &Path) -> bool {
    VANILLA_PAKS.iter().any(|name| dir.join(name).is_file())
}

/// Home and XDG data directories, passed explicitly so discovery can be
/// tested against fake directory layouts.
#[derive(Debug, Clone)]
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
pub struct HostDirs {
    pub home: PathBuf,
    /// `$XDG_DATA_HOME`, defaulting to `~/.local/share`.
    pub data_home: PathBuf,
}

#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
impl HostDirs {
    pub fn from_env() -> Option<Self> {
        let home = dirs::home_dir()?;
        let in_flatpak = std::env::var_os("FLATPAK_ID").is_some();
        let data_home = host_data_home(&home, in_flatpak, |var| std::env::var_os(var));
        Some(Self { home, data_home })
    }
}

/// The host's `$XDG_DATA_HOME`. Inside a Flatpak sandbox `XDG_DATA_HOME` points at the
/// app's private `~/.var/app/<id>/data`, so the host value Flatpak exposes as
/// `HOST_XDG_DATA_HOME` is used there instead.
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
fn host_data_home(
    home: &Path,
    in_flatpak: bool,
    env: impl Fn(&str) -> Option<std::ffi::OsString>,
) -> PathBuf {
    let var = if in_flatpak { "HOST_XDG_DATA_HOME" } else { "XDG_DATA_HOME" };
    env(var)
        .map(PathBuf::from)
        .filter(|path| path.is_absolute())
        .unwrap_or_else(|| home.join(".local").join("share"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn host_data_home_ignores_sandboxed_xdg_data_home_in_flatpak() {
        let home = Path::new("/home/user");
        let env = |var: &str| match var {
            "XDG_DATA_HOME" => Some("/home/user/.var/app/com.cmtystudio.editor/data".into()),
            "HOST_XDG_DATA_HOME" => Some("/home/user/custom-data".into()),
            _ => None,
        };

        assert_eq!(host_data_home(home, true, env), PathBuf::from("/home/user/custom-data"));
        assert_eq!(
            host_data_home(home, false, env),
            PathBuf::from("/home/user/.var/app/com.cmtystudio.editor/data")
        );
        assert_eq!(host_data_home(home, true, |_| None), home.join(".local/share"));
        assert_eq!(host_data_home(home, false, |_| Some("relative".into())), home.join(".local/share"));
    }
}

#[cfg(test)]
pub(crate) mod test_support {
    use std::path::Path;
    use std::time::{Duration, SystemTime};

    use super::HostDirs;

    pub fn host(root: &Path) -> HostDirs {
        HostDirs {
            home: root.to_path_buf(),
            data_home: root.join(".local").join("share"),
        }
    }

    pub fn write(path: &Path, content: &str) {
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(path, content).unwrap();
    }

    pub fn set_mtime(path: &Path, secs_since_epoch: u64) {
        let file = std::fs::File::options().write(true).open(path).unwrap();
        file.set_modified(SystemTime::UNIX_EPOCH + Duration::from_secs(secs_since_epoch))
            .unwrap();
    }
}
