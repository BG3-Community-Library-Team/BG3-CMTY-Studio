#!/usr/bin/env bash
set -euo pipefail

cd src-tauri && cargo clippy -- -D warnings -A clippy::uninlined_format_args
