import 'server-only'

import { randomUUID } from 'node:crypto'

import { inArray } from 'drizzle-orm'

import { shouldUseRedisCache } from '@/lib/cache-runtime-toggle'
import { db } from '@/lib/db'
import { activityAppHistory, activityPlaySourceHistory } from '@/lib/drizzle-schema'
import {
  redisHDelMany,
  redisHGetAll,
  redisHSetManyAndIncrWithExpire,
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

type PendingEntryBase = {
  seenAt: string
  sourceInstanceId: string
  expiresAt: string
}

type PendingAppHistory = PendingEntryBase & {
  kind: 'app'
  processName: string
  platform: Platform
  titles: string[]
}

type PendingPlaySourceHistory = PendingEntryBase & {
  kind: 'playSource'
  playSource: string
}

type PendingHistoryEntry = PendingAppHistory | PendingPlaySourceHistory

type FlushResult = {
  flushed: number
}

const PENDING_HASH_KEY = 'waken:activityHistory:pending:v1'
const FLUSH_LOCK_KEY = 'waken:activityHistory:flushLock:v1'
const ACTIVITY_HISTORY_INSTANCE_ID = randomUUID()

const MEMORY_FLUSH_INTERVAL_MS = 30_000
const MEMORY_FLUSH_MAX_ITEMS = 400
const REMOTE_FLUSH_LOCK_TTL_SECONDS = 30
const PENDING_ENTRY_TTL_MS = 3 * 24 * 60 * 60 * 1000

const memoryPending = new Map<string, PendingHistoryEntry>()
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

function normalizePlaySource(raw: unknown): string {
  return String(raw ?? '').trim().toLowerCase()
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

function asSqlDate(value: unknown): Date | string {
  if (value instanceof Date) return sqlDate(value)
  const t = Date.parse(String(value ?? ''))
  if (Number.isFinite(t)) return sqlDate(new Date(t))
  return sqlTimestamp()
}

function pendingField(entry: PendingHistoryEntry): string {
  if (entry.kind === 'app') {
    return `app:${entry.platform}:${entry.processName}`
  }
  return `play:${entry.playSource}`
}

function parsePendingField(
  field: string,
): { kind: 'app'; platform: Platform; key: string } | { kind: 'playSource'; key: string } | null {
  const trimmed = field.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('app:')) {
    const parts = trimmed.split(':')
    if (parts.length < 3) return null
    const platform = parts[1] === 'mobile' ? 'mobile' : parts[1] === 'pc' ? 'pc' : null
    if (!platform) return null
    const key = parts.slice(2).join(':').trim()
    if (!key) return null
    return { kind: 'app', platform, key }
  }

  if (trimmed.startsWith('play:')) {
    const key = trimmed.slice('play:'.length).trim()
    if (!key) return null
    return { kind: 'playSource', key }
  }

  return null
}

function parsePendingEntry(
  raw: string,
  field: string,
  nowMs = Date.now(),
): { entry: PendingHistoryEntry | null; expired: boolean } {
  const parsedField = parsePendingField(field)
  if (!parsedField) return { entry: null, expired: false }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { entry: null, expired: false }
    }

    const expiresAtMs = Date.parse(String(parsed.expiresAt ?? ''))
    const expired = Number.isFinite(expiresAtMs) && expiresAtMs <= nowMs
    const base = {
      seenAt: String(parsed.seenAt ?? ''),
      sourceInstanceId: String(parsed.sourceInstanceId ?? ''),
      expiresAt: String(parsed.expiresAt ?? ''),
    }

    if (parsedField.kind === 'app') {
      const processName = normalizeProcessName(String(parsed.processName ?? parsedField.key))
      if (!processName) return { entry: null, expired }
      const titles = Array.isArray(parsed.titles)
        ? parsed.titles
            .map((title) => normalizeTitle(title))
            .filter(Boolean)
            .slice(0, 3)
        : []
      return {
        entry: expired
          ? null
          : {
              ...base,
              kind: 'app',
              processName,
              platform: parsedField.platform,
              titles,
            },
        expired,
      }
    }

    const playSource = normalizePlaySource(parsed.playSource ?? parsedField.key)
    return {
      entry: expired || !playSource
        ? null
        : {
            ...base,
            kind: 'playSource',
            playSource,
          },
      expired,
    }
  } catch {
    return { entry: null, expired: false }
  }
}

function isSamePendingEntry(
  left: PendingHistoryEntry | null | undefined,
  right: PendingHistoryEntry | null | undefined,
): boolean {
  if (!left || !right) return false
  if (left.kind !== right.kind) return false
  if (left.seenAt !== right.seenAt) return false
  if (left.sourceInstanceId !== right.sourceInstanceId) return false
  if (left.expiresAt !== right.expiresAt) return false

  if (left.kind === 'app' && right.kind === 'app') {
    if (left.processName !== right.processName) return false
    if (left.platform !== right.platform) return false
    if (left.titles.length !== right.titles.length) return false
    return left.titles.every((title, index) => title === right.titles[index])
  }

  return left.kind === 'playSource' && right.kind === 'playSource' && left.playSource === right.playSource
}

