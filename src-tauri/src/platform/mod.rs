//! Platform connectivity infrastructure (Nexus Mods, mod.io).
//!
//! Provides shared utilities for credential management, HTTP requests,
//! rate limiting, progress reporting, input validation, and ZIP packaging.

pub mod credentials;
pub mod errors;
pub mod http;
pub mod modio;
pub mod nexus;
pub mod packaging;
pub mod progress;
pub mod rate_limiter;
pub mod validation;
