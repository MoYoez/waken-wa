import 'server-only'

import { shouldUseRedisCache } from '@/lib/cache-runtime-toggle'
import { getReportedScreenState } from '@/lib/lockapp-reporter'
import {
  redisHDel,
  redisHDelMany,
  redisHGetAll,
  redisHSet,
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
type RealtimeActivityMemory = {
  state: RealtimeActivityState
  loaded: boolean
  loadedAt: number
  lastRedisCleanupAt: number
}

const REDIS_REFRESH_INTERVAL_MS = 1000

declare global {
  var __wakenRealtimeActivityMemory: RealtimeActivityMemory | undefined
}

function getMemory(): RealtimeActivityMemory {
  if (!globalThis.__wakenRealtimeActivityMemory) {
    globalThis.__wakenRealtimeActivityMemory = {
      state: {},
      loaded: false,
      loadedAt: 0,
      lastRedisCleanupAt: 0,
    }
  }
  return globalThis.__wakenRealtimeActivityMemory
}

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
  const memory = getMemory()
  if (now - memory.lastRedisCleanupAt < REALTIME_ACTIVITY_REDIS_CLEANUP_INTERVAL_MS) return
  memory.lastRedisCleanupAt = now
  if (expiredFields.length === 0) return
  await redisHDelMany(REALTIME_ACTIVITY_CACHE_KEY, expiredFields)
}

async function loadState(refresh = false): Promise<RealtimeActivityState> {
  const memory = getMemory()
  memory.state = prune(memory.state)
  const useRedis = await shouldUseRedisCache()
  if (!useRedis) {
    if (!memory.loaded) {
      memory.loaded = true
      memory.loadedAt = nowMs()
    }
    return memory.state
  }

  if (!refresh && memory.loaded && nowMs() - memory.loadedAt < REDIS_REFRESH_INTERVAL_MS) {
    return memory.state
  }

  const fromRedisHash = await redisHGetAll(REALTIME_ACTIVITY_CACHE_KEY)
  if (fromRedisHash) {
    const parsed = parseHashState(fromRedisHash)
    memory.state = parsed.activeState
    await cleanupExpiredRedisFields(parsed.expiredFields)
  } else {
    memory.state = {}
  }
  memory.loaded = true
  memory.loadedAt = nowMs()
  return memory.state
}

async function saveState(state: RealtimeActivityState, _ttlSeconds: number): Promise<void> {
  const memory = getMemory()
  memory.state = prune(state)
  memory.loaded = true
  memory.loadedAt = nowMs()

  if (await shouldUseRedisCache()) {
    for (const [field, row] of Object.entries(memory.state)) {
      await redisHSet(REALTIME_ACTIVITY_CACHE_KEY, field, JSON.stringify(row))
    }
  }
}

export async function upsertRealtimeActivity(
  row: Omit<RealtimeActivityRow, 'id'>,
  ttlSeconds: number,
): Promise<void> {
  if (getReportedScreenState(row.metadata) !== null) {
    await removeRealtimeActivitiesForDevice(row.generatedHashKey, row.processName)
  }
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
  const memory = getMemory()
  memory.state = prune(state)
  memory.loaded = true
  memory.loadedAt = nowMs()
  if (await shouldUseRedisCache()) {
    await redisHSet(REALTIME_ACTIVITY_CACHE_KEY, key, JSON.stringify(nextRow))
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
  const memory = getMemory()
  memory.state = prune(state)
  memory.loaded = true
  memory.loadedAt = nowMs()
  if (await shouldUseRedisCache()) {
    await redisHDel(REALTIME_ACTIVITY_CACHE_KEY, key)
    return
  }
  await saveState(prune(state), 60)
}

/** Remove superseded device slots from both memory and Redis, regardless of their TTL. */
export async function removeRealtimeActivitiesForDevice(
  generatedHashKey: string,
  keepProcessName?: string,
): Promise<void> {
  const state = await loadState(true)
  const keepKey = keepProcessName === undefined ? null : cacheKey(generatedHashKey, keepProcessName)
  const removedKeys = Object.keys(state).filter(
    (key) => state[key].generatedHashKey === generatedHashKey && key !== keepKey,
  )
  for (const key of removedKeys) {
    delete state[key]
  }
  if (await shouldUseRedisCache()) {
    await redisHDelMany(REALTIME_ACTIVITY_CACHE_KEY, removedKeys)
  }
}

export async function listRealtimeActivities(): Promise<RealtimeActivityRow[]> {
  const state = await loadState()
  return Object.values(prune(state))
}
