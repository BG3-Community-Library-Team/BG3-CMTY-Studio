#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "linux")]
    work_around_nvidia_webkit_crash();

    bg3_cmty_studio_lib::run()
}

/// WebKitGTK's DMABUF renderer fails on the proprietary NVIDIA driver: the window
/// closes right after opening with "Error 71 (Protocol error) dispatching to Wayland
/// display". Disable that renderer there, unless the user already set the variable.
#[cfg(target_os = "linux")]
fn work_around_nvidia_webkit_crash() {
    const VAR: &str = "WEBKIT_DISABLE_DMABUF_RENDERER";
    if std::env::var_os(VAR).is_none() && std::path::Path::new("/proc/driver/nvidia/version").exists() {
        // Runs before any other thread exists, so changing the environment is sound.
        std::env::set_var(VAR, "1");
    }
}
