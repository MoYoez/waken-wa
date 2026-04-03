import 'server-only'

import { randomUUID } from 'node:crypto'

import { eq, inArray } from 'drizzle-orm'

import { shouldUseRedisCache } from '@/lib/cache-runtime-toggle'
import { db } from '@/lib/db'
import { activityPlaySourceHistory } from '@/lib/drizzle-schema'
import {
  redisDel,
  redisGetJson,
  redisIncrWithExpire,
  redisListKeysByPrefix,
  redisSetJson,
} from '@/lib/redis-client'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import { sqlDate, sqlTimestamp } from '@/lib/sql-timestamp'

type PendingPlaySourceHistory = {
  playSource: string
  seenAt: string
  sourceInstanceId: string
}

const PENDING_PREFIX = 'waken:playSourceHistory:pending:v1:'
const FLUSH_LOCK_KEY = 'waken:playSourceHistory:flushLock:v1'
const PLAY_SOURCE_HISTORY_INSTANCE_ID = randomUUID()

const MEMORY_FLUSH_INTERVAL_MS = 30_000
const MEMORY_FLUSH_MAX_ITEMS = 400
const memoryPending = new Map<string, PendingPlaySourceHistory>()
let memoryFlushTimer: NodeJS.Timeout | null = null

function normalizePlaySource(raw: unknown): string {
  return String(raw ?? '').trim().toLowerCase()
}

function pendingKey(playSource: string): string {
  return `${PENDING_PREFIX}${playSource}`
}

function scheduleMemoryFlush(): void {
  if (memoryFlushTimer) return
  memoryFlushTimer = setTimeout(() => {
    memoryFlushTimer = null
    void flushPendingReportedPlaySourceHistory().catch((error) => {
      console.error('[activity-play-source-history] memory flush failed:', error)
    })
  }, MEMORY_FLUSH_INTERVAL_MS)
}

function asSqlDate(value: unknown): Date | string {
  if (value instanceof Date) return sqlDate(value)
  const t = Date.parse(String(value ?? ''))
  if (Number.isFinite(t)) return sqlDate(new Date(t))
  return sqlTimestamp()
}

function isSamePendingRecord(
  left: PendingPlaySourceHistory | null | undefined,
  right: PendingPlaySourceHistory | null | undefined,
): boolean {
  if (!left || !right) return false
  return (
    left.playSource === right.playSource &&
    left.seenAt === right.seenAt &&
    left.sourceInstanceId === right.sourceInstanceId
  )
}

async function writeToDb(playSource: string, seenAtIso: string): Promise<void> {
  const now = new Date()
  const seenAt = (() => {
    const t = Date.parse(String(seenAtIso || ''))
    return Number.isFinite(t) ? new Date(t) : now
  })()
  const [existing] = await db
    .select({
      playSource: activityPlaySourceHistory.playSource,
      firstSeenAt: activityPlaySourceHistory.firstSeenAt,
      seenCount: activityPlaySourceHistory.seenCount,
    })
    .from(activityPlaySourceHistory)
    .where(eq(activityPlaySourceHistory.playSource, playSource))
    .limit(1)

  const firstSeenAt = existing?.firstSeenAt ?? now
  const seenCount = (existing?.seenCount ?? 0) + 1

  await db
    .insert(activityPlaySourceHistory)
    .values({
      playSource,
      firstSeenAt: asSqlDate(firstSeenAt),
      lastSeenAt: sqlDate(seenAt),
      seenCount,
      updatedAt: sqlTimestamp(),
    } as any)
    .onConflictDoUpdate({
      target: activityPlaySourceHistory.playSource,
      set: {
        lastSeenAt: sqlDate(seenAt),
        seenCount,
        updatedAt: sqlTimestamp(),
      } as any,
    })
}

async function captureEnabled(): Promise<boolean> {
  const cfg = await getSiteConfigMemoryFirst()
  return cfg?.captureReportedAppsEnabled !== false
}

