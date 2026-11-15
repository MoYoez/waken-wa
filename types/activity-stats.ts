export type ActivityStatsRankItem = {
  key: string
  hitCount: number
  lastSeenAt: string | null
}

export type ActivityStatsAppRankItem = ActivityStatsRankItem & {
  seenCount: number
  lastTitle: string | null
  platforms: string[]
}

export type ActivityStatsTrendPoint = {
  date: string
  appHits: number
  playHits: number
}

export type ActivityStatsHeatmapCell = {
  weekday: number
  hour: number
  hitCount: number
}

export type ActivityStatsPlatformSplit = {
  pc: number
  mobile: number
}

export type ActivityStatsTotals = {
  appCount: number
  playSourceCount: number
  appReportTotal: number
  deviceCount: number
  deviceActiveCount: number
  inspirationCount: number
  rangeHitTotal: number
}

export type ActivityStatsDeviceItem = {
  id: number
  displayName: string
  status: string
  lastSeenAt: string | null
}

export type ActivityStatsResponse = {
  rangeDays: number
  rangeStartDate: string
  rangeEndDate: string
  timezone: string
  totals: ActivityStatsTotals
  topApps: ActivityStatsAppRankItem[]
  topPlaySources: ActivityStatsRankItem[]
  recentApps: ActivityStatsAppRankItem[]
  platformSplit: ActivityStatsPlatformSplit
  dailyTrend: ActivityStatsTrendPoint[]
  hourlyHeatmap: ActivityStatsHeatmapCell[]
  devices: ActivityStatsDeviceItem[]
}
