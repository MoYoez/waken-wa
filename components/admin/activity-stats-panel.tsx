'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  AppWindow,
  BarChart3,
  Boxes,
  Flame,
  Laptop,
  MonitorSmartphone,
  RefreshCw,
  Smartphone,
  Sparkles,
} from 'lucide-react'
import { useT } from 'next-i18next/client'
import { useMemo, useState } from 'react'

import { fetchActivityStats } from '@/components/admin/admin-query-fetchers'
import { adminQueryKeys } from '@/components/admin/admin-query-keys'
import { useSiteTimeFormat } from '@/components/site-timezone-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ACTIVITY_STATS_DEFAULT_RANGE_DAYS,
  ACTIVITY_STATS_RANGE_OPTIONS,
} from '@/constants/activity-stats'
import type {
  ActivityStatsAppRankItem,
  ActivityStatsHeatmapCell,
  ActivityStatsRankItem,
  ActivityStatsResponse,
} from '@/types/activity-stats'

import { FormatOverviewRelativeTime } from './dashboard-utils'

const HEATMAP_HOURS = Array.from({ length: 24 }, (_, hour) => hour)
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

function PercentOf(value: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((value / total) * 100)
}

function HeatColor(ratio: number): string {
  if (ratio <= 0) return 'rgba(148, 163, 184, 0.12)'
  const alpha = 0.18 + Math.min(1, ratio) * 0.72
  return `rgba(99, 102, 241, ${alpha.toFixed(3)})`
}

export function ActivityStatsPanel() {
  const { t, i18n } = useT('admin')
  const { formatPattern } = useSiteTimeFormat()
  const [rangeDays, setRangeDays] = useState<number>(ACTIVITY_STATS_DEFAULT_RANGE_DAYS)

  const statsQuery = useQuery({
    queryKey: adminQueryKeys.activity.stats({ days: rangeDays }),
    queryFn: () => fetchActivityStats({ days: rangeDays }),
  })

  const data = statsQuery.data
  const justNowLabel = t('dashboard.justNow')

  if (statsQuery.isLoading) {
    return <ActivityStatsSkeleton />
  }

  if (statsQuery.isError || !data) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
        {t('dashboard.stats.loadFailed')}
        <div className="mt-3">
          <Button size="sm" variant="outline" onClick={() => void statsQuery.refetch()}>
            <RefreshCw className="h-4 w-4" />
            {t('common.refresh')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <StatsHeader
        data={data}
        rangeDays={rangeDays}
        onRangeChange={setRangeDays}
        fetching={statsQuery.isFetching}
        onRefresh={() => void statsQuery.refetch()}
        label={{
          rangeLabel: t('dashboard.stats.rangeLabel'),
          rangeDays: (days: number) => t('dashboard.stats.rangeDays', { days }),
          timezone: t('dashboard.stats.timezone', { value: data.timezone }),
          refresh: t('common.refresh'),
        }}
      />

      <StatsTotals data={data} t={t} />

      <section className="grid gap-4 lg:grid-cols-2">
        <RankCard
          title={t('dashboard.stats.topApps')}
          description={t('dashboard.stats.topAppsDescription')}
          icon={<AppWindow className="h-5 w-5 text-primary" />}
          emptyLabel={t('dashboard.stats.empty')}
          hitsLabel={t('dashboard.stats.hits')}
          items={data.topApps}
        />
        <RankCard
          title={t('dashboard.stats.topPlaySources')}
          description={t('dashboard.stats.topPlaySourcesDescription')}
          icon={<Sparkles className="h-5 w-5 text-primary" />}
          emptyLabel={t('dashboard.stats.empty')}
          hitsLabel={t('dashboard.stats.hits')}
          items={data.topPlaySources}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <PlatformSplitCard
          data={data}
          title={t('dashboard.stats.platformSplit')}
          description={t('dashboard.stats.platformSplitDescription')}
          pcLabel={t('dashboard.stats.platformPc')}
          mobileLabel={t('dashboard.stats.platformMobile')}
          emptyLabel={t('dashboard.stats.empty')}
        />
        <RecentAppsCard
          items={data.recentApps}
          title={t('dashboard.stats.recentApps')}
          description={t('dashboard.stats.recentAppsDescription')}
          emptyLabel={t('dashboard.stats.empty')}
          formatRelative={(value) => FormatOverviewRelativeTime(value, i18n.language, justNowLabel)}
        />
      </section>

      <TrendCard
        data={data}
        title={t('dashboard.stats.dailyTrend')}
        description={t('dashboard.stats.dailyTrendDescription')}
        appLabel={t('dashboard.stats.trendApps')}
        playLabel={t('dashboard.stats.trendPlaySources')}
        emptyLabel={t('dashboard.stats.trendEmpty')}
        formatDate={(value) => formatPattern(value, 'MM/dd', value)}
      />

      <HeatmapCard
        cells={data.hourlyHeatmap}
        title={t('dashboard.stats.heatmap')}
        description={t('dashboard.stats.heatmapDescription')}
        emptyLabel={t('dashboard.stats.trendEmpty')}
        weekdayLabels={[
          t('dashboard.stats.weekday.sun'),
          t('dashboard.stats.weekday.mon'),
          t('dashboard.stats.weekday.tue'),
          t('dashboard.stats.weekday.wed'),
          t('dashboard.stats.weekday.thu'),
          t('dashboard.stats.weekday.fri'),
          t('dashboard.stats.weekday.sat'),
        ]}
        lessLabel={t('dashboard.stats.heatmapLess')}
        moreLabel={t('dashboard.stats.heatmapMore')}
      />
    </div>
  )
}

