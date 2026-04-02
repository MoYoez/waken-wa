import bcrypt from 'bcryptjs'
import { and, desc, eq, gt, isNull } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { skillsOauthTokens, systemSecrets } from '@/lib/drizzle-schema'
import { normalizeAiClientId } from '@/lib/skills-auth'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import { sqlTimestamp } from '@/lib/sql-timestamp'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const SKILLS_APIKEY_SECRET_KEY = 'skills_apikey_bcrypt'
function normalizeMode(raw: string | null): 'oauth' | 'apikey' | null {
  const v = String(raw ?? '').trim().toLowerCase()
  if (v === 'oauth') return 'oauth'
  if (v === 'apikey') return 'apikey'
  return null
}

async function readSecretValue(key: string): Promise<string | null> {
  const [row] = await db
    .select({ value: systemSecrets.value })
    .from(systemSecrets)
    .where(eq(systemSecrets.key, key))
    .limit(1)
  const v = row?.value?.trim()
  return v ? v : null
}

export async function GET(request: NextRequest) {
  const cfg = await getSiteConfigMemoryFirst()
  if (cfg?.skillsDebugEnabled !== true) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  }

  const mode = normalizeMode(request.nextUrl.searchParams.get('mode'))
  const token = String(request.nextUrl.searchParams.get('token') ?? '').trim()
  const scope = String(request.nextUrl.searchParams.get('scope') ?? 'theme').trim()
  const ai = normalizeAiClientId(request.nextUrl.searchParams.get('ai'))

  const configuredMode = normalizeMode(String(cfg.skillsAuthMode ?? ''))
  if (!configuredMode) {
    return NextResponse.json(
      {
        success: false,
        error: 'Skills 未配置认证模式，请先在后台设置中选择 OAuth 或 APIKEY',
        guide: {
          nextStep: 'open_admin_settings',
          where: 'Web 配置 → 进阶设置 → 允许AI使用Skills辅助调试修改',
        },
      },
      { status: 503 },
    )
  }

  if (!mode || mode !== configuredMode) {
    return NextResponse.json(
      { success: false, error: '认证模式不匹配或缺失，请使用后台显示的 direct link' },
      { status: 403 },
    )
  }

  if (!token) {
    return NextResponse.json(
      {
        success: false,
        error: '缺少 token',
        guide: {
          nextStep: mode === 'oauth' ? 'click_authorize_link' : 'rotate_apikey',
          authorizeLinkPath: '/admin/skills-authorize',
          authorizeLinkTemplate: '/admin/skills-authorize?ai=YOUR_UNIQUE_AI_ID',
        },
      },
      { status: 401 },
    )
  }

  if (mode === 'oauth') {
    if (!ai) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少 ai 标识。请使用唯一 AI 标识访问，例如 /admin/skills-authorize?ai=YOUR_AI_ID',
          guide: {
            nextStep: 'click_authorize_link',
            authorizeLinkPath: '/admin/skills-authorize',
            authorizeLinkTemplate: '/admin/skills-authorize?ai=YOUR_UNIQUE_AI_ID',
          },
        },
        { status: 401 },
      )
    }
    const now = sqlTimestamp()
    const candidates = await db
      .select({ tokenHash: skillsOauthTokens.tokenHash })
      .from(skillsOauthTokens)
      .where(
        and(
          eq(skillsOauthTokens.aiClientId, ai),
          gt(skillsOauthTokens.expiresAt, now as any),
          isNull(skillsOauthTokens.revokedAt),
        ),
      )
      .orderBy(desc(skillsOauthTokens.id))
      .limit(50)
    if (candidates.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '该 AI 尚无有效 OAuth 授权，请重新授权（默认 1 小时）',
          guide: {
            nextStep: 'click_authorize_link',
            authorizeLinkPath: '/admin/skills-authorize',
            authorizeLinkTemplate: '/admin/skills-authorize?ai=YOUR_UNIQUE_AI_ID',
          },
        },
        { status: 401 },
      )
    }
    let ok = false
    for (const row of candidates) {
      // eslint-disable-next-line no-await-in-loop
      if (await bcrypt.compare(token, row.tokenHash)) {
        ok = true
        break
      }
    }
    if (!ok) {
      return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
    }
  } else {
    const stored = await readSecretValue(SKILLS_APIKEY_SECRET_KEY)
    if (!stored) {
      return NextResponse.json(
        {
          success: false,
          error: '未配置授权信息',
          guide: {
            nextStep: 'rotate_apikey',
            authorizeLinkPath: '/admin/skills-authorize',
          },
        },
        { status: 503 },
      )
    }
    const ok = await bcrypt.compare(token, stored)
    if (!ok) {
      return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      headerPrefix: 'LLM-Skills-',
      skillsMdPath: '/api/admin/skills/md',
      headers: {
        'LLM-Skills-Mode': mode,
        'LLM-Skills-Token': 'YOUR_TOKEN',
        'LLM-Skills-AI': 'YOUR_UNIQUE_AI_ID',
        'LLM-Skills-Scope': scope,
        'LLM-Skills-Request-Id': 'ANY_REQUEST_ID',
      },
      noteForAi:
        '固定先读取 /api/admin/skills/md。若用户未配置 Skills：让用户去后台 Web 配置 → 进阶设置，启用“允许AI使用Skills辅助调试修改”，选择 OAuth 或 APIKEY。OAuth 模式由 AI 发 /admin/skills-authorize?ai=YOUR_AI_ID 链接，用户确认同意后才签发该 AI 的 1 小时 token（可并存多 token）；APIKEY 模式在后台生成/轮换 Key 后提供给 AI（无需二次确认）。',
    },
  })
}

