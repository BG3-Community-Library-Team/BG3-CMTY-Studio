//! Token-bucket rate limiter for platform API calls.

use std::time::Instant;

use tokio::sync::Mutex;

/// A simple token-bucket rate limiter.
///
/// Callers `acquire()` a token before each request. If the bucket is empty
/// the call sleeps until a token becomes available.
pub struct TokenBucket {
    inner: Mutex<BucketInner>,
}

struct BucketInner {
    max_tokens: f64,
    refill_rate_per_sec: f64,
    available: f64,
    last_refill: Instant,
}

impl TokenBucket {
    /// Create a new bucket that holds `max_tokens` and refills at
    /// `refill_rate_per_sec` tokens per second.
    pub fn new(max_tokens: u64, refill_rate_per_sec: f64) -> Self {
        Self {
            inner: Mutex::new(BucketInner {
                max_tokens: max_tokens as f64,
                refill_rate_per_sec,
                available: max_tokens as f64,
                last_refill: Instant::now(),
            }),
        }
    }

    /// Nexus Mods: conservative 100 requests/minute.
    pub fn new_nexus() -> Self {
        // 100 req/min ≈ 1.667 req/sec
        Self::new(100, 100.0 / 60.0)
    }

    /// mod.io read endpoints: 60 req/min (API key) or 120 req/min (OAuth2).
    pub fn new_modio_read(authenticated: bool) -> Self {
        if authenticated {
            Self::new(120, 120.0 / 60.0)
        } else {
            Self::new(60, 60.0 / 60.0)
        }
    }

    /// mod.io write endpoints: 60 req/min.
    pub fn new_modio_write() -> Self {
        Self::new(60, 60.0 / 60.0)
    }

    /// Wait until a token is available, then consume it.
    pub async fn acquire(&self) {
        loop {
            let sleep_dur = {
                let mut inner = self.inner.lock().await;
                // Refill tokens based on elapsed time
                let now = Instant::now();
                let elapsed = now.duration_since(inner.last_refill).as_secs_f64();
                inner.available =
                    (inner.available + elapsed * inner.refill_rate_per_sec).min(inner.max_tokens);
                inner.last_refill = now;

                if inner.available >= 1.0 {
                    inner.available -= 1.0;
                    return;
                }

                // Calculate how long until one token is available
                let deficit = 1.0 - inner.available;
                std::time::Duration::from_secs_f64(deficit / inner.refill_rate_per_sec)
            };
            tokio::time::sleep(sleep_dur).await;
        }
    }

    /// Parse a `Retry-After` HTTP header value.
    ///
    /// Supports two formats:
    /// - **Seconds:** a decimal integer (e.g. `"120"`)
    /// - **HTTP-date:** e.g. `"Fri, 31 Dec 1999 23:59:59 GMT"` (parsed via `chrono`)
    pub fn parse_retry_after(header: &str) -> Option<u64> {
        // Try seconds first (most common)
        if let Ok(secs) = header.trim().parse::<u64>() {
            return Some(secs);
        }

        // Try HTTP-date format: "Mon, 01 Jan 2024 00:00:00 GMT"
        if let Ok(dt) = chrono::DateTime::parse_from_rfc2822(header.trim()) {
            let now = chrono::Utc::now();
            let diff = dt.signed_duration_since(now).num_seconds();
            return Some(if diff > 0 { diff as u64 } else { 0 });
        }

        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn acquire_succeeds_with_available_tokens() {
        let bucket = TokenBucket::new(5, 5.0);
        // Should return immediately for the first 5 tokens
        for _ in 0..5 {
            bucket.acquire().await;
        }
    }

    #[test]
    fn parse_retry_after_seconds() {
        assert_eq!(TokenBucket::parse_retry_after("120"), Some(120));
        assert_eq!(TokenBucket::parse_retry_after("  60  "), Some(60));
        assert_eq!(TokenBucket::parse_retry_after("0"), Some(0));
    }

    #[test]
    fn parse_retry_after_invalid() {
        assert_eq!(TokenBucket::parse_retry_after("not-a-number"), None);
        assert_eq!(TokenBucket::parse_retry_after(""), None);
    }

    #[test]
    fn nexus_bucket_has_correct_capacity() {
        // Just verify construction doesn't panic
        let _bucket = TokenBucket::new_nexus();
    }

    #[test]
    fn modio_read_buckets() {
        let _unauth = TokenBucket::new_modio_read(false);
        let _auth = TokenBucket::new_modio_read(true);
    }

    #[test]
    fn modio_write_bucket() {
        let _bucket = TokenBucket::new_modio_write();
    }
}
