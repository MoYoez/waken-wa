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
      return '缺少授权码，请提供 LLM-Skills-Token'
    case 'missing_ai':
      return 'OAuth 兑换缺少 AI 标识（LLM-Skills-AI）'
    case 'invalid_code':
      return '授权码无效，请重新获取授权链接'
    case 'expired':
      return '授权码已过期，请重新获取授权链接'
    case 'not_approved':
      return '授权码尚未由管理员确认，请先完成页面授权'
    case 'already_exchanged':
      return '授权码已兑换过，请重新获取授权链接'
    case 'ai_mismatch':
      return 'AI 标识与授权码不匹配，请携带签发时的 LLM-Skills-AI'
    default:
      return 'OAuth 兑换失败'
  }
}

export async function POST(request: NextRequest) {
  const cfg = await getSiteConfigMemoryFirst()
  if (cfg?.skillsDebugEnabled !== true) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  }
  if (String(cfg.skillsAuthMode ?? '').trim().toLowerCase() !== 'oauth') {
    return NextResponse.json(
      { success: false, error: '当前不是 OAuth 模式，无法使用 code 换 key' },
      { status: 403 },
    )
  }

  const mode = readHeader(request, 'LLM-Skills-Mode').toLowerCase()
  if (mode && mode !== 'oauth') {
    return NextResponse.json(
      { success: false, error: '认证模式不匹配，请使用 LLM-Skills-Mode: oauth' },
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
