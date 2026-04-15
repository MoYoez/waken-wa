'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useT } from 'next-i18next/client'
import { useState } from 'react'

import { loginAdminWithCaptcha } from '@/components/admin/admin-query-mutations'
import { useHCaptcha } from '@/hooks/use-hcaptcha'

function safeNextPath(raw: string | null): string {
  if (!raw) return '/admin'
  try {
    const u = new URL(raw, 'http://local.invalid')
    const p = u.pathname
    if (p === '/admin') return `/admin${u.search}`
    if (p === '/admin/setup') return `/admin/setup${u.search}`
    if (p === '/admin/skills-authorize') return `/admin/skills-authorize${u.search}`
    return '/admin'
  } catch {
    return '/admin'
  }
}

interface LoginFormProps {
  hcaptchaEnabled?: boolean
  hcaptchaSiteKey?: string | null
}

export function LoginForm({ hcaptchaEnabled = false, hcaptchaSiteKey = null }: LoginFormProps) {
  const { t } = useT('auth')
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
      setError(t('login.captchaRequired'))
      return
    }

    setLoading(true)

    try {
      await loginAdminWithCaptcha({
        username,
        password,
        hcaptchaToken: captcha.token || undefined,
        fallbackErrorMessage: t('login.failed'),
      })
      const next = safeNextPath(searchParams.get('next'))
      router.push(next)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.networkError'))
      captcha.reset()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-light tracking-widest text-foreground">{t('login.title')}</h1>
          <p className="text-xs text-muted-foreground mt-2">{t('login.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="username" className="text-xs text-muted-foreground uppercase tracking-wider">
              {t('login.usernameLabel')}
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              required
              autoComplete="username"
              className="w-full rounded-sm border border-border bg-background px-4 py-2 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-xs text-muted-foreground uppercase tracking-wider">
              {t('login.passwordLabel')}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="w-full rounded-sm border border-border bg-background px-4 py-2 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
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
            className="w-full rounded-sm border border-primary/15 bg-primary px-4 py-2 text-sm font-light text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? t('login.signingIn') : t('login.signIn')}
          </button>
        </form>
      </div>
    </div>
  )
}
