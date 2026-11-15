import 'server-only'

import { and, count, desc, eq, gte, lte, sql } from 'drizzle-orm'

import {
  ACTIVITY_STATS_DEVICE_ACTIVE_WINDOW_MS,
  ACTIVITY_STATS_DEVICE_LIMIT,
  ACTIVITY_STATS_RECENT_LIMIT,
  ACTIVITY_STATS_TOP_LIMIT,
} from '@/constants/activity-stats'
import { flushPendingReportedAppHistory } from '@/lib/activity-app-history'
import { db } from '@/lib/db'
import {
  activityAppHistory,
  activityPlaySourceHistory,
  activityStatBuckets,
  devices,
  inspirationEntries,
} from '@/lib/drizzle-schema'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import { coerceDbTimestampToIsoUtc, getDateParts, normalizeTimezone } from '@/lib/timezone'
import type {
  ActivityStatsAppRankItem,
  ActivityStatsHeatmapCell,
  ActivityStatsRankItem,
  ActivityStatsResponse,
} from '@/types/activity-stats'

type AppHistoryBucket = { titles?: unknown; lastSeenAt?: unknown }
type AppHistoryBuckets = { pc?: AppHistoryBucket; mobile?: AppHistoryBucket }

function pad2(value: number): string {
  return String(Math.max(0, Math.trunc(value))).padStart(2, '0')
}

function ToIsoOrNull(value: Date | string | null | undefined): string | null {
  if (value == null) return null
  return coerceDbTimestampToIsoUtc(value)
}

function ParseAppBuckets(raw: unknown): AppHistoryBuckets | null {
  if (!raw) return null
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as AppHistoryBuckets)
        : null
    } catch {
      return null
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as AppHistoryBuckets
  return null
}

function ExtractAppMeta(raw: unknown): { lastTitle: string | null; platforms: string[] } {
  const buckets = ParseAppBuckets(raw)
  if (!buckets) return { lastTitle: null, platforms: [] }
  const platforms: string[] = []
  let lastTitle: string | null = null
  let lastTitleAt = -Infinity
  for (const platform of ['pc', 'mobile'] as const) {
    const bucket = buckets[platform]
    if (!bucket) continue
    platforms.push(platform)
    const titles = Array.isArray(bucket.titles) ? bucket.titles : []
    const firstTitle = typeof titles[0] === 'string' ? titles[0].trim() : ''
    const seenMs = Date.parse(String(bucket.lastSeenAt ?? ''))
    if (firstTitle && Number.isFinite(seenMs) && seenMs > lastTitleAt) {
      lastTitle = firstTitle
      lastTitleAt = seenMs
    } else if (firstTitle && !lastTitle) {
      lastTitle = firstTitle
    }
  }
  return { lastTitle, platforms }
}

