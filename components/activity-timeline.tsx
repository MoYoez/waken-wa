'use client'

import { Battery, BatteryCharging, Laptop, Music, Smartphone, Tablet } from 'lucide-react'
import { useT } from 'next-i18next/client'

import { useSiteTimeFormat } from '@/components/site-timezone-provider'
import { useActivityFeed } from '@/hooks/use-activity-feed'
import { useIsClient } from '@/hooks/use-is-client'
import { useTickingMs } from '@/hooks/use-ticking-ms'
import { isDeviceBatteryCharging } from '@/lib/activity-battery-metadata'
import { getMediaDisplay } from '@/lib/activity-media'
import type { ActivityUpdateMode } from '@/lib/activity-update-mode'

function getBatteryLabel(metadata: Record<string, unknown> | null | undefined): string | null {
  const value = metadata?.deviceBatteryPercent
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const clamped = Math.min(Math.max(Math.round(value), 0), 100)
  return `${clamped}%`
}

function getDeviceType(
  deviceName: string,
  metadata: Record<string, unknown> | null | undefined
): 'mobile' | 'tablet' | 'desktop' {
  const explicit = String(metadata?.deviceType ?? '').trim().toLowerCase()
  if (explicit === 'mobile' || explicit === 'tablet' || explicit === 'desktop') return explicit
  const source = deviceName.toLowerCase()
  if (/ipad|tablet|tab|平板/.test(source)) return 'tablet'
  if (/iphone|android|mobile|phone|手机/.test(source)) return 'mobile'
  return 'desktop'
}

export function ActivityTimeline({
  hideActivityMedia = false,
  activityUpdateMode = 'sse',
}: {
  hideActivityMedia?: boolean
  activityUpdateMode?: ActivityUpdateMode
}) {
  const { t } = useT('common')
  const { feed, error } = useActivityFeed({ mode: activityUpdateMode })
  const mounted = useIsClient()
  const liveMs = useTickingMs(30_000)
  const { formatPattern } = useSiteTimeFormat()

  if (!mounted) return null

  if (error) {
    return (
      <div className="text-sm text-destructive">
        {t('site.activityTimeline.loadFailed')}
      </div>
    )
  }

  const activities = feed?.recentTopApps || []

  if (activities.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <div className="text-sm">{t('site.activityTimeline.empty')}</div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        {activities.map((activity) => {
          const batteryLabel = getBatteryLabel(activity.metadata)
          const charging = isDeviceBatteryCharging(activity.metadata)
          const deviceName =
            activity.device ||
            (activity.deviceId != null
              ? t('site.currentStatus.deviceFallback', { id: activity.deviceId })
              : t('site.currentStatus.activityFallback', { id: activity.id }))
          const deviceType = getDeviceType(deviceName, activity.metadata)
          const media = hideActivityMedia ? null : getMediaDisplay(activity.metadata)
          const startedMs = new Date(activity.startedAt).getTime()
          const duration =
            activity.endedAt != null
              ? Math.round(
                  (new Date(activity.endedAt).getTime() - startedMs) / 1000 / 60
                )
              : liveMs == null
                ? 0
                : Math.round((liveMs - startedMs) / 1000 / 60)

          return (
            <div
              key={activity.id}
              className="border border-border rounded-sm p-4 bg-card hover:border-foreground/20 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {!activity.endedAt && (
                      <div className="w-1.5 h-1.5 rounded-full bg-online animate-pulse flex-shrink-0"></div>
                    )}
                    <span className="text-sm text-foreground">
                      {typeof activity.statusText === 'string' && activity.statusText.trim()
                        ? activity.statusText.trim()
                        : activity.processName}
                    </span>
                  </div>

                  {activity.processTitle && (
                    <div className="text-xs text-muted-foreground truncate mb-2">
                      {activity.processTitle}
                    </div>
                  )}

                  {media ? (
                    <div className="flex items-start gap-1.5 text-xs text-muted-foreground mb-2 min-w-0">
                      <Music className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
                      <span className="min-w-0 break-words">
                        {media.title}
                        {media.singer ? (
                          <span className="text-muted-foreground/80"> · {media.singer}</span>
                        ) : null}
                      </span>
                    </div>
                  ) : null}

                  <div className="flex items-center gap-3 text-xs text-muted-foreground/70">
                    <span className="inline-flex items-center gap-1.5 flex-wrap min-w-0">
                      {deviceType === 'mobile' ? (
                        <Smartphone className="h-3.5 w-3.5 shrink-0" />
                      ) : deviceType === 'tablet' ? (
                        <Tablet className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <Laptop className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span className="min-w-0 inline-flex items-center gap-1.5 flex-wrap">
                        <span>{deviceName}</span>
                        {batteryLabel ? (
                          <span className="inline-flex items-center gap-1">
                            {charging ? (
                              <BatteryCharging
                                className="h-3.5 w-3.5 shrink-0"
                                aria-hidden
                              />
                            ) : (
                              <Battery className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            )}
                            <span>{` · ${t('site.currentStatus.batteryLabel', { value: batteryLabel })}`}</span>
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <span>
                      {formatPattern(activity.startedAt, 'HH:mm', '--')}
                    </span>
                    {duration > 0 && (
                      <span>
                        {duration < 60
                          ? t('site.activityTimeline.durationMinutes', { value: duration })
                          : t('site.activityTimeline.durationHoursMinutes', {
                              hours: Math.floor(duration / 60),
                              minutes: duration % 60,
                            })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
