//! Osiris goal-file export handler — **stub**.
//!
//! The real implementation ships in Sprint 21 (Phase 2.4).
//! For now every method is a no-op so the handler compiles and
//! can be registered in `default_handlers()` without affecting export.

use crate::error::AppError;
use super::{ExportContext, ExportUnit, FileTypeHandler};

pub struct OsirisHandler;

impl FileTypeHandler for OsirisHandler {
    fn name(&self) -> &str {
        "OsirisHandler"
    }

    fn claimed_table_prefixes(&self) -> Vec<&str> {
        vec![]
    }

    fn claimed_meta_keys(&self) -> Vec<&str> {
        vec!["osiris_goal_entries", "osiris_goal_file_uuid"]
    }

    fn plan(&self, _ctx: &ExportContext) -> Result<Vec<ExportUnit>, AppError> {
        // Stub: no export units generated
        Ok(vec![])
    }

    fn render(&self, _unit: &ExportUnit, _ctx: &ExportContext) -> Result<Vec<u8>, AppError> {
        // Stub: should never be called since plan() returns empty vec
        Ok(vec![])
    }
}
