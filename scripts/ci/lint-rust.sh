#!/usr/bin/env bash
set -euo pipefail

cd src-tauri && cargo clippy -- -D warnings
