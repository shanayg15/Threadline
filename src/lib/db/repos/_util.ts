/** Return the first row, asserting the query produced one (e.g. INSERT ... RETURNING). */
export function one<T>(rows: T[]): T {
  const row = rows[0];
  if (row === undefined) {
    throw new Error("Expected at least one row, got none");
  }
  return row;
}

function codeOf(e: unknown): string | undefined {
  if (e && typeof e === "object" && "code" in e) {
    const code = (e as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

/**
 * True for a Postgres unique-violation (SQLSTATE 23505). Checks the error AND its
 * `.cause` because Drizzle wraps driver errors in a DrizzleQueryError, putting the
 * pg `code` on `.cause`.
 */
export function isUniqueViolation(error: unknown): boolean {
  if (codeOf(error) === "23505") return true;
  const cause = error && typeof error === "object" && "cause" in error ? error.cause : undefined;
  return codeOf(cause) === "23505";
}