async function flushMemoryPendingReportedPlaySourceHistory(): Promise<{ flushed: number }> {
  if (memoryPending.size === 0) return { flushed: 0 }

  const batch: PendingPlaySourceHistory[] = []
  for (const value of memoryPending.values()) {
    batch.push(value)
    if (batch.length >= MEMORY_FLUSH_MAX_ITEMS) break
  }
  for (const pending of batch) {
    memoryPending.delete(pending.playSource)
  }

  let flushed = 0
  for (const pending of batch) {
    await writeToDb(pending.playSource, pending.seenAt)
    if (await shouldUseRedisCache()) {
      const redisKey = pendingKey(pending.playSource)
      const mirrored = await redisGetJson<PendingPlaySourceHistory>(redisKey)
      if (isSamePendingRecord(mirrored, pending)) {
        await redisDel(redisKey)
      }
    }
    flushed += 1
  }

  if (memoryPending.size > 0) {
    scheduleMemoryFlush()
  }
  return { flushed }
}

export async function recordReportedPlaySourceHistory(input: {
  playSource?: unknown
}): Promise<void> {
  if (!(await captureEnabled())) return
  const playSource = normalizePlaySource(input.playSource)
  if (!playSource) return

  const nextPending: PendingPlaySourceHistory = {
    playSource,
    seenAt: new Date().toISOString(),
    sourceInstanceId: PLAY_SOURCE_HISTORY_INSTANCE_ID,
  }

  memoryPending.set(playSource, nextPending)
  scheduleMemoryFlush()

  const useRedis = await shouldUseRedisCache()
  if (!useRedis) return

  const redisKey = pendingKey(playSource)
  await redisSetJson(redisKey, nextPending, 60 * 60 * 24 * 3)

  const lock = await redisIncrWithExpire(FLUSH_LOCK_KEY, 30)
  if (lock === 1) {
    await flushPendingReportedPlaySourceHistory({ maxKeys: 300 })
  }
}

export async function flushPendingReportedPlaySourceHistory(options?: {
  maxKeys?: number
}): Promise<{ flushed: number }> {
  const mem = await flushMemoryPendingReportedPlaySourceHistory().catch(() => ({ flushed: 0 }))

  const useRedis = await shouldUseRedisCache()
  if (!useRedis) return { flushed: mem.flushed }

  const keys = await redisListKeysByPrefix(PENDING_PREFIX, options?.maxKeys ?? 500)
  if (keys.length === 0) return { flushed: mem.flushed }

  const pendings: PendingPlaySourceHistory[] = []
  for (const key of keys) {
    const pending = await redisGetJson<PendingPlaySourceHistory>(key)
    if (
      pending?.playSource &&
      pending.sourceInstanceId !== PLAY_SOURCE_HISTORY_INSTANCE_ID
    ) {
      pendings.push(pending)
    }
  }
  if (pendings.length === 0) return { flushed: mem.flushed }

  const uniquePlaySources = Array.from(new Set(pendings.map((pending) => pending.playSource)))
  const existingRows = await db
    .select({
      playSource: activityPlaySourceHistory.playSource,
      firstSeenAt: activityPlaySourceHistory.firstSeenAt,
      seenCount: activityPlaySourceHistory.seenCount,
    })
    .from(activityPlaySourceHistory)
    .where(inArray(activityPlaySourceHistory.playSource, uniquePlaySources))
  const existingMap = new Map<string, (typeof existingRows)[number]>()
  for (const row of existingRows) existingMap.set(String(row.playSource), row)

  let flushed = 0
  for (const pending of pendings) {
    const now = new Date()
    const seenAt = (() => {
      const t = Date.parse(String(pending.seenAt || ''))
      return Number.isFinite(t) ? new Date(t) : now
    })()
    const existing = existingMap.get(pending.playSource)
    const firstSeenAt = existing?.firstSeenAt ?? now
    const seenCount = (existing?.seenCount ?? 0) + 1

    await db
      .insert(activityPlaySourceHistory)
      .values({
        playSource: pending.playSource,
        firstSeenAt: asSqlDate(firstSeenAt),
        lastSeenAt: sqlDate(seenAt),
        seenCount,
        updatedAt: sqlTimestamp(),
      } as any)
      .onConflictDoUpdate({
        target: activityPlaySourceHistory.playSource,
        set: {
          lastSeenAt: sqlDate(seenAt),
          seenCount,
          updatedAt: sqlTimestamp(),
        } as any,
      })
    flushed += 1
  }

  for (const key of keys) {
    await redisDel(key)
  }

  return { flushed: flushed + mem.flushed }
}
