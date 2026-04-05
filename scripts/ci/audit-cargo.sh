#!/usr/bin/env bash
set -euo pipefail

cargo install cargo-deny --locked
cd src-tauri && cargo deny check
