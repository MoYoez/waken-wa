'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  VIEWER_HEARTBEAT_INTERVAL_MS,
  VIEWER_PRESENCE_COOKIE_MAX_AGE_SECONDS,
  VIEWER_PRESENCE_COOKIE_NAME,
} from '@/lib/viewer-presence-constants'
import type { ViewerCountResponse } from '@/types/viewers'

type ViewerCountMode = 'heartbeat' | 'readonly'

interface UseViewerCountOptions {
  mode?: ViewerCountMode
  enabled?: boolean
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const prefix = `${encodeURIComponent(name)}=`
  const parts = document.cookie.split(';')
  for (const part of parts) {
    const trimmed = part.trim()
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length))
    }
  }
  return null
}

function createClientViewerPresenceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '')
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 18)}`
}

function ensureClientViewerPresenceCookie(): void {
  if (typeof document === 'undefined') return
  if (readCookie(VIEWER_PRESENCE_COOKIE_NAME)) return

  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie =
    `${encodeURIComponent(VIEWER_PRESENCE_COOKIE_NAME)}=${encodeURIComponent(createClientViewerPresenceId())}; ` +
    `Max-Age=${VIEWER_PRESENCE_COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`
}

export function useViewerCount(options: UseViewerCountOptions = {}) {
  const { mode = 'readonly', enabled = true } = options

  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)
  const [tabVisible, setTabVisible] = useState(true)

  const hasLoadedRef = useRef(false)
  const inFlightRef = useRef(false)

  useEffect(() => {
    const sync = () => setTabVisible(document.visibilityState === 'visible')
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [])

  const fetchCount = useCallback(async () => {
    if (!enabled || inFlightRef.current) return

    inFlightRef.current = true
    try {
      if (mode === 'heartbeat') {
        ensureClientViewerPresenceCookie()
      }

      const res = await fetch('/api/viewers', {
        method: mode === 'heartbeat' ? 'POST' : 'GET',
        cache: 'no-store',
      })
      const json = (await res.json().catch(() => null)) as ViewerCountResponse | null
      if (!res.ok || !json?.success || typeof json.data?.count !== 'number') {
        throw new Error(typeof json?.error === 'string' ? json.error : 'fetch failed')
      }

      setCount(Math.max(0, Math.round(json.data.count)))
      setError(null)
      setLastUpdatedAt(new Date().toISOString())
    } catch {
      setError('读取在线访客数失败')
    } finally {
      inFlightRef.current = false
      if (!hasLoadedRef.current) {
        hasLoadedRef.current = true
        setLoading(false)
      }
    }
  }, [enabled, mode])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    if (!tabVisible) return

    if (!hasLoadedRef.current) {
      setLoading(true)
    }

    void fetchCount()
    const timer = window.setInterval(() => {
      void fetchCount()
    }, VIEWER_HEARTBEAT_INTERVAL_MS)

    return () => window.clearInterval(timer)
  }, [enabled, fetchCount, tabVisible])

  return { count, loading, error, lastUpdatedAt }
}
