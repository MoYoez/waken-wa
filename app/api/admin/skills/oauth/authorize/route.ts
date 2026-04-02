import { NextRequest, NextResponse } from 'next/server'

import { requireAdminSession, unauthorizedJson } from '@/lib/admin-api-auth'
import { readJsonObject } from '@/lib/request-json'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import {
  getSkillsOauthAuthorizeRequest,
  rotateSkillsOauthToken,
} from '@/lib/skills-auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request: NextRequest) {
  const session = await requireAdminSession()
  if (!session) {
    return unauthorizedJson()
  }

  const cfg = await getSiteConfigMemoryFirst()
  if (!cfg?.skillsDebugEnabled) {
    return NextResponse.json(
      { success: false, error: 'Skills 未启用，请先在进阶设置中启用' },
      { status: 400 },
    )
  }
  if (String(cfg.skillsAuthMode ?? '').toLowerCase() !== 'oauth') {
    return NextResponse.json(
      { success: false, error: '当前不是 OAuth 模式，请先在进阶设置中切换' },
      { status: 400 },
    )
  }

  const body = await readJsonObject(request)
  const authorizeCode = String(body?.authorizeCode ?? '').trim()
  if (body?.confirm !== true) {
    return NextResponse.json(
      { success: false, error: '用户未确认授权' },
      { status: 400 },
    )
  }
  const authorizeRequest = await getSkillsOauthAuthorizeRequest(authorizeCode)
  if (!authorizeRequest) {
    return NextResponse.json(
      { success: false, error: '授权链接无效或已过期，请重新打开新的授权链接' },
      { status: 400 },
    )
  }

  const { token, expiresAt, aiClientId } = await rotateSkillsOauthToken(
    60 * 60_000,
    authorizeRequest.aiClientId,
  )
  return NextResponse.json({
    success: true,
    data: {
      token,
      aiClientId,
      expiresAt: expiresAt.toISOString(),
      headerPrefix: 'LLM-Skills-',
    },
  })
}

