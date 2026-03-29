'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { loadHCaptchaApi } from '@/lib/hcaptcha-loader'

export function useHCaptcha(siteKey: string | null, enabled: boolean) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const [token, setToken] = useState<string | null>(null)

  const onVerify = useCallback((t: string) => setToken(t), [])
  const onExpire = useCallback(() => setToken(null), [])

  useEffect(() => {
    if (!enabled || !siteKey) return

    let cancelled = false

    const mountWidget = () => {
      if (cancelled || !containerRef.current || !window.hcaptcha || widgetIdRef.current !== null)
        return
      widgetIdRef.current = window.hcaptcha.render(containerRef.current, {
        sitekey: siteKey,
        callback: onVerify,
        'expired-callback': onExpire,
        theme: 'auto',
      })
    }

    void loadHCaptchaApi()
      .then(() => {
        if (!cancelled) mountWidget()
      })
      .catch(() => {
        /* network / CSP / blocked; widget stays empty */
      })

    return () => {
      cancelled = true
      widgetIdRef.current = null
    }
  }, [enabled, siteKey, onVerify, onExpire])

  const reset = useCallback(() => {
    if (widgetIdRef.current !== null && window.hcaptcha) {
      window.hcaptcha.reset(widgetIdRef.current)
    }
    setToken(null)
  }, [])

  return { containerRef, token, reset }
}
