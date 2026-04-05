import { desc, eq, gt, inArray, or } from 'drizzle-orm'

import {
  ACTIVITY_FEED_DEFAULT_LIMIT,
  ACTIVITY_FEED_QUERY_MAX_LIMIT,
  ACTIVITY_FEED_RECENT_TOP_APPS_MAX,
} from '@/lib/activity-api-constants'
import { clearCachedActivityFeedData, getCachedActivityFeedData, setCachedActivityFeedData } from '@/lib/activity-feed-cache'
import { redactGeneratedHashKeyForClient } from '@/lib/activity-store'
import { db } from '@/lib/db'
import { devices, userActivities } from '@/lib/drizzle-schema'
import { listRealtimeActivities } from '@/lib/realtime-activity-cache'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import {
  parseHistoryWindowMinutes,
  parseProcessStaleSeconds,
} from '@/lib/site-config-constants'
import { sqlDate, sqlTimestamp } from '@/lib/sql-timestamp'
import { getSteamNowPlayingByDeviceHashes } from '@/lib/steam-feed-merge'
import { purgeExpiredUserActivitiesFromDbAndMemory } from '@/lib/user-activity-hydration'
import type { ActivityFeedData, ActivityFeedItem } from '@/types/activity'

export { redactGeneratedHashKeyForClient }
export type { ActivityFeedData } from '@/types/activity'

type ActivityDbRow = {
  id: number | string
  deviceId: number
  generatedHashKey: string
  processName: string
  processTitle: string | null
  metadata: Record<string, unknown> | string | null
  startedAt: Date | string
  updatedAt: Date | string
  expiresAt: Date | string
  device: string
}

function normalizeProcessName(value: string): string {
  return value.trim().toLowerCase()
}

function parseProcessList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const result: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    const normalized = normalizeProcessName(String(item ?? ''))
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    result.push(normalized)
  }
  return result
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function normalizeMetadata(value: unknown): Record<string, unknown> | null {
  if (!value) return null
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value)
      return asObject(parsed)
    } catch {
      return null
    }
  }
  return asObject(value)
}

/** Drop `metadata.media` on feed items for public responses when site hides media (store unchanged). */
function stripMediaFromFeedItem(item: ActivityFeedItem): ActivityFeedItem {
  const meta = item.metadata
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return item
  if (!Object.prototype.hasOwnProperty.call(meta, 'media')) return item
  const { media: _omit, ...rest } = meta as Record<string, unknown>
  return { ...item, metadata: rest }
}

function omitActivityMediaFromFeed(feed: ActivityFeedData): ActivityFeedData {
  return {
    ...feed,
    activeStatuses: feed.activeStatuses.map(stripMediaFromFeedItem),
    recentActivities: feed.recentActivities.map(stripMediaFromFeedItem),
    recentTopApps: feed.recentTopApps.map(stripMediaFromFeedItem),
  }
}

function stripMediaByPlaySource(
  item: ActivityFeedItem,
  blockedSources: Set<string>,
): ActivityFeedItem {
  if (blockedSources.size === 0) return item
  const meta = normalizeMetadata(item.metadata)
  if (!meta) return item
  const source = String(meta.play_source ?? '')
    .trim()
    .toLowerCase()
  if (!source) return item
  if (!blockedSources.has(source)) return item
  if (!Object.prototype.hasOwnProperty.call(meta, 'media')) return item
  const { media: _omit, ...rest } = meta
  return { ...item, metadata: rest }
}

export type GetActivityFeedOptions = {
  /**
   * When true and site `hideActivityMedia` is enabled, strip `metadata.media` from all items.
   * Public home (REST `?public=1`, SSE) should set this; admin session feed should omit it.
   */
  forPublicFeed?: boolean
  /** Internal-only: keep generatedHashKey on activeStatuses for server-side filtering. */
  includeGeneratedHashKey?: boolean
}

function getPushModeFromMetadata(metadata: unknown): 'realtime' | 'active' {
  const meta = normalizeMetadata(metadata)
  if (!meta) return 'realtime'
  const mode = String(meta.pushMode ?? '').trim().toLowerCase()
  if (mode === 'active' || mode === 'persistent') return 'active'
  return 'realtime'
}

