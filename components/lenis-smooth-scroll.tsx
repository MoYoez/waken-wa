'use client'

import Lenis from 'lenis'
import { useEffect } from 'react'

type LenisSmoothScrollProps = {
  enabled: boolean
}

export function LenisSmoothScroll({ enabled }: LenisSmoothScrollProps) {
  useEffect(() => {
    if (!enabled) return
    if (typeof window === 'undefined') return

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    let lenis: Lenis | null = null

    const stopLenis = () => {
      lenis?.destroy()
      lenis = null
    }

    const syncLenis = () => {
      if (reducedMotionQuery.matches) {
        stopLenis()
        return
      }
      if (lenis) return

      lenis = new Lenis({
        anchors: true,
        autoRaf: true,
        lerp: 0.1,
      })
    }

    syncLenis()
    reducedMotionQuery.addEventListener('change', syncLenis)

    return () => {
      reducedMotionQuery.removeEventListener('change', syncLenis)
      stopLenis()
    }
  }, [enabled])

  return null
}
