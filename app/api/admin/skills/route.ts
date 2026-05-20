import { NextRequest, NextResponse } from 'next/server'

import { requireAdminSession, unauthorizedJson } from '@/lib/admin-api-auth'
import { updateSiteConfigFromPayload } from '@/lib/llm-site-config'
import { readJsonObject } from '@/lib/request-json'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import { parseIntegerInRangeForWrite } from '@/lib/site-config-values'
import {
  clearSkillsApiKey,
  getConfiguredSkillsMode,
  getSkillsSecretEnvStatus,
  hasLegacyMcpApiKeyConfigured,
  hasSkillsApiKeyConfigured,
  hasSkillsOauthTokenConfigured,
  isLegacyMcpEnabled,
  listSkillsOauthAuthorizeSummary,
  normalizeSkillsOauthTokenTtlMinutes,
  revokeAllSkillsOauthTokens,
  revokeSkillsOauthTokensByAiClientId,
  rotateLegacyMcpApiKey,
  rotateSkillsApiKey,
} from '@/lib/skills-auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const session = await requireAdminSession()
  if (!session) {
    return unauthorizedJson()
  }

  const envStatus = getSkillsSecretEnvStatus()
  const cfg = await getSiteConfigMemoryFirst()
  const authMode = getConfiguredSkillsMode(cfg?.skillsAuthMode)
  return NextResponse.json({
    success: true,
    data: {
      enabled: cfg?.skillsDebugEnabled === true,
      authMode,
      oauthExpiresAt: null,
      apiKeyConfigured: await hasSkillsApiKeyConfigured(),
      oauthConfigured: await hasSkillsOauthTokenConfigured(),
      oauthTokenTtlMinutes: normalizeSkillsOauthTokenTtlMinutes(cfg?.skillsOauthTokenTtlMinutes),
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
      oauthExchangePath: '/api/llm/oauth/exchange',
      aiAuthorizations: await listSkillsOauthAuthorizeSummary(),
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
    const authMode = modeInBody ? getConfiguredSkillsMode(body.authMode) : undefined

    const rotateApiKey = body.rotateApiKey === true
    const rotateLegacyMcpKey = body.rotateLegacyMcpKey === true
    const oauthTokenTtlMinutesInBody =
      body.oauthTokenTtlMinutes !== undefined && body.oauthTokenTtlMinutes !== null
    const oauthTokenTtlMinutes = oauthTokenTtlMinutesInBody
      ? parseIntegerInRangeForWrite(body.oauthTokenTtlMinutes, 5, 1440, 'oauthTokenTtlMinutes')
      : undefined
    const revokeOauthForAiClientId = String(body.revokeOauthForAiClientId ?? '')
      .trim()
      .toLowerCase()
    let revokedOauthTokenCount = 0
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
    if (revokeOauthForAiClientId) {
      revokedOauthTokenCount = await revokeSkillsOauthTokensByAiClientId(revokeOauthForAiClientId)
    }

    let updatedConfig: Record<string, unknown> | null = null
    if (enabled !== undefined || authMode !== undefined || oauthTokenTtlMinutes !== undefined) {
      const existing = await getSiteConfigMemoryFirst()
      if (!existing) {
        return NextResponse.json(
          { success: false, error: '请先完成站点初始化配置，再启用 Skills' },
          { status: 400 },
        )
      }
      const configPatch: Record<string, unknown> = {}
      if (enabled !== undefined) configPatch.skillsDebugEnabled = enabled
      if (authMode !== undefined) configPatch.skillsAuthMode = authMode
      if (oauthTokenTtlMinutes !== undefined) {
        configPatch.skillsOauthTokenTtlMinutes = oauthTokenTtlMinutes
      }
      updatedConfig = await updateSiteConfigFromPayload(configPatch, {
        allowRestrictedFields: true,
      })

      const existingMode = getConfiguredSkillsMode(existing.skillsAuthMode)
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

    const cfg = updatedConfig ?? (await getSiteConfigMemoryFirst())
    const authModeOut = getConfiguredSkillsMode(cfg?.skillsAuthMode)

    return NextResponse.json({
      success: true,
      data: {
        enabled: cfg?.skillsDebugEnabled === true,
        authMode: authModeOut,
        oauthExpiresAt: null,
        apiKeyConfigured: await hasSkillsApiKeyConfigured(),
        oauthConfigured: await hasSkillsOauthTokenConfigured(),
        oauthTokenTtlMinutes: normalizeSkillsOauthTokenTtlMinutes(cfg?.skillsOauthTokenTtlMinutes),
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
        aiAuthorizations: await listSkillsOauthAuthorizeSummary(),
        revokedOauthTokenCount,
      },
    })
  } catch (error) {
    if (error instanceof Error && typeof (error as { status?: unknown }).status === 'number') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: (error as unknown as { status: number }).status },
      )
    }
    console.error('更新 Skills 设置失败:', error)
    return NextResponse.json({ success: false, error: '更新失败' }, { status: 500 })
  }
}
