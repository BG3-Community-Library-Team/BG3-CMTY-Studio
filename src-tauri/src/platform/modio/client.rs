//! mod.io API client with integrated rate limiting.

use crate::platform::errors::PlatformError;
use crate::platform::http::build_client;
use crate::platform::rate_limiter::TokenBucket;

/// User-Agent string sent with all mod.io requests.
const USER_AGENT: &str = "BG3-CMTY-Studio/1.0.0";

/// Request timeout in seconds.
const TIMEOUT_SECS: u64 = 120;

/// mod.io API base URL.
pub const BASE_URL: &str = "https://api.mod.io/v1";

/// HTTP client wrapper for the mod.io API.
///
/// Manages authentication state (API key + optional OAuth2 token)
/// and enforces per-bucket rate limits.
pub struct ModioClient {
    client: reqwest::Client,
    api_key: String,
    token: Option<String>,
    pub read_limiter: TokenBucket,
    pub write_limiter: TokenBucket,
}

impl ModioClient {
    /// Create a client with API-key-only authentication.
    pub fn new(api_key: &str) -> Result<Self, PlatformError> {
        let client = build_client(USER_AGENT, TIMEOUT_SECS)?;
        Ok(Self {
            client,
            api_key: api_key.to_string(),
            token: None,
            read_limiter: TokenBucket::new_modio_read(false),
            write_limiter: TokenBucket::new_modio_write(),
        })
    }

    /// Create a client with both API key and OAuth2 token.
    pub fn with_token(api_key: &str, token: &str) -> Result<Self, PlatformError> {
        let client = build_client(USER_AGENT, TIMEOUT_SECS)?;
        Ok(Self {
            client,
            api_key: api_key.to_string(),
            token: Some(token.to_string()),
            read_limiter: TokenBucket::new_modio_read(true),
            write_limiter: TokenBucket::new_modio_write(),
        })
    }

    /// Set (or replace) the OAuth2 token and upgrade read rate limit.
    pub fn set_token(&mut self, token: &str) {
        self.token = Some(token.to_string());
        // Upgrade read bucket to authenticated limit (120 req/min)
        self.read_limiter = TokenBucket::new_modio_read(true);
    }

    /// Whether an OAuth2 token is available.
    pub fn has_token(&self) -> bool {
        self.token.is_some()
    }

    /// Get the API key.
    pub fn api_key(&self) -> &str {
        &self.api_key
    }

    /// Get the OAuth2 token, if set.
    pub fn token(&self) -> Option<&str> {
        self.token.as_deref()
    }

    /// Get the underlying `reqwest::Client`.
    pub fn http_client(&self) -> &reqwest::Client {
        &self.client
    }

    /// Create a snapshot copy suitable for use outside the `Mutex` lock.
    ///
    /// `reqwest::Client` is cheaply cloneable (Arc-wrapped internally).
    /// Rate limiters are freshly created per snapshot — acceptable because
    /// snapshots are short-lived (one IPC command).
    pub fn clone_snapshot(&self) -> ModioClientSnapshot {
        ModioClientSnapshot {
            client: self.client.clone(),
            api_key: self.api_key.clone(),
            token: self.token.clone(),
            read_limiter: if self.token.is_some() {
                TokenBucket::new_modio_read(true)
            } else {
                TokenBucket::new_modio_read(false)
            },
            write_limiter: TokenBucket::new_modio_write(),
        }
    }
}

/// A cheaply-produced snapshot of `ModioClient` for use in async contexts
/// where holding the `Mutex` lock across `.await` is not possible.
pub struct ModioClientSnapshot {
    client: reqwest::Client,
    api_key: String,
    token: Option<String>,
    pub read_limiter: TokenBucket,
    pub write_limiter: TokenBucket,
}

impl ModioClientSnapshot {
    pub fn http_client(&self) -> &reqwest::Client {
        &self.client
    }

    pub fn api_key(&self) -> &str {
        &self.api_key
    }

    pub fn token(&self) -> Option<&str> {
        self.token.as_deref()
    }

    pub fn has_token(&self) -> bool {
        self.token.is_some()
    }
}
