import 'server-only'

import { shouldUseRedisCache } from '@/lib/cache-runtime-toggle'
import {
  redisHDel,
  redisHDelMany,
  redisHGetAll,
  redisHSet,
  redisPersist,
} from '@/lib/redis-client'

const REALTIME_ACTIVITY_CACHE_KEY = 'waken:activity:realtime:v2'
const REALTIME_ACTIVITY_REDIS_CLEANUP_INTERVAL_MS = 60 * 60 * 1000

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
let lastRedisCleanupAt = 0

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

function parseHashState(raw: Record<string, string>): {
  activeState: RealtimeActivityState
  expiredFields: string[]
} {
  const out: RealtimeActivityState = {}
  const expiredFields: string[] = []
  const now = nowMs()
  for (const [field, value] of Object.entries(raw)) {
    try {
      const parsed = JSON.parse(value) as RealtimeActivityRow
      if (!parsed || typeof parsed !== 'object') continue
      const exp = Date.parse(parsed.expiresAt)
      if (!Number.isFinite(exp) || exp <= now) {
        expiredFields.push(field)
        continue
      }
      out[field] = parsed
    } catch {
      continue
    }
  }
  return { activeState: prune(out), expiredFields }
}

async function cleanupExpiredRedisFields(expiredFields: string[], now = nowMs()): Promise<void> {
  if (now - lastRedisCleanupAt < REALTIME_ACTIVITY_REDIS_CLEANUP_INTERVAL_MS) return
  lastRedisCleanupAt = now
  if (expiredFields.length === 0) return
  await redisHDelMany(REALTIME_ACTIVITY_CACHE_KEY, expiredFields)
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
  if (fromRedisHash) {
    await redisPersist(REALTIME_ACTIVITY_CACHE_KEY)
    const parsed = parseHashState(fromRedisHash)
    memoryState = parsed.activeState
    await cleanupExpiredRedisFields(parsed.expiredFields)
  } else {
    memoryState = {}
  }
  memoryLoaded = true
  memoryLoadedAt = nowMs()
  return memoryState
}

async function saveState(state: RealtimeActivityState, _ttlSeconds: number): Promise<void> {
  memoryState = prune(state)
  memoryLoaded = true
  memoryLoadedAt = nowMs()

  if (await shouldUseRedisCache()) {
    for (const [field, row] of Object.entries(memoryState)) {
      await redisHSet(REALTIME_ACTIVITY_CACHE_KEY, field, JSON.stringify(row))
    }
    await redisPersist(REALTIME_ACTIVITY_CACHE_KEY)
  }
}

export async function upsertRealtimeActivity(
  row: Omit<RealtimeActivityRow, 'id'>,
  ttlSeconds: number,
): Promise<void> {
  const state = await loadState()
  const key = cacheKey(row.generatedHashKey, row.processName)
  const existingRow = state[key]
  const startedAt =
    existingRow && Number.isFinite(Date.parse(existingRow.startedAt))
      ? existingRow.startedAt
      : row.startedAt
  const nextRow = {
    ...row,
    startedAt,
    id:
      existingRow?.id ??
      `rt_${row.deviceId}_${Date.parse(row.updatedAt)}_${Math.random().toString(16).slice(2, 8)}`,
  }
  state[key] = nextRow
  memoryState = prune(state)
  memoryLoaded = true
  memoryLoadedAt = nowMs()
  if (await shouldUseRedisCache()) {
    await redisHSet(REALTIME_ACTIVITY_CACHE_KEY, key, JSON.stringify(nextRow))
    await redisPersist(REALTIME_ACTIVITY_CACHE_KEY)
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
    return
  }
  await saveState(prune(state), 60)
}

export async function listRealtimeActivities(): Promise<RealtimeActivityRow[]> {
  const state = await loadState()
  return Object.values(prune(state))
}
