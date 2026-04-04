'use client'

import { useEffect, useState } from 'react'

type Props = {
  children: React.ReactNode
  scope: 'home' | 'inspiration'
  enabled?: boolean
}

const MIN_LOADING_MS = 720
const THEME_WAIT_TIMEOUT_MS = 2200

function loadingLabel(scope: Props['scope']): string {
  return scope === 'home' ? '正在准备今日状态' : '正在准备灵感碎片'
}

export function PublicPageTransitionShell({ children, scope, enabled = true }: Props) {
  const [contentReady, setContentReady] = useState(false)

  useEffect(() => {
    if (!enabled) return
    if (typeof document === 'undefined') return

    const root = document.documentElement
    root.dataset.publicPageLoading = 'true'
    root.dataset.publicPageScope = scope

    let done = false
    let minDelayDone = false
    let themeReadyDone = root.dataset.themeReady === 'true'

    const finish = () => {
      if (done || !minDelayDone || !themeReadyDone) return
      done = true
      window.setTimeout(() => {
        setContentReady(true)
        root.dataset.publicPageLoading = 'false'
      }, 40)
    }

    const minDelayTimer = window.setTimeout(() => {
      minDelayDone = true
      finish()
    }, MIN_LOADING_MS)

    const timeoutTimer = window.setTimeout(() => {
      themeReadyDone = true
      finish()
    }, THEME_WAIT_TIMEOUT_MS)

    const onThemeReady = () => {
      themeReadyDone = true
      finish()
    }

    window.addEventListener('site-theme-ready', onThemeReady as EventListener)

    if (themeReadyDone) {
      finish()
    }

    return () => {
      window.clearTimeout(minDelayTimer)
      window.clearTimeout(timeoutTimer)
      window.removeEventListener('site-theme-ready', onThemeReady as EventListener)
      delete root.dataset.publicPageScope
      delete root.dataset.publicPageLoading
    }
  }, [enabled, scope])

  if (!enabled) {
    return <>{children}</>
  }

  return (
    <>
      <div
        aria-hidden={contentReady}
        className={`public-page-loader ${contentReady ? 'is-hidden' : 'is-visible'}`}
      >
        <div className="public-page-loader__scene">
          <div className="public-page-loader__moon" />
          <div className="public-page-loader__spark public-page-loader__spark--a" />
          <div className="public-page-loader__spark public-page-loader__spark--b" />
          <div className="public-page-loader__spark public-page-loader__spark--c" />
          <div className="public-page-loader__shadow" />
          <div className="public-page-loader__dino" aria-hidden="true">
            <div className="public-page-loader__dino-body" />
            <div className="public-page-loader__dino-tail" />
            <div className="public-page-loader__dino-head">
              <span className="public-page-loader__dino-eye" />
              <span className="public-page-loader__dino-mouth" />
            </div>
            <div className="public-page-loader__dino-arm public-page-loader__dino-arm--front" />
            <div className="public-page-loader__dino-arm public-page-loader__dino-arm--back" />
            <div className="public-page-loader__dino-leg public-page-loader__dino-leg--front" />
            <div className="public-page-loader__dino-leg public-page-loader__dino-leg--back" />
          </div>
          <div className="public-page-loader__ground" />
        </div>
        <p className="public-page-loader__label">{loadingLabel(scope)}</p>
      </div>

      <div className={`public-page-content ${contentReady ? 'is-ready' : 'is-pending'}`}>{children}</div>
    </>
  )
}
