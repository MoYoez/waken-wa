'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Laptop, Smartphone, Tablet } from 'lucide-react'
import { useActivityFeed } from '@/hooks/use-activity-feed'

function getBatteryLabel(metadata: Record<string, unknown> | null | undefined): string | null {
  const value = metadata?.deviceBatteryPercent
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const clamped = Math.min(Math.max(Math.round(value), 0), 100)
  return `${clamped}%`
}

function getPushMode(
  metadata: Record<string, unknown> | null | undefined,
  fallback?: 'realtime' | 'active'
): 'realtime' | 'active' {
  if (fallback === 'active' || fallback === 'realtime') return fallback
  const raw = String(metadata?.pushMode ?? '').trim().toLowerCase()
  if (raw === 'active' || raw === 'persistent') return 'active'
  return 'realtime'
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

export function CurrentStatus() {
  const { feed, error } = useActivityFeed()
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
      <div className="border border-border rounded-sm p-6 sm:p-8 bg-card">
        <div className="text-center text-muted-foreground">
          <div className="text-sm">暂无设备在线状态</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {statuses.map((activity) => {
        const duration = Math.max(
          0,
          Math.round((Date.now() - new Date(activity.startedAt).getTime()) / 1000)
        )
        const timestampFormat = 'MM/dd HH:mm:ss'
        const batteryLabel = getBatteryLabel(activity.metadata)
        const pushMode = getPushMode(activity.metadata, activity.pushMode)
        const deviceType = getDeviceType(activity.device, activity.metadata)
        const lastReportAt = activity.lastReportAt || activity.updatedAt || activity.startedAt
        const durationStr =
          duration < 60
            ? `${duration}s`
            : `${Math.floor(duration / 60)}m ${duration % 60}s`

        return (
          <div
            key={`${activity.device}-${activity.id}`}
            className="border border-border rounded-sm p-6 sm:p-8 bg-card hover:border-foreground/30 transition-colors"
          >
            <div className="space-y-4">

              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                  Device
                </div>
                <div className="text-sm font-light flex items-center gap-2">
                  {deviceType === 'mobile' ? (
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                  ) : deviceType === 'tablet' ? (
                    <Tablet className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Laptop className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span>{activity.device}</span>
                </div>
                {batteryLabel && (
                  <div className="text-xs text-muted-foreground mt-1">电量 {batteryLabel}</div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {activity.processTitle && (
                  <>
                    <div className="text-sm font-light text-foreground/80">
                      {activity.processTitle}
                    </div>
                    <span className="mx-2 text-muted-foreground/40 select-none">|</span>
                  </>
                )}
                <div className="text-sm font-light">{activity.processName}</div>
              </div>

              <div className="pt-2 border-t border-border flex items-end mt-4 justify-between">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Started
                  </div>
                  <div className="text-xs font-light">
                    {format(new Date(activity.startedAt), timestampFormat, { locale: zhCN })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Last Update
                  </div>
                  <div className="text-xs font-light">
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
