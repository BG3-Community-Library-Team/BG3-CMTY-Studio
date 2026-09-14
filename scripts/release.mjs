#!/usr/bin/env node
// Build release packages into release/<target>.
//
//   npm run release              targets for the current OS
//   npm run release:<target>     one target: win64, macOS, flatpak, deb, arch
//   npm run release:all          every target this machine can build
//
// win64 is a portable build (exe + resources, no installer); it builds natively on
// Windows, or on Linux/macOS with cargo-xwin. macOS packages can only be built on macOS.
// The Linux targets share one Tauri .deb: flatpak and arch repackage it. Set CMTY_DEB to
// reuse a prebuilt .deb (the Release workflow builds it on an old Ubuntu for glibc
// compatibility). Targets that can't be built here are skipped with the reason.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TAURI_DIR = path.join(ROOT, "src-tauri");
const RELEASE_DIR = path.join(ROOT, "release");
const VERSION = JSON.parse(fs.readFileSync(path.join(TAURI_DIR, "tauri.conf.json"), "utf8")).version;
const IS_WINDOWS = process.platform === "win32";
const WIN_TRIPLE = "x86_64-pc-windows-msvc";
const FLATHUB_REPO = "https://dl.flathub.org/repo/flathub.flatpakrepo";
const FLATPAK_APP_ID = "com.cmtystudio.editor";
const FLATPAK_MANIFEST = path.join(ROOT, "packaging", "flatpak", `${FLATPAK_APP_ID}.yml`);
// The Flatpak manifest reads the .deb from here (its path is relative to the manifest).
const FLATPAK_DEB = path.join(TAURI_DIR, "target", "flatpak", "bg3-cmty-studio.deb");
// flatpak-builder and makepkg need free space on a Linux filesystem (OSTree repo, real
// file permissions), so their work folders live in the user cache, not the project.
const CACHE_DIR = path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache"), "bg3-cmty-studio");

function run(command, args, { cwd = ROOT, env = {} } = {}) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: IS_WINDOWS,
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    throw new Error(`${command} exited with ${result.status ?? result.signal}`);
  }
}

function hasCommand(command) {
  const probe = IS_WINDOWS ? ["where", [command]] : ["sh", ["-c", `command -v ${command}`]];
  return spawnSync(probe[0], probe[1], { stdio: "ignore" }).status === 0;
}

function hasRustTarget(triple) {
  const result = spawnSync("rustup", ["target", "list", "--installed"], { cwd: TAURI_DIR, encoding: "utf8" });
  return result.status === 0 && result.stdout.split(/\r?\n/).includes(triple);
}

/** `flatpak-builder` from the host, or the org.flatpak.Builder Flatpak app. */
function flatpakBuilder() {
  if (hasCommand("flatpak-builder")) return ["flatpak-builder", []];
  const app = spawnSync("flatpak", ["info", "org.flatpak.Builder"], { stdio: "ignore" });
  if (app.status === 0) return ["flatpak", ["run", "org.flatpak.Builder"]];
  return null;
}

/** Run `tauri build`, producing `bundles`, or only the binary when `bundles` is null. */
function tauriBuild(bundles, { triple, runner, env } = {}) {
  const args = ["tauri", "build", ...(bundles ? ["--bundles", bundles.join(",")] : ["--no-bundle"])];
  if (triple) args.push("--target", triple);
  if (runner) args.push("--runner", runner);
  run("npx", args, { env });
}

function bundleDir(triple) {
  return path.join(TAURI_DIR, "target", ...(triple ? [triple] : []), "release", "bundle");
}

/** Recreate release/<target> as an empty folder and return its path. */
function freshReleaseDir(target) {
  const dest = path.join(RELEASE_DIR, target);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  return dest;
}

