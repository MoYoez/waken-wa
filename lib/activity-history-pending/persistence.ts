import { inArray } from 'drizzle-orm'

import {
  asSqlDate,
  mergeBuckets,
  parseBuckets,
} from '@/lib/activity-history-pending/helpers'
import type {
  PendingAppHistory,
  PendingHistoryEntry,
  PendingPlaySourceHistory,
} from '@/lib/activity-history-pending/types'
import { db } from '@/lib/db'
import { activityAppHistory, activityPlaySourceHistory } from '@/lib/drizzle-schema'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import { sqlDate, sqlTimestamp } from '@/lib/sql-timestamp'
import { toDbJsonValue } from '@/lib/sqlite-json'

export async function captureEnabled(): Promise<boolean> {
  const cfg = await getSiteConfigMemoryFirst()
  return cfg?.captureReportedAppsEnabled !== false
}

export async function writeAppPendingsToDb(entries: PendingAppHistory[]): Promise<number> {
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
      const time = Date.parse(String(entry.seenAt || ''))
      return Number.isFinite(time) ? new Date(time) : now
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

export async function writePlaySourcePendingsToDb(
  entries: PendingPlaySourceHistory[],
): Promise<number> {
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
      const time = Date.parse(String(entry.seenAt || ''))
      return Number.isFinite(time) ? new Date(time) : now
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

export async function flushEntriesToDb(entries: PendingHistoryEntry[]): Promise<number> {
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
