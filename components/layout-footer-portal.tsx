'use client'

import { motion, type Transition, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import { LayoutFooter } from '@/components/layout-footer'
import { getSiteSectionTransition, getSiteSectionVariants } from '@/components/site-motion'

const PORTAL_ID = 'site-footer-portal'

/** Renders footer into #site-footer-portal so tilt on main content does not skew the footer. */
export function LayoutFooterPortal({ adminText }: { adminText: string }) {
  const [el, setEl] = useState<HTMLElement | null>(null)
  const [ready, setReady] = useState(false)
  const prefersReducedMotion = Boolean(useReducedMotion())
  const sectionTransition: Transition = prefersReducedMotion
    ? getSiteSectionTransition(true)
    : { duration: 0.58, ease: [0.16, 1, 0.3, 1] as const }
  const sectionVariants = getSiteSectionVariants(prefersReducedMotion, {
    enterY: 56,
    exitY: 24,
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

  if (!el) return null
  const visible = ready
  return createPortal(
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
    </motion.div>,
    el,
  )
}
