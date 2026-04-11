/** Which platform an upload targets. */
export type PlatformType = "Nexus" | "Modio";

/** Current stage of the upload pipeline. */
export type UploadStage =
  | "Packaging"
  | "Hashing"
  | "Uploading"
  | "Finalizing"
  | "Processing"
  | "Publishing"
  | "Complete"
  | "Error";

/** Progress payload emitted by the Rust backend during an upload. */
export interface UploadProgress {
  platform: PlatformType;
  stage: UploadStage;
  percent: number;
  bytes_sent: number;
  bytes_total: number;
  message: string;
}
