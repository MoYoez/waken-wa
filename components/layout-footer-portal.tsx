'use client'

import { motion, type Transition, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { LayoutFooter } from '@/components/layout-footer'
import { getSiteSectionTransition, getSiteSectionVariants } from '@/components/site-motion'

const PORTAL_ID = 'site-footer-portal'
const FOOTER_ENTER_Y = 104
const FOOTER_EXIT_Y = 36
const FOOTER_INTERSECTION_ROOT_MARGIN = '0px 0px 18% 0px'
const FOOTER_INTERSECTION_THRESHOLD = 0

/** Renders footer into #site-footer-portal so tilt on main content does not skew the footer. */
export function LayoutFooterPortal({ adminText }: { adminText: string }) {
  const [el, setEl] = useState<HTMLElement | null>(null)
  const [ready, setReady] = useState(false)
  const [footerInView, setFooterInView] = useState(false)
  const footerRef = useRef<HTMLDivElement | null>(null)
  const prefersReducedMotion = Boolean(useReducedMotion())
  const sectionTransition: Transition = prefersReducedMotion
    ? getSiteSectionTransition(true)
    : { duration: 0.68, ease: [0.16, 1, 0.3, 1] as const }
  const sectionVariants = getSiteSectionVariants(prefersReducedMotion, {
    enterY: FOOTER_ENTER_Y,
    exitY: FOOTER_EXIT_Y,
    scale: 0.985,
  })

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
    const node = footerRef.current
    if (!node) return
    if (typeof IntersectionObserver === 'undefined') {
      const frame = window.requestAnimationFrame(() => {
        setFooterInView(true)
      })
      return () => window.cancelAnimationFrame(frame)
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setFooterInView(entry?.isIntersecting === true)
      },
      {
        rootMargin: FOOTER_INTERSECTION_ROOT_MARGIN,
        threshold: FOOTER_INTERSECTION_THRESHOLD,
      },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [el])

  if (!el) return null
  const visible = ready && footerInView
  return createPortal(
    <div ref={footerRef}>
      <motion.div
        variants={sectionVariants}
        initial="initial"
        animate={visible ? 'animate' : 'initial'}
        transition={sectionTransition}
        style={{
          filter: visible ? 'blur(0px)' : prefersReducedMotion ? 'none' : 'blur(10px)',
          pointerEvents: visible ? 'auto' : 'none',
        }}
      >
        <LayoutFooter adminText={adminText} />
      </motion.div>
    </div>,
    el,
  )
}
