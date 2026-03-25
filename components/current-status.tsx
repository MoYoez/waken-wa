'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { Activity } from '@/lib/types'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function CurrentStatus() {
  const { data, error } = useSWR<{ data: Activity[] }>(
    '/api/activity?limit=1',
    fetcher,
    { refreshInterval: 30000 }
  )
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const activity = data?.data?.[0]

  if (error) {
    return (
      <div className="text-sm text-destructive">
        Unable to load current status
      </div>
    )
  }

  if (!activity) {
    return (
      <div className="border border-border rounded-sm p-6 sm:p-8 bg-card">
        <div className="text-center text-muted-foreground">
          <div className="text-sm">No activity recorded yet</div>
        </div>
      </div>
    )
  }

  const duration = activity.endedAt
    ? Math.round(
        (new Date(activity.endedAt).getTime() -
          new Date(activity.startedAt).getTime()) /
          1000
      )
    : Math.round(
        (Date.now() - new Date(activity.startedAt).getTime()) / 1000
      )

  const durationStr =
    duration < 60
      ? `${duration}s`
      : `${Math.floor(duration / 60)}m ${duration % 60}s`

  return (
    <div className="border border-border rounded-sm p-6 sm:p-8 bg-card hover:border-foreground/30 transition-colors">
      <div className="space-y-4">
        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-online animate-pulse"></div>
          <span className="text-xs text-online font-medium">
            {activity.endedAt ? 'Finished' : 'In Progress'}
          </span>
        </div>

        {/* Device & Process */}
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

        {/* Title */}
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

        {/* Time Info */}
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
}
