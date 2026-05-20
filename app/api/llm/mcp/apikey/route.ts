import { NextRequest, NextResponse } from 'next/server'

import { enforceApiRateLimit } from '@/lib/api-rate-limit'
import {
  hasLegacyMcpApiKeyConfigured,
  isLegacyMcpEnabled,
  verifyLegacyMcpApiKey,
} from '@/lib/skills-auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const LLM_MCP_APIKEY_RATE_LIMIT_MAX = 60
const LLM_MCP_APIKEY_RATE_LIMIT_WINDOW_MS = 60_000

function readToken(request: NextRequest) {
  const auth = (request.headers.get('authorization') ?? '').trim()
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim()
  }

  const headerToken = (request.headers.get('x-waken-mcp-key') ?? '').trim()
  if (headerToken) return headerToken
  return ''
}

function hasQueryToken(request: NextRequest): boolean {
  return (request.nextUrl.searchParams.get('token') ?? '').trim().length > 0
}

async function handle(request: NextRequest) {
  if (hasQueryToken(request)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Query token is deprecated. Use the Authorization or X-Waken-MCP-Key request header instead.',
      },
      { status: 400 },
    )
  }

  const limitedResponse = await enforceApiRateLimit(request, {
    bucket: 'llm-mcp-apikey',
    maxRequests: LLM_MCP_APIKEY_RATE_LIMIT_MAX,
    windowMs: LLM_MCP_APIKEY_RATE_LIMIT_WINDOW_MS,
  })
  if (limitedResponse) return limitedResponse

  const enabled = await isLegacyMcpEnabled()
  const configured = await hasLegacyMcpApiKeyConfigured()
  const token = readToken(request)

  if (!enabled) {
    return NextResponse.json(
      {
        success: false,
        error: 'MCP is not enabled',
        data: {
          enabled,
          configured,
          enabledBy: 'siteConfig.skillsDebugEnabled && siteConfig.mcpThemeToolsEnabled',
        },
      },
      { status: 403 },
    )
  }

  if (!configured) {
    return NextResponse.json(
      {
        success: false,
        error: 'MCP API key is not configured',
        data: {
          enabled,
          configured,
          enabledBy: 'siteConfig.skillsDebugEnabled && siteConfig.mcpThemeToolsEnabled',
        },
      },
      { status: 503 },
    )
  }

  if (!token) {
    return NextResponse.json(
      {
        success: false,
        error: 'Missing MCP API key',
        data: {
          enabled,
          configured,
          enabledBy: 'siteConfig.skillsDebugEnabled && siteConfig.mcpThemeToolsEnabled',
          acceptedAuth: ['Authorization: Bearer <key>', 'X-Waken-MCP-Key: <key>'],
        },
      },
      { status: 401 },
    )
  }

  const ok = await verifyLegacyMcpApiKey(token)
  if (!ok) {
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid MCP API key',
        data: {
          enabled,
          configured,
          enabledBy: 'siteConfig.skillsDebugEnabled && siteConfig.mcpThemeToolsEnabled',
        },
      },
      { status: 401 },
    )
  }

  return NextResponse.json({
    success: true,
    data: {
      enabled,
      configured,
      valid: true,
      enabledBy: 'siteConfig.skillsDebugEnabled && siteConfig.mcpThemeToolsEnabled',
    },
  })
}

export const GET = handle
export const POST = handle
