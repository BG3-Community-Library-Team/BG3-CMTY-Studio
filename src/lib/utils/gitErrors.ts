/**
 * Maps raw backend git/forge error strings to user-friendly messages.
 *
 * The Rust backend produces errors in these formats:
 * - git2: "Failed to fetch from 'origin': ..." / "Failed to push to 'origin': ..."
 * - forge HTTP: "Authentication failed — invalid or expired token"
 *              / "Access denied — insufficient token permissions"
 *              / "Rate limit exceeded — try again later"
 *              / "Network error: ..."
 * - checkout: "Cannot switch branches: you have uncommitted changes..."
 * - push callback: "Push rejected: ..."
 */
export function friendlyGitError(raw: string): string {
  const lower = raw.toLowerCase();

  // Network / connection errors (git2 + reqwest)
  if (
    lower.includes("network error") ||
    lower.includes("could not resolve") ||
    lower.includes("dns") ||
    lower.includes("timed out") ||
    lower.includes("timeout") ||
    lower.includes("connection refused") ||
    lower.includes("connection reset") ||
    lower.includes("connection closed") ||
    lower.includes("no address associated")
  ) {
    return "Cannot reach the remote server. Check your internet connection.";
  }

  // Auth errors (forge HTTP 401 + git2 credential failures)
  if (
    lower.includes("authentication failed") ||
    lower.includes("401") ||
    lower.includes("unauthorized") ||
    lower.includes("invalid or expired token")
  ) {
    return "Authentication failed. Check your token in Settings \u2192 Git \u2192 Remote Accounts.";
  }

  // Permission / forbidden errors (forge HTTP 403)
  if (
    lower.includes("access denied") ||
    lower.includes("403") ||
    lower.includes("forbidden") ||
    lower.includes("insufficient token permissions") ||
    lower.includes("insufficient permissions")
  ) {
    return "Insufficient permissions. Your token may need additional scopes.";
  }

  // Rate limit (GitHub 403 with "rate limit" or HTTP 429)
  if (lower.includes("rate limit") || lower.includes("429")) {
    return "Rate limited by the server. Try again later.";
  }

  // Uncommitted changes blocking checkout
  if (
    lower.includes("uncommitted changes") ||
    (lower.includes("cannot switch") && lower.includes("changes"))
  ) {
    return "Cannot switch branches with uncommitted changes. Commit or stash your changes first.";
  }

  // Push rejected (non-fast-forward)
  if (
    lower.includes("push rejected") ||
    lower.includes("non-fast-forward") ||
    (lower.includes("rejected") && lower.includes("push"))
  ) {
    return "Push rejected. Pull changes first, then push again.";
  }

  // Merge/checkout conflicts
  if (lower.includes("conflict") && (lower.includes("merge") || lower.includes("checkout"))) {
    return "Merge conflict detected. Resolve conflicts and stage the files.";
  }

  // Forge issue assignment failure
  if (lower.includes("assign") && (lower.includes("issue") || lower.includes("failed"))) {
    return "Could not assign issue. Check your token permissions.";
  }

  // Not authenticated (forge commands)
  if (lower.includes("not authenticated")) {
    return "Not authenticated. Add a token in Settings \u2192 Git \u2192 Remote Accounts.";
  }

  // Fallback: return the raw message
  return raw;
}
