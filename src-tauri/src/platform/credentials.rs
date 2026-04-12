//! Platform credential management via the OS keyring.
//!
//! Wraps the `keyring` crate to store / retrieve / delete API keys
//! for Nexus Mods and mod.io in the OS credential manager.

use keyring::Entry;

use super::errors::PlatformError;

/// Service name used for all platform credentials in the OS keyring.
const SERVICE_NAME: &str = "bg3-cmty-studio";

/// Store a credential in the OS keyring.
pub fn store_credential(service: &str, username: &str, value: &str) -> Result<(), PlatformError> {
    let key = format!("{service}:{username}");
    let entry = Entry::new(SERVICE_NAME, &key)
        .map_err(|e| PlatformError::KeyringError(format!("Failed to create keyring entry: {e}")))?;
    entry
        .set_password(value)
        .map_err(|e| PlatformError::KeyringError(format!("Failed to store credential: {e}")))
}

/// Retrieve a credential from the OS keyring.
///
/// Returns `Ok(None)` when no entry exists for the given service/username pair.
pub fn get_credential(service: &str, username: &str) -> Result<Option<String>, PlatformError> {
    let key = format!("{service}:{username}");
    let entry = Entry::new(SERVICE_NAME, &key)
        .map_err(|e| PlatformError::KeyringError(format!("Failed to create keyring entry: {e}")))?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(PlatformError::KeyringError(format!(
            "Failed to read credential: {e}"
        ))),
    }
}

/// Delete a credential from the OS keyring.
///
/// Silently succeeds if the credential does not exist.
pub fn delete_credential(service: &str, username: &str) -> Result<(), PlatformError> {
    let key = format!("{service}:{username}");
    let entry = Entry::new(SERVICE_NAME, &key)
        .map_err(|e| PlatformError::KeyringError(format!("Failed to create keyring entry: {e}")))?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(PlatformError::KeyringError(format!(
            "Failed to delete credential: {e}"
        ))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // NOTE: These tests interact with the real OS keyring.
    // They use a unique username to avoid collisions.
    const TEST_USERNAME: &str = "cmty-studio-test-credential";

    /// Returns `true` when the OS keyring backend is available.
    /// On Linux CI there is typically no `org.freedesktop.secrets` provider,
    /// so we skip tests gracefully instead of failing.
    fn keyring_available() -> bool {
        match Entry::new(SERVICE_NAME, "cmty-studio-probe") {
            Ok(entry) => {
                // Attempt a read — NoEntry is fine, any platform error means
                // the backend is not wired up.
                match entry.get_password() {
                    Ok(_) | Err(keyring::Error::NoEntry) => true,
                    Err(_) => false,
                }
            }
            Err(_) => false,
        }
    }

    macro_rules! skip_without_keyring {
        () => {
            if !keyring_available() {
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
}
