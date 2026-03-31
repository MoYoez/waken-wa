import { and, eq } from 'drizzle-orm'

import { shouldUseRedisCache } from '@/lib/cache-runtime-toggle'
import { db } from '@/lib/db'
import { devices } from '@/lib/drizzle-schema'
import { redisDeleteByPrefix, redisGetJson, redisSetJson } from '@/lib/redis-client'

type CacheEntry = {
  at: number
  ok: boolean
}

const DEVICE_AUTH_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const DEVICE_AUTH_CACHE_TTL_SECONDS = Math.round(DEVICE_AUTH_CACHE_TTL_MS / 1000)
const deviceAuthCache = new Map<string, CacheEntry>()
const DEVICE_AUTH_REDIS_KEY_PREFIX = 'waken:device-auth:v1:'

function cacheKey(tokenId: number, generatedHashKey: string): string {
  return `${tokenId}:${generatedHashKey}`
}

function redisKey(key: string): string {
  return `${DEVICE_AUTH_REDIS_KEY_PREFIX}${key}`
}

function isFresh(entry: CacheEntry | undefined, now: number): entry is CacheEntry {
  return !!entry && now - entry.at < DEVICE_AUTH_CACHE_TTL_MS
}

export function clearDeviceAuthCache(): void {
  deviceAuthCache.clear()
  void (async () => {
    if (await shouldUseRedisCache()) {
      await redisDeleteByPrefix(DEVICE_AUTH_REDIS_KEY_PREFIX)
    }
  })()
}

export async function isActiveDeviceBoundToTokenCached(
  tokenId: number,
  generatedHashKey: string,
): Promise<boolean> {
  const key = cacheKey(tokenId, generatedHashKey)
  const now = Date.now()
  const hit = deviceAuthCache.get(key)
  if (isFresh(hit, now)) return hit.ok

  if (await shouldUseRedisCache()) {
    const redisHit = (await redisGetJson<CacheEntry>(redisKey(key))) ?? undefined
    if (isFresh(redisHit, now)) {
      deviceAuthCache.set(key, redisHit)
      return redisHit.ok
    }
  }

  const [row] = await db
    .select({ id: devices.id })
    .from(devices)
    .where(
      and(
        eq(devices.generatedHashKey, generatedHashKey),
        eq(devices.apiTokenId, tokenId),
        eq(devices.status, 'active'),
      ),
    )
    .limit(1)

  const ok = !!row
  const next = { at: now, ok }
  deviceAuthCache.set(key, next)
  if (await shouldUseRedisCache()) {
    void redisSetJson(redisKey(key), next, DEVICE_AUTH_CACHE_TTL_SECONDS)
  }
  return ok
}
