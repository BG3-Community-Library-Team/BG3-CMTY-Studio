#!/usr/bin/env node
// Regenerate TypeScript bindings for Rust types (ts-rs) into src/lib/types/generated.
// Cross-platform replacement for setting TS_RS_EXPORT_DIR inline in an npm script.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const result = spawnSync("cargo", ["test", "export_bindings"], {
  cwd: path.join(root, "src-tauri"),
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, TS_RS_EXPORT_DIR: path.join(root, "src", "lib", "types", "generated") },
});

process.exit(result.status ?? 1);
