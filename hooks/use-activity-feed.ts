'use client'

import { useEffect, useState } from 'react'

interface ActivityItem {
  id: number
  deviceId?: number | null
  device: string
  processName: string
  processTitle: string | null
  startedAt: string
  endedAt: string | null
  /** Includes optional `media: { title?: string; singer?: string }` for now-playing. */
  metadata?: Record<string, unknown> | null
  statusText?: string
  pushMode?: 'realtime' | 'active'
  lastReportAt?: string
  updatedAt?: string
}

interface ActivityFeedData {
  activeStatuses: ActivityItem[]
  recentActivities: ActivityItem[]
  historyWindowMinutes: number
  recentTopApps: ActivityItem[]
  generatedAt: string
}

export function useActivityFeed() {
  const [feed, setFeed] = useState<ActivityFeedData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const source = new EventSource('/api/activity/stream')

    const onActivity = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data)
        if (payload?.success && payload?.data) {
          setFeed(payload.data)
          setError(null)
        }
      } catch {
        setError('实时数据解析失败')
      }
    }

    const onError = () => {
      setError('实时连接异常，正在重试')
    }

    source.addEventListener('activity', onActivity)
    source.addEventListener('error', onError)

    return () => {
      source.removeEventListener('activity', onActivity)
      source.removeEventListener('error', onError)
      source.close()
    }
  }, [])

  return { feed, error }
}
