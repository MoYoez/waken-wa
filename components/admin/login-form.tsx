'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

function safeNextPath(raw: string | null): string {
  if (!raw) return '/admin'
  try {
    const u = new URL(raw, 'http://local.invalid')
    const p = u.pathname
    if (p === '/admin') return `/admin${u.search}`
    if (p === '/admin/setup') return `/admin/setup${u.search}`
    return '/admin'
  } catch {
    return '/admin'
  }
}

declare global {
  interface Window {
    hcaptcha?: {
      render: (container: string | HTMLElement, params: Record<string, unknown>) => string
      reset: (widgetId: string) => void
      getResponse: (widgetId: string) => string
    }
  }
}

function useHCaptcha(siteKey: string | null, enabled: boolean) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  const onVerify = useCallback((t: string) => setToken(t), [])
  const onExpire = useCallback(() => setToken(null), [])

  useEffect(() => {
    if (!enabled || !siteKey) return

    const renderWidget = () => {
      if (!containerRef.current || !window.hcaptcha || widgetIdRef.current !== null) return
      widgetIdRef.current = window.hcaptcha.render(containerRef.current, {
        sitekey: siteKey,
        callback: onVerify,
        'expired-callback': onExpire,
        theme: 'auto',
      })
      setReady(true)
    }

    if (window.hcaptcha) {
      renderWidget()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://js.hcaptcha.com/1/api.js?render=explicit'
    script.async = true
    script.onload = renderWidget
    document.head.appendChild(script)

    return () => {
      widgetIdRef.current = null
    }
  }, [enabled, siteKey, onVerify, onExpire])

  const reset = useCallback(() => {
    if (widgetIdRef.current !== null && window.hcaptcha) {
      window.hcaptcha.reset(widgetIdRef.current)
    }
    setToken(null)
  }, [])

  return { containerRef, token, reset, ready }
}

interface LoginFormProps {
  hcaptchaEnabled?: boolean
  hcaptchaSiteKey?: string | null
}

export function LoginForm({ hcaptchaEnabled = false, hcaptchaSiteKey = null }: LoginFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const captcha = useHCaptcha(hcaptchaSiteKey, hcaptchaEnabled)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (hcaptchaEnabled && !captcha.token) {
      setError('请先完成人机验证')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          hcaptchaToken: captcha.token || undefined,
        }),
      })

      const data = await res.json()

      if (data.success) {
        const next = safeNextPath(searchParams.get('next'))
        router.push(next)
        router.refresh()
      } else {
        setError(data.error || 'Login failed')
        captcha.reset()
      }
    } catch {
      setError('Network error, please try again')
      captcha.reset()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-light tracking-widest text-foreground">admin</h1>
          <p className="text-xs text-muted-foreground mt-2">manage activity records</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="username" className="text-xs text-muted-foreground uppercase tracking-wider">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              required
              autoComplete="username"
              className="w-full px-4 py-2 border border-border rounded-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground transition-colors text-sm"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-xs text-muted-foreground uppercase tracking-wider">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="w-full px-4 py-2 border border-border rounded-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground transition-colors text-sm"
            />
          </div>

          {hcaptchaEnabled && (
            <div className="flex justify-center">
              <div ref={captcha.containerRef} />
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 border border-border rounded-sm bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-light text-sm"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
