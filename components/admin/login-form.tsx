'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function safeNextPath(raw: string | null): string {
  if (!raw) return '/admin'
  try {
    const u = new URL(raw, 'http://local.invalid')
    if (u.pathname !== '/admin') return '/admin'
    return `/admin${u.search}`
  } catch {
    return '/admin'
  }
}

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const data = await res.json()

      if (data.success) {
        const next = safeNextPath(searchParams.get('next'))
        router.push(next)
        router.refresh()
      } else {
        setError(data.error || 'Login failed')
      }
    } catch {
      setError('Network error, please try again')
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
