'use client'

import { useEffect, useState } from 'react'

import { usePublicPageLoading } from '@/hooks/use-public-page-loading'

const NOTE_ANIMATION_GATE_TIMEOUT_MS = 2200
const NOTE_ANIMATION_GATE_SETTLE_MS = 160

/**
 * Holds the typewriter back until the avatar (and optionally the signature font)
 * has loaded, so the note doesn't start animating against still-loading layout.
 * Times out after ~2.2s so a missing/slow asset never permanently blocks reveal.
 */
export function useProfileNoteAnimationReady({
  enabled,
  imageSrc,
  waitForFonts,
}: {
  enabled: boolean
  imageSrc?: string
  waitForFonts?: boolean
}) {
  const gateKey = enabled ? `${String(imageSrc ?? '').trim()}::${waitForFonts ? 'fonts' : 'plain'}` : ''
  const [readyGateKey, setReadyGateKey] = useState('')
  const ready = !enabled || readyGateKey === gateKey

  useEffect(() => {
    if (!enabled) return

    if (typeof window === 'undefined') return

    const src = String(imageSrc ?? '').trim()
    let cancelled = false
    let settled = false
    let settleTimer = 0
    let timeoutTimer = 0
    const cleanups: Array<() => void> = []
    let pendingCount = 0

    const settle = () => {
      if (cancelled || settled) return
      settled = true
      settleTimer = window.setTimeout(() => {
        if (!cancelled) setReadyGateKey(gateKey)
      }, NOTE_ANIMATION_GATE_SETTLE_MS)
    }

    const track = (promise: Promise<unknown>, cleanup?: () => void) => {
      pendingCount += 1
      if (cleanup) cleanups.push(cleanup)
      void promise.finally(() => {
        pendingCount -= 1
        if (pendingCount <= 0) {
          settle()
        }
      })
    }

    if (src) {
      const imageReady = new Promise<void>((resolve) => {
        const probe = new window.Image()

        const finish = () => {
          probe.onload = null
          probe.onerror = null
          resolve()
        }

        const finalize = () => {
          if (typeof probe.decode === 'function') {
            void probe.decode().catch(() => undefined).finally(finish)
            return
          }
          finish()
        }

        probe.onload = finalize
        probe.onerror = finish
        probe.src = src

        if (probe.complete && probe.naturalWidth > 0) {
          finalize()
        }
      })

      track(imageReady)
    }

    if (waitForFonts && typeof document !== 'undefined' && 'fonts' in document) {
      const fontSet = document.fonts
      track(fontSet.ready)
    }

    if (pendingCount === 0) {
      settle()
    } else {
      timeoutTimer = window.setTimeout(settle, NOTE_ANIMATION_GATE_TIMEOUT_MS)
    }

    return () => {
      cancelled = true
      window.clearTimeout(settleTimer)
      window.clearTimeout(timeoutTimer)
      for (const cleanup of cleanups) cleanup()
    }
  }, [enabled, gateKey, imageSrc, waitForFonts])

  return ready
}

/** Note typewriter waits until the public-page loader has stepped aside. */
export function usePublicPageNoteAnimationReady(enabled: boolean) {
  const loadingActive = usePublicPageLoading()
  return !enabled || !loadingActive
}
