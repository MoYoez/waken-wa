import type { RedisOptions } from 'ioredis'

/**
 * Parse a Redis connection URL with the WHATWG URL API so ioredis never calls
 * Node's deprecated `url.parse()` (DEP0169) when given a connection string.
 */
export function redisUrlToOptions(urlStr: string): RedisOptions {
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

export function parseRedisHostname(urlStr: string): string {
  let href = urlStr.trim()
  if (href.startsWith('//')) {
    href = `redis:${href}`
  } else if (!href.includes('://')) {
    href = href.startsWith('/') ? `redis:${href}` : `redis://${href}`
  }
  try {
    const u = new URL(href)
    return String(u.hostname ?? '').trim().toLowerCase()
  } catch {
    return ''
  }
}
