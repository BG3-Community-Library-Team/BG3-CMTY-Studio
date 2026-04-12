fn main() {
    // Expose APP_VERSION and APP_NAME from the frontend version.ts so Rust code
    // can include them in HTTP headers (Nexus Mods "Application-Name" /
    // "Application-Version") without duplicating the values.
    let version_ts = std::fs::read_to_string("../src/lib/version.ts")
        .expect("build.rs: failed to read ../src/lib/version.ts");

    if let Some(v) = extract_ts_string(&version_ts, "APP_VERSION") {
        println!("cargo:rustc-env=FRONTEND_APP_VERSION={v}");
    }
    if let Some(v) = extract_ts_string(&version_ts, "APP_NAME") {
        println!("cargo:rustc-env=FRONTEND_APP_NAME={v}");
    }
    println!("cargo:rerun-if-changed=../src/lib/version.ts");

    tauri_build::build()
}

/// Extract the value of `export const KEY = "VALUE";` from TypeScript source.
fn extract_ts_string(source: &str, key: &str) -> Option<String> {
    for line in source.lines() {
        let trimmed = line.trim();
        if !trimmed.contains(&format!("const {key}")) {
            continue;
        }
        // Find the first quoted string on the line.
        let start = trimmed.find('"')? + 1;
        let end = start + trimmed[start..].find('"')?;
        return Some(trimmed[start..end].to_string());
    }
    None
}
