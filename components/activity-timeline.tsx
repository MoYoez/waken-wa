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

export function ActivityTimeline() {
  const { feed, error } = useActivityFeed()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  if (error) {
    return (
      <div className="text-sm text-destructive">
        无法加载活动历史
      </div>
    )
  }

  const activities = feed?.recentTopApps || []

  if (activities.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <div className="text-sm">暂无活动记录</div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        {activities.map((activity) => {
          const batteryLabel = getBatteryLabel(activity.metadata)
          const deviceType = getDeviceType(activity.device, activity.metadata)
          const duration = activity.endedAt
            ? Math.round(
                (new Date(activity.endedAt).getTime() -
                  new Date(activity.startedAt).getTime()) /
                  1000 /
                  60
              )
            : Math.round(
                (Date.now() - new Date(activity.startedAt).getTime()) /
                  1000 /
                  60
              )

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
                    <span className="text-sm text-foreground">{activity.processName}</span>
                  </div>

                  {activity.processTitle && (
                    <div className="text-xs text-muted-foreground truncate mb-2">
                      {activity.processTitle}
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-xs text-muted-foreground/70">
                    <span className="inline-flex items-center gap-1.5">
                      {deviceType === 'mobile' ? (
                        <Smartphone className="h-3.5 w-3.5" />
                      ) : deviceType === 'tablet' ? (
                        <Tablet className="h-3.5 w-3.5" />
                      ) : (
                        <Laptop className="h-3.5 w-3.5" />
                      )}
                      {activity.device}
                      {batteryLabel ? ` · 电量 ${batteryLabel}` : ''}
                    </span>
                    <span>
                      {format(new Date(activity.startedAt), 'HH:mm', {
                        locale: zhCN,
                      })}
                    </span>
                    {duration > 0 && (
                      <span>
                        {duration < 60
                          ? `${duration}分钟`
                          : `${Math.floor(duration / 60)}小时${duration % 60}分钟`}
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
