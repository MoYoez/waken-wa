import 'server-only'

import { randomUUID } from 'node:crypto'

import { eq, inArray } from 'drizzle-orm'

import { shouldUseRedisCache } from '@/lib/cache-runtime-toggle'
import { db } from '@/lib/db'
import { activityAppHistory } from '@/lib/drizzle-schema'
import {
  redisDel,
  redisGetJson,
  redisIncrWithExpire,
  redisListKeysByPrefix,
  redisSetJson,
} from '@/lib/redis-client'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import { sqlDate, sqlTimestamp } from '@/lib/sql-timestamp'
import { toDbJsonValue } from '@/lib/sqlite-json'

type Platform = 'pc' | 'mobile'

type PlatformBucket = {
  titles: string[]
  lastSeenAt: string | null
}

export type AppHistoryBuckets = {
  pc?: PlatformBucket
  mobile?: PlatformBucket
}

type PendingAppHistory = {
  processName: string
  platform: Platform
  seenAt: string
  titles: string[]
  sourceInstanceId: string
}

const PENDING_PREFIX = 'waken:appHistory:pending:v1:'
const FLUSH_LOCK_KEY = 'waken:appHistory:flushLock:v1'
const APP_HISTORY_INSTANCE_ID = randomUUID()

const MEMORY_FLUSH_INTERVAL_MS = 30_000
const MEMORY_FLUSH_MAX_ITEMS = 400
const memoryPending = new Map<string, PendingAppHistory>()
let memoryFlushTimer: NodeJS.Timeout | null = null

function normalizeProcessName(raw: string): string {
  return raw.trim().toLowerCase()
}

function normalizeTitle(raw: unknown): string {
  return String(raw ?? '').trim()
}

function platformFromDeviceType(deviceTypeRaw: unknown): Platform {
  const t = String(deviceTypeRaw ?? '').trim().toLowerCase()
  if (t === 'mobile' || t === 'tablet') return 'mobile'
  return 'pc'
}

function bumpRecentTitles(existing: string[], nextTitle: string): string[] {
  const t = nextTitle.trim()
  if (!t) return existing.slice(0, 3)
  const out: string[] = [t]
  for (const s of existing) {
    if (!s) continue
    if (s.toLowerCase() === t.toLowerCase()) continue
    out.push(s)
    if (out.length >= 3) break
  }
  return out
}

function pendingKey(platform: Platform, processName: string): string {
  return `${PENDING_PREFIX}${platform}:${processName}`
}

function memoryPendingKey(platform: Platform, processName: string): string {
  return `${platform}:${processName}`
}

function scheduleMemoryFlush(): void {
  if (memoryFlushTimer) return
  memoryFlushTimer = setTimeout(() => {
    memoryFlushTimer = null
    void flushMemoryPendingReportedAppHistory().catch((error) => {
      console.error('[activity-app-history] memory flush failed:', error)
    })
  }, MEMORY_FLUSH_INTERVAL_MS)
}

function asSqlDate(value: unknown): Date | string {
  if (value instanceof Date) return sqlDate(value)
  const t = Date.parse(String(value ?? ''))
  if (Number.isFinite(t)) return sqlDate(new Date(t))
  return sqlTimestamp()
}

function mergeBuckets(
  prev: AppHistoryBuckets | null | undefined,
  platform: Platform,
  titles: string[],
  seenAtIso: string,
): AppHistoryBuckets {
  const safePrev = prev && typeof prev === 'object' && !Array.isArray(prev) ? prev : {}
  const curBucket =
    (platform === 'pc' ? safePrev.pc : safePrev.mobile) ?? { titles: [], lastSeenAt: null }
  const nextBucket: PlatformBucket = {
    titles: titles.length > 0 ? titles.slice(0, 3) : curBucket.titles.slice(0, 3),
    lastSeenAt: seenAtIso || curBucket.lastSeenAt || null,
  }
  return {
    ...(safePrev as AppHistoryBuckets),
    [platform]: nextBucket,
  }
}

function parseBuckets(raw: unknown): AppHistoryBuckets | null {
  if (!raw) return null
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as AppHistoryBuckets
      }
      return null
    } catch {
      return null
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as AppHistoryBuckets
  return null
}

function isSamePendingRecord(
  left: PendingAppHistory | null | undefined,
  right: PendingAppHistory | null | undefined,
): boolean {
  if (!left || !right) return false
  if (left.processName !== right.processName) return false
  if (left.platform !== right.platform) return false
  if (left.seenAt !== right.seenAt) return false
  if (left.sourceInstanceId !== right.sourceInstanceId) return false
  if (left.titles.length !== right.titles.length) return false
  return left.titles.every((title, index) => title === right.titles[index])
}

