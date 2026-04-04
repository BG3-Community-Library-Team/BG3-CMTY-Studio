use serde::Serialize;
#[cfg(test)]
use ts_rs::TS;

use crate::pak::PakError;

/// Classifies the kind of error for programmatic frontend handling.
#[derive(Debug, Clone, Serialize)]
#[cfg_attr(test, derive(TS))]
#[cfg_attr(test, ts(export))]
pub enum ErrorKind {
    NotFound,
    InvalidInput,
    IoError,
    ParseError,
    CacheError,
    SecurityViolation,
    TaskPanicked,
    Timeout,
    Internal,
}

/// Structured, serializable error type for IPC commands.
///
/// Frontend receives `{ kind: "NotFound", message: "..." }` and can
/// distinguish error categories programmatically instead of parsing strings.
#[derive(Debug, Clone, Serialize)]
#[cfg_attr(test, derive(TS))]
#[cfg_attr(test, ts(export))]
pub struct AppError {
    pub kind: ErrorKind,
    pub message: String,
}

impl AppError {
    pub fn not_found(message: impl Into<String>) -> Self {
        Self { kind: ErrorKind::NotFound, message: message.into() }
    }

    pub fn invalid_input(message: impl Into<String>) -> Self {
        Self { kind: ErrorKind::InvalidInput, message: message.into() }
    }

    pub fn io_error(message: impl Into<String>) -> Self {
        Self { kind: ErrorKind::IoError, message: message.into() }
    }

    pub fn parse_error(message: impl Into<String>) -> Self {
        Self { kind: ErrorKind::ParseError, message: message.into() }
    }

    pub fn cache_error(message: impl Into<String>) -> Self {
        Self { kind: ErrorKind::CacheError, message: message.into() }
    }

    pub fn security(message: impl Into<String>) -> Self {
        Self { kind: ErrorKind::SecurityViolation, message: message.into() }
    }

    pub fn task_panicked(message: impl Into<String>) -> Self {
        Self { kind: ErrorKind::TaskPanicked, message: message.into() }
    }

    pub fn timeout(message: impl Into<String>) -> Self {
        Self { kind: ErrorKind::Timeout, message: message.into() }
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self { kind: ErrorKind::Internal, message: message.into() }
    }
}

/// Enables `?` operator on `Result<T, String>` inside functions returning `Result<T, AppError>`.
impl From<String> for AppError {
    fn from(message: String) -> Self {
        Self { kind: ErrorKind::Internal, message }
    }
}

impl From<&str> for AppError {
    fn from(message: &str) -> Self {
        Self { kind: ErrorKind::Internal, message: message.to_string() }
    }
}

impl From<PakError> for AppError {
    fn from(error: PakError) -> Self {
        match error {
            PakError::Io(err) => Self::io_error(err.to_string()),
            PakError::InvalidPath(message) => Self::invalid_input(message),
            PakError::InvalidFormat(message) => Self::parse_error(message),
            PakError::UnsupportedVersion(version) => {
                Self::parse_error(format!("Unsupported pak version: {}", version))
            }
            PakError::BoundsViolation {
                start,
                len,
                source_len,
            } => Self::parse_error(format!(
                "Pak read exceeds bounds (start={}, len={}, source_len={})",
                start, len, source_len
            )),
            PakError::SizeLimitExceeded {
                context,
                size,
                limit,
            } => Self::parse_error(format!(
                "Pak size limit exceeded for {} (size={}, limit={})",
                context, size, limit
            )),
            PakError::NotFound(message) => Self::not_found(message),
            PakError::DeletedEntry(path) => {
                Self::invalid_input(format!("Pak entry is marked deleted: {}", path))
            }
            PakError::Decompression(message) => Self::parse_error(message),
            PakError::NotImplemented(message) => Self::internal(format!(
                "Pak feature not implemented: {}",
                message
            )),
        }
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for AppError {}
