'use client'

import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { LayoutFooter } from '@/components/layout-footer'

const PORTAL_ID = 'site-footer-portal'
const MOBILE_MEDIA_QUERY = '(max-width: 767px)'
const FOOTER_SPACE_MULTIPLIER = 1.08
const FOOTER_SPACE_MIN_PX = 88
const FOOTER_REVEAL_SHOW_RATIO = 0.82
const FOOTER_REVEAL_SHOW_GAP_PX = 10
const FOOTER_REVEAL_FOLLOW_BASE_REM = 4.75
const FOOTER_REVEAL_FOLLOW_TALL_MAX_REM = 9.5
const FOOTER_REVEAL_FOLLOW_TALL_VIEWPORT_MIN_PX = 820
const FOOTER_REVEAL_FOLLOW_TALL_VIEWPORT_MAX_PX = 1180

function computeFooterSpacerHeight(height: number): number {
  if (height <= 0) return 0
  return Math.max(Math.round(height * FOOTER_SPACE_MULTIPLIER), FOOTER_SPACE_MIN_PX)
}

function remToPx(rem: number, rootFontSizePx: number): number {
  return Math.round(rem * rootFontSizePx)
}

function computeFooterFollowMaxPx(viewportHeight: number, rootFontSizePx: number): number {
  const basePx = remToPx(FOOTER_REVEAL_FOLLOW_BASE_REM, rootFontSizePx)
  const maxPx = remToPx(FOOTER_REVEAL_FOLLOW_TALL_MAX_REM, rootFontSizePx)

  if (viewportHeight <= FOOTER_REVEAL_FOLLOW_TALL_VIEWPORT_MIN_PX) {
    return basePx
  }

  const progress = Math.min(
    Math.max(
      (viewportHeight - FOOTER_REVEAL_FOLLOW_TALL_VIEWPORT_MIN_PX) /
        (FOOTER_REVEAL_FOLLOW_TALL_VIEWPORT_MAX_PX - FOOTER_REVEAL_FOLLOW_TALL_VIEWPORT_MIN_PX),
      0,
    ),
    1,
  )

  return Math.round(basePx + progress * (maxPx - basePx))
}

