import type { NextResponse } from 'next/server'

export type SkillsAuthMode = 'oauth' | 'apikey'
export type SkillsScope = 'feature' | 'theme' | 'content'

export type GuardOk = {
  ok: true
  isAdmin: boolean
  mode: SkillsAuthMode
  scope: SkillsScope | null
  requestId: string | null
  aiClientId: string | null
}

export type GuardFail = { ok: false; response: NextResponse }

export type SkillsVerifyOk = GuardOk
export type SkillsVerifyFail = { ok: false; error: string; status: number }

export type SkillsOauthAuthorizeRequest = {
  id: number
  aiClientId: string
  expiresAt: Date
  approvedAt: Date | null
  approvedBy: number | null
  exchangeAt: Date | null
}

export type SkillsOauthAuthorizeSummaryRow = {
  aiClientId: string
  pendingCodeCount: number
  approvedCodeCount: number
  activeTokenCount: number
  lastApprovedAt: string | null
  lastExchangedAt: string | null
}

export type SkillsOauthExchangeResult =
  | {
      ok: true
      token: string
      expiresAt: Date
      aiClientId: string
    }
  | {
      ok: false
      reason:
        | 'missing_code'
        | 'missing_ai'
        | 'invalid_code'
        | 'expired'
        | 'not_approved'
        | 'already_exchanged'
        | 'ai_mismatch'
    }
