'use client'

import { useT } from 'next-i18next/client'
import { useMemo, useState } from 'react'

import { approveSkillsOauthAuthorizeCode } from '@/components/admin/admin-query-mutations'
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
  const { t } = useT('admin')
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
      const result = await approveSkillsOauthAuthorizeCode(authorizeCode)
      setApproved(result.approved)
      setApprovedAt(result.approvedAt)
      setExpiresAt(result.expiresAt)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('skillsAuthorizeCard.authorizeFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-4">
      <h1 className="text-lg font-semibold">{t('skillsAuthorizeCard.title')}</h1>
      <p className="text-sm text-muted-foreground">
        {t('skillsAuthorizeCard.description')}
      </p>

      <Button type="button" onClick={() => setConfirmOpen(true)} disabled={loading}>
        {loading ? t('skillsAuthorizeCard.processing') : t('skillsAuthorizeCard.generateToken')}
      </Button>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('skillsAuthorizeCard.confirmIssueTitle')}</DialogTitle>
            <DialogDescription>
              {t('skillsAuthorizeCard.confirmIssueDescription')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)} disabled={loading}>
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={() => void authorize()} disabled={loading}>
              {loading ? t('skillsAuthorizeCard.processing') : t('skillsAuthorizeCard.confirmAndIssue')}
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
            <div className="text-xs text-muted-foreground">{t('skillsAuthorizeCard.codeForAi')}</div>
            <Input value={authorizeCode} readOnly className="font-mono text-xs" />
            {approvedAt ? (
              <div className="text-xs text-muted-foreground">
                {t('skillsAuthorizeCard.approvedAt', { value: approvedAt })}
              </div>
            ) : null}
            {expiresAt ? (
              <div className="text-xs text-muted-foreground">
                {t('skillsAuthorizeCard.expiresAt', { value: expiresAt })}
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
            <div className="text-xs text-muted-foreground">
              {t('skillsAuthorizeCard.exchangeExample')}
            </div>
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

Invoke-RestMethod -Method Post -Uri '${publicOrigin || ''}/api/llm/oauth/exchange' -Headers $headers -ContentType '${t('skillsAuthorizeCard.authorizationHeader')}' -Body $body`}</pre>
            <p className="text-xs text-muted-foreground">
              {t('skillsAuthorizeCard.powershellUtf8Hint')}
              <code className="mx-1">{t('skillsAuthorizeCard.authorizationHeader')}</code>
              {t('skillsAuthorizeCard.powershellUtf8HintSuffix')}{' '}
              <code className="mx-1">{t('skillsAuthorizeCard.garbled')}</code>.
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            {t('skillsAuthorizeCard.verifyLink')} <code>{directExample}</code>
          </p>
        </>
      ) : null}
    </div>
  )
}

