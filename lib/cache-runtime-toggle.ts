import 'server-only'

import {
  REDIS_ACTIVITY_FEED_CACHE_TTL_DEFAULT_SECONDS,
  REDIS_ACTIVITY_FEED_CACHE_TTL_MAX_SECONDS,
} from '@/lib/activity-api-constants'
import { hasRedisConfigured } from '@/lib/redis-client'
import { readSiteConfigV2Record } from '@/lib/site-config-v2'

export function isVercelRuntime(): boolean {
  return String(process.env.VERCEL ?? '') === '1'
}

/** Vercel can auto-force Redis cache only when REDIS_URL is actually configured. */
export function isRedisCacheForcedOnServerless(): boolean {
  return isVercelRuntime() && hasRedisConfigured()
}

export function mergeRedisCacheAdminFields(config: {
  useNoSqlAsCacheRedis?: boolean | null
}): { useNoSqlAsCacheRedis: boolean; redisCacheServerlessForced: boolean } {
  const forced = isRedisCacheForcedOnServerless()
  return {
    useNoSqlAsCacheRedis: forced || config.useNoSqlAsCacheRedis === true,
    redisCacheServerlessForced: forced,
  }
}

async function getUseNoSqlAsCacheRedisFromDb(): Promise<boolean> {
  try {
    const row = await readSiteConfigV2Record()
    return row?.useNoSqlAsCacheRedis === true
  } catch {
    return false
  }
}

/**
 * When true, app-layer Redis (JWT cache, rate limit, site config cache, activity caches, etc.) is used.
 * Vercel: REDIS_URL required (then default-on). Else: REDIS_URL required and DB toggle useNoSqlAsCacheRedis.
 * Avoids importing site-config-cache here to prevent circular deps with shouldUseRedisCache gating.
 */
export async function shouldUseRedisCache(): Promise<boolean> {
  if (!hasRedisConfigured()) return false
  if (isVercelRuntime()) return true
  return getUseNoSqlAsCacheRedisFromDb()
}

export function parseRedisCacheTtlSeconds(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return REDIS_ACTIVITY_FEED_CACHE_TTL_DEFAULT_SECONDS
  const i = Math.round(n)
  if (i < 1) return 1
  if (i > REDIS_ACTIVITY_FEED_CACHE_TTL_MAX_SECONDS) return REDIS_ACTIVITY_FEED_CACHE_TTL_MAX_SECONDS
  return i
}

export async function getRedisActivityCacheTtlSeconds(): Promise<number> {
  try {
    const row = await readSiteConfigV2Record()
    return parseRedisCacheTtlSeconds(row?.redisCacheTtlSeconds ?? process.env.REDIS_CACHE_TTL_SECONDS)
  } catch {
    return parseRedisCacheTtlSeconds(process.env.REDIS_CACHE_TTL_SECONDS)
  }
}
