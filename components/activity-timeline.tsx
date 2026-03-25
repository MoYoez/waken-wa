'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useActivityFeed } from '@/hooks/use-activity-feed'

function getHoursAgo(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60))
}

function getTimeLabel(hoursAgo: number): string {
  if (hoursAgo === 0) return '刚才'
  if (hoursAgo === 1) return '1 小时前'
  if (hoursAgo < 24) return `${hoursAgo} 小时前`
  const daysAgo = Math.floor(hoursAgo / 24)
  if (daysAgo === 1) return '昨天'
  return `${daysAgo} 天前`
}

interface GroupedActivities {
  [key: string]: Array<{
    id: number
    device: string
    processName: string
    processTitle: string | null
    startedAt: string
    endedAt: string | null
  }>
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

  const activities = feed?.recentActivities || []

  if (activities.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <div className="text-sm">暂无活动记录</div>
      </div>
    )
  }

  // 按小时分组
  const grouped: GroupedActivities = {}
  activities.forEach((activity) => {
    const hoursAgo = getHoursAgo(new Date(activity.startedAt))
    const label = getTimeLabel(hoursAgo)
    if (!grouped[label]) {
      grouped[label] = []
    }
    grouped[label].push(activity)
  })

  const hours = Math.max(1, Math.round((feed?.historyWindowMinutes ?? 120) / 60))

  return (
    <div className="space-y-10">
      <div className="text-xs text-muted-foreground">
        历史窗口：最近 {hours} 小时（可在初始化配置中调整）
      </div>
      {Object.entries(grouped).map(([timeLabel, items]) => (
        <div key={timeLabel}>
          {/* 时间标签 */}
          <div className="text-sm text-foreground font-light mb-4">
            {timeLabel}，正在
          </div>

          {/* 活动列表 */}
          <div className="space-y-2">
            {items.map((activity) => {
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
                      {/* 主要信息 */}
                      <div className="flex items-center gap-2 mb-1">
                        {!activity.endedAt && (
                          <div className="w-1.5 h-1.5 rounded-full bg-online animate-pulse flex-shrink-0"></div>
                        )}
                        <span className="text-sm text-foreground">
                          {activity.processName}
                        </span>
                      </div>

                      {/* 标题 */}
                      {activity.processTitle && (
                        <div className="text-xs text-muted-foreground truncate mb-2">
                          {activity.processTitle}
                        </div>
                      )}

                      {/* 设备与时间 */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground/70">
                        <span>{activity.device}</span>
                        <span>
                          {format(new Date(activity.startedAt), 'HH:mm', {
                            locale: zhCN,
                          })}
                          {activity.endedAt &&
                            ` - ${format(new Date(activity.endedAt), 'HH:mm', {
                              locale: zhCN,
                            })}`}
                        </span>
                        {duration > 0 && (
                          <span>
                            {duration < 60 ? `${duration}分钟` : `${Math.floor(duration / 60)}小时${duration % 60}分钟`}
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
      ))}
    </div>
  )
}
