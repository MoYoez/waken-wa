'use client'

import type LenisType from 'lenis'
import { useEffect } from 'react'

type LenisSmoothScrollProps = {
  enabled: boolean
}

export function LenisSmoothScroll({ enabled }: LenisSmoothScrollProps) {
  useEffect(() => {
    if (!enabled) return
    if (typeof window === 'undefined') return

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    let lenis: LenisType | null = null
    let cancelled = false
    let pendingLoad: Promise<typeof import('lenis')> | null = null

    const stopLenis = () => {
      lenis?.destroy()
      lenis = null
    }

    const startLenis = async () => {
      if (lenis || cancelled) return
      if (!pendingLoad) pendingLoad = import('lenis')
      const mod = await pendingLoad
      if (cancelled || lenis) return
      const Lenis = mod.default
      lenis = new Lenis({
        anchors: true,
        autoRaf: true,
        lerp: 0.1,
      })
    }

    const syncLenis = () => {
      if (reducedMotionQuery.matches) {
        stopLenis()
        return
      }
      void startLenis()
    }

    syncLenis()
    reducedMotionQuery.addEventListener('change', syncLenis)

    return () => {
      cancelled = true
      reducedMotionQuery.removeEventListener('change', syncLenis)
      stopLenis()
    }
  }, [enabled])

  return null
}
