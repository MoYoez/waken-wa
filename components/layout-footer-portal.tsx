'use client'

import { motion, useReducedMotion } from 'motion/react'
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
  const sectionTransition = getSiteSectionTransition(prefersReducedMotion)
  const sectionVariants = getSiteSectionVariants(prefersReducedMotion, {
    enterY: 10,
    exitY: 8,
    scale: 0.998,
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
  return createPortal(
    <motion.div
      variants={sectionVariants}
      initial="initial"
      animate={ready ? 'animate' : 'initial'}
      transition={sectionTransition}
      style={{
        filter: ready ? 'blur(0px)' : prefersReducedMotion ? 'none' : 'blur(10px)',
        pointerEvents: ready ? 'auto' : 'none',
      }}
    >
      <LayoutFooter adminText={adminText} />
    </motion.div>,
    el,
  )
}