/** Recreate a work folder under the user cache and return its path. */
function freshCacheDir(name) {
  const dir = path.join(CACHE_DIR, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Copy the files in `sourceDir` whose names end with one of `extensions` into `dest`. */
function collect(dest, sourceDir, extensions) {
  const files = fs.existsSync(sourceDir)
    ? fs.readdirSync(sourceDir).filter((name) => extensions.some((ext) => name.endsWith(ext)))
    : [];
  if (files.length === 0) throw new Error(`No ${extensions.join("/")} files found in ${sourceDir}`);
  for (const name of files) {
    fs.cpSync(path.join(sourceDir, name), path.join(dest, name));
    console.log(`  ${path.relative(ROOT, path.join(dest, name))}`);
  }
}

let debPath = null;

/** The Tauri .deb shared by the Linux targets: CMTY_DEB if set, otherwise built once. */
function ensureDeb() {
  if (debPath) return debPath;
  if (process.env.CMTY_DEB) {
    debPath = path.resolve(process.env.CMTY_DEB);
    if (!fs.existsSync(debPath)) throw new Error(`CMTY_DEB not found: ${debPath}`);
    return debPath;
  }
  tauriBuild(["deb"]);
  const debDir = path.join(bundleDir(), "deb");
  const deb = fs.readdirSync(debDir).find((name) => name.endsWith(`_${VERSION}_amd64.deb`));
  if (!deb) throw new Error(`No ${VERSION} .deb found in ${debDir}`);
  debPath = path.join(debDir, deb);
  return debPath;
}

function linuxOnly(format) {
  return process.platform === "linux" ? null : `${format} can only be built on Linux`;
}

const TARGETS = {
  win64: {
    unavailableReason() {
      if (IS_WINDOWS) return null;
      if (process.platform === "darwin" || process.platform === "linux") {
        const missing = [
          !hasCommand("cargo-xwin") && "cargo-xwin (cargo install cargo-xwin)",
          !hasRustTarget(WIN_TRIPLE) && `the ${WIN_TRIPLE} Rust target (rustup target add ${WIN_TRIPLE})`,
        ].filter(Boolean);
        return missing.length ? `cross-compiling needs ${missing.join(", ")}` : null;
      }
      return "unsupported host OS";
    },
    build() {
      // Portable build: the exe runs from its folder and loads resources/ next to it.
      const triple = IS_WINDOWS ? undefined : WIN_TRIPLE;
      tauriBuild(null, { triple, runner: IS_WINDOWS ? undefined : "cargo-xwin" });
      const out = path.join(TAURI_DIR, "target", ...(triple ? [triple] : []), "release");
      const dest = freshReleaseDir("win64");
      fs.copyFileSync(path.join(out, "bg3-cmty-studio.exe"), path.join(dest, "bg3-cmty-studio.exe"));
      fs.cpSync(path.join(out, "resources"), path.join(dest, "resources"), { recursive: true });
      console.log("  release/win64/bg3-cmty-studio.exe\n  release/win64/resources/");
    },
  },

  macOS: {
    unavailableReason() {
      return process.platform === "darwin" ? null : "macOS packages can only be built on macOS";
    },
    build() {
      tauriBuild(["app", "dmg"]);
      collect(freshReleaseDir("macOS"), path.join(bundleDir(), "dmg"), [".dmg"]);
    },
  },

  flatpak: {
    unavailableReason() {
      if (process.platform !== "linux") return linuxOnly("Flatpaks");
      if (!hasCommand("flatpak")) return "flatpak is not installed";
      if (!flatpakBuilder()) {
        return "flatpak-builder is not installed (distro package, or: flatpak install --user flathub org.flatpak.Builder)";
      }
      return null;
    },
    build() {
      fs.mkdirSync(path.dirname(FLATPAK_DEB), { recursive: true });
      fs.copyFileSync(ensureDeb(), FLATPAK_DEB);

      const [builder, builderArgs] = flatpakBuilder();
      const work = path.join(CACHE_DIR, "flatpak");
      const repo = path.join(work, "repo");
      fs.mkdirSync(work, { recursive: true });
      run("flatpak", ["remote-add", "--user", "--if-not-exists", "flathub", FLATHUB_REPO]);
      run(builder, [
        ...builderArgs,
        "--user",
        "--install-deps-from=flathub",
        "--force-clean",
        `--state-dir=${path.join(work, "state")}`,
        `--repo=${repo}`,
        path.join(work, "build-dir"),
        FLATPAK_MANIFEST,
      ]);

      // --runtime-repo lets `flatpak install` fetch the GNOME runtime from Flathub automatically.
      const bundle = path.join(freshReleaseDir("flatpak"), "bg3-cmty-studio.flatpak");
      run("flatpak", ["build-bundle", `--runtime-repo=${FLATHUB_REPO}`, repo, bundle, FLATPAK_APP_ID]);
      console.log(`  ${path.relative(ROOT, bundle)}`);
    },
  },

  deb: {
    unavailableReason() {
      return linuxOnly("Debian packages");
    },
    build() {
      const deb = ensureDeb();
      const dest = freshReleaseDir("deb");
      const name = `bg3-cmty-studio_${VERSION}_amd64.deb`;
      fs.copyFileSync(deb, path.join(dest, name));
      console.log(`  release/deb/${name}`);
      if (!process.env.CMTY_DEB && !fs.existsSync("/etc/debian_version")) {
        console.warn(
          "  Note: this .deb requires this system's glibc version or newer. Packages for distribution " +
            "should come from the Release workflow, which builds on Ubuntu 22.04.",
        );
      }
    },
  },

  arch: {
    unavailableReason() {
      if (process.platform !== "linux") return linuxOnly("Arch packages");
      if (!hasCommand("makepkg")) return "makepkg is not available (build on Arch, or use the Release workflow)";
      if (process.getuid?.() === 0) return "makepkg refuses to run as root";
      return null;
    },
    build() {
      const work = freshCacheDir("arch");
      fs.copyFileSync(ensureDeb(), path.join(work, "bg3-cmty-studio.deb"));
      fs.copyFileSync(path.join(ROOT, "LICENSE"), path.join(work, "LICENSE"));
      const template = fs.readFileSync(path.join(ROOT, "packaging", "arch", "PKGBUILD.in"), "utf8");
      fs.writeFileSync(path.join(work, "PKGBUILD"), template.replaceAll("@VERSION@", VERSION));

      // --nodeps: runtime dependencies are only needed where the package is installed.
      run("makepkg", ["--force", "--nodeps", "--cleanbuild"], {
        cwd: work,
        env: { PKGDEST: work, SRCDEST: work, BUILDDIR: path.join(work, "build"), PKGEXT: ".pkg.tar.zst" },
      });
      collect(freshReleaseDir("arch"), work, [".pkg.tar.zst"]);
    },
  },
};

const HOST_TARGETS = {
  win32: ["win64"],
  darwin: ["macOS"],
  linux: ["flatpak", "deb", "arch"],
};

function main() {
  const requested = process.argv.slice(2);
  const all = Object.keys(TARGETS);
  let targets;
  if (requested.length === 0) {
    targets = HOST_TARGETS[process.platform];
    if (!targets) throw new Error(`No release targets for ${process.platform}`);
  } else if (requested.includes("all")) {
    targets = all;
  } else {
    const unknown = requested.filter((t) => !TARGETS[t]);
    if (unknown.length) throw new Error(`Unknown target(s): ${unknown.join(", ")}. Expected: ${all.join(", ")}, all`);
    targets = requested;
  }

  const explicit = requested.length > 0 && !requested.includes("all");
  const built = [];
  const skipped = [];
  for (const name of targets) {
    const reason = TARGETS[name].unavailableReason();
    if (reason) {
      if (explicit) throw new Error(`Can't build ${name} here: ${reason}`);
      skipped.push(`${name}: ${reason}`);
      continue;
    }
    console.log(`\n=== Building ${name} ===`);
    TARGETS[name].build();
    built.push(name);
  }

  console.log(`\nBuilt: ${built.join(", ") || "nothing"}`);
  if (skipped.length) {
    console.log(`Skipped (built by the Release workflow instead):\n  ${skipped.join("\n  ")}`);
  }
}

try {
  main();
} catch (e) {
  console.error(`\nRelease build failed: ${e.message}`);
  process.exit(1);
}