type HeaderLabels = {
  rangeLabel: string
  rangeDays: (days: number) => string
  timezone: string
  refresh: string
}

function StatsHeader({
  data,
  rangeDays,
  onRangeChange,
  fetching,
  onRefresh,
  label,
}: {
  data: ActivityStatsResponse
  rangeDays: number
  onRangeChange: (days: number) => void
  fetching: boolean
  onRefresh: () => void
  label: HeaderLabels
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">{label.rangeLabel}</span>
        <div className="flex flex-wrap gap-1.5">
          {ACTIVITY_STATS_RANGE_OPTIONS.map((option) => (
            <Button
              key={option}
              size="sm"
              variant={option === rangeDays ? 'default' : 'outline'}
              className="h-8 px-3"
              onClick={() => onRangeChange(option)}
            >
              {label.rangeDays(option)}
            </Button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground tabular-nums">
          {data.rangeStartDate} ~ {data.rangeEndDate} · {label.timezone}
        </span>
        <Button size="sm" variant="outline" className="h-8" onClick={onRefresh} disabled={fetching}>
          <RefreshCw className={`h-4 w-4 ${fetching ? 'animate-spin' : ''}`} />
          {label.refresh}
        </Button>
      </div>
    </div>
  )
}

function StatsTotals({
  data,
  t,
}: {
  data: ActivityStatsResponse
  t: (key: string, options?: Record<string, unknown>) => string
}) {
  const totals = data.totals
  const items = [
    {
      key: 'rangeHitTotal',
      label: t('dashboard.stats.totals.rangeHits'),
      value: totals.rangeHitTotal,
      icon: <BarChart3 className="h-4 w-4 text-primary" />,
    },
    {
      key: 'appCount',
      label: t('dashboard.stats.totals.appCount'),
      value: totals.appCount,
      icon: <AppWindow className="h-4 w-4 text-primary" />,
    },
    {
      key: 'playSourceCount',
      label: t('dashboard.stats.totals.playSourceCount'),
      value: totals.playSourceCount,
      icon: <Sparkles className="h-4 w-4 text-primary" />,
    },
    {
      key: 'devices',
      label: t('dashboard.stats.totals.devices'),
      value: totals.deviceCount,
      hint: t('dashboard.stats.totals.devicesActive', { count: totals.deviceActiveCount }),
      icon: <MonitorSmartphone className="h-4 w-4 text-primary" />,
    },
    {
      key: 'appReportTotal',
      label: t('dashboard.stats.totals.appReportTotal'),
      value: totals.appReportTotal,
      icon: <Activity className="h-4 w-4 text-primary" />,
    },
    {
      key: 'inspirationCount',
      label: t('dashboard.stats.totals.inspirationCount'),
      value: totals.inspirationCount,
      icon: <Boxes className="h-4 w-4 text-primary" />,
    },
  ]
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div key={item.key} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {item.icon}
            <span>{item.label}</span>
          </div>
          <div className="mt-2 text-3xl font-semibold tabular-nums text-foreground">
            {item.value.toLocaleString()}
          </div>
          {item.hint ? (
            <div className="mt-1 text-xs text-muted-foreground">{item.hint}</div>
          ) : null}
        </div>
      ))}
    </section>
  )
}

