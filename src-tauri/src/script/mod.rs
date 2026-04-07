//! Script and config file handlers.
//!
//! This module provides the generic [`ScanProvider`] trait and supporting types
//! for file type detection, scanning, and categorization. Concrete handler
//! implementations are added in Sprint 20 (SE Config, SE Lua) and Sprint 21
//! (Osiris, Khonsu).

pub mod scan;

pub use scan::{ScanProvider, ScanResult};
