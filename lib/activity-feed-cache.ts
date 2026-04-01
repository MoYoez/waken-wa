import 'server-only'

import {
  getRedisActivityCacheTtlSeconds,
  shouldUseRedisCache,
} from '@/lib/cache-runtime-toggle'
import { redisDel, redisGetJson, redisSetJson } from '@/lib/redis-client'
import type { ActivityFeedData } from '@/types/activity'

const ACTIVITY_FEED_CACHE_KEY = 'waken:activity:feed:v1'

type MemoryCacheValue = {
  expiresAt: number
  value: ActivityFeedData
}

let memoryCache: MemoryCacheValue | null = null

function getMemoryCached(): ActivityFeedData | null {
  if (!memoryCache) return null
  if (Date.now() > memoryCache.expiresAt) {
    memoryCache = null
    return null
  }
  return memoryCache.value
}

function setMemoryCached(value: ActivityFeedData, ttlSeconds: number): void {
  const ttlMs = Math.max(1000, Math.round(ttlSeconds * 1000))
  memoryCache = {
    expiresAt: Date.now() + ttlMs,
    value,
  }
}

export async function getCachedActivityFeedData(): Promise<ActivityFeedData | null> {
  const useRedis = await shouldUseRedisCache()
  if (useRedis) {
    return redisGetJson<ActivityFeedData>(ACTIVITY_FEED_CACHE_KEY)
  }
  return getMemoryCached()
}

export async function setCachedActivityFeedData(value: ActivityFeedData): Promise<void> {
  const ttlSeconds = await getRedisActivityCacheTtlSeconds()
  const useRedis = await shouldUseRedisCache()
  if (useRedis) {
    await redisSetJson(ACTIVITY_FEED_CACHE_KEY, value, ttlSeconds)
    return
  }
  setMemoryCached(value, Math.min(ttlSeconds, 3))
}

export async function clearCachedActivityFeedData(): Promise<void> {
  memoryCache = null
  const useRedis = await shouldUseRedisCache()
  if (useRedis) {
    await redisDel(ACTIVITY_FEED_CACHE_KEY)
  }
}

