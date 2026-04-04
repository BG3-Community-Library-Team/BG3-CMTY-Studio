# BG3 CMTY Studio

A desktop application for creating and editing Baldur's Gate 3 mods. Built with **Tauri 2** (Rust backend) and **Svelte 5** (TypeScript frontend).

The app itself is a cross-platform, form-driven, unofficial toolkit. CMTY Studio reads from BG3's `.pak` files to build reference databases, allowing for form validation, autocomplete, and reference, all without unpacking your files. It also builds DBs for the same features for other mods, making it easy to set up dependencies.

> Note: The Reference DB for basic vanilla files at this time results in a ~1GB Database. The Reference DB for mods and the Staging DB for the mod being worked on will vary in size based on the amount of reference mods (for `ref_mods`,) and the amount of entries (for both `ref_mods` and `staging`).

## User Prerequisites & Setup
- A legitimate copy of Baldur's Gate 3

Just open the application, and you're in business!

## Developer Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [Rust](https://www.rust-lang.org/tools/install) (stable, 1.71+)
- [Tauri CLI](https://v2.tauri.app/start/prerequisites/) prerequisites (WebView2 on Windows)
- Baldur's Gate 3 installed (for game data extraction and integration tests)

## Developer Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the example environment file and fill in your local paths:

```bash
cp .env.example .env
```

Edit `.env`:

```dotenv
# Path to the BG3 Data directory containing .pak files
BG3_GAME_DATA='C:\SteamLibrary\steamapps\common\Baldurs Gate 3\Data'

# Optional: skip honor DB population in pipeline tests (faster)
# BG3_PIPELINE_NO_HONOR=1
```

The `.env` file is gitignored and must never be committed.

### 3. Generate schema databases

Before running the app, you need pre-built schema databases in `src-tauri/resources/`:

```bash
npm run build:schema  
```

This reads game `.pak` files (using `BG3_GAME_DATA`), discovers all table schemas, and writes empty SQLite databases with DDL applied to `src-tauri/resources/`.

## Development

```bash
# Start the Tauri dev server (frontend + backend hot reload)
npm run tauri:dev

# Frontend only (Vite dev server, no Rust backend)
npm run dev
```

## Building

```bash
npm run tauri:build
```

The output binary is in `src-tauri/target/release/`.

## Testing

### Full suite

```bash
npm run test:suite    # vitest run + vite build + cargo test (src-tauri)
```

### Frontend tests (Vitest)

```bash
npm test              # Run all frontend tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

Frontend tests are in `src/__tests__/` and cover stores, form logic, validation, serialization round-trips, and accessibility.

### Backend tests (Cargo)

```bash
cd src-tauri

# Unit tests (no game data required)
cargo test

# Integration tests (requires BG3_GAME_DATA in .env)
cargo test --test test_reference_db
cargo test --test test_effect_parity
cargo test --test test_diagnose
```

### DB Schema Generation & Population

The reference database pipeline has dedicated scripts and test coverage:

```bash
npm run test:schema   # Test: create all empty schema DBs (requires BG3_GAME_DATA)
npm run test:db       # Test: populate schema DBs with game data (requires test_schema_dbs/)
```

Test artifacts are written to `test_schema_dbs/` and `test_populated_dbs/`.

## Important Directories

```
src/                     Frontend (Svelte 5 + TypeScript)
├── components/          Svelte components
├── lib/                 Stores, utilities, data helpers, type definitions
└── __tests__/           Vitest frontend tests

src-tauri/               Rust backend (Tauri 2)
├── src/
│   ├── commands/        Tauri IPC command handlers
│   ├── reference_db/    DB schema discovery & population pipeline
│   ├── parsers/         BG3 file format parsers (LSF, LSX, stats, loca)
│   ├── pak/             .pak archive reader
│   ├── schema/          Schema types and discovery
│   ├── serializers/     Output format writers
│   ├── converters/      Data conversion utilities
│   └── bin/             Dev tool binaries (generate_schema)
├── resources/           Pre-built schema .sqlite files (bundled with app)
├── tests/               Rust integration tests
└── bindings/            Generated TypeScript type bindings

UnpackedData/            Extracted game data (gitignored)
test_schema_dbs/         Schema test output (gitignored)
test_populated_dbs/      Population test output (gitignored)
```

## Runtime Data Locations

The application stores runtime data under a single unified directory (`CMTYStudio/`) within the OS data directory:

| OS | Base path |
|----|-----------|
| Windows | `%APPDATA%\CMTYStudio\` |
| macOS | `~/Library/Application Support/CMTYStudio/` |
| Linux | `$XDG_DATA_HOME/CMTYStudio/` (defaults to `~/.local/share/CMTYStudio/`) |

Subdirectories within `CMTYStudio/`:

| Purpose | Path |
|---------|------|
| Logs | `logs/` |
| Databases | `databases/` |

Secure storage (service name: `cmtystudio`) uses the OS credential manager — Windows Credential Manager, macOS Keychain, or Linux Secret Service.

## License

[MIT](LICENSE)
