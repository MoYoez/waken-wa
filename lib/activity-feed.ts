import prisma from '@/lib/prisma'

export interface ActivityFeedData {
  activeStatuses: any[]
  recentActivities: any[]
  historyWindowMinutes: number
  generatedAt: string
}

export async function getHistoryWindowMinutes(): Promise<number> {
  const config = await (prisma as any).siteConfig.findUnique({ where: { id: 1 } })
  const minutes = Number(config?.historyWindowMinutes ?? 120)
  if (!Number.isFinite(minutes)) return 120
  return Math.min(Math.max(Math.round(minutes), 10), 24 * 60)
}

export async function getActivityFeedData(limit = 50): Promise<ActivityFeedData> {
  const historyWindowMinutes = await getHistoryWindowMinutes()
  const since = new Date(Date.now() - historyWindowMinutes * 60 * 1000)

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
    activeStatuses.push(item)
  }

  return {
    activeStatuses,
    recentActivities,
    historyWindowMinutes,
    generatedAt: new Date().toISOString(),
  }
}
