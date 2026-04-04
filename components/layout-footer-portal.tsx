'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import { LayoutFooter } from '@/components/layout-footer'

const PORTAL_ID = 'site-footer-portal'

/** Renders footer into #site-footer-portal so tilt on main content does not skew the footer. */
export function LayoutFooterPortal({ adminText }: { adminText: string }) {
  const [el, setEl] = useState<HTMLElement | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEl(document.getElementById(PORTAL_ID))
  }, [])

  if (!el) return null
  return createPortal(
    <div className="public-page-footer-shell">
      <LayoutFooter adminText={adminText} />
    </div>,
    el,
  )
}
