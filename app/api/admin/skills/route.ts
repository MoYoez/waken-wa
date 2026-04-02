import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { siteConfig } from '@/lib/drizzle-schema'
import {
  hasSkillsApiKeyConfigured,
  hasSkillsOauthTokenConfigured,
  rotateSkillsApiKey,
} from '@/lib/skills-auth'
import { clearSiteConfigCaches, getSiteConfigMemoryFirst } from '@/lib/site-config-cache'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function requireAdmin() {
  const session = await getSession()
  return session ?? null
}

function normalizeAuthMode(raw: unknown): 'oauth' | 'apikey' | null {
  const v = String(raw ?? '').trim().toLowerCase()
  if (v === 'oauth') return 'oauth'
  if (v === 'apikey') return 'apikey'
  return null
}

export async function GET() {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }

  const cfg = await getSiteConfigMemoryFirst()
  const authMode = normalizeAuthMode(cfg?.skillsAuthMode)
  return NextResponse.json({
    success: true,
    data: {
      enabled: cfg?.skillsDebugEnabled === true,
      authMode,
      oauthExpiresAt: null,
      apiKeyConfigured: await hasSkillsApiKeyConfigured(),
      oauthConfigured: await hasSkillsOauthTokenConfigured(),
      directLinkPath: '/api/admin/skills/direct',
      authorizeLinkPath: '/admin/skills-authorize',
      authorizeLinkTemplate: '/admin/skills-authorize?ai=YOUR_UNIQUE_AI_ID',
      oauthAiScoped: true,
      oauthMultiToken: true,
      headerPrefix: 'LLM-Skills-',
    },
  })
}

export async function PATCH(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const enableInBody = body.enabled !== undefined && body.enabled !== null
    const enabled = enableInBody ? Boolean(body.enabled) : undefined

    const modeInBody = body.authMode !== undefined && body.authMode !== null
    const authMode = modeInBody ? normalizeAuthMode(body.authMode) : undefined

    const rotateApiKey = body.rotateApiKey === true
    let generatedApiKey: string | null = null

    if (rotateApiKey) {
      generatedApiKey = await rotateSkillsApiKey()
    }

    if (enabled !== undefined || authMode !== undefined) {
      const existing = await getSiteConfigMemoryFirst()
      if (!existing) {
        return NextResponse.json(
          { success: false, error: '请先完成站点初始化配置，再启用 Skills' },
          { status: 400 },
        )
      }
      await db
        .update(siteConfig)
        .set({
          skillsDebugEnabled: enabled === undefined ? existing.skillsDebugEnabled : enabled,
          skillsAuthMode: authMode === undefined ? existing.skillsAuthMode : authMode,
        })
        .where(eq(siteConfig.id, 1))
      await clearSiteConfigCaches()
    }

    const cfg = await getSiteConfigMemoryFirst()
    const authModeOut = normalizeAuthMode(cfg?.skillsAuthMode)

    return NextResponse.json({
      success: true,
      data: {
        enabled: cfg?.skillsDebugEnabled === true,
        authMode: authModeOut,
        oauthExpiresAt: null,
        apiKeyConfigured: await hasSkillsApiKeyConfigured(),
        oauthConfigured: await hasSkillsOauthTokenConfigured(),
        oauthAiScoped: true,
        oauthMultiToken: true,
        generatedApiKey,
      },
    })
  } catch (error) {
    console.error('更新 Skills 设置失败:', error)
    return NextResponse.json({ success: false, error: '更新失败' }, { status: 500 })
  }
}

