import { createHash } from 'node:crypto'

import { and, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { sqlTimestamp } from '@/lib/sql-timestamp'
import { apiTokens } from '@/lib/drizzle-schema'

const STORED_HASH_PREFIX = 'h$'

/** SHA-256 hex (64 chars) of UTF-8 secret — used for lookup only. */
export function hashApiTokenSecret(plain: string): string {
  return createHash('sha256').update(plain, 'utf8').digest('hex')
}

/** Value persisted in `ApiToken.token` for new / migrated rows. */
export function storedFormFromPlainSecret(plain: string): string {
  return `${STORED_HASH_PREFIX}${hashApiTokenSecret(plain)}`
}

/** True if DB value is hashed form (plaintext secret cannot be recovered). */
export function isStoredApiTokenHashed(stored: string): boolean {
  if (!stored.startsWith(STORED_HASH_PREFIX)) return false
  const hex = stored.slice(STORED_HASH_PREFIX.length)
  return hex.length === 64 && /^[0-9a-f]+$/i.test(hex)
}

/**
 * Find active token by Bearer secret. DB stores `h$` + sha256(plain); legacy rows may still hold plaintext.
 * On legacy hit, rewrites row to hashed storage.
 */
export async function findActiveApiTokenBySecret(plainSecret: string) {
  const trimmed = plainSecret.trim()
  if (!trimmed) return null

  const hashedForm = storedFormFromPlainSecret(trimmed)

  const [byHash] = await db
    .select()
    .from(apiTokens)
    .where(and(eq(apiTokens.token, hashedForm), eq(apiTokens.isActive, true)))
    .limit(1)
  if (byHash) return byHash

  const [legacy] = await db
    .select()
    .from(apiTokens)
    .where(and(eq(apiTokens.token, trimmed), eq(apiTokens.isActive, true)))
    .limit(1)
  if (!legacy) return null

  await db.update(apiTokens).set({ token: hashedForm }).where(eq(apiTokens.id, legacy.id))

  const [row] = await db.select().from(apiTokens).where(eq(apiTokens.id, legacy.id)).limit(1)
  return row ?? null
}

export async function touchApiTokenLastUsed(id: number) {
  await db
    .update(apiTokens)
    .set({ lastUsedAt: sqlTimestamp() })
    .where(eq(apiTokens.id, id))
}

/** Resolve Bearer secret to token id and bump lastUsedAt. */
export async function resolveActiveApiTokenFromPlainSecret(
  plainSecret: string,
): Promise<{ id: number } | null> {
  const row = await findActiveApiTokenBySecret(plainSecret)
  if (!row) return null
  await touchApiTokenLastUsed(row.id)
  return { id: row.id }
}