function RankCard({
  title,
  description,
  icon,
  items,
  emptyLabel,
  hitsLabel,
}: {
  title: string
  description: string
  icon: React.ReactNode
  items: Array<ActivityStatsRankItem | ActivityStatsAppRankItem>
  emptyLabel: string
  hitsLabel: string
}) {
  const maxHits = items.reduce((max, item) => Math.max(max, item.hitCount), 0)
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 font-semibold text-foreground">
        {icon}
        <span>{title}</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <Separator className="my-4" />
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ol className="space-y-3">
          {items.map((item, index) => {
            const appItem = 'platforms' in item ? item : null
            return (
              <li key={`${item.key}-${index}`} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="w-5 shrink-0 text-right text-xs font-medium text-muted-foreground tabular-nums">
                      {index + 1}
                    </span>
                    <span className="truncate text-sm font-medium text-foreground">{item.key}</span>
                    {appItem?.platforms.map((platform) => (
                      <Badge key={platform} variant="secondary" className="shrink-0 text-[10px]">
                        {platform}
                      </Badge>
                    ))}
                  </div>
                  <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                    {item.hitCount.toLocaleString()} {hitsLabel}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{ width: `${PercentOf(item.hitCount, maxHits)}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

function PlatformSplitCard({
  data,
  title,
  description,
  pcLabel,
  mobileLabel,
  emptyLabel,
}: {
  data: ActivityStatsResponse
  title: string
  description: string
  pcLabel: string
  mobileLabel: string
  emptyLabel: string
}) {
  const { pc, mobile } = data.platformSplit
  const total = pc + mobile
  const pcPercent = PercentOf(pc, total)
  const mobilePercent = total > 0 ? 100 - pcPercent : 0
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 font-semibold text-foreground">
        <MonitorSmartphone className="h-5 w-5 text-primary" />
        <span>{title}</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <Separator className="my-4" />
      {total === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="space-y-4">
          <div className="flex h-3 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary/70" style={{ width: `${pcPercent}%` }} />
            <div className="h-full bg-sky-400/70" style={{ width: `${mobilePercent}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border/60 p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Laptop className="h-4 w-4" />
                {pcLabel}
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                {pcPercent}%
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">
                {pc.toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg border border-border/60 p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Smartphone className="h-4 w-4" />
                {mobileLabel}
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                {mobilePercent}%
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">
                {mobile.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RecentAppsCard({
  items,
  title,
  description,
  emptyLabel,
  formatRelative,
}: {
  items: ActivityStatsAppRankItem[]
  title: string
  description: string
  emptyLabel: string
  formatRelative: (value: string | null) => string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 font-semibold text-foreground">
        <Activity className="h-5 w-5 text-primary" />
        <span>{title}</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <Separator className="my-4" />
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item, index) => (
            <li key={`${item.key}-${index}`} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground">{item.key}</div>
                {item.lastTitle ? (
                  <div className="truncate text-xs text-muted-foreground">{item.lastTitle}</div>
                ) : null}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatRelative(item.lastSeenAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function TrendCard({
  data,
  title,
  description,
  appLabel,
  playLabel,
  emptyLabel,
  formatDate,
}: {
  data: ActivityStatsResponse
  title: string
  description: string
  appLabel: string
  playLabel: string
  emptyLabel: string
  formatDate: (value: string) => string
}) {
  const points = data.dailyTrend
  const maxValue = useMemo(
    () => points.reduce((max, point) => Math.max(max, point.appHits + point.playHits), 0),
    [points],
  )
  const hasData = maxValue > 0
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <BarChart3 className="h-5 w-5 text-primary" />
          <span>{title}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-primary/70" />
            {appLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-sky-400/70" />
            {playLabel}
          </span>
        </div>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <Separator className="my-4" />
      {!hasData ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="flex h-44 items-end gap-[3px] overflow-x-auto">
          {points.map((point) => {
            const total = point.appHits + point.playHits
            const appHeight = total > 0 ? PercentOf(point.appHits, maxValue) : 0
            const playHeight = total > 0 ? PercentOf(point.playHits, maxValue) : 0
            return (
              <div
                key={point.date}
                className="group flex min-w-[8px] flex-1 flex-col items-center justify-end"
                title={`${formatDate(point.date)} · ${appLabel} ${point.appHits} · ${playLabel} ${point.playHits}`}
              >
                <div className="flex w-full flex-col justify-end" style={{ height: '150px' }}>
                  <div
                    className="w-full rounded-t-sm bg-sky-400/70"
                    style={{ height: `${playHeight}%` }}
                  />
                  <div className="w-full bg-primary/70" style={{ height: `${appHeight}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function HeatmapCard({
  cells,
  title,
  description,
  emptyLabel,
  weekdayLabels,
  lessLabel,
  moreLabel,
}: {
  cells: ActivityStatsHeatmapCell[]
  title: string
  description: string
  emptyLabel: string
  weekdayLabels: string[]
  lessLabel: string
  moreLabel: string
}) {
  const grid = useMemo(() => {
    const map = new Map<string, number>()
    let max = 0
    for (const cell of cells) {
      map.set(`${cell.weekday}:${cell.hour}`, cell.hitCount)
      max = Math.max(max, cell.hitCount)
    }
    return { map, max }
  }, [cells])
  const hasData = grid.max > 0
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 font-semibold text-foreground">
        <Flame className="h-5 w-5 text-primary" />
        <span>{title}</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <Separator className="my-4" />
      {!hasData ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="space-y-3">
          <div className="overflow-x-auto">
            <div className="min-w-[640px] space-y-1">
              <div className="flex gap-1 pl-10">
                {HEATMAP_HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="flex-1 text-center text-[9px] text-muted-foreground tabular-nums"
                  >
                    {hour % 3 === 0 ? hour : ''}
                  </div>
                ))}
              </div>
              {WEEKDAY_ORDER.map((weekday) => (
                <div key={weekday} className="flex items-center gap-1">
                  <div className="w-9 shrink-0 text-right text-[10px] text-muted-foreground">
                    {weekdayLabels[weekday]}
                  </div>
                  <div className="flex flex-1 gap-1">
                    {HEATMAP_HOURS.map((hour) => {
                      const value = grid.map.get(`${weekday}:${hour}`) ?? 0
                      return (
                        <div
                          key={hour}
                          className="aspect-square flex-1 rounded-[3px]"
                          style={{ backgroundColor: HeatColor(value / grid.max) }}
                          title={`${weekdayLabels[weekday]} ${String(hour).padStart(2, '0')}:00 · ${value}`}
                        />
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
            <span>{lessLabel}</span>
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
              <span
                key={ratio}
                className="h-3 w-3 rounded-[3px]"
                style={{ backgroundColor: HeatColor(ratio) }}
              />
            ))}
            <span>{moreLabel}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function ActivityStatsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-16 w-full rounded-xl" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <Skeleton className="h-56 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )
}