function scheduleMemoryFlush(): void {
  if (memoryFlushTimer) return
  memoryFlushTimer = setTimeout(() => {
    memoryFlushTimer = null
    void flushMemoryPendingReportedActivityHistory().catch((error) => {
      console.error('[activity-history] memory flush failed:', error)
    })
  }, MEMORY_FLUSH_INTERVAL_MS)
}

async function captureEnabled(): Promise<boolean> {
  const cfg = await getSiteConfigMemoryFirst()
  return cfg?.captureReportedAppsEnabled !== false
}

async function writeAppPendingsToDb(entries: PendingAppHistory[]): Promise<number> {
  if (entries.length === 0) return 0

  const uniqueProcessNames = Array.from(new Set(entries.map((entry) => entry.processName)))
  const existingRows =
    uniqueProcessNames.length > 0
      ? await db
          .select({
            processName: activityAppHistory.processName,
            platformBuckets: activityAppHistory.platformBuckets,
            firstSeenAt: activityAppHistory.firstSeenAt,
            seenCount: activityAppHistory.seenCount,
          })
          .from(activityAppHistory)
          .where(inArray(activityAppHistory.processName, uniqueProcessNames))
      : []

  const existingMap = new Map<string, (typeof existingRows)[number]>()
  for (const row of existingRows) {
    existingMap.set(String(row.processName), row)
  }

  let flushed = 0
  for (const entry of entries) {
    const now = new Date()
    const seenAt = (() => {
      const t = Date.parse(String(entry.seenAt || ''))
      return Number.isFinite(t) ? new Date(t) : now
    })()
    const seenAtIso = seenAt.toISOString()
    const existing = existingMap.get(entry.processName)
    const merged = mergeBuckets(
      parseBuckets(existing?.platformBuckets),
      entry.platform,
      entry.titles,
      seenAtIso,
    )
    const platformBucketsValue = toDbJsonValue(merged)
    const firstSeenAt = existing?.firstSeenAt ?? now
    const seenCount = (existing?.seenCount ?? 0) + 1

    await db
      .insert(activityAppHistory)
      .values({
        processName: entry.processName,
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

    existingMap.set(entry.processName, {
      processName: entry.processName,
      platformBuckets: merged,
      firstSeenAt,
      seenCount,
    })
    flushed += 1
  }

  return flushed
}

async function writePlaySourcePendingsToDb(entries: PendingPlaySourceHistory[]): Promise<number> {
  if (entries.length === 0) return 0

  const uniquePlaySources = Array.from(new Set(entries.map((entry) => entry.playSource)))
  const existingRows =
    uniquePlaySources.length > 0
      ? await db
          .select({
            playSource: activityPlaySourceHistory.playSource,
            firstSeenAt: activityPlaySourceHistory.firstSeenAt,
            seenCount: activityPlaySourceHistory.seenCount,
          })
          .from(activityPlaySourceHistory)
          .where(inArray(activityPlaySourceHistory.playSource, uniquePlaySources))
      : []

  const existingMap = new Map<string, (typeof existingRows)[number]>()
  for (const row of existingRows) {
    existingMap.set(String(row.playSource), row)
  }

  let flushed = 0
  for (const entry of entries) {
    const now = new Date()
    const seenAt = (() => {
      const t = Date.parse(String(entry.seenAt || ''))
      return Number.isFinite(t) ? new Date(t) : now
    })()
    const existing = existingMap.get(entry.playSource)
    const firstSeenAt = existing?.firstSeenAt ?? now
    const seenCount = (existing?.seenCount ?? 0) + 1

    await db
      .insert(activityPlaySourceHistory)
      .values({
        playSource: entry.playSource,
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

    existingMap.set(entry.playSource, {
      playSource: entry.playSource,
      firstSeenAt,
      seenCount,
    })
    flushed += 1
  }

  return flushed
}

async function flushEntriesToDb(entries: PendingHistoryEntry[]): Promise<number> {
  if (entries.length === 0) return 0

  const appEntries: PendingAppHistory[] = []
  const playSourceEntries: PendingPlaySourceHistory[] = []
  for (const entry of entries) {
    if (entry.kind === 'app') {
      appEntries.push(entry)
    } else {
      playSourceEntries.push(entry)
    }
  }

  const appFlushed = await writeAppPendingsToDb(appEntries)
  const playSourceFlushed = await writePlaySourcePendingsToDb(playSourceEntries)

  return appFlushed + playSourceFlushed
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
