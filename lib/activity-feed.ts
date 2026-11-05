import { desc, eq, gt, inArray, or } from 'drizzle-orm'

import {
  ACTIVITY_FEED_DEFAULT_LIMIT,
  ACTIVITY_FEED_QUERY_MAX_LIMIT,
  ACTIVITY_FEED_RECENT_TOP_APPS_MAX,
} from '@/constants/activity-api'
import { clearCachedActivityFeedData, getCachedActivityFeedData, setCachedActivityFeedData } from '@/lib/activity-feed-cache'
import { redactGeneratedHashKeyForClient } from '@/lib/activity-store'
import {
  type AppMessageRuleGroup,
  type AppMessageRuleMatchContext,
  type AppMessageTitleRule,
  normalizeAppMessageRegexPattern,
  renderAppMessageRuleText,
} from '@/lib/app-message-rules'
import { db } from '@/lib/db'
import { devices, userActivities } from '@/lib/drizzle-schema'
import { getReportedScreenState, isLockScreenReport } from '@/lib/lockapp-reporter'
import { applyMediaPlaySourceRulesToMetadata, normalizeMediaPlaySourceRules } from '@/lib/media-play-source-rules'
import { listRealtimeActivities } from '@/lib/realtime-activity-cache'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import {
  parseHistoryWindowMinutes,
  parseProcessStaleSeconds,
} from '@/lib/site-config-values'
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

type ActivityRowSource = 'persistent' | 'realtime'

type ActivityFeedCandidate = {
  row: ActivityDbRow
  source: ActivityRowSource
}

