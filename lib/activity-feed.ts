import prisma from '@/lib/prisma'

export interface ActivityFeedData {
  activeStatuses: any[]
  recentActivities: any[]
  historyWindowMinutes: number
  historyWindowHintText: string
  processStaleSeconds: number
  recentTopApps: any[]
  generatedAt: string
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
  const historyWindowHintText =
    String(config?.historyWindowHintText ?? '').trim() ||
    '历史窗口：最近 2 小时（可在设置中调整）'
  // 全局默认过期时间（用于没有设置 reportIntervalSeconds 的活动）
  const staleSecondsRaw = Number(config?.processStaleSeconds ?? 500)
  const defaultStaleSeconds = Number.isFinite(staleSecondsRaw)
    ? Math.min(Math.max(Math.round(staleSecondsRaw), 30), 24 * 60 * 60)
    : 500
  const appMessageRules: Array<{ match: string; text: string }> = Array.isArray(config?.appMessageRules)
    ? config.appMessageRules
    : []
  const since = new Date(Date.now() - historyWindowMinutes * 60 * 1000)

  // 获取所有未结束的活动，然后根据每条活动的 reportIntervalSeconds 判断是否过期
  const openActivities = await prisma.activityLog.findMany({
    where: { endedAt: null },
    orderBy: { startedAt: 'desc' },
  })

  const now = Date.now()
  const toClose: number[] = []
  const stillActive: typeof openActivities = []

  for (const activity of openActivities) {
    // 优先使用活动自己的上报间隔，如果没有则使用全局默认值
    const intervalSeconds = activity.reportIntervalSeconds ?? defaultStaleSeconds
    // 使用 updatedAt（最后上报时间）来判断是否过期
    const lastReportTime = activity.updatedAt?.getTime() ?? activity.startedAt.getTime()
    const isStale = now - lastReportTime > intervalSeconds * 1000

    if (isStale) {
      toClose.push(activity.id)
    } else {
      stillActive.push(activity)
    }
  }

  // 批量关闭过期的活动
  if (toClose.length > 0) {
    await prisma.activityLog.updateMany({
      where: { id: { in: toClose } },
      data: { endedAt: new Date() },
    })
  }

  const recentActivities = await prisma.activityLog.findMany({
    where: { startedAt: { gte: since } },
    orderBy: { startedAt: 'desc' },
    take: Math.min(limit, 100),
  })

  // Keep latest active entry for each device (使用过滤后仍然活跃的活动)
  const activeStatuses: any[] = []
  const seen = new Set<string>()
  for (const item of stillActive) {
    if (seen.has(item.device)) continue
    seen.add(item.device)
    activeStatuses.push({
      ...item,
      statusText:
        applyMessageRule(item.processName, item.processTitle, appMessageRules) ||
        `正在使用 ${item.processName}${item.processTitle ? ` — ${item.processTitle}` : ''}`,
    })
  }

  const recentTopApps: any[] = []
  const seenProcess = new Set<string>()
  for (const item of recentActivities) {
    const key = item.processName.toLowerCase()
    if (seenProcess.has(key)) continue
    seenProcess.add(key)
    recentTopApps.push(item)
    if (recentTopApps.length >= 3) break
  }

  return {
    activeStatuses,
    recentActivities,
    historyWindowMinutes,
    historyWindowHintText,
    processStaleSeconds: defaultStaleSeconds,
    recentTopApps,
    generatedAt: new Date().toISOString(),
  }
}
