import type { RedisWithFixedWindowIncr } from '@/lib/redis-client/commands'
import { getRedisClient } from '@/lib/redis-client/runtime'

function normalizePositiveTtl(ttlSeconds: number): number {
  return Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? Math.round(ttlSeconds) : 1
}

export async function redisGetJson<T>(key: string): Promise<T | null> {
  const client = getRedisClient()
  if (!client) return null
  try {
    const raw = await client.get(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function redisGetString(key: string): Promise<string | null> {
  const client = getRedisClient()
  if (!client) return null
  try {
    const raw = await client.get(key)
    return raw ?? null
  } catch {
    return null
  }
}

export async function redisSetJson(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<boolean> {
  const client = getRedisClient()
  if (!client) return false
  try {
    await client.set(key, JSON.stringify(value), 'EX', normalizePositiveTtl(ttlSeconds))
    return true
  } catch {
    return false
  }
}

export async function redisSetString(
  key: string,
  value: string,
  ttlSeconds: number,
): Promise<boolean> {
  const client = getRedisClient()
  if (!client) return false
  try {
    await client.set(key, value, 'EX', normalizePositiveTtl(ttlSeconds))
    return true
  } catch {
    return false
  }
}

export async function redisDel(key: string): Promise<boolean> {
  const client = getRedisClient()
  if (!client) return false
  try {
    await client.del(key)
    return true
  } catch {
    return false
  }
}

export async function redisHGetAll(key: string): Promise<Record<string, string> | null> {
  const client = getRedisClient()
  if (!client) return null
  try {
    const raw = await client.hgetall(key)
    return raw ?? {}
  } catch {
    return null
  }
}

export async function redisHSet(
  key: string,
  field: string,
  value: string,
): Promise<boolean> {
  const client = getRedisClient()
  if (!client) return false
  try {
    await client.hset(key, field, value)
    return true
  } catch {
    return false
  }
}

export async function redisHDel(key: string, field: string): Promise<boolean> {
  const client = getRedisClient()
  if (!client) return false
  try {
    await client.hdel(key, field)
    return true
  } catch {
    return false
  }
}

export async function redisHDelMany(key: string, fields: string[]): Promise<boolean> {
  const client = getRedisClient()
  if (!client) return false
  const uniqueFields = Array.from(new Set(fields.map((field) => field.trim()).filter(Boolean)))
  if (uniqueFields.length === 0) return true
  try {
    await client.hdel(key, ...uniqueFields)
    return true
  } catch {
    return false
  }
}

export async function redisExpire(key: string, ttlSeconds: number): Promise<boolean> {
  const client = getRedisClient()
  if (!client) return false
  try {
    await client.expire(key, normalizePositiveTtl(ttlSeconds))
    return true
  } catch {
    return false
  }
}

/** Best-effort: delete all keys matching `prefix*` (SCAN + batched DEL). */
export async function redisDeleteByPrefix(prefix: string): Promise<void> {
  const client = getRedisClient()
  if (!client || !prefix) return
  try {
    let cursor = '0'
    const pattern = `${prefix}*`
    do {
      const [next, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 200)
      cursor = next
      if (keys.length > 0) await client.del(...keys)
    } while (cursor !== '0')
  } catch {
    // silent fallback — same spirit as other redis helpers
  }
}

/** Best-effort: list keys matching `prefix*` (SCAN). */
export async function redisListKeysByPrefix(prefix: string, limit = 2000): Promise<string[]> {
  const client = getRedisClient()
  if (!client || !prefix) return []
  const safeLimit = Math.max(1, Math.min(20_000, Math.round(limit)))
  try {
    let cursor = '0'
    const pattern = `${prefix}*`
    const out: string[] = []
    do {
      const [next, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 200)
      cursor = next
      for (const key of keys) {
        out.push(key)
        if (out.length >= safeLimit) return out
      }
    } while (cursor !== '0')
    return out
  } catch {
    return []
  }
}

/** Fixed-window rate limit: count per key, TTL from first hit in window. */
export async function redisIncrWithExpire(
  key: string,
  windowSeconds: number,
): Promise<number | null> {
  const client = getRedisClient()
  if (!client) return null
  try {
    const out = await (client as RedisWithFixedWindowIncr).fixedWindowIncr(
      key,
      String(normalizePositiveTtl(windowSeconds)),
    )
    const count = Number(out)
    return Number.isFinite(count) ? count : null
  } catch {
    return null
  }
}

export async function redisHSetManyAndIncrWithExpire(
  hashKey: string,
  values: Record<string, string>,
  lockKey: string,
  windowSeconds: number,
): Promise<number | null> {
  const client = getRedisClient()
  if (!client) return null
  const entries = Object.entries(values)
  if (entries.length === 0) return redisIncrWithExpire(lockKey, windowSeconds)
  try {
    const args: [string, ...string[]] = [String(normalizePositiveTtl(windowSeconds))]
    for (const [field, value] of entries) {
      args.push(field, value)
    }
    const out = await (client as RedisWithFixedWindowIncr).hsetManyAndFixedWindowIncr(
      hashKey,
      lockKey,
      ...args,
    )
    const count = Number(out)
    return Number.isFinite(count) ? count : null
  } catch {
    return null
  }
}

export async function redisZAdd(key: string, score: number, member: string): Promise<boolean> {
  const client = getRedisClient()
  if (!client) return false
  try {
    await client.zadd(key, String(score), member)
    return true
  } catch {
    return false
  }
}

export async function redisZRemRangeByScore(
  key: string,
  minScore: number,
  maxScore: number,
): Promise<number> {
  const client = getRedisClient()
  if (!client) return 0
  try {
    const removed = await client.zremrangebyscore(key, String(minScore), String(maxScore))
    const count = Number(removed)
    return Number.isFinite(count) ? count : 0
  } catch {
    return 0
  }
}

export async function redisZCard(key: string): Promise<number | null> {
  const client = getRedisClient()
  if (!client) return null
  try {
    const size = await client.zcard(key)
    const count = Number(size)
    return Number.isFinite(count) ? count : null
  } catch {
    return null
  }
}

export async function redisZCountByScore(
  key: string,
  minScore: number | string,
  maxScore: number | string,
): Promise<number | null> {
  const client = getRedisClient()
  if (!client) return null
  try {
    const size = await client.zcount(key, String(minScore), String(maxScore))
    const count = Number(size)
    return Number.isFinite(count) ? count : null
  } catch {
    return null
  }
}
