import { NextRequest, NextResponse } from 'next/server'

import { requireAdminSession, unauthorizedJson } from '@/lib/admin-api-auth'
import { getRequestLanguage } from '@/lib/i18n/request-locale'
import { getT } from '@/lib/i18n/server'
import { readJsonObject } from '@/lib/request-json'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import {
  approveSkillsOauthAuthorizeCode,
  getSkillsOauthAuthorizeRequest,
} from '@/lib/skills-auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request: NextRequest) {
  const { t } = await getT('admin', { lng: getRequestLanguage(request) })
  const session = await requireAdminSession()
  if (!session) {
    return unauthorizedJson()
  }

  const cfg = await getSiteConfigMemoryFirst()
  if (!cfg?.skillsDebugEnabled) {
    return NextResponse.json(
      { success: false, error: t('api.skillsOauth.debugDisabled') },
      { status: 400 },
    )
  }
  if (String(cfg.skillsAuthMode ?? '').toLowerCase() !== 'oauth') {
    return NextResponse.json(
      { success: false, error: t('api.skillsOauth.oauthModeRequired') },
      { status: 400 },
    )
  }

  const body = await readJsonObject(request)
  const authorizeCode = String(body?.authorizeCode ?? '').trim()
  if (body?.confirm !== true) {
    return NextResponse.json(
      { success: false, error: t('api.skillsOauth.confirmRequired') },
      { status: 400 },
    )
  }
  const authorizeRequest = await getSkillsOauthAuthorizeRequest(authorizeCode)
  if (!authorizeRequest) {
    return NextResponse.json(
      { success: false, error: t('api.skillsOauth.invalidLink') },
      { status: 400 },
    )
  }
  if (authorizeRequest.expiresAt.getTime() <= Date.now()) {
    return NextResponse.json(
      { success: false, error: t('api.skillsOauth.expiredLink') },
      { status: 400 },
    )
  }
  if (authorizeRequest.exchangeAt) {
    return NextResponse.json(
      { success: false, error: t('api.skillsOauth.alreadyExchanged') },
      { status: 400 },
    )
  }

  const approved = await approveSkillsOauthAuthorizeCode(
    authorizeCode,
    Number((session as any)?.userId ?? 0),
  )
  if (!approved) {
    return NextResponse.json(
      { success: false, error: t('api.skillsOauth.approveFailed') },
      { status: 400 },
    )
  }

  return NextResponse.json({
    success: true,
    data: {
      approved: true,
      aiClientId: approved.aiClientId,
      approvedAt: approved.approvedAt.toISOString(),
      expiresAt: approved.expiresAt.toISOString(),
      headerPrefix: 'LLM-Skills-',
      guide: {
        nextStep: 'ai_exchange_code_for_key',
        exchangePath: '/api/llm/oauth/exchange',
      },
    },
  })
}