/** Renders the footer into #site-footer-portal so tilt on main content does not skew the footer. */
export function LayoutFooterPortal({ adminText }: { adminText: string }) {
  const [el, setEl] = useState<HTMLElement | null>(null)
  const [ready, setReady] = useState(false)
  const [mobilePinned, setMobilePinned] = useState(false)
  const [nearBottom, setNearBottom] = useState(false)
  const [spacerHeight, setSpacerHeight] = useState(0)
  const [followOffsetPx, setFollowOffsetPx] = useState(0)
  const spacerRef = useRef<HTMLDivElement | null>(null)
  const shellRef = useRef<HTMLDivElement | null>(null)
  const nearBottomRef = useRef(false)
  const followOffsetRef = useRef(0)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEl(document.getElementById(PORTAL_ID))
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return

    const root = document.documentElement
    const sync = () => {
      setReady(root.dataset.publicPageLoading !== 'true')
    }

    sync()

    const observer = new MutationObserver(sync)
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['data-public-page-loading'],
    })

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY)
    const syncPinnedState = () => {
      setMobilePinned(mediaQuery.matches)
    }

    syncPinnedState()

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncPinnedState)
      return () => mediaQuery.removeEventListener('change', syncPinnedState)
    }

    mediaQuery.addListener(syncPinnedState)
    return () => mediaQuery.removeListener(syncPinnedState)
  }, [])

  useEffect(() => {
    nearBottomRef.current = nearBottom
  }, [nearBottom])

  useEffect(() => {
    followOffsetRef.current = followOffsetPx
  }, [followOffsetPx])

  useEffect(() => {
    if (!ready || mobilePinned) {
      const shouldResetVisible = nearBottomRef.current
      const shouldResetFollowOffset = followOffsetRef.current !== 0
      nearBottomRef.current = false
      followOffsetRef.current = 0
      if (!shouldResetVisible && !shouldResetFollowOffset) return

      const frame = window.requestAnimationFrame(() => {
        if (shouldResetVisible) {
          setNearBottom(false)
        }
        if (shouldResetFollowOffset) {
          setFollowOffsetPx(0)
        }
      })
      return () => window.cancelAnimationFrame(frame)
    }

    const computeVisible = () => {
      const spacerNode = spacerRef.current
      const shellNode = shellRef.current
      if (!spacerNode || !shellNode) {
        nearBottomRef.current = false
        setNearBottom(false)
        return
      }

      const viewportHeight = window.innerHeight
      const rootFontSizePx =
        Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16
      const followMaxPx = computeFooterFollowMaxPx(viewportHeight, rootFontSizePx)
      const spacerRect = spacerNode.getBoundingClientRect()
      const shellHeight = Math.max(shellNode.offsetHeight, 0)
      const measuredSpacerHeight = Math.max(
        spacerRect.height,
        computeFooterSpacerHeight(shellHeight),
      )
      const visibleSpacerHeight = Math.min(
        Math.max(viewportHeight - spacerRect.top, 0),
        measuredSpacerHeight,
      )
      const showThreshold = Math.min(
        measuredSpacerHeight,
        Math.max(
          shellHeight - FOOTER_REVEAL_SHOW_GAP_PX,
          measuredSpacerHeight * FOOTER_REVEAL_SHOW_RATIO,
        ),
      )
      const revealTriggerTop = viewportHeight - showThreshold
      const departurePx = Math.max(spacerRect.top - revealTriggerTop, 0)
      const nextVisible = nearBottomRef.current
        ? departurePx < followMaxPx
        : visibleSpacerHeight >= showThreshold
      const nextFollowOffset = Math.round(Math.min(departurePx, followMaxPx))

      if (nextVisible !== nearBottomRef.current) {
        nearBottomRef.current = nextVisible
        setNearBottom(nextVisible)
      }

      if (nextFollowOffset === followOffsetRef.current) return

      followOffsetRef.current = nextFollowOffset
      setFollowOffsetPx(nextFollowOffset)
    }

    let frame = 0
    let ticking = false
    const syncVisible = () => {
      if (ticking) return
      ticking = true
      frame = window.requestAnimationFrame(() => {
        computeVisible()
        ticking = false
      })
    }

    computeVisible()
    window.addEventListener('scroll', syncVisible, { passive: true })
    window.addEventListener('resize', syncVisible)

    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            syncVisible()
          })

    if (observer) {
      const spacerNode = spacerRef.current
      const shellNode = shellRef.current
      if (spacerNode) observer.observe(spacerNode)
      if (shellNode) observer.observe(shellNode)
    }

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', syncVisible)
      window.removeEventListener('resize', syncVisible)
      observer?.disconnect()
    }
  }, [el, mobilePinned, ready, spacerHeight])

  useEffect(() => {
    const node = shellRef.current
    if (!node) return

    const syncSpacerHeight = () => {
      const nextHeight = ready && !mobilePinned ? computeFooterSpacerHeight(node.offsetHeight) : 0
      setSpacerHeight(nextHeight)
    }

    syncSpacerHeight()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', syncSpacerHeight)
      return () => window.removeEventListener('resize', syncSpacerHeight)
    }

    const observer = new ResizeObserver(syncSpacerHeight)
    observer.observe(node)
    window.addEventListener('resize', syncSpacerHeight)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', syncSpacerHeight)
    }
  }, [el, mobilePinned, ready])

  useEffect(() => {
    if (typeof document === 'undefined') return

    const root = document.documentElement
    const node = shellRef.current
    if (!node) {
      root.style.setProperty('--site-footer-overlay-offset', '0px')
      return
    }

    const syncOverlayOffset = () => {
      const nextOffset = 0
      root.style.setProperty('--site-footer-overlay-offset', `${Math.max(nextOffset, 0)}px`)
    }

    syncOverlayOffset()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', syncOverlayOffset)
      return () => {
        root.style.setProperty('--site-footer-overlay-offset', '0px')
        window.removeEventListener('resize', syncOverlayOffset)
      }
    }

    const observer = new ResizeObserver(syncOverlayOffset)
    observer.observe(node)
    window.addEventListener('resize', syncOverlayOffset)

    return () => {
      root.style.setProperty('--site-footer-overlay-offset', '0px')
      observer.disconnect()
      window.removeEventListener('resize', syncOverlayOffset)
    }
  }, [el, mobilePinned, ready])

  const spacer = (
    <div
      ref={spacerRef}
      aria-hidden
      className="site-footer-portal-spacer"
      style={{ height: ready ? spacerHeight : 0 }}
    />
  )

  if (mobilePinned) {
    return (
      <div ref={shellRef} className="site-footer-inline-shell">
        <LayoutFooter adminText={adminText} />
      </div>
    )
  }

  if (!el) return spacer

  const visible = ready && (mobilePinned || nearBottom)
  const shellStyle = {
    '--site-footer-follow-offset': `${mobilePinned ? 0 : followOffsetPx}px`,
  } as CSSProperties

  return (
    <>
      {spacer}
      {createPortal(
        <div
          ref={shellRef}
          className={`site-footer-portal-shell ${mobilePinned ? 'is-mobile-pinned' : ''} ${ready && visible ? 'is-visible' : ''}`}
          style={shellStyle}
        >
          <LayoutFooter adminText={adminText} />
        </div>,
        el,
      )}
    </>
  )
}
