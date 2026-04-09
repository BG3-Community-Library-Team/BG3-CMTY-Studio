import { invoke } from "@tauri-apps/api/core";

/** Ensure `.cmtystudio/` directory exists within a project. */
export async function ensureCmtystudioDir(projectPath: string): Promise<void> {
  await invoke("cmd_ensure_cmtystudio_dir", { projectPath });
}

/** Read a JSON file from `.cmtystudio/`. Returns `"{}"` if the file doesn't exist. */
export async function readProjectFile(projectPath: string, filename: string): Promise<string> {
  return invoke<string>("cmd_read_project_file", { projectPath, filename });
}

/** Write a JSON file to `.cmtystudio/` (atomic write). */
export async function writeProjectFile(
  projectPath: string,
  filename: string,
  content: string,
): Promise<void> {
  await invoke("cmd_write_project_file", { projectPath, filename, content });
}
