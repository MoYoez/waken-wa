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
  const staleSecondsRaw = Number(config?.processStaleSeconds ?? 500)
  const processStaleSeconds = Number.isFinite(staleSecondsRaw)
    ? Math.min(Math.max(Math.round(staleSecondsRaw), 30), 24 * 60 * 60)
    : 500
  const appMessageRules: Array<{ match: string; text: string }> = Array.isArray(config?.appMessageRules)
    ? config.appMessageRules
    : []
  const since = new Date(Date.now() - historyWindowMinutes * 60 * 1000)
  const staleBefore = new Date(Date.now() - processStaleSeconds * 1000)

  await prisma.activityLog.updateMany({
    where: {
      endedAt: null,
      startedAt: { lt: staleBefore },
    },
    data: {
      endedAt: new Date(),
    },
  })

  const [recentActivities, openActivities] = await Promise.all([
    prisma.activityLog.findMany({
      where: { startedAt: { gte: since } },
      orderBy: { startedAt: 'desc' },
      take: Math.min(limit, 100),
    }),
    prisma.activityLog.findMany({
      where: { endedAt: null },
      orderBy: { startedAt: 'desc' },
      take: 200,
    }),
  ])

  // Keep latest active entry for each device.
  const activeStatuses: any[] = []
  const seen = new Set<string>()
  for (const item of openActivities) {
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
    processStaleSeconds,
    recentTopApps,
    generatedAt: new Date().toISOString(),
  }
}
