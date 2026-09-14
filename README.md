# BG3 CMTY Studio

[![CI](https://github.com/BG3-Community-Library-Team/BG3-CMTY-Studio/actions/workflows/ci.yml/badge.svg)](https://github.com/BG3-Community-Library-Team/BG3-CMTY-Studio/actions/workflows/ci.yml)

> Note: This application is built using AI-assisted development practices - this has been a mixture of hand-crafted code and spec-driven agentic workflows. While LLMs are utilized as a tool for building this application, they are not integrated into the application.

A desktop application for creating and editing Baldur's Gate 3 mods. Built with **Tauri 2** (Rust backend) and **Svelte 5** (TypeScript frontend).

The app itself is a cross-platform, form-driven, unofficial toolkit. CMTY Studio reads from BG3's `.pak` files to build reference databases, allowing for form validation, autocomplete, and reference, all without unpacking your files. It also builds DBs for the same features for other mods, making it easy to set up dependencies.

> Note: The Reference DB for basic vanilla files at this time results in a ~1GB Database. The Reference DB for mods and the Staging DB for the mod being worked on will vary in size based on the amount of reference mods (for `ref_mods`,) and the amount of entries (for both `ref_mods` and `staging`).

## User Prerequisites & Setup
- A legitimate copy of Baldur's Gate 3

Just open the application, and you're in business!

## Developer Prerequisites

- [Node.js](https://nodejs.org/) v24+ (see `.nvmrc`)
- [Rust](https://www.rust-lang.org/tools/install) via rustup (the toolchain pinned in `rust-toolchain.toml` is installed automatically)
- [Tauri CLI](https://v2.tauri.app/start/prerequisites/) prerequisites (WebView2 on Windows, WebKitGTK on Linux)
- Baldur's Gate 3 installed (for game data extraction and integration tests)

### Linux

Install the Tauri system dependencies. On Arch-based distros:

```bash
sudo pacman -S --needed base-devel webkit2gtk-4.1 libappindicator-gtk3 librsvg openssl dbus
```

On Debian/Ubuntu:

```bash
sudo apt install build-essential libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev libdbus-1-dev patchelf
```

Saving Nexus Mods, mod.io and Git forge credentials needs a running Secret Service provider: GNOME Keyring, KWallet (Plasma 6, or Plasma 5 with *Use KWallet for the Secret Service interface* enabled) or KeePassXC with *Secret Service Integration* enabled. The rest of the app works without one.

On Linux, `BG3_GAME_DATA` is typically `~/.local/share/Steam/steamapps/common/Baldurs Gate 3/Data`.

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

### Release packages

Release packages are written to `release/<target>/`:

| Command | Output | Builds on |
|---------|--------|-----------|
| `npm run release` | the targets for the current OS | — |
| `npm run release:win64` | `release/win64/` — portable `bg3-cmty-studio.exe` + `resources/` | Windows, or Linux/macOS with `cargo-xwin` and the `x86_64-pc-windows-msvc` target |
| `npm run release:macOS` | `release/macOS/` (DMG) | macOS |
| `npm run release:flatpak` | `release/flatpak/bg3-cmty-studio.flatpak` | Linux with `flatpak-builder` (or `flatpak install --user flathub org.flatpak.Builder`) |
| `npm run release:deb` | `release/deb/bg3-cmty-studio_<version>_amd64.deb` | Linux |
| `npm run release:arch` | `release/arch/bg3-cmty-studio-<version>-1-x86_64.pkg.tar.zst` | Arch-based Linux (`makepkg`) |
| `npm run release:all` | every target the current machine can build; the rest are skipped | — |

The **Release** GitHub workflow (`.github/workflows/release.yml`) builds every target on native runners when a `v*` tag is pushed or when run manually. Use its packages for distribution: the Linux packages are built from a `.deb` compiled on Ubuntu 22.04, so they run on older distros too. A `.deb` built locally on a newer distro requires that distro's glibc version or newer.

### Installing a release

| Platform | Install | Run |
|----------|---------|-----|
| Windows | No installation: extract the `win64` folder anywhere (keep `resources/` next to the exe). Needs the WebView2 runtime, which Windows 11 and current Windows 10 include. | `bg3-cmty-studio.exe` |
| macOS | Open the DMG and drag the app to Applications | Launchpad or Applications |
| Debian / Ubuntu / Mint | `sudo apt install ./bg3-cmty-studio_<version>_amd64.deb` (dependencies are installed automatically) | App menu: **BG3 CMTY Studio** |
| Arch / CachyOS / Manjaro | `sudo pacman -U bg3-cmty-studio-<version>-1-x86_64.pkg.tar.zst` (dependencies are installed automatically) | App menu: **BG3 CMTY Studio** |
| Any distro with Flatpak (SteamOS, Fedora, …) | `flatpak install --user bg3-cmty-studio.flatpak` — the GNOME runtime is downloaded from Flathub automatically | App menu, or `flatpak run com.cmtystudio.editor` |

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

## Bundle Analysis

The project includes `rollup-plugin-visualizer` for analyzing the frontend bundle.

```bash
# Generate an interactive treemap of the bundle
ANALYZE=true npm run build
```

This produces a `stats.html` file in the project root. Open it in a browser to see an interactive treemap visualization of all bundled modules and their sizes.

**When to use it:**
- Before and after adding new frontend dependencies
- When investigating frontend bundle size increases
- During periodic dependency audits

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
│   └── converters/      Data conversion utilities
├── examples/            Dev tools, not shipped (generate_schema: `npm run build:schema`)
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

API keys and tokens (service name: `bg3-cmty-studio`) are kept in the OS credential manager — Windows Credential Manager, macOS Keychain, or a Secret Service provider on Linux (GNOME Keyring, KWallet, KeePassXC, …). Path settings are stored with the other settings, not in the credential manager.

### BG3 user data folder

**Import Load Order** reads `Mods/` and `PlayerProfiles/` from the BG3 user data folder, which is detected automatically:

| Install | Path |
|---------|------|
| Windows | `%LOCALAPPDATA%\Larian Studios\Baldur's Gate 3\` |
| Linux, Steam with Proton | `<Steam library>/steamapps/compatdata/1086940/pfx/drive_c/users/steamuser/AppData/Local/Larian Studios/Baldur's Gate 3/` |
| Linux, native build | `$XDG_DATA_HOME/Larian Studios/Baldur's Gate 3/` (defaults to `~/.local/share/...`) |
| Linux, other Wine setups | `<prefix>/drive_c/users/<user>/AppData/Local/Larian Studios/Baldur's Gate 3/`, derived from the installation folder |

Steam detection covers native, Flatpak and Snap Steam. When several folders exist, the one with the most recently saved `modsettings.lsx` is used. To use a different folder, set **Loaded Data → User Data Folder**.

## License

[MIT](LICENSE)
