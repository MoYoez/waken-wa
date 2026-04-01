'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

/** Max tilt in degrees (subtle parallax). */
const MAX_ROTATE_DEG = 4.5
const PERSPECTIVE_PX = 1400
/** Higher = snappier follow. */
const LERP = 0.12

const ADMIN_PREFIX = '/admin'

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

export function GlobalMouseTilt({
  children,
  enabled,
  gyroEnabled = false,
}: {
  children: React.ReactNode
  /** When false, no tilt (default in site config). */
  enabled: boolean
  /** When true, use device orientation (mobile) when available. */
  gyroEnabled?: boolean
}) {
  const pathname = usePathname()
  const wrapRef = useRef<HTMLDivElement>(null)
  const targetRef = useRef({ rx: 0, ry: 0 })
  const currentRef = useRef({ rx: 0, ry: 0 })
  const rafRef = useRef(0)
  const lastOrientationAtRef = useRef(0)

  const skipAdmin = pathname?.startsWith(ADMIN_PREFIX) ?? false

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return

    if (skipAdmin || !enabled) {
      el.style.transform = ''
      el.style.willChange = 'auto'
      currentRef.current = { rx: 0, ry: 0 }
      targetRef.current = { rx: 0, ry: 0 }
      return
    }

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mq.matches) {
      el.style.transform = ''
      el.style.willChange = 'auto'
      return
    }

    el.style.willChange = 'transform'

    const onMove = (e: MouseEvent) => {
      // If gyro is actually producing data, prefer it.
      if (Date.now() - lastOrientationAtRef.current < 1200) return
      const w = window.innerWidth || 1
      const h = window.innerHeight || 1
      const nx = (e.clientX / w) * 2 - 1
      const ny = (e.clientY / h) * 2 - 1
      targetRef.current.rx = -ny * MAX_ROTATE_DEG
      targetRef.current.ry = nx * MAX_ROTATE_DEG
    }

    const onOrientation = (e: DeviceOrientationEvent) => {
      // beta: front-to-back (x axis), gamma: left-to-right (y axis)
      const beta = typeof e.beta === 'number' ? e.beta : 0
      const gamma = typeof e.gamma === 'number' ? e.gamma : 0
      // Some desktop browsers expose DeviceOrientationEvent but never emit meaningful data.
      // Only "claim" gyro control once we see non-zero values.
      if (beta !== 0 || gamma !== 0) {
        lastOrientationAtRef.current = Date.now()
      }

      // Keep it subtle: map ~[-30,30] deg to [-MAX,MAX]
      const nx = clamp(gamma / 30, -1, 1)
      const ny = clamp(beta / 30, -1, 1)
      targetRef.current.rx = -ny * MAX_ROTATE_DEG
      targetRef.current.ry = nx * MAX_ROTATE_DEG
    }

    const resetTarget = () => {
      targetRef.current.rx = 0
      targetRef.current.ry = 0
    }

    const tick = () => {
      const cur = currentRef.current
      const tgt = targetRef.current
      cur.rx += (tgt.rx - cur.rx) * LERP
      cur.ry += (tgt.ry - cur.ry) * LERP
      el.style.transform = `perspective(${PERSPECTIVE_PX}px) rotateX(${cur.rx}deg) rotateY(${cur.ry}deg) translateZ(0)`
      rafRef.current = requestAnimationFrame(tick)
    }

    let detachInput = () => {
      // no-op
    }

    const attachMouse = () => {
      window.addEventListener('mousemove', onMove, { passive: true })
      const prev = detachInput
      detachInput = () => {
        window.removeEventListener('mousemove', onMove)
        prev()
      }
    }

    const attachOrientation = () => {
      window.addEventListener('deviceorientation', onOrientation, { passive: true })
      const prev = detachInput
      detachInput = () => {
        window.removeEventListener('deviceorientation', onOrientation)
        prev()
      }
    }

    const maybeRequestIOSPermission = async (): Promise<boolean> => {
      const AnyDeviceOrientationEvent = (window as Window & {
        DeviceOrientationEvent?: unknown
      }).DeviceOrientationEvent as {
        requestPermission?: () => Promise<'granted' | 'denied'>
      } | undefined
      if (!AnyDeviceOrientationEvent) return false
      if (typeof AnyDeviceOrientationEvent.requestPermission !== 'function') return true
      try {
        const res = await AnyDeviceOrientationEvent.requestPermission()
        return res === 'granted'
      } catch {
        return false
      }
    }

    const attach = () => {
      if (!gyroEnabled) {
        attachMouse()
        return
      }
      if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
        attachMouse()
        return
      }

      // iOS requires a user gesture to request permission.
      // We optimistically attach orientation; if iOS blocks it, user gesture handler below will re-attach.
      attachOrientation()
      // Always keep mouse as a fallback (desktop commonly "supports" DeviceOrientationEvent but emits nothing).
      attachMouse()
    }

    attach()

    let permissionHandled = false
    const onFirstGesture = async () => {
      if (permissionHandled) return
      permissionHandled = true

      if (!gyroEnabled) return

      const ok = await maybeRequestIOSPermission()
      detachInput()
      if (ok) {
        attachOrientation()
      } else {
        // Silent fallback
        attachMouse()
      }
    }

    window.addEventListener('touchstart', onFirstGesture, { passive: true, once: true })
    window.addEventListener('click', onFirstGesture, { passive: true, once: true })

    document.documentElement.addEventListener('mouseleave', resetTarget)
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      detachInput()
      window.removeEventListener('touchstart', onFirstGesture)
      window.removeEventListener('click', onFirstGesture)
      document.documentElement.removeEventListener('mouseleave', resetTarget)
      cancelAnimationFrame(rafRef.current)
      el.style.transform = ''
      el.style.willChange = 'auto'
      currentRef.current = { rx: 0, ry: 0 }
      targetRef.current = { rx: 0, ry: 0 }
      lastOrientationAtRef.current = 0
    }
  }, [skipAdmin, enabled, gyroEnabled])

  return (
    <div
      ref={wrapRef}
      className="min-h-dvh w-full [transform-style:preserve-3d]"
    >
      {children}
    </div>
  )
}
