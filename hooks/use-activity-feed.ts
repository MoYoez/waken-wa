'use client'

import { useEffect, useState } from 'react'

interface ActivityItem {
  id: number
  device: string
  processName: string
  processTitle: string | null
  startedAt: string
  endedAt: string | null
  metadata?: Record<string, unknown> | null
}

interface ActivityFeedData {
  activeStatuses: ActivityItem[]
  recentActivities: ActivityItem[]
  historyWindowMinutes: number
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
