import { createHash } from 'node:crypto'

import { NextRequest, NextResponse } from 'next/server'

import { enforceApiRateLimit } from '@/lib/api-rate-limit'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import {
  exchangeSkillsOauthCodeForToken,
  normalizeAiClientId,
  normalizeSkillsOauthTokenTtlMinutes,
} from '@/lib/skills-auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const LLM_OAUTH_EXCHANGE_RATE_LIMIT_MAX = 30
const LLM_OAUTH_EXCHANGE_RATE_LIMIT_WINDOW_MS = 60_000
const LLM_OAUTH_EXCHANGE_FAILED_MAX = 6
const LLM_OAUTH_EXCHANGE_FAILED_WINDOW_MS = 5 * 60_000

function readHeader(request: NextRequest, name: string): string {
  return (request.headers.get(name) ?? '').trim()
}

function buildTokenKey(aiClientId: string, authorizeCode: string): string {
  const key = `${aiClientId}:${authorizeCode}`
  return createHash('sha256').update(key).digest('hex')
}

function toFailMessage(reason: string): string {
  switch (reason) {
    case 'missing_code':
      return 'Missing authorization code. Provide LLM-Skills-Token.'
    case 'missing_ai':
      return 'OAuth exchange requires an AI identifier in LLM-Skills-AI.'
    case 'invalid_code':
      return 'Invalid authorization code. Request a new authorization link.'
    case 'expired':
      return 'Authorization code has expired. Request a new authorization link.'
    case 'not_approved':
      return 'Authorization code has not been approved by an admin yet.'
    case 'already_exchanged':
      return 'Authorization code has already been exchanged. Request a new authorization link.'
    case 'ai_mismatch':
      return 'AI identifier does not match the authorization code. Use the LLM-Skills-AI value from issuance.'
    default:
      return 'OAuth exchange failed'
  }
}

export async function POST(request: NextRequest) {
  const cfg = await getSiteConfigMemoryFirst()
  if (cfg?.skillsDebugEnabled !== true) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  }
  if (String(cfg.skillsAuthMode ?? '').trim().toLowerCase() !== 'oauth') {
    return NextResponse.json(
      { success: false, error: 'OAuth mode is not active, so code exchange is unavailable.' },
      { status: 403 },
    )
  }

  const mode = readHeader(request, 'LLM-Skills-Mode').toLowerCase()
  if (mode && mode !== 'oauth') {
    return NextResponse.json(
      { success: false, error: 'Authentication mode mismatch. Use LLM-Skills-Mode: oauth.' },
      { status: 403 },
    )
  }

  const authorizeCode = readHeader(request, 'LLM-Skills-Token').toLowerCase()
  const aiClientId = normalizeAiClientId(readHeader(request, 'LLM-Skills-AI'))
  const key = buildTokenKey(aiClientId || 'unknown', authorizeCode || 'missing')

  const limitedResponse = await enforceApiRateLimit(request, {
    bucket: 'llm-oauth-exchange',
    maxRequests: LLM_OAUTH_EXCHANGE_RATE_LIMIT_MAX,
    windowMs: LLM_OAUTH_EXCHANGE_RATE_LIMIT_WINDOW_MS,
    tokenKey: key,
  })
  if (limitedResponse) return limitedResponse

  const oauthTokenTtlMinutes = normalizeSkillsOauthTokenTtlMinutes(cfg?.skillsOauthTokenTtlMinutes)
  const exchanged = await exchangeSkillsOauthCodeForToken(
    authorizeCode,
    aiClientId,
    oauthTokenTtlMinutes * 60_000,
  )
  if (!exchanged.ok) {
    const failLimited = await enforceApiRateLimit(request, {
      bucket: 'llm-oauth-exchange-failed',
      maxRequests: LLM_OAUTH_EXCHANGE_FAILED_MAX,
      windowMs: LLM_OAUTH_EXCHANGE_FAILED_WINDOW_MS,
      tokenKey: key,
    })
    if (failLimited) {
      return failLimited
    }
    return NextResponse.json(
      {
        success: false,
        error: toFailMessage(exchanged.reason),
      },
      { status: 401 },
    )
  }

  return NextResponse.json({
    success: true,
    data: {
      token: exchanged.token,
      aiClientId: exchanged.aiClientId,
      expiresAt: exchanged.expiresAt.toISOString(),
      oauthTokenTtlMinutes,
      headerPrefix: 'LLM-Skills-',
      headers: {
        'LLM-Skills-Mode': 'oauth',
        'LLM-Skills-Token': exchanged.token,
        'LLM-Skills-AI': exchanged.aiClientId,
        'LLM-Skills-Request-Id': 'ANY_REQUEST_ID',
      },
    },
  })
}
