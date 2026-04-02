import { eq } from 'drizzle-orm'

import { shouldUseRedisCache } from '@/lib/cache-runtime-toggle'
import { db } from '@/lib/db'
import { siteConfig } from '@/lib/drizzle-schema'
import { redisDel, redisGetJson, redisSetJson } from '@/lib/redis-client'
import { normalizeSiteConfigShape } from '@/lib/site-config-normalize'

type SiteConfigValue = any | null
const SITE_CONFIG_CACHE_KEY = 'waken:site-config:v1'
const SITE_CONFIG_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60

type SiteConfigCacheState = {
  loaded: boolean
  value: SiteConfigValue
}

declare global {
  var __wakenSiteConfigCache: SiteConfigCacheState | undefined
}

function getCacheState(): SiteConfigCacheState {
  if (!globalThis.__wakenSiteConfigCache) {
    globalThis.__wakenSiteConfigCache = { loaded: false, value: null }
  }
  return globalThis.__wakenSiteConfigCache
}

export function clearSiteConfigMemoryCache(): void {
  globalThis.__wakenSiteConfigCache = { loaded: false, value: null }
}

export async function clearSiteConfigCaches(): Promise<void> {
  clearSiteConfigMemoryCache()
  if (await shouldUseRedisCache()) {
    await redisDel(SITE_CONFIG_CACHE_KEY)
  }
}

export function setSiteConfigMemoryCache(value: unknown): void {
  const state = getCacheState()
  state.loaded = true
  state.value = value && typeof value === 'object' ? normalizeSiteConfigShape(value as Record<string, any>) : null
}

export async function getSiteConfigMemoryFirst(): Promise<SiteConfigValue> {
  const state = getCacheState()
  if (state.loaded) {
    return state.value
  }

  if (await shouldUseRedisCache()) {
    const fromRedis = await redisGetJson<SiteConfigValue>(SITE_CONFIG_CACHE_KEY)
    if (fromRedis && typeof fromRedis === 'object') {
      setSiteConfigMemoryCache(fromRedis)
      return getCacheState().value
    }
  }

  const [row] = await db.select().from(siteConfig).where(eq(siteConfig.id, 1)).limit(1)
  setSiteConfigMemoryCache(row ?? null)
  const normalizedRow = getCacheState().value
  if (normalizedRow && typeof normalizedRow === 'object' && (await shouldUseRedisCache())) {
    await redisSetJson(SITE_CONFIG_CACHE_KEY, normalizedRow, SITE_CONFIG_CACHE_TTL_SECONDS)
  }
  return getCacheState().value
}
