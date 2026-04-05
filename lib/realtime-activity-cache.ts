import 'server-only'

import { shouldUseRedisCache } from '@/lib/cache-runtime-toggle'
import { redisGetJson, redisSetJson } from '@/lib/redis-client'

const REALTIME_ACTIVITY_CACHE_KEY = 'waken:activity:realtime:v1'

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

  const fromRedis = await redisGetJson<RealtimeActivityState>(REALTIME_ACTIVITY_CACHE_KEY)
  memoryState = prune(fromRedis ?? {})
  memoryLoaded = true
  memoryLoadedAt = nowMs()
  return memoryState
}

async function saveState(state: RealtimeActivityState, ttlSeconds: number): Promise<void> {
  memoryState = prune(state)
  memoryLoaded = true
  memoryLoadedAt = nowMs()

  if (await shouldUseRedisCache()) {
    const safeTtl = Math.max(1, Math.round(ttlSeconds))
    await redisSetJson(REALTIME_ACTIVITY_CACHE_KEY, memoryState, safeTtl)
  }
}

export async function upsertRealtimeActivity(
  row: Omit<RealtimeActivityRow, 'id'>,
  ttlSeconds: number,
): Promise<void> {
  const state = await loadState()
  const key = cacheKey(row.generatedHashKey, row.processName)
  state[key] = {
    ...row,
    id: `rt_${row.deviceId}_${Date.parse(row.updatedAt)}_${Math.random().toString(16).slice(2, 8)}`,
  }
  await saveState(prune(state), Math.max(ttlSeconds, 5))
}

export async function removeRealtimeActivity(
  generatedHashKey: string,
  processName: string,
): Promise<void> {
  const state = await loadState()
  delete state[cacheKey(generatedHashKey, processName)]
  await saveState(prune(state), 60)
}

export async function listRealtimeActivities(): Promise<RealtimeActivityRow[]> {
  const state = await loadState()
  return Object.values(prune(state))
}
