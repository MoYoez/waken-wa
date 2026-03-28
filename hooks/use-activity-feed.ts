'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ActivityUpdateMode } from '@/lib/activity-update-mode'

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

const SSE_RECONNECT_DELAY_MS = 3000
const POLLING_INTERVAL_MS = 30000
const MAX_SSE_FAILURES = 3

interface UseActivityFeedOptions {
  /** Update mode from server-side settings */
  mode?: ActivityUpdateMode
}

export function useActivityFeed(options: UseActivityFeedOptions = {}) {
  const { mode = 'sse' } = options

  const [feed, setFeed] = useState<ActivityFeedData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connectionMode, setConnectionMode] = useState<'sse' | 'polling'>(mode)

  const failureCountRef = useRef(0)
  const eventSourceRef = useRef<EventSource | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/activity?public=1', { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch failed')
      const json = await res.json()
      if (json?.success && json?.data) {
        setFeed(json.data)
        setError(null)
      }
    } catch {
      setError('获取活动数据失败')
    }
  }, [])

  const startPolling = useCallback(() => {
    if (pollTimerRef.current) return
    setConnectionMode('polling')
    void fetchData()
    pollTimerRef.current = setInterval(() => {
      void fetchData()
    }, POLLING_INTERVAL_MS)
  }, [fetchData])

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  const cleanupAll = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    stopPolling()
  }, [stopPolling])

  const connectSSE = useCallback(() => {
    cleanupAll()

    const source = new EventSource('/api/activity/stream')
    eventSourceRef.current = source
    setConnectionMode('sse')

    const onActivity = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as { success?: boolean; data?: ActivityFeedData }
        if (payload?.success && payload?.data) {
          setFeed(payload.data)
          setError(null)
          failureCountRef.current = 0
        }
      } catch {
        setError('实时数据解析失败')
      }
    }

    const onError = () => {
      failureCountRef.current++
      source.close()
      eventSourceRef.current = null

      if (failureCountRef.current >= MAX_SSE_FAILURES) {
        setError('实时连接不稳定，已切换到轮询模式')
        startPolling()
      } else {
        setError('实时连接异常，正在重试...')
        reconnectTimerRef.current = setTimeout(() => {
          connectSSE()
        }, SSE_RECONNECT_DELAY_MS)
      }
    }

    source.addEventListener('activity', onActivity)
    source.addEventListener('error', onError)

    return () => {
      source.removeEventListener('activity', onActivity)
      source.removeEventListener('error', onError)
      source.close()
    }
  }, [cleanupAll, startPolling])

  useEffect(() => {
    let cleanup: (() => void) | undefined

    if (mode === 'polling') {
      startPolling()
    } else {
      cleanup = connectSSE()
    }

    return () => {
      cleanup?.()
      cleanupAll()
    }
  }, [mode, connectSSE, startPolling, cleanupAll])

  return { feed, error, connectionMode }
}
