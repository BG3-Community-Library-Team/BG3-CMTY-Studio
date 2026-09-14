//! Platform credential management via the OS keyring.
//!
//! Wraps the `keyring` crate to store / retrieve / delete API keys
//! for Nexus Mods and mod.io in the OS credential manager: Windows Credential
//! Manager, macOS Keychain, or a Secret Service provider on Linux (GNOME
//! Keyring, KWallet, KeePassXC, ...).

use keyring::Entry;
use serde::Serialize;
#[cfg(test)]
use ts_rs::TS;

use super::errors::PlatformError;

/// Service name used for all platform credentials in the OS keyring.
const SERVICE_NAME: &str = "bg3-cmty-studio";

/// Entry read (never written) to check whether the credential store works.
const PROBE_USERNAME: &str = "cmty-studio-probe";

/// Maximum characters per keyring entry on Windows.
/// Windows Credential Manager limits passwords to 2560 bytes (UTF-16),
/// which is ~1280 characters. We use 1200 to leave a safety margin.
const CHUNK_MAX_CHARS: usize = 1200;

/// Availability of the OS credential store, shown in the credential settings.
#[derive(Debug, Clone, Serialize)]
#[cfg_attr(test, derive(TS))]
#[cfg_attr(test, ts(export))]
pub struct CredentialBackendStatus {
    pub available: bool,
    /// Provider name such as "KWallet", when it can be identified (Linux only).
    pub provider: Option<String>,
    /// Why the store can't be used, when unavailable.
    pub reason: Option<String>,
}

/// Convert a keyring error, separating "the credential store can't be used"
/// (no Secret Service provider, locked or refused) from other failures.
fn keyring_error(context: &str, err: keyring::Error) -> PlatformError {
    match err {
        keyring::Error::PlatformFailure(e) | keyring::Error::NoStorageAccess(e) => {
            PlatformError::CredentialStoreUnavailable(format!("{context}: {e}"))
        }
        other => PlatformError::KeyringError(format!("{context}: {other}")),
    }
}

/// Store a credential in the OS keyring.
///
/// If the value exceeds the platform limit, it is automatically split
/// across multiple keyring entries (`key`, `key:1`, `key:2`, …).
pub fn store_credential(service: &str, username: &str, value: &str) -> Result<(), PlatformError> {
    let key = format!("{service}:{username}");

    if value.len() <= CHUNK_MAX_CHARS {
        // Fast path: fits in a single entry — clear any old chunks first.
        delete_chunks(&key);
        let entry = Entry::new(SERVICE_NAME, &key)
            .map_err(|e| keyring_error("Failed to create keyring entry", e))?;
        entry
            .set_password(value)
            .map_err(|e| keyring_error("Failed to store credential", e))?;
        return Ok(());
    }

    // Chunked path: split into CHUNK_MAX_CHARS-sized pieces.
    let chunks: Vec<&str> = value
        .as_bytes()
        .chunks(CHUNK_MAX_CHARS)
        .map(|c| std::str::from_utf8(c).unwrap_or(""))
        .collect();

    // Store the chunk count in the base entry so we know how to reassemble.
    let base_entry = Entry::new(SERVICE_NAME, &key)
        .map_err(|e| keyring_error("Failed to create keyring entry", e))?;
    base_entry
        .set_password(&format!("__chunked:{}", chunks.len()))
        .map_err(|e| keyring_error("Failed to store credential header", e))?;

    for (i, chunk) in chunks.iter().enumerate() {
        let chunk_key = format!("{key}:{i}");
        let entry = Entry::new(SERVICE_NAME, &chunk_key)
            .map_err(|e| keyring_error(&format!("Failed to create keyring entry for chunk {i}"), e))?;
        entry
            .set_password(chunk)
            .map_err(|e| keyring_error(&format!("Failed to store credential chunk {i}"), e))?;
    }

    Ok(())
}

