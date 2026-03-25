'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useActivityFeed } from '@/hooks/use-activity-feed'

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
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-online animate-pulse"></div>
                <span className="text-xs text-online font-medium">进行中</span>
              </div>

              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                  Device
                </div>
                <div className="text-sm font-light">{activity.device}</div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                  Process
                </div>
                <div className="text-sm font-light">{activity.processName}</div>
              </div>

              {activity.processTitle && (
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                    Details
                  </div>
                  <div className="text-sm font-light text-foreground/80">
                    {activity.processTitle}
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-border grid grid-cols-2 gap-4 mt-4">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Started
                  </div>
                  <div className="text-xs font-light">
                    {format(new Date(activity.startedAt), 'HH:mm', { locale: zhCN })}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Duration
                  </div>
                  <div className="text-xs font-light">{durationStr}</div>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
