import { createHash } from 'node:crypto'

import { and, eq } from 'drizzle-orm'

import {
  clearApiTokenAuthCache,
  getActiveApiTokenByHashedCached,
  primeApiTokenAuthCache,
} from '@/lib/api-token-auth-cache'
import { db } from '@/lib/db'
import { apiTokens } from '@/lib/drizzle-schema'
import { sqlTimestamp } from '@/lib/sql-timestamp'

const STORED_HASH_PREFIX = 'h$'
const API_TOKEN_LAST_USED_WRITE_THROTTLE_MS = 10 * 60 * 1000
const tokenLastUsedWriteAt = new Map<number, number>()

function parseTimestampMs(value: Date | string | null | undefined): number | null {
  if (!value) return null
  if (value instanceof Date) {
    const ts = value.getTime()
    return Number.isFinite(ts) ? ts : null
  }
  const ts = Date.parse(String(value))
  return Number.isFinite(ts) ? ts : null
}

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

  const byHash = await getActiveApiTokenByHashedCached(hashedForm)
  if (byHash) return byHash

  const [legacy] = await db
    .select()
    .from(apiTokens)
    .where(and(eq(apiTokens.token, trimmed), eq(apiTokens.isActive, true)))
    .limit(1)
  if (!legacy) return null

  await db.update(apiTokens).set({ token: hashedForm }).where(eq(apiTokens.id, legacy.id))

  const [row] = await db.select().from(apiTokens).where(eq(apiTokens.id, legacy.id)).limit(1)
  primeApiTokenAuthCache(hashedForm, row ?? null)
  return row ?? null
}

export async function touchApiTokenLastUsed(
  id: number,
  lastUsedAt?: Date | string | null,
) {
  const nowMs = Date.now()
  const memoryMs = tokenLastUsedWriteAt.get(id) ?? null
  if (memoryMs !== null && nowMs - memoryMs < API_TOKEN_LAST_USED_WRITE_THROTTLE_MS) {
    return
  }

  const persistedMs = parseTimestampMs(lastUsedAt)
  if (persistedMs !== null && nowMs - persistedMs < API_TOKEN_LAST_USED_WRITE_THROTTLE_MS) {
    tokenLastUsedWriteAt.set(id, persistedMs)
    return
  }

  await db
    .update(apiTokens)
    .set({ lastUsedAt: sqlTimestamp() })
    .where(eq(apiTokens.id, id))
  tokenLastUsedWriteAt.set(id, nowMs)
}

/** Resolve Bearer secret to token id and bump lastUsedAt. */
export async function resolveActiveApiTokenFromPlainSecret(
  plainSecret: string,
): Promise<{ id: number } | null> {
  const row = await findActiveApiTokenBySecret(plainSecret)
  if (!row) return null
  await touchApiTokenLastUsed(row.id, row.lastUsedAt)
  return { id: row.id }
}

export { clearApiTokenAuthCache }
