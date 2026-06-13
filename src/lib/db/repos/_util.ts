/** Return the first row, asserting the query produced one (e.g. INSERT ... RETURNING). */
export function one<T>(rows: T[]): T {
  const row = rows[0];
  if (row === undefined) {
    throw new Error("Expected at least one row, got none");
  }
  return row;
}
