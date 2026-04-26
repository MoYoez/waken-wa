import { shouldUseRedisCache } from '@/lib/cache-runtime-toggle'
import { redisIncrWithExpire } from '@/lib/redis-client'

const memoryStore = new Map<string, { count: number; resetAt: number }>()
let memoryOpCount = 0

export type RateLimitCheckResult = {
  limited: boolean
  count: number
  resetAt: number
  backend: 'redis' | 'memory'
}

function isRateLimitedFromMemory(
  key: string,
  maxRequests: number,
  windowMs: number,
): { limited: boolean; count: number; resetAt: number } {
  const now = Date.now()

  if (++memoryOpCount % 100 === 0) {
    for (const [k, entry] of memoryStore) {
      if (now > entry.resetAt) memoryStore.delete(k)
    }
  }

  const entry = memoryStore.get(key)
  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs
    memoryStore.set(key, { count: 1, resetAt })
    return { limited: false, count: 1, resetAt }
  }
  entry.count++
  return { limited: entry.count > maxRequests, count: entry.count, resetAt: entry.resetAt }
}

export async function isRateLimited(
  key: string,
  maxRequests: number,
  windowMs: number,
): Promise<boolean> {
  const result = await checkRateLimit(key, maxRequests, windowMs)
  return result.limited
}

export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): Promise<RateLimitCheckResult> {
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000))
  const redisCount =
    (await shouldUseRedisCache()) ? await redisIncrWithExpire(`waken:rl:${key}`, windowSeconds) : null
  if (redisCount != null) {
    const now = Date.now()
    return {
      limited: redisCount > maxRequests,
      count: redisCount,
      resetAt: now + windowMs,
      backend: 'redis',
    }
  }

  const memory = isRateLimitedFromMemory(key, maxRequests, windowMs)
  return {
    limited: memory.limited,
    count: memory.count,
    resetAt: memory.resetAt,
    backend: 'memory',
  }
}
