import 'server-only'

import {
  ACTIVITY_HISTORY_INSTANCE_ID,
  FLUSH_LOCK_KEY,
  MEMORY_FLUSH_INTERVAL_MS,
  MEMORY_FLUSH_MAX_ITEMS,
  PENDING_ENTRY_TTL_MS,
  PENDING_HASH_KEY,
  REMOTE_FLUSH_LOCK_TTL_SECONDS,
} from '@/lib/activity-history-pending/constants'
import {
  bumpRecentTitles,
  isSamePendingEntry,
  normalizePlaySource,
  normalizeProcessName,
  normalizeTitle,
  parsePendingEntry,
  pendingField,
  platformFromDeviceType,
} from '@/lib/activity-history-pending/helpers'
import {
  captureEnabled,
  flushEntriesToDb,
} from '@/lib/activity-history-pending/persistence'
import { memoryPending } from '@/lib/activity-history-pending/state'
import type {
  FlushResult,
  PendingHistoryEntry,
} from '@/lib/activity-history-pending/types'
import { shouldUseRedisCache } from '@/lib/cache-runtime-toggle'
import {
  redisHDelMany,
  redisHGetAll,
  redisHSetManyAndIncrWithExpire,
} from '@/lib/redis-client'

let memoryFlushTimer: NodeJS.Timeout | null = null

function scheduleMemoryFlush(): void {
  if (memoryFlushTimer) return
  memoryFlushTimer = setTimeout(() => {
    memoryFlushTimer = null
    void flushMemoryPendingReportedActivityHistory().catch((error) => {
      console.error('[activity-history] memory flush failed:', error)
    })
  }, MEMORY_FLUSH_INTERVAL_MS)
}

async function flushMemoryPendingReportedActivityHistory(): Promise<FlushResult> {
  if (memoryPending.size === 0) return { flushed: 0 }

  const batch: PendingHistoryEntry[] = []
  const batchFields: string[] = []
  for (const [field, entry] of memoryPending.entries()) {
    batchFields.push(field)
    batch.push(entry)
    if (batch.length >= MEMORY_FLUSH_MAX_ITEMS) break
  }

  for (const field of batchFields) {
    memoryPending.delete(field)
  }

  const useRedis = await shouldUseRedisCache()
  const mirroredRaw = useRedis ? await redisHGetAll(PENDING_HASH_KEY) : null
  const flushed = await flushEntriesToDb(batch)

  if (mirroredRaw) {
    const fieldsToDelete: string[] = []
    for (const entry of batch) {
      const field = pendingField(entry)
      const raw = mirroredRaw[field]
      if (!raw) continue
      const parsed = parsePendingEntry(raw, field)
      if (parsed.expired || isSamePendingEntry(parsed.entry, entry)) {
        fieldsToDelete.push(field)
      }
    }
    if (fieldsToDelete.length > 0) {
      await redisHDelMany(PENDING_HASH_KEY, fieldsToDelete)
    }
  }

  if (memoryPending.size > 0) {
    scheduleMemoryFlush()
  }

  return { flushed }
}

export async function recordReportedActivityHistory(input: {
  processName?: string
  processTitle?: unknown
  deviceType?: unknown
  playSource?: unknown
}): Promise<void> {
  if (!(await captureEnabled())) return

  const now = Date.now()
  const seenAtIso = new Date(now).toISOString()
  const expiresAtIso = new Date(now + PENDING_ENTRY_TTL_MS).toISOString()
  const nextEntries: PendingHistoryEntry[] = []

  const processName = normalizeProcessName(String(input.processName ?? ''))
  if (processName) {
    const platform = platformFromDeviceType(input.deviceType)
    const title = normalizeTitle(input.processTitle)
    const field = `app:${platform}:${processName}`
    const prev = memoryPending.get(field)
    const prevTitles = prev?.kind === 'app' ? prev.titles : []
    nextEntries.push({
      kind: 'app',
      processName,
      platform,
      seenAt: seenAtIso,
      sourceInstanceId: ACTIVITY_HISTORY_INSTANCE_ID,
      expiresAt: expiresAtIso,
      titles: bumpRecentTitles(prevTitles, title),
    })
  }

  const playSource = normalizePlaySource(input.playSource)
  if (playSource) {
    nextEntries.push({
      kind: 'playSource',
      playSource,
      seenAt: seenAtIso,
      sourceInstanceId: ACTIVITY_HISTORY_INSTANCE_ID,
      expiresAt: expiresAtIso,
    })
  }

  if (nextEntries.length === 0) return

  const redisUpdates: Record<string, string> = {}
  for (const entry of nextEntries) {
    const field = pendingField(entry)
    memoryPending.set(field, entry)
    redisUpdates[field] = JSON.stringify(entry)
  }
  scheduleMemoryFlush()

  if (!(await shouldUseRedisCache())) return

  const lock = await redisHSetManyAndIncrWithExpire(
    PENDING_HASH_KEY,
    redisUpdates,
    FLUSH_LOCK_KEY,
    REMOTE_FLUSH_LOCK_TTL_SECONDS,
  )
  if (lock === 1) {
    await flushPendingReportedActivityHistory({ maxEntries: 300 })
  }
}

export async function recordReportedAppHistory(input: {
  processName: string
  processTitle?: unknown
  deviceType?: unknown
}): Promise<void> {
  await recordReportedActivityHistory(input)
}

export async function recordReportedPlaySourceHistory(input: {
  playSource?: unknown
}): Promise<void> {
  await recordReportedActivityHistory(input)
}

export async function flushPendingReportedActivityHistory(options?: {
  maxEntries?: number
}): Promise<FlushResult> {
  const mem = await flushMemoryPendingReportedActivityHistory().catch(() => ({ flushed: 0 }))

  if (!(await shouldUseRedisCache())) return mem

  const fromRedis = await redisHGetAll(PENDING_HASH_KEY)
  if (!fromRedis || Object.keys(fromRedis).length === 0) {
    return mem
  }

  const nowMs = Date.now()
  const remoteEntries: Array<{ field: string; entry: PendingHistoryEntry }> = []
  const expiredFields: string[] = []
  for (const [field, raw] of Object.entries(fromRedis)) {
    const parsed = parsePendingEntry(raw, field, nowMs)
    if (parsed.expired) {
      expiredFields.push(field)
      continue
    }
    if (!parsed.entry) continue
    if (parsed.entry.sourceInstanceId === ACTIVITY_HISTORY_INSTANCE_ID) continue
    remoteEntries.push({ field, entry: parsed.entry })
    if (remoteEntries.length >= (options?.maxEntries ?? 500)) break
  }

  if (expiredFields.length > 0) {
    await redisHDelMany(PENDING_HASH_KEY, expiredFields)
  }

  if (remoteEntries.length === 0) return mem

  const flushed = await flushEntriesToDb(remoteEntries.map((item) => item.entry))
  await redisHDelMany(PENDING_HASH_KEY, remoteEntries.map((item) => item.field))

  return { flushed: flushed + mem.flushed }
}

export async function flushPendingReportedAppHistory(options?: {
  maxKeys?: number
}): Promise<FlushResult> {
  return flushPendingReportedActivityHistory({ maxEntries: options?.maxKeys })
}

export async function flushPendingReportedPlaySourceHistory(options?: {
  maxKeys?: number
}): Promise<FlushResult> {
  return flushPendingReportedActivityHistory({ maxEntries: options?.maxKeys })
}

export type { AppHistoryBuckets } from '@/lib/activity-history-pending/types'
