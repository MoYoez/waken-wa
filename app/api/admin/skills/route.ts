import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import { requireAdminSession, unauthorizedJson } from '@/lib/admin-api-auth'
import { db } from '@/lib/db'
import { siteConfig } from '@/lib/drizzle-schema'
import { readJsonObject } from '@/lib/request-json'
import {
  clearSkillsApiKey,
  getSkillsSecretEnvStatus,
  hasLegacyMcpApiKeyConfigured,
  hasSkillsApiKeyConfigured,
  hasSkillsOauthTokenConfigured,
  isLegacyMcpEnabled,
  revokeAllSkillsOauthTokens,
  rotateLegacyMcpApiKey,
  rotateSkillsApiKey,
} from '@/lib/skills-auth'
import { clearSiteConfigCaches, getSiteConfigMemoryFirst } from '@/lib/site-config-cache'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function normalizeAuthMode(raw: unknown): 'oauth' | 'apikey' | null {
  const v = String(raw ?? '').trim().toLowerCase()
  if (v === 'oauth') return 'oauth'
  if (v === 'apikey') return 'apikey'
  return null
}

export async function GET() {
  const session = await requireAdminSession()
  if (!session) {
    return unauthorizedJson()
  }

  const envStatus = getSkillsSecretEnvStatus()
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
      directLinkPath: '/api/llm/direct',
      authorizeLinkPath: '/admin/skills-authorize',
      oauthAiScoped: true,
      oauthMultiToken: true,
      modeSwitchRevokesOther: true,
      headerPrefix: 'LLM-Skills-',
      secretSource: {
        skillsApiKey: envStatus.skillsApiKeyEnvManaged ? 'env' : 'db',
        legacyMcpApiKey: envStatus.legacyMcpApiKeyEnvManaged ? 'env' : 'db',
      },
      aiToolMode: String(cfg?.aiToolMode ?? '').trim().toLowerCase() === 'mcp' ? 'mcp' : 'skills',
      legacyMcpEnabled: await isLegacyMcpEnabled(),
      legacyMcpConfigured: await hasLegacyMcpApiKeyConfigured(),
      legacyMcpPath: '/api/llm/mcp',
      legacyMcpApiKeyVerifyPath: '/api/llm/mcp/apikey',
      skillsMdPath: '/api/llm/md',
    },
  })
}

export async function PATCH(request: NextRequest) {
  const session = await requireAdminSession()
  if (!session) {
    return unauthorizedJson()
  }

  try {
    const body = await readJsonObject(request)
    const enableInBody = body.enabled !== undefined && body.enabled !== null
    const enabled = enableInBody ? Boolean(body.enabled) : undefined

    const modeInBody = body.authMode !== undefined && body.authMode !== null
    const authMode = modeInBody ? normalizeAuthMode(body.authMode) : undefined

    const rotateApiKey = body.rotateApiKey === true
    const rotateLegacyMcpKey = body.rotateLegacyMcpKey === true
    const envStatus = getSkillsSecretEnvStatus()
    if (rotateApiKey && envStatus.skillsApiKeyEnvManaged) {
      return NextResponse.json(
        { success: false, error: 'SKILLS_API_KEY 由环境变量接管，请在部署环境中轮换' },
        { status: 409 },
      )
    }
    if (rotateLegacyMcpKey && envStatus.legacyMcpApiKeyEnvManaged) {
      return NextResponse.json(
        { success: false, error: 'LEGACY_MCP_API_KEY 由环境变量接管，请在部署环境中轮换' },
        { status: 409 },
      )
    }
    let generatedApiKey: string | null = null
    let generatedLegacyMcpApiKey: string | null = null

    if (rotateApiKey) {
      generatedApiKey = await rotateSkillsApiKey()
    }
    if (rotateLegacyMcpKey) {
      generatedLegacyMcpApiKey = await rotateLegacyMcpApiKey()
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

      const existingMode = normalizeAuthMode(existing.skillsAuthMode)
      if (authMode && authMode !== existingMode) {
        if (authMode === 'oauth') {
          // Switch to OAuth: invalidate APIKEY immediately.
          await clearSkillsApiKey()
        } else {
          // Switch to APIKEY: revoke OAuth tokens immediately.
          await revokeAllSkillsOauthTokens()
        }
      }
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
        modeSwitchRevokesOther: true,
        generatedApiKey,
        generatedLegacyMcpApiKey,
        secretSource: {
          skillsApiKey: envStatus.skillsApiKeyEnvManaged ? 'env' : 'db',
          legacyMcpApiKey: envStatus.legacyMcpApiKeyEnvManaged ? 'env' : 'db',
        },
        aiToolMode: String(cfg?.aiToolMode ?? '').trim().toLowerCase() === 'mcp' ? 'mcp' : 'skills',
        legacyMcpEnabled: await isLegacyMcpEnabled(),
        legacyMcpConfigured: await hasLegacyMcpApiKeyConfigured(),
      },
    })
  } catch (error) {
    console.error('更新 Skills 设置失败:', error)
    return NextResponse.json({ success: false, error: '更新失败' }, { status: 500 })
  }
}

