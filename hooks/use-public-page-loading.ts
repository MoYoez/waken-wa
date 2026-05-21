'use client'

import { useEffect, useState } from 'react'

/**
 * Source of truth: PublicPageTransitionShell sets `data-public-page-loading`
 * on the documentElement while the loader is gating first paint. Anything that
 * needs to react (footer reveal, mouse tilt resume, typewriter start) reads
 * that attribute via this hook instead of querying the DOM ad hoc.
 */
function readLoadingState(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.dataset.publicPageLoading === 'true'
}

export function isPublicPageLoadingActive(): boolean {
  return readLoadingState()
}

export function usePublicPageLoading(): boolean {
  const [loading, setLoading] = useState<boolean>(() => readLoadingState())

  useEffect(() => {
    if (typeof document === 'undefined') return

    const sync = () => setLoading(readLoadingState())
    sync()

    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-public-page-loading'],
    })
    return () => observer.disconnect()
  }, [])

  return loading
}
