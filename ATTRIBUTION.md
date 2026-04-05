# Third-Party Attribution

BG3 CMTY Studio is built on open-source software. This document attributes all
third-party dependencies used in the application.

Full license texts for dependency licenses are included in the
[LICENSES/](LICENSES/) directory. The project itself is licensed under the
[MIT License](LICENSE).

## Rust Dependencies (Backend)

All Rust dependencies are sourced from [crates.io](https://crates.io) and
licensed under permissive terms.

| Crate | License | Purpose |
|-------|---------|---------|
| [tauri](https://crates.io/crates/tauri) | MIT / Apache-2.0 | Desktop application framework |
| [tauri-plugin-dialog](https://crates.io/crates/tauri-plugin-dialog) | MIT / Apache-2.0 | Native file dialogs |
| [tauri-plugin-shell](https://crates.io/crates/tauri-plugin-shell) | MIT / Apache-2.0 | Shell command execution |
| [tokio](https://crates.io/crates/tokio) | MIT | Async runtime |
| [serde](https://crates.io/crates/serde) | MIT / Apache-2.0 | Serialization framework |
| [serde_json](https://crates.io/crates/serde_json) | MIT / Apache-2.0 | JSON serialization |
| [serde-saphyr](https://crates.io/crates/serde-saphyr) | MIT / Apache-2.0 | YAML serialization |
| [rmp-serde](https://crates.io/crates/rmp-serde) | MIT | MessagePack serialization |
| [quick-xml](https://crates.io/crates/quick-xml) | MIT | XML parsing / generation |
| [rusqlite](https://crates.io/crates/rusqlite) | MIT | SQLite database engine |
| [regex](https://crates.io/crates/regex) | MIT / Apache-2.0 | Regular expressions |
| [flate2](https://crates.io/crates/flate2) | MIT / Apache-2.0 | DEFLATE compression (PAK files) |
| [lz4_flex](https://crates.io/crates/lz4_flex) | MIT | LZ4 compression |
| [walkdir](https://crates.io/crates/walkdir) | MIT / Unlicense | Recursive directory walking |
| [rayon](https://crates.io/crates/rayon) | MIT / Apache-2.0 | Data parallelism |
| [crossbeam-channel](https://crates.io/crates/crossbeam-channel) | MIT / Apache-2.0 | Multi-producer multi-consumer channels |
| [dirs](https://crates.io/crates/dirs) | MIT / Apache-2.0 | Platform-specific directories |
| [chrono](https://crates.io/crates/chrono) | MIT / Apache-2.0 | Date/time handling |
| [uuid](https://crates.io/crates/uuid) | MIT / Apache-2.0 | UUID generation (v4) |
| [tracing](https://crates.io/crates/tracing) | MIT | Application-level tracing |
| [tracing-subscriber](https://crates.io/crates/tracing-subscriber) | MIT | Tracing event subscribers |
| [tracing-appender](https://crates.io/crates/tracing-appender) | MIT | Non-blocking log file appending |
| [keyring](https://crates.io/crates/keyring) | MIT / Apache-2.0 | OS keychain integration |
| [winreg](https://crates.io/crates/winreg) | MIT | Windows registry access |

## JavaScript/TypeScript Dependencies (Frontend)

### Runtime (bundled into the application)

| Package | License | Purpose |
|---------|---------|---------|
| [svelte](https://www.npmjs.com/package/svelte) | MIT | UI component framework |
| [tailwindcss](https://www.npmjs.com/package/tailwindcss) | MIT | Utility-first CSS framework |
| [@lucide/svelte](https://www.npmjs.com/package/@lucide/svelte) | ISC | Icon library |
| [@tauri-apps/api](https://www.npmjs.com/package/@tauri-apps/api) | MIT / Apache-2.0 | Tauri JavaScript API |
| [@tauri-apps/plugin-dialog](https://www.npmjs.com/package/@tauri-apps/plugin-dialog) | MIT / Apache-2.0 | Dialog plugin JS bindings |
| [@tauri-apps/plugin-shell](https://www.npmjs.com/package/@tauri-apps/plugin-shell) | MIT / Apache-2.0 | Shell plugin JS bindings |

### Build & Development Tools

| Package | License | Purpose |
|---------|---------|---------|
| [vite](https://www.npmjs.com/package/vite) | MIT | Build tool and dev server |
| [@sveltejs/vite-plugin-svelte](https://www.npmjs.com/package/@sveltejs/vite-plugin-svelte) | MIT | Svelte Vite integration |
| [@tailwindcss/vite](https://www.npmjs.com/package/@tailwindcss/vite) | MIT | Tailwind CSS Vite plugin |
| [@tauri-apps/cli](https://www.npmjs.com/package/@tauri-apps/cli) | MIT / Apache-2.0 | Tauri build toolchain |
| [typescript](https://www.npmjs.com/package/typescript) | Apache-2.0 | TypeScript compiler |
| [vitest](https://www.npmjs.com/package/vitest) | MIT | Test framework |
| [@vitest/coverage-v8](https://www.npmjs.com/package/@vitest/coverage-v8) | MIT | Test coverage provider |
| [fast-check](https://www.npmjs.com/package/fast-check) | MIT | Property-based testing |
| [yaml](https://www.npmjs.com/package/yaml) | ISC | YAML parsing (test fixtures) |
| [rollup-plugin-visualizer](https://www.npmjs.com/package/rollup-plugin-visualizer) | MIT | Bundle analysis |

## License Summary

All dependencies use one or more of the following permissive licenses:

- **MIT** — Most common; allows free use, modification, and distribution
- **MIT-0** — MIT variant with no attribution requirement
- **Apache-2.0** — Permits use with patent protection clause
- **ISC** — Simplified BSD-like license
- **0BSD** — Zero-clause BSD; no conditions at all
- **BSD-2-Clause / BSD-3-Clause** — Permissive with attribution requirement
- **MPL-2.0** — File-level copyleft (only applies to modified files of the dependency)
- **Unlicense** — Public domain dedication
- **CC0-1.0** — Public domain dedication
- **Unicode-3.0** — Unicode consortium license for ICU data
- **Zlib** — Permissive; no endorsement requirement

No copyleft (GPL/AGPL/LGPL) dependencies are used. Dependency license compliance
is enforced by `cargo deny` (see [src-tauri/deny.toml](src-tauri/deny.toml)).

---

*Last updated for BG3 CMTY Studio v1.0.0. Run `cd src-tauri && cargo deny list`
to audit Rust dependency licenses.*