function applyMessageRule(
  processName: string,
  processTitle: string | null,
  rules: Array<{ match: string; text: string }>,
): string | null {
  const processLower = processName.toLowerCase()
  for (const rule of rules) {
    const matcher = String(rule.match || '').trim().toLowerCase()
    if (!matcher) continue
    if (!processLower.includes(matcher)) continue

    const template = String(rule.text || '').trim()
    if (!template) continue
    return template
      .replaceAll('{process}', processName)
      .replaceAll('{title}', processTitle || '')
  }
  return null
}

export async function getHistoryWindowMinutes(): Promise<number> {
  const config = await getSiteConfigMemoryFirst()
  return parseHistoryWindowMinutes(config?.historyWindowMinutes)
}

export async function getActivityFeedData(
  limit = ACTIVITY_FEED_DEFAULT_LIMIT,
  options?: GetActivityFeedOptions,
): Promise<ActivityFeedData> {
  const config = await getSiteConfigMemoryFirst()
  const shouldUseCache = options?.includeGeneratedHashKey !== true
  const cached = shouldUseCache ? await getCachedActivityFeedData() : null
  if (cached) {
    const hideActivityMedia = config?.hideActivityMedia === true
    if (options?.forPublicFeed && hideActivityMedia) {
      return omitActivityMediaFromFeed(cached)
    }
    return cached
  }

  const historyWindowMinutes = parseHistoryWindowMinutes(config?.historyWindowMinutes)
  const defaultStaleSeconds = parseProcessStaleSeconds(config?.processStaleSeconds)
  const appMessageRules: Array<{ match: string; text: string }> = Array.isArray(config?.appMessageRules)
    ? config.appMessageRules
    : []
  const appMessageRulesShowProcessName = (config as Record<string, unknown> | null)?.appMessageRulesShowProcessName !== false
  const appBlacklist = parseProcessList(config?.appBlacklist)
  const appWhitelist = parseProcessList(config?.appWhitelist)
  const appFilterModeRaw = String(config?.appFilterMode ?? 'blacklist').trim().toLowerCase()
  const appFilterMode = appFilterModeRaw === 'whitelist' ? 'whitelist' : 'blacklist'
  const appNameOnlyList = parseProcessList(config?.appNameOnlyList)
  const mediaPlaySourceBlocklist = parseProcessList(
    (config as Record<string, unknown> | null)?.mediaPlaySourceBlocklist,
  )
  const blacklistSet = new Set(appBlacklist)
  const whitelistSet = new Set(appWhitelist)
  const nameOnlySet = new Set(appNameOnlyList)
  const blockedMediaSourceSet = new Set(mediaPlaySourceBlocklist)

  const passesAppFilter = (processName: string): boolean => {
    const key = normalizeProcessName(processName)
    if (appFilterMode === 'whitelist') {
      if (whitelistSet.size === 0) return false
      return whitelistSet.has(key)
    }
    return !blacklistSet.has(key)
  }

  try {
    await purgeExpiredUserActivitiesFromDbAndMemory()
  } catch (error) {
    console.error('[activity-feed] UserActivity purge/hydrate failed:', error)
  }

  const now = sqlTimestamp()
  const sinceDate = new Date(Date.now() - historyWindowMinutes * 60 * 1000)
  const since = sqlDate(sinceDate)

  const [activeRowsRaw, recentRowsRaw, realtimeRows] = await Promise.all([
    db
      .select({
        id: userActivities.id,
        deviceId: userActivities.deviceId,
        generatedHashKey: userActivities.generatedHashKey,
        processName: userActivities.processName,
        processTitle: userActivities.processTitle,
        metadata: userActivities.metadata,
        startedAt: userActivities.startedAt,
        updatedAt: userActivities.updatedAt,
        expiresAt: userActivities.expiresAt,
        device: devices.displayName,
      })
      .from(userActivities)
      .innerJoin(devices, eq(userActivities.deviceId, devices.id))
      .where(gt(userActivities.expiresAt, now))
      .orderBy(desc(userActivities.updatedAt)),
    db
      .select({
        id: userActivities.id,
        deviceId: userActivities.deviceId,
        generatedHashKey: userActivities.generatedHashKey,
        processName: userActivities.processName,
        processTitle: userActivities.processTitle,
        metadata: userActivities.metadata,
        startedAt: userActivities.startedAt,
        updatedAt: userActivities.updatedAt,
        expiresAt: userActivities.expiresAt,
        device: devices.displayName,
      })
      .from(userActivities)
      .innerJoin(devices, eq(userActivities.deviceId, devices.id))
      .where(or(gt(userActivities.startedAt, since), gt(userActivities.updatedAt, since)))
      .orderBy(desc(userActivities.updatedAt), desc(userActivities.startedAt))
      .limit(Math.min(limit, ACTIVITY_FEED_QUERY_MAX_LIMIT)),
    listRealtimeActivities(),
  ])
  const activeRows = activeRowsRaw as ActivityDbRow[]
  const recentRows = recentRowsRaw as ActivityDbRow[]

  const realtimeRowsTyped = realtimeRows as unknown as ActivityDbRow[]
  const recentActivitiesRaw = [...recentRows, ...realtimeRowsTyped]
    .filter((a: ActivityDbRow) => passesAppFilter(a.processName))
    .sort((a, b) => {
      const aTime = Date.parse(String(a.updatedAt || a.startedAt))
      const bTime = Date.parse(String(b.updatedAt || b.startedAt))
      return bTime - aTime
    })
    .slice(0, Math.min(limit, ACTIVITY_FEED_QUERY_MAX_LIMIT))

  const toIso = (value: unknown): string => {
    if (value instanceof Date) return value.toISOString()
    const s = String(value ?? '').trim()
    if (!s) return new Date(0).toISOString()
    const t = Date.parse(s)
    return Number.isFinite(t) ? new Date(t).toISOString() : new Date(0).toISOString()
  }

  const recentActivities = recentActivitiesRaw
    .map((item: ActivityDbRow) => {
      const startedAtIso = toIso(item.startedAt)
      const normalizedMeta = normalizeMetadata(item.metadata)
      const pushMode = getPushModeFromMetadata(item.metadata)
      const shaped =
        nameOnlySet.has(normalizeProcessName(item.processName))
          ? { ...item, processTitle: null as string | null }
          : item
      const row = {
        ...shaped,
        metadata: normalizedMeta,
        startedAt: startedAtIso,
        endedAt: null,
        pushMode,
        updatedAt: toIso(item.updatedAt),
        lastReportAt: toIso(item.updatedAt || item.startedAt),
      } as Record<string, unknown>
      return redactGeneratedHashKeyForClient(row)
    })

  // Keep latest active entry for each device
  const activePending: Array<{ hashKey: string; row: Record<string, unknown> }> = []
  const seen = new Set<string>()
  const activeMerged = [...activeRows, ...realtimeRowsTyped]
    .sort((a, b) => Date.parse(String(b.updatedAt)) - Date.parse(String(a.updatedAt)))
  for (const item of activeMerged) {
    const processKey = normalizeProcessName(item.processName)
    const key = item.generatedHashKey
    if (!key) continue
    if (seen.has(key)) continue
    if (!passesAppFilter(item.processName)) continue
    seen.add(key)
    const pushMode = getPushModeFromMetadata(item.metadata)
    const normalizedMeta = normalizeMetadata(item.metadata)
    const maskedTitle = nameOnlySet.has(processKey) ? null : item.processTitle
    const ruleStatusText = applyMessageRule(item.processName, maskedTitle, appMessageRules)
    const processTitleForClient = ruleStatusText ? null : maskedTitle
    const row: Record<string, unknown> = {
      ...item,
      metadata: normalizedMeta,
      processTitle: processTitleForClient,
      startedAt: toIso(item.startedAt),
      updatedAt: toIso(item.updatedAt),
      endedAt: null,
      pushMode,
      lastReportAt: toIso(item.updatedAt ?? item.startedAt),
    }
    if (ruleStatusText) {
      row.statusText = appMessageRulesShowProcessName
        ? `${ruleStatusText} | ${item.processName}`
        : ruleStatusText
    }
    activePending.push({ hashKey: key, row })
  }

  const steamApiKey = String(config?.steamApiKey || process.env.STEAM_API_KEY || '')
  const siteSteamId = String(config?.steamId || '')
  const steamByHash = await getSteamNowPlayingByDeviceHashes(
    activePending.map((p) => p.hashKey),
    {
      steamEnabled: Boolean(config?.steamEnabled),
      apiKey: steamApiKey,
      siteSteamId,
    },
  )

  const activeDeviceIds = Array.from(
    new Set(
      activePending
        .map((entry) => Number(entry.row.deviceId))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  )
  const pinnedDeviceIds = new Set<number>()
  if (activeDeviceIds.length > 0) {
    const pinRows = await db
      .select({
        id: devices.id,
        pinToTop: devices.pinToTop,
      })
      .from(devices)
      .where(inArray(devices.id, activeDeviceIds))
    for (const row of pinRows) {
      if (row.pinToTop === true) {
        pinnedDeviceIds.add(Number(row.id))
      }
    }
  }

  const sortedActivePending = activePending
    .map((entry, index) => {
      const deviceId = Number(entry.row.deviceId)
      const updatedAtMs = Date.parse(String(entry.row.updatedAt ?? entry.row.startedAt ?? ''))
      return {
        ...entry,
        index,
        isPinned: Number.isFinite(deviceId) && pinnedDeviceIds.has(deviceId),
        updatedAtMs: Number.isFinite(updatedAtMs) ? updatedAtMs : -1,
      }
    })
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
      if (a.updatedAtMs !== b.updatedAtMs) return b.updatedAtMs - a.updatedAtMs
      return a.index - b.index
    })

  const activeStatuses: ActivityFeedItem[] = []
  for (const { hashKey, row } of sortedActivePending) {
    const sp = steamByHash.get(hashKey)
    if (sp) row.steamNowPlaying = sp
    const item = options?.includeGeneratedHashKey
      ? (row as unknown as ActivityFeedItem)
      : (redactGeneratedHashKeyForClient(row) as unknown as ActivityFeedItem)
    activeStatuses.push(item)
  }

  const recentTopApps: ActivityFeedItem[] = []
  const seenProcess = new Set<string>()
  for (const item of recentActivities as Array<{ processName: string; processTitle?: string | null }>) {
    const key = item.processName.toLowerCase()
    if (seenProcess.has(key)) continue
    seenProcess.add(key)
    const processKey = normalizeProcessName(item.processName)
    const maskedTitle = nameOnlySet.has(processKey) ? null : item.processTitle
    const ruleStatusText = applyMessageRule(item.processName, maskedTitle ?? null, appMessageRules)
    if (ruleStatusText) {
      recentTopApps.push({
        ...item,
        processTitle: null,
        statusText: appMessageRulesShowProcessName
          ? `${ruleStatusText} | ${item.processName}`
          : ruleStatusText,
      } as unknown as ActivityFeedItem)
    } else {
      recentTopApps.push({
        ...item,
        processTitle: maskedTitle,
      } as unknown as ActivityFeedItem)
    }
    if (recentTopApps.length >= ACTIVITY_FEED_RECENT_TOP_APPS_MAX) break
  }

  const data = {
    activeStatuses: activeStatuses.map((i) => stripMediaByPlaySource(i, blockedMediaSourceSet)),
    recentActivities: (recentActivities as unknown as ActivityFeedItem[]).map((i) =>
      stripMediaByPlaySource(i, blockedMediaSourceSet),
    ),
    historyWindowMinutes,
    processStaleSeconds: defaultStaleSeconds,
    recentTopApps: recentTopApps.map((i) => stripMediaByPlaySource(i, blockedMediaSourceSet)),
    generatedAt: new Date().toISOString(),
  } as ActivityFeedData

  if (options?.includeGeneratedHashKey) {
    await setCachedActivityFeedData({
      ...data,
      activeStatuses: data.activeStatuses.map((item) =>
        redactGeneratedHashKeyForClient(item as unknown as Record<string, unknown>),
      ) as unknown as ActivityFeedItem[],
    })
  } else {
    await setCachedActivityFeedData(data)
  }

  const hideActivityMedia = config?.hideActivityMedia === true
  if (options?.forPublicFeed && hideActivityMedia) {
    return omitActivityMediaFromFeed(data)
  }
  return data
}

export async function clearActivityFeedDataCache(): Promise<void> {
  await clearCachedActivityFeedData()
}
