import 'server-only'

import { shouldUseRedisCache } from '@/lib/cache-runtime-toggle'
import {
  redisExpire,
  redisHDel,
  redisHGetAll,
  redisHSet,
} from '@/lib/redis-client'

const REALTIME_ACTIVITY_CACHE_KEY = 'waken:activity:realtime:v2'

export type RealtimeActivityRow = {
  id: string
  deviceId: number
  device: string
  generatedHashKey: string
  processName: string
  processTitle: string | null
  metadata: Record<string, unknown> | null
  startedAt: string
  updatedAt: string
  expiresAt: string
}

type RealtimeActivityState = Record<string, RealtimeActivityRow>

let memoryState: RealtimeActivityState = {}
let memoryLoaded = false
let memoryLoadedAt = 0
const REDIS_REFRESH_INTERVAL_MS = 1000

function cacheKey(generatedHashKey: string, processName: string): string {
  return `${generatedHashKey}:${processName}`.toLowerCase()
}

function nowMs(): number {
  return Date.now()
}

function prune(state: RealtimeActivityState): RealtimeActivityState {
  const now = nowMs()
  const out: RealtimeActivityState = {}
  for (const [k, v] of Object.entries(state)) {
    const exp = Date.parse(v.expiresAt)
    if (!Number.isFinite(exp) || exp <= now) continue
    out[k] = v
  }
  return out
}

function parseHashState(raw: Record<string, string>): RealtimeActivityState {
  const out: RealtimeActivityState = {}
  for (const [field, value] of Object.entries(raw)) {
    try {
      const parsed = JSON.parse(value) as RealtimeActivityRow
      if (!parsed || typeof parsed !== 'object') continue
      out[field] = parsed
    } catch {
      continue
    }
  }
  return prune(out)
}

async function loadState(): Promise<RealtimeActivityState> {
  memoryState = prune(memoryState)
  const useRedis = await shouldUseRedisCache()
  if (!useRedis) {
    if (!memoryLoaded) {
      memoryLoaded = true
      memoryLoadedAt = nowMs()
    }
    return memoryState
  }

  if (memoryLoaded && nowMs() - memoryLoadedAt < REDIS_REFRESH_INTERVAL_MS) {
    return memoryState
  }

  const fromRedisHash = await redisHGetAll(REALTIME_ACTIVITY_CACHE_KEY)
  memoryState = fromRedisHash ? parseHashState(fromRedisHash) : {}
  memoryLoaded = true
  memoryLoadedAt = nowMs()
  return memoryState
}

async function saveState(state: RealtimeActivityState, ttlSeconds: number): Promise<void> {
  memoryState = prune(state)
  memoryLoaded = true
  memoryLoadedAt = nowMs()

  if (await shouldUseRedisCache()) {
    const safeTtl = Math.max(5, Math.round(ttlSeconds))
    for (const [field, row] of Object.entries(memoryState)) {
      await redisHSet(REALTIME_ACTIVITY_CACHE_KEY, field, JSON.stringify(row))
    }
    await redisExpire(REALTIME_ACTIVITY_CACHE_KEY, safeTtl)
  }
}

export async function upsertRealtimeActivity(
  row: Omit<RealtimeActivityRow, 'id'>,
  ttlSeconds: number,
): Promise<void> {
  const state = await loadState()
  const key = cacheKey(row.generatedHashKey, row.processName)
  const nextRow = {
    ...row,
    id: `rt_${row.deviceId}_${Date.parse(row.updatedAt)}_${Math.random().toString(16).slice(2, 8)}`,
  }
  state[key] = nextRow
  memoryState = prune(state)
  memoryLoaded = true
  memoryLoadedAt = nowMs()
  if (await shouldUseRedisCache()) {
    await redisHSet(REALTIME_ACTIVITY_CACHE_KEY, key, JSON.stringify(nextRow))
    await redisExpire(REALTIME_ACTIVITY_CACHE_KEY, Math.max(ttlSeconds, 5))
    return
  }
  await saveState(prune(state), Math.max(ttlSeconds, 5))
}

export async function removeRealtimeActivity(
  generatedHashKey: string,
  processName: string,
): Promise<void> {
  const state = await loadState()
  const key = cacheKey(generatedHashKey, processName)
  delete state[key]
  memoryState = prune(state)
  memoryLoaded = true
  memoryLoadedAt = nowMs()
  if (await shouldUseRedisCache()) {
    await redisHDel(REALTIME_ACTIVITY_CACHE_KEY, key)
    await redisExpire(REALTIME_ACTIVITY_CACHE_KEY, 60)
    return
  }
  await saveState(prune(state), 60)
}

export async function listRealtimeActivities(): Promise<RealtimeActivityRow[]> {
  const state = await loadState()
  return Object.values(prune(state))
}
