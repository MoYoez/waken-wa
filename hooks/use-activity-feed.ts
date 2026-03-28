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

// 配置常量 - 用于优化资源消耗
const SSE_RECONNECT_DELAY_MS = 3000 // SSE 断开后重连延迟
const POLLING_INTERVAL_MS = 30000 // 轮询间隔 30 秒
const MAX_SSE_FAILURES = 3 // SSE 失败多少次后降级到轮询

interface UseActivityFeedOptions {
  /** 更新模式，由服务端配置传入 */
  mode?: ActivityUpdateMode
}

export function useActivityFeed(options: UseActivityFeedOptions = {}) {
  const { mode = 'sse' } = options
  
  const [feed, setFeed] = useState<ActivityFeedData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connectionMode, setConnectionMode] = useState<'sse' | 'realtime' | 'polling'>(mode)
  
  const failureCountRef = useRef(0)
  const eventSourceRef = useRef<EventSource | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const realtimeChannelRef = useRef<unknown>(null)

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
    }, POLLING_INTERVAL_MS)
  }, [fetchData])

  // 停止轮询
  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  // 清理所有连接
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
    // Realtime cleanup handled separately
  }, [stopPolling])

  // 连接 SSE
  const connectSSE = useCallback(() => {
    cleanupAll()

    const source = new EventSource('/api/activity/stream')
    eventSourceRef.current = source
    setConnectionMode('sse')

    const onActivity = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data)
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

  // 连接 Supabase Realtime
  const connectRealtime = useCallback(async () => {
    cleanupAll()
    setConnectionMode('realtime')

    try {
      // 动态导入 Supabase 客户端
      const { createClient } = await import('@supabase/supabase-js')
      
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseAnonKey) {
        setError('Supabase 配置缺失，已切换到轮询模式')
        startPolling()
        return
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey)

      // 首次获取数据
      await fetchData()

      // 订阅 activity_logs 表的变化
      const channel = supabase
        .channel('activity-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'activity_logs',
          },
          () => {
            // 当有变化时重新获取数据
            void fetchData()
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setError(null)
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setError('Realtime 连接失败，已切换到轮询模式')
            channel.unsubscribe()
            startPolling()
          }
        })

      realtimeChannelRef.current = channel

      return () => {
        channel.unsubscribe()
      }
    } catch (err) {
      console.error('Realtime connection error:', err)
      setError('Realtime 连接失败，已切换到轮询模式')
      startPolling()
    }
  }, [cleanupAll, fetchData, startPolling])

  useEffect(() => {
    let cleanup: (() => void) | undefined

    if (mode === 'polling') {
      startPolling()
    } else if (mode === 'realtime') {
      void connectRealtime().then((c) => {
        cleanup = c
      })
    } else {
      // 默认 SSE
      cleanup = connectSSE()
    }

    return () => {
      cleanup?.()
      cleanupAll()
      // Cleanup realtime channel
      if (realtimeChannelRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (realtimeChannelRef.current as any)?.unsubscribe?.()
        realtimeChannelRef.current = null
      }
    }
  }, [mode, connectSSE, connectRealtime, startPolling, cleanupAll])

  return { feed, error, connectionMode }
}
