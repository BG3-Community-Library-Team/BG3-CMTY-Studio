//! HTTP client builder for platform API requests.

use std::time::Duration;

use reqwest::Client;

use super::errors::PlatformError;

/// Build a configured `reqwest::Client` for platform API calls.
///
/// - Sets the `User-Agent` header
/// - Configures a request timeout
/// - Uses rustls for TLS (via the `rustls-tls` feature on `reqwest`)
pub fn build_client(user_agent: &str, timeout_secs: u64) -> Result<Client, PlatformError> {
    Client::builder()
        .user_agent(user_agent)
        .timeout(Duration::from_secs(timeout_secs))
        .build()
        .map_err(|e| PlatformError::HttpError(format!("Failed to build HTTP client: {e}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_client_successfully() {
        let client = build_client("BG3-CMTY-Studio/1.0.0", 30);
        assert!(client.is_ok());
    }

    #[test]
    fn builds_client_with_zero_timeout() {
        let client = build_client("BG3-CMTY-Studio/1.0.0", 0);
        assert!(client.is_ok());
    }
}
