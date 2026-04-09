export interface DetectedMod {
  mod_path: string;
  mod_name: string;
  mod_uuid: string;
  mod_folder: string;
  author: string;
  has_git: boolean;
}

export interface DetectResult {
  project_path: string;
  mods: DetectedMod[];
}
