#!/usr/bin/env bash
set -euo pipefail

cd src-tauri

# On Linux, run inside a private D-Bus session with an unlocked GNOME Keyring so the
# credential tests exercise a real Secret Service provider instead of skipping.
if [[ "$(uname -s)" == "Linux" ]] && command -v dbus-run-session >/dev/null && command -v gnome-keyring-daemon >/dev/null; then
  dbus-run-session -- bash -c 'echo -n "" | gnome-keyring-daemon --daemonize --components=secrets --unlock >/dev/null && cargo test'
else
  cargo test
fi
