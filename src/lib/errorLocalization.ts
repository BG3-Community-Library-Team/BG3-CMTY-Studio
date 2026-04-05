/**
 * Error localization — maps stable Rust error keys to paraglide messages.
 * Unknown keys fall back to the raw message string (backward compatible).
 */

export interface AppError {
  kind: string;
  message: string;
  context?: Record<string, string>;
}

/** Map of stable error keys → localized message formatters.
 *  Populated incrementally as Rust commands adopt stable keys. */
const errorMessages: Record<string, (ctx: Record<string, string>) => string> = {
  source_dir_not_found: (ctx) => `Source directory not found: ${ctx.path ?? "unknown"}`,
  schema_db_not_found: (ctx) =>
    `Schema database not found: ${ctx.path ?? "unknown"}. Build ref_base.sqlite first.`,
  mod_dir_not_found: (ctx) => `Mod directory not found: ${ctx.path ?? "unknown"}`,
};

/** Resolve an AppError to a user-facing localized string.
 *  Falls back to the raw message for unmapped keys. */
export function localizeError(err: AppError): string {
  const mapper = errorMessages[err.message];
  if (mapper) {
    return mapper(err.context ?? {});
  }
  return err.message;
}