const ACTIVITY_FEED_RECENT_REALTIME_MAX = 20
const ACTIVITY_FEED_RECENT_REALTIME_RATIO = 0.4

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
  rules: unknown,
  legacyBlocklist?: unknown,
): ActivityFeedItem {
  const meta = normalizeMetadata(item.metadata)
  if (!meta) return item
  const nextMeta = applyMediaPlaySourceRulesToMetadata(meta, rules, legacyBlocklist)
  return nextMeta === meta ? item : { ...item, metadata: nextMeta }
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

function getFeedPushMode(candidate: ActivityFeedCandidate): 'realtime' | 'active' {
  if (candidate.source === 'persistent') return 'active'
  return getPushModeFromMetadata(candidate.row.metadata)
}

function getActivityTimeMs(row: ActivityDbRow): number {
  const updatedAt = Date.parse(String(row.updatedAt || row.startedAt))
  if (Number.isFinite(updatedAt)) return updatedAt
  const startedAt = Date.parse(String(row.startedAt))
  return Number.isFinite(startedAt) ? startedAt : -1
}

function compareActivityCandidatesByTime(a: ActivityFeedCandidate, b: ActivityFeedCandidate): number {
  return getActivityTimeMs(b.row) - getActivityTimeMs(a.row)
}

function dedupeRealtimeRecentRows(rows: ActivityDbRow[]): ActivityDbRow[] {
  const latestByKey = new Map<string, ActivityDbRow>()
  for (const row of rows) {
    const deviceKey = row.generatedHashKey || String(row.deviceId || row.device || '')
    const key = `${deviceKey}:${normalizeProcessName(row.processName)}`
    const existing = latestByKey.get(key)
    if (!existing || getActivityTimeMs(row) > getActivityTimeMs(existing)) {
      latestByKey.set(key, row)
    }
  }
  return Array.from(latestByKey.values())
}

function applyMessageRule(
  processName: string,
  processTitleForMatch: string | null,
  processTitleForTemplate: string | null,
  rules: AppMessageRuleGroup[],
): string | null {
  const processLower = processName.toLowerCase()

  const matchTitleRule = (
    processTitle: string | null,
    titleRule: AppMessageTitleRule,
  ): AppMessageRuleMatchContext | null => {
    const title = String(processTitle ?? '')
    if (!title) return null
    if (titleRule.mode === 'regex') {
      try {
        const match = new RegExp(normalizeAppMessageRegexPattern(titleRule.pattern), 'i').exec(title)
        if (!match) return null
        return {
          fullMatch: match[0] ?? '',
          groups: match.slice(1).map((item) => item ?? ''),
          namedGroups: match.groups ?? undefined,
        }
      } catch {
        return null
      }
    }
    return title.toLowerCase().includes(titleRule.pattern.toLowerCase()) ? {} : null
  }

  for (const rule of rules) {
    const matcher = String(rule.processMatch || '').trim().toLowerCase()
    if (!matcher) continue
    if (!processLower.includes(matcher)) continue

    const titleRules = Array.isArray(rule.titleRules) ? rule.titleRules : []
    for (const titleRule of titleRules) {
      const match = matchTitleRule(processTitleForMatch, titleRule)
      if (!match) continue
      return renderAppMessageRuleText(
        titleRule.text,
        processName,
        processTitleForTemplate,
        match,
      )
    }

    const template = String(rule.defaultText || '').trim()
    if (!template) continue
    return renderAppMessageRuleText(template, processName, processTitleForTemplate)
  }
  return null
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
  const appMessageRules: AppMessageRuleGroup[] = Array.isArray(config?.appMessageRules)
    ? config.appMessageRules
    : []
  const appMessageRulesShowProcessName = (config as Record<string, unknown> | null)?.appMessageRulesShowProcessName !== false
  const appBlacklist = parseProcessList(config?.appBlacklist)
  const appWhitelist = parseProcessList(config?.appWhitelist)
  const appFilterModeRaw = String(config?.appFilterMode ?? 'blacklist').trim().toLowerCase()
  const appFilterMode = appFilterModeRaw === 'whitelist' ? 'whitelist' : 'blacklist'
  const appNameOnlyList = parseProcessList(config?.appNameOnlyList)
  const mediaPlaySourceRules = normalizeMediaPlaySourceRules(
    (config as Record<string, unknown> | null)?.mediaPlaySourceRules,
    (config as Record<string, unknown> | null)?.mediaPlaySourceBlocklist,
  )
  const blacklistSet = new Set(appBlacklist)
  const whitelistSet = new Set(appWhitelist)
  const nameOnlySet = new Set(appNameOnlyList)

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
  const recentLimit = Math.min(limit, ACTIVITY_FEED_QUERY_MAX_LIMIT)
  const realtimeRecentLimit = Math.min(
    ACTIVITY_FEED_RECENT_REALTIME_MAX,
    Math.max(1, Math.floor(recentLimit * ACTIVITY_FEED_RECENT_REALTIME_RATIO)),
  )
  const recentPersistentCandidates = recentRows
    .filter((row) => passesAppFilter(row.processName))
    .map((row): ActivityFeedCandidate => ({ row, source: 'persistent' }))
  const recentRealtimeCandidates = dedupeRealtimeRecentRows(realtimeRowsTyped)
    .filter((row) => passesAppFilter(row.processName))
    .map((row): ActivityFeedCandidate => ({ row, source: 'realtime' }))
    .sort(compareActivityCandidatesByTime)
    .slice(0, realtimeRecentLimit)
  const recentActivitiesRaw = [...recentPersistentCandidates, ...recentRealtimeCandidates]
    .sort(compareActivityCandidatesByTime)
    .slice(0, Math.min(limit, ACTIVITY_FEED_QUERY_MAX_LIMIT))

  const toIso = (value: unknown): string => {
    if (value instanceof Date) return value.toISOString()
    const s = String(value ?? '').trim()
    if (!s) return new Date(0).toISOString()
    const t = Date.parse(s)
    return Number.isFinite(t) ? new Date(t).toISOString() : new Date(0).toISOString()
  }

  const recentActivities = recentActivitiesRaw
    .map((candidate: ActivityFeedCandidate) => {
      const item = candidate.row
      const startedAtIso = toIso(item.startedAt)
      const normalizedMeta = normalizeMetadata(item.metadata)
      const pushMode = getFeedPushMode(candidate)
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
  const activeCandidates: ActivityFeedCandidate[] = [
    ...activeRows.map((row): ActivityFeedCandidate => ({ row, source: 'persistent' })),
    ...realtimeRowsTyped.map((row): ActivityFeedCandidate => ({ row, source: 'realtime' })),
  ]
  // Resolve explicit device state before app filtering or active-mode priority.
  const latestScreenReportByDevice = new Map<string, ActivityFeedCandidate>()
  for (const candidate of activeCandidates) {
    if (getReportedScreenState(normalizeMetadata(candidate.row.metadata)) === null) continue
    const key = candidate.row.generatedHashKey
    const previous = latestScreenReportByDevice.get(key)
    if (!previous || getActivityTimeMs(candidate.row) > getActivityTimeMs(previous.row)) {
      latestScreenReportByDevice.set(key, candidate)
    }
  }
  const activeMerged = activeCandidates.filter((candidate) => {
    const screenReport = latestScreenReportByDevice.get(candidate.row.generatedHashKey)
    return !screenReport || screenReport === candidate
  }).sort((a, b) => {
    const aMode = getFeedPushMode(a)
    const bMode = getFeedPushMode(b)
    if (aMode !== bMode) return aMode === 'active' ? -1 : 1
    return compareActivityCandidatesByTime(a, b)
  })
  for (const candidate of activeMerged) {
    const item = candidate.row
    const processKey = normalizeProcessName(item.processName)
    const key = item.generatedHashKey
    if (!key) continue
    if (seen.has(key)) continue
    const normalizedMeta = normalizeMetadata(item.metadata)
    const screenState = getReportedScreenState(normalizedMeta)
    if (screenState !== null && screenState !== 'active' && config?.activityRejectLockappSleep === true) continue
    if (!(screenState !== null && !item.processName) && !passesAppFilter(item.processName)) continue
    seen.add(key)
    const pushMode = getFeedPushMode(candidate)
    const maskedTitle = nameOnlySet.has(processKey) ? null : item.processTitle
    const ruleStatusText = applyMessageRule(
      item.processName,
      item.processTitle,
      maskedTitle,
      appMessageRules,
    )
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

  // Handle custom statuses for lock-screen and offline devices
  const allDevicesWithCustomStatus = await db
    .select({
      id: devices.id,
      displayName: devices.displayName,
      generatedHashKey: devices.generatedHashKey,
      lastSeenAt: devices.lastSeenAt,
      customOfflineStatus: devices.customOfflineStatus,
      customOfflineStatusEnabled: devices.customOfflineStatusEnabled,
      customOfflineStatusUpdatedAt: devices.customOfflineStatusUpdatedAt,
      customOfflineStatusBypassOnlineDeviceKeys: devices.customOfflineStatusBypassOnlineDeviceKeys,
      customLockStatus: devices.customLockStatus,
      customLockStatusEnabled: devices.customLockStatusEnabled,
      customLockStatusUpdatedAt: devices.customLockStatusUpdatedAt,
      customLockStatusBypassOnlineDeviceKeys: devices.customLockStatusBypassOnlineDeviceKeys,
    })
    .from(devices)
    .where(eq(devices.status, 'active'))

  const activeDeviceHashKeys = new Set(
    sortedActivePending
      .map((entry) => entry.hashKey)
      .filter((hashKey) => typeof hashKey === 'string' && hashKey.length > 0),
  )

  function normalizeBypassDeviceKeys(value: unknown): string[] {
    try {
      const raw = typeof value === 'string' ? JSON.parse(value) : value
      if (!Array.isArray(raw)) return []
      return raw
        .map((item) => String(item ?? '').trim())
        .filter((item) => item.length > 0)
    } catch {
      return []
    }
  }

  function isBypassedByOnlineDevice(value: unknown): boolean {
    return normalizeBypassDeviceKeys(value).some((key) => activeDeviceHashKeys.has(key))
  }

  const activeStatuses: ActivityFeedItem[] = []
  for (const { hashKey, row } of sortedActivePending) {
    const processName = String(row.processName ?? '')
    const metadata = row.metadata as Record<string, unknown> | null
    const isScreenOnly = getReportedScreenState(metadata) !== null && !processName
    const sp = steamByHash.get(hashKey)
    if (sp && !isScreenOnly) row.steamNowPlaying = sp

    if (isLockScreenReport(processName, metadata)) {
      const device = allDevicesWithCustomStatus.find(
        (candidate: { generatedHashKey: string | null }) => candidate.generatedHashKey === hashKey,
      )
      if (
        device?.customLockStatusEnabled &&
        device.customLockStatus &&
        !isBypassedByOnlineDevice(device.customLockStatusBypassOnlineDeviceKeys)
      ) {
        row.statusText = device.customLockStatus
        row.processTitle = null
        row.isCustomLockStatus = true
      }
    }

    const item = options?.includeGeneratedHashKey
      ? (row as unknown as ActivityFeedItem)
      : (redactGeneratedHashKeyForClient(row) as unknown as ActivityFeedItem)
    activeStatuses.push(item)
  }

  // Add custom offline status for offline devices
  for (const device of allDevicesWithCustomStatus) {
    if (!device.generatedHashKey) continue
    if (activeDeviceHashKeys.has(device.generatedHashKey)) continue
    if (!device.customOfflineStatusEnabled || !device.customOfflineStatus) continue
    if (isBypassedByOnlineDevice(device.customOfflineStatusBypassOnlineDeviceKeys)) continue

    const timestampValue = device.customOfflineStatusUpdatedAt || device.lastSeenAt || new Date()
    const timestamp = typeof timestampValue === 'string' ? timestampValue : timestampValue.toISOString()

    const syntheticItem: ActivityFeedItem = {
      id: `offline-${device.id}`,
      deviceId: device.id,
      device: device.displayName,
      processName: '',
      processTitle: null,
      startedAt: timestamp,
      endedAt: null,
      metadata: null,
      statusText: device.customOfflineStatus,
      lastReportAt: timestamp,
      isCustomOfflineStatus: true,
    }

    if (!options?.includeGeneratedHashKey) {
      delete (syntheticItem as Partial<ActivityFeedItem>).generatedHashKey
    }

    activeStatuses.push(syntheticItem)
  }

  const recentTopApps: ActivityFeedItem[] = []
  const seenProcess = new Set<string>()
  for (const item of recentActivities as Array<{ processName: string; processTitle?: string | null }>) {
    const key = item.processName.toLowerCase()
    if (!key) continue
    if (seenProcess.has(key)) continue
    seenProcess.add(key)
    const processKey = normalizeProcessName(item.processName)
    const maskedTitle = nameOnlySet.has(processKey) ? null : item.processTitle
    const ruleStatusText = applyMessageRule(
      item.processName,
      item.processTitle ?? null,
      maskedTitle ?? null,
      appMessageRules,
    )
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
    activeStatuses: activeStatuses.map((i) => stripMediaByPlaySource(i, mediaPlaySourceRules)),
    recentActivities: (recentActivities as unknown as ActivityFeedItem[]).map((i) =>
      stripMediaByPlaySource(i, mediaPlaySourceRules),
    ),
    historyWindowMinutes,
    processStaleSeconds: defaultStaleSeconds,
    recentTopApps: recentTopApps.map((i) => stripMediaByPlaySource(i, mediaPlaySourceRules)),
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
