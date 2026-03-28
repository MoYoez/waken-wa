import prisma from '@/lib/prisma'
import {
  getAllActivities,
  cleanupStaleActivities,
  redactGeneratedHashKeyForClient,
  type ActivityEntry,
  type ActivityFeedData,
} from '@/lib/activity-store'

export { redactGeneratedHashKeyForClient, type ActivityFeedData }

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
  rules: Array<{ match: string; text: string }>
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
  const config = await (prisma as any).siteConfig.findUnique({ where: { id: 1 } })
  const minutes = Number(config?.historyWindowMinutes ?? 120)
  if (!Number.isFinite(minutes)) return 120
  return Math.min(Math.max(Math.round(minutes), 10), 24 * 60)
}

export async function getActivityFeedData(limit = 50): Promise<ActivityFeedData> {
  const config = await (prisma as any).siteConfig.findUnique({ where: { id: 1 } })
  const minutes = Number(config?.historyWindowMinutes ?? 120)
  const historyWindowMinutes = Number.isFinite(minutes)
    ? Math.min(Math.max(Math.round(minutes), 10), 24 * 60)
    : 120
  // 全局默认过期时间
  const staleSecondsRaw = Number(config?.processStaleSeconds ?? 500)
  const defaultStaleSeconds = Number.isFinite(staleSecondsRaw)
    ? Math.min(Math.max(Math.round(staleSecondsRaw), 30), 24 * 60 * 60)
    : 500
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

  // 清理过期活动
  cleanupStaleActivities(defaultStaleSeconds)

  // 从内存获取所有活动
  const allActivities = getAllActivities()
  const since = Date.now() - historyWindowMinutes * 60 * 1000

  // 过滤仍然活跃的活动
  const stillActive = allActivities.filter(
    (a) => !a.endedAt && passesAppFilter(a.processName)
  )

  // 过滤最近的活动（用于历史记录）
  const recentActivitiesRaw = allActivities
    .filter((a) => a.startedAt.getTime() >= since)
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .slice(0, Math.min(limit, 100))

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
  const activeStatuses: any[] = []
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
    activeStatuses.push(redactGeneratedHashKeyForClient(row))
  }

  const recentTopApps: any[] = []
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
      })
    } else {
      recentTopApps.push({
        ...item,
        processTitle: maskedTitle,
      })
    }
    if (recentTopApps.length >= 3) break
  }

  return {
    activeStatuses,
    recentActivities,
    historyWindowMinutes,
    processStaleSeconds: defaultStaleSeconds,
    recentTopApps,
    generatedAt: new Date().toISOString(),
  }
}
