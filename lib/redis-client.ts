import 'server-only'

import Redis, { type RedisOptions } from 'ioredis'

/**
 * Parse a Redis connection URL with the WHATWG URL API so ioredis never calls
 * Node's deprecated `url.parse()` (DEP0169) when given a connection string.
 */
function redisUrlToOptions(urlStr: string): RedisOptions {
  const trimmed = urlStr.trim()
  if (/^\d+$/.test(trimmed)) {
    return { port: Number.parseInt(trimmed, 10) }
  }

  let href = trimmed
  if (href.startsWith('//')) {
    href = `redis:${href}`
  } else if (!href.includes('://')) {
    href = href.startsWith('/') ? `redis:${href}` : `redis://${href}`
  }

  let u: URL
  try {
    u = new URL(href)
  } catch {
    throw new Error('Invalid REDIS_URL')
  }

  const scheme = u.protocol.replace(/:$/, '')
  const isRedisScheme = scheme === 'redis' || scheme === 'rediss'
  const opts: RedisOptions = {}

  if (u.username !== '' || u.password !== '') {
    opts.username = decodeURIComponent(u.username)
    opts.password = decodeURIComponent(u.password)
  }

  if (u.hostname !== '') {
    opts.host = u.hostname
  }
  if (u.port !== '') {
    opts.port = Number.parseInt(u.port, 10)
  }

  if (u.pathname && u.pathname !== '/') {
    const rest = u.pathname.slice(1)
    if (isRedisScheme) {
      // e.g. redis:///tmp/redis.sock — pathname is a filesystem path, not a DB index
      if (u.hostname === '' && rest.includes('/')) {
        opts.path = u.pathname
      } else {
        const dbNum = Number.parseInt(rest, 10)
        if (!Number.isNaN(dbNum)) opts.db = dbNum
      }
    } else {
      opts.path = u.pathname
    }
  }

  u.searchParams.forEach((value, key) => {
    if (key === 'family') {
      const n = Number.parseInt(value, 10)
      if (!Number.isNaN(n)) opts.family = n
    } else {
      ;(opts as Record<string, unknown>)[key] = value
    }
  })

  if (scheme === 'rediss') {
    opts.tls = {}
  }

  return opts
}

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
    redisClient = new Redis({
      ...redisUrlToOptions(getRedisUrl()),
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
      for (const k of keys) {
        out.push(k)
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
    const ttl = Number.isFinite(windowSeconds) && windowSeconds > 0 ? Math.round(windowSeconds) : 1
    const out = await (client as RedisWithFixedWindowIncr).fixedWindowIncr(key, String(ttl))
    const n = Number(out)
    return Number.isFinite(n) ? n : null
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
