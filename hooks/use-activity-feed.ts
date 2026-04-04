'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { ActivityUpdateMode } from '@/lib/activity-update-mode'
import type { ActivityFeedData } from '@/types/activity'

const SSE_RECONNECT_DELAY_MS = 3000
const POLLING_INTERVAL_MS = 30000
const MAX_SSE_FAILURES = 3

interface UseActivityFeedOptions {
  /** Server-rendered snapshot for immediate first paint. */
  initialFeed?: ActivityFeedData | null
  /** Update mode from server-side settings */
  mode?: ActivityUpdateMode
}

export function useActivityFeed(options: UseActivityFeedOptions = {}) {
  const { initialFeed = null, mode = 'sse' } = options

  const [feed, setFeed] = useState<ActivityFeedData | null>(initialFeed)
  const [error, setError] = useState<string | null>(null)
  const [connectionMode, setConnectionMode] = useState<'sse' | 'polling'>(mode)

  const failureCountRef = useRef(0)
  const eventSourceRef = useRef<EventSource | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** When false, SSE `error` events are ignored (tab hidden or effect teardown). */
  const allowSseReconnectRef = useRef(true)

  const [tabVisible, setTabVisible] = useState(true)

  useEffect(() => {
    setFeed(initialFeed)
  }, [initialFeed])

  useEffect(() => {
    const sync = () => setTabVisible(document.visibilityState === 'visible')
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [])

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
    if (!initialFeed) {
      void fetchData()
    }
    pollTimerRef.current = setInterval(() => {
      void fetchData()
    }, POLLING_INTERVAL_MS)
  }, [fetchData, initialFeed])

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
    allowSseReconnectRef.current = true
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
      if (!allowSseReconnectRef.current) return
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

  // A: provider stays on home only (unmount disconnects). C: pause while tab is hidden.
  useEffect(() => {
    if (!tabVisible) {
      allowSseReconnectRef.current = false
      cleanupAll()
      return
    }

    let cleanup: (() => void) | undefined

    if (mode === 'polling') {
      startPolling()
    } else {
      cleanup = connectSSE()
    }

    return () => {
      allowSseReconnectRef.current = false
      cleanup?.()
      cleanupAll()
    }
  }, [mode, tabVisible, connectSSE, startPolling, cleanupAll])

  return { feed, error, connectionMode }
}