async function writeToDb(
  processName: string,
  platform: Platform,
  titles: string[],
  seenAtIso: string,
): Promise<void> {
  const now = new Date()
  const seenAt = (() => {
    const t = Date.parse(String(seenAtIso || ''))
    return Number.isFinite(t) ? new Date(t) : now
  })()
  const nowIso = seenAt.toISOString()
  const [existing] = await db
    .select({
      processName: activityAppHistory.processName,
      platformBuckets: activityAppHistory.platformBuckets,
      firstSeenAt: activityAppHistory.firstSeenAt,
      seenCount: activityAppHistory.seenCount,
    })
    .from(activityAppHistory)
    .where(eq(activityAppHistory.processName, processName))
    .limit(1)

  const merged = mergeBuckets(
    parseBuckets(existing?.platformBuckets),
    platform,
    titles,
    nowIso,
  )
  const platformBucketsValue = toDbJsonValue(merged)

  const firstSeenAt = existing?.firstSeenAt ?? now
  const seenCount = (existing?.seenCount ?? 0) + 1

  await db
    .insert(activityAppHistory)
    .values({
      processName,
      platformBuckets: platformBucketsValue as any,
      firstSeenAt: asSqlDate(firstSeenAt),
      lastSeenAt: sqlDate(seenAt),
      seenCount,
      updatedAt: sqlTimestamp(),
    } as any)
    .onConflictDoUpdate({
      target: activityAppHistory.processName,
      set: {
        platformBuckets: platformBucketsValue as any,
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

async function flushMemoryPendingReportedAppHistory(): Promise<{ flushed: number }> {
  if (memoryPending.size === 0) return { flushed: 0 }

  const batch: PendingAppHistory[] = []
  for (const v of memoryPending.values()) {
    batch.push(v)
    if (batch.length >= MEMORY_FLUSH_MAX_ITEMS) break
  }
  for (const p of batch) {
    memoryPending.delete(memoryPendingKey(p.platform, p.processName))
  }

  let flushed = 0
  for (const p of batch) {
    await writeToDb(p.processName, p.platform, p.titles, p.seenAt)
    if (await shouldUseRedisCache()) {
      const redisKey = pendingKey(p.platform, p.processName)
      const mirrored = await redisGetJson<PendingAppHistory>(redisKey)
      if (isSamePendingRecord(mirrored, p)) {
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

export async function recordReportedAppHistory(input: {
  processName: string
  processTitle?: unknown
  deviceType?: unknown
}): Promise<void> {
  if (!(await captureEnabled())) return
  const processName = normalizeProcessName(input.processName)
  if (!processName) return
  const platform = platformFromDeviceType(input.deviceType)
  const title = normalizeTitle(input.processTitle)
  const seenAtIso = new Date().toISOString()
  const memoryKey = memoryPendingKey(platform, processName)
  const prev = memoryPending.get(memoryKey)
  const nextTitles = bumpRecentTitles(prev?.titles ?? [], title)
  const nextPending: PendingAppHistory = {
    processName,
    platform,
    seenAt: seenAtIso,
    titles: nextTitles,
    sourceInstanceId: APP_HISTORY_INSTANCE_ID,
  }

  memoryPending.set(memoryKey, nextPending)
  scheduleMemoryFlush()

  const useRedis = await shouldUseRedisCache()
  if (!useRedis) {
    return
  }

  const redisKey = pendingKey(platform, processName)
  // Mirror pending entries to Redis for cross-instance continuity.
  await redisSetJson(redisKey, nextPending, 60 * 60 * 24 * 3)

  // Best-effort: allow only one flusher per ~30s window.
  const lock = await redisIncrWithExpire(FLUSH_LOCK_KEY, 30)
  if (lock === 1) {
    await flushPendingReportedAppHistory({ maxKeys: 300 })
  }
}

export async function flushPendingReportedAppHistory(options?: {
  maxKeys?: number
}): Promise<{ flushed: number }> {
  // Always flush memory pendings first (best-effort).
  const mem = await flushMemoryPendingReportedAppHistory().catch(() => ({ flushed: 0 }))

  const useRedis = await shouldUseRedisCache()
  if (!useRedis) return { flushed: mem.flushed }

  const keys = await redisListKeysByPrefix(PENDING_PREFIX, options?.maxKeys ?? 500)
  if (keys.length === 0) return { flushed: mem.flushed }

  const pendings: PendingAppHistory[] = []
  for (const key of keys) {
    const p = await redisGetJson<PendingAppHistory>(key)
    if (
      p?.processName &&
      (p.platform === 'pc' || p.platform === 'mobile') &&
      p.sourceInstanceId !== APP_HISTORY_INSTANCE_ID
    ) {
      pendings.push(p)
    }
  }
  if (pendings.length === 0) return { flushed: mem.flushed }

  // Merge by processName to minimize DB reads.
  const uniqueProcess = Array.from(new Set(pendings.map((p) => p.processName)))
  const existingRows = await db
    .select({
      processName: activityAppHistory.processName,
      platformBuckets: activityAppHistory.platformBuckets,
      firstSeenAt: activityAppHistory.firstSeenAt,
      seenCount: activityAppHistory.seenCount,
    })
    .from(activityAppHistory)
    .where(inArray(activityAppHistory.processName, uniqueProcess))
  const existingMap = new Map<string, (typeof existingRows)[number]>()
  for (const r of existingRows) existingMap.set(String(r.processName), r)

  let flushed = 0
  for (const p of pendings) {
    const now = new Date()
    const seenAt = (() => {
      const t = Date.parse(String(p.seenAt || ''))
      return Number.isFinite(t) ? new Date(t) : now
    })()
    const ex = existingMap.get(p.processName)
    const merged = mergeBuckets(
      parseBuckets(ex?.platformBuckets),
      p.platform,
      p.titles,
      p.seenAt,
    )
    const platformBucketsValue = toDbJsonValue(merged)
    const firstSeenAt = ex?.firstSeenAt ?? now
    const seenCount = (ex?.seenCount ?? 0) + 1

    await db
      .insert(activityAppHistory)
      .values({
        processName: p.processName,
        platformBuckets: platformBucketsValue as any,
        firstSeenAt: asSqlDate(firstSeenAt),
        lastSeenAt: sqlDate(seenAt),
        seenCount,
        updatedAt: sqlTimestamp(),
      } as any)
      .onConflictDoUpdate({
        target: activityAppHistory.processName,
        set: {
          platformBuckets: platformBucketsValue as any,
          lastSeenAt: sqlDate(seenAt),
          seenCount,
          updatedAt: sqlTimestamp(),
        } as any,
      })
    flushed += 1
  }

  // Delete keys after successful flush. This is best-effort.
  for (const key of keys) {
    await redisDel(key)
  }

  return { flushed: flushed + mem.flushed }
}
