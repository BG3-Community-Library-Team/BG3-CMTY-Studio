//! Rate limiter instances for forge API calls.

use crate::platform::rate_limiter::TokenBucket;

/// GitHub API: 5,000 requests/hour for authenticated users.
pub fn github_rate_limiter() -> TokenBucket {
    // 5000 per hour ≈ 1.389 per second
    TokenBucket::new(5000, 5000.0 / 3600.0)
}

/// GitLab API: ~600 requests/minute for authenticated users.
pub fn gitlab_rate_limiter() -> TokenBucket {
    // 600 per minute = 10 per second
    TokenBucket::new(600, 10.0)
}

/// Gitea/Codeberg API: conservative 300 requests/minute.
pub fn gitea_rate_limiter() -> TokenBucket {
    // 300 per minute = 5 per second
    TokenBucket::new(300, 5.0)
}
