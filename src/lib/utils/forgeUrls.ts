import type { ForgeInfo } from "../tauri/git.js";

export function forgeFileUrl(info: ForgeInfo, branch: string, path: string): string | null {
  if (!info.owner || !info.repo) return null;
  switch (info.forgeType) {
    case "GitHub":
      return `https://${info.host}/${info.owner}/${info.repo}/blob/${encodeURIComponent(branch)}/${path}`;
    case "GitLab":
      return `https://${info.host}/${info.owner}/${info.repo}/-/blob/${encodeURIComponent(branch)}/${path}`;
    case "Gitea":
      return `https://${info.host}/${info.owner}/${info.repo}/src/branch/${encodeURIComponent(branch)}/${path}`;
    default:
      return null;
  }
}

export function forgeCommitUrl(info: ForgeInfo, sha: string): string | null {
  if (!info.owner || !info.repo) return null;
  switch (info.forgeType) {
    case "GitHub":
      return `https://${info.host}/${info.owner}/${info.repo}/commit/${sha}`;
    case "GitLab":
      return `https://${info.host}/${info.owner}/${info.repo}/-/commit/${sha}`;
    case "Gitea":
      return `https://${info.host}/${info.owner}/${info.repo}/commit/${sha}`;
    default:
      return null;
  }
}
