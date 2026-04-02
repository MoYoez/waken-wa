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

  const h = (name: string) => (request.headers.get(name) ?? '').trim()
  const q = (name: string) => (request.nextUrl.searchParams.get(name) ?? '').trim()
  const modeFromInput = normalizeMode(h('LLM-Skills-Mode') || q('mode'))
  const token = h('LLM-Skills-Token') || q('token')
  const scope = h('LLM-Skills-Scope') || q('scope') || 'theme'
  const ai = normalizeAiClientId(h('LLM-Skills-AI') || q('ai'))

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

  if (modeFromInput && modeFromInput !== configuredMode) {
    return NextResponse.json(
      { success: false, error: '认证模式不匹配或缺失，请使用后台显示的 direct link' },
      { status: 403 },
    )
  }
  const mode = modeFromInput ?? configuredMode

  if (mode === 'oauth' && !ai) {
    return NextResponse.json(
      {
        success: false,
        error: 'OAuth 模式缺少 AI 标识（LLM-Skills-AI 或 ai 参数）',
        guide: {
          nextStep: 'click_authorize_link',
          authorizeLinkPath: '/admin/skills-authorize',
          authorizeLinkTemplate: '/admin/skills-authorize?ai=YOUR_UNIQUE_AI_ID',
          authorizeLink: null,
        },
      },
      { status: 401 },
    )
  }

  if (!token) {
    const authorizeLink = ai
      ? `${request.nextUrl.origin}/admin/skills-authorize?ai=${encodeURIComponent(ai)}`
      : null
    return NextResponse.json(
      {
        success: false,
        error: '缺少 token',
        guide: {
          nextStep: mode === 'oauth' ? 'click_authorize_link' : 'rotate_apikey',
          authorizeLinkPath: '/admin/skills-authorize',
          authorizeLinkTemplate: '/admin/skills-authorize?ai=YOUR_UNIQUE_AI_ID',
          authorizeLink,
        },
      },
      { status: 401 },
    )
  }

  let resolvedAiClientId: string | null = ai || null
  if (mode === 'oauth') {
    const now = sqlTimestamp()
    const candidates = await db
      .select({ tokenHash: skillsOauthTokens.tokenHash, aiClientId: skillsOauthTokens.aiClientId })
      .from(skillsOauthTokens)
      .where(
        and(
          eq(skillsOauthTokens.aiClientId, ai),
          gt(skillsOauthTokens.expiresAt, now as any),
          isNull(skillsOauthTokens.revokedAt),
        ),
      )
      .orderBy(desc(skillsOauthTokens.id))
    if (candidates.length === 0) {
      const authorizeLink = `${request.nextUrl.origin}/admin/skills-authorize?ai=${encodeURIComponent(ai)}`
      return NextResponse.json(
        {
          success: false,
          error: '该 AI 尚无有效 OAuth 授权，请重新授权（默认 1 小时）',
          guide: {
            nextStep: 'click_authorize_link',
            authorizeLinkPath: '/admin/skills-authorize',
            authorizeLinkTemplate: '/admin/skills-authorize?ai=YOUR_UNIQUE_AI_ID',
            authorizeLink,
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
        resolvedAiClientId = row.aiClientId
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

  const oauthAuthorizeLink =
    mode === 'oauth' && resolvedAiClientId
      ? `${request.nextUrl.origin}/admin/skills-authorize?ai=${encodeURIComponent(resolvedAiClientId)}`
      : null

  return NextResponse.json({
    success: true,
    data: {
      headerPrefix: 'LLM-Skills-',
      skillsMdPath: '/api/admin/skills/md',
      oauthAuthorizeLink,
      headers: {
        'LLM-Skills-Mode': mode,
        'LLM-Skills-Token': 'YOUR_TOKEN',
        'LLM-Skills-AI': resolvedAiClientId || 'YOUR_UNIQUE_AI_ID',
        'LLM-Skills-Scope': scope,
        'LLM-Skills-Request-Id': 'ANY_REQUEST_ID',
      },
      noteForAi:
        '固定先读取 /api/admin/skills/md。若有环境配置优先读取 waken-wa-host-url 与 waken-wa-host-apikey；若不可用则停止使用并询问用户。若用户未配置 Skills：让用户去后台 Web 配置 → 进阶设置，启用“允许AI使用Skills辅助调试修改”，选择 OAuth 或 APIKEY。OAuth 模式先请求本接口获取 guide.authorizeLink（后端生成），再发给用户确认；确认后才签发该 AI 的 1 小时 token（可并存多 token），并且 OAuth 请求必须携带 LLM-Skills-AI。APIKEY 模式在后台生成/轮换 Key 后提供给 AI（无需二次确认）。',
    },
  })
}

