'use client'

import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

type Props = {
  publicOrigin: string
  aiClientId: string
  authorizeCode: string
}

export function SkillsOauthAuthorizeCard({ publicOrigin, aiClientId, authorizeCode }: Props) {
  const [loading, setLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [token, setToken] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [error, setError] = useState('')
  const directExample = useMemo(() => {
    const base = publicOrigin || ''
    return base
      ? `${base}/api/llm/direct?mode=oauth&ai=${encodeURIComponent(aiClientId)}&token=...`
      : `/api/llm/direct?mode=oauth&ai=${encodeURIComponent(aiClientId)}&token=...`
  }, [publicOrigin, aiClientId])

  const authorize = async () => {
    setConfirmOpen(false)
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/skills/oauth/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true, authorizeCode }),
      })
      const json = await res.json().catch(() => null)
      if (!json?.success) {
        throw new Error(json?.error || `HTTP ${res.status}`)
      }
      setToken(String(json.data?.token ?? ''))
      setExpiresAt(String(json.data?.expiresAt ?? ''))
    } catch (err) {
      setError(err instanceof Error ? err.message : '授权失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-4">
      <h1 className="text-lg font-semibold">Skills OAuth 授权</h1>
      <p className="text-sm text-muted-foreground">
        点击授权会弹窗确认；同意后才会签发 token（默认 1 小时）。后端仅存 hash，本页刷新不会自动生成。
      </p>

      <Button type="button" onClick={() => setConfirmOpen(true)} disabled={loading}>
        {loading ? '处理中…' : '生成授权 Token'}
      </Button>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认签发 OAuth 授权</DialogTitle>
            <DialogDescription>
              允许该 AI 使用 Skills（OAuth）执行调试操作。授权默认有效期 1 小时，后端仅存 token hash。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)} disabled={loading}>
              取消
            </Button>
            <Button type="button" onClick={() => void authorize()} disabled={loading}>
              {loading ? '处理中…' : '确认并签发'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      {token ? (
        <>
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <div className="text-xs text-muted-foreground">Token（只显示本次）</div>
            <Input value={token} readOnly className="font-mono text-xs" />
            {expiresAt ? (
              <div className="text-xs text-muted-foreground">过期时间：{expiresAt}</div>
            ) : null}
          </div>

          <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
            <div className="text-xs text-muted-foreground">给 AI 的请求头示例</div>
            <pre className="text-xs font-mono whitespace-pre-wrap">{`LLM-Skills-Mode: oauth
LLM-Skills-Token: ${token}
LLM-Skills-AI: ${aiClientId}
LLM-Skills-Scope: theme
LLM-Skills-Request-Id: ANY_REQUEST_ID`}</pre>
          </div>

          <p className="text-xs text-muted-foreground">
            验证链接（把 token 填进去测试）：<code>{directExample.replace('...', token)}</code>
          </p>
        </>
      ) : null}
    </div>
  )
}