function BuildDateString(parts: { year: number; month: number; day: number }): string {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`
}

function AddDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map((part) => Number(part))
  const base = new Date(Date.UTC(y, (m || 1) - 1, d || 1))
  base.setUTCDate(base.getUTCDate() + days)
  return `${base.getUTCFullYear()}-${pad2(base.getUTCMonth() + 1)}-${pad2(base.getUTCDate())}`
}

function WeekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map((part) => Number(part))
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1)).getUTCDay()
}

function NumberOf(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Aggregate the historical statistics dashboard payload from the dictionary
 * tables (totals / rankings) and the per-day/per-hour timeseries buckets
 * (trend / heatmap). Window is interpreted in the site display timezone.
 */
export async function BuildActivityStats(rangeDays: number): Promise<ActivityStatsResponse> {
  try {
    await flushPendingReportedAppHistory({ maxKeys: 500 })
  } catch {
    // Best-effort freshness only.
  }

  const cfg = await getSiteConfigMemoryFirst()
  const timezone = normalizeTimezone(cfg?.displayTimezone)
  const nowParts = getDateParts(Date.now(), timezone)
  const rangeEndDate = BuildDateString(nowParts)
  const rangeStartDate = AddDays(rangeEndDate, -(rangeDays - 1))
  const activeThreshold = Date.now() - ACTIVITY_STATS_DEVICE_ACTIVE_WINDOW_MS

  const rangeWhere = and(
    gte(activityStatBuckets.statDate, rangeStartDate),
    lte(activityStatBuckets.statDate, rangeEndDate),
  )

  const [
    [appCountRow],
    [playCountRow],
    [appReportRow],
    deviceRows,
    [inspirationRow],
    topAppRows,
    topPlayRows,
    recentAppRows,
    platformRows,
    trendRows,
    heatmapRows,
    [rangeHitRow],
  ] = await Promise.all([
    db.select({ c: count() }).from(activityAppHistory),
    db.select({ c: count() }).from(activityPlaySourceHistory),
    db
      .select({ total: sql<number>`coalesce(sum(${activityAppHistory.seenCount}), 0)` })
      .from(activityAppHistory),
    db
      .select({
        id: devices.id,
        displayName: devices.displayName,
        status: devices.status,
        lastSeenAt: devices.lastSeenAt,
      })
      .from(devices)
      .orderBy(desc(devices.lastSeenAt))
      .limit(ACTIVITY_STATS_DEVICE_LIMIT),
    db.select({ c: count() }).from(inspirationEntries),
    db
      .select({
        entryKey: activityStatBuckets.entryKey,
        hits: sql<number>`coalesce(sum(${activityStatBuckets.hitCount}), 0)`,
        lastSeenAt: sql<string>`max(${activityStatBuckets.lastSeenAt})`,
      })
      .from(activityStatBuckets)
      .where(and(rangeWhere, eq(activityStatBuckets.kind, 'app')))
      .groupBy(activityStatBuckets.entryKey)
      .orderBy(desc(sql`coalesce(sum(${activityStatBuckets.hitCount}), 0)`))
      .limit(ACTIVITY_STATS_TOP_LIMIT),
    db
      .select({
        entryKey: activityStatBuckets.entryKey,
        hits: sql<number>`coalesce(sum(${activityStatBuckets.hitCount}), 0)`,
        lastSeenAt: sql<string>`max(${activityStatBuckets.lastSeenAt})`,
      })
      .from(activityStatBuckets)
      .where(and(rangeWhere, eq(activityStatBuckets.kind, 'play_source')))
      .groupBy(activityStatBuckets.entryKey)
      .orderBy(desc(sql`coalesce(sum(${activityStatBuckets.hitCount}), 0)`))
      .limit(ACTIVITY_STATS_TOP_LIMIT),
    db
      .select({
        processName: activityAppHistory.processName,
        platformBuckets: activityAppHistory.platformBuckets,
        seenCount: activityAppHistory.seenCount,
        lastSeenAt: activityAppHistory.lastSeenAt,
      })
      .from(activityAppHistory)
      .orderBy(desc(activityAppHistory.lastSeenAt))
      .limit(ACTIVITY_STATS_RECENT_LIMIT),
    db
      .select({
        platform: activityStatBuckets.platform,
        hits: sql<number>`coalesce(sum(${activityStatBuckets.hitCount}), 0)`,
      })
      .from(activityStatBuckets)
      .where(and(rangeWhere, eq(activityStatBuckets.kind, 'app')))
      .groupBy(activityStatBuckets.platform),
    db
      .select({
        statDate: activityStatBuckets.statDate,
        kind: activityStatBuckets.kind,
        hits: sql<number>`coalesce(sum(${activityStatBuckets.hitCount}), 0)`,
      })
      .from(activityStatBuckets)
      .where(rangeWhere)
      .groupBy(activityStatBuckets.statDate, activityStatBuckets.kind),
    db
      .select({
        statDate: activityStatBuckets.statDate,
        hourOfDay: activityStatBuckets.hourOfDay,
        hits: sql<number>`coalesce(sum(${activityStatBuckets.hitCount}), 0)`,
      })
      .from(activityStatBuckets)
      .where(rangeWhere)
      .groupBy(activityStatBuckets.statDate, activityStatBuckets.hourOfDay),
    db
      .select({ total: sql<number>`coalesce(sum(${activityStatBuckets.hitCount}), 0)` })
      .from(activityStatBuckets)
      .where(rangeWhere),
  ])

  const recentAppMetaByKey = new Map<string, { lastTitle: string | null; platforms: string[]; seenCount: number }>()
  for (const row of recentAppRows) {
    const meta = ExtractAppMeta(row.platformBuckets)
    recentAppMetaByKey.set(String(row.processName), {
      ...meta,
      seenCount: NumberOf(row.seenCount),
    })
  }

  const appMetaKeys: string[] = topAppRows.map((row: any) => String(row.entryKey))
  const appMetaByKey = new Map<string, { lastTitle: string | null; platforms: string[]; seenCount: number }>()
  if (appMetaKeys.length > 0) {
    const metaRows = await db
      .select({
        processName: activityAppHistory.processName,
        platformBuckets: activityAppHistory.platformBuckets,
        seenCount: activityAppHistory.seenCount,
      })
      .from(activityAppHistory)
      .where(
        sql`lower(${activityAppHistory.processName}) in (${sql.join(
          appMetaKeys.map((key: string) => sql`${key.toLowerCase()}`),
          sql`, `,
        )})`,
      )
    for (const row of metaRows) {
      const meta = ExtractAppMeta(row.platformBuckets)
      appMetaByKey.set(String(row.processName).toLowerCase(), {
        ...meta,
        seenCount: NumberOf(row.seenCount),
      })
    }
  }

  const topApps: ActivityStatsAppRankItem[] = topAppRows.map((row: any) => {
    const key = String(row.entryKey)
    const meta = appMetaByKey.get(key.toLowerCase())
    return {
      key,
      hitCount: NumberOf(row.hits),
      lastSeenAt: ToIsoOrNull(row.lastSeenAt),
      seenCount: meta?.seenCount ?? 0,
      lastTitle: meta?.lastTitle ?? null,
      platforms: meta?.platforms ?? [],
    }
  })

  const topPlaySources: ActivityStatsRankItem[] = topPlayRows.map((row: any) => ({
    key: String(row.entryKey),
    hitCount: NumberOf(row.hits),
    lastSeenAt: ToIsoOrNull(row.lastSeenAt),
  }))

  const recentApps: ActivityStatsAppRankItem[] = recentAppRows.map((row: any) => {
    const key = String(row.processName)
    const meta = recentAppMetaByKey.get(key)
    return {
      key,
      hitCount: meta?.seenCount ?? 0,
      lastSeenAt: ToIsoOrNull(row.lastSeenAt),
      seenCount: meta?.seenCount ?? NumberOf(row.seenCount),
      lastTitle: meta?.lastTitle ?? null,
      platforms: meta?.platforms ?? [],
    }
  })

  let pcHits = 0
  let mobileHits = 0
  for (const row of platformRows) {
    const platform = String(row.platform ?? '')
    if (platform === 'pc') pcHits += NumberOf(row.hits)
    else if (platform === 'mobile') mobileHits += NumberOf(row.hits)
  }

  const trendByDate = new Map<string, { appHits: number; playHits: number }>()
  for (const row of trendRows) {
    const date = String(row.statDate)
    const entry = trendByDate.get(date) ?? { appHits: 0, playHits: 0 }
    if (String(row.kind) === 'app') entry.appHits += NumberOf(row.hits)
    else entry.playHits += NumberOf(row.hits)
    trendByDate.set(date, entry)
  }
  const dailyTrend = []
  for (let i = 0; i < rangeDays; i += 1) {
    const date = AddDays(rangeStartDate, i)
    const entry = trendByDate.get(date) ?? { appHits: 0, playHits: 0 }
    dailyTrend.push({ date, appHits: entry.appHits, playHits: entry.playHits })
  }

  const heatmapGrid = new Map<string, number>()
  for (const row of heatmapRows) {
    const weekday = WeekdayOf(String(row.statDate))
    const hour = Math.max(0, Math.min(23, NumberOf(row.hourOfDay)))
    const gridKey = `${weekday}:${hour}`
    heatmapGrid.set(gridKey, (heatmapGrid.get(gridKey) ?? 0) + NumberOf(row.hits))
  }
  const hourlyHeatmap: ActivityStatsHeatmapCell[] = []
  for (let weekday = 0; weekday < 7; weekday += 1) {
    for (let hour = 0; hour < 24; hour += 1) {
      hourlyHeatmap.push({ weekday, hour, hitCount: heatmapGrid.get(`${weekday}:${hour}`) ?? 0 })
    }
  }

  const deviceItems = deviceRows.map((row: any) => {
    const lastSeenIso = ToIsoOrNull(row.lastSeenAt)
    return {
      id: NumberOf(row.id),
      displayName: String(row.displayName ?? ''),
      status: String(row.status ?? 'active'),
      lastSeenAt: lastSeenIso,
    }
  })
  const deviceActiveCount = deviceItems.filter((item: { lastSeenAt: string | null }) => {
    const seenMs = item.lastSeenAt ? Date.parse(item.lastSeenAt) : NaN
    return Number.isFinite(seenMs) && seenMs >= activeThreshold
  }).length

  return {
    rangeDays,
    rangeStartDate,
    rangeEndDate,
    timezone,
    totals: {
      appCount: NumberOf(appCountRow?.c),
      playSourceCount: NumberOf(playCountRow?.c),
      appReportTotal: NumberOf(appReportRow?.total),
      deviceCount: deviceItems.length,
      deviceActiveCount,
      inspirationCount: NumberOf(inspirationRow?.c),
      rangeHitTotal: NumberOf(rangeHitRow?.total),
    },
    topApps,
    topPlaySources,
    recentApps,
    platformSplit: { pc: pcHits, mobile: mobileHits },
    dailyTrend,
    hourlyHeatmap,
    devices: deviceItems,
  }
}
