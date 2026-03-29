import { eq } from 'drizzle-orm'

import {
  ACTIVITY_FEED_DEFAULT_LIMIT,
  ACTIVITY_FEED_QUERY_MAX_LIMIT,
  ACTIVITY_FEED_RECENT_TOP_APPS_MAX,
} from '@/lib/activity-api-constants'
import {
  cleanupStaleActivities,
  getAllActivities,
  redactGeneratedHashKeyForClient,
} from '@/lib/activity-store'
import { db } from '@/lib/db'
import { siteConfig } from '@/lib/drizzle-schema'
import {
  parseHistoryWindowMinutes,
  parseProcessStaleSeconds,
} from '@/lib/site-config-constants'
import { getSteamNowPlayingByDeviceHashes } from '@/lib/steam-feed-merge'
import {
  hydrateUserActivitiesIntoStoreOnce,
  purgeExpiredUserActivitiesFromDbAndMemory,
} from '@/lib/user-activity-hydration'
import type { ActivityFeedData, ActivityFeedItem } from '@/types/activity'

export { redactGeneratedHashKeyForClient }
export type { ActivityFeedData } from '@/types/activity'

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

export type GetActivityFeedOptions = {
  /**
   * When true and site `hideActivityMedia` is enabled, strip `metadata.media` from all items.
   * Public home (REST `?public=1`, SSE) should set this; admin session feed should omit it.
   */
  forPublicFeed?: boolean
}

function getPushModeFromMetadata(metadata: unknown): 'realtime' | 'active' {
  const meta = asObject(metadata)
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
  const [config] = await db.select().from(siteConfig).where(eq(siteConfig.id, 1)).limit(1)
  return parseHistoryWindowMinutes(config?.historyWindowMinutes)
}

export async function getActivityFeedData(
  limit = ACTIVITY_FEED_DEFAULT_LIMIT,
  options?: GetActivityFeedOptions,
): Promise<ActivityFeedData> {
  const [config] = await db.select().from(siteConfig).where(eq(siteConfig.id, 1)).limit(1)
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
    await hydrateUserActivitiesIntoStoreOnce()
  } catch (error) {
    console.error('[activity-feed] UserActivity purge/hydrate failed:', error)
  }

  cleanupStaleActivities(defaultStaleSeconds)

  const allActivities = getAllActivities()
  const since = Date.now() - historyWindowMinutes * 60 * 1000

  const stillActive = allActivities.filter(
    (a) => !a.endedAt && passesAppFilter(a.processName),
  )

  const recentActivitiesRaw = allActivities
    .filter((a) => a.startedAt.getTime() >= since)
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .slice(0, Math.min(limit, ACTIVITY_FEED_QUERY_MAX_LIMIT))

  const recentActivities = recentActivitiesRaw
    .filter((item) => passesAppFilter(item.processName))
    .map((item) => {
      const shaped =
        nameOnlySet.has(normalizeProcessName(item.processName))
          ? { ...item, processTitle: null }
          : { ...item }
      return redactGeneratedHashKeyForClient(shaped as unknown as Record<string, unknown>)
    })

  // Keep latest active entry for each device
  const activePending: Array<{ hashKey: string; row: Record<string, unknown> }> = []
  const seen = new Set<string>()
  for (const item of stillActive) {
    const processKey = normalizeProcessName(item.processName)
    const key = item.generatedHashKey
    if (!key) continue
    if (seen.has(key)) continue
    seen.add(key)
    const pushMode = getPushModeFromMetadata(item.metadata)
    const maskedTitle = nameOnlySet.has(processKey) ? null : item.processTitle
    const ruleStatusText = applyMessageRule(item.processName, maskedTitle, appMessageRules)
    const processTitleForClient = ruleStatusText ? null : maskedTitle
    const row: Record<string, unknown> = {
      ...item,
      processTitle: processTitleForClient,
      pushMode,
      lastReportAt: item.updatedAt ?? item.startedAt,
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

  const activeStatuses: ActivityFeedItem[] = []
  for (const { hashKey, row } of activePending) {
    const sp = steamByHash.get(hashKey)
    if (sp) row.steamNowPlaying = sp
    activeStatuses.push(redactGeneratedHashKeyForClient(row) as unknown as ActivityFeedItem)
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
    activeStatuses,
    recentActivities: recentActivities as unknown as ActivityFeedItem[],
    historyWindowMinutes,
    processStaleSeconds: defaultStaleSeconds,
    recentTopApps,
    generatedAt: new Date().toISOString(),
  } as ActivityFeedData

  const hideActivityMedia = config?.hideActivityMedia === true
  if (options?.forPublicFeed && hideActivityMedia) {
    return omitActivityMediaFromFeed(data)
  }
  return data
}
