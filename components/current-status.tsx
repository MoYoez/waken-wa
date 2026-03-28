'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { AppWindow, Battery, Clock, Laptop, Music, Smartphone, Tablet } from 'lucide-react'
import { getMediaDisplay } from '@/lib/activity-media'
import { useActivityFeed } from '@/hooks/use-activity-feed'
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

interface CurrentStatusProps {
  hideActivityMedia?: boolean
  activityUpdateMode?: ActivityUpdateMode
}

export function CurrentStatus({ hideActivityMedia = false, activityUpdateMode = 'sse' }: CurrentStatusProps) {
  const { feed, error } = useActivityFeed({ mode: activityUpdateMode })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  if (error) {
    return (
      <div className="text-sm text-destructive">
        {error}
      </div>
    )
  }

  const statuses = feed?.activeStatuses ?? []

  if (statuses.length === 0) {
    return (
      <div className="border border-border rounded-lg shadow-sm p-6 sm:p-8 bg-card">
        <div className="text-center text-muted-foreground">
          <div className="text-sm">暂无设备在线状态</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {statuses.map((activity) => {
        const timestampFormat = 'MM/dd HH:mm:ss'
        const batteryLabel = getBatteryLabel(activity.metadata)
        const deviceName =
          activity.device ||
          (activity.deviceId != null ? `device #${activity.deviceId}` : `activity #${activity.id}`)
        const deviceType = getDeviceType(deviceName, activity.metadata)
        const lastReportAt = activity.lastReportAt || activity.updatedAt || activity.startedAt
        const statusLine = typeof activity.statusText === 'string' ? activity.statusText.trim() : ''
        const media = hideActivityMedia ? null : getMediaDisplay(activity.metadata)

        return (
          <div
            key={`${activity.deviceId ?? 'na'}-${activity.id}`}
            className="border border-border rounded-lg shadow-sm p-5 sm:p-6 bg-card transition-all hover:shadow-md hover:border-primary/25"
          >
            <div className="space-y-4">
              <div className="rounded-md bg-muted/30 px-3 py-2.5 space-y-2">
                <div className="text-xs font-medium text-muted-foreground tracking-tight mb-0.5">
                  设备
                </div>
                <div className="text-sm text-foreground flex items-center gap-2">
                  {deviceType === 'mobile' ? (
                    <Smartphone className="h-4 w-4 shrink-0 text-primary/80" />
                  ) : deviceType === 'tablet' ? (
                    <Tablet className="h-4 w-4 shrink-0 text-primary/80" />
                  ) : (
                    <Laptop className="h-4 w-4 shrink-0 text-primary/80" />
                  )}
                  <span className="font-medium">{deviceName}</span>
                </div>
                {batteryLabel ? (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Battery className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>电量 {batteryLabel}</span>
                  </div>
                ) : null}
              </div>

              <div className="flex items-start gap-2">
                <AppWindow className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" aria-hidden />
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-foreground/90 min-w-0">
                  {statusLine ? (
                    <span className="font-medium">{statusLine}</span>
                  ) : (
                    <>
                      {activity.processTitle ? (
                        <>
                          <span className="font-medium">{activity.processTitle}</span>
                          <span className="text-muted-foreground/50 select-none hidden sm:inline">|</span>
                        </>
                      ) : null}
                      <span className="text-muted-foreground">{activity.processName}</span>
                    </>
                  )}
                </div>
              </div>

              {media ? (
                <div className="flex items-start gap-2">
                  <Music className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" aria-hidden />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="text-sm font-medium text-foreground/90 break-words">{media.title}</div>
                    {media.singer ? (
                      <div className="text-xs text-muted-foreground break-words">{media.singer}</div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="pt-3 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="text-xs font-medium text-muted-foreground tracking-tight">
                      开始时间
                    </span>
                  </div>
                  <div className="text-xs tabular-nums pl-5">
                    {format(new Date(activity.startedAt), timestampFormat, { locale: zhCN })}
                  </div>
                </div>
                <div className="flex flex-col gap-1 sm:ml-auto sm:items-end">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="text-xs font-medium text-muted-foreground tracking-tight">最后上报</span>
                  </div>
                  <div className="text-xs tabular-nums pl-5 sm:pl-0 w-full sm:text-right">
                    {format(new Date(lastReportAt), timestampFormat, { locale: zhCN })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
