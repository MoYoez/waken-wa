import 'server-only'

import {
  getRedisActivityCacheTtlSeconds,
  shouldUseRedisCache,
} from '@/lib/cache-runtime-toggle'
import { redisDel, redisGetJson, redisGetString, redisSetJson, redisSetString } from '@/lib/redis-client'
import type { ActivityFeedData } from '@/types/activity'

const ACTIVITY_FEED_CACHE_KEY = 'waken:activity:feed:v1'
const ACTIVITY_FEED_DIRTY_KEY = 'waken:activity:feed:v1:dirty'
const ACTIVITY_FEED_SOFT_INVALIDATE_WINDOW_MS = 2 * 1000
const ACTIVITY_FEED_DIRTY_KEY_TTL_SECONDS = 24 * 60 * 60
const dirtyListeners = new Set<() => void>()

type MemoryCacheValue = {
  expiresAt: number
  writtenAt: number
  value: ActivityFeedData
}

let memoryCache: MemoryCacheValue | null = null
let memoryDirtyAt: number | null = null

function getMemoryCached(): ActivityFeedData | null {
  if (!memoryCache) return null
  if (Date.now() > memoryCache.expiresAt) {
    memoryCache = null
    return null
  }
  return memoryCache.value
}

function setMemoryCached(value: ActivityFeedData, ttlSeconds: number): void {
  const writtenAt = Date.now()
  const ttlMs = Math.max(1000, Math.round(ttlSeconds * 1000))
  memoryCache = {
    expiresAt: writtenAt + ttlMs,
    writtenAt,
    value,
  }
}

function isSoftInvalidated(cache: MemoryCacheValue, dirtyAt: number | null): boolean {
  if (dirtyAt == null) return false
  if (cache.writtenAt >= dirtyAt) return false
  return Date.now() - cache.writtenAt > ACTIVITY_FEED_SOFT_INVALIDATE_WINDOW_MS
}

function parseDirtyAt(value: string | null): number | null {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function notifyDirtyListeners(): void {
  for (const listener of dirtyListeners) {
    try {
      listener()
    } catch {
      // Ignore listener failures so cache writes remain best-effort.
    }
  }
}

export function subscribeActivityFeedCacheDirty(listener: () => void): () => void {
  dirtyListeners.add(listener)
  return () => {
    dirtyListeners.delete(listener)
  }
}

export async function getCachedActivityFeedData(): Promise<ActivityFeedData | null> {
  if (memoryCache) {
    const memoryHit = getMemoryCached()
    if (memoryHit && !isSoftInvalidated(memoryCache, memoryDirtyAt)) {
      return memoryHit
    }
  }

  const useRedis = await shouldUseRedisCache()
  if (!useRedis) {
    return null
  }

  const [redisHit, redisDirtyRaw] = await Promise.all([
    redisGetJson<ActivityFeedData>(ACTIVITY_FEED_CACHE_KEY),
    redisGetString(ACTIVITY_FEED_DIRTY_KEY),
  ])
  memoryDirtyAt = parseDirtyAt(redisDirtyRaw)
  if (redisHit) {
    const ttlSeconds = await getRedisActivityCacheTtlSeconds()
    setMemoryCached(redisHit, Math.min(ttlSeconds, 3))
    if (memoryCache && !isSoftInvalidated(memoryCache, memoryDirtyAt)) {
      return redisHit
    }
  }
  return null
}

export async function setCachedActivityFeedData(value: ActivityFeedData): Promise<void> {
  const ttlSeconds = await getRedisActivityCacheTtlSeconds()
  setMemoryCached(value, Math.min(ttlSeconds, 3))

  const useRedis = await shouldUseRedisCache()
  if (useRedis) {
    await redisSetJson(ACTIVITY_FEED_CACHE_KEY, value, ttlSeconds)
  }
}

export async function markCachedActivityFeedDataDirty(): Promise<void> {
  const dirtyAt = Date.now()
  memoryDirtyAt = dirtyAt
  notifyDirtyListeners()

  const useRedis = await shouldUseRedisCache()
  if (useRedis) {
    await redisSetString(
      ACTIVITY_FEED_DIRTY_KEY,
      String(dirtyAt),
      ACTIVITY_FEED_DIRTY_KEY_TTL_SECONDS,
    )
  }
}

export async function clearCachedActivityFeedData(): Promise<void> {
  memoryCache = null
  memoryDirtyAt = null
  const useRedis = await shouldUseRedisCache()
  if (useRedis) {
    await Promise.all([
      redisDel(ACTIVITY_FEED_CACHE_KEY),
      redisDel(ACTIVITY_FEED_DIRTY_KEY),
    ])
  }
}
