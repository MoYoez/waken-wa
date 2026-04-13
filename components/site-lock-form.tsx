'use client'

import { useT } from 'next-i18next/client'
import { useState } from 'react'

import { useHCaptcha } from '@/hooks/use-hcaptcha'

interface SiteLockFormProps {
  hcaptchaEnabled?: boolean
  hcaptchaSiteKey?: string | null
}

export function SiteLockForm({ hcaptchaEnabled = false, hcaptchaSiteKey = null }: SiteLockFormProps) {
  const { t } = useT('auth')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const captcha = useHCaptcha(hcaptchaSiteKey, hcaptchaEnabled)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (hcaptchaEnabled && !captcha.token) {
      setError(t('siteLock.captchaRequired'))
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/site/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          hcaptchaToken: captcha.token || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || t('siteLock.verificationFailed'))
        captcha.reset()
        return
      }
      window.location.reload()
    } catch {
      setError(t('siteLock.networkError'))
      captcha.reset()
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border bg-card p-6 space-y-4">
        <h1 className="text-lg font-semibold">{t('siteLock.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('siteLock.description')}</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('siteLock.passwordPlaceholder')}
          required
          className="w-full px-3 py-2 border rounded-md bg-background"
        />
        {hcaptchaEnabled && (
          <div className="flex justify-center">
            <div ref={captcha.containerRef} />
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full px-3 py-2 rounded-md bg-primary text-primary-foreground"
        >
          {loading ? t('siteLock.submitting') : t('siteLock.submit')}
        </button>
      </form>
    </main>
  )
}
