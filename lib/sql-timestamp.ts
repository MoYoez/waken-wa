/**
 * better-sqlite3 only accepts number, string, bigint, Buffer, and null for bound params.
 * Drizzle SQLite columns with `mode: 'timestamp'` must receive ISO strings at write time.
 * node-pg accepts the same strings for timestamptz columns.
 */
export function sqlTimestamp(): string {
  return new Date().toISOString()
}
