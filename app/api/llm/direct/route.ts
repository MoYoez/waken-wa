import { NextRequest, NextResponse } from 'next/server'

import { enforceApiRateLimit } from '@/lib/api-rate-limit'
import { getPublicOrigin } from '@/lib/public-request-url'
import { getSiteConfigMemoryFirst } from '@/lib/site-config-cache'
import {
  createSkillsOauthAuthorizeCode,
  getConfiguredSkillsMode,
  hasLegacyMcpApiKeyConfigured,
  hasSkillsApiKeyConfigured,
  hasSkillsOauthTokenConfigured,
  isLegacyMcpEnabled,
  normalizeAiClientId,
  parseMode,
} from '@/lib/skills-auth'
import type { LlmEndpoints, SkillsMode, ToolMode } from '@/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const LLM_DIRECT_RATE_LIMIT_MAX = 120
const LLM_DIRECT_RATE_LIMIT_WINDOW_MS = 60_000

function resolvePreferredToolMode(raw: unknown): ToolMode {
  return String(raw ?? '').trim().toLowerCase() === 'mcp' ? 'mcp' : 'skills'
}

function buildEndpoints(origin: string): LlmEndpoints {
  const llmBaseUrl = `${origin}/api/llm`
  return {
    llmBase: llmBaseUrl,
    direct: `${llmBaseUrl}/direct`,
    markdown: `${llmBaseUrl}/md`,
    settingsCore: `${llmBaseUrl}/settings/core`,
    settingsTheme: `${llmBaseUrl}/settings/theme`,
    settingsSchedule: `${llmBaseUrl}/settings/schedule`,
    settingsRules: `${llmBaseUrl}/settings/rules`,
    appsExport: `${llmBaseUrl}/activity/apps-export`,
    oauthExchange: `${llmBaseUrl}/oauth/exchange`,
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
        error: 'Query token is deprecated. Use the LLM-Skills-Token request header instead.',
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
  const modeFromInput = parseMode(getInputValue(request, 'LLM-Skills-Mode', 'mode'))
  const token = getHeaderValue(request, 'LLM-Skills-Token')
  const scope = getInputValue(request, 'LLM-Skills-Scope', 'scope') || 'theme'
  const ai = normalizeAiClientId(getInputValue(request, 'LLM-Skills-AI', 'ai'))

  const configuredMode = getConfiguredSkillsMode(cfg.skillsAuthMode)
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
          error: 'MCP is not enabled. Enable MCP mode and the standalone MCP switch in admin settings first.',
          finalUrl,
          preferredToolMode,
          endpoints,
          guide: {
            nextStep: 'open_admin_settings',
            where: 'Web Settings -> Advanced Settings -> Allow AI Debugging -> MCP',
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
          error: 'Missing MCP API key',
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
        error: 'Skills authentication mode is not configured. Select OAuth or APIKEY in settings first.',
        finalUrl,
        preferredToolMode,
        endpoints,
        guide: {
          nextStep: 'open_admin_settings',
          where: 'Web Settings -> Advanced Settings -> Allow AI Debugging',
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
        error: 'Authentication mode is missing or mismatched. Request the direct endpoint first to read the current mode.',
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
  const effectiveAi = mode === 'oauth' ? ai : ai
  if (mode === 'oauth' && !effectiveAi) {
    return NextResponse.json(
      {
        success: false,
        error: 'OAuth mode requires an AI identifier in LLM-Skills-AI or the ai query parameter. Use your own stable AI name.',
        finalUrl,
        preferredToolMode,
        endpoints,
        guide: {
          nextStep: 'provide_ai_tag',
          requiredHeader: 'LLM-Skills-AI',
          requiredQuery: 'ai',
          rule: 'use_your_own_stable_ai_name',
        },
      },
      { status: 400 },
    )
  }

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
        error: 'Missing token',
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
          aiRule:
            mode === 'oauth'
              ? 'LLM-Skills-AI must be your own stable AI name and must stay the same across authorize, exchange, and business calls.'
              : null,
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
          exchangeUrl: mode === 'oauth' ? endpoints.oauthExchange : null,
          flow:
            mode === 'oauth'
              ? ['open_authorize_link', 'confirm_authorize_on_page', 'exchange_code_for_key']
              : ['provide_apikey'],
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
        'LLM-Skills-AI': effectiveAi || 'YOUR_OWN_STABLE_AI_NAME',
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
        exchangeOauthCodeAt: endpoints.oauthExchange,
        useSettingsCoreAt: endpoints.settingsCore,
        useSettingsThemeAt: endpoints.settingsTheme,
        useSettingsScheduleAt: endpoints.settingsSchedule,
        useSettingsRulesAt: endpoints.settingsRules,
        useAppsExportAt: endpoints.appsExport,
        useLegacyMcpAt: endpoints.legacyMcp,
        verifyLegacyMcpApiKeyAt: endpoints.legacyMcpApiKeyVerify,
      },
    },
  })
}
