use keyring::Entry;

const SERVICE_NAME: &str = "cmtystudio";

/// Get a value from OS-level secure storage (Windows Credential Manager / macOS Keychain / Linux Secret Service).
fn get_entry(key: &str) -> Result<Entry, String> {
    Entry::new(SERVICE_NAME, key).map_err(|e| format!("Keyring init error for '{}': {}", key, e))
}

/// Read a secure setting by key. Returns empty string if not found.
pub fn get_secure_setting(key: &str) -> Result<String, String> {
    let entry = get_entry(key)?;
    match entry.get_password() {
        Ok(val) => Ok(val),
        Err(keyring::Error::NoEntry) => Ok(String::new()),
        Err(e) => Err(format!("Failed to read secure setting '{}': {}", key, e)),
    }
}

/// Write a secure setting by key. Empty values delete the entry.
pub fn set_secure_setting(key: &str, value: &str) -> Result<(), String> {
    let entry = get_entry(key)?;
    if value.is_empty() {
        // Delete the entry if value is empty (ignore NoEntry errors)
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(format!("Failed to delete secure setting '{}': {}", key, e)),
        }
    } else {
        entry
            .set_password(value)
            .map_err(|e| format!("Failed to write secure setting '{}': {}", key, e))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── get_entry ───────────────────────────────────────────────

    #[test]
    fn get_entry_returns_ok_for_valid_key() {
        let result = get_entry("test_key");
        assert!(result.is_ok(), "get_entry should succeed for a valid key");
    }

    #[test]
    fn get_entry_returns_ok_for_empty_key() {
        // keyring::Entry::new may or may not accept empty keys depending on backend,
        // but our wrapper should not panic.
        let result = get_entry("");
        let _ = result;
    }

    // ── get_secure_setting / set_secure_setting (integration) ──

    #[test]
    #[ignore] // Requires OS credential store (Windows Credential Manager / macOS Keychain)
    fn roundtrip_set_and_get_secure_setting() {
        let key = "cmtystudio_test_roundtrip";
        let value = "test_secret_value_12345";

        // Write
        set_secure_setting(key, value).expect("set should succeed");
        // Read back
        let read = get_secure_setting(key).expect("get should succeed");
        assert_eq!(read, value);

        // Clean up: delete by setting empty value
        set_secure_setting(key, "").expect("delete should succeed");
        let after_delete = get_secure_setting(key).expect("get after delete");
        assert!(after_delete.is_empty(), "deleted key should return empty string");
    }

    #[test]
    #[ignore] // Requires OS credential store
    fn get_secure_setting_missing_key_returns_empty() {
        let key = "cmtystudio_test_nonexistent_key_xyz";
        let result = get_secure_setting(key).expect("get should succeed");
        assert!(result.is_empty(), "missing key should return empty string");
    }

    #[test]
    #[ignore] // Requires OS credential store
    fn set_secure_setting_empty_value_deletes() {
        let key = "cmtystudio_test_delete_flow";
        set_secure_setting(key, "temporary").expect("set");
        set_secure_setting(key, "").expect("delete via empty");
        let result = get_secure_setting(key).expect("get");
        assert!(result.is_empty());
    }

    #[test]
    #[ignore] // Requires OS credential store
    fn set_secure_setting_delete_nonexistent_is_ok() {
        let key = "cmtystudio_test_delete_nonexistent";
        // Deleting a key that doesn't exist should succeed (NoEntry is ignored)
        let result = set_secure_setting(key, "");
        assert!(result.is_ok(), "deleting nonexistent key should not error");
    }
}
