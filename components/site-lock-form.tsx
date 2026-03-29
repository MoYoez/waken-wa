'use client'

import { useState } from 'react'

import { useHCaptcha } from '@/hooks/use-hcaptcha'

interface SiteLockFormProps {
  hcaptchaEnabled?: boolean
  hcaptchaSiteKey?: string | null
}

export function SiteLockForm({ hcaptchaEnabled = false, hcaptchaSiteKey = null }: SiteLockFormProps) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const captcha = useHCaptcha(hcaptchaSiteKey, hcaptchaEnabled)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (hcaptchaEnabled && !captcha.token) {
      setError('请先完成人机验证')
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
        setError(data.error || '验证失败')
        captcha.reset()
        return
      }
      window.location.reload()
    } catch {
      setError('网络异常，请重试')
      captcha.reset()
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border bg-card p-6 space-y-4">
        <h1 className="text-lg font-semibold">页面已加锁</h1>
        <p className="text-sm text-muted-foreground">请输入访问密码后查看主页内容。</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="访问密码"
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
          {loading ? '验证中...' : '进入主页'}
        </button>
      </form>
    </main>
  )
}
