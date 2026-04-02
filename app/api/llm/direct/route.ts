import { NextRequest, NextResponse } from 'next/server'

import { getPublicOrigin } from '@/lib/public-request-url'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import {
  createSkillsOauthAuthorizeCode,
  hasLegacyMcpApiKeyConfigured,
  hasSkillsApiKeyConfigured,
  hasSkillsOauthTokenConfigured,
  isLegacyMcpEnabled,
  normalizeAiClientId,
} from '@/lib/skills-auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function normalizeMode(raw: string | null): 'oauth' | 'apikey' | null {
  const v = String(raw ?? '').trim().toLowerCase()
  if (v === 'oauth') return 'oauth'
  if (v === 'apikey') return 'apikey'
  return null
}

export async function GET(request: NextRequest) {
  const cfg = await getSiteConfigMemoryFirst()
  if (cfg?.skillsDebugEnabled !== true) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  }

  const origin = getPublicOrigin(request)
  const h = (name: string) => (request.headers.get(name) ?? '').trim()
  const q = (name: string) => (request.nextUrl.searchParams.get(name) ?? '').trim()
  const modeFromInput = normalizeMode(h('LLM-Skills-Mode') || q('mode'))
  const token = h('LLM-Skills-Token') || q('token')
  const scope = h('LLM-Skills-Scope') || q('scope') || 'theme'
  const aiInput = h('LLM-Skills-AI') || q('ai')
  const ai = normalizeAiClientId(aiInput)

  const configuredMode = normalizeMode(String(cfg.skillsAuthMode ?? ''))
  const preferredToolMode = String(cfg.aiToolMode ?? '').trim().toLowerCase() === 'mcp' ? 'mcp' : 'skills'
  const finalUrl = origin
  const llmBaseUrl = `${origin}/api/llm`
  const endpoints = {
    direct: `${llmBaseUrl}/direct`,
    markdown: `${llmBaseUrl}/md`,
    settings: `${llmBaseUrl}/settings`,
    appsExport: `${llmBaseUrl}/activity/apps-export`,
    legacyMcp: `${llmBaseUrl}/mcp`,
    legacyMcpApiKeyVerify: `${llmBaseUrl}/mcp/apikey`,
  }
  const legacyMcpEnabled = await isLegacyMcpEnabled()
  const legacyMcpConfigured = await hasLegacyMcpApiKeyConfigured()

  if (preferredToolMode === 'mcp') {
    if (!legacyMcpEnabled) {
      return NextResponse.json(
        {
          success: false,
          error: 'MCP 未启用，请先在后台打开 MCP 模式并启用独立 MCP 开关',
          finalUrl,
          preferredToolMode,
          endpoints,
          guide: {
            nextStep: 'open_admin_settings',
            where: 'Web 配置 → 进阶设置 → 允许 AI 调试 → MCP',
            finalUrl,
          },
        },
        { status: 503 },
      )
    }

    if (!legacyMcpConfigured) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少 MCP API Key',
          finalUrl,
          preferredToolMode,
          data: {
            detectedMode: 'apikey',
            preferredToolMode,
            endpoints,
            finalUrl,
            legacyMcp: {
              url: endpoints.legacyMcp,
              auth: 'apikey',
              enabled: legacyMcpEnabled,
              configured: legacyMcpConfigured,
              verifyUrl: endpoints.legacyMcpApiKeyVerify,
            },
          },
          guide: {
            nextStep: 'provide_mcp_apikey',
            finalUrl,
          },
        },
        { status: 401 },
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        finalUrl,
        preferredToolMode,
        detectedMode: 'apikey',
        endpoints,
        legacyMcp: {
          url: endpoints.legacyMcp,
          auth: 'apikey',
          enabled: legacyMcpEnabled,
          configured: legacyMcpConfigured,
          verifyUrl: endpoints.legacyMcpApiKeyVerify,
        },
        guide: {
          useLegacyMcpAt: endpoints.legacyMcp,
          verifyLegacyMcpApiKeyAt: endpoints.legacyMcpApiKeyVerify,
        },
      },
    })
  }

  if (!configuredMode) {
    return NextResponse.json(
      {
        success: false,
        error: 'Skills 未配置认证模式，请先在后台设置中选择 OAuth 或 APIKEY',
        finalUrl,
        preferredToolMode,
        endpoints,
        guide: {
          nextStep: 'open_admin_settings',
          where: 'Web 配置 → 进阶设置 → 允许 AI 调试',
          detectModeBy: `GET ${endpoints.direct}`,
        },
      },
      { status: 503 },
    )
  }

  if (modeFromInput && modeFromInput !== configuredMode) {
    return NextResponse.json(
      {
        success: false,
        error: '认证模式不匹配或缺失，请先请求 direct 接口读取当前模式',
        finalUrl,
        preferredToolMode,
        endpoints,
        guide: {
          nextStep: 'detect_mode',
          detectModeBy: `GET ${endpoints.direct}`,
          detectedMode: configuredMode,
        },
      },
      { status: 403 },
    )
  }

  const mode = modeFromInput ?? configuredMode
  const effectiveAi = mode === 'oauth' ? (ai || 'waken-wa-default-ai') : ai

  if (!token) {
    const authorizeCode =
      mode === 'oauth' ? await createSkillsOauthAuthorizeCode(effectiveAi) : null
    const authorizeLink =
      mode === 'oauth'
        ? `${origin}/admin/skills-authorize?code=${encodeURIComponent(authorizeCode?.code ?? '')}`
        : null
    return NextResponse.json(
      {
        success: false,
        error: '缺少 token',
        finalUrl,
        preferredToolMode,
        data: {
          detectedMode: mode,
          preferredToolMode,
          endpoints,
          finalUrl,
          headerPrefix: 'LLM-Skills-',
          preferredHeaders:
            mode === 'oauth'
              ? ['LLM-Skills-Mode', 'LLM-Skills-Token', 'LLM-Skills-AI', 'LLM-Skills-Scope']
              : ['LLM-Skills-Mode', 'LLM-Skills-Token', 'LLM-Skills-Scope'],
          legacyMcp: {
            url: endpoints.legacyMcp,
            auth: 'apikey',
            enabled: legacyMcpEnabled,
            configured: legacyMcpConfigured,
            verifyUrl: endpoints.legacyMcpApiKeyVerify,
          },
        },
        guide: {
          nextStep: mode === 'oauth' ? 'click_authorize_link' : 'provide_apikey',
          detectedMode: mode,
          authorizeLink,
          finalUrl,
        },
      },
      { status: 401 },
    )
  }

  return NextResponse.json({
    success: true,
    data: {
      finalUrl,
      preferredToolMode,
      detectedMode: mode,
      endpoints,
      headerPrefix: 'LLM-Skills-',
      headers: {
        'LLM-Skills-Mode': mode,
        'LLM-Skills-Token': 'YOUR_TOKEN',
        'LLM-Skills-AI': effectiveAi || 'YOUR_UNIQUE_AI_ID',
        'LLM-Skills-Scope': scope,
        'LLM-Skills-Request-Id': 'ANY_REQUEST_ID',
      },
        capabilities: {
          supportsOauth: configuredMode === 'oauth',
          supportsApiKey: configuredMode === 'apikey',
          oauthConfigured: await hasSkillsOauthTokenConfigured(),
          apiKeyConfigured: await hasSkillsApiKeyConfigured(),
          legacyMcpConfigured: legacyMcpConfigured,
          legacyMcpEnabled,
        },
      guide: {
        detectModeBy: `GET ${endpoints.direct}`,
        useMarkdownAt: endpoints.markdown,
        useSettingsAt: endpoints.settings,
        useAppsExportAt: endpoints.appsExport,
        useLegacyMcpAt: endpoints.legacyMcp,
        verifyLegacyMcpApiKeyAt: endpoints.legacyMcpApiKeyVerify,
      },
    },
  })
}
