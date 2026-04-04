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
