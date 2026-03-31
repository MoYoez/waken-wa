import 'server-only'

import Redis from 'ioredis'

/**
 * Fixed-window counter: INCR; set TTL only on first increment (key was missing).
 * Must run atomically — split INCR + EXPIRE races with expiry; SET NX + INCR can leave a key without TTL.
 */
const LUA_FIXED_WINDOW_INCR = `
local c = redis.call('INCR', KEYS[1])
if c == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return c
`

type RedisWithFixedWindowIncr = Redis & {
  fixedWindowIncr(key: string, ttlSeconds: string): Promise<number>
}

function ensureFixedWindowIncrCommand(client: Redis): void {
  const marked = client as Redis & { __wakenFixedWindowIncr?: boolean }
  if (marked.__wakenFixedWindowIncr) return
  marked.__wakenFixedWindowIncr = true
  client.defineCommand('fixedWindowIncr', {
    numberOfKeys: 1,
    lua: LUA_FIXED_WINDOW_INCR.trim(),
  })
}

let redisClient: Redis | null = null
let redisInitAttempted = false

function getRedisUrl(): string {
  return String(process.env.REDIS_URL ?? '').trim()
}

function shouldInitRedis(): boolean {
  return getRedisUrl().length > 0
}

function getRedisClient(): Redis | null {
  if (redisClient) return redisClient
  if (redisInitAttempted) return null
  redisInitAttempted = true
  if (!shouldInitRedis()) return null

  try {
    redisClient = new Redis(getRedisUrl(), {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableAutoPipelining: true,
    })
    ensureFixedWindowIncrCommand(redisClient)
    return redisClient
  } catch {
    redisClient = null
    return null
  }
}

export function hasRedisConfigured(): boolean {
  return shouldInitRedis()
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
    const ttl = Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? Math.round(ttlSeconds) : 1
    await client.set(key, JSON.stringify(value), 'EX', ttl)
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
    const ttl = Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? Math.round(ttlSeconds) : 1
    await client.set(key, value, 'EX', ttl)
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

/** Fixed-window rate limit: count per key, TTL from first hit in window. */
export async function redisIncrWithExpire(
  key: string,
  windowSeconds: number,
): Promise<number | null> {
  const client = getRedisClient()
  if (!client) return null
  try {
    const ttl = Number.isFinite(windowSeconds) && windowSeconds > 0 ? Math.round(windowSeconds) : 1
    const out = await (client as RedisWithFixedWindowIncr).fixedWindowIncr(key, String(ttl))
    const n = Number(out)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}