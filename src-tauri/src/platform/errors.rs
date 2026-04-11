use serde::Serialize;

use crate::error::{AppError, ErrorKind};

/// Unified error type for all platform connectivity operations
/// (Nexus Mods, mod.io, shared infrastructure).
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type")]
pub enum PlatformError {
    KeyringError(String),
    HttpError(String),
    ApiError { status: u16, message: String },
    RateLimited { retry_after_secs: u64 },
    Timeout,
    ValidationError(String),
    PackagingError(String),
    IoError(String),
    UploadTimeout,
}

impl std::fmt::Display for PlatformError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::KeyringError(msg) => write!(f, "Keyring error: {msg}"),
            Self::HttpError(msg) => write!(f, "HTTP error: {msg}"),
            Self::ApiError { status, message } => {
                write!(f, "API error (HTTP {status}): {message}")
            }
            Self::RateLimited { retry_after_secs } => {
                write!(f, "Rate limited — retry after {retry_after_secs}s")
            }
            Self::Timeout => write!(f, "Request timed out"),
            Self::ValidationError(msg) => write!(f, "Validation error: {msg}"),
            Self::PackagingError(msg) => write!(f, "Packaging error: {msg}"),
            Self::IoError(msg) => write!(f, "I/O error: {msg}"),
            Self::UploadTimeout => write!(f, "Upload timed out"),
        }
    }
}

impl std::error::Error for PlatformError {}

impl From<PlatformError> for AppError {
    fn from(err: PlatformError) -> Self {
        match &err {
            PlatformError::KeyringError(msg) => AppError {
                kind: ErrorKind::Internal,
                message: format!("Keyring error: {msg}"),
                context: None,
            },
            PlatformError::HttpError(msg) => AppError {
                kind: ErrorKind::Internal,
                message: format!("HTTP error: {msg}"),
                context: None,
            },
            PlatformError::ApiError { status, message } => AppError {
                kind: ErrorKind::Internal,
                message: format!("API error (HTTP {status}): {message}"),
                context: None,
            },
            PlatformError::RateLimited { retry_after_secs } => AppError {
                kind: ErrorKind::Internal,
                message: format!("Rate limited — retry after {retry_after_secs}s"),
                context: None,
            },
            PlatformError::Timeout => AppError::timeout("Platform request timed out"),
            PlatformError::ValidationError(msg) => {
                AppError::invalid_input(format!("Platform validation: {msg}"))
            }
            PlatformError::PackagingError(msg) => AppError {
                kind: ErrorKind::Internal,
                message: format!("Packaging error: {msg}"),
                context: None,
            },
            PlatformError::IoError(msg) => AppError::io_error(msg.clone()),
            PlatformError::UploadTimeout => AppError::timeout("Upload timed out"),
        }
    }
}

impl From<std::io::Error> for PlatformError {
    fn from(err: std::io::Error) -> Self {
        Self::IoError(err.to_string())
    }
}