/// Retrieve a credential from the OS keyring.
///
/// Transparently reassembles chunked credentials.
/// Returns `Ok(None)` when no entry exists for the given service/username pair.
pub fn get_credential(service: &str, username: &str) -> Result<Option<String>, PlatformError> {
    let key = format!("{service}:{username}");
    let entry = Entry::new(SERVICE_NAME, &key)
        .map_err(|e| keyring_error("Failed to create keyring entry", e))?;
    let base_value = match entry.get_password() {
        Ok(value) => value,
        Err(keyring::Error::NoEntry) => return Ok(None),
        Err(e) => return Err(keyring_error("Failed to read credential", e)),
    };

    // Check if this is a chunked credential.
    if let Some(count_str) = base_value.strip_prefix("__chunked:") {
        let count: usize = count_str.parse().map_err(|_| {
            PlatformError::KeyringError("Corrupted chunked credential header".into())
        })?;
        let mut assembled = String::new();
        for i in 0..count {
            let chunk_key = format!("{key}:{i}");
            let chunk_entry = Entry::new(SERVICE_NAME, &chunk_key)
                .map_err(|e| keyring_error(&format!("Failed to open chunk {i}"), e))?;
            let chunk = chunk_entry
                .get_password()
                .map_err(|e| keyring_error(&format!("Failed to read chunk {i}"), e))?;
            assembled.push_str(&chunk);
        }
        return Ok(Some(assembled));
    }

    Ok(Some(base_value))
}

/// Delete a credential from the OS keyring.
///
/// Silently succeeds if the credential does not exist.
/// Also cleans up any chunked entries.
pub fn delete_credential(service: &str, username: &str) -> Result<(), PlatformError> {
    let key = format!("{service}:{username}");

    // Check if chunked and clean up chunk entries first.
    let entry = Entry::new(SERVICE_NAME, &key)
        .map_err(|e| keyring_error("Failed to create keyring entry", e))?;
    if let Ok(val) = entry.get_password() {
        if let Some(count_str) = val.strip_prefix("__chunked:") {
            if let Ok(count) = count_str.parse::<usize>() {
                for i in 0..count {
                    let chunk_key = format!("{key}:{i}");
                    if let Ok(ce) = Entry::new(SERVICE_NAME, &chunk_key) {
                        let _ = ce.delete_credential();
                    }
                }
            }
        }
    }

    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(keyring_error("Failed to delete credential", e)),
    }
}

/// Delete any leftover chunk entries for a key (used when overwriting).
fn delete_chunks(key: &str) {
    if let Ok(entry) = Entry::new(SERVICE_NAME, key) {
        if let Ok(val) = entry.get_password() {
            if let Some(count_str) = val.strip_prefix("__chunked:") {
                if let Ok(count) = count_str.parse::<usize>() {
                    for i in 0..count {
                        let chunk_key = format!("{key}:{i}");
                        if let Ok(ce) = Entry::new(SERVICE_NAME, &chunk_key) {
                            let _ = ce.delete_credential();
                        }
                    }
                }
            }
        }
    }
}

/// Check whether the OS credential store can be used, by reading a probe
/// entry (a missing entry counts as available).
pub fn backend_status() -> CredentialBackendStatus {
    let probe = Entry::new(SERVICE_NAME, PROBE_USERNAME).and_then(|entry| match entry.get_password() {
        Ok(_) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e),
    });
    CredentialBackendStatus {
        available: probe.is_ok(),
        provider: provider_name(),
        reason: probe.err().map(|e| e.to_string()),
    }
}

/// Identify the process that owns `org.freedesktop.secrets` on the session bus.
#[cfg(target_os = "linux")]
fn provider_name() -> Option<String> {
    use std::time::Duration;

    let conn = dbus::blocking::Connection::new_session().ok()?;
    let proxy = conn.with_proxy(
        "org.freedesktop.DBus",
        "/org/freedesktop/DBus",
        Duration::from_secs(2),
    );
    let (pid,): (u32,) = proxy
        .method_call(
            "org.freedesktop.DBus",
            "GetConnectionUnixProcessID",
            ("org.freedesktop.secrets",),
        )
        .ok()?;
    let process = std::fs::read_to_string(format!("/proc/{pid}/comm")).ok()?;
    Some(provider_display_name(process.trim()))
}

#[cfg(not(target_os = "linux"))]
fn provider_name() -> Option<String> {
    None
}

/// Map a Secret Service daemon's process name (truncated to 15 characters
/// by the kernel) to the product name users know.
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
fn provider_display_name(process: &str) -> String {
    let name = match process {
        p if p.starts_with("gnome-keyring") => "GNOME Keyring",
        "ksecretd" | "kwalletd" | "kwalletd5" | "kwalletd6" => "KWallet",
        p if p.to_ascii_lowercase().starts_with("keepassxc") => "KeePassXC",
        "oo7-daemon" => "oo7",
        p if p.starts_with("pass-secret") => "pass",
        other => other,
    };
    name.to_owned()
}

