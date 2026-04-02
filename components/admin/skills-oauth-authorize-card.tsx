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
  const [approved, setApproved] = useState(false)
  const [approvedAt, setApprovedAt] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [error, setError] = useState('')
  const directExample = useMemo(() => {
    const base = publicOrigin || ''
    return base
      ? `${base}/api/llm/direct?mode=oauth&ai=${encodeURIComponent(aiClientId)}`
      : `/api/llm/direct?mode=oauth&ai=${encodeURIComponent(aiClientId)}`
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
      setApproved(json.data?.approved === true)
      setApprovedAt(String(json.data?.approvedAt ?? ''))
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
        点击授权会弹窗确认；同意后 AI 需使用当前授权码兑换 key（有效期按后台设置）。后端仅存 hash，本页不会显示 key 明文。
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

      {approved ? (
        <>
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <div className="text-xs text-muted-foreground">授权码（供 AI 兑换）</div>
            <Input value={authorizeCode} readOnly className="font-mono text-xs" />
            {approvedAt ? (
              <div className="text-xs text-muted-foreground">确认时间：{approvedAt}</div>
            ) : null}
            {expiresAt ? (
              <div className="text-xs text-muted-foreground">过期时间：{expiresAt}</div>
            ) : null}
          </div>

          <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
            <div className="text-xs text-muted-foreground">给 AI 的兑换请求示例（code 换 key）</div>
            <pre className="text-xs font-mono whitespace-pre-wrap">{`POST ${publicOrigin || ''}/api/llm/oauth/exchange
LLM-Skills-Mode: oauth
LLM-Skills-Token: ${authorizeCode}
LLM-Skills-AI: ${aiClientId}
LLM-Skills-Request-Id: ANY_REQUEST_ID`}</pre>
            <pre className="text-xs font-mono whitespace-pre-wrap">{`$headers = @{
  'LLM-Skills-Mode' = 'oauth'
  'LLM-Skills-Token' = '${authorizeCode}'
  'LLM-Skills-AI' = '${aiClientId}'
}

$body = [System.Text.Encoding]::UTF8.GetBytes('{}')

Invoke-RestMethod -Method Post -Uri '${publicOrigin || ''}/api/llm/oauth/exchange' -Headers $headers -ContentType 'application/json; charset=utf-8' -Body $body`}</pre>
            <p className="text-xs text-muted-foreground">
              Windows PowerShell 发送中文或 emoji JSON 时，请先转成 UTF-8 bytes，再以
              <code className="mx-1">application/json; charset=utf-8</code>
              发送，避免被写成 <code className="mx-1">???</code>。
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            兑换出 key 后，再用该 key 访问验证链接：<code>{directExample}</code>
          </p>
        </>
      ) : null}
    </div>
  )
}

