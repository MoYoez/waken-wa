'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { ActivityUpdateMode } from '@/lib/activity-update-mode'
import type { ActivityFeedData } from '@/types/activity'

const SSE_RECONNECT_DELAY_MS = 3000
const POLLING_INTERVAL_MS = 30000
const MAX_SSE_FAILURES = 3
const DEFAULT_REALTIME_START_DELAY_MS = 2500

function isDocumentPrerendering(): boolean {
  if (typeof document === 'undefined') return false
  // Speculation Rules / cross-document prerender: until the page is activated,
  // document.prerendering === true. Opening EventSource here would burn one of
  // the server's concurrent SSE slots for a tab the user may never visit.
  return (document as Document & { prerendering?: boolean }).prerendering === true
}

function scheduleAfterPrerenderActivation(callback: () => void): () => void {
  if (typeof document === 'undefined') return () => undefined
  if (!isDocumentPrerendering()) {
    callback()
    return () => undefined
  }
  const onActivate = () => {
    document.removeEventListener('prerenderingchange', onActivate)
    callback()
  }
  document.addEventListener('prerenderingchange', onActivate, { once: true })
  return () => document.removeEventListener('prerenderingchange', onActivate)
}

function scheduleWhenIdle(callback: () => void, fallbackDelayMs: number): () => void {
  if (typeof window === 'undefined') {
    callback()
    return () => undefined
  }
  const ric = (window as Window & {
    requestIdleCallback?: (
      cb: () => void,
      options?: { timeout?: number },
    ) => number
    cancelIdleCallback?: (handle: number) => void
  }).requestIdleCallback
  if (typeof ric === 'function') {
    const handle = ric(callback, { timeout: Math.max(fallbackDelayMs, 1000) })
    return () => {
      const cic = (window as Window & {
        cancelIdleCallback?: (handle: number) => void
      }).cancelIdleCallback
      if (typeof cic === 'function') cic(handle)
    }
  }
  const timer = window.setTimeout(callback, fallbackDelayMs)
  return () => window.clearTimeout(timer)
}

interface UseActivityFeedOptions {
  /** Server-rendered snapshot for immediate first paint. */
  initialFeed?: ActivityFeedData | null
  /** Update mode from server-side settings */
  mode?: ActivityUpdateMode
  /** Delay realtime connection when an SSR snapshot already exists, keeping it out of the initial critical path. */
  realtimeStartDelayMs?: number
}

export function useActivityFeed(options: UseActivityFeedOptions = {}) {
  const {
    initialFeed = null,
    mode = 'sse',
    realtimeStartDelayMs = DEFAULT_REALTIME_START_DELAY_MS,
  } = options

  const [feed, setFeed] = useState<ActivityFeedData | null>(initialFeed)
  const [error, setError] = useState<string | null>(null)
  const [connectionMode, setConnectionMode] = useState<'sse' | 'polling'>(mode)

  const failureCountRef = useRef(0)
  const eventSourceRef = useRef<EventSource | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const realtimeStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
      const res = await fetch('/api/activity?public=1', { cache: 'no-cache' })
      if (!res.ok) throw new Error('fetch failed')
      const json = await res.json()
      if (json?.success && json?.data) {
        setFeed(json.data)
        setError(null)
      }
    } catch {
      setError('Failed to fetch activity data')
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
    if (realtimeStartTimerRef.current) {
      clearTimeout(realtimeStartTimerRef.current)
      realtimeStartTimerRef.current = null
    }
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
        setError('Failed to parse realtime data')
      }
    }

    const onError = () => {
      if (!allowSseReconnectRef.current) return
      failureCountRef.current++
      source.close()
      eventSourceRef.current = null

      if (failureCountRef.current >= MAX_SSE_FAILURES) {
        setError('Realtime connection is unstable. Switched to polling mode.')
        startPolling()
      } else {
        setError('Realtime connection error. Retrying...')
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
    let cancelPrerenderListener: (() => void) | undefined
    let cancelIdleSchedule: (() => void) | undefined

    if (mode === 'polling') {
      cancelPrerenderListener = scheduleAfterPrerenderActivation(() => {
        startPolling()
      })
    } else {
      const delayMs = initialFeed ? Math.max(0, Math.round(realtimeStartDelayMs)) : 0
      cancelPrerenderListener = scheduleAfterPrerenderActivation(() => {
        if (delayMs > 0) {
          cancelIdleSchedule = scheduleWhenIdle(() => {
            cleanup = connectSSE()
          }, delayMs)
        } else {
          cleanup = connectSSE()
        }
      })
    }

    return () => {
      allowSseReconnectRef.current = false
      cancelPrerenderListener?.()
      cancelIdleSchedule?.()
      cleanup?.()
      cleanupAll()
    }
  }, [mode, tabVisible, initialFeed, realtimeStartDelayMs, connectSSE, startPolling, cleanupAll])

  return { feed, error, connectionMode }
}
