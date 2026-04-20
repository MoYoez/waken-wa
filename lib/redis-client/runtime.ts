import Redis from 'ioredis'

import {
  ensureFixedWindowIncrCommand,
  ensureHSetManyAndFixedWindowIncrCommand,
} from '@/lib/redis-client/commands'
import { parseRedisHostname, redisUrlToOptions } from '@/lib/redis-client/url'

let redisClient: Redis | null = null
let redisInitAttempted = false
let redisRuntimeDisabled = false
let redisDisableLogged = false
let redisSwitchLogged = false
let redisUrlCandidatesCache: string[] | null = null
let redisCandidateIndex = 0

function shouldDisableRedisForError(error: unknown): boolean {
  const message = String((error as { message?: unknown })?.message ?? error ?? '')
  return (
    message.includes('ENOTFOUND') ||
    message.includes('ECONNREFUSED') ||
    message.includes('EAI_AGAIN') ||
    message.includes('ETIMEDOUT')
  )
}

function disableRedisRuntime(error?: unknown): void {
  redisRuntimeDisabled = true
  if (!redisDisableLogged) {
    redisDisableLogged = true
    if (error) {
      console.warn('[redis] disabled at runtime, falling back to memory/db:', error)
    } else {
      console.warn('[redis] disabled at runtime, falling back to memory/db')
    }
  }
  if (redisClient) {
    try {
      redisClient.disconnect()
    } catch {}
  }
  redisClient = null
}

function getRedisUrl(): string {
  return String(process.env.REDIS_URL ?? '').trim()
}

function getRedisUrlCandidates(): string[] {
  if (redisUrlCandidatesCache) return redisUrlCandidatesCache
  const configured = getRedisUrl()
  if (!configured) {
    redisUrlCandidatesCache = []
    return redisUrlCandidatesCache
  }

  const out: string[] = []
  const pushUnique = (value: string) => {
    const v = value.trim()
    if (!v) return
    if (!out.includes(v)) out.push(v)
  }

  const hostname = parseRedisHostname(configured)
  // Compatibility mode:
  // - old compose may still provide REDIS_URL=redis://redis:6379
  // - all-in-one containers often run redis on localhost
  // Try internal first so old env/compose can still self-heal.
  if (hostname === 'redis') {
    pushUnique('redis://127.0.0.1:6379')
    pushUnique('redis://localhost:6379')
  }

  pushUnique(configured)
  redisUrlCandidatesCache = out
  return out
}

function getCurrentRedisUrlCandidate(): string | null {
  const candidates = getRedisUrlCandidates()
  if (candidates.length === 0) return null
  return candidates[redisCandidateIndex] ?? null
}

function shouldInitRedis(): boolean {
  return getRedisUrlCandidates().length > 0
}

function switchToNextRedisCandidate(error: unknown): boolean {
  const candidates = getRedisUrlCandidates()
  if (redisCandidateIndex + 1 >= candidates.length) {
    return false
  }
  redisCandidateIndex += 1
  redisInitAttempted = false
  if (redisClient) {
    try {
      redisClient.disconnect()
    } catch {}
  }
  redisClient = null
  if (!redisSwitchLogged) {
    redisSwitchLogged = true
    console.warn('[redis] current endpoint unavailable, switching candidate:', error)
  }
  return true
}

export function getRedisClient(): Redis | null {
  if (redisRuntimeDisabled) return null
  if (redisClient) return redisClient
  if (redisInitAttempted) return null
  redisInitAttempted = true
  if (!shouldInitRedis()) return null
  const redisUrl = getCurrentRedisUrlCandidate()
  if (!redisUrl) return null

  try {
    redisClient = new Redis({
      ...redisUrlToOptions(redisUrl),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableAutoPipelining: true,
      retryStrategy(times) {
        if (times >= 3) return null
        return Math.min(times * 200, 1000)
      },
    })
    redisClient.on('error', (error) => {
      if (shouldDisableRedisForError(error)) {
        if (!switchToNextRedisCandidate(error)) {
          disableRedisRuntime(error)
        }
      }
    })
    ensureFixedWindowIncrCommand(redisClient)
    ensureHSetManyAndFixedWindowIncrCommand(redisClient)
    return redisClient
  } catch {
    redisClient = null
    return null
  }
}

export function hasRedisConfigured(): boolean {
  return shouldInitRedis()
}
