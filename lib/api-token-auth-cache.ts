import { and, eq } from 'drizzle-orm'

import { shouldUseRedisCache } from '@/lib/cache-runtime-toggle'
import { db } from '@/lib/db'
import { apiTokens } from '@/lib/drizzle-schema'
import { redisDeleteByPrefix, redisGetJson, redisSetJson } from '@/lib/redis-client'

type CacheRow = any | null

type CacheEntry = {
  at: number
  value: CacheRow
}

/** In-memory + Redis freshness window (Redis EX uses seconds). */
const TOKEN_AUTH_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const TOKEN_AUTH_CACHE_TTL_SECONDS = Math.round(TOKEN_AUTH_CACHE_TTL_MS / 1000)
const tokenAuthCache = new Map<string, CacheEntry>()
const TOKEN_AUTH_REDIS_KEY_PREFIX = 'waken:api-token-auth:v1:'

function redisKey(hashedToken: string): string {
  return `${TOKEN_AUTH_REDIS_KEY_PREFIX}${hashedToken}`
}

function isFresh(entry: CacheEntry | undefined, now: number): entry is CacheEntry {
  return !!entry && now - entry.at < TOKEN_AUTH_CACHE_TTL_MS
}

export function clearApiTokenAuthCache(): void {
  tokenAuthCache.clear()
  void (async () => {
    if (await shouldUseRedisCache()) {
      await redisDeleteByPrefix(TOKEN_AUTH_REDIS_KEY_PREFIX)
    }
  })()
}

export function primeApiTokenAuthCache(hashedToken: string, value: CacheRow): void {
  const now = Date.now()
  tokenAuthCache.set(hashedToken, { at: now, value })
  void (async () => {
    if (await shouldUseRedisCache()) {
      await redisSetJson(redisKey(hashedToken), { at: now, value }, TOKEN_AUTH_CACHE_TTL_SECONDS)
    }
  })()
}

export async function getActiveApiTokenByHashedCached(hashedToken: string): Promise<CacheRow> {
  const now = Date.now()
  const hit = tokenAuthCache.get(hashedToken)
  if (isFresh(hit, now)) return hit.value

  if (await shouldUseRedisCache()) {
    const redisHit = (await redisGetJson<CacheEntry>(redisKey(hashedToken))) ?? undefined
    if (isFresh(redisHit, now)) {
      tokenAuthCache.set(hashedToken, redisHit)
      return redisHit.value
    }
  }

  const [row] = await db
    .select()
    .from(apiTokens)
    .where(and(eq(apiTokens.token, hashedToken), eq(apiTokens.isActive, true)))
    .limit(1)

  const value = row ?? null
  const next = { at: now, value }
  tokenAuthCache.set(hashedToken, next)
  if (await shouldUseRedisCache()) {
    void redisSetJson(redisKey(hashedToken), next, TOKEN_AUTH_CACHE_TTL_SECONDS)
  }
  return value
}
