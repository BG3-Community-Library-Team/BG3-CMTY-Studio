//! Input validation helpers for platform publishing fields.

use super::errors::PlatformError;

/// Allowed characters for Nexus mod names: alphanumeric + ` _'().-`
fn is_nexus_name_char(c: char) -> bool {
    c.is_ascii_alphanumeric() || " _'().-".contains(c)
}

/// Allowed characters for Nexus version strings: alphanumeric + `.-`
fn is_nexus_version_char(c: char) -> bool {
    c.is_ascii_alphanumeric() || ".-".contains(c)
}

/// Validate a Nexus Mods file name (1–50 chars, restricted character set).
pub fn validate_nexus_name(name: &str) -> Result<(), PlatformError> {
    if name.is_empty() || name.len() > 50 {
        return Err(PlatformError::ValidationError(
            "Nexus file name must be 1–50 characters".into(),
        ));
    }
    if let Some(bad) = name.chars().find(|c| !is_nexus_name_char(*c)) {
        return Err(PlatformError::ValidationError(format!(
            "Nexus file name contains invalid character: '{bad}'"
        )));
    }
    Ok(())
}

/// Validate a Nexus Mods version string (1–50 chars, alphanumeric + `.-`).
pub fn validate_nexus_version(ver: &str) -> Result<(), PlatformError> {
    if ver.is_empty() || ver.len() > 50 {
        return Err(PlatformError::ValidationError(
            "Nexus version must be 1–50 characters".into(),
        ));
    }
    if let Some(bad) = ver.chars().find(|c| !is_nexus_version_char(*c)) {
        return Err(PlatformError::ValidationError(format!(
            "Nexus version contains invalid character: '{bad}'"
        )));
    }
    Ok(())
}

/// Validate a mod.io mod name (must be non-empty).
pub fn validate_modio_name(name: &str) -> Result<(), PlatformError> {
    if name.is_empty() {
        return Err(PlatformError::ValidationError(
            "mod.io mod name must not be empty".into(),
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nexus_name_valid() {
        assert!(validate_nexus_name("My Mod (v2.1)").is_ok());
        assert!(validate_nexus_name("a").is_ok());
        assert!(validate_nexus_name("mod-name_v1.0").is_ok());
        assert!(validate_nexus_name("It's a mod").is_ok());
    }

    #[test]
    fn nexus_name_empty() {
        assert!(validate_nexus_name("").is_err());
    }

    #[test]
    fn nexus_name_too_long() {
        let long = "a".repeat(51);
        assert!(validate_nexus_name(&long).is_err());
    }

    #[test]
    fn nexus_name_invalid_char() {
        assert!(validate_nexus_name("mod@name").is_err());
        assert!(validate_nexus_name("mod<name>").is_err());
    }

    #[test]
    fn nexus_version_valid() {
        assert!(validate_nexus_version("1.0.0").is_ok());
        assert!(validate_nexus_version("2.1-beta").is_ok());
        assert!(validate_nexus_version("v3").is_ok());
    }

    #[test]
    fn nexus_version_empty() {
        assert!(validate_nexus_version("").is_err());
    }

    #[test]
    fn nexus_version_invalid_char() {
        assert!(validate_nexus_version("1.0 beta").is_err());
        assert!(validate_nexus_version("1.0_rc1").is_err());
    }

    #[test]
    fn modio_name_valid() {
        assert!(validate_modio_name("Any string works").is_ok());
    }

    #[test]
    fn modio_name_empty() {
        assert!(validate_modio_name("").is_err());
    }
}