/// Read a credential from the legacy "cmtystudio" keyring service.
/// Used during one-time migration only.
pub fn get_legacy_credential(key: &str) -> Result<Option<String>, PlatformError> {
    const LEGACY_SERVICE: &str = "cmtystudio";
    let entry = Entry::new(LEGACY_SERVICE, key)
        .map_err(|e| keyring_error("Legacy keyring init error", e))?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(keyring_error("Failed to read legacy credential", e)),
    }
}

/// Delete a credential from the legacy "cmtystudio" keyring service.
/// Used during one-time migration only.
pub fn delete_legacy_credential(key: &str) -> Result<(), PlatformError> {
    const LEGACY_SERVICE: &str = "cmtystudio";
    let entry = Entry::new(LEGACY_SERVICE, key)
        .map_err(|e| keyring_error("Legacy keyring init error", e))?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(keyring_error("Failed to delete legacy credential", e)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // NOTE: These tests interact with the real OS keyring.
    // They use a unique username to avoid collisions.
    const TEST_USERNAME: &str = "cmty-studio-test-credential";

    /// Skip when the OS keyring backend is unavailable (e.g. no
    /// `org.freedesktop.secrets` provider on Linux CI) instead of failing.
    macro_rules! skip_without_keyring {
        () => {
            if !backend_status().available {
                eprintln!("SKIPPED: OS keyring backend not available (e.g. no org.freedesktop.secrets on Linux CI)");
                return;
            }
        };
    }

    #[test]
    fn round_trip_store_get_delete() {
        skip_without_keyring!();

        let service = "platform-test";
        let secret = "test-api-key-12345";

        // Store
        store_credential(service, TEST_USERNAME, secret).expect("store should succeed");

        // Get
        let retrieved = get_credential(service, TEST_USERNAME).expect("get should succeed");
        assert_eq!(retrieved, Some(secret.to_string()));

        // Delete
        delete_credential(service, TEST_USERNAME).expect("delete should succeed");

        // Verify deleted
        let after_delete =
            get_credential(service, TEST_USERNAME).expect("get after delete should succeed");
        assert_eq!(after_delete, None);
    }

    #[test]
    fn round_trip_chunked_credential() {
        skip_without_keyring!();

        // Separate username: tests run in parallel against the same keyring.
        const CHUNKED_USERNAME: &str = "cmty-studio-test-chunked-credential";
        let secret = "x".repeat(CHUNK_MAX_CHARS * 2 + 10);
        store_credential("platform-test", CHUNKED_USERNAME, &secret).expect("store should succeed");
        let retrieved = get_credential("platform-test", CHUNKED_USERNAME).expect("get should succeed");
        delete_credential("platform-test", CHUNKED_USERNAME).expect("delete should succeed");
        assert_eq!(retrieved.map(|s| s.len()), Some(secret.len()));
    }

    #[test]
    fn get_nonexistent_returns_none() {
        skip_without_keyring!();

        let result =
            get_credential("platform-test", "nonexistent-key-xyz").expect("should not error");
        assert_eq!(result, None);
    }

    #[test]
    fn delete_nonexistent_succeeds() {
        skip_without_keyring!();

        delete_credential("platform-test", "nonexistent-key-xyz")
            .expect("delete nonexistent should succeed");
    }

    #[test]
    fn storage_access_errors_map_to_unavailable() {
        let locked = keyring::Error::NoStorageAccess(Box::new(std::io::Error::other("locked")));
        assert!(matches!(
            keyring_error("ctx", locked),
            PlatformError::CredentialStoreUnavailable(msg) if msg == "ctx: locked"
        ));

        let no_bus = keyring::Error::PlatformFailure(Box::new(std::io::Error::other("no bus")));
        assert!(matches!(
            keyring_error("ctx", no_bus),
            PlatformError::CredentialStoreUnavailable(_)
        ));

        assert!(matches!(
            keyring_error("ctx", keyring::Error::BadEncoding(vec![0xff])),
            PlatformError::KeyringError(_)
        ));
    }

    #[test]
    fn maps_provider_process_names() {
        assert_eq!(provider_display_name("gnome-keyring-d"), "GNOME Keyring");
        assert_eq!(provider_display_name("ksecretd"), "KWallet");
        assert_eq!(provider_display_name("kwalletd6"), "KWallet");
        assert_eq!(provider_display_name("keepassxc"), "KeePassXC");
        assert_eq!(provider_display_name("oo7-daemon"), "oo7");
        assert_eq!(provider_display_name("pass-secret-ser"), "pass");
        assert_eq!(provider_display_name("custom-secrets"), "custom-secrets");
    }
}
