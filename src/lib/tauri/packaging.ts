import { invoke } from "@tauri-apps/api/core";

export interface PackageModOptions {
  modPath: string;
  outputPath: string;
  priority?: number;
  compression?: "none" | "zlib" | "lz4";
  compressionLevel?: "fast" | "default" | "max";
}

export interface PakWriteResult {
  output_path: string;
  file_count: number;
  total_bytes: number;
}

export async function packageMod(options: PackageModOptions): Promise<PakWriteResult> {
  return invoke("cmd_package_mod", { options });
}
