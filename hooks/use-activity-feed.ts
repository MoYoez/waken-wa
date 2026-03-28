'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

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

// 配置常量 - 用于优化资源消耗
const SSE_RECONNECT_DELAY_MS = 3000 // SSE 断开后重连延迟
const FALLBACK_POLL_INTERVAL_MS = 30000 // 降级轮询间隔
const MAX_SSE_FAILURES = 3 // SSE 失败多少次后降级到轮询

export function useActivityFeed() {
  const [feed, setFeed] = useState<ActivityFeedData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connectionMode, setConnectionMode] = useState<'sse' | 'polling'>('sse')
  
  const failureCountRef = useRef(0)
  const eventSourceRef = useRef<EventSource | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 普通 HTTP 轮询获取数据（使用公开模式 API）
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/activity?public=1', { cache: 'no-store' })
      if (!res.ok) throw new Error('获取数据失败')
      const json = await res.json()
      if (json?.success && json?.data) {
        setFeed(json.data)
        setError(null)
      }
    } catch {
      setError('获取活动数据失败')
    }
  }, [])

  // 启动轮询模式
  const startPolling = useCallback(() => {
    if (pollTimerRef.current) return
    setConnectionMode('polling')
    // 立即获取一次
    void fetchData()
    pollTimerRef.current = setInterval(() => {
      void fetchData()
    }, FALLBACK_POLL_INTERVAL_MS)
  }, [fetchData])

  // 停止轮询
  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  // 连接 SSE
  const connectSSE = useCallback(() => {
    // 清理旧连接
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }

    const source = new EventSource('/api/activity/stream')
    eventSourceRef.current = source
    setConnectionMode('sse')
    stopPolling()

    const onActivity = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data)
        if (payload?.success && payload?.data) {
          setFeed(payload.data)
          setError(null)
          failureCountRef.current = 0 // 成功后重置失败计数
        }
      } catch {
        setError('实时数据解析失败')
      }
    }

    const onError = () => {
      failureCountRef.current++
      
      // 关闭当前连接
      source.close()
      eventSourceRef.current = null

      if (failureCountRef.current >= MAX_SSE_FAILURES) {
        // 失败次数过多，降级到轮询模式
        setError('实时连接不稳定，已切换到轮询模式')
        startPolling()
      } else {
        // 尝试重连
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
  }, [startPolling, stopPolling])

  useEffect(() => {
    const cleanup = connectSSE()

    return () => {
      cleanup?.()
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      stopPolling()
    }
  }, [connectSSE, stopPolling])

  return { feed, error, connectionMode }
}
