import { NextRequest, NextResponse } from 'next/server'

import { enforceApiRateLimit } from '@/lib/api-rate-limit'
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
import type { LlmEndpoints, SkillsMode, ToolMode } from '@/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const LLM_DIRECT_RATE_LIMIT_MAX = 120
const LLM_DIRECT_RATE_LIMIT_WINDOW_MS = 60_000

function normalizeMode(raw: string | null): 'oauth' | 'apikey' | null {
  const v = String(raw ?? '').trim().toLowerCase()
  if (v === 'oauth') return 'oauth'
  if (v === 'apikey') return 'apikey'
  return null
}

function resolvePreferredToolMode(raw: unknown): ToolMode {
  return String(raw ?? '').trim().toLowerCase() === 'mcp' ? 'mcp' : 'skills'
}

function buildEndpoints(origin: string): LlmEndpoints {
  const llmBaseUrl = `${origin}/api/llm`
  return {
    llmBase: llmBaseUrl,
    direct: `${llmBaseUrl}/direct`,
    markdown: `${llmBaseUrl}/md`,
    settings: `${llmBaseUrl}/settings`,
    appsExport: `${llmBaseUrl}/activity/apps-export`,
    legacyMcp: `${llmBaseUrl}/mcp`,
    legacyMcpApiKeyVerify: `${llmBaseUrl}/mcp/apikey`,
  }
}

function getInputValue(request: NextRequest, headerName: string, queryName: string): string {
  return (request.headers.get(headerName) ?? '').trim() || (request.nextUrl.searchParams.get(queryName) ?? '').trim()
}

function getHeaderValue(request: NextRequest, headerName: string): string {
  return (request.headers.get(headerName) ?? '').trim()
}

function hasQueryToken(request: NextRequest): boolean {
  return (request.nextUrl.searchParams.get('token') ?? '').trim().length > 0
}

export async function GET(request: NextRequest) {
  if (hasQueryToken(request)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Query token 已废弃，请改用 LLM-Skills-Token 请求头',
      },
      { status: 400 },
    )
  }

  const limitedResponse = await enforceApiRateLimit(request, {
    bucket: 'llm-direct',
    maxRequests: LLM_DIRECT_RATE_LIMIT_MAX,
    windowMs: LLM_DIRECT_RATE_LIMIT_WINDOW_MS,
  })
  if (limitedResponse) return limitedResponse

  const cfg = await getSiteConfigMemoryFirst()
  if (cfg?.skillsDebugEnabled !== true) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  }

  const origin = getPublicOrigin(request)
  const modeFromInput = normalizeMode(getInputValue(request, 'LLM-Skills-Mode', 'mode'))
  const token = getHeaderValue(request, 'LLM-Skills-Token')
  const scope = getInputValue(request, 'LLM-Skills-Scope', 'scope') || 'theme'
  const ai = normalizeAiClientId(getInputValue(request, 'LLM-Skills-AI', 'ai'))

  const configuredMode = normalizeMode(String(cfg.skillsAuthMode ?? ''))
  const preferredToolMode = resolvePreferredToolMode(cfg.aiToolMode)
  const finalUrl = origin
  const endpoints = buildEndpoints(origin)
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

  const mode = (modeFromInput ?? configuredMode) as SkillsMode
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
        legacyMcpConfigured,
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
